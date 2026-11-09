/* FOCUS_SIDEBAR_20261109_V1：全屏侧栏目录树纯函数（无 DOM 依赖，可在 node 中单测） */
export const ROOT = "__root__";

const byOrder = (a, b) =>
  (a.order ?? 0) - (b.order ?? 0) ||
  String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");

const byManual = (a, b) =>
  (a.manualOrder ?? 0) - (b.manualOrder ?? 0) ||
  String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");

export function normalizeQuery(query) {
  return String(query || "").trim().toLowerCase();
}

export function indexTree(folders = [], documents = []) {
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const childFolders = new Map();
  const childDocs = new Map();
  const push = (map, key, item) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  };

  folders.forEach((f) =>
    push(childFolders, f.parentId && folderMap.has(f.parentId) ? f.parentId : ROOT, f)
  );
  documents.forEach((d) =>
    push(childDocs, d.folderId && folderMap.has(d.folderId) ? d.folderId : ROOT, d)
  );
  childFolders.forEach((list) => list.sort(byOrder));
  childDocs.forEach((list) => list.sort(byManual));

  return { folderMap, childFolders, childDocs };
}

/**
 * 扁平化可见行。
 * 搜索时：只保留命中文档及其祖先目录（目录名命中也保留），并强制展开。
 */
export function buildRows({ folders = [], documents = [], collapsed = new Set(), query = "" } = {}) {
  const { childFolders, childDocs } = indexTree(folders, documents);
  const q = normalizeQuery(query);
  const hit = (name) => !q || String(name || "").toLowerCase().includes(q);
  const seen = new Set();

  const docRow = (doc, depth, parentId) => ({
    key: "d:" + doc.id,
    type: "doc",
    id: doc.id,
    parentId,
    name: doc.title || "",
    depth,
  });

  const walk = (parentKey, depth) => {
    const out = [];
    for (const folder of childFolders.get(parentKey) || []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);

      const ownDocs = childDocs.get(folder.id) || [];
      const children = [
        ...walk(folder.id, depth + 1),
        ...ownDocs.filter((d) => hit(d.title)).map((d) => docRow(d, depth + 1, folder.id)),
      ];

      if (q && !children.length && !hit(folder.name)) continue;

      const expanded = q ? true : !collapsed.has(folder.id);
      out.push({
        key: "f:" + folder.id,
        type: "folder",
        id: folder.id,
        parentId: parentKey === ROOT ? null : parentKey,
        name: folder.name || "",
        depth,
        hasChildren: (childFolders.get(folder.id) || []).length + ownDocs.length > 0,
        expanded,
      });

      if (expanded) out.push(...children);
    }
    return out;
  };

  return [
    ...walk(ROOT, 0),
    ...(childDocs.get(ROOT) || []).filter((d) => hit(d.title)).map((d) => docRow(d, 0, null)),
  ];
}

/** 目录自身 + 全部后代目录 id（目录不能移入这些位置） */
export function descendantFolderIds(folders = [], id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

/** 深度优先的目录选项（「移动到…」列表） */
export function folderOptions(folders = []) {
  const { childFolders } = indexTree(folders, []);
  const out = [];
  const seen = new Set();
  const walk = (key, depth) => {
    for (const f of childFolders.get(key) || []) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push({ id: f.id, name: f.name || "未命名目录", depth });
      walk(f.id, depth + 1);
    }
  };
  walk(ROOT, 0);
  return out;
}

/** 由近及远的祖先目录 id（含自身） */
export function ancestorFolderIds(folders = [], folderId) {
  const map = new Map(folders.map((f) => [f.id, f]));
  const out = [];
  const seen = new Set();
  let cursor = folderId;
  while (cursor && map.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    out.push(cursor);
    cursor = map.get(cursor).parentId;
  }
  return out;
}

export function matchRange(name, query) {
  const q = normalizeQuery(query);
  if (!q) return null;
  const index = String(name || "").toLowerCase().indexOf(q);
  return index < 0 ? null : [index, index + q.length];
}
