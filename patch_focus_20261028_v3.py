#!/usr/bin/env python3
"""FOCUS_POLISH_20261028_V3 —— 宽屏靠左+目录栏+去闪烁 / 思维导图尺寸手柄 / 目录 Pointer 拖拽 / 一批交互缺陷"""
import pathlib, re, subprocess, sys

ROOT = pathlib.Path("/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main")
TAG = "FOCUS_POLISH_20261028_V3"

def patch(rel, old, new):
    p = ROOT / rel
    s = p.read_text("utf-8")
    if new in s:
        print(f"  · 已应用  {rel}")
        return
    if old not in s:
        sys.exit(f"[FAIL] {rel} 未找到锚点：\n{old[:200]}")
    p.write_text(s.replace(old, new, 1), "utf-8")
    print(f"  ✓ {rel}")

def rsub(rel, pattern, new, marker):
    p = ROOT / rel
    s = p.read_text("utf-8")
    if marker in s:
        print(f"  · 已应用  {rel}")
        return
    s2, n = re.subn(pattern, lambda _m: new, s, count=1, flags=re.S)
    if not n:
        sys.exit(f"[FAIL] {rel} 未匹配：{pattern[:90]}")
    p.write_text(s2, "utf-8")
    print(f"  ✓ {rel}")

V = "src/views/focusDocuments/"
FILES = [
    V + "focusTreeDnd.js",
    V + "focusDirectoryEnhance.js",
    V + "focusDirectoryEnhance.css",
    V + "FocusDialogSidebar.vue",
    V + "focusDialogFocusMode.css",
    V + "focusMindMapResize.js",
    V + "focusMindMapResize.css",
    "scripts/verify-focus.mjs",
]
bad = [f for f in FILES if not (ROOT / f).exists() or TAG not in (ROOT / f).read_text("utf-8")]
if bad:
    sys.exit("[FAIL] 以下新增/覆盖文件缺失或仍是旧版本：\n  " + "\n  ".join(bad))

DLG = V + "FocusDocumentDialog.vue"
VIEW = V + "FocusDocumentsView.vue"
MM = V + "FocusMindMapNodeView.vue"
MMX = "src/editor/extensions/FocusMindMap.js"
DIR = V + "FocusDirectoryBrowser.vue"

# ───────────── 1. 全屏：宽屏靠左 + 目录栏 + 去闪烁 + Esc
print("1) 全屏专注模式")
patch(DLG, 'import FocusDocumentActionMenu from "./FocusDocumentActionMenu.vue";',
           'import FocusDocumentActionMenu from "./FocusDocumentActionMenu.vue";\n'
           '/* FOCUS_POLISH_20261028_V3 */\nimport FocusDialogSidebar from "./FocusDialogSidebar.vue";')
patch(DLG, "    FocusDocumentActionMenu,\n  },", "    FocusDocumentActionMenu,\n    FocusDialogSidebar,\n  },")
patch(DLG, """    <section
      class="focus-dialog"
      :class="{ 'is-wide': wide }"
      role="dialog\"""", """    <section
      class="focus-dialog"
      :class="{ 'is-wide': wide, 'has-sidebar': showSidebar }"
      :style="fdxStyle"
      role="dialog\"""")
patch(DLG, '      <nav class="fdx-tabs" role="tablist" aria-label="已分栏文档">\n',
           '''      <nav class="fdx-tabs" role="tablist" aria-label="已分栏文档">
        <button
          v-if="wide"
          type="button"
          class="fdx-sb-toggle"
          :class="{ 'is-on': sidebarOpen }"
          :title="(sidebarOpen ? '隐藏目录' : '显示目录') + '（⌘⇧\\\\）'"
          @click="toggleSidebar"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M6 2.5v11" /></svg>
        </button>
''')
patch(DLG, """          :class="{ 'is-active': tab.id === draft.id }\"""",
           """          :class="{ 'is-active': tab.id === draft.id, 'is-temp': !tabIds.includes(tab.id) }\"""")
patch(DLG, '        <span v-if="tabItems.length > 1" class="fdx-hint">⌘⇧[ / ] 切换</span>',
           '        <span class="fdx-hint">\n'
           '          <template v-if="tabItems.length > 1"><kbd>⌘⇧[</kbd><kbd>]</kbd> 切换<i>·</i></template>\n'
           '          <kbd>Esc</kbd> 退出\n'
           '        </span>')
