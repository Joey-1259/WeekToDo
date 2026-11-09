#!/usr/bin/env python3
"""FOCUS_POLISH_20261028_V2 —— 单一图片工具栏 / 专注模式标签页 / 菜单去重 / 思维导图极简 / 目录增强"""
import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path("/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main")

def patch(rel, old, new):
    p = ROOT / rel
    s = p.read_text("utf-8")
    if new in s:
        print(f"  · 已应用  {rel}")
        return
    if old not in s:
        sys.exit(f"[FAIL] {rel} 未找到锚点：\n{old[:160]}")
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

NEW = [
    "src/views/focusDocuments/focusDirectoryEnhance.js",
    "src/views/focusDocuments/focusDirectoryEnhance.css",
    "src/views/focusDocuments/focusDialogFocusMode.css",
    "src/views/focusDocuments/focusMindMapMinimal.css",
    "scripts/verify-focus.mjs",
]
missing = [f for f in NEW if not (ROOT / f).exists()]
if missing:
    sys.exit("[FAIL] 请先创建新增文件：\n  " + "\n  ".join(missing))

ED = "src/views/focusDocuments/FocusDocumentEditor.vue"
SC = "src/editor/extensions/SlashCommands.js"
DM = "src/editor/extensions/DateMention.js"
DLG = "src/views/focusDocuments/FocusDocumentDialog.vue"
VIEW = "src/views/focusDocuments/FocusDocumentsView.vue"
MM = "src/views/focusDocuments/FocusMindMapNodeView.vue"
DIR = "src/views/focusDocuments/FocusDirectoryBrowser.vue"

# ───────────────────────── 1. 图片：只保留一条工具栏
print("1) 气泡菜单仅在选中文字时出现")
patch(ED, 'import { Markdown } from "@tiptap/markdown";',
          'import { Markdown } from "@tiptap/markdown";\n'
          '/* FOCUS_POLISH_20261028_V2 */\nimport { NodeSelection } from "@tiptap/pm/state";')
patch(ED, """      :options="{ placement: 'top', offset: 8 }"
      class="focus-bubble\"""",
          """      :options="{ placement: 'top', offset: 8 }"
      :should-show="bubbleShouldShow"
      class="focus-bubble\"""")
patch(ED, '''    focus() {
      this.editor?.commands.focus("end");
    },''', '''    focus() {
      this.editor?.commands.focus("end");
    },

    /* FOCUS_POLISH_20261028_V2：图片 / 思维导图 / 代码块不弹文字格式栏 */
    bubbleShouldShow({ editor, view, state, from, to }) {
      const { selection } = state;
      if (!editor.isEditable || selection.empty) return false;
      if (selection instanceof NodeSelection) return false;
      if (editor.isActive("codeBlock")) return false;
      if (!state.doc.textBetween(from, to, " ").trim()) return false;
      const active = document.activeElement;
      return view.hasFocus() || Boolean(active?.closest?.(".focus-bubble"));
    },''')

# ───────────────────────── 2. 菜单只在焦点编辑器弹出
print("2) / 、 @ 菜单去重")
patch(SC, "    items: ({ query }) => filterItems(items, query),",
          "    /* FOCUS_POLISH_20261028_V2：分栏与全屏同开一篇文档时，后台编辑器同步内容后也会命中触发符 */\n"
          "    allow: ({ editor: host, state }) =>\n"
          "      host.view.hasFocus() && !state.selection.$from.parent.type.spec.code,\n"
          "    items: ({ query }) => filterItems(items, query),")
patch(DM, "        allow: ({ state }) => !state.selection.$from.parent.type.spec.code,",
          "        allow: ({ editor, state }) =>\n"
          "          editor.view.hasFocus() && !state.selection.$from.parent.type.spec.code,")

# ───────────────────────── 3. 全屏专注模式 + 标签页
print("3) 全屏专注模式")
patch(DLG, 'class="focus-dialog-backdrop"\n    role="presentation"',
           'class="focus-dialog-backdrop fdx-mode"\n    role="presentation"')
