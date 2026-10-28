#!/usr/bin/env python3
"""FOCUS_EDITOR_ENHANCE_20261028_V1 —— 标题 H1-H6 + 折叠 / @日期 / 图片复制下载 / 模糊匹配 / 序号续写修复"""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path("/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main")

def patch(rel, old, new):
    p = ROOT / rel
    s = p.read_text("utf-8")
    if new in s:
        print(f"  · 跳过（已应用） {rel}")
        return
    if old not in s:
        sys.exit(f"[FAIL] {rel} 未找到锚点：\n{old[:120]}")
    p.write_text(s.replace(old, new, 1), "utf-8")
    print(f"  ✓ {rel}")

def rpatch(rel, pattern, new, marker):
    p = ROOT / rel
    s = p.read_text("utf-8")
    if marker in s:
        print(f"  · 跳过（已应用） {rel}")
        return
    s2, n = re.subn(pattern, lambda _m: new, s, count=1, flags=re.S)
    if not n:
        sys.exit(f"[FAIL] {rel} 未匹配：{pattern[:80]}")
    p.write_text(s2, "utf-8")
    print(f"  ✓ {rel}")

# 0. 新增文件存在性检查
NEW_FILES = [
    "src/editor/fuzzyMatch.js",
    "src/editor/imageClipboard.js",
    "src/editor/extensions/HeadingFold.js",
    "src/editor/extensions/DateMention.js",
    "src/editor/extensions/focusEditorEnhance.css",
]
missing = [f for f in NEW_FILES if not (ROOT / f).exists()]
if missing:
    sys.exit("[FAIL] 请先创建新增文件：\n  " + "\n  ".join(missing))

ED = "src/views/focusDocuments/FocusDocumentEditor.vue"
TB = "src/views/focusDocuments/FocusEditorToolbar.vue"
SF = "src/editor/extensions/SmartFormatting.js"
SC = "src/editor/extensions/SlashCommands.js"
SI = "src/editor/slashCommandItems.js"
FI = "src/editor/extensions/FocusImage.js"

print("1) 标题层级 1–6 + 注册扩展")
patch(ED, "heading: { levels: [1, 2, 3] },", "heading: { levels: [1, 2, 3, 4, 5, 6] },")
patch(ED, "for (const level of [1, 2, 3]) {", "for (const level of [1, 2, 3, 4, 5, 6]) {")
patch(ED,
    'import SmartFormatting from "../../editor/extensions/SmartFormatting";',
    'import SmartFormatting from "../../editor/extensions/SmartFormatting";\n'
    '/* FOCUS_EDITOR_ENHANCE_20261028_V1 */\n'
    'import HeadingFold from "../../editor/extensions/HeadingFold";\n'
    'import DateMention from "../../editor/extensions/DateMention";\n'
    'import { copyImageAsset, downloadImageAsset } from "../../editor/imageClipboard";')
patch(ED, "        SmartFormatting,\n",
          "        SmartFormatting,\n        HeadingFold,\n        DateMention,\n")

print("2) 图片预览：复制 / 下载")
patch(ED,
    "              <small>{{ imagePreviewMeta }}</small>\n            </div>\n",
    "              <small>{{ imagePreviewMeta }}</small>\n            </div>\n"
    '            <button type="button" class="focus-image-preview-action" @click="copyPreviewImage">{{ previewCopyLabel }}</button>\n'
    '            <button type="button" class="focus-image-preview-action" @click="downloadPreviewImage">下载</button>\n')
patch(ED, "      assetPruneTimer: null,\n    };",
          "      assetPruneTimer: null,\n      imagePreviewDetail: null,\n      previewCopyLabel: \"复制\",\n    };")
patch(ED,
    '      this.imagePreviewVisible = true;\n      this.imagePreviewName =\n        detail.alt || detail.title || "图片预览";',
    '      this.imagePreviewVisible = true;\n      this.imagePreviewDetail = detail;\n      this.imagePreviewName =\n        detail.alt || detail.title || "图片预览";')
