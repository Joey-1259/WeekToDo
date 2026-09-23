import moment from "moment";
import focusDataRepository, {
  FOCUS_STORES,
} from "../repositories/focusDataRepository";
import todoTaskRepository from "../repositories/todoTaskRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";
import { createId } from "../helpers/idHelper";

function dispatchChange(detail) {
  window.dispatchEvent(
    new CustomEvent("weektodo:task-changed", { detail })
  );
}

function pruneLinkedTaskNodes(node, taskId) {
  if (!node || typeof node !== "object") {
    return node;
  }

  if (
    node.type === "linkedTask" &&
    node.attrs?.taskId === taskId
  ) {
    return null;
  }

  const next = { ...node };

  if (Array.isArray(node.content)) {
    next.content = node.content
      .map((child) =>
        pruneLinkedTaskNodes(child, taskId)
      )
      .filter(Boolean);
  }

  if (
    next.type === "doc" &&
    (
      !Array.isArray(next.content) ||
      !next.content.length
    )
  ) {
    next.content = [
      { type: "paragraph" },
    ];
  }

  return next;
}

const focusTaskService = {
  async initializeTaskIds() {
    return todoTaskRepository.ensureAllTaskIds();
  },

  listTargets() {
    const dates = Array.from({ length: 14 }, (_, index) => {
      const date = moment().add(index, "day");
      return {
        listId: date.format("YYYYMMDD"),
        label:
          index === 0 ? "今天" : index === 1 ? "明天" : date.format("M月D日 ddd"),
        type: "date",
      };
    });

    const customLists = customToDoListIdsRepository.load() || [];

    return [
      ...dates,
      ...customLists.map((item) => ({
        listId: item.listId,
        label: item.listName || "自定义列表",
        type: "custom",
      })),
    ];
  },

  async createLinkedTask(documentId, input) {
    const task = await todoTaskRepository.createTask(input);
    const blockId = createId("task-block");

    const link = {
      id: createId("task-link"),
      documentId,
      taskId: task.id,
      blockId,
      listId: task.listId,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await focusDataRepository.put(FOCUS_STORES.taskLinks, link);

    dispatchChange({
      action: "created",
      taskId: task.id,
      listId: task.listId,
    });

    return {
      blockId,
      taskId: task.id,
      listId: task.listId,
      title: task.text,
      checked: task.checked,
      missing: false,
      color: task.color || "none",
      tags: Array.isArray(task.tags) ? task.tags : [],
    };
  },

  /* PATCH_20260923_V1 */
  async duplicateLinkedTask(documentId, { taskId, listId = null }) {
    const task = await todoTaskRepository.duplicateTask(taskId, listId);
    const blockId = createId("task-block");
    const now = new Date().toISOString();

    await focusDataRepository.put(FOCUS_STORES.taskLinks, {
      id: createId("task-link"),
      documentId,
      taskId: task.id,
      blockId,
      listId: task.listId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    dispatchChange({ action: "created", taskId: task.id, listId: task.listId });

    return {
      blockId,
      taskId: task.id,
      listId: task.listId,
      title: task.text,
      checked: task.checked,
      missing: false,
      color: task.color || "none",
      tags: Array.isArray(task.tags) ? task.tags : [],
    };
  },

  async resolveTask(taskId, listId = null) {
    const found = await todoTaskRepository.getTask(taskId, listId);
    return found?.task || null;
  },

  async toggleTask(taskId, listId = null) {
    const task = await todoTaskRepository.toggleTask(taskId, listId);
    dispatchChange({ action: "updated", taskId, listId: task.listId, task });
    return task;
  },

  async updateTask(taskId, patch, listId = null) {
    const task = await todoTaskRepository.updateTask(taskId, patch, listId);
    dispatchChange({ action: "updated", taskId, listId: task.listId, task });
    return task;
  },

  async getLinksForDocument(documentId) {
    return focusDataRepository.getAllByIndex(
      FOCUS_STORES.taskLinks,
      "documentId",
      documentId
    );
  },

  async getLinkedTaskText(documentId) {
    const links = await this.getLinksForDocument(documentId);
    const values = await Promise.all(
      links
        .filter((link) => link.status !== "unlinked")
        .map((link) => this.resolveTask(link.taskId, link.listId))
    );
    return values
      .filter(Boolean)
      .map((task) => task.text)
      .join(" ");
  },

  async purgeTaskReferences(taskId) {
    if (!taskId) return;

    const links =
      await focusDataRepository.getAllByIndex(
        FOCUS_STORES.taskLinks,
        "taskId",
        taskId
      );

    const documentIds = [
      ...new Set(
        links
          .map((link) => link.documentId)
          .filter(Boolean)
      ),
    ];

    await Promise.all(
      documentIds.map(async (documentId) => {
        const document =
          await focusDataRepository.get(
            FOCUS_STORES.documents,
            documentId
          );

        if (!document) return;

        const nextContent =
          pruneLinkedTaskNodes(
            document.content,
            taskId
          );

        if (
          JSON.stringify(nextContent) ===
          JSON.stringify(document.content)
        ) {
          return;
        }

        await focusDataRepository.put(
          FOCUS_STORES.documents,
          {
            ...document,
            content: nextContent,
            updatedAt:
              new Date().toISOString(),
          }
        );
      })
    );

    await Promise.all(
      links.map((link) =>
        focusDataRepository.remove(
          FOCUS_STORES.taskLinks,
          link.id
        )
      )
    );
  },

  async deleteLinkedTask({
    taskId,
    listId = null,
  }) {
    if (!taskId) return false;

    const deleted =
      await todoTaskRepository.deleteTask(
        taskId,
        listId
      );

    await this.purgeTaskReferences(taskId);

    dispatchChange({
      action: "deleted",
      taskId,
      listId,
    });

    return deleted;
  },

  async handleExternalDeletion({
    taskId,
    listId = null,
  }) {
    if (!taskId) return;

    await this.purgeTaskReferences(taskId);

    dispatchChange({
      action: "deleted",
      taskId,
      listId,
    });
  },

  async unlink({ documentId, taskId, blockId, deleteTask = false, listId = null }) {
    const links = await this.getLinksForDocument(documentId);
    const link = links.find(
      (item) => item.taskId === taskId && (!blockId || item.blockId === blockId)
    );

    if (link) {
      await focusDataRepository.put(FOCUS_STORES.taskLinks, {
        ...link,
        status: deleteTask ? "task-deleted" : "unlinked",
        updatedAt: new Date().toISOString(),
      });
    }

    if (deleteTask) {
      await todoTaskRepository.deleteTask(taskId, listId || link?.listId);
    }

    dispatchChange({
      action: deleteTask ? "deleted" : "unlinked",
      taskId,
      listId: listId || link?.listId,
    });
  },

  async removeDocumentLinks(documentId) {
    const links = await this.getLinksForDocument(documentId);
    await Promise.all(
      links.map((link) =>
        focusDataRepository.remove(FOCUS_STORES.taskLinks, link.id)
      )
    );
  },
};

export default focusTaskService;