patch(DLG, '    <section\n      class="focus-dialog"\n      role="dialog"',
           '    <section\n      class="focus-dialog"\n      :class="{ \'is-wide\': wide }"\n      role="dialog"')
patch(DLG, '      aria-label="文档编辑"\n    >\n      <header>', '''      aria-label="文档编辑"
    >
      <!-- FOCUS_POLISH_20261028_V2：已分栏文档标签栏 -->
      <nav class="fdx-tabs" role="tablist" aria-label="已分栏文档">
        <button
          v-for="tab in tabItems"
          :key="tab.id"
          type="button"
          role="tab"
          class="fdx-tab"
          :class="{ 'is-active': tab.id === draft.id }"
          :aria-selected="String(tab.id === draft.id)"
          :title="tab.title || '未命名文档'"
          @click="switchTab(tab.id)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2H4.5A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V5.5Z" /><path d="M9.5 2v3.5H13" /></svg>
          <span>{{ tab.title || "未命名文档" }}</span>
        </button>
        <span class="fdx-tabs-spacer"></span>
        <span v-if="tabItems.length > 1" class="fdx-hint">⌘⇧[ / ] 切换</span>
        <button type="button" class="fdx-tool" :title="wide ? '切换为标准宽度（780px）' : '切换为宽屏（1180px）'" @click="toggleWide">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4v8M14 4v8M5 8h6M6.5 6.5 5 8l1.5 1.5M9.5 6.5 11 8l-1.5 1.5" /></svg>
          {{ wide ? "标准宽度" : "宽屏" }}
        </button>
      </nav>

      <header>''')
patch(DLG, "    folderPaths: { type: Object, default: () => ({}) },\n  },",
           "    folderPaths: { type: Object, default: () => ({}) },\n"
           "    /* FOCUS_POLISH_20261028_V2 */\n"
           "    tabs: { type: Array, default: () => [] },\n  },")
patch(DLG, '    "create-task",\n    "action",\n  ],', '    "create-task",\n    "action",\n    "switch",\n  ],')
patch(DLG, '      notice: "",\n      noticeTimer: null,\n    };',
           '      notice: "",\n      noticeTimer: null,\n'
           '      wide: localStorage.getItem("focusDialogWide") !== "false",\n    };')
patch(DLG, "  computed: {\n    statusLabel() {", '''  computed: {
    /* FOCUS_POLISH_20261028_V2：当前文档始终在标签栏里，标题实时同步 */
    tabItems() {
      const list = (this.tabs || []).map((tab) =>
        tab.id === this.draft.id ? { ...tab, title: this.draft.title } : tab
      );
      if (!list.some((tab) => tab.id === this.draft.id)) {
        list.unshift({ id: this.draft.id, title: this.draft.title });
      }
      return list;
    },

    statusLabel() {''')
patch(DLG, "  methods: {\n    /* FMM_ENHANCE_20260923_V3 · 全屏态「更多操作」 */", '''  methods: {
    /* FOCUS_POLISH_20261028_V2 · 标签切换：先落盘再切换 */
    async switchTab(id) {
      if (!id || id === this.draft.id) return;
      try {
        await this.flush();
      } catch {
        if (!window.confirm("当前内容保存失败，仍要切换吗？")) return;
      }
      this.$emit("switch", id);
    },

    stepTab(delta) {
      const list = this.tabItems;
      if (list.length < 2) return;
      const index = list.findIndex((tab) => tab.id === this.draft.id);
      const next = list[(index + delta + list.length) % list.length];
      if (next) this.switchTab(next.id);
    },

    toggleWide() {
      this.wide = !this.wide;
      localStorage.setItem("focusDialogWide", String(this.wide));
    },

    /* FMM_ENHANCE_20260923_V3 · 全屏态「更多操作」 */''')
