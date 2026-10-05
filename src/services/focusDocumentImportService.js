import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import dbRepository from "../repositories/dbRepository";
import focusDocumentService from "./focusDocumentService";
import focusFolderService from "./focusFolderService";
import {
  CALLOUT_PRESETS,
  normalizeCalloutTone,
} from "../editor/extensions/FocusCallout";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MB = 1024 * 1024;
const MAX_FILE = 25 * MB;
const MAX_ASSETS = 64 * MB;
const MAX_PAGES = 100;
const MAX_IMAGES = 300;
const MAX_NODES = 50000;

const uid = (prefix) => `${prefix}-${crypto.randomUUID()}`;

function abortCheck(signal) {
  if (signal?.aborted) {
    throw new DOMException("已取消解析", "AbortError");
  }
}

function paragraph(text = "") {
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text }] : [],
  };
}

function textOf(node) {
  return [
    node?.text || "",
    ...(node?.content || []).map(textOf),
  ].join("");
}

function safeLink(value) {
  const url = String(value || "").trim();
  return /^(https?:\/\/|mailto:|#)/i.test(url) ? url : null;
}

function normalizePath(value) {
  const parts = [];

  for (const part of String(value).replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue;

    if (part === "..") {
      if (!parts.length) return null;
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join("/");
}

function sourcePath(file) {
  return file.webkitRelativePath || file.name;
}

function createFileLookup(files) {
  const map = new Map();

  files.forEach((file) => {
    const path = normalizePath(sourcePath(file));
    if (!path) return;
    if (!map.has(path)) map.set(path, []);
    map.get(path).push(file);
  });

  return map;
}

function resolveLocalImage(source, documentFile, lookup) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith("//")) {
    return null;
  }

  let decoded;

  try {
    decoded = decodeURIComponent(source.split(/[?#]/)[0]);
  } catch {
    return null;
  }

  if (decoded.startsWith("/") || /^[A-Za-z]:/.test(decoded)) return null;

  const base = sourcePath(documentFile).split("/").slice(0, -1).join("/");
  const path = normalizePath(base ? `${base}/${decoded}` : decoded);
  const candidates = path ? lookup.get(path) || [] : [];

  return candidates.length === 1 ? candidates[0] : null;
}

function readDataImage(source) {
  const match = String(source).match(
    /^data:(image\/(?:png|jpeg|webp|gif|bmp));base64,([a-z0-9+/=\s]+)$/i
  );

  if (!match) throw new Error("不支持的内嵌图片格式");

  const binary = atob(match[2].replace(/\s/g, ""));
  if (binary.length > 15 * MB) throw new Error("单张图片超过 15MB");

  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: match[1].toLowerCase() });
}

async function imageToPng(blob, signal) {
  abortCheck(signal);

  if (!(blob instanceof Blob) || blob.size > 15 * MB) {
    throw new Error("图片超过 15MB 或文件无效");
  }

  const prefix = new TextDecoder().decode(
    await blob.slice(0, 512).arrayBuffer()
  );

  if (
    blob.type === "image/svg+xml" ||
    /<svg[\s>]/i.test(prefix)
  ) {
    throw new Error("本次导入不接收 SVG，请先转换为 PNG");
  }

  let bitmap;

  try {
    bitmap = await createImageBitmap(blob);

    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error("图片像素过大，请先压缩");
    }

    const scale = Math.min(
      1,
      2400 / Math.max(bitmap.width, bitmap.height)
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建图片画布");

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const png = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (value) => value
          ? resolve(value)
          : reject(new Error("图片转换失败")),
        "image/png"
      );
    });

    abortCheck(signal);

    return {
      blob: png,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap?.close();
  }
}

