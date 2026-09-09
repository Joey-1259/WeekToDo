/* FOCUS_UI_SYSTEM_20260911_V6 */

/**
 * 资金快照存储。
 *
 * 本轮唯一的结构性改动：normalizeMoneyRow 是白名单式返回，
 * 上一版没有把 accountId 写进返回对象，于是 save() 必经的
 * normalizeSnapshot → normalizeMoneyRow 会把 UI 刚设置的归属
 * 静默抹掉——账户体系在数据层根本无法落盘。
 *
 * 两条正交的维度，刻意分开存：
 *
 *   accountId（互斥）
 *     一条明细必须且只能属于一个账户。它决定净资产如何分组，
 *     以及"合并统计"时如何去重：各账户净额相加恒等于总净资产。
 *
 *   purposeTags（多值）
 *     一笔钱可以同时是"应急金"和"家庭共同"，用于回答
 *     "我为教育准备了多少"这类跨账户问题。本轮只预留字段。
 *
 *   把两者塞进同一个"标签"，立刻会遇到"这笔钱打了个人和家庭
 *   两个标签，合并统计算一次还是两次"的歧义。这是记账类产品
 *   最典型的模型事故，必须在数据层就分开。
 *
 * 迁移是非破坏的：历史行没有 accountId，读取时补默认账户，
 * 但只有用户真正保存时才落盘，所以回滚到旧版本不会丢数据。
 */

import storageRepository from "./storageRepository";

const STORAGE_KEY = "financialSnapshots";
const CHANGED_EVENT = "weektodo:financial-snapshots-changed";

/* 与 services/financialAccountService.js 保持一致。
   这里刻意用字面量而不是 import，避免 repository 反向依赖 service。 */
export const DEFAULT_ACCOUNT_ID = "acc_personal_default";

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

/** 多值用途标签：去重、去空、限长，最多 6 个。 */
function normalizeTags(value) {
  if (!Array.isArray(value)) return [];

  const seen = new Set();
  const list = [];

  value.forEach((item) => {
    const tag = String(item || "").trim().slice(0, 16);

    if (!tag || seen.has(tag)) return;

    seen.add(tag);
    list.push(tag);
  });

  return list.slice(0, 6);
}

function normalizeMoneyRow(row, prefix) {
  return {
    id: row?.id || createId(prefix),
    name: String(row?.name || ""),
    amount: safeNumber(row?.amount),
    liquid: Boolean(row?.liquid),

    /* 互斥归属维度。历史行为空时补默认账户，实现读取期迁移。 */
    accountId: String(row?.accountId || DEFAULT_ACCOUNT_ID),

    /* 多值聚合维度，本轮仅数据层预留。 */
    purposeTags: normalizeTags(row?.purposeTags),
  };
}

function normalizePlan(row) {
  return {
    id: row?.id || createId("plan"),
    name: String(row?.name || ""),
    amount: safeNumber(row?.amount),
    targetDate: String(row?.targetDate || ""),
    priority: ["essential", "important", "wish"].includes(row?.priority)
      ? row.priority
      : "important",
    note: String(row?.note || ""),

    /* 计划也允许归户："这笔教育金从家庭账户出"是真实诉求。
       为空表示不限定账户，由全部可调度资产覆盖。 */
    accountId: row?.accountId ? String(row.accountId) : "",
    purposeTags: normalizeTags(row?.purposeTags),
  };
}

function normalizeSnapshot(item) {
  return {
    id: item?.id || createId("fund"),
    recordedAt:
      item?.recordedAt || new Date().toISOString().slice(0, 16),
    title: String(item?.title || ""),
    assets: Array.isArray(item?.assets)
      ? item.assets.map((row) => normalizeMoneyRow(row, "asset"))
      : [],
    liabilities: Array.isArray(item?.liabilities)
      ? item.liabilities.map((row) => normalizeMoneyRow(row, "debt"))
      : [],
    plans: Array.isArray(item?.plans) ? item.plans.map(normalizePlan) : [],
    note: String(item?.note || ""),
    createdAt: item?.createdAt || new Date().toISOString(),
    updatedAt: item?.updatedAt || new Date().toISOString(),
  };
}

function notify(list) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(CHANGED_EVENT, { detail: { list } })
  );
}

export default {
  CHANGED_EVENT,
  DEFAULT_ACCOUNT_ID,

  load() {
    const raw = storageRepository.get(STORAGE_KEY);

    if (!Array.isArray(raw)) return [];

    return raw
      .map(normalizeSnapshot)
      .sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() -
          new Date(b.recordedAt).getTime()
      );
  },

  update(list) {
    const safeList = Array.isArray(list) ? list.map(normalizeSnapshot) : [];

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
    const index = list.findIndex((item) => item.id === normalized.id);

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
    return this.update(this.load().filter((item) => item.id !== id));
  },

  /**
   * 账户被删除后的收尾：把指向它的明细改挂到目标账户。
   * 由调用方在删账户成功后执行，保证不会留下悬空 accountId。
   */
  reassignAccount(fromId, toId = DEFAULT_ACCOUNT_ID) {
    if (!fromId || fromId === toId) return this.load();

    const list = this.load().map((snapshot) => ({
      ...snapshot,
      assets: snapshot.assets.map((row) =>
        row.accountId === fromId ? { ...row, accountId: toId } : row
      ),
      liabilities: snapshot.liabilities.map((row) =>
        row.accountId === fromId ? { ...row, accountId: toId } : row
      ),
      plans: snapshot.plans.map((row) =>
        row.accountId === fromId ? { ...row, accountId: toId } : row
      ),
    }));

    return this.update(list);
  },

  createDraft(source) {
    const now = new Date();
    const localTime = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    )
      .toISOString()
      .slice(0, 16);

    /* 从上一张快照开新快照时，明细连同归属账户一起继承——
       否则每次新建都要重新分账，这是记账产品最劝退的一步。 */
    return normalizeSnapshot({
      id: createId("fund"),
      recordedAt: localTime,
      title: "",
      assets:
        source?.assets ||
        [
          { name: "现金及活期", amount: 0, liquid: true },
          { name: "储蓄及定期", amount: 0, liquid: true },
          { name: "投资资产", amount: 0, liquid: false },
        ],
      liabilities:
        source?.liabilities ||
        [
          { name: "信用卡及短期负债", amount: 0 },
          { name: "长期负债", amount: 0 },
        ],
      plans: source?.plans || [],
      note: "",
    });
  },
};
