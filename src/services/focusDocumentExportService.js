import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
} from "docx";

import focusAssetRepository from "../repositories/focusAssetRepository";

/* FOCUS_EXPORT_IMAGES_20260920_V3 */

const FORMAT_META = Object.freeze({
  markdown: {
    extension: "md",
    mime: "text/markdown;charset=utf-8",
  },
  word: {
    extension: "docx",
    mime:
      "application/vnd.openxmlformats-officedocument."
      + "wordprocessingml.document",
  },
  pdf: {
    extension: "pdf",
    mime: "application/pdf",
  },
});

const DOCX_NUMBERING_REFERENCE =
  "weektodo-numbering";

/*
 * FOCUS_MIND_MAP_EXPORT_20260920_V2
 *
 * 思维导图在编辑状态下保存结构化 Mind Elixir 数据，
 * 同时保存一张本地 PNG 快照。
 *
 * 导出时只修改深拷贝后的导出副本：
 * focusMindMap -> focusImage。
 *
 * 这样 Word、PDF、Markdown 均复用现有图片水合、
 * 尺寸计算和本地化导出链路，不修改原始文档，
 * 也不需要在三个格式中分别维护脑图分支。
 */
function normalizeMindMapExportNodes(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    value.forEach(
      normalizeMindMapExportNodes
    );

    return value;
  }

  if (value.type === "focusMindMap") {
    value.type = "focusImage";

    value.attrs = {
      ...(value.attrs || {}),
      alt:
        value.attrs?.alt
        || (
          "思维导图："
          + (
            value.attrs?.title
            || "中心主题"
          )
        ),
      title:
        value.attrs?.title
        || "思维导图",
      width:
        value.attrs?.width
        || "100%",
    };
  }

  Object.values(value).forEach(
    normalizeMindMapExportNodes
  );

  return value;
}

function clone(value) {
  return normalizeMindMapExportNodes(
    JSON.parse(
      JSON.stringify(value || null)
    )
  );
}

