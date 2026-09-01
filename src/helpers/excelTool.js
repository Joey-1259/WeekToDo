import moment from "moment";
import { Modal, Toast } from "bootstrap";
import dbRepository from "../repositories/dbRepository";
import customToDoListIdsRepository from "../repositories/customToDoListIdsRepository";

const COLUMNS = ["清单类型", "清单名称", "日期", "事件", "是否完成", "时间", "备注", "子任务"];

export default {
  // ---------- 导出 ----------
  exportExcel() {
    import("xlsx")
      .then((XLSX) => {
        try {
          let customListMap = {};
          customToDoListIdsRepository.load().forEach((c) => {
            customListMap[c.listId] = c.listName;
          });

          let rows = [];
          let db_req = dbRepository.open();

          db_req.onsuccess = function (event) {
            try {
              let db = event.target.result;
              let request = dbRepository.selectAll(db, "todo_lists");

              request.onsuccess = function () {
                try {
                  let cursor = request.result;
                  if (cursor) {
                    appendRowsForList(rows, cursor.key, cursor.value, customListMap);
                    cursor.continue();
                  } else {
                    writeWorkbook(XLSX, rows);
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

  // ---------- 导入 ----------
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
            let sheet = workbook.Sheets[workbook.SheetNames[0]];
            let rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            if (rows.length === 0) {
              showInvalidFileToast();
              hideImportingModal();
              return;
            }
            processImportRows(rows);
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

function writeWorkbook(XLSX, rows) {
  try {
    rows.sort((a, b) => {
      if (a.清单类型 !== b.清单类型) return a.清单类型 === "日历" ? -1 : 1;
      return a.日期 > b.日期 ? 1 : a.日期 < b.日期 ? -1 : 0;
    });

    let ws = XLSX.utils.json_to_sheet(rows, { header: COLUMNS });
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "WeekToDo导出");

    // 关键修复:不用 XLSX.writeFile(),因为在 nodeIntegration 开启的 Electron 渲染进程里,
    // 这个方法会误判环境、走 Node 的 fs.writeFileSync 直接写盘,容易写到只读目录导致报错、
    // 且这个报错发生在 IndexedDB 回调里,外层 catch 抓不到,会让弹窗卡死。
    // 改成手动生成 Blob + 模拟点击下载,和现有 exportTool.js 里 .wtdb 导出的方式保持一致,更可靠。
    let wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    let blob = new Blob([wbout], { type: "application/octet-stream" });
    let filename = `WeekToDo导出_${moment().format("YYYYMMDD_HHmm")}.xlsx`;
    downloadBlob(blob, filename);
  } catch (e) {
    console.error("导出 Excel 失败(生成文件阶段):", e);
  } finally {
    // 不管成功还是失败,弹窗都必须关掉,绝不允许卡死
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

function hideExportingModal() {
  setTimeout(function () {
    let modalEl = document.getElementById("exportingModal");
    let modal = Modal.getInstance(modalEl);
    if (modal) {
      modal.hide();
    } else {
      console.warn("未找到 exportingModal 的实例,弹窗可能无法自动关闭。");
    }
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
  try {
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

      function next() {
        if (i >= listIds.length) {
          finishImport();
          return;
        }
        let listId = listIds[i];
        let get_req = dbRepository.get(db, "todo_lists", listId);
        get_req.onsuccess = function () {
          try {
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
          } catch (innerErr) {
            console.error("导入 Excel 失败(合并数据阶段):", innerErr);
            hideImportingModal();
          }
        };
        get_req.onerror = function () {
          i++;
          next();
        };
      }
      next();
    } catch (dbErr) {
      console.error("导入 Excel 失败(数据库写入阶段):", dbErr);
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
    location.reload(); // 与现有 exportTool.js 的做法一致,刷新页面重新加载数据
  }, 300);
}

function showInvalidFileToast() {
  let toastEl = document.getElementById("invalidFile");
  if (toastEl) {
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
