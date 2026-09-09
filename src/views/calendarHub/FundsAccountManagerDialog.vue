<template>
  <Teleport to="body">
    <div class="fam-backdrop" @mousedown.self="$emit('close')">
      <section class="fam-dialog" role="dialog" aria-modal="true">
        <header class="fam-header">
          <strong>管理账户</strong>
          <small>账户是互斥的归属维度：一条明细只属于一个账户</small>
          <button type="button" class="fam-close" @click="$emit('close')">
            ×
          </button>
        </header>

        <div class="fam-body">
          <div v-for="account in list" :key="account.id" class="fam-row">
            <span class="fam-swatch">
              <input
                type="color"
                :value="account.color"
                :aria-label="account.name + ' 颜色'"
                @input="patch(account.id, { color: $event.target.value })"
              />
            </span>

            <input
              class="fam-name"
              :value="account.name"
              maxlength="24"
              @change="patch(account.id, { name: $event.target.value })"
            />

            <select
              class="fam-kind"
              :value="account.kind"
              @change="patch(account.id, { kind: $event.target.value })"
            >
              <option v-for="kind in kinds" :key="kind.value" :value="kind.value">
                {{ kind.label }}
              </option>
            </select>

            <button
              type="button"
              class="fam-remove"
              :disabled="account.id === defaultId"
              :title="
                account.id === defaultId
                  ? '默认账户不可删除'
                  : '删除账户，明细会回到默认账户'
              "
              @click="remove(account)"
            >
              ×
            </button>
          </div>
        </div>

        <footer class="fam-footer">
          <input
            v-model.trim="draftName"
            class="fam-new"
            maxlength="24"
            placeholder="新账户名称，例如：家庭公共"
            @keydown.enter.prevent="create"
          />
          <button type="button" class="fam-add" @click="create">添加</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script>
/* FOCUS_UI_SYSTEM_20260911_V6 */
import financialAccountService, {
  ACCOUNT_KINDS,
  DEFAULT_ACCOUNT_ID,
} from "../../services/financialAccountService";
import financialSnapshotRepository from "../../repositories/financialSnapshotRepository";

export default {
  name: "FundsAccountManagerDialog",

  emits: ["close", "changed"],

  data() {
    return {
      list: financialAccountService.list(),
      kinds: ACCOUNT_KINDS,
      defaultId: DEFAULT_ACCOUNT_ID,
      draftName: "",
    };
  },

  methods: {
    refresh() {
      this.list = financialAccountService.list();
      this.$emit("changed");
    },

    patch(id, payload) {
      financialAccountService.patch(id, payload);
      this.refresh();
    },

    create() {
      if (!this.draftName) return;

      financialAccountService.create({ name: this.draftName });
      this.draftName = "";
      this.refresh();
    },

    remove(account) {
      const ok = window.confirm(
        "删除账户「" + account.name + "」？\n\n" +
          "已归属它的明细会回到默认账户，金额不会丢失。"
      );

      if (!ok) return;

      /* FOCUS_UI_SYSTEM_20260911_V6-reassign
         顺序很重要：先把明细改挂默认账户，再删账户。反过来会留下
         accountId 指向已不存在账户的明细，分账小计里就会冒出一个
         叫"未归属"的匿名分组，且各账户净额之和不再等于总净资产。 */
      financialSnapshotRepository.reassignAccount(
        account.id,
        DEFAULT_ACCOUNT_ID
      );

      financialAccountService.remove(account.id);
      this.refresh();
    },
  },
};
</script>

<style scoped lang="scss">
.fam-backdrop {
  position: fixed;
  z-index: 23000;
  display: grid;
  inset: 0;
  place-items: center;
  background: rgba(20, 24, 31, 0.4);
}

.fam-dialog {
  display: flex;
  width: min(520px, calc(100vw - 48px));
  flex-direction: column;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 22px 60px rgba(18, 22, 30, 0.26);
  overflow: hidden;
}

.fam-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #eef0f3;

  strong { color: #24282e; font-size: 14px; }
  small { flex: 1 1 auto; color: #9aa0a9; font-size: 11px; }
}

.fam-close {
  border: 0;
  background: transparent;
  color: #8d949d;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.fam-body {
  display: flex;
  max-height: 320px;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  overflow-y: auto;
}

.fam-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fam-swatch input {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid #e4e7eb;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.fam-name {
  min-width: 0;
  flex: 1 1 auto;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #e4e7eb;
  border-radius: 7px;
  color: #2f353d;
  font-family: inherit;
  font-size: 12.5px;
  outline: none;

  &:focus { border-color: #4263eb; }
}

.fam-kind {
  height: 28px;
  flex: 0 0 82px;
  padding: 0 6px;
  border: 1px solid #e4e7eb;
  border-radius: 7px;
  color: #4a515b;
  font-family: inherit;
  font-size: 12px;
}

.fam-remove {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #8d949d;
  font-size: 15px;
  cursor: pointer;

  &:hover:not(:disabled) { background: #ffe8e6; color: #d14343; }
  &:disabled { opacity: 0.3; cursor: default; }
}

.fam-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #eef0f3;
  background: #fafbfc;
}

.fam-new {
  min-width: 0;
  flex: 1 1 auto;
  height: 30px;
  padding: 0 9px;
  border: 1px solid #e4e7eb;
  border-radius: 7px;
  font-family: inherit;
  font-size: 12.5px;
  outline: none;

  &:focus { border-color: #4263eb; }
}

.fam-add {
  padding: 0 15px;
  border: 0;
  border-radius: 7px;
  background: #4263eb;
  color: #fff;
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;

  &:hover { background: #3853cc; }
}

.dark-theme {
  .fam-dialog { background: #1d232b; }
  .fam-header, .fam-footer { border-color: #2a323c; }
  .fam-footer { background: #171c22; }
  .fam-header strong { color: #e3e7ec; }
  .fam-name, .fam-kind, .fam-new {
    border-color: #39414c; background: #161b22; color: #dfe3e8;
  }
}
</style>