patch(DLG, "    onKeydown(event) {\n", '''    onKeydown(event) {
      /* FOCUS_POLISH_20261028_V2：⌘⇧[ / ⌘⇧] 或 Ctrl+Tab 切换标签 */
      if ((event.metaKey || event.ctrlKey) && event.shiftKey &&
          (event.code === "BracketLeft" || event.code === "BracketRight")) {
        event.preventDefault();
        this.stepTab(event.code === "BracketRight" ? 1 : -1);
        return;
      }
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        this.stepTab(event.shiftKey ? -1 : 1);
        return;
      }
''')
patch(DLG, 'import focusFolderService from "../../services/focusFolderService";',
           'import focusFolderService from "../../services/focusFolderService";\n'
           '/* FOCUS_POLISH_20261028_V2 */\nimport "./focusDialogFocusMode.css";')

patch(VIEW, '    <FocusDocumentDialog\n      v-if="dialogDocument"\n      :document="dialogDocument"',
            '    <FocusDocumentDialog\n      v-if="dialogDocument"\n      :key="dialogDocument.id"\n'
            '      :document="dialogDocument"\n      :tabs="dialogTabs"\n      @switch="switchDialog"')
patch(VIEW, "    openIds() {\n      return (this.layout.columns || []).map(", '''    /* FOCUS_POLISH_20261028_V2：全屏标签栏 = 当前所有分栏 */
    dialogTabs() {
      const map = new Map(this.documents.map((item) => [item.id, item]));
      return (this.layout.columns || [])
        .map((column) => map.get(column.documentId))
        .filter(Boolean)
        .map((item) => ({ id: item.id, title: item.title }));
    },

    openIds() {
      return (this.layout.columns || []).map(''')
patch(VIEW, "  methods: {\n    onDocumentsImported(created) {", '''  methods: {
    /* FOCUS_POLISH_20261028_V2 */
    switchDialog(id) {
      const next = this.documents.find((item) => item.id === id);
      if (next) this.dialogDocument = next;
    },

    async fxDirCreateDocument(payload = {}) {
      this.treeVisible = false;
      await this.createDocumentAt({
        folderId: payload.folderId || null,
        index: (this.layout.columns || []).length,
        open: true,
      });
    },

    fxDirEditDocument(id) {
      this.treeVisible = false;
      this.editDocument(id);
    },

    onDocumentsImported(created) {''')
patch(VIEW, '              @document-action="fdDocumentAction"\n            />',
            '              @document-action="fdDocumentAction"\n'
            '              @create-document="fxDirCreateDocument"\n'
            '              @edit-document="fxDirEditDocument"\n            />')

# ───────────────────────── 4. 思维导图极简卡片
print("4) 思维导图极简卡片")
rsub(MM, r'\n    <header class="focus-mind-map-card-header">.*?\n    </header>\n', "\n",
     "<!-- FOCUS_POLISH_20261028_V2：极简卡片 -->")
rsub(MM, r'\n    <footer class="focus-mind-map-card-footer">.*?\n    </footer>\n', '''
    <!-- FOCUS_POLISH_20261028_V2：极简卡片——只留画布；悬停浮出操作 -->
    <div class="fmm-card-actions">
      <button type="button" class="fmm-card-action is-primary" title="全屏编辑（双击画布）" @click.stop="openEditor">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3H4a1 1 0 0 0-1 1v3M13 3h3a1 1 0 0 1 1 1v3M7 17H4a1 1 0 0 1-1-1v-3M13 17h3a1 1 0 0 0 1-1v-3" /></svg>
        <span>全屏编辑</span>
      </button>
      <button type="button" class="fmm-card-action is-danger" title="删除思维导图" aria-label="删除思维导图" @click.stop="requestDelete">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 3h4l1 2H7l1-2ZM6 6l.7 11h6.6L14 6M8.5 9v5M11.5 9v5" /></svg>
      </button>
    </div>
''', "fmm-card-actions")
patch(MM, 'import "./focusMindMapPreviewFit.js";',
          'import "./focusMindMapPreviewFit.js";\n/* FOCUS_POLISH_20261028_V2 */\nimport "./focusMindMapMinimal.css";')

