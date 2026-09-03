/**
 * spanSyncHelper.js
 * 跨天任务状态同步工具 v2
 *
 * 核心设计：
 * 1. 每个跨天源任务都有一个唯一 _spanId（创建时生成）
 * 2. 所有镜像通过 _spanId + _spanSourceId 双字段关联到源任务
 * 3. 同步分两种：
 *    - syncSpanningChecked: 只同步 checked（用于列表勾选，轻量快速）
 *    - syncSpanningState: 同步全部可变字段（用于详情页编辑、行内编辑后）
 * 4. 查找使用 _spanId 精确匹配，支持同一日期有多个跨天任务
 * 5. 镜像遍历不依赖 selectedDates，而是根据 startDate~endDate 自行计算
 *
 * 数据结构约定：
 *   源任务: { ..., endDate: "YYYYMMDD", _spanId: "uuid-xxx" }
 *   镜像:   { ..., endDate: "YYYYMMDD", _spanId: "uuid-xxx", _isSpanMirror: true, _spanSourceId: "YYYYMMDD" }
 */

import moment from "moment";
import toDoListRepository from "../repositories/toDoListRepository";

// ---------- 工具函数 ----------

let _counter = 0;

/**
 * 生成简单的唯一 ID
 */
export function generateSpanId() {
  _counter++;
  return "span_" + Date.now().toString(36) + "_" + _counter.toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

/**
 * 判断一个任务是否属于跨天任务体系（源任务或镜像）
 */
export function isSpanningTask(todo) {
  if (!todo) return false;
  return !!(todo._isSpanMirror || todo.endDate);
}

/**
 * 获取跨天任务的源信息
 */
export function getSpanInfo(todo) {
  if (!todo) return null;
  if (todo._isSpanMirror && todo._spanSourceId) {
    return {
      spanId: todo._spanId,
      sourceListId: todo._spanSourceId,
      startDate: todo._spanSourceId,
      endDate: todo.endDate,
    };
  } else if (todo.endDate && todo._spanId) {
    return {
      spanId: todo._spanId,
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
  if (!startDate || !endDate) return dates;
  let start = moment(startDate, "YYYYMMDD");
  let end = moment(endDate, "YYYYMMDD");
  if (!start.isValid() || !end.isValid()) return dates;
  let current = start.clone();
  while (current.isSameOrBefore(end, "day")) {
    dates.push(current.format("YYYYMMDD"));
    current.add(1, "d");
  }
  return dates;
}

// ---------- 同步字段定义 ----------

const SYNC_FIELDS = [
  "checked", "text", "desc", "subTaskList",
  "color", "tags", "time", "alarm", "reminders",
  "priority", "endDate"
];

/**
 * 深拷贝一个字段值
 */
function cloneField(field, value) {
  if (value == null || value === undefined) return value;
  if (field === "subTaskList") {
    return JSON.parse(JSON.stringify(value));
  }
  if (field === "tags" || field === "reminders") {
    return Array.isArray(value) ? [...value] : [];
  }
  return value;
}

/**
 * 将源任务的字段拷贝到目标任务
 */
function copyFields(source, target) {
  SYNC_FIELDS.forEach((field) => {
    target[field] = cloneField(field, source[field]);
  });
}

// ---------- 核心：查找函数 ----------

/**
 * 在指定日期列表中找到 _spanId 匹配的任务
 */
function findBySpanId(list, spanId, isMirror) {
  if (!list || !spanId) return null;
  if (isMirror) {
    return list.find((t) => t._isSpanMirror && t._spanId === spanId) || null;
  } else {
    return list.find((t) => !t._isSpanMirror && t._spanId === spanId) || null;
  }
}

// ---------- 核心同步 ----------

/**
 * 全字段同步：当跨天任务的任何内容变更后调用
 * 会同步 text/desc/checked/subTasks/color/tags/time/alarm/reminders/priority/endDate
 *
 * @param {Object} changedTodo - 发生变更的任务（可以是源或镜像）
 * @param {Object} store - Vuex store
 */
export function syncSpanningState(changedTodo, store) {
  let spanInfo = getSpanInfo(changedTodo);
  if (!spanInfo || !spanInfo.spanId) return;

  let { spanId, sourceListId, endDate } = spanInfo;
  let allDates = getAllSpanDates(sourceListId, endDate);
  if (allDates.length <= 1) return; // 不跨天

  // 确定"真相来源"：谁的字段是最新的
  let canonicalData = changedTodo;

  // 如果变更来自镜像，也要把改动写回源
  if (changedTodo._isSpanMirror) {
    let sourceList = store.getters.todoLists[sourceListId];
    if (sourceList) {
      let sourceTask = findBySpanId(sourceList, spanId, false);
      if (sourceTask) {
        copyFields(canonicalData, sourceTask);
        toDoListRepository.update(sourceListId, sourceList);
      }
    }
  }

  // 同步到所有日期的镜像
  allDates.forEach((dateId) => {
    if (dateId === sourceListId) return;
    let list = store.getters.todoLists[dateId];
    if (!list) return;

    let mirror = findBySpanId(list, spanId, true);
    if (mirror && mirror !== changedTodo) {
      copyFields(canonicalData, mirror);
      toDoListRepository.update(dateId, list);
    }
  });
}

/**
 * 仅同步 checked 状态（轻量级，用于列表中的勾选操作）
 */
export function syncSpanningChecked(changedTodo, store) {
  let spanInfo = getSpanInfo(changedTodo);
  if (!spanInfo || !spanInfo.spanId) return;

  let { spanId, sourceListId, endDate } = spanInfo;
  let allDates = getAllSpanDates(sourceListId, endDate);
  let newChecked = changedTodo.checked;

  allDates.forEach((dateId) => {
    let list = store.getters.todoLists[dateId];
    if (!list) return;

    let target;
    if (dateId === sourceListId) {
      target = findBySpanId(list, spanId, false);
    } else {
      target = findBySpanId(list, spanId, true);
    }

    if (target && target !== changedTodo) {
      target.checked = newChecked;
      toDoListRepository.update(dateId, list);
    }
  });
}

/**
 * 清除指定 _spanId 在所有涉及日期上的镜像
 * 用于：删除源任务、修改日期区间、拖拽移动任务时
 */
export function clearMirrorsBySpanId(spanId, sourceListId, endDate, store) {
  if (!spanId || !endDate) return;
  let allDates = getAllSpanDates(sourceListId, endDate);
  allDates.forEach((dateId) => {
    if (dateId === sourceListId) return;
    let list = store.getters.todoLists[dateId];
    if (!list) return;
    let filtered = list.filter((t) => !(t._isSpanMirror && t._spanId === spanId));
    if (filtered.length !== list.length) {
      store.commit("loadTodoLists", { todoListId: dateId, todoList: filtered });
      toDoListRepository.update(dateId, filtered);
    }
  });
}

/**
 * 为源任务创建镜像到所有涉及日期
 * 用于：设定/修改日期区间、撤销删除时
 */
export function createMirrorsForTask(sourceTodo, store) {
  if (!sourceTodo || !sourceTodo.endDate || !sourceTodo._spanId) return;
  let start = moment(sourceTodo.listId, "YYYYMMDD");
  let end = moment(sourceTodo.endDate, "YYYYMMDD");
  let current = start.clone().add(1, "d");

  while (current.isSameOrBefore(end, "day")) {
    let dateId = current.format("YYYYMMDD");
    let list = store.getters.todoLists[dateId];
    if (list) {
      // 避免重复
      let exists = list.some((t) => t._isSpanMirror && t._spanId === sourceTodo._spanId);
      if (!exists) {
        let mirror = {
          text: sourceTodo.text,
          checked: sourceTodo.checked,
          listId: dateId,
          desc: sourceTodo.desc,
          subTaskList: JSON.parse(JSON.stringify(sourceTodo.subTaskList || [])),
          color: sourceTodo.color,
          priority: sourceTodo.priority || 0,
          tags: sourceTodo.tags ? [...sourceTodo.tags] : [],
          time: sourceTodo.time,
          alarm: sourceTodo.alarm,
          reminders: sourceTodo.reminders ? [...sourceTodo.reminders] : [],
          repeatingEvent: null,
          endDate: sourceTodo.endDate,
          _isSpanMirror: true,
          _spanSourceId: sourceTodo.listId,
          _spanId: sourceTodo._spanId,
        };
        list.push(mirror);
        store.commit("loadTodoLists", { todoListId: dateId, todoList: list });
        toDoListRepository.update(dateId, list);
      }
    }
    current.add(1, "d");
  }
}

/**
 * 确保源任务有 _spanId（兼容旧数据迁移）
 * 在 toDoModal watch 初始化时调用
 */
export function ensureSpanId(todo) {
  if (todo.endDate && !todo._spanId) {
    todo._spanId = generateSpanId();
  }
  if (todo._isSpanMirror && !todo._spanId) {
    // 旧版镜像没有 _spanId，尝试从 _spanSourceId 生成
    todo._spanId = generateSpanId();
  }
}

export default {
  generateSpanId,
  isSpanningTask,
  getSpanInfo,
  getAllSpanDates,
  syncSpanningState,
  syncSpanningChecked,
  clearMirrorsBySpanId,
  createMirrorsForTask,
  ensureSpanId,
};
