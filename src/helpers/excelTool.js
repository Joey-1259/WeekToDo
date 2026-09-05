import moment from "moment";
import { Modal, Toast } from "bootstrap";
import dbRepository from "../repositories/dbRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";
import anniversaryRepository from "../repositories/anniversaryRepository";
import archiveRepository from "../repositories/archiveRepository";

// ==================== Sheet1: 事项 ====================
const TASK_COLUMNS = [
  "清单类型", "清单名称", "日期", "结束日期", "事件", "是否完成",
  "时间", "颜色", "标签", "备注", "子任务",
];

// ==================== Sheet2: 纪念日 ====================
const ANNIVERSARY_COLUMNS = [
  "名称", "重复", "日期类型", "日期", "农历月", "农历日", "农历闰月",
  "标签ID", "颜色", "提前提醒天数", "备注",
];

// ==================== Sheet3: 归档历史 ====================
const ARCHIVE_COLUMNS = ["事件", "颜色", "时间", "来源列表", "归档日期"];

export default {
  // ===================== 导出 =====================
  exportExcel() {
    import("xlsx")
      .then((XLSX) => {
        try {
          let customListMap = {};
          customToDoListIdsRepository.load().forEach((c) => {
            customListMap[c.listId] = c.listName;
          });

          let taskRows = [];
          let db_req = dbRepository.open();

          db_req.onsuccess = function (event) {
            try {
              let db = event.target.result;
              let request = dbRepository.selectAll(db, "todo_lists");

              request.onsuccess = function () {
                try {
                  let cursor = request.result;
                  if (cursor) {
                    appendTaskRows(taskRows, cursor.key, cursor.value, customListMap);
                    cursor.continue();
                  } else {
                    let anniversaryRows = buildAnniversaryRows();
                    let archiveRows = buildArchiveRows();
                    writeMultiSheetWorkbook(XLSX, taskRows, anniversaryRows, archiveRows);
                  }
                } catch (innerErr) {
                  console.error("导出 Excel 失败(整理数据阶段):", innerErr);
                  hideExportingModal();
                }
              };
              request.onerror = function () {
                hideExportingModal();
              };
            } catch (dbErr) {
              console.error("导出 Excel 失败(数据库读取阶段):", dbErr);
              hideExportingModal();
            }
          };
          db_req.onerror = function () {
            hideExportingModal();
          };
        } catch (e) {
          console.error("导出 Excel 失败(初始化阶段):", e);
          hideExportingModal();
        }
      })
      .catch(function (e) {
        console.error("导出 Excel 失败(加载 xlsx 库失败):", e);
        showInvalidFileToast();
        hideExportingModal();
      });
  },

  // ===================== 导入 =====================
  excelImport(event) {
    let file = event.target.files[0];
    if (!file) {
      hideImportingModal();
      return;
    }

    import("xlsx")
      .then((XLSX) => {
        let reader = new FileReader();
        reader.onload = function (e) {
          try {
            let data = new Uint8Array(e.target.result);
            let workbook = XLSX.read(data, { type: "array" });
            let sheetNames = workbook.SheetNames;

            let taskSheet = workbook.Sheets[sheetNames[0]];
            let taskRows = XLSX.utils.sheet_to_json(taskSheet, { defval: "" });

            let anniversaryRows = [];
            if (sheetNames.length >= 2) {
              let sheet2 = workbook.Sheets[sheetNames[1]];
              anniversaryRows = XLSX.utils.sheet_to_json(sheet2, { defval: "" });
            }

            let archiveRows = [];
            if (sheetNames.length >= 3) {
              let sheet3 = workbook.Sheets[sheetNames[2]];
              archiveRows = XLSX.utils.sheet_to_json(sheet3, { defval: "" });
            }

            if (taskRows.length === 0 && anniversaryRows.length === 0 && archiveRows.length === 0) {
              showInvalidFileToast();
              hideImportingModal();
              return;
            }

            if (anniversaryRows.length > 0) {
              importAnniversaryRows(anniversaryRows);
            }
            if (archiveRows.length > 0) {
              importArchiveRows(archiveRows);
            }

            if (taskRows.length > 0) {
              processImportTaskRows(taskRows);
            } else {
              finishImport();
            }
          } catch (err) {
            console.error("导入 Excel 失败(解析文件阶段):", err);
            showInvalidFileToast();
            hideImportingModal();
          }
        };
        reader.onerror = function () {
          showInvalidFileToast();
          hideImportingModal();
        };
        reader.readAsArrayBuffer(file);
      })
      .catch(function (e) {
        console.error("导入 Excel 失败(加载 xlsx 库失败):", e);
        showInvalidFileToast();
        hideImportingModal();
      });
  },
};

// ================== 导出内部函数 ==================