# ───────────────────────── 5. 目录增强
print("5) 目录树：拖拽 / 撤销 / 右键 / 快捷操作")
patch(DIR, 'import { tip } from "../../directives/tooltip";',
           'import { tip } from "../../directives/tooltip";\n'
           '/* FOCUS_POLISH_20261028_V2 */\nimport focusDirectoryEnhance from "./focusDirectoryEnhance";')
patch(DIR, "  mixins: [focusOwnership],\n\n  components: { AppIcon },",
           "  mixins: [focusOwnership, focusDirectoryEnhance],\n\n  components: { AppIcon },")
patch(DIR, '    "pick",\n    "create-document",\n  ],', '    "pick",\n    "create-document",\n    "edit-document",\n  ],')
patch(DIR, "            'drop-after': dropTarget.key === row.key && dropTarget.zone === 'after',",
           "            'drop-after': dropTarget.key === row.key && dropTarget.zone === 'after',\n"
           "            'is-dragging': dragged && dragged.key === row.key,")
patch(DIR, '''          @dragstart="onDragStart(row, $event)"
          @dragend="resetDrop"
          @dragover.prevent.stop="onRowDragOver(row, $event)"
          @dragleave.stop="onRowDragLeave(row)"
          @drop.prevent.stop="onRowDrop(row)"
        >''', '''          @dragstart="fxDragStart(row, $event)"
          @dragend="fxDragEnd"
          @dragover.prevent.stop="fxRowDragOver(row, $event)"
          @dragleave.stop="fxRowDragLeave(row, $event)"
          @drop.prevent.stop="fxRowDrop(row, $event)"
          @contextmenu.prevent="fxContextMenu(row, $event)"
        >''')
patch(DIR, '''        tabindex="0"
        @keydown="onTreeKeydown"
        @dragover.prevent="onRootDragOver"
        @drop.prevent="onRootDrop"''', '''        tabindex="0"
        @keydown="fxTreeKeydown"
        @dragover.prevent="fxTreeDragOver"
        @drop.prevent="fxRootDrop"''')
patch(DIR, '''          <button
            v-if="row.type === 'folder'"
            type="button"
            class="dir-twisty"''', '''          <span v-if="canDrag" class="dir-grip" aria-hidden="true"></span>

          <button
            v-if="row.type === 'folder'"
            type="button"
            class="dir-twisty"''')
patch(DIR, '''              v-tip="{ label: '在此新建子目录' }"
              @click.stop="beginCreate(row.id)"''', '''              v-tip="{ label: '新建文档或子目录' }"
              @click.stop="fxOpenAddMenu(row, $event)"''')
patch(DIR, '''          v-tip="{ label: '新建根目录' }"
          @click="beginCreate(null)"
        >
          <AppIcon name="plus" />
        </button>''', '''          v-tip="{ label: '新建根目录' }"
          @click="beginCreate(null)"
        >
          <AppIcon name="plus" />
        </button>

        <!-- FOCUS_POLISH_20261028_V2 -->
        <button
          v-if="canManage"
          type="button"
          class="dir-icon-btn"
          v-tip="{ label: '在当前目录新建文档' }"
          @click="fxCreateDocumentHere"
        >
          <svg class="dir-svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 3H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 17h8a1.5 1.5 0 0 0 1.5-1.5V7Z" /><path d="M11.5 3v4h4M10 9.5v5M7.5 12h5" /></svg>
        </button>

        <button
          v-if="canManage && folders.length"
          type="button"
          class="dir-icon-btn"
          v-tip="{ label: fxAllCollapsed ? '全部展开' : '全部折叠' }"
          @click="fxToggleAll"
        >
          <svg class="dir-svg" viewBox="0 0 20 20" aria-hidden="true">
            <path v-if="fxAllCollapsed" d="m6 4 4 4 4-4M6 12l4 4 4-4" />
            <path v-else d="m6 8 4-4 4 4M6 16l4-4 4 4" />
          </svg>
        </button>''')
