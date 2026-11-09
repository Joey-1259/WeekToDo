/* FOCUS_POLISH_20261028_V3：目录树拖拽规则（纯函数，无 DOM 依赖，可在 node 中单测） */
export const DRAG_THRESHOLD = 4;

/**
 * 根据拖拽物类型、目标行类型与指针在行内的纵向比例，给出落点。
 *   文档 → 目录行：整行 into（"拖进目录"是第一意图，不再被上下缘截走）
 *   文档 → 文档行：上半 before / 下半 after
 *   目录 → 目录行：25% before / 50% into / 25% after
 *   目录 → 文档行：无效
 */
export function resolveDropZone(dragType, rowType, ratio) {
  if (dragType === "doc") {
    if (rowType === "folder") return "into";
    return ratio < 0.5 ? "before" : "after";
  }
  if (rowType !== "folder") return null;
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "into";
}

/** 把落点翻译为宿主事件；无变化时返回 null */
export function buildMovePayload(dragged, target, row) {
  if (!dragged || !target) return null;
  const isDoc = dragged.type === "doc";

  if (target.key === "__root__") {
    if (!dragged.parentId) return null;
    return isDoc
      ? { event: "move-document", payload: { id: dragged.id, folderId: null } }
      : { event: "move-folder", payload: { id: dragged.id, parentId: null } };
  }

  if (!row || row.key === dragged.key) return null;

  const parent = target.zone === "into" ? row.id : row.parentId || null;
  if (target.zone === "into" && (dragged.parentId || null) === parent) return null;

  const base = {
    id: dragged.id,
    beforeId: target.zone === "before" ? row.id : null,
    afterId: target.zone === "after" ? row.id : null,
  };

  return isDoc
    ? { event: "move-document", payload: { ...base, folderId: parent } }
    : { event: "move-folder", payload: { ...base, parentId: parent } };
}

