import focusOwnership from "../../mixins/focusOwnership";
import { createLatestImportQueue } from "../../services/latestImportQueue.mjs";
import { parseImportFile } from "../../services/focusDocumentImportService";

const BATCH_IMAGE_LIMIT = 64 * 1024 * 1024;

export default {
  mixins: [focusOwnership],

  beforeUnmount() {
    this._autoImportQueue?.dispose();
  },

  methods: {
    focusOwnershipEnabled() {
      return !this.fo_standDown && !this.folderPicker;
    },

    autoImportQueue() {
      if (!this._autoImportQueue) {
        this._autoImportQueue = createLatestImportQueue({
          onError: (error) => {
            this.error = error.message || "自动解析失败";
            this.parsing = false;
            this.progress = "";
          },
        });
      }

      return this._autoImportQueue;
    },

    autoScheduleParse(delay = 250) {
      if (this.committing || this.done) return;

      const queue = this.autoImportQueue();
      const sources = [...this.sources];
      const files = [...this.pool];

      queue.cancel();

      this.releasePreviewUrls();
      this.rows = [];
      this.active = 0;
      this.error = "";
      this.progress = "";

      if (!sources.length) {
        this.parsing = false;
        return;
      }

      const options = {
        files,
        pdfMode: this.pdfMode,
        pdfPassword: this.pdfPassword,
        encoding: this.encoding,
      };

      this.parsing = true;
      this.progress = "正在准备解析…";

      queue.request(async ({ signal, isCurrent }) => {
        if (!isCurrent()) return;

        this.rows = sources.map((file, index) => ({
          key: `${index}-${file.name}`,
          file,
          selected: false,
          draft: null,
          error: "",
        }));

        let acceptedImageBytes = 0;

        try {
          for (let index = 0; index < this.rows.length; index++) {
            if (!isCurrent()) break;

            const row = this.rows[index];

            this.progress =
              `正在解析 ${index + 1}/${sources.length}：${row.file.name}`;

            try {
              const draft = await parseImportFile(row.file, {
                ...options,
                signal,
              });

              if (!isCurrent()) break;

              const bytes = draft.assets.reduce(
                (sum, asset) => sum + asset.blob.size,
                0
              );

              if (acceptedImageBytes + bytes > BATCH_IMAGE_LIMIT) {
                throw new Error(
                  "本批次图片累计超过 64MB，请减少文件或改用 PDF 文字模式"
                );
              }

              acceptedImageBytes += bytes;
              row.draft = draft;
              row.selected = true;

              if (!this.current?.draft) this.active = index;

              if (this.active === index) {
                this.refreshPreviewUrls();
              }
            } catch (error) {
              if (!isCurrent() || error?.name === "AbortError") break;
              row.error = error.message || "解析失败";
            }

            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          if (isCurrent()) {
            const firstReady = this.rows.findIndex((row) => row.draft);

            if (!this.current?.draft && firstReady >= 0) {
              this.active = firstReady;
            }

            this.refreshPreviewUrls();
          }
        } finally {
          if (isCurrent()) {
            this.parsing = false;
            this.progress = "";
          }
        }
      }, delay);
    },

    autoCancelParse() {
      this.autoImportQueue().cancel();
      this.parsing = false;
      this.progress = "";

      this.rows.forEach((row) => {
        if (!row.draft && !row.error) row.error = "已取消解析";
      });

      this.error = "解析已取消，已完成的结果仍可导入。";
    },
  },
};
