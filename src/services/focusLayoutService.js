/* FOCUS_COLUMN_PAGES_20260909_V3 */

const STORAGE_KEY = "weektodo.focus-layout.v3";
const LEGACY_V2_KEY = "weektodo.focus-layout.v2";
const LEGACY_OPEN_IDS = "focusDocumentOpenIds";
const LEGACY_COLUMN_COUNT = "focusDocumentColumns";

export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 3;
export const DEFAULT_PAGE_SIZE = 3;
export const MAX_COLUMNS = 12;
export const MIN_COLUMN_WIDTH = 260;

const MIN_FLEX = 0.45;
const MAX_FLEX = 3.2;

function createColumnId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) {
    return "col-" + globalThis.crypto.randomUUID();
  }

  return (
    "col-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(16).slice(2, 8)
  );
}

function clampFlex(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return 1;

  return Math.min(
    MAX_FLEX,
    Math.max(MIN_FLEX, Number(number.toFixed(4)))
  );
}

function clampPageSize(value) {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number)) return DEFAULT_PAGE_SIZE;

  return Math.min(
    MAX_PAGE_SIZE,
    Math.max(MIN_PAGE_SIZE, number)
  );
}

function normalizeColumns(list) {
  const seen = new Set();
  const result = [];

  (Array.isArray(list) ? list : []).forEach((item) => {
    const documentId =
      typeof item === "string" ? item : item && item.documentId;

    if (!documentId || seen.has(documentId)) return;

    seen.add(documentId);

    result.push({
      id: (item && item.id) || createColumnId(),
      documentId: String(documentId),
      flex: clampFlex(item && item.flex),
    });
  });

  return result.slice(0, MAX_COLUMNS);
}

function pageCountOf(columns, pageSize) {
  return Math.max(1, Math.ceil(columns.length / pageSize));
}

function normalizeState(raw) {
  const pageSize = clampPageSize(raw && raw.pageSize);
  const columns = normalizeColumns(raw && raw.columns);
  const count = pageCountOf(columns, pageSize);

  const rawPage = Number(raw && raw.page);
  const page = Math.min(
    Math.max(0, Number.isFinite(rawPage) ? Math.round(rawPage) : 0),
    count - 1
  );

  return { pageSize, page, columns };
}

function readLegacyV2() {
  try {
    const raw = localStorage.getItem(LEGACY_V2_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.columns)) return null;

    return normalizeState({
      pageSize: DEFAULT_PAGE_SIZE,
      page: 0,
      columns: parsed.columns,
    });
  } catch (error) {
    return null;
  }
}

function readLegacyOpenIds() {
  try {
    const ids = JSON.parse(
      localStorage.getItem(LEGACY_OPEN_IDS) || "[]"
    );

    if (!Array.isArray(ids) || !ids.length) return null;

    return normalizeState({
      pageSize: DEFAULT_PAGE_SIZE,
      page: 0,
      columns: ids.filter(Boolean),
    });
  } catch (error) {
    return null;
  }
}

function write(state) {
  const normalized = normalizeState(state);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 3,
      updatedAt: new Date().toISOString(),
      pageSize: normalized.pageSize,
      page: normalized.page,
      columns: normalized.columns,
    })
  );

  window.dispatchEvent(
    new CustomEvent("weektodo:focus-layout-changed", {
      detail: normalized,
    })
  );

  return normalized;
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    }
  } catch (error) {
    // 落到迁移分支。
  }

  const migrated = readLegacyV2() || readLegacyOpenIds();

  if (migrated) {
    write(migrated);
    localStorage.removeItem(LEGACY_COLUMN_COUNT);
    return migrated;
  }

  return normalizeState(null);
}

