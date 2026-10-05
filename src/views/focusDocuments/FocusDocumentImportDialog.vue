<template>
  <Teleport to="body">
    <div
      v-if="!folderPicker"
      class="fi-backdrop"
      @mousedown.self="close"
    >
      <section
        ref="dialog"
        class="fi-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fi-title"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <header class="fi-header">
          <div>
            <h2 id="fi-title">导入文档</h2>
            <p>选择文件后自动解析预览，选择目录并确认即可导入。</p>
          </div>
          <button
            type="button"
            aria-label="关闭导入"
            :disabled="committing"
            @click="close"
          >×</button>
        </header>

        <div class="fi-body">
          <template v-if="!done">
            <div
              class="fi-drop"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <strong>Markdown · Word DOCX · PDF</strong>
              <p>
                可拖入文件，或选择文件夹以包含 Markdown 的相对图片。
              </p>
              <div class="fi-buttons">
                <button :disabled="committing" @click="$refs.filesInput.click()">
                  选择文件
                </button>
                <button :disabled="committing" @click="$refs.folderInput.click()">
                  选择文件夹
                </button>
              </div>
              <small>{{ pool.length }} 个已选文件，{{ sources.length }} 篇待解析文档</small>
            </div>

            <input
              ref="filesInput"
              hidden
              type="file"
              multiple
              accept=".md,.markdown,.txt,.docx,.pdf,.doc,.png,.jpg,.jpeg,.webp,.gif"
              @change="onFiles"
            />
            <input
              ref="folderInput"
              hidden
              type="file"
              webkitdirectory
              multiple
              @change="onFiles"
            />

            <div class="fi-target-bar">
              <div>
                <small>导入到</small>
                <button
                  :disabled="committing"
                  @click="folderPicker = true"
                >
                  {{ targetPath }} ▾
                </button>
              </div>
              <span role="status">
                {{ parsing ? progress : (rows.length ? "解析完成，请确认导入" : "选择文件后自动解析") }}
              </span>
            </div>

            <details class="fi-advanced">
              <summary>高级选项：PDF 方式、编码、密码</summary>
              <div class="fi-settings">
                <label>
                  <span>PDF 导入方式</span>
                  <select v-model="pdfMode" :disabled="committing" @change="invalidate">
                    <option value="both">文字 + 页面图像</option>
                    <option value="text">仅可编辑文字</option>
                    <option value="images">仅页面图像（含扫描件）</option>
                  </select>
                </label>

                <label>
                  <span>文本编码</span>
                  <select v-model="encoding" :disabled="committing" @change="invalidate">
                    <option value="utf-8">UTF-8</option>
                    <option value="gb18030">GB18030</option>
                  </select>
                </label>

                <label>
                  <span>PDF 密码（如需要）</span>
                  <input
                    v-model="pdfPassword"
                    type="password"
                    autocomplete="off"
                    :disabled="committing"
                    @input="invalidate"
                  />
                </label>
              </div>
            </details>

            <p class="fi-boundary">
              单文件 ≤25MB；每个 PDF ≤100页；本次图片总量 ≤64MB。
              表格会降级为逐行文本；远程图片不会自动下载；不执行 OCR。
            </p>

            <p v-if="error" class="fi-error" role="alert">{{ error }}</p>
            <p v-if="parsing" role="status" aria-live="polite">{{ progress }}</p>

            <div v-if="rows.length" class="fi-review">
              <aside class="fi-list">
                <article
                  v-for="(row, index) in rows"
                  :key="row.key"
                  :class="{ active: active === index }"
                >
                  <label>
                    <input
                      v-model="row.selected"
                      type="checkbox"
                      :disabled="!row.draft || busy"
                    />
                    <button type="button" @click="active = index">
                      {{ row.file.name }}
                    </button>
                  </label>
                  <small v-if="row.error" class="fi-error">{{ row.error }}</small>
                  <small v-else-if="row.draft">
                    {{ row.draft.assets.length }} 张图片 ·
                    {{ row.draft.warnings.length }} 条提示
                  </small>
                  <small v-else>等待解析</small>
                </article>
              </aside>

              <main v-if="current?.draft" class="fi-preview">
                <label class="fi-title-edit">
                  <span>导入后的标题</span>
                  <input
                    v-model="current.draft.title"
                    maxlength="120"
                    :disabled="committing"
                  />
                </label>

                <ul v-if="current.draft.warnings.length" class="fi-warnings">
                  <li v-for="warning in current.draft.warnings" :key="warning">
                    {{ warning }}
                  </li>
                </ul>

                <h3>内容预览</h3>
                <FocusImportContentPreview
                  :content="current.draft.content"
                  :images="previewUrls"
                />
              </main>

              <main v-else class="fi-preview">
                <p>{{ current?.error || "正在自动解析，选择目录后等待结果即可" }}</p>
                <button
                  v-if="current?.error && !busy"
                  type="button"
                  @click="parse"
                >
                  重新尝试解析
                </button>
              </main>
            </div>
          </template>

          <div v-else class="fi-done" role="status">
            <strong>已导入 {{ created.length }} 篇文档</strong>
            <p>文档和图片已经保存到本地，当前分栏布局保持不变。</p>
            <button
              v-for="document in created"
              :key="document.id"
              @click="$emit('open', document.id)"
            >
              打开「{{ document.title }}」
            </button>
          </div>
        </div>

        <footer class="fi-footer">
          <span>{{ targetPath }}</span>
          <button v-if="parsing" @click="cancelParsing">取消解析</button>
          <button v-else :disabled="committing" @click="close">
            {{ done ? "完成" : "取消" }}
          </button>
          <button
            v-if="!done"
            class="fi-primary"
            :disabled="busy || !selectedDrafts.length"
            @click="commit"
          >
            {{ committing ? "正在保存…" : `导入 ${selectedDrafts.length} 篇` }}
          </button>
        </footer>
      </section>
    </div>

    <FocusDirectoryBrowser
      v-else
      mode="pick"
      pick-purpose="import"
      :folders="folders"
      :documents="documents"
      :pick-document="{ title: '选择本次导入的存放位置', folderId: targetFolderId }"
      @close="finishPick"
      @pick="pickFolder"
      @create-folder="$emit('create-folder', $event)"
    />
  </Teleport>