function appendTaskRows(rows, listId, tasks, customListMap) {
  let isDateList = moment(listId, "YYYYMMDD", true).isValid();
  let dateStr = isDateList ? moment(listId, "YYYYMMDD").format("YYYY-MM-DD") : "";
  let listLabel = isDateList ? dateStr : customListMap[listId] || listId;

  (tasks || []).forEach((task) => {
    // 跳过跨天镜像任务，只导出源任务
    if (task._isSpanMirror) return;

    let endDateStr = "";
    if (task.endDate) {
      endDateStr = moment(task.endDate, "YYYYMMDD").format("YYYY-MM-DD");
    }

    rows.push({
      "清单类型": isDateList ? "日历" : "自定义",
      "清单名称": listLabel,
      "日期": dateStr,
      "结束日期": endDateStr,
      "事件": task.text || "",
      "是否完成": task.checked ? "是" : "否",
      "时间": task.time || "",
      "颜色": task.color || "none",
      "标签": (task.tags || []).join("，"),
      "备注": task.desc || "",
      "子任务": (task.subTaskList || [])
        .map((st) => (st.checked ? "[x] " : "[ ] ") + st.text)
        .join("；"),
    });
  });
}

function buildAnniversaryRows() {
  let list = anniversaryRepository.load();
  return list.map((item) => ({
    "名称": item.name || "",
    "重复": item.repeat || "none",
    "日期类型": item.dateType || "solar",
    "日期": item.date || "",
    "农历月": item.lunarMonth != null ? item.lunarMonth : "",
    "农历日": item.lunarDay != null ? item.lunarDay : "",
    "农历闰月": item.lunarLeap ? "是" : "否",
    "标签ID": item.tagId || "",
    "颜色": item.color || "",
    "提前提醒天数": item.remindDaysBefore != null ? item.remindDaysBefore : 0,
    "备注": item.note || "",
  }));
}

function buildArchiveRows() {
  let list = archiveRepository.load();
  return list.map((item) => ({
    "事件": item.text || "",
    "颜色": item.color || "none",
    "时间": item.time || "",
    "来源列表": item.sourceListName || "",
    "归档日期": item.archivedAt || "",
  }));
}

function writeMultiSheetWorkbook(XLSX, taskRows, anniversaryRows, archiveRows) {
  try {
    taskRows.sort((a, b) => {
      if (a["清单类型"] !== b["清单类型"]) return a["清单类型"] === "日历" ? -1 : 1;
      return a["日期"] > b["日期"] ? 1 : a["日期"] < b["日期"] ? -1 : 0;
    });

    let wb = XLSX.utils.book_new();

    let ws1 = XLSX.utils.json_to_sheet(taskRows, { header: TASK_COLUMNS });
    XLSX.utils.book_append_sheet(wb, ws1, "事项");

    let ws2 = XLSX.utils.json_to_sheet(
      anniversaryRows.length > 0 ? anniversaryRows : [{}],
      { header: ANNIVERSARY_COLUMNS }
    );
    XLSX.utils.book_append_sheet(wb, ws2, "纪念日");

    let ws3 = XLSX.utils.json_to_sheet(
      archiveRows.length > 0 ? archiveRows : [{}],
      { header: ARCHIVE_COLUMNS }
    );
    XLSX.utils.book_append_sheet(wb, ws3, "归档历史");

    let wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    let blob = new Blob([wbout], { type: "application/octet-stream" });
    let filename = `WeekToDo导出_${moment().format("YYYYMMDD_HHmm")}.xlsx`;
    downloadBlob(blob, filename);
  } catch (e) {
    console.error("导出 Excel 失败(生成文件阶段):", e);
  } finally {
    hideExportingModal();
  }
}