function safeFilename(value) {
  return (
    String(value || "未命名文档")
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\.+$/g, "")
      .trim()
      .slice(0, 100) ||
    "未命名文档"
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeMarkdown(value) {
  return String(value || "").replace(
    /([\\`*_[\]<>])/g,
    "\\$1"
  );
}

function normalizeColor(value) {
  const color = String(value || "")
    .trim()
    .replace(/^#/, "");

  return /^[0-9a-f]{6}$/i.test(color)
    ? color.toUpperCase()
    : undefined;
}

function textMarks(node) {
  return Array.isArray(node?.marks)
    ? node.marks
    : [];
}

function findMark(node, type) {
  return textMarks(node).find(
    (mark) => mark.type === type
  );
}

function textToMarkdown(node) {
  let value = escapeMarkdown(
    node?.text || ""
  );

  textMarks(node).forEach((mark) => {
    switch (mark.type) {
      case "bold":
        value = `**${value}**`;
        break;

      case "italic":
        value = `*${value}*`;
        break;

      case "strike":
        value = `~~${value}~~`;
        break;

      case "code":
        value = `\`${value}\``;
        break;

      case "link":
        value =
          `[${value}]`
          + `(${mark.attrs?.href || ""})`;
        break;

      default:
        break;
    }
  });

  return value;
}

function nodeToMarkdown(node, depth = 0) {
  if (!node) return "";

  if (node.type === "text") {
    return textToMarkdown(node);
  }

  if (node.type === "hardBreak") {
    return "  \n";
  }

  const children = (
    Array.isArray(node.content)
      ? node.content
      : []
  )
    .map((child) =>
      nodeToMarkdown(child, depth + 1)
    )
    .join("");

  const level =
    Number(node.attrs?.level) || 1;

  switch (node.type) {
    case "doc":
      return children.trim();

    case "paragraph":
      return `${children}\n\n`;

    case "heading":
      return (
        `${"#".repeat(
          Math.min(Math.max(level, 1), 6)
        )} ${children}\n\n`
      );

    case "blockquote":
      return (
        children
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n"
      );

    case "bulletList":
    case "orderedList":
    case "taskList":
      return `${children}\n`;

    case "listItem":
      return (
        `${"  ".repeat(
          Math.max(depth - 2, 0)
        )}- ${children.trim()}\n`
      );

    case "taskItem":
      return (
        `${"  ".repeat(
          Math.max(depth - 2, 0)
        )}- [${node.attrs?.checked
          ? "x"
          : " "}] ${children.trim()}\n`
      );

    case "codeBlock":
      return (
        "```"
        + (node.attrs?.language || "")
        + "\n"
        + children
        + "\n```\n\n"
      );

    case "horizontalRule":
      return "---\n\n";

    case "linkedTask":
      return (
        `- [${node.attrs?.checked
          ? "x"
          : " "}] `
        + (
          node.attrs?.title ||
          "关联事项"
        )
        + "\n"
      );

    case "image":
      return (
        `![${escapeMarkdown(
          node.attrs?.alt || "图片"
        )}](${node.attrs?.src || ""})\n\n`
      );

    case "focusImage":
      return (
        `[图片：${escapeMarkdown(
          node.attrs?.alt ||
          node.attrs?.title ||
          "图片"
        )}]\n\n`
      );

    case "detailsSummary":
      return `**${children.trim()}**\n\n`;

    case "detailsContent":
      return children;

    case "details":
      return `${children}\n`;

    default:
      return children;
  }
}

function inlineNodeToHtml(node) {
  if (!node) return "";

  if (node.type === "hardBreak") {
    return "<br>";
  }

  if (node.type !== "text") {
    return (
      node.content || []
    )
      .map(inlineNodeToHtml)
      .join("");
  }

  let value = escapeHtml(
    node.text || ""
  );

  textMarks(node).forEach((mark) => {
    switch (mark.type) {
      case "bold":
        value = `<strong>${value}</strong>`;
        break;

      case "italic":
        value = `<em>${value}</em>`;
        break;

      case "strike":
        value = `<s>${value}</s>`;
        break;

      case "underline":
        value = `<u>${value}</u>`;
        break;

      case "code":
        value = `<code>${value}</code>`;
        break;

      case "link": {
        const href = escapeHtml(
          mark.attrs?.href || ""
        );

        value =
          `<a href="${href}">${value}</a>`;
        break;
      }

      case "textStyle": {
        const color = escapeHtml(
          mark.attrs?.color || ""
        );

        if (color) {
          value =
            `<span style="color:${color}">`
            + `${value}</span>`;
        }

        break;
      }

      case "highlight": {
        const background =
          escapeHtml(
            mark.attrs?.color ||
            "#fff3a3"
          );

        value =
          `<mark style="background:${background}">`
          + `${value}</mark>`;
        break;
      }

      default:
        break;
    }
  });

  return value;
}

function nodeToHtml(node) {
  if (!node) return "";

  if (
    node.type === "text" ||
    node.type === "hardBreak"
  ) {
    return inlineNodeToHtml(node);
  }

  const children = (
    node.content || []
  )
    .map(nodeToHtml)
    .join("");

  const inlineChildren = (
    node.content || []
  )
    .map(inlineNodeToHtml)
    .join("");

  const level = Math.min(
    Math.max(
      Number(node.attrs?.level) || 1,
      1
    ),
    6
  );

  switch (node.type) {
    case "doc":
      return children;

    case "paragraph":
      return `<p>${inlineChildren || "<br>"}</p>`;

    case "heading":
      return (
        `<h${level}>${inlineChildren}`
        + `</h${level}>`
      );

    case "blockquote":
      return `<blockquote>${children}</blockquote>`;

    case "bulletList":
      return `<ul>${children}</ul>`;

    case "orderedList":
      return `<ol>${children}</ol>`;

    case "taskList":
      return `<ul class="task-list">${children}</ul>`;

    case "listItem":
      return `<li>${children}</li>`;

    case "taskItem":
      return (
        `<li class="task-item">`
        + `<span class="checkbox">`
        + `${node.attrs?.checked ? "✓" : ""}`
        + `</span>`
        + `<div>${children}</div>`
        + `</li>`
      );

    case "codeBlock":
      return (
        `<pre><code>${escapeHtml(
          (
            node.content || []
          )
            .map((child) =>
              child.text || ""
            )
            .join("")
        )}</code></pre>`
      );

    case "horizontalRule":
      return "<hr>";

    case "linkedTask":
      return (
        `<div class="linked-task">`
        + `<span class="checkbox">`
        + `${node.attrs?.checked ? "✓" : ""}`
        + `</span>`
        + `<span>${escapeHtml(
          node.attrs?.title ||
          "关联事项"
        )}</span>`
        + `</div>`
      );

    case "image":
    case "focusImage": {
      const exportImage =
        node.attrs?.exportImage;

      const source = escapeHtml(
        exportImage?.dataUrl ||
        node.attrs?.src ||
        ""
      );

      const label =
        node.attrs?.alt ||
        node.attrs?.title ||
        "图片";

      if (!source) {
        return (
          `<figure class="export-image-missing">`
          + `<div>图片无法导出：${escapeHtml(
            label
          )}</div>`
          + (
            exportImage?.error
              ? `<figcaption>${escapeHtml(
                  exportImage.error
                )}</figcaption>`
              : ""
          )
          + `</figure>`
        );
      }

      return (
        `<figure>`
        + `<img src="${source}" alt="${escapeHtml(
          label
        )}">`
        + (
          node.attrs?.title
            ? `<figcaption>${escapeHtml(
                node.attrs.title
              )}</figcaption>`
            : ""
        )
        + `</figure>`
      );
    }

    case "details":
      return `<section class="details">${children}</section>`;

    case "detailsSummary":
      return `<h4>${inlineChildren}</h4>`;

    case "detailsContent":
      return `<div>${children}</div>`;

    default:
      return children;
  }
}

function documentToMarkdown(document) {
  const title =
    document?.title || "未命名文档";

  const tags = Array.isArray(
    document?.tags
  )
    ? document.tags.filter(Boolean)
    : [];

  return [
    `# ${escapeMarkdown(title)}`,
    "",
    ...(tags.length
      ? [
          `标签：${tags
            .map(escapeMarkdown)
            .join("、")}`,
          "",
        ]
      : []),
    nodeToMarkdown(
      document?.content
    ),
    "",
  ].join("\n");
}

function documentToPrintHtml(document) {
  const title =
    document?.title || "未命名文档";

  const tags = Array.isArray(
    document?.tags
  )
    ? document.tags.filter(Boolean)
    : [];

  const exportedAt =
    new Intl.DateTimeFormat(
      "zh-CN",
      {
        dateStyle: "long",
        timeStyle: "short",
      }
    ).format(new Date());

  const body = nodeToHtml(
    document?.content
  );

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="
      default-src 'none';
      img-src data: blob: app: https: http:;
      style-src 'unsafe-inline';
      font-src data:;
    "
  >
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 17mm 20mm;
    }

    * {
      box-sizing: border-box;
    }

    html {
      background: #ffffff;
    }

    body {
      max-width: 780px;
      margin: 0 auto;
      color: #24272d;
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "SF Pro Text",
        "PingFang SC",
        "Microsoft YaHei",
        Arial,
        sans-serif;
      font-size: 11pt;
      line-height: 1.72;
      overflow-wrap: anywhere;
    }

    .document-header {
      margin-bottom: 26px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e6e8eb;
    }

    .document-title {
      margin: 0;
      color: #17191d;
      font-size: 26pt;
      font-weight: 720;
      line-height: 1.28;
      letter-spacing: -0.025em;
    }

    .document-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
      color: #8b929b;
      font-size: 9pt;
    }

    .tag {
      padding: 2px 8px;
      border-radius: 999px;
      background: #f0f2f5;
      color: #676f79;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      break-after: avoid;
      color: #202329;
      line-height: 1.35;
    }

    h1 {
      margin: 28px 0 12px;
      font-size: 21pt;
    }

    h2 {
      margin: 24px 0 10px;
      font-size: 17pt;
    }

    h3 {
      margin: 20px 0 8px;
      font-size: 14pt;
    }

    h4,
    h5,
    h6 {
      margin: 17px 0 7px;
      font-size: 12pt;
    }

    p {
      margin: 0 0 10px;
    }

    a {
      color: #315ac7;
      text-decoration: none;
      border-bottom: 1px solid
        rgba(49, 90, 199, 0.28);
    }

    blockquote {
      margin: 14px 0;
      padding: 4px 0 4px 14px;
      border-left: 3px solid #a9b8e8;
      color: #5f6670;
    }

    ul,
    ol {
      margin: 8px 0 12px;
      padding-left: 24px;
    }

    li {
      margin: 3px 0;
    }

    pre {
      margin: 14px 0;
      padding: 13px 15px;
      border: 1px solid #e1e4e8;
      border-radius: 8px;
      background: #f6f7f9;
      color: #30343a;
      font-family:
        "SFMono-Regular",
        Menlo,
        Consolas,
        monospace;
      font-size: 9.5pt;
      line-height: 1.55;
      white-space: pre-wrap;
      break-inside: avoid;
    }

    code {
      padding: 1px 4px;
      border-radius: 4px;
      background: #f1f2f4;
      font-family:
        "SFMono-Regular",
        Menlo,
        Consolas,
        monospace;
      font-size: 0.9em;
    }

    pre code {
      padding: 0;
      background: transparent;
    }

    hr {
      height: 1px;
      margin: 22px 0;
      border: 0;
      background: #e2e5e8;
    }

    mark {
      padding: 0 2px;
      border-radius: 2px;
    }

    .task-list {
      padding-left: 0;
      list-style: none;
    }

    .task-item,
    .linked-task {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 7px 0;
    }

    .checkbox {
      display: inline-grid;
      width: 15px;
      height: 15px;
      flex: 0 0 15px;
      place-items: center;
      margin-top: 4px;
      border: 1.2px solid #9aa1aa;
      border-radius: 50%;
      color: #4263eb;
      font-size: 9px;
      line-height: 1;
    }

    .linked-task {
      padding: 9px 11px;
      border: 1px solid #e4e7eb;
      border-radius: 8px;
      background: #fafbfc;
      break-inside: avoid;
    }

    figure {
      margin: 16px 0;
      text-align: center;
      break-inside: avoid;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
    }

    figcaption {
      margin-top: 6px;
      color: #9298a1;
      font-size: 9pt;
    }

    .export-image-missing {
      padding: 18px;
      border: 1px dashed #d8a3a3;
      border-radius: 8px;
      background: #fff8f8;
      color: #9f5555;
      font-size: 9.5pt;
    }

    .details {
      margin: 12px 0;
      padding: 10px 13px;
      border: 1px solid #e4e7eb;
      border-radius: 8px;
      break-inside: avoid;
    }

    .document-footer {
      margin-top: 32px;
      padding-top: 10px;
      border-top: 1px solid #eceef1;
      color: #a0a6ae;
      font-size: 8.5pt;
    }
  </style>