function createContext(file, files, signal, report) {
  return {
    file,
    signal,
    report,
    lookup: createFileLookup(files),
    assets: [],
    bytes: 0,
    nodes: 0,
    warn(message) {
      report.warnings.push(message);
    },
    count() {
      this.nodes++;
      if (this.nodes > MAX_NODES) {
        throw new Error("文档节点过多，请拆分后导入");
      }
    },
    async addImage(blob, name, dimensions = null) {
      abortCheck(signal);

      if (this.assets.length >= MAX_IMAGES) {
        throw new Error("单篇文档图片超过 300 张");
      }

      const prepared = dimensions || await imageToPng(blob, signal);
      const output = prepared.blob;

      this.bytes += output.size;
      if (this.bytes > MAX_ASSETS) {
        throw new Error("单篇文档图片总量超过 64MB");
      }

      const id = uid("focus-import-image");
      const now = new Date().toISOString();

      this.assets.push({
        id,
        documentId: null,
        name,
        type: "image/png",
        size: output.size,
        blob: output,
        createdAt: now,
        updatedAt: now,
      });

      return {
        type: "focusImage",
        attrs: {
          assetId: id,
          alt: name || "导入图片",
          title: "",
          width: "100%",
          originalWidth: prepared.width,
          originalHeight: prepared.height,
        },
      };
    },
  };
}

/**
 * Markdown 扩展块：
 * :::focusCallout {tone="warning"}
 * 正文
 * :::
 *
 * 不开启原始 HTML，避免 Markdown 文件直接注入富文本结构。
 */