patch(DLG, "      </nav>\n\n      <header>", '''      </nav>

      <FocusDialogSidebar
        v-if="showSidebar"
        :folders="folders"
        :documents="documents"
        :current-id="draft.id"
        :current-title="draft.title"
        :open-ids="tabIds"
        @select="switchTab"
        @resize="onSidebarResize"
      />

      <header>''')
patch(DLG, '          <FocusDocumentTitle\n            ref="title"',
           '          <FocusDocumentTitle\n            ref="title"\n            :key="\'title-\' + draft.id"')
patch(DLG, '      <FocusDocumentEditor\n        ref="editor"\n        v-model="draft.content"',
           '      <FocusDocumentEditor\n        ref="editor"\n        :key="draft.id"\n        v-model="draft.content"')
patch(DLG, "    tabs: { type: Array, default: () => [] },\n  },",
           "    tabs: { type: Array, default: () => [] },\n"
           "    documents: { type: Array, default: () => [] },\n  },")
patch(DLG, '      wide: localStorage.getItem("focusDialogWide") !== "false",\n    };',
           '      wide: localStorage.getItem("focusDialogWide") !== "false",\n'
           '      sidebarOpen: localStorage.getItem("focusDialogSidebar") !== "false",\n'
           '      sidebarWidth: Number(localStorage.getItem("focusDialogSidebarWidth")) || 248,\n    };')
patch(DLG, "  computed: {\n    /* FOCUS_POLISH_20261028_V2：当前文档始终在标签栏里，标题实时同步 */", '''  computed: {
    /* FOCUS_POLISH_20261028_V3 */
    tabIds() {
      return (this.tabs || []).map((tab) => tab.id);
    },

    showSidebar() {
      return this.wide && this.sidebarOpen;
    },

    fdxStyle() {
      return { "--fdx-sb": this.showSidebar ? `${this.sidebarWidth}px` : "0px" };
    },

    /* FOCUS_POLISH_20261028_V2：当前文档始终在标签栏里，标题实时同步 */''')
patch(DLG, "  watch: {\n    folderPanel(value) {", '''  watch: {
    /* FOCUS_POLISH_20261028_V3：切换文档只换内容，不重建全屏层（去闪烁、保留目录栏滚动） */
    document(next) {
      if (!next || next.id === this.draft.id) return;
      clearTimeout(this.timer);
      const draft = JSON.parse(JSON.stringify(next));
      draft.titleStyle = { ...DEFAULT_TITLE_STYLE, ...(draft.titleStyle || {}) };
      this.draft = draft;
      this.folderId = next.folderId || "__root__";
      this.dirty = false;
      this.saveState = "saved";
      this.tagEditing = false;
      this.actionMenuVisible = false;
      this.folderPanel = false;
      this.$nextTick(() => this.$refs.editor?.focus());
    },

    folderPanel(value) {''')
patch(DLG, "    toggleWide() {", '''    /* FOCUS_POLISH_20261028_V3 */
    toggleSidebar() {
      this.sidebarOpen = !this.sidebarOpen;
      localStorage.setItem("focusDialogSidebar", String(this.sidebarOpen));
    },

    onSidebarResize(width) {
      this.sidebarWidth = width;
      localStorage.setItem("focusDialogSidebarWidth", String(width));
    },

    toggleWide() {''')
patch(DLG, "      /* FOCUS_POLISH_20261028_V2：⌘⇧[ / ⌘⇧] 或 Ctrl+Tab 切换标签 */", '''      /* FOCUS_POLISH_20261028_V3：⌘⇧\\ 显示/隐藏目录栏 */
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "Backslash") {
        event.preventDefault();
        if (this.wide) this.toggleSidebar();
        return;
      }
      /* FOCUS_POLISH_20261028_V2：⌘⇧[ / ⌘⇧] 或 Ctrl+Tab 切换标签 */''')
