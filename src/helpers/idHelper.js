export function createId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

export function ensureId(record, prefix = "id") {
  if (!record.id) record.id = createId(prefix);
  return record;
}