</template>

<script>
import FocusDirectoryBrowser from "./FocusDirectoryBrowser.vue";
/* FOCUS_EXPERIENCE_20261005_V2 */
import focusImportAutomation from "./focusImportAutomation";
import FocusImportContentPreview from "./FocusImportContentPreview.vue";
import {
  parseImportFile,
  commitImportBatch,
  isImportDocument,
} from "../../services/focusDocumentImportService";

const MAX_POOL_BYTES = 100 * 1024 * 1024;

export default {
  name: "FocusDocumentImportDialog",
  mixins: [focusImportAutomation],
  components: { FocusDirectoryBrowser, FocusImportContentPreview },

  props: {
    folders: { type: Array, default: () => [] },
    documents: { type: Array, default: () => [] },
    folderPaths: { type: Object, default: () => ({}) },
    initialFolderId: { type: String, default: null },
  },

  emits: ["close", "imported", "open", "create-folder"],

  data() {
    return {
      pool: [],
      rows: [],
      active: 0,
      targetFolderId: this.initialFolderId,
      folderPicker: false,
      pdfMode: "both",
      pdfPassword: "",
      encoding: "utf-8",
      parsing: false,
      committing: false,
      progress: "",
      error: "",
      done: false,
      created: [],
      previewUrls: [],
    };
  },

  computed: {
    busy() {
      return this.parsing || this.committing;
    },
    sources() {
      return this.pool.filter(
        (file) => isImportDocument(file) || /\.doc$/i.test(file.name)
      );
    },
    current() {
      return this.rows[this.active] || null;
    },
    selectedDrafts() {
      return this.rows
        .filter((row) => row.selected && row.draft)
        .map((row) => row.draft);
    },
    targetPath() {
      return this.targetFolderId
        ? this.folderPaths[this.targetFolderId] || "目标目录已不存在"
        : "未归档";
    },
  },

  watch: {
    current() {
      this.refreshPreviewUrls();
    },
    "current.draft"() {
      this.refreshPreviewUrls();
    },
    folderPicker(value) {
      if (!value) this.$nextTick(() => this.$refs.dialog?.focus());
    },
  },

  mounted() {
    this.previousFocus = document.activeElement;
    this.$nextTick(() => this.$refs.dialog?.focus());
  },

  beforeUnmount() {
    this.controller?.abort();
    this.releasePreviewUrls();
    this.pdfPassword = "";
    this.previousFocus?.focus?.();
  },

  methods: {
    close() {
      if (this.committing) return;
      this._autoImportQueue?.cancel();
      this.controller?.abort();
      this.$emit("close");
    },
    onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }

      if (event.key !== "Tab") return;

      const nodes = [...this.$refs.dialog.querySelectorAll(
        "button:not(:disabled), input:not(:disabled):not([hidden]), " +
        "select:not(:disabled), [tabindex='0']"
      )].filter((element) => element.getClientRects().length);

      if (!nodes.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (document.activeElement === this.$refs.dialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    },
    onFiles(event) {
      this.addFiles([...event.target.files]);
      event.target.value = "";
    },
    onDrop(event) {
      if (this.committing) return;

      if ([...(event.dataTransfer.items || [])].some(
        (item) => item.webkitGetAsEntry?.()?.isDirectory
      )) {
        this.error = "拖入文件夹请改用「选择文件夹」，以完整取得相对图片路径。";
        return;
      }

      this.addFiles([...event.dataTransfer.files]);
    },
    addFiles(files) {
      if (this.committing) return;

      const map = new Map(this.pool.map((file) => [
        `${file.webkitRelativePath || file.name}\0${file.size}\0${file.lastModified}`,
        file,
      ]));

      files.forEach((file) => {
        map.set(
          `${file.webkitRelativePath || file.name}\0${file.size}\0${file.lastModified}`,
          file
        );
      });

      const next = [...map.values()];

      if (
        next.length > 5000 ||
        next.reduce((sum, file) => sum + file.size, 0) > MAX_POOL_BYTES
      ) {
        this.error = "所选文件超过 5000 个或总大小超过 100MB。";
        return;
      }

      const sourceCount = next.filter(
        (file) => isImportDocument(file) || /\.doc$/i.test(file.name)
      ).length;

      if (sourceCount > 30) {
        this.error = "每批最多导入 30 篇文档。";
        return;
      }

      this.pool = next;
      this.invalidate();
    },
    invalidate() {
      this.autoScheduleParse();
    },
    finishPick() {
      this.folderPicker = false;
    },
    pickFolder(id) {
      this.targetFolderId = id || null;
      this.finishPick();
    },
    cancelParsing() {
      this.autoCancelParse();
    },
    parse() {
      this.autoScheduleParse(0);
    },
    releasePreviewUrls() {
      this.previewUrls.forEach((image) => URL.revokeObjectURL(image.url));
      this.previewUrls = [];
    },
    refreshPreviewUrls() {
      this.releasePreviewUrls();
      this.previewUrls = (this.current?.draft?.assets || []).map((asset) => ({
        id: asset.id,
        name: asset.name,
        url: URL.createObjectURL(asset.blob),
      }));
    },
    async commit() {
      if (this.busy || !this.selectedDrafts.length) return;

      this.committing = true;
      this.error = "";

      try {
        this.created = await commitImportBatch(
          this.selectedDrafts,
          this.targetFolderId
        );

        this.done = true;
        this.pdfPassword = "";
        this.releasePreviewUrls();
        this.$emit("imported", this.created);
      } catch (error) {
        this.error = error.message || "导入失败";
      } finally {
        this.committing = false;
      }
    },
  },
};
</script>

