import mammoth from "mammoth/mammoth.browser";

const MAX_EXPANDED = 128 * 1024 * 1024;
const MAX_ENTRIES = 5000;

/**
 * 检查 ZIP 中央目录。
 * 拒绝加密、ZIP64、超量条目及声明解压大小过大的文件。
 * 不将压缩包中的路径映射到本地文件系统。
 */
function checkDocxZip(buffer) {
  const view = new DataView(buffer);
  const size = view.byteLength;

  let end = -1;

  for (
    let offset = size - 22;
    offset >= Math.max(0, size - 65557);
    offset--
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      const commentSize = view.getUint16(offset + 20, true);
      if (offset + 22 + commentSize === size) {
        end = offset;
        break;
      }
    }
  }

  if (end < 0) throw new Error("Word 文件不是有效的 DOCX 压缩包");

  const disk = view.getUint16(end + 4, true);
  const centralDisk = view.getUint16(end + 6, true);
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  let position = view.getUint32(end + 16, true);

  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    count === 0xffff ||
    centralSize === 0xffffffff ||
    position === 0xffffffff
  ) {
    throw new Error("不支持分卷、ZIP64 或超大型 DOCX");
  }

  if (count > MAX_ENTRIES || position + centralSize > end) {
    throw new Error("Word 文件内部条目过多或目录损坏");
  }

  const centralEnd = position + centralSize;
  let total = 0;

  for (let index = 0; index < count; index++) {
    if (
      position + 46 > centralEnd ||
      view.getUint32(position, true) !== 0x02014b50
    ) {
      throw new Error("Word 文件内部目录损坏");
    }

    const flags = view.getUint16(position + 8, true);
    const expanded = view.getUint32(position + 24, true);
    const nameSize = view.getUint16(position + 28, true);
    const extraSize = view.getUint16(position + 30, true);
    const commentSize = view.getUint16(position + 32, true);

    if (flags & 1) throw new Error("不支持加密 DOCX");
    if (expanded === 0xffffffff) throw new Error("不支持 ZIP64 DOCX");

    total += expanded;
    if (total > MAX_EXPANDED) {
      throw new Error("Word 解压后内容超过 128MB");
    }

    position += 46 + nameSize + extraSize + commentSize;
    if (position > centralEnd) {
      throw new Error("Word 文件内部条目越界");
    }
  }
}

self.onmessage = async (event) => {
  try {
    const { buffer } = event.data;
    checkDocxZip(buffer);

    const result = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      {
        externalFileAccess: false,
        includeEmbeddedStyleMap: false,
        styleMap: [
          "u => u",
          "p[style-name='标题 1'] => h1:fresh",
          "p[style-name='标题 2'] => h2:fresh",
          "p[style-name='标题 3'] => h3:fresh",
        ],
      }
    );

    if (result.value.length > 20 * 1024 * 1024) {
      throw new Error("转换后的 Word 内容过大");
    }

    self.postMessage({
      ok: true,
      html: result.value,
      warnings: result.messages.map((item) => item.message),
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error?.message || "Word 转换失败",
    });
  }
};