patch(DIR, '        <p v-if="!visibleRows.length && !creating" class="dir-empty">', '''        <div
          v-if="canManage && dragged && dragged.parentId"
          class="dir-root-drop"
          :class="{ 'is-over': dropTarget.key === '__root__' }"
        >
          拖到此处 · 移出目录（未归档）
        </div>

        <p v-if="!visibleRows.length && !creating" class="dir-empty">''')
patch(DIR, '''          <kbd>↑↓</kbd> 移动 · <kbd>→</kbd> 展开 · <kbd>F2</kbd> 重命名 ·
          <kbd>拖拽</kbd> 排序''', '''          <kbd>拖拽</kbd> 移动 · <kbd>⌥↑↓</kbd> 排序 · <kbd>⌘↵</kbd> 全屏 ·
          <kbd>F2</kbd> 重命名 · 右键更多''')
patch(DIR, "      </footer>\n    </section>", '''      </footer>

      <div v-if="fxToast" class="dir-toast" role="status">
        <span>{{ fxToast.text }}</span>
        <button v-if="fxToast.undo" type="button" @click="fxUndo">撤销</button>
      </div>
    </section>''')
patch(DIR, '''        <template v-if="rowMenu.row.type === 'doc'">
          <button type="button" role="menuitem" @click="menuAction('move')">''', '''        <template v-if="rowMenu.row.type === 'doc'">
          <button type="button" role="menuitem" @click="fxMenuOpenColumn">
            在新分栏打开<kbd>↵</kbd>
          </button>
          <button type="button" role="menuitem" @click="fxMenuEdit">
            全屏编辑<kbd>⌘↵</kbd>
          </button>
          <div class="dir-menu-divider" role="separator"></div>
          <button type="button" role="menuitem" @click="menuAction('move')">''')
patch(DIR, '''        <template v-else>
          <button type="button" role="menuitem" @click="menuNewChild">''', '''        <template v-else>
          <button type="button" role="menuitem" @click="fxMenuNewDocument">
            新建文档
          </button>
          <button type="button" role="menuitem" @click="menuNewChild">''')
patch(DIR, "  </div>\n</template>", '''
    <Teleport to="body">
      <div
        v-if="fxAddMenu.row"
        class="dir-add-menu"
        :style="fxAddMenu.style"
        role="menu"
        @mousedown.stop
      >
        <button type="button" role="menuitem" @click="fxAddDocument">
          <svg class="dir-svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 3H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 17h8a1.5 1.5 0 0 0 1.5-1.5V7Z" /><path d="M11.5 3v4h4" /></svg>
          新建文档
        </button>
        <button type="button" role="menuitem" @click="fxAddFolder">
          <svg class="dir-svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h5l1.5 2H17v8H3Z" /></svg>
          新建子目录
        </button>
      </div>
    </Teleport>
  </div>
</template>''')

# ───────────────────────── 6. package.json 测试脚本
print("6) package.json 增加测试脚本")
pkg_path = ROOT / "package.json"
pkg = json.loads(pkg_path.read_text("utf-8"))
scripts = pkg.setdefault("scripts", {})
scripts["test:focus"] = "node scripts/verify-focus.mjs"
scripts["verify"] = "node scripts/verify-focus.mjs && electron-vite build"
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + "\n", "utf-8")
print("  ✓ package.json")

# ───────────────────────── 7. 自检 + 提交
print("7) 自检")
if subprocess.run(["node", "scripts/verify-focus.mjs"], cwd=ROOT).returncode != 0:
    sys.exit("[FAIL] 自检未通过，已停止提交")

print("8) 提交并推送")
def git(*args):
    print("  $ git " + " ".join(args))
    subprocess.run(["git", *args], cwd=ROOT, check=True)

git("add", *NEW, ED, SC, DM, DLG, VIEW, MM, DIR, "package.json")
if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
    print("  · 没有需要提交的变更")
else:
    git("commit", "-m",
        "feat(focus): 单一图片工具栏、全屏专注模式+分栏标签页、菜单去重、思维导图极简卡片、目录拖拽/撤销/右键/快捷操作")
    git("push")
print("\n完成 ✅")