patch(ED, "    closeImagePreview() {\n",
'''    /* FOCUS_EDITOR_ENHANCE_20261028_V1 */
    async copyPreviewImage() {
      try {
        await copyImageAsset(this.imagePreviewDetail);
        this.previewCopyLabel = "已复制";
      } catch (error) {
        window.alert(error?.message || "复制失败");
      }
      setTimeout(() => { this.previewCopyLabel = "复制"; }, 1500);
    },

    async downloadPreviewImage() {
      try {
        await downloadImageAsset(this.imagePreviewDetail);
      } catch (error) {
        window.alert(error?.message || "下载失败");
      }
    },

    closeImagePreview() {
''')

print("3) 工具栏：H4–H6")
patch(TB,
    '  { value: "h3", label: "三级标题", preview: "fx-preview-h3" },\n',
    '  { value: "h3", label: "三级标题", preview: "fx-preview-h3" },\n'
    '  { value: "h4", label: "四级标题", preview: "fx-preview-h4" },\n'
    '  { value: "h5", label: "五级标题", preview: "fx-preview-h5" },\n'
    '  { value: "h6", label: "六级标题", preview: "fx-preview-h6" },\n')
patch(TB, ".fx-preview-h3 { font-size: 13.5px; font-weight: 640; }",
          ".fx-preview-h3 { font-size: 13.5px; font-weight: 640; }\n"
          ".fx-preview-h4 { font-size: 13px; font-weight: 620; }\n"
          ".fx-preview-h5 { font-size: 12.5px; font-weight: 600; }\n"
          ".fx-preview-h6 { font-size: 12px; font-weight: 600; color: #6a717b; }")

print("4) 序号续写：日期 / 版本号 / 小数不再误判；保留前导零")
rpatch(SF, r"function incrementDecimalPath\(value\) \{.*?\n\}\n",
'''function incrementDecimalPath(value) {
  /* FOCUS_EDITOR_ENHANCE_20261028_V1：保留前导零（01 → 02） */
  const parts = String(value).split(".");
  if (!parts.length || parts.some((p) => !/^\\d+$/.test(p))) return null;
  const last = parts[parts.length - 1];
  const next = String(Number(last) + 1);
  parts[parts.length - 1] =
    last.length > 1 && last.startsWith("0") ? next.padStart(last.length, "0") : next;
  return parts.join(".");
}
''', "保留前导零（01 → 02）")
patch(SF,
r'''  let match = value.match(
    /^(\s*)(\d+(?:\.\d+)*)([.．、])\s*(.+)$/
  );

  if (match) {
''',
r'''  /* FOCUS_EDITOR_ENHANCE_20261028_V1：分隔符后紧跟数字（2016.01.01 / 1.5倍 / v1.2.3）不是序号 */
  let match = value.match(
    /^(\s*)(\d+(?:\.\d+)*)([.．、])(?!\d)\s*(.+)$/
  );

  if (match && match[2].split(".")[0].length >= 4) {
    return null; // 年份样式（2016. / 2016.01.）不续号
  }

  if (match) {
''')

print("5) / 、 命令：模糊匹配")
patch(SC, 'import { shift } from "@floating-ui/dom";',
          'import { shift } from "@floating-ui/dom";\nimport { fuzzyFilter } from "../fuzzyMatch";')
rpatch(SC, r"function filterItems\(items, query\) \{.*?\n\}\n",
'''function filterItems(items, query) {
  /* FOCUS_EDITOR_ENHANCE_20261028_V1：精确 > 前缀 > 包含 > 子序列，数字⇄中文数字 */
  return fuzzyFilter(items, query, (item) => [
    item.title,
    item.shortcut,
    ...(item.aliases || []),
    item.description,
  ]);
}
''', "FOCUS_EDITOR_ENHANCE_20261028_V1：精确")

