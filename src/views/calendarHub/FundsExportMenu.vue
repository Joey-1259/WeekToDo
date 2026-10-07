<!-- FUNDS_TXT_EXPORT_20261007_V1 -->
<template>
  <div
    ref="root"
    class="fexp"
    @keydown.esc="onEscape"
  >
    <button
      type="button"
      class="fexp-trigger"
      :class="{ 'is-open': open, 'is-flash': !!flash }"
      :disabled="!hasAnything"
      aria-haspopup="menu"
      :aria-expanded="String(open)"
      title="导出资金记录"
      @click.stop="open = !open"
    >
      <i :class="flash ? 'bi-check2' : 'bi-box-arrow-up'" aria-hidden="true"></i>
      <span>{{ flash || "导出" }}</span>
    </button>

    <div
      v-if="open"
      class="fexp-menu"
      role="menu"
      aria-label="导出资金记录"
      @mousedown.stop
    >
      <button
        type="button"
        role="menuitem"
        class="fexp-item"
        :disabled="!snapshot"
        @click="exportCurrent"
      >
        <span class="fexp-badge">TXT</span>
        <span class="fexp-copy">
          <strong>导出当前快照</strong>
          <small>{{ currentHint }}</small>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        class="fexp-item"
        :disabled="!snapshots.length"
        @click="exportAll"
      >
        <span class="fexp-badge">TXT</span>
        <span class="fexp-copy">
          <strong>导出全部节点</strong>
          <small>{{ snapshots.length }} 个已保存节点 · 轨迹表 + 明细</small>
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        class="fexp-item"
        :disabled="!snapshot"
        @click="copyCurrent"
      >
        <span class="fexp-badge is-copy">
          <i class="bi-clipboard" aria-hidden="true"></i>
        </span>
        <span class="fexp-copy">
          <strong>复制当前快照</strong>
          <small>纯文本，便于粘贴到备忘录或聊天</small>
        </span>
      </button>

      <div class="fexp-foot">
        <label class="fexp-option">
          <input
            v-model="includeZero"
            type="checkbox"
            @change="persist"
          />
          <span>包含金额为 0 的明细</span>
        </label>

        <p v-if="scopeText" class="fexp-note">
          统计范围：{{ scopeText }}
        </p>

        <p v-if="dirtyState" class="fexp-note is-warn">
          {{ dirtyState === "new"
            ? "这张快照尚未保存，导出内容以屏幕所见为准"
            : "当前快照有未保存的修改，导出内容以屏幕所见为准" }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import {
  buildSnapshotText,
  buildTimelineText,
  buildSnapshotFilename,
  buildTimelineFilename,
  isSnapshotDirty,
  downloadTextFile,
  copyText,
} from "../../services/financialSnapshotTextExporter";

const ZERO_KEY = "weektodo.funds.export.includeZero";

function readIncludeZero() {
  try {
    return localStorage.getItem(ZERO_KEY) === "1";
  } catch {
    return false;
  }
}

export default {
  name: "FundsExportMenu",

  props: {
    snapshot: { type: Object, default: null },
    snapshots: { type: Array, default: () => [] },
    scope: { type: Array, default: () => [] },
    accounts: { type: Array, default: () => [] },
  },

  data() {
    return {
      open: false,
      includeZero: readIncludeZero(),
      flash: "",
      flashTimer: null,
    };
  },

  computed: {
    hasAnything() {
      return Boolean(this.snapshot) || this.snapshots.length > 0;
    },

    dirtyState() {
      return isSnapshotDirty(this.snapshot, this.snapshots);
    },

    scopeText() {
      if (!this.scope.length) return "";
      return this.scope
        .map((id) => (this.accounts.find((item) => item.id === id) || {}).name)
        .filter(Boolean)
        .join("、");
    },

    currentHint() {
      if (!this.snapshot) return "暂无快照";
      const time = String(this.snapshot.recordedAt || "").replace("T", " ").slice(0, 16);
      const title = String(this.snapshot.title || "").trim();
      return (title ? title + " · " : "") + (time || "未记录时间");
    },
  },

  watch: {
    open(value) {
      if (value) {
        document.addEventListener("pointerdown", this.onOutside, true);
      } else {
        document.removeEventListener("pointerdown", this.onOutside, true);
      }
    },
  },

  beforeUnmount() {
    document.removeEventListener("pointerdown", this.onOutside, true);
    clearTimeout(this.flashTimer);
  },

  methods: {
    onEscape(event) {
      if (!this.open) return;
      event.stopPropagation();
      event.preventDefault();
      this.open = false;
    },

    onOutside(event) {
      if (!this.$refs.root?.contains(event.target)) this.open = false;
    },

    persist() {
      try {
        localStorage.setItem(ZERO_KEY, this.includeZero ? "1" : "0");
      } catch {
        // 偏好写入失败不影响导出
      }
    },

    currentText() {
      return buildSnapshotText({
        snapshot: this.snapshot,
        snapshots: this.snapshots,
        scope: this.scope,
        accounts: this.accounts,
        includeZero: this.includeZero,
        dirty: Boolean(this.dirtyState),
      });
    },

    exportCurrent() {
      if (!this.snapshot) return;
      downloadTextFile(buildSnapshotFilename(this.snapshot), this.currentText());
      this.done("已导出");
    },

    exportAll() {
      if (!this.snapshots.length) return;
      const text = buildTimelineText({
        snapshots: this.snapshots,
        scope: this.scope,
        accounts: this.accounts,
        includeZero: this.includeZero,
      });
      downloadTextFile(buildTimelineFilename(), text);
      this.done("已导出");
    },

    async copyCurrent() {
      if (!this.snapshot) return;
      const ok = await copyText(this.currentText());
      this.done(ok ? "已复制" : "复制失败");
    },

    done(message) {
      this.open = false;
      this.flash = message;
      clearTimeout(this.flashTimer);
      this.flashTimer = setTimeout(() => {
        this.flash = "";
      }, 1800);
    },
  },
};
</script>

<style lang="scss">
/* FUNDS_TXT_EXPORT_20261007_V1：前缀 fexp-，避免与编辑器工具栏 fx- 冲突 */
.fexp {
  position: relative;
  display: inline-flex;
}

.fexp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e1e5ea;
  border-radius: 7px;
  background: #fff;
  color: #4a5260;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;

  i { font-size: 13px; }

  &:hover:not(:disabled),
  &.is-open {
    border-color: #c9d2f5;
    background: #f3f6ff;
    color: #3451c7;
  }

  &.is-flash {
    border-color: #b9dcc8;
    background: #f0f9f4;
    color: #2f7d55;
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(66, 99, 235, 0.25);
  }
}