function downloadBlob(blob, filename) {
  let url = URL.createObjectURL(blob);
  let element = document.createElement("a");
  element.setAttribute("href", url);
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ================== 导入内部函数 ==================

function importAnniversaryRows(rows) {
  let existingList = anniversaryRepository.load();
  let existingNames = new Set(existingList.map((a) => a.name));

  rows.forEach((row) => {
    let name = row["名称"];
    if (!name || existingNames.has(name)) return;

    let item = {
      id: "anv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name,
      repeat: row["重复"] || "none",
      dateType: row["日期类型"] || "solar",
      date: row["日期"] || "",
      lunarMonth: row["农历月"] !== "" ? Number(row["农历月"]) : null,
      lunarDay: row["农历日"] !== "" ? Number(row["农历日"]) : null,
      lunarLeap: row["农历闰月"] === "是",
      tagId: row["标签ID"] || "tag_anniversary",
      color: row["颜色"] || "#748ffc",
      remindDaysBefore: row["提前提醒天数"] !== "" ? Number(row["提前提醒天数"]) : 0,
      note: row["备注"] || "",
    };
    existingList.push(item);
    existingNames.add(name);
  });

  anniversaryRepository.update(existingList);
}

function importArchiveRows(rows) {
  let existingList = archiveRepository.load();

  rows.forEach((row) => {
    if (!row["事件"]) return;
    existingList.push({
      text: row["事件"],
      color: row["颜色"] || "none",
      time: row["时间"] || null,
      sourceListName: row["来源列表"] || "",
      sourceListId: "",
      archivedAt: row["归档日期"] || new Date().toISOString(),
    });
  });

  archiveRepository.update(existingList);
}

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

function parseTags(text) {
  if (!text) return [];
  return text
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function rowToTask(row, listId) {
  let endDate = null;
  if (row["结束日期"]) {
    let m = moment(row["结束日期"], ["YYYY-MM-DD", "YYYY/MM/DD", "YYYYMMDD"], true);
    if (m.isValid()) endDate = m.format("YYYYMMDD");
  }

  let color = row["颜色"] || "none";
  if (color === "none" || color === "") color = "none";

  return {
    text: row["事件"] || "",
    checked: row["是否完成"] === "是",
    listId: listId,
    desc: row["备注"] || "",
    subTaskList: parseSubTasks(row["子任务"]),
    color: color,
    priority: 0,
    tags: parseTags(row["标签"]),
    time: row["时间"] || null,
    alarm: false,
    reminders: [],
    repeatingEvent: null,
    endDate: endDate,
  };
}

function processImportTaskRows(rows) {
  try {
    let customListIds = customToDoListIdsRepository.load();
    let nameToId = {};
    customListIds.forEach((c) => (nameToId[c.listName] = c.listId));

    let grouped = {};
    let newCustomLists = [];

    rows.forEach((row) => {
      let listId;
      if (row["清单类型"] === "日历") {
        let m = moment(row["日期"], ["YYYY-MM-DD", "YYYY/MM/DD", "YYYYMMDD"], true);
        if (!m.isValid()) return;
        listId = m.format("YYYYMMDD");
      } else {
        let name = row["清单名称"];
        if (!name) return;
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
      finishImport();
      return;
    }

    mergeIntoDb(listIds, grouped);
  } catch (e) {
    console.error("导入 Excel 失败(整理数据阶段):", e);
    showInvalidFileToast();
    hideImportingModal();
  }
}

function mergeIntoDb(listIds, grouped) {
  let db_req = dbRepository.open();

  db_req.onsuccess = function (event) {
    try {
      let db = event.target.result;
      let i = 0;

      const next = function () {
        if (i >= listIds.length) {
          finishImport();
          return;
        }

        let listId = listIds[i];
        let get_req = dbRepository.get(
          db,
          "todo_lists",
          listId
        );

        get_req.onsuccess = function () {
          try {
            let existing = get_req.result || [];
            let merged = existing.concat(grouped[listId]);

            let put_req = dbRepository.update(
              db,
              "todo_lists",
              listId,
              merged
            );

            put_req.onsuccess = function () {
              i++;
              next();
            };

            put_req.onerror = function () {
              i++;
              next();
            };
          } catch (innerErr) {
            console.error(
              "导入 Excel 失败(合并数据阶段):",
              innerErr
            );

            hideImportingModal();
          }
        };

        get_req.onerror = function () {
          i++;
          next();
        };
      };

      next();
    } catch (dbErr) {
      console.error(
        "导入 Excel 失败(数据库写入阶段):",
        dbErr
      );

      hideImportingModal();
    }
  };

  db_req.onerror = function () {
    hideImportingModal();
  };
}


function finishImport() {
  setTimeout(function () {
    let modal = Modal.getInstance(document.getElementById("importingModal"));
    if (modal) modal.hide();
    location.reload();
  }, 1000);
}

function showInvalidFileToast() {
  let toastEl = document.getElementById("invalidFile");
  if (toastEl) {
    let toast = Toast.getOrCreateInstance(toastEl);
    toast.show();
  }
}

function hideExportingModal() {
  closeModalSafely("exportingModal");
}

function hideImportingModal() {
  closeModalSafely("importingModal");
}

function closeModalSafely(id) {
  setTimeout(function () {
    let modalEl = document.getElementById(id);
    if (!modalEl) return;
    let modal = Modal.getInstance(modalEl);
    if (modal) {
      modal.hide();
    }

    setTimeout(function () {
      if (modalEl.classList.contains("show")) {
        modalEl.classList.remove("show");
        modalEl.style.display = "none";
        modalEl.removeAttribute("aria-modal");
        modalEl.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("overflow");
        document.body.style.removeProperty("padding-right");
        document.querySelectorAll(".modal-backdrop").forEach(function (bd) {
          if (bd.parentNode) bd.parentNode.removeChild(bd);
        });
      }
    }, 300);
  }, 1000);
}