function markdownRenderer() {
  const md = new MarkdownIt({
    html: false,
    linkify: false,
    typographer: false,
  });

  md.block.ruler.before("fence", "focus_callout", (
    state,
    startLine,
    endLine,
    silent
  ) => {
    const first = state.src.slice(
      state.bMarks[startLine] + state.tShift[startLine],
      state.eMarks[startLine]
    );

    const open = first.match(
      /^:::focusCallout(?:\s+\{([^}]*)\})?\s*$/
    );

    if (!open) return false;

    let closeLine = -1;
    let fence = null;

    for (let line = startLine + 1; line < endLine; line++) {
      const text = state.src.slice(
        state.bMarks[line] + state.tShift[line],
        state.eMarks[line]
      );

      const fenced = text.match(/^(`{3,}|~{3,})/);

      if (fenced) {
        if (!fence) fence = fenced[1][0];
        else if (fenced[1][0] === fence) fence = null;
      }

      if (!fence && /^:::\s*$/.test(text)) {
        closeLine = line;
        break;
      }
    }

    if (closeLine < 0) return false;
    if (silent) return true;

    const tone = normalizeCalloutTone(
      open[1]?.match(/tone\s*=\s*["']([^"']+)["']/)?.[1]
    );

    const token = state.push("focus_callout", "", 0);
    token.content = state.getLines(
      startLine + 1,
      closeLine,
      state.blkIndent,
      false
    );
    token.meta = { tone };
    state.line = closeLine + 1;

    return true;
  });

  md.renderer.rules.focus_callout = (tokens, index) => {
    const token = tokens[index];
    return (
      `<aside data-type="focus-callout" data-tone="${token.meta.tone}">` +
      md.render(token.content) +
      "</aside>\n"
    );
  };

  return md;
}

const md = markdownRenderer();

function cleanHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "del",
      "code", "pre", "br", "hr", "a", "img",
      "ul", "ol", "li", "blockquote",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th",
      "div", "span", "aside", "sup", "sub", "mark",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "start", "class",
      "data-type", "data-tone",
    ],
    ALLOW_DATA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
}

async function convertHtml(html, context) {
  const fragment = cleanHtml(html);

  const visitInline = async (node, marks = []) => {
    context.count();
    abortCheck(context.signal);

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent
        ? [{ type: "text", text: node.textContent, marks }]
        : [];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const tag = node.tagName.toLowerCase();

    if (tag === "br") return [{ type: "hardBreak" }];

    if (tag === "img") {
      return [{
        type: "__importImage",
        source: node.getAttribute("src") || "",
        label: node.getAttribute("alt") || "导入图片",
      }];
    }

    const next = [...marks];
    const markTypes = {
      strong: "bold",
      b: "bold",
      em: "italic",
      i: "italic",
      u: "underline",
      s: "strike",
      del: "strike",
      code: "code",
    };

    const markType = markTypes[tag];

    if (markType && !next.some((mark) => mark.type === markType)) {
      next.push({ type: markType });
    }

    if (tag === "a") {
      const href = safeLink(node.getAttribute("href"));
      if (href) {
        next.push({ type: "link", attrs: { href } });
      } else {
        context.warn("一个链接使用了不支持的地址，已保留文字并移除链接");
      }
    }

    const output = [];

    for (const child of node.childNodes) {
      output.push(...await visitInline(child, next));
    }

    return output;
  };

  const convertImage = async (item) => {
    try {
      let blob;

      if (item.source.startsWith("data:")) {
        blob = readDataImage(item.source);
      } else {
        const local = resolveLocalImage(
          item.source,
          context.file,
          context.lookup
        );

        if (!local) {
          throw new Error(
            /^https?:|^\/\//i.test(item.source)
              ? "远程图片未自动下载"
              : "未找到用户所选目录中的对应图片"
          );
        }

        blob = local;
      }

      return await context.addImage(blob, item.label);
    } catch (error) {
      if (error?.name === "AbortError") throw error;

      const message =
        `图片「${item.label}」：${error.message}；` +
        `来源：${item.source.startsWith("data:") ? "内嵌图片" : item.source}`;

      context.warn(message);
      return paragraph(`[图片未导入] ${message}`);
    }
  };

  const inlineBlocks = async (element, type = "paragraph", attrs = null) => {
    const inline = [];

    for (const child of element.childNodes) {
      inline.push(...await visitInline(child));
    }

    const output = [];
    let buffer = [];

    const flush = () => {
      if (!buffer.length) return;

      output.push({
        type,
        ...(attrs ? { attrs } : {}),
        content: buffer,
      });

      buffer = [];
    };

    for (const item of inline) {
      if (item.type === "__importImage") {
        flush();
        output.push(await convertImage(item));
      } else {
        buffer.push(item);
      }
    }

    flush();

    return output.length ? output : [paragraph()];
  };

  const childrenBlocks = async (parent) => {
    const output = [];

    for (const child of parent.childNodes) {
      output.push(...await visitBlock(child));
    }

    return output;
  };

  const visitBlock = async (node) => {
    context.count();
    abortCheck(context.signal);

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim()
        ? [paragraph(node.textContent)]
        : [];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const tag = node.tagName.toLowerCase();

    if (tag === "img") {
      return [await convertImage({
        source: node.getAttribute("src") || "",
        label: node.getAttribute("alt") || "导入图片",
      })];
    }

    if (tag === "p") return inlineBlocks(node);

    if (/^h[1-6]$/.test(tag)) {
      return inlineBlocks(node, "heading", {
        level: Math.min(Number(tag.slice(1)), 3),
      });
    }

    if (tag === "pre") {
      const code = node.querySelector("code");
      const language =
        code?.className?.match(/language-([\w+-]+)/)?.[1] || "plaintext";

      return [{
        type: "codeBlock",
        attrs: { language },
        content: node.textContent
          ? [{ type: "text", text: node.textContent }]
          : [],
      }];
    }

    if (tag === "hr") return [{ type: "horizontalRule" }];

    if (tag === "ul" || tag === "ol") {
      const items = [];

      for (const child of node.children) {
        if (child.tagName.toLowerCase() !== "li") continue;

        let content = await childrenBlocks(child);
        if (content[0]?.type !== "paragraph") {
          content.unshift(paragraph());
        }

        items.push({ type: "listItem", content });
      }

      if (!items.length) return [];

      return [{
        type: tag === "ul" ? "bulletList" : "orderedList",
        ...(tag === "ol"
          ? { attrs: { start: Number(node.getAttribute("start")) || 1 } }
          : {}),
        content: items,
      }];
    }

    if (tag === "blockquote") {
      let content = await childrenBlocks(node);
      if (!content.length) content = [paragraph()];

      const firstText = textOf(content[0]);
      const alert = firstText.match(
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i
      );

      if (alert) {
        const tones = {
          NOTE: "info",
          TIP: "tip",
          IMPORTANT: "danger",
          WARNING: "warning",
          CAUTION: "danger",
        };

        const remaining = firstText.slice(alert[0].length);
        content = [
          ...(remaining ? [paragraph(remaining)] : []),
          ...content.slice(1),
        ];

        return [{
          type: "focusCallout",
          attrs: { tone: tones[alert[1].toUpperCase()] },
          content: content.length ? content : [paragraph()],
        }];
      }

      return [{ type: "blockquote", content }];
    }

    if (
      tag === "aside" &&
      node.getAttribute("data-type") === "focus-callout"
    ) {
      const content = await childrenBlocks(node);

      return [{
        type: "focusCallout",
        attrs: {
          tone: normalizeCalloutTone(node.getAttribute("data-tone")),
        },
        content: content.length ? content : [paragraph()],
      }];
    }

    if (tag === "table") {
      context.warn("表格已按行转换为文本；当前编辑器不支持表格节点");

      const rows = [];

      for (const row of node.querySelectorAll("tr")) {
        const output = [];

        for (const cell of row.children) {
          if (!["TD", "TH"].includes(cell.tagName)) continue;

          if (output.length) {
            output.push({
              type: "paragraph",
              content: [{ type: "text", text: "｜" }],
            });
          }

          const blocks = await childrenBlocks(cell);
          output.push(...blocks);
        }

        // 用一个段落保留行文字，图片单独保留为图片节点。
        const texts = output
          .filter((item) => item.type !== "focusImage")
          .map(textOf)
          .join(" ");

        rows.push(paragraph(texts));
        rows.push(...output.filter((item) => item.type === "focusImage"));
      }

      return rows;
    }

    if (
      ["strong", "b", "em", "i", "u", "s", "del", "a", "code", "span"].includes(tag)
    ) {
      return inlineBlocks(node);
    }

    return childrenBlocks(node);
  };

  const content = await childrenBlocks(fragment);

  return {
    type: "doc",
    content: content.length ? content : [paragraph()],
  };
}

async function convertDocx(file, signal) {
  abortCheck(signal);
  const buffer = await file.arrayBuffer();
  abortCheck(signal);

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/focusDocxImport.worker.js", import.meta.url),
      { type: "module" }
    );

    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      error ? reject(error) : resolve(result);
    };

    const onAbort = () =>
      finish(new DOMException("已取消解析", "AbortError"));

    const timer = setTimeout(
      () => finish(new Error("Word 解析超过 30 秒，请拆分文件")),
      30000
    );

    worker.onmessage = (event) => {
      event.data.ok
        ? finish(null, event.data)
        : finish(new Error(event.data.error));
    };

    worker.onerror = () => finish(new Error("Word 解析 Worker 发生错误"));
    signal?.addEventListener("abort", onAbort, { once: true });

    worker.postMessage({ buffer }, [buffer]);
  });
}

async function convertPdf(file, context, options) {
  const data = new Uint8Array(await file.arrayBuffer());
  abortCheck(context.signal);

  const task = pdfjs.getDocument({
    data,
    password: options.pdfPassword || undefined,
    isEvalSupported: false,
  });

  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    task.destroy();
  }, 120000);

  const onAbort = () => task.destroy();
  context.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const pdf = await task.promise;

    if (pdf.numPages > MAX_PAGES) {
      throw new Error("PDF 超过 100 页，请拆分后导入");
    }

    const content = [];
    const mode = options.pdfMode || "both";
    let textPages = 0;

    for (let index = 1; index <= pdf.numPages; index++) {
      abortCheck(context.signal);

      const page = await pdf.getPage(index);

      content.push({
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: `第 ${index} 页` }],
      });

      if (mode !== "images") {
        const extracted = await page.getTextContent();
        const lines = [];
        let current = "";
        let lastY = null;

        extracted.items.forEach((item) => {
          if (typeof item.str !== "string") return;

          const y = item.transform?.[5];

          if (
            current &&
            lastY !== null &&
            Number.isFinite(y) &&
            Math.abs(y - lastY) > 3
          ) {
            lines.push(current.trim());
            current = "";
          }

          current += item.str + (item.hasEOL ? "\n" : " ");

          if (item.hasEOL) {
            lines.push(current.trim());
            current = "";
          }

          lastY = y;
        });

        if (current.trim()) lines.push(current.trim());

        const usable = lines.filter(Boolean);
        if (usable.length) textPages++;

        usable.forEach((line) => content.push(paragraph(line)));
      }

      if (mode !== "text") {
        const natural = page.getViewport({ scale: 1 });
        const scale = Math.min(
          2,
          1600 / Math.max(natural.width, natural.height)
        );

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));

        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) throw new Error("无法创建 PDF 页面画布");

        await page.render({
          canvasContext,
          viewport,
          background: "rgb(255,255,255)",
        }).promise;

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (value) => value
              ? resolve(value)
              : reject(new Error("PDF 页面图片生成失败")),
            "image/png"
          );
        });

        content.push(await context.addImage(
          blob,
          `${file.name} · 第 ${index} 页`,
          { blob, width: canvas.width, height: canvas.height }
        ));

        canvas.width = 1;
        canvas.height = 1;
      }

      page.cleanup();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (mode !== "images" && textPages === 0) {
      context.warn("未提取到可用文字；这可能是扫描 PDF，本次未执行 OCR");

      if (mode === "text") {
        throw new Error("没有可编辑文字，请改用页面图像模式");
      }
    }

    context.warn(
      mode === "text"
        ? "PDF 文字按页提取，多栏阅读顺序、表格及公式可能需要整理"
        : "PDF 图片为整页渲染，不是可编辑表格或单独提取的内嵌图片"
    );

    return { type: "doc", content };
  } catch (error) {
    abortCheck(context.signal);

    if (timedOut) {
      throw new Error("PDF 解析超过 120 秒，请拆分文件");
    }

    if (error?.name === "PasswordException") {
      throw new Error("PDF 需要正确密码，请填写密码后重新解析");
    }

    throw error;
  } finally {
    clearTimeout(timer);
    context.signal?.removeEventListener("abort", onAbort);
    await task.destroy();
  }
}

function restoreTaskLists(node) {
  (node.content || []).forEach(restoreTaskLists);

  if (node.type !== "bulletList") return;

  const matched = (node.content || []).every((item) => {
    const firstText = item.content?.[0]?.content?.[0];
    return (
      firstText?.type === "text" &&
      /^\[[ xX]\]\s/.test(firstText.text)
    );
  });

  if (!matched || !node.content?.length) return;

  node.type = "taskList";

  node.content.forEach((item) => {
    const firstText = item.content[0].content[0];
    const checked = /^\[[xX]\]/.test(firstText.text);
    firstText.text = firstText.text.replace(/^\[[ xX]\]\s*/, "");

    if (!firstText.text) item.content[0].content.shift();

    item.type = "taskItem";
    item.attrs = { checked };
  });
}

function walkNodes(node, callback) {
  callback(node);
  (node.content || []).forEach((child) => walkNodes(child, callback));
}

export function summarizeImportedContent(node) {
  const lines = [];

  walkNodes(node, (item) => {
    if (["paragraph", "heading", "codeBlock"].includes(item.type)) {
      const text = textOf(item);
      if (text) lines.push(text);
    }
  });

  return lines.join("\n\n");
}

export function isImportDocument(file) {
  return /\.(md|markdown|txt|docx|pdf)$/i.test(file.name);
}

export async function parseImportFile(file, options = {}) {
  const report = { warnings: [] };

  if (file.size > MAX_FILE) {
    throw new Error("单个源文件不能超过 25MB");
  }

  if (/\.doc$/i.test(file.name)) {
    throw new Error("旧版 .doc 请先另存为 .docx");
  }

  if (!isImportDocument(file)) {
    throw new Error("只支持 Markdown、TXT、DOCX、PDF");
  }

  const context = createContext(
    file,
    options.files || [file],
    options.signal,
    report
  );

  let content;

  if (/\.pdf$/i.test(file.name)) {
    content = await convertPdf(file, context, options);
  } else if (/\.docx$/i.test(file.name)) {
    const converted = await convertDocx(file, options.signal);
    report.warnings.push(...converted.warnings);
    content = await convertHtml(converted.html, context);
  } else {
    const bytes = await file.arrayBuffer();
    abortCheck(options.signal);

    let source;

    try {
      source = new TextDecoder(options.encoding || "utf-8", {
        fatal: true,
      }).decode(bytes);
    } catch {
      throw new Error("文本编码不匹配，请切换 UTF-8 / GB18030 后重试");
    }

    if (source.includes("\u0000")) {
      throw new Error("文本文件含有异常二进制内容");
    }

    content = /\.txt$/i.test(file.name)
      ? {
          type: "doc",
          content: source.split(/\r?\n/).map(paragraph),
        }
      : await convertHtml(md.render(source), context);

    restoreTaskLists(content);
  }

  let count = 0;
  walkNodes(content, () => count++);

  if (count > MAX_NODES) {
    throw new Error("文档节点超过 50000，请拆分后导入");
  }

  return {
    title: file.name.replace(/\.(md|markdown|txt|docx|pdf)$/i, "").slice(0, 120),
    content,
    assets: context.assets,
    warnings: [...new Set(report.warnings)],
    sourceName: file.name,
    preview: summarizeImportedContent(content),
  };
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = dbRepository.open();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function uniqueTitle(title, folderId, taken) {
  const base = String(title || "未命名文档").trim().slice(0, 110) ||
    "未命名文档";

  let candidate = base;
  let index = 2;
  const key = (value) => `${folderId || "__root__"}\0${value}`;

  while (taken.has(key(candidate))) {
    candidate = `${base}（${index++}）`;
  }

  taken.add(key(candidate));
  return candidate;
}

async function sha256(blob) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer()
  );

  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 不调用逐个 saveDocument，避免“文档成功、图片失败”的中间态。
 * 首版每篇导入文档也在同一个事务中写一条初始修订。
 */
export async function commitImportBatch(drafts, folderId = null) {
  if (!drafts.length) throw new Error("没有可导入的文档");

  if (
    folderId &&
    !focusFolderService.listFolders().some((folder) => folder.id === folderId)
  ) {
    throw new Error("目标目录已被删除，请重新选择");
  }

  const existing = await focusDocumentService.listDocuments({
    includeArchived: true,
    includeDeleted: true,
  });

  const taken = new Set(
    existing.map((item) => `${item.folderId || "__root__"}\0${item.title}`)
  );

  const documents = [];
  const assets = [];
  const assetHashes = new Map();
  let totalBytes = 0;

  for (const draft of drafts) {
    const document = focusDocumentService.buildRecord(folderId, {
      title: uniqueTitle(draft.title, folderId, taken),
      content: draft.content,
    });

    const remap = new Map();

    for (const asset of draft.assets) {
      const hash = await sha256(asset.blob);
      let savedId = assetHashes.get(hash);

      if (!savedId) {
        savedId = asset.id;
        assetHashes.set(hash, savedId);

        totalBytes += asset.blob.size;

        assets.push({
          ...asset,
          documentId: document.id,
          size: asset.blob.size,
        });
      }

      remap.set(asset.id, savedId);
    }

    walkNodes(document.content, (node) => {
      if (node.type === "focusImage" && remap.has(node.attrs?.assetId)) {
        node.attrs.assetId = remap.get(node.attrs.assetId);
      }
    });

    documents.push(document);
  }

  if (totalBytes > MAX_ASSETS) {
    throw new Error("本次导入图片总量超过 64MB，请减少文件或 PDF 页面");
  }

  const estimate = await navigator.storage?.estimate?.();

  if (
    estimate?.quota &&
    estimate.quota - (estimate.usage || 0) < totalBytes * 1.5 + MB
  ) {
    throw new Error("本地可用存储空间不足");
  }

  const db = await openDatabase();

  await new Promise((resolve, reject) => {
    let transaction;

    try {
      transaction = db.transaction(
        ["focus_documents", "focus_assets", "focus_document_revisions"],
        "readwrite"
      );

      const docStore = transaction.objectStore("focus_documents");
      const assetStore = transaction.objectStore("focus_assets");
      const revisionStore = transaction.objectStore("focus_document_revisions");

      documents.forEach((document) => {
        docStore.add(document, document.id);

        const revision = {
          id: uid("focus-import-revision"),
          documentId: document.id,
          title: document.title,
          content: document.content,
          createdAt: document.createdAt,
        };

        revisionStore.add(revision, revision.id);
      });

      assets.forEach((asset) => assetStore.add(asset, asset.id));

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onabort = () => {
        const error = transaction.error;
        db.close();
        reject(
          error?.name === "QuotaExceededError"
            ? new Error("存储空间不足，本次导入已全部回滚")
            : error || new Error("导入失败，本次写入已全部回滚")
        );
      };

      transaction.onerror = () => {
        // 默认错误行为会中止事务，统一由 onabort 完成清理与报错。
      };
    } catch (error) {
      try {
        transaction?.abort();
      } catch {
        // 尚未建立事务时无需中止。
      }

      db.close();
      reject(error);
    }
  });

  window.dispatchEvent(new CustomEvent("weektodo:focus-refresh"));
  return documents;
}