.fexp-menu {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 0;
  width: 272px;
  box-sizing: border-box;
  padding: 6px;
  border: 1px solid #e1e5ea;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 14px 36px rgba(24, 29, 38, 0.14), 0 2px 6px rgba(24, 29, 38, 0.06);
  text-align: left;
}

.fexp-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #2f353d;
  font-family: inherit;
  text-align: left;
  cursor: pointer;

  &:hover:not(:disabled) { background: #f4f6f9; }
  &:disabled { cursor: default; opacity: 0.45; }
}

.fexp-badge {
  display: inline-grid;
  flex: 0 0 30px;
  width: 30px;
  height: 22px;
  place-items: center;
  border-radius: 5px;
  background: #edf0f4;
  color: #5f6874;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.02em;

  &.is-copy { font-size: 12px; }
}

.fexp-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;

  strong { font-size: 12.5px; font-weight: 600; }

  small {
    overflow: hidden;
    color: #8d949e;
    font-size: 10.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.fexp-foot {
  margin-top: 4px;
  padding: 8px 8px 4px;
  border-top: 1px solid #eef0f3;
}

.fexp-option {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #5f6874;
  font-size: 11.5px;
  cursor: pointer;

  input { margin: 0; accent-color: #4263eb; }
}

.fexp-note {
  margin: 6px 0 0;
  color: #8d949e;
  font-size: 10.5px;
  line-height: 1.5;

  &.is-warn { color: #b0761a; }
}

.dark-theme {
  .fexp-trigger {
    border-color: #36404a;
    background: #20262e;
    color: #c9cfd6;

    &:hover:not(:disabled),
    &.is-open {
      border-color: #44527a;
      background: #232c44;
      color: #a9baf4;
    }
  }

  .fexp-menu {
    border-color: #39414c;
    background: #1d232b;
  }

  .fexp-item {
    color: #dce1e7;
    &:hover:not(:disabled) { background: #262e38; }
  }

  .fexp-badge {
    background: #303844;
    color: #c4cad1;
  }

  .fexp-foot { border-color: #333a44; }
  .fexp-option { color: #aeb5be; }
}
</style>
