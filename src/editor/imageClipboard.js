/* FOCUS_EDITOR_ENHANCE_20261028_V1：图片复制到剪贴板 / 下载到本地 */
import focusAssetRepository from "../repositories/focusAssetRepository";

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

async function loadRecord(attrs) {
  if (!attrs?.assetId) throw new Error("图片数据无效");
  const record = await focusAssetRepository.get(attrs.assetId);
  if (!record?.blob) throw new Error("图片文件不存在或已被清理");
  return record;
}

/** 剪贴板只稳定支持 PNG，其它格式经 canvas 转换 */
async function toPng(blob) {
  if (blob.type === "image/png") return blob;
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片解码失败"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1;
    canvas.height = image.naturalHeight || 1;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("图片转换失败"))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function copyImageAsset(attrs) {
  const record = await loadRecord(attrs);
  if (!navigator.clipboard?.write || typeof window.ClipboardItem !== "function") {
    throw new Error("当前环境不支持复制图片，请使用“下载”");
  }
  const png = await toPng(record.blob);
  await navigator.clipboard.write([new window.ClipboardItem({ "image/png": png })]);
  return true;
}

export async function downloadImageAsset(attrs) {
  const record = await loadRecord(attrs);
  const ext = EXT[record.type] || "png";
  const base = String(attrs.caption || attrs.alt || record.name || "图片")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim()
    .slice(0, 80) || "图片";

  const url = URL.createObjectURL(record.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${base}.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