const focusLayoutService = {
  MIN_PAGE_SIZE,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  MAX_COLUMNS,
  MIN_COLUMN_WIDTH,
  createColumnId,

  empty() {
    return normalizeState(null);
  },

  load() {
    return read();
  },

  save(state) {
    return write(state);
  },

  pageCount(state) {
    const normalized = normalizeState(state);

    return pageCountOf(normalized.columns, normalized.pageSize);
  },

  pageStart(state) {
    const normalized = normalizeState(state);

    return normalized.page * normalized.pageSize;
  },

  /** 返回当前版面的列，附带在完整数组中的绝对下标。 */
  pageColumns(state) {
    const normalized = normalizeState(state);
    const start = normalized.page * normalized.pageSize;

    return normalized.columns
      .slice(start, start + normalized.pageSize)
      .map((column, offset) => ({
        column,
        index: start + offset,
      }));
  },

  pageOfIndex(state, index) {
    const pageSize = clampPageSize(state && state.pageSize);

    return Math.max(0, Math.floor((Number(index) || 0) / pageSize));
  },

  indexOfDocument(state, documentId) {
    const normalized = normalizeState(state);

    return normalized.columns.findIndex(
      (column) => column.documentId === documentId
    );
  },

  /** 丢弃指向已删除文档的列。 */
  sanitize(state, availableIds) {
    const available = new Set(availableIds || []);
    const normalized = normalizeState(state);

    return normalizeState({
      pageSize: normalized.pageSize,
      page: normalized.page,
      columns: normalized.columns.filter((column) =>
        available.has(column.documentId)
      ),
    });
  },

  insert(state, index, documentId) {
    const normalized = normalizeState(state);

    const columns = normalized.columns.filter(
      (column) => column.documentId !== documentId
    );

    if (columns.length >= MAX_COLUMNS) return normalized;

    const position = Math.max(
      0,
      Math.min(columns.length, Number(index) || 0)
    );

    columns.splice(position, 0, {
      id: createColumnId(),
      documentId: String(documentId),
      flex: 1,
    });

    return normalizeState({
      pageSize: normalized.pageSize,
      page: Math.floor(position / normalized.pageSize),
      columns,
    });
  },

  /** 把文档放进指定槽位（槽位已有文档则替换）。 */
  replace(state, index, documentId) {
    const normalized = normalizeState(state);
    const columns = normalized.columns.map((column) => ({
      ...column,
    }));

    const position = Number(index);

    if (!columns[position]) {
      return this.insert(normalized, columns.length, documentId);
    }

    const existing = columns.findIndex(
      (column) => column.documentId === documentId
    );

    if (existing >= 0 && existing !== position) {
      columns[existing] = {
        ...columns[existing],
        documentId: columns[position].documentId,
      };
    }

    columns[position] = {
      ...columns[position],
      documentId: String(documentId),
    };

    return normalizeState({
      pageSize: normalized.pageSize,
      page: Math.floor(position / normalized.pageSize),
      columns,
    });
  },

  removeAt(state, index) {
    const normalized = normalizeState(state);
    const columns = normalized.columns.map((column) => ({
      ...column,
    }));

    columns.splice(Number(index), 1);

    return normalizeState({
      pageSize: normalized.pageSize,
      page: normalized.page,
      columns,
    });
  },

  removeDocument(state, documentId) {
    const normalized = normalizeState(state);

    return normalizeState({
      pageSize: normalized.pageSize,
      page: normalized.page,
      columns: normalized.columns.filter(
        (column) => column.documentId !== documentId
      ),
    });
  },

  move(state, from, to) {
    const normalized = normalizeState(state);
    const columns = normalized.columns.map((column) => ({
      ...column,
    }));

    const source = Number(from);
    const target = Number(to);

    if (
      source < 0 ||
      source >= columns.length ||
      target < 0 ||
      target > columns.length ||
      source === target
    ) {
      return normalized;
    }

    const moved = columns.splice(source, 1)[0];
    const position = source < target ? target - 1 : target;

    columns.splice(position, 0, moved);

    return normalizeState({
      pageSize: normalized.pageSize,
      page: Math.floor(position / normalized.pageSize),
      columns,
    });
  },

  /**
   * railIndex 是"右侧列"的绝对下标。
   * 版面首列左边的轨道是翻页边界，不参与调宽。
   */
  applyResize(state, railIndex, deltaFlex) {
    const normalized = normalizeState(state);
    const rail = Number(railIndex);

    if (rail <= 0 || rail % normalized.pageSize === 0) {
      return normalized;
    }

    const columns = normalized.columns.map((column) => ({
      ...column,
    }));

    const left = columns[rail - 1];
    const right = columns[rail];

    if (!left || !right) return normalized;

    const total = left.flex + right.flex;

    let leftFlex = left.flex + Number(deltaFlex || 0);

    leftFlex = Math.max(MIN_FLEX, leftFlex);
    leftFlex = Math.min(total - MIN_FLEX, leftFlex);

    if (!Number.isFinite(leftFlex)) return normalized;

    columns[rail - 1] = {
      ...left,
      flex: Number(leftFlex.toFixed(4)),
    };
    columns[rail] = {
      ...right,
      flex: Number((total - leftFlex).toFixed(4)),
    };

    return {
      pageSize: normalized.pageSize,
      page: normalized.page,
      columns,
    };
  },

  equalize(state) {
    const normalized = normalizeState(state);

    return {
      pageSize: normalized.pageSize,
      page: normalized.page,
      columns: normalized.columns.map((column) => ({
        ...column,
        flex: 1,
      })),
    };
  },

  /** 改变"每版面几栏"时，锚定当前版面的首列，避免视图乱跳。 */
  setPageSize(state, size) {
    const normalized = normalizeState(state);
    const anchor = normalized.page * normalized.pageSize;
    const pageSize = clampPageSize(size);

    return normalizeState({
      pageSize,
      page: Math.floor(anchor / pageSize),
      columns: normalized.columns,
    });
  },

  goToPage(state, page) {
    const normalized = normalizeState(state);

    return normalizeState({
      pageSize: normalized.pageSize,
      page: Number(page) || 0,
      columns: normalized.columns,
    });
  },

  stepPage(state, delta) {
    const normalized = normalizeState(state);

    return this.goToPage(
      normalized,
      normalized.page + (Number(delta) || 0)
    );
  },
};

export default focusLayoutService;