<style lang="scss">
.fi-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20500;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(20, 24, 31, 0.42);
  backdrop-filter: blur(2px);
}

.fi-dialog {
  display: flex;
  width: min(1040px, 100%);
  height: min(780px, calc(100vh - 48px));
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e3e7ed;
  border-radius: 16px;
  background: #fff;
  color: #29313d;
  box-shadow: 0 24px 80px rgba(18, 22, 30, 0.25);
  outline: none;
}

.fi-header,
.fi-footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
}

.fi-header {
  justify-content: space-between;
  border-bottom: 1px solid #edf0f4;

  h2 {
    margin: 0;
    font-size: 18px;
  }
  p {
    margin: 5px 0 0;
    color: #7d8794;
    font-size: 12px;
  }
}

.fi-body {
  min-height: 0;
  flex: 1;
  padding: 18px 20px;
  overflow: auto;
}

.fi-dialog button,
.fi-dialog select,
.fi-dialog input:not([type="checkbox"]) {
  padding: 7px 10px;
  border: 1px solid #dce2ea;
  border-radius: 7px;
  background: #fff;
  color: inherit;
  font: inherit;
  font-size: 12px;
}

.fi-dialog button {
  cursor: pointer;
}

.fi-dialog button:disabled {
  opacity: 0.45;
  cursor: default;
}

.fi-dialog button:focus-visible,
.fi-dialog input:focus-visible,
.fi-dialog select:focus-visible {
  outline: 2px solid #4263eb;
  outline-offset: 2px;
}