patch(DLG, '      if (event.key !== "Escape") return;\n', '''      if (event.key !== "Escape") return;

      /* FOCUS_POLISH_20261028_V3：Esc 先交给菜单 / 弹层 / 编辑器，最后才退出全屏 */
      if (event.defaultPrevented) return;
      if (document.querySelector(
        ".focus-command-menu, .focus-image-preview-dialog, .focus-mind-map-fullscreen, " +
        ".dir-backdrop, .fx-pop, .focus-column-menu, .fmma-export-menu"
      )) return;
''')
patch(DLG, "    this.$refs.title?.focus();\n    window.addEventListener(\"keydown\", this.onKeydown);",
           "    /* FOCUS_POLISH_20261028_V3：已有标题时光标直接进正文 */\n"
           "    if (String(this.draft.title || \"\").trim()) this.$nextTick(() => this.$refs.editor?.focus());\n"
           "    else this.$refs.title?.focus();\n"
           "    window.addEventListener(\"keydown\", this.onKeydown);")
patch(DLG, "      try {\n        const saved =\n          await focusDocumentService.updateDocument(\n            this.draft.id,",
           "      /* FOCUS_POLISH_20261028_V3：保存竞态——完成时文档已切走则不回写 */\n"
           "      const savingId = this.draft.id;\n"
           "      try {\n        const saved =\n          await focusDocumentService.updateDocument(\n            savingId,")
patch(DLG, "        this.draft = {\n          ...saved,",
           "        if (this.draft.id !== savingId) {\n          this.$emit(\"saved\", saved);\n          return saved;\n        }\n\n"
           "        this.draft = {\n          ...saved,")

patch(VIEW, '      :key="dialogDocument.id"\n      :document="dialogDocument"\n      :tabs="dialogTabs"',
            '      :document="dialogDocument"\n      :tabs="dialogTabs"\n      :documents="documents"')

# ───────────── 2. 思维导图尺寸手柄
print("2) 思维导图尺寸手柄")
patch(MMX, "      nodeCount: {\n        default: 1,\n      },", '''      nodeCount: {
        default: 1,
      },

      /* FOCUS_POLISH_20261028_V3：画布自定义高度（px） */
      previewHeight: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute("data-preview-height")) || null,
        renderHTML: (attributes) =>
          attributes.previewHeight ? { "data-preview-height": attributes.previewHeight } : {},
      },''')
patch(MM, 'import "./focusMindMapMinimal.css";',
          'import "./focusMindMapMinimal.css";\n'
          '/* FOCUS_POLISH_20261028_V3 */\nimport { focusMindMapResizeMixin } from "./focusMindMapResize.js";')

# 注册 mixin：已有 mixins 数组就插到最前，没有则新增
mm_path = ROOT / MM
mm_src = mm_path.read_text("utf-8")
if "focusMindMapResizeMixin," not in mm_src:
    mm_new, n = re.subn(r"mixins:\s*\[", "mixins: [focusMindMapResizeMixin, ", mm_src, count=1)
    if not n:
        mm_new, n = re.subn(r"export default \{\n", "export default {\n  mixins: [focusMindMapResizeMixin],\n", mm_src, count=1)
    if not n:
        sys.exit(f"[FAIL] {MM} 无法注册 focusMindMapResizeMixin")
    mm_path.write_text(mm_new, "utf-8")
    print(f"  ✓ {MM}（mixin）")
else:
    print(f"  · 已应用  {MM}（mixin）")

patch(MM, """      'is-missing': Boolean(errorMessage),
    }\"""", """      'is-missing': Boolean(errorMessage),
      'is-resizing': Boolean(fmrDrag),
      'fmr-has-h': Boolean(fmrHeight),
    }"
    :style="fmrStyle\"""")
patch(MM, "    <!-- FOCUS_POLISH_20261028_V2：极简卡片——只留画布；悬停浮出操作 -->", '''    <!-- FOCUS_POLISH_20261028_V3：尺寸手柄（与图片一致） -->
    <span class="fmr-handle is-left" title="拖动调整宽度 · ⌥ 关闭吸附 · 双击还原" @pointerdown="fmrStart('left', $event)" @dblclick.stop="fmrReset"></span>
    <span class="fmr-handle is-right" title="拖动调整宽度 · ⌥ 关闭吸附 · 双击还原" @pointerdown="fmrStart('right', $event)" @dblclick.stop="fmrReset"></span>
    <span class="fmr-handle is-bottom" title="拖动调整高度 · 双击还原" @pointerdown="fmrStart('bottom', $event)" @dblclick.stop="fmrReset"></span>
    <span v-if="fmrDrag" class="fmr-badge">{{ fmrLabel }}</span>

    <!-- FOCUS_POLISH_20261028_V2：极简卡片——只留画布；悬停浮出操作 -->''')