</head>
<body>
  <header class="document-header">
    <h1 class="document-title">
      ${escapeHtml(title)}
    </h1>

    <div class="document-meta">
      ${
        tags
          .map(
            (tag) =>
              `<span class="tag">${escapeHtml(
                tag
              )}</span>`
          )
          .join("")
      }
    </div>
  </header>

  <main>
    ${body || "<p>暂无正文</p>"}
  </main>

  <footer class="document-footer">
    由 WeekToDo 导出 · ${escapeHtml(exportedAt)}
  </footer>
</body>
</html>`;
}


const EXPORT_IMAGE_TOTAL_LIMIT =
  64 * 1024 * 1024;

const EXPORT_IMAGE_RASTER_EDGE =
  2400;

const WORD_IMAGE_MAX_WIDTH = 560;
const WORD_IMAGE_MAX_HEIGHT = 720;

function walkContentNodes(
  node,
  callback
) {
  if (
    !node ||
    typeof node !== "object"
  ) {
    return;
  }

  callback(node);

  if (Array.isArray(node.content)) {
    node.content.forEach((child) => {
      walkContentNodes(
        child,
        callback
      );
    });
  }
}

function blobToDataUrl(blob) {
  return new Promise(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(String(reader.result || ""));
      };

      reader.onerror = () => {
        reject(
          reader.error ||
          new Error("图片读取失败")
        );
      };

      reader.readAsDataURL(blob);
    }
  );
}

function loadImageElement(blob) {
  return new Promise(
    (resolve, reject) => {
      const url =
        URL.createObjectURL(blob);

      const image = new Image();

      const cleanup = () => {
        URL.revokeObjectURL(url);
      };

      image.onload = () => {
        const result = {
          image,
          width:
            image.naturalWidth || 1,
          height:
            image.naturalHeight || 1,
          cleanup,
        };

        resolve(result);
      };

      image.onerror = () => {
        cleanup();

        reject(
          new Error(
            "无法解析图片尺寸"
          )
        );
      };

      image.src = url;
    }
  );
}

async function rasterizeToPng(blob) {
  const loaded =
    await loadImageElement(blob);

  try {
    const scale = Math.min(
      1,
      EXPORT_IMAGE_RASTER_EDGE /
        Math.max(
          loaded.width,
          loaded.height,
          1
        )
    );

    const width = Math.max(
      1,
      Math.round(
        loaded.width * scale
      )
    );

    const height = Math.max(
      1,
      Math.round(
        loaded.height * scale
      )
    );

    const canvas =
      window.document.createElement(
        "canvas"
      );

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "无法创建图片转换画布"
      );
    }

    context.drawImage(
      loaded.image,
      0,
      0,
      width,
      height
    );

    const output = await new Promise(
      (resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(
                new Error(
                  "图片格式转换失败"
                )
              );
            }
          },
          "image/png"
        );
      }
    );

    return {
      blob: output,
      type: "png",
      width,
      height,
    };
  } finally {
    loaded.cleanup();
  }
}

async function resolveImageDimensions(
  blob,
  attrs
) {
  const storedWidth = Number(
    attrs?.originalWidth
  );

  const storedHeight = Number(
    attrs?.originalHeight
  );

  if (
    Number.isFinite(storedWidth) &&
    storedWidth > 0 &&
    Number.isFinite(storedHeight) &&
    storedHeight > 0
  ) {
    return {
      width: storedWidth,
      height: storedHeight,
    };
  }

  const loaded =
    await loadImageElement(blob);

  try {
    return {
      width: loaded.width,
      height: loaded.height,
    };
  } finally {
    loaded.cleanup();
  }
}

function wordImageDimensions(
  attrs,
  naturalWidth,
  naturalHeight
) {
  const sourceWidth = Math.max(
    Number(naturalWidth) || 1,
    1
  );

  const sourceHeight = Math.max(
    Number(naturalHeight) || 1,
    1
  );

  const requested =
    String(attrs?.width || "100%")
      .trim();

  let targetWidth =
    Math.min(
      sourceWidth,
      WORD_IMAGE_MAX_WIDTH
    );

  if (requested.endsWith("%")) {
    const percentage =
      Number.parseFloat(requested);

    if (
      Number.isFinite(percentage) &&
      percentage > 0
    ) {
      targetWidth = Math.min(
        targetWidth,
        WORD_IMAGE_MAX_WIDTH *
          Math.min(percentage, 100) /
          100
      );
    }
  } else {
    const pixels =
      Number.parseFloat(requested);

    if (
      Number.isFinite(pixels) &&
      pixels > 0
    ) {
      targetWidth = Math.min(
        targetWidth,
        pixels
      );
    }
  }

  let targetHeight =
    targetWidth *
    sourceHeight /
    sourceWidth;

  if (
    targetHeight >
    WORD_IMAGE_MAX_HEIGHT
  ) {
    const scale =
      WORD_IMAGE_MAX_HEIGHT /
      targetHeight;

    targetWidth *= scale;
    targetHeight *= scale;
  }

  return {
    width: Math.max(
      1,
      Math.round(targetWidth)
    ),
    height: Math.max(
      1,
      Math.round(targetHeight)
    ),
  };
}

function wordImageType(mime) {
  const normalized =
    String(mime || "")
      .toLowerCase();

  if (
    normalized === "image/jpeg" ||
    normalized === "image/jpg"
  ) {
    return "jpg";
  }

  if (normalized === "image/png") {
    return "png";
  }

  if (normalized === "image/gif") {
    return "gif";
  }

  if (normalized === "image/bmp") {
    return "bmp";
  }

  return null;
}

async function prepareAssetForExport(
  record,
  attrs,
  format
) {
  if (!(record?.blob instanceof Blob)) {
    throw new Error(
      "图片资源不存在或已损坏"
    );
  }

  const dimensions =
    await resolveImageDimensions(
      record.blob,
      attrs
    );

  if (format === "pdf") {
    return {
      dataUrl:
        await blobToDataUrl(
          record.blob
        ),
      naturalWidth:
        dimensions.width,
      naturalHeight:
        dimensions.height,
    };
  }

  let outputBlob = record.blob;
  let outputType =
    wordImageType(
      record.type ||
      record.blob.type
    );

  let outputWidth =
    dimensions.width;

  let outputHeight =
    dimensions.height;

  /*
   * Word/Pages 对 WebP 的支持并不稳定；
   * SVG 在 docx 中还需要额外 fallback。
   * 统一转为 PNG，确保本地 Office 软件可以打开。
   */
  if (!outputType) {
    const converted =
      await rasterizeToPng(
        record.blob
      );

    outputBlob = converted.blob;
    outputType = converted.type;
    outputWidth = converted.width;
    outputHeight = converted.height;
  }

  return {
    type: outputType,
    data: new Uint8Array(
      await outputBlob.arrayBuffer()
    ),
    naturalWidth: outputWidth,
    naturalHeight: outputHeight,
    transformation:
      wordImageDimensions(
        attrs,
        outputWidth,
        outputHeight
      ),
  };
}

async function hydrateExportImages(
  document,
  format
) {
  if (
    format !== "word" &&
    format !== "pdf"
  ) {
    return document;
  }

  const nodes = [];

  walkContentNodes(
    document?.content,
    (node) => {
      if (
        node.type === "focusImage" &&
        node.attrs?.assetId
      ) {
        nodes.push(node);
      }
    }
  );

  if (!nodes.length) {
    return document;
  }

  const cache = new Map();
  const countedAssets = new Set();
  let totalBytes = 0;

  for (const node of nodes) {
    const assetId =
      node.attrs.assetId;

    try {
      if (!cache.has(assetId)) {
        const record =
          await focusAssetRepository.get(
            assetId
          );

        if (!record?.blob) {
          throw new Error(
            "图片文件不存在，可能已被清理"
          );
        }

        if (!countedAssets.has(assetId)) {
          totalBytes += Number(
            record.size ||
            record.blob.size ||
            0
          );

          countedAssets.add(assetId);
        }

        if (
          totalBytes >
          EXPORT_IMAGE_TOTAL_LIMIT
        ) {
          throw new Error(
            "文档图片总大小超过 64MB，"
            + "请压缩图片后再导出"
          );
        }

        cache.set(
          assetId,
          prepareAssetForExport(
            record,
            node.attrs,
            format
          )
        );
      }

      const exportImage =
        await cache.get(assetId);

      node.attrs = {
        ...node.attrs,
        exportImage,
      };
    } catch (error) {
      node.attrs = {
        ...node.attrs,
        exportImage: {
          error:
            error?.message ||
            "图片加载失败",
        },
      };
    }
  }

  return document;
}


function textNodeToDocx(node) {
  const marks = textMarks(node);

  const options = {
    text: node?.text || "",
    bold: Boolean(
      findMark(node, "bold")
    ),
    italics: Boolean(
      findMark(node, "italic")
    ),
    strike: Boolean(
      findMark(node, "strike")
    ),
    underline: findMark(
      node,
      "underline"
    )
      ? {}
      : undefined,
  };

  const codeMark = findMark(
    node,
    "code"
  );

  const textStyle = findMark(
    node,
    "textStyle"
  );

  if (codeMark) {
    options.font = "Menlo";
    options.size = 19;
  }

  const color = normalizeColor(
    textStyle?.attrs?.color
  );

  if (color) {
    options.color = color;
  }

  const run = new TextRun(options);
  const link = findMark(node, "link");

  if (
    link?.attrs?.href &&
    /^https?:\/\//i.test(
      link.attrs.href
    )
  ) {
    return new ExternalHyperlink({
      children: [run],
      link: link.attrs.href,
    });
  }

  return run;
}

function inlineToDocx(nodes) {
  const result = [];

  (
    Array.isArray(nodes)
      ? nodes
      : []
  ).forEach((node) => {
    if (node.type === "text") {
      result.push(
        textNodeToDocx(node)
      );
      return;
    }

    if (node.type === "hardBreak") {
      result.push(
        new TextRun({
          text: "",
          break: 1,
        })
      );
      return;
    }

    result.push(
      ...inlineToDocx(
        node.content || []
      )
    );
  });

  return result;
}

function paragraphChildren(node) {
  const runs = inlineToDocx(
    node?.content || []
  );

  return runs.length
    ? runs
    : [new TextRun("")];
}

function flattenText(node) {
  if (!node) return "";

  if (node.type === "text") {
    return node.text || "";
  }

  return (
    node.content || []
  )
    .map(flattenText)
    .join("");
}

function docxHeading(level) {
  const headings = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
    5: HeadingLevel.HEADING_5,
    6: HeadingLevel.HEADING_6,
  };

  return (
    headings[
      Math.min(
        Math.max(Number(level) || 1, 1),
        6
      )
    ] ||
    HeadingLevel.HEADING_1
  );
}

function nodeToDocxBlocks(
  node,
  context = {}
) {
  if (!node) return [];

  const depth =
    Number(context.depth) || 0;

  switch (node.type) {
    case "doc":
      return (
        node.content || []
      ).flatMap((child) =>
        nodeToDocxBlocks(child, context)
      );

    case "paragraph":
      return [
        new Paragraph({
          children:
            paragraphChildren(node),
          spacing: {
            after: 150,
            line: 330,
          },
        }),
      ];

    case "heading":
      return [
        new Paragraph({
          heading: docxHeading(
            node.attrs?.level
          ),
          children:
            paragraphChildren(node),
          spacing: {
            before: 220,
            after: 120,
          },
          keepNext: true,
        }),
      ];

    case "blockquote":
      return (
        node.content || []
      ).flatMap((child) => {
        const content =
          paragraphChildren(child);

        return [
          new Paragraph({
            children: content,
            indent: {
              left: 360,
            },
            border: {
              left: {
                color: "9EAFE5",
                style:
                  BorderStyle.SINGLE,
                size: 16,
                space: 10,
              },
            },
            spacing: {
              before: 80,
              after: 120,
            },
          }),
        ];
      });

    case "bulletList":
      return (
        node.content || []
      ).flatMap((child) =>
        nodeToDocxBlocks(
          child,
          {
            listType: "bullet",
            depth,
          }
        )
      );

    case "orderedList":
      return (
        node.content || []
      ).flatMap((child) =>
        nodeToDocxBlocks(
          child,
          {
            listType: "number",
            depth,
          }
        )
      );

    case "taskList":
      return (
        node.content || []
      ).flatMap((child) =>
        nodeToDocxBlocks(
          child,
          {
            listType: "task",
            depth,
          }
        )
      );

    case "listItem": {
      const first =
        node.content?.[0];

      const remaining =
        node.content?.slice(1) || [];

      const paragraph =
        new Paragraph({
          children:
            paragraphChildren(
              first || node
            ),
          bullet:
            context.listType ===
            "bullet"
              ? {
                  level: Math.min(
                    depth,
                    8
                  ),
                }
              : undefined,
          numbering:
            context.listType ===
            "number"
              ? {
                  reference:
                    DOCX_NUMBERING_REFERENCE,
                  level: Math.min(
                    depth,
                    8
                  ),
                }
              : undefined,
          spacing: {
            after: 80,
          },
        });

      return [
        paragraph,
        ...remaining.flatMap(
          (child) =>
            nodeToDocxBlocks(
              child,
              {
                ...context,
                depth: depth + 1,
              }
            )
        ),
      ];
    }

    case "taskItem": {
      const prefix =
        node.attrs?.checked
          ? "☑ "
          : "☐ ";

      return [
        new Paragraph({
          children: [
            new TextRun({
              text: prefix,
              color: node.attrs?.checked
                ? "4263EB"
                : "747C87",
            }),
            ...inlineToDocx(
              node.content || []
            ),
          ],
          indent: {
            left: 260 + depth * 260,
          },
          spacing: {
            after: 80,
          },
        }),
      ];
    }

    case "codeBlock":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: flattenText(node),
              font: "Menlo",
              size: 18,
            }),
          ],
          shading: {
            type: ShadingType.CLEAR,
            fill: "F4F5F7",
          },
          border: {
            top: {
              style:
                BorderStyle.SINGLE,
              color: "E0E3E7",
              size: 4,
            },
            bottom: {
              style:
                BorderStyle.SINGLE,
              color: "E0E3E7",
              size: 4,
            },
            left: {
              style:
                BorderStyle.SINGLE,
              color: "E0E3E7",
              size: 4,
            },
            right: {
              style:
                BorderStyle.SINGLE,
              color: "E0E3E7",
              size: 4,
            },
          },
          spacing: {
            before: 100,
            after: 150,
          },
        }),
      ];

    case "horizontalRule":
      return [
        new Paragraph({
          border: {
            bottom: {
              color: "D9DDE2",
              style:
                BorderStyle.SINGLE,
              size: 6,
              space: 1,
            },
          },
          spacing: {
            before: 120,
            after: 160,
          },
        }),
      ];

    case "linkedTask":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text:
                node.attrs?.checked
                  ? "☑ "
                  : "☐ ",
              color:
                node.attrs?.checked
                  ? "4263EB"
                  : "747C87",
            }),
            new TextRun({
              text:
                node.attrs?.title ||
                "关联事项",
              strike: Boolean(
                node.attrs?.checked
              ),
            }),
          ],
          shading: {
            type: ShadingType.CLEAR,
            fill: "F8F9FA",
          },
          spacing: {
            before: 70,
            after: 90,
          },
        }),
      ];

    case "image":
    case "focusImage": {
      const image =
        node.attrs?.exportImage;

      const label =
        node.attrs?.alt ||
        node.attrs?.title ||
        "图片";

      if (
        image?.data &&
        image?.type &&
        image?.transformation
      ) {
        const blocks = [
          new Paragraph({
            children: [
              new ImageRun({
                type: image.type,
                data: image.data,
                transformation:
                  image.transformation,
                altText: {
                  name: label,
                  title: label,
                  description: label,
                },
              }),
            ],
            alignment:
              AlignmentType.CENTER,
            spacing: {
              before: 120,
              after:
                node.attrs?.title
                  ? 45
                  : 140,
            },
            keepLines: true,
          }),
        ];

        if (node.attrs?.title) {
          blocks.push(
            new Paragraph({
              children: [
                new TextRun({
                  text:
                    node.attrs.title,
                  color: "858C96",
                  italics: true,
                  size: 18,
                }),
              ],
              alignment:
                AlignmentType.CENTER,
              spacing: {
                after: 140,
              },
            })
          );
        }

        return blocks;
      }

      return [
        new Paragraph({
          children: [
            new TextRun({
              text:
                `[图片无法导出] ${label}`
                + (
                  image?.error
                    ? ` · ${image.error}`
                    : ""
                ),
              color: "A05A5A",
              italics: true,
            }),
          ],
          alignment:
            AlignmentType.CENTER,
          spacing: {
            before: 100,
            after: 120,
          },
        }),
      ];
    }

    case "details":
    case "detailsContent":
      return (
        node.content || []
      ).flatMap((child) =>
        nodeToDocxBlocks(
          child,
          context
        )
      );

    case "detailsSummary":
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: flattenText(node),
              bold: true,
            }),
          ],
          spacing: {
            before: 120,
            after: 80,
          },
        }),
      ];

    default:
      if (
        Array.isArray(node.content)
      ) {
        return node.content.flatMap(
          (child) =>
            nodeToDocxBlocks(
              child,
              context
            )
        );
      }

      return [];
  }
}

async function documentToWordBlob(
  document
) {
  const title =
    document?.title ||
    "未命名文档";

  const tags = Array.isArray(
    document?.tags
  )
    ? document.tags.filter(Boolean)
    : [];

  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: title,
          bold: true,
        }),
      ],
      spacing: {
        after: 220,
      },
    }),
  ];

  if (tags.length) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              `标签：${tags.join("、")}`,
            color: "777F89",
            size: 18,
          }),
        ],
        spacing: {
          after: 220,
        },
      })
    );
  }

  children.push(
    ...nodeToDocxBlocks(
      document?.content
    )
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "由 WeekToDo 导出",
          color: "9AA0A8",
          size: 16,
        }),
      ],
      border: {
        top: {
          color: "E1E4E8",
          style: BorderStyle.SINGLE,
          size: 4,
          space: 8,
        },
      },
      spacing: {
        before: 280,
      },
    })
  );

  const wordDocument =
    new Document({
      creator: "WeekToDo",
      title,
      description:
        "WeekToDo 重点事项导出文档",

      styles: {
        default: {
          document: {
            run: {
              font: "PingFang SC",
              size: 22,
              color: "282C32",
            },
            paragraph: {
              spacing: {
                line: 330,
              },
            },
          },
        },
      },

      numbering: {
        config: [
          {
            reference:
              DOCX_NUMBERING_REFERENCE,
            levels: Array.from(
              { length: 9 },
              (_, level) => ({
                level,
                format:
                  LevelFormat.DECIMAL,
                text: `%${level + 1}.`,
                alignment:
                  AlignmentType.START,
                style: {
                  paragraph: {
                    indent: {
                      left:
                        540 +
                        level * 360,
                      hanging: 260,
                    },
                  },
                },
              })
            ),
          },
        ],
      },

      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1100,
                right: 1050,
                bottom: 1100,
                left: 1050,
              },
            },
          },
          children,
        },
      ],
    });

  return Packer.toBlob(
    wordDocument
  );
}

function arrayBufferToBase64(buffer) {
  const bytes =
    new Uint8Array(buffer);

  const chunkSize = 0x8000;
  let binary = "";

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        offset,
        offset + chunkSize
      )
    );
  }

  return window.btoa(binary);
}

function downloadBlob(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(blob);

  const anchor =
    window.document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  window.document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

async function saveWithDesktopApi({
  format,
  filename,
  text,
  base64,
  html,
}) {
  const api =
    window.weekToDoDesktop;

  if (
    !api?.isElectron ||
    typeof api.saveDocumentExport !==
      "function"
  ) {
    return null;
  }

  return api.saveDocumentExport({
    format,
    filename,
    text,
    base64,
    html,
  });
}

const focusDocumentExportService = {
  formats: FORMAT_META,

  async exportDocument(
    sourceDocument,
    format
  ) {
    if (!FORMAT_META[format]) {
      throw new Error(
        `不支持的导出格式：${format}`
      );
    }

    const document =
      clone(sourceDocument) || {};

    /*
     * 图片 Blob 独立保存在 IndexedDB。
     * 在生成 Word/PDF 前解析 assetId，构造自包含导出数据。
     */
    await hydrateExportImages(
      document,
      format
    );

    const meta =
      FORMAT_META[format];

    const filename =
      `${safeFilename(
        document.title
      )}.${meta.extension}`;

    if (format === "markdown") {
      const markdown =
        documentToMarkdown(document);

      const desktopResult =
        await saveWithDesktopApi({
          format,
          filename,
          text: markdown,
        });

      if (desktopResult) {
        return desktopResult;
      }

      downloadBlob(
        new Blob(
          [markdown],
          { type: meta.mime }
        ),
        filename
      );

      return {
        canceled: false,
        filename,
      };
    }

    if (format === "word") {
      const blob =
        await documentToWordBlob(
          document
        );

      const buffer =
        await blob.arrayBuffer();

      const desktopResult =
        await saveWithDesktopApi({
          format,
          filename,
          base64:
            arrayBufferToBase64(
              buffer
            ),
        });

      if (desktopResult) {
        return desktopResult;
      }

      downloadBlob(
        blob,
        filename
      );

      return {
        canceled: false,
        filename,
      };
    }

    const html =
      documentToPrintHtml(
        document
      );

    const desktopResult =
      await saveWithDesktopApi({
        format,
        filename,
        html,
      });

    if (desktopResult) {
      return desktopResult;
    }

    const printWindow =
      window.open("", "_blank");

    if (!printWindow) {
      throw new Error(
        "浏览器阻止了打印窗口，请允许弹出窗口后重试。"
      );
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.addEventListener(
      "load",
      () => {
        printWindow.focus();
        printWindow.print();
      },
      { once: true }
    );

    return {
      canceled: false,
      filename,
    };
  },

  toMarkdown: documentToMarkdown,
  toPrintHtml: documentToPrintHtml,
};

export default focusDocumentExportService;
