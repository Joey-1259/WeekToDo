/* FOCUS_UI_SYSTEM_20260910_V5 */

/**
 * 资金账户体系。
 *
 * 设计辨析（这一条决定了后面所有取舍）：
 *
 *   "个人账户 / 家庭公共账户" 与 "应急金 / 教育储备 / 买车" 是两个
 *   正交维度，不能塞进同一个"标签"里。
 *
 *   账户（本文件）= 互斥的归属维度。
 *     一条资产或负债明细必须且只能挂一个 accountId。
 *     它决定净资产如何分组、合并统计时如何去重。
 *
 *   用途标签 = 多值的聚合维度。
 *     一笔钱可以同时是"应急金"和"家庭共同"，用于回答
 *     "我为教育准备了多少" 这类跨账户问题。
 *     本轮只在数据层预留 purposeTags 字段，不做 UI。
 *
 *   如果把两者混为一谈，很快会遇到"这笔钱打了个人和家庭两个标签，
 *   合并统计算一次还是两次"的歧义——这是记账类产品最典型的模型事故。
 *
 * 迁移策略：非破坏。历史明细没有 accountId，读取时挂到默认账户，
 * 只有在用户真正保存时才落盘，所以回滚不会丢数据。
 */

import storageRepository from "../repositories/storageRepository";

const STORAGE_KEY = "financialAccounts";
const CHANGED_EVENT = "weektodo:financial-accounts-changed";

export const DEFAULT_ACCOUNT_ID = "acc_personal_default";

export const ACCOUNT_KINDS = Object.freeze([
  { value: "personal", label: "个人", hint: "只属于自己的资金" },
  { value: "shared", label: "共同", hint: "家庭或伴侣共同持有" },
  { value: "business", label: "经营", hint: "个体经营或副业" },
]);

const PALETTE = [
  "#4263eb", "#2f9e6e", "#c26a22", "#9350c9",
  "#2b8aa8", "#c2456a", "#6b7684",
];

function createId() {
  return (
    "acc_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

function normalizeAccount(item, index = 0) {
  const kinds = ACCOUNT_KINDS.map((k) => k.value);

  return {
    id: item?.id || createId(),
    name: String(item?.name || "未命名账户").slice(0, 24),
    kind: kinds.includes(item?.kind) ? item.kind : "personal",
    color: item?.color || PALETTE[index % PALETTE.length],
    note: String(item?.note || "").slice(0, 80),
    archived: Boolean(item?.archived),
    order: Number.isFinite(item?.order) ? item.order : index,
    createdAt: item?.createdAt || new Date().toISOString(),
  };
}

function seed() {
  return [
    normalizeAccount(
      {
        id: DEFAULT_ACCOUNT_ID,
        name: "个人账户",
        kind: "personal",
        note: "默认账户，历史记录都归在这里",
        order: 0,
      },
      0
    ),
  ];
}

function notify(list) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(CHANGED_EVENT, { detail: { list } })
  );
}

const financialAccountService = {
  CHANGED_EVENT,

  list() {
    const raw = storageRepository.get(STORAGE_KEY);

    if (!Array.isArray(raw) || !raw.length) return seed();

    const list = raw
      .map((item, index) => normalizeAccount(item, index))
      .sort((a, b) => a.order - b.order);

    // 默认账户必须始终存在，否则历史明细会挂空。
    if (!list.some((item) => item.id === DEFAULT_ACCOUNT_ID)) {
      list.unshift(seed()[0]);
    }

    return list;
  },

  listActive() {
    return this.list().filter((item) => !item.archived);
  },

  get(id) {
    return this.list().find((item) => item.id === id) || null;
  },

  /** 账户不存在时的兜底，保证 UI 永远拿得到名字和颜色。 */
  resolve(id) {
    return (
      this.get(id) || {
        id: id || DEFAULT_ACCOUNT_ID,
        name: "未归属",
        kind: "personal",
        color: "#9aa0a9",
        archived: false,
      }
    );
  },

  update(list) {
    const safe = (Array.isArray(list) ? list : [])
      .map((item, index) => normalizeAccount(item, index))
      .map((item, index) => ({ ...item, order: index }));

    storageRepository.set(STORAGE_KEY, safe);
    notify(safe);

    return safe;
  },

  create({ name, kind = "personal", note = "" } = {}) {
    const list = this.list();

    const account = normalizeAccount(
      {
        name: name || "新账户",
        kind,
        note,
        order: list.length,
        color: PALETTE[list.length % PALETTE.length],
      },
      list.length
    );

    this.update([...list, account]);
    return account;
  },

  patch(id, patch = {}) {
    const list = this.list().map((item) =>
      item.id === id ? normalizeAccount({ ...item, ...patch, id }) : item
    );

    this.update(list);
    return this.get(id);
  },

  /**
   * 删除账户。默认账户不可删。
   * 明细的重新归属由调用方负责（传 reassignTo 只是返回建议目标）。
   */
  remove(id) {
    if (id === DEFAULT_ACCOUNT_ID) {
      throw new Error("默认账户不能删除");
    }

    this.update(this.list().filter((item) => item.id !== id));
    return DEFAULT_ACCOUNT_ID;
  },

  /* ---------- 聚合：给弹窗算范围内的合计 ---------- */

  /**
   * @param {object} snapshot 单张快照
   * @param {string[]|null} scope 账户 id 数组；null / 空 = 全部账户
   */
  summarize(snapshot, scope = null) {
    const inScope = (row) => {
      if (!scope || !scope.length) return true;
      return scope.includes(row.accountId || DEFAULT_ACCOUNT_ID);
    };

    const assets = (snapshot?.assets || []).filter(inScope);
    const liabilities = (snapshot?.liabilities || []).filter(inScope);

    const sum = (rows) =>
      rows.reduce((total, row) => total + (Number(row.amount) || 0), 0);

    const assetTotal = sum(assets);
    const liabilityTotal = sum(liabilities);

    return {
      assetTotal,
      liabilityTotal,
      netWorth: assetTotal - liabilityTotal,
      liquidTotal: sum(assets.filter((row) => row.liquid)),
      assetCount: assets.length,
      liabilityCount: liabilities.length,
    };
  },

  /** 按账户分组的小计，用于快照内分组展示。 */
  groupByAccount(snapshot) {
    const accounts = this.list();
    const groups = new Map();

    accounts.forEach((account) =>
      groups.set(account.id, {
        account,
        assets: [],
        liabilities: [],
        assetTotal: 0,
        liabilityTotal: 0,
        netWorth: 0,
      })
    );

    const push = (row, bucket) => {
      const key = row.accountId || DEFAULT_ACCOUNT_ID;

      if (!groups.has(key)) {
        groups.set(key, {
          account: this.resolve(key),
          assets: [],
          liabilities: [],
          assetTotal: 0,
          liabilityTotal: 0,
          netWorth: 0,
        });
      }

      const group = groups.get(key);
      const amount = Number(row.amount) || 0;

      group[bucket].push(row);

      if (bucket === "assets") group.assetTotal += amount;
      else group.liabilityTotal += amount;

      group.netWorth = group.assetTotal - group.liabilityTotal;
    };

    (snapshot?.assets || []).forEach((row) => push(row, "assets"));
    (snapshot?.liabilities || []).forEach((row) => push(row, "liabilities"));

    return Array.from(groups.values()).filter(
      (group) =>
        group.assets.length ||
        group.liabilities.length ||
        !group.account.archived
    );
  },
};

export default financialAccountService;