print("6) / 菜单：正文 + 标题 1–6")
patch(SI, "export function createSlashCommandItems(",
'''/* FOCUS_EDITOR_ENHANCE_20261028_V1：标题项，支持 /3、/h3、/bt3、/三级、/### */
const CN_LEVEL = ["", "一", "二", "三", "四", "五", "六"];

function headingItems() {
  const items = [1, 2, 3, 4, 5, 6].map((level) => ({
    id: `heading-${level}`,
    category: "标题",
    title: `标题${level}`,
    description: `${CN_LEVEL[level]}级标题 · ${"#".repeat(level)} 空格 · ⌘⌥${level}`,
    icon: `H${level}`,
    shortcut: `/bt${level}`,
    aliases: [
      `h${level}`, String(level), `标题${level}`, `${CN_LEVEL[level]}级标题`,
      `bt${level}`, "#".repeat(level), "heading", "标题",
    ],
    command: ({ editor, range }) =>
      base(editor, range).setNode("heading", { level }).run(),
  }));

  items.unshift({
    id: "paragraph",
    category: "标题",
    title: "正文",
    description: "转为普通段落 · ⌘⌥0",
    icon: "T",
    shortcut: "/zw",
    aliases: ["paragraph", "text", "正文", "zw", "p"],
    command: ({ editor, range }) => base(editor, range).setParagraph().run(),
  });

  return items;
}

export function createSlashCommandItems(''')
patch(SI, "        base(editor, range).setHorizontalRule().run(),\n    },\n  ];",
          "        base(editor, range).setHorizontalRule().run(),\n    },\n    ...headingItems(),\n  ];")

print("7) 图片：⌘C 复制 + 工具条复制/下载")
patch(FI, 'import "./focusImage.css";',
          'import "./focusImage.css";\nimport { copyImageAsset, downloadImageAsset } from "../imageClipboard";')
patch(FI, "  remove: '<path",
          "  copy: '<rect x=\"5.5\" y=\"5.5\" width=\"8\" height=\"8\" rx=\"1.5\" /><path d=\"M3.5 10.5h-.5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1v.5\" />',\n"
          "  download: '<path d=\"M8 2.5v8M4.75 7.5 8 10.75l3.25-3.25M3 13.5h10\" />',\n"
          "  remove: '<path")
patch(FI, '      const removeButton = iconButton("remove", "删除图片", "is-danger");',
          '      const removeButton = iconButton("remove", "删除图片", "is-danger");\n'
          '      const copyButton = iconButton("copy", "复制图片（⌘C）");\n'
          '      const downloadButton = iconButton("download", "下载到本地");')
patch(FI, "        captionButton,\n        previewButton,\n",
          "        captionButton,\n        previewButton,\n        copyButton,\n        downloadButton,\n")
patch(FI, '      removeButton.addEventListener("click", remove);',
'''      removeButton.addEventListener("click", remove);

      /* FOCUS_EDITOR_ENHANCE_20261028_V1 */
      const flash = (button) => {
        button.classList.add("is-done");
        setTimeout(() => button.classList.remove("is-done"), 1200);
      };
      copyButton.addEventListener("click", () =>
        copyImageAsset(current.attrs)
          .then(() => flash(copyButton))
          .catch((error) => window.alert(error?.message || "复制失败"))
      );
      downloadButton.addEventListener("click", () =>
        downloadImageAsset(current.attrs)
          .then(() => flash(downloadButton))
          .catch((error) => window.alert(error?.message || "下载失败"))
      );''')
patch(FI, "  addKeyboardShortcuts() {\n    return {\n",
'''  addKeyboardShortcuts() {
    return {
      /* FOCUS_EDITOR_ENHANCE_20261028_V1：选中图片 ⌘C → 系统剪贴板（PNG） */
      "Mod-c": () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
          return false;
        }
        copyImageAsset(selection.node.attrs).catch((error) =>
          window.alert(error?.message || "复制图片失败")
        );
        return true;
      },
''')

print("8) 提交并推送")
def git(*args):
    print("  $ git " + " ".join(args))
    subprocess.run(["git", *args], cwd=ROOT, check=True)

git("add", *NEW_FILES, ED, TB, SF, SC, SI, FI)
status = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
if status.returncode == 0:
    print("  · 没有需要提交的变更")
else:
    git("commit", "-m",
        "feat(focus): H1-H6 + 标题折叠、@插入日期、图片复制/下载、/命令模糊匹配、修复日期被误判为序号")
    git("push")
print("\n完成 ✅  运行 yarn electron:serve 验证")
