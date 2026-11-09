/* FOCUS_BACKUP_20261109_V1：完整备份 SHA-256 校验（纯函数，Node 24 / 浏览器通用）
 * 对 { localStorage, indexedDB } 做紧凑 JSON 序列化后取摘要。
 * JSON 往返不改变键顺序（整数键在两侧都按同一规则前置），因此导出与导入两侧摘要可比。
 */
export async function digestOf(localData, indexedData) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) return null;
  const text = JSON.stringify({
    localStorage: localData ?? null,
    indexedDB: indexedData ?? null,
  });
  const hash = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** @returns {"ok"|"mismatch"|"absent"|"unavailable"} */
export async function verifyIntegrity(raw) {
  const expected = raw && raw.integrity && raw.integrity.digest;
  if (!expected) return "absent";
  const actual = await digestOf(raw.localStorage, raw.indexedDB);
  if (!actual) return "unavailable";
  return actual === expected ? "ok" : "mismatch";
}
