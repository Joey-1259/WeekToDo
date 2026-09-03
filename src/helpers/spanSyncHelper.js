/**
 * spanSyncHelper.js
 * 跨天任务状态同步工具
 *
 * 设计思路：
 * - 源任务存储在 startDate 对应的列表中，通过 endDate 字段标识跨天
 * - 镜像任务存储在 startDate+1 ~ endDate 的列表中，带有 _isSpanMirror / _spanSourceId 标记
 * - 任何一端的 checked 状态变化，都要同步到源和所有镜像
 * - 同时同步 text / desc / subTaskList / color / tags / time / alarm / reminders 等字段
 */

import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";

/**
 * 判断一个任务是否属于跨天任务体系（源任务或镜像）
 */
export function isSpanningTask(todo) {
  return !!(todo._isSpanMirror || todo.endDate);
}

/**
 * 获取跨天任务的源信息
 * @returns { sourceListId, startDate, endDate } 或 null
 */
export function getSpanInfo(todo) {
  if (todo._isSpanMirror) {
    // 是镜像，源在 _spanSourceId
    return {
      sourceListId: todo._spanSourceId,
      startDate: todo._spanSourceId,
      endDate: todo.endDate,
    };
  } else if (todo.endDate) {
    // 是源任务
    return {
      sourceListId: todo.listId,
      startDate: todo.listId,
      endDate: todo.endDate,
    };
  }
  return null;
}

/**
 * 收集跨天任务涉及的所有日期 ID（含源日期）
 */
export function getAllSpanDates(startDate, endDate) {
  let dates = [];
  let start = moment(startDate, "YYYYMMDD");
  let end = moment(endDate, "YYYYMMDD");
  let current = start.clone();
  while (current.isSameOrBefore(end, "day")) {
    dates.push(current.format("YYYYMMDD"));
    current.add(1, "d");
  }
  return dates;
}

/**
 * 需要同步的字段列表
 */
const SYNC_FIELDS = ["checked", "text", "desc", "subTaskList", "color", "tags", "time", "alarm", "reminders"];

/**
 * 将源任务的关键字段同步到一个镜像任务
 */
function syncFieldsToMirror(source, mirror) {
  SYNC_FIELDS.forEach((field) => {
    if (field === "subTaskList") {
      mirror[field] = JSON.parse(JSON.stringify(source[field] || []));
    } else if (field === "tags" || field === "reminders") {
      mirror[field] = source[field] ? [...source[field]] : [];
    } else {
      mirror[field] = source[field];
    }
  });
}

/**
 * 将镜像任务的变更同步回源任务
 */
function syncFieldsToSource(mirror, source) {
  SYNC_FIELDS.forEach((field) => {
    if (field === "subTaskList") {
      source[field] = JSON.parse(JSON.stringify(mirror[field] || []));
    } else if (field === "tags" || field === "reminders") {
      source[field] = mirror[field] ? [...mirror[field]] : [];
    } else {
      source[field] = mirror[field];
    }
  });
}

/**
 * 核心同步函数：当一个跨天任务（源或镜像）发生变更后调用
 *
 * @param {Object} changedTodo - 发生变更的任务对象
 * @param {Object} store - Vuex store 实例
 */
export function syncSpanningState(changedTodo, store) {
  let spanInfo = getSpanInfo(changedTodo);
  if (!spanInfo) return;

  let allDates = getAllSpanDates(spanInfo.startDate, spanInfo.endDate);
  let sourceListId = spanInfo.sourceListId;

  // 第一步：找到源任务
  let sourceList = store.getters.todoLists[sourceListId];
  if (!sourceList) return;

  let sourceTask = null;
  if (changedTodo._isSpanMirror) {
    // 变更来自镜像，需要找到源任务并更新
    sourceTask = sourceList.find(
      (t) => !t._isSpanMirror && t.endDate === spanInfo.endDate && t.text !== undefined
    );
    // 如果按 text 找不准（可能 text 也变了），用更稳妥的方式：
    // 源任务是该列表中 endDate 匹配且不是镜像的那个
    if (!sourceTask) {
      sourceTask = sourceList.find((t) => !t._isSpanMirror && t.endDate);
    }
    if (sourceTask) {
      syncFieldsToSource(changedTodo, sourceTask);
      toDoListRepository.update(sourceListId, sourceList);
    }
  } else {
    // 变更来自源任务本身
    sourceTask = changedTodo;
  }

  if (!sourceTask) return;

  // 第二步：同步到所有镜像
  allDates.forEach((dateId) => {
    if (dateId === sourceListId) return; // 源列表已处理
    let list = store.getters.todoLists[dateId];
    if (!list) return;

    let mirror = list.find(
      (t) => t._isSpanMirror && t._spanSourceId === sourceListId
    );
    if (mirror) {
      syncFieldsToMirror(sourceTask, mirror);
      toDoListRepository.update(dateId, list);
    }
  });
}

/**
 * 仅同步 checked 状态（轻量级，用于列表中勾选操作）
 */
export function syncSpanningChecked(changedTodo, store) {
  let spanInfo = getSpanInfo(changedTodo);
  if (!spanInfo) return;

  let allDates = getAllSpanDates(spanInfo.startDate, spanInfo.endDate);
  let sourceListId = spanInfo.sourceListId;
  let newChecked = changedTodo.checked;

  allDates.forEach((dateId) => {
    let list = store.getters.todoLists[dateId];
    if (!list) return;

    let target;
    if (dateId === sourceListId) {
      target = list.find((t) => !t._isSpanMirror && t.endDate === spanInfo.endDate);
    } else {
      target = list.find((t) => t._isSpanMirror && t._spanSourceId === sourceListId);
    }

    if (target && target !== changedTodo) {
      target.checked = newChecked;
      toDoListRepository.update(dateId, list);
    }
  });
}

export default {
  isSpanningTask,
  getSpanInfo,
  getAllSpanDates,
  syncSpanningState,
  syncSpanningChecked,
};