patch(MM, '      <button type="button" class="fmm-card-action is-danger"', '''      <button v-if="fmrCustom" type="button" class="fmm-card-action" title="还原默认尺寸" @click.stop="fmrReset">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 0 1.8-4.3M4 4v3.5h3.5" /></svg>
      </button>
      <button type="button" class="fmm-card-action is-danger"''')

# ───────────── 3. 目录：HTML5 DnD → Pointer 拖拽
print("3) 目录 Pointer 拖拽")
patch(DIR, '''          :draggable="canDrag && editingKey !== row.key"
          @click="activeKey = row.key"
          @dblclick="onRowActivate(row)"
          @dragstart="fxDragStart(row, $event)"
          @dragend="fxDragEnd"
          @dragover.prevent.stop="fxRowDragOver(row, $event)"
          @dragleave.stop="fxRowDragLeave(row, $event)"
          @drop.prevent.stop="fxRowDrop(row, $event)"
          @contextmenu.prevent="fxContextMenu(row, $event)"''', '''          :data-key="row.key"
          @click="fxRowClick(row)"
          @dblclick="onRowActivate(row)"
          @pointerdown="fxPointerDown(row, $event)"
          @contextmenu.prevent="fxContextMenu(row, $event)"''')
patch(DIR, '''        @keydown="fxTreeKeydown"
        @dragover.prevent="fxTreeDragOver"
        @drop.prevent="fxRootDrop"''', '''        @keydown="fxTreeKeydown"''')
patch(DIR, '''          v-if="canManage && dragged && dragged.parentId"
          class="dir-root-drop"''', '''          v-if="canManage && dragged && dragged.parentId"
          data-root-drop
          class="dir-root-drop"''')

# ───────────── 4. 其他缺陷
print("4) 缺陷修复")
patch(DIR, '''        if (this.rowMenu.row) {
          this.closeRowMenu();
          return;
        }''', '''        /* FOCUS_POLISH_20261028_V3：Esc 先关 + 号菜单 */
        if (this.fxAddMenu && this.fxAddMenu.row) {
          this.fxAddMenu = { row: null, style: {} };
          return;
        }

        if (this.rowMenu.row) {
          this.closeRowMenu();
          return;
        }''')
patch(DIR, 'const height = row.type === "doc" ? 214 : 130;',
           'const height = row.type === "doc" ? 320 : 190; /* FOCUS_POLISH_20261028_V3 */')

# 把手留位，避免和折叠箭头重叠
css = ROOT / (V + "focusDirectoryEnhance.css")
css_src = css.read_text("utf-8")
if "/* V3-grip-gap */" not in css_src:
    css.write_text(css_src + "\n/* V3-grip-gap */\n.dir-dialog .dir-tree .dir-row { padding-left: calc(14px + var(--depth, 0) * 18px); }\n", "utf-8")
    print("  ✓ focusDirectoryEnhance.css（把手留位）")

# ───────────── 5. 自检 + 编译
print("5) 自检")
if subprocess.run(["node", "scripts/verify-focus.mjs"], cwd=ROOT).returncode != 0:
    sys.exit("[FAIL] 自检未通过，已停止提交")
print("6) 编译检查（electron-vite build）")
if subprocess.run(["yarn", "electron:compile"], cwd=ROOT).returncode != 0:
    sys.exit("[FAIL] 编译失败，已停止提交（把报错发给我）")

# ───────────── 6. 提交
print("7) 提交并推送")
def git(*args):
    print("  $ git " + " ".join(args))
    subprocess.run(["git", *args], cwd=ROOT, check=True)

git("add", *FILES, DLG, VIEW, MM, MMX, DIR)
if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
    print("  · 没有需要提交的变更")
else:
    git("commit", "-m",
        "feat(focus): 宽屏靠左+目录栏、切换去闪烁、Esc提示；思维导图尺寸手柄；目录Pointer拖拽重写；修复Esc误关/保存竞态/菜单溢出")
    git("push")
print("\n完成 ✅  运行 yarn electron:serve 手动验证")