.fi-drop {
  padding: 20px;
  border: 1px dashed #b9c8e2;
  border-radius: 11px;
  background: #f7f9fd;
  text-align: center;

  p,
  small {
    color: #778293;
    font-size: 12px;
  }
}

.fi-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 10px 0;
}

.fi-settings {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;

  label {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
  }

  span {
    color: #737e8c;
    font-size: 11px;
  }

  button {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
}

.fi-boundary {
  color: #84909e;
  font-size: 11px;
  line-height: 1.6;
}

.fi-error {
  color: #b14848;
  font-size: 12px;
}

.fi-review {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 280px;
  margin-top: 16px;
  border: 1px solid #e2e7ed;
  border-radius: 10px;
  overflow: hidden;
}

.fi-list {
  border-right: 1px solid #e2e7ed;
  background: #fafbfc;

  article {
    padding: 10px;
    border-bottom: 1px solid #e9edf2;
  }

  article.active {
    background: #edf2ff;
  }

  label {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  button {
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    overflow-wrap: anywhere;
    text-align: left;
  }

  small {
    display: block;
    margin-top: 5px;
    color: #87919e;
    font-size: 10px;
    overflow-wrap: anywhere;
  }
}

.fi-preview {
  min-width: 0;
  padding: 16px;

  h3 {
    margin: 18px 0 8px;
    font-size: 12px;
  }

  pre {
    max-height: 360px;
    overflow: auto;
    padding: 12px;
    border-radius: 7px;
    background: #f6f8fa;
    color: inherit;
    font: inherit;
    font-size: 12px;
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  figure {
    margin: 14px 0;
  }

  img {
    max-width: 100%;
    max-height: 420px;
    border: 1px solid #e4e8ed;
    border-radius: 6px;
    object-fit: contain;
  }

  figcaption {
    margin-top: 5px;
    color: #86919e;
    font-size: 10px;
  }
}

.fi-title-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
}

.fi-warnings {
  padding: 10px 10px 10px 28px;
  border-radius: 7px;
  background: #fff6df;
  color: #84631d;
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.fi-footer {
  justify-content: flex-end;
  border-top: 1px solid #edf0f4;

  > span {
    min-width: 0;
    margin-right: auto;
    overflow: hidden;
    color: #84909e;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fi-primary {
    border-color: #4263eb;
    background: #4263eb;
    color: #fff;
  }
}

.fi-done {
  padding: 40px 16px;
  text-align: center;

  strong {
    font-size: 20px;
  }

  p {
    color: #7b8796;
    font-size: 13px;
  }

  button {
    display: block;
    max-width: 100%;
    margin: 10px auto;
    overflow-wrap: anywhere;
  }
}

.dark-theme {
  .fi-dialog {
    border-color: #35404d;
    background: #1d232b;
    color: #dce4ee;
  }

  .fi-header,
  .fi-footer,
  .fi-review,
  .fi-list,
  .fi-list article {
    border-color: #35404d;
  }

  .fi-dialog button,
  .fi-dialog select,
  .fi-dialog input:not([type="checkbox"]) {
    border-color: #3b4654;
    background: #252d38;
  }

  .fi-drop,
  .fi-list,
  .fi-preview pre {
    background: #171e28;
  }

  .fi-list article.active {
    background: #253453;
  }

  .fi-warnings {
    background: #3b3220;
    color: #e3cb91;
  }

  .fi-footer .fi-primary {
    background: #4263eb;
  }
}

@media (max-width: 760px) {
  .fi-backdrop {
    padding: 10px;
  }

  .fi-dialog {
    height: calc(100vh - 20px);
  }

  .fi-settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .fi-review {
    grid-template-columns: 1fr;
  }

  .fi-list {
    border-right: 0;
    border-bottom: 1px solid #e2e7ed;
  }

  .fi-footer {
    flex-wrap: wrap;
  }
}
</style>

<style lang="scss">
/* FOCUS_EXPERIENCE_20261005_V2 */
.fi-target-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 12px;

  > div {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 8px;
  }

  small, > span { color: #7f8b9a; font-size: 11px; }

  button {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.fi-advanced {
  margin-bottom: 10px;

  summary {
    color: #87919f;
    font-size: 11px;
    cursor: pointer;
  }

  .fi-settings {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .fi-target-bar { align-items: flex-start; flex-direction: column; }
  .fi-advanced .fi-settings { grid-template-columns: 1fr; }
}
</style>
