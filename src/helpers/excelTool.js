import * as XLSX from "xlsx";
import moment from "moment";
import { Modal } from "bootstrap";
import dbRepository from "../repositories/dbRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";

const COLUMNS = ["清单类型", "清单名称", "日期", "事件", "是否完成", "时间", "备注", "子任务"];

export default {
  // ---------- 导出 ----------
  exportExcel() {
    let customListMap = {};
    customToDoListIdsRepository.load().forEach((c) => {
      customListMap[c.listId] = c.listName;
    });

    let rows = [];
    let db_req = dbRepository.open();
    db_req.onsuccess = function (event) {
      let db = event.target.result;
      let request = dbRepository.selectAll(db, "todo_lists");
      request.onsuccess = function () {
        let cursor = request.result;
        if (cursor) {
          appendRowsForList(rows, cursor.key, cursor.value, customListMap);
          cursor.continue();
        } else {
          writeWorkbook(rows);
        }
      };
      request.onerror = function () {
        hideExportingModal();
      };
    };
    db_req.onerror = function () {
      hideExportingModal();
    };
  },

  // ---------- 导入 ----------
  excelImport(event) {
    let file = event.target.files[0];
    if (!file) {
      hideImportingModal();
      return;
    }

    let reader = new FileReader();
    reader.onload = function (e) {
      try {
        let data = new Uint8Array(e.target.result);
        let workbook = XLSX.read(data, { type: "array" });
        let sheet = workbook.Sheets[workbook.SheetNames[0]];
        let rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (rows.length === 0) {
          showInvalidFileToast();
          hideImportingModal();
          return;
        }
        processImportRows(rows);
      } catch (err) {
        showInvalidFileToast();
        hideImportingModal();
      }
    };
    reader.onerror = function () {
      showInvalidFileToast();
      hideImportingModal();
    };
    reader.readAsArrayBuffer(file);
  },
};

// ---------- 导出的内部函数 ----------

function appendRowsForList(rows, listId, tasks, customListMap) {
  let isDateList = moment(listId, "YYYYMMDD", true).isValid();
  let dateStr = isDateList ? moment(listId, "YYYYMMDD").format("YYYY-MM-DD") : "";
  let listLabel = isDateList ? dateStr : customListMap[listId] || listId;

  (tasks || []).forEach((task) => {
    rows.push({
      清单类型: isDateList ? "日历" : "自定义",
      清单名称: listLabel,
      日期: dateStr,
      事件: task.text || "",
      是否完成: task.checked ? "是" : "否",
      时间: task.time || "",
      备注: task.desc || "",
      子任务: (task.subTaskList || [])
        .map((st) => (st.checked ? "[x] " : "[ ] ") + st.text)
        .join("；"),
    });
  });
}

function writeWorkbook(rows) {
  rows.sort((a, b) => {
    if (a.清单类型 !== b.清单类型) return a.清单类型 === "日历" ? -1 : 1;
    return a.日期 > b.日期 ? 1 : a.日期 < b.日期 ? -1 : 0;
  });

  let ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "WeekToDo导出");
  XLSX.writeFile(wb, `WeekToDo导出_${moment().format("YYYYMMDD_HHmm")}.xlsx`);

  hideExportingModal();
}

function hideExportingModal() {
  setTimeout(function () {
    let modalEl = document.getElementById("exportingModal");
    let modal = Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }, 300);
}

// ---------- 导入的内部函数 ----------

function parseSubTasks(text) {
  if (!text) return [];
  return text
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      let checked = s.startsWith("[x]");
      let cleanText = s.replace(/^\[x\]|\[ \]/, "").trim();
      return { text: cleanText, checked: checked, editing: false };
    });
}

function rowToTask(row, listId) {
  return {
    text: row["事件"] || "",
    checked: row["是否完成"] === "是",
    listId: listId,
    desc: row["备注"] || "",
    subTaskList: parseSubTasks(row["子任务"]),
    color: "none",
    priority: 0,
    tags: [],
    time: row["时间"] || null,
    alarm: false,
    repeatingEvent: null,
  };
}

function processImportRows(rows) {
  let customListIds = customToDoListIdsRepository.load();
  let nameToId = {};
  customListIds.forEach((c) => (nameToId[c.listName] = c.listId));

  let grouped = {}; // listId -> [task, ...]
  let newCustomLists = [];

  rows.forEach((row) => {
    let listId;
    if (row["清单类型"] === "日历") {
      let m = moment(row["日期"], ["YYYY-MM-DD", "YYYY/MM/DD", "YYYYMMDD"], true);
      if (!m.isValid()) return; // 日期格式无法识别,跳过这一行
      listId = m.format("YYYYMMDD");
    } else {
      let name = row["清单名称"];
      if (!name) return; // 自定义清单必须有名称,否则跳过
      if (!nameToId[name]) {
        let newId = moment().format("YYYYMMDDTHHmmssSSS") + Math.floor(Math.random() * 1000);
        nameToId[name] = newId;
        newCustomLists.push({ listId: newId, listName: name });
      }
      listId = nameToId[name];
    }
    if (!grouped[listId]) grouped[listId] = [];
    grouped[listId].push(rowToTask(row, listId));
  });

  if (newCustomLists.length > 0) {
    customToDoListIdsRepository.update(customListIds.concat(newCustomLists));
  }

  let listIds = Object.keys(grouped);
  if (listIds.length === 0) {
    showInvalidFileToast();
    hideImportingModal();
    return;
  }

  mergeIntoDb(listIds, grouped);
}

function mergeIntoDb(listIds, grouped) {
  let db_req = dbRepository.open();
  db_req.onsuccess = function (event) {
    let db = event.target.result;
    let i = 0;

    function next() {
      if (i >= listIds.length) {
        finishImport();
        return;
      }
      let listId = listIds[i];
      let get_req = dbRepository.get(db, "todo_lists", listId);
      get_req.onsuccess = function () {
        let existing = get_req.result || [];
        let merged = existing.concat(grouped[listId]);
        // 注意:必须用 update(put),不能用 add,否则遇到已存在的 listId 会报错中断
        let put_req = dbRepository.update(db, "todo_lists", listId, merged);
        put_req.onsuccess = function () {
          i++;
          next();
        };
        put_req.onerror = function () {
          i++;
          next();
        };
      };
      get_req.onerror = function () {
        i++;
        next();
      };
    }
    next();
  };
  db_req.onerror = function () {
    hideImportingModal();
  };
}

function finishImport() {
  setTimeout(function () {
    let modal = Modal.getInstance(document.getElementById("importingModal"));
    if (modal) modal.hide();
    location.reload(); // 与现有 exportTool.js 的做法一致,刷新页面重新加载数据
  }, 300);
}

function showInvalidFileToast() {
  let toastEl = document.getElementById("invalidFile");
  if (toastEl) {
    let { Toast } = require("bootstrap");
    let toast = Toast.getOrCreateInstance(toastEl);
    toast.show();
  }
}

function hideImportingModal() {
  setTimeout(function () {
    let modal = Modal.getInstance(document.getElementById("importingModal"));
    if (modal) modal.hide();
  }, 300);
}
