import storageRepository from "./storageRepository";

const STORAGE_KEY = "financialSnapshots";
const CHANGED_EVENT = "weektodo:financial-snapshots-changed";

function createId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  );
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeMoneyRow(row, prefix) {
  return {
    id: row?.id || createId(prefix),
    name: String(row?.name || ""),
    amount: safeNumber(row?.amount),
    liquid: Boolean(row?.liquid),
  };
}

function normalizePlan(row) {
  return {
    id: row?.id || createId("plan"),
    name: String(row?.name || ""),
    amount: safeNumber(row?.amount),
    targetDate: String(row?.targetDate || ""),
    priority: ["essential", "important", "wish"].includes(
      row?.priority
    )
      ? row.priority
      : "important",
    note: String(row?.note || ""),
  };
}

function normalizeSnapshot(item) {
  return {
    id: item?.id || createId("fund"),
    recordedAt:
      item?.recordedAt || new Date().toISOString().slice(0, 16),
    title: String(item?.title || ""),
    assets: Array.isArray(item?.assets)
      ? item.assets.map((row) =>
          normalizeMoneyRow(row, "asset")
        )
      : [],
    liabilities: Array.isArray(item?.liabilities)
      ? item.liabilities.map((row) =>
          normalizeMoneyRow(row, "debt")
        )
      : [],
    plans: Array.isArray(item?.plans)
      ? item.plans.map(normalizePlan)
      : [],
    note: String(item?.note || ""),
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || new Date().toISOString(),
  };
}

function notify(list) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(CHANGED_EVENT, {
      detail: {
        list,
      },
    })
  );
}

export default {
  load() {
    const raw = storageRepository.get(STORAGE_KEY);

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map(normalizeSnapshot)
      .sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() -
          new Date(b.recordedAt).getTime()
      );
  },

  update(list) {
    const safeList = Array.isArray(list)
      ? list.map(normalizeSnapshot)
      : [];

    safeList.sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() -
        new Date(b.recordedAt).getTime()
    );

    storageRepository.set(STORAGE_KEY, safeList);
    notify(safeList);
    return safeList;
  },

  save(snapshot) {
    const list = this.load();
    const normalized = normalizeSnapshot(snapshot);
    const index = list.findIndex(
      (item) => item.id === normalized.id
    );

    if (index >= 0) {
      normalized.createdAt = list[index].createdAt;
      normalized.updatedAt = new Date().toISOString();
      list.splice(index, 1, normalized);
    } else {
      list.push(normalized);
    }

    this.update(list);
    return normalized;
  },

  remove(id) {
    return this.update(
      this.load().filter((item) => item.id !== id)
    );
  },

  createDraft(source) {
    const now = new Date();
    const localTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);

    return normalizeSnapshot({
      id: createId("fund"),
      recordedAt: localTime,
      title: "",
      assets: source?.assets || [
        {
          name: "现金及活期",
          amount: 0,
          liquid: true,
        },
        {
          name: "储蓄及定期",
          amount: 0,
          liquid: true,
        },
        {
          name: "投资资产",
          amount: 0,
          liquid: false,
        },
      ],
      liabilities: source?.liabilities || [
        {
          name: "信用卡及短期负债",
          amount: 0,
        },
        {
          name: "长期负债",
          amount: 0,
        },
      ],
      plans: source?.plans || [],
      note: "",
    });
  },
};
