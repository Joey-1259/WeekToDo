/* FOCUS_COLUMN_LAYOUT_20260909_V1 */

const STORAGE_KEY = "weektodo.focus-layout.v2";
const LEGACY_OPEN_IDS = "focusDocumentOpenIds";
const LEGACY_COLUMN_COUNT = "focusDocumentColumns";

export const MAX_COLUMNS = 6;
export const MIN_COLUMN_WIDTH = 300;

const MIN_FLEX = 0.5;
const MAX_FLEX = 3;

function createColumnId() {
  if (globalThis.crypto?.randomUUID) {
    return `col-${globalThis.crypto.randomUUID()}`;
  }

  return `col-${Date.now().toString(36)}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

function clampFlex(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) return 1;

  return Math.min(
    MAX_FLEX,
    Math.max(MIN_FLEX, Number(number.toFixed(4)))
  );
}

function normalize(columns) {
  const seen = new Set();
  const result = [];

  (Array.isArray(columns) ? columns : []).forEach((item) => {
    const documentId =
      typeof item === "string" ? item : item?.documentId;

    if (!documentId || seen.has(documentId)) return;

    seen.add(documentId);

    result.push({
      id: item?.id || createColumnId(),
      documentId: String(documentId),
      flex: clampFlex(item?.flex),
    });
  });

  return result.slice(0, MAX_COLUMNS);
}

function readLegacy() {
  try {
    const ids = JSON.parse(
      localStorage.getItem(LEGACY_OPEN_IDS) || "[]"
    );

    if (!Array.isArray(ids)) return [];

    return normalize(ids.filter(Boolean));
  } catch {
    return [];
  }
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const migrated = readLegacy();

      if (migrated.length) {
        write(migrated);
        localStorage.removeItem(LEGACY_COLUMN_COUNT);
      }

      return migrated;
    }

    const parsed = JSON.parse(raw);
    return normalize(parsed?.columns);
  } catch {
    return [];
  }
}

function write(columns) {
  const payload = {
    version: 2,
    updatedAt: new Date().toISOString(),
    columns: normalize(columns),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  window.dispatchEvent(
    new CustomEvent("weektodo:focus-layout-changed", {
      detail: { columns: payload.columns },
    })
  );

  return payload.columns;
}

const focusLayoutService = {
  MAX_COLUMNS,
  MIN_COLUMN_WIDTH,
  createColumnId,

  load() {
    return read();
  },

  save(columns) {
    return write(columns);
  },

  /** 丢弃已被删除的文档所占的列。 */
  sanitize(columns, availableIds) {
    const available = new Set(availableIds || []);

    return normalize(columns).filter((column) =>
      available.has(column.documentId)
    );
  },

  insert(columns, index, documentId) {
    const next = normalize(columns).filter(
      (column) => column.documentId !== documentId
    );

    if (next.length >= MAX_COLUMNS) return next;

    const position = Math.max(
      0,
      Math.min(next.length, Number(index) || 0)
    );

    next.splice(position, 0, {
      id: createColumnId(),
      documentId: String(documentId),
      flex: 1,
    });

    return next;
  },

  replace(columns, index, documentId) {
    const next = normalize(columns);
    const existing = next.findIndex(
      (column) => column.documentId === documentId
    );

    if (!next[index]) {
      return this.insert(next, next.length, documentId);
    }

    if (existing >= 0 && existing !== index) {
      // 已在别的列里：直接交换，避免同一文档出现两次。
      const swap = next[index].documentId;
      next[existing] = { ...next[existing], documentId: swap };
    }

    next[index] = { ...next[index], documentId: String(documentId) };
    return next;
  },

  removeAt(columns, index) {
    const next = normalize(columns);
    next.splice(index, 1);
    return next;
  },

  removeDocument(columns, documentId) {
    return normalize(columns).filter(
      (column) => column.documentId !== documentId
    );
  },

  move(columns, from, to) {
    const next = normalize(columns);

    if (
      from < 0 ||
      from >= next.length ||
      to < 0 ||
      to > next.length ||
      from === to
    ) {
      return next;
    }

    const [moved] = next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, moved);

    return next;
  },

  /** railIndex 表示第 railIndex-1 列与第 railIndex 列之间的分隔轨。 */
  applyResize(columns, railIndex, deltaFlex) {
    const next = normalize(columns);
    const left = next[railIndex - 1];
    const right = next[railIndex];

    if (!left || !right) return next;

    const total = left.flex + right.flex;
    const leftFlex = clampFlex(left.flex + deltaFlex);
    const rightFlex = clampFlex(total - leftFlex);

    next[railIndex - 1] = { ...left, flex: leftFlex };
    next[railIndex] = {
      ...right,
      flex: clampFlex(total - leftFlex) || rightFlex,
    };

    return next;
  },

  equalize(columns) {
    return normalize(columns).map((column) => ({
      ...column,
      flex: 1,
    }));
  },
};

export default focusLayoutService;
