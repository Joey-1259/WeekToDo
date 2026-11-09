#!/usr/bin/env python3
"""FOCUS_SIDEBAR_20261109_V1 —— 全屏侧栏重设计：接入弹窗与宿主"""
import pathlib, subprocess, sys

ROOT = pathlib.Path("/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main")
V = "src/views/focusDocuments/"
DLG, VIEW, CSS = V + "FocusDocumentDialog.vue", V + "FocusDocumentsView.vue", V + "focusDialogFocusMode.css"

def patch(rel, old, new):
    p = ROOT / rel
    s = p.read_text("utf-8")
    if new in s:
        print(f"  · 已应用  {rel}"); return
    if old not in s:
        sys.exit(f"[FAIL] {rel} 未找到锚点：\n{old[:160]}")
    p.write_text(s.replace(old, new, 1), "utf-8")
    print(f"  ✓ {rel}")

print("0) 前置检查")
for rel, needle in [(V + "FocusDialogSidebar.vue", "FOCUS_SIDEBAR_20261109_V1"),
                    (V + "focusSidebarTree.js", "FOCUS_SIDEBAR_20261109_V1"),
                    ("scripts/verify-sidebar.mjs", "FOCUS_SIDEBAR_20261109_V1")]:
    f = ROOT / rel
    if not f.exists() or needle not in f.read_text("utf-8"):
        sys.exit(f"[FAIL] 请先保存新文件：{rel}")
print("  ✓ 新文件就位")

print("1) FocusDocumentDialog.vue")
# 目录与宽度解耦：两种宽度都能显示侧栏
patch(DLG, '          v-if="wide"\n          type="button"\n          class="fdx-sb-toggle"',
           '          type="button"\n          class="fdx-sb-toggle"')
patch(DLG, "    showSidebar() {\n      return this.wide && this.sidebarOpen;\n    },",
           "    showSidebar() {\n      /* FOCUS_SIDEBAR_20261109_V1：目录与宽度解耦 */\n      return this.sidebarOpen;\n    },")
patch(DLG, "        if (this.wide) this.toggleSidebar();\n        return;",
           "        this.toggleSidebar();\n        return;")
# 侧栏挂载：指令事件 + 浮出态 + 左缘感应区
patch(DLG, '''      <FocusDialogSidebar
        v-if="showSidebar"
        :folders="folders"
        :documents="documents"
        :current-id="draft.id"
        :current-title="draft.title"
        :open-ids="tabIds"
        @select="switchTab"
        @resize="onSidebarResize"
      />''', '''      <!-- FOCUS_SIDEBAR_20261109_V1 -->
      <div v-if="!showSidebar" class="fdx-peek-edge" @mouseenter="peekEnter" @mouseleave="peekLeave"></div>
      <FocusDialogSidebar
        v-if="showSidebar || peekOpen"
        ref="sidebar"
        :folders="folders"
        :documents="documents"
        :current-id="draft.id"
        :current-title="draft.title"
        :open-ids="tabIds"
        :peek="!showSidebar"
        @command="onSidebarCommand"
        @resize="onSidebarResize"
        @mouseenter="peekCancel"
        @mouseleave="peekLeave"
      />''')
patch(DLG, '    "switch",\n  ],', '    "switch",\n    "pin",\n    "sidebar",\n  ],')
patch(DLG, '      sidebarWidth: Number(localStorage.getItem("focusDialogSidebarWidth")) || 248,\n',
           '      sidebarWidth: Number(localStorage.getItem("focusDialogSidebarWidth")) || 248,\n      peekOpen: false,\n')
patch(DLG, "    toggleSidebar() {\n      this.sidebarOpen = !this.sidebarOpen;",
           "    toggleSidebar() {\n      this.peekOpen = false;\n      this.sidebarOpen = !this.sidebarOpen;")
# ⌘P 聚焦侧栏搜索
patch(DLG, "      /* FOCUS_POLISH_20261028_V2：⌘⇧[ / ⌘⇧] 或 Ctrl+Tab 切换标签 */",
r'''      /* FOCUS_SIDEBAR_20261109_V1：⌘P 搜索文档 */
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        if (!this.showSidebar) this.toggleSidebar();
        this.$nextTick(() => this.$refs.sidebar?.focusSearch());
        return;
      }
      /* FOCUS_POLISH_20261028_V2：⌘⇧[ / ⌘⇧] 或 Ctrl+Tab 切换标签 */''')
# 当前文档被移动后同步存储位置
patch(DLG, "    folderPanel(value) {\n      if (!value) return;",
r'''    /* FOCUS_SIDEBAR_20261109_V1 */
    documents(list) {
      const me = (list || []).find((d) => d.id === this.draft.id);
      if (me && (me.folderId || null) !== (this.draft.folderId || null)) {
        this.draft.folderId = me.folderId || null;
        this.folderId = me.folderId || "__root__";
      }
    },

    folderPanel(value) {
      if (!value) return;''')
# 目录变更实时刷新（修复：此前只在打开时读一次）
patch(DLG, '    window.addEventListener("keydown", this.onKeydown);\n    document.addEventListener("mousedown", this.onPointerDown);\n  },',
           '    window.addEventListener("keydown", this.onKeydown);\n    document.addEventListener("mousedown", this.onPointerDown);\n'
           '    window.addEventListener("weektodo:focus-folders-changed", this.reloadFolders);\n  },')
patch(DLG, "    clearTimeout(this.timer);\n  },\n\n  methods: {",
r'''    clearTimeout(this.timer);
    clearTimeout(this.peekTimer);
    window.removeEventListener("weektodo:focus-folders-changed", this.reloadFolders);
  },

  methods: {
    /* FOCUS_SIDEBAR_20261109_V1 · 侧栏 */
    reloadFolders() {
      this.folders = focusFolderService.listFolders();
    },

    peekEnter() {
      if (this.showSidebar) return;
      clearTimeout(this.peekTimer);
      this.peekTimer = setTimeout(() => { this.peekOpen = true; }, 100);
    },

    peekCancel() {
      clearTimeout(this.peekTimer);
    },

    peekLeave() {
      clearTimeout(this.peekTimer);
      if (this.showSidebar || !this.peekOpen) return;
      this.peekTimer = setTimeout(() => {
        if (this.$refs.sidebar?.busy) { this.peekLeave(); return; }
        this.peekOpen = false;
      }, 250);
    },

    async onSidebarCommand(cmd) {
      const type = cmd && cmd.type;
      if (!type) return;

      if (type === "dock") {
        this.peekOpen = false;
        if (!this.sidebarOpen) this.toggleSidebar();
        return;
      }
      if (type === "open") { await this.switchTab(cmd.id); return; }

      if (type === "rename" && cmd.kind === "doc" && cmd.id === this.draft.id) {
        this.draft.title = cmd.name;
        this.scheduleSave();
        return;
      }

      if (type === "create-folder") {
        try {
          const folder = focusFolderService.createFolder(cmd.name, cmd.parentId || null);
          this.reloadFolders();
          if (cmd.done) cmd.done(folder);
        } catch (error) {
          console.error(error);
          window.alert("新建目录失败，请重试。");
        }
        return;
      }

      /* 其余操作会写存储（排序会重写同级文档）：先落盘，避免旧内容覆盖 */
      try {
        await this.flush();
      } catch {
        if (!window.confirm("当前内容保存失败，仍要继续吗？")) return;
      }

      if (type === "pin") { this.$emit("pin", cmd.id); return; }

      /* 删除当前文档：先切到相邻标签，避免后台保存把它写回来 */
      if (type === "delete" && cmd.kind === "doc" && cmd.id === this.draft.id) {
        const next = this.tabItems.find((t) => t.id !== this.draft.id);
        if (next) {
          this.$emit("switch", next.id);
          await this.$nextTick();
        }
      }

      this.$emit("sidebar", cmd);
    },
''')

print("2) FocusDocumentsView.vue")
patch(VIEW, '      @switch="switchDialog"\n',
            '      @switch="switchDialog"\n      @pin="pinDocument"\n      @sidebar="onDialogSidebar"\n')
patch(VIEW, "    /* FOCUS_POLISH_20261028_V2 */\n    switchDialog(id) {",
r'''    /* FOCUS_SIDEBAR_20261109_V1：全屏侧栏操作，全部复用既有实现 */
    pinDocument(id) {
      this.openAtEnd(id);
    },

    async onDialogSidebar(cmd) {
      const findDoc = (id) => this.documents.find((d) => d.id === id);
      try {
        switch (cmd.type) {
          case "create-document":
            await this.createDocumentAt({
              folderId: cmd.folderId || null,
              index: (this.layout.columns || []).length,
              open: true,
            });
            break;
          case "rename":
            if (cmd.kind === "folder") await this.fdRenameFolder({ id: cmd.id, name: cmd.name });
            else await this.fdRenameDocument({ id: cmd.id, name: cmd.name });
            break;
          case "move":
            if (cmd.event === "move-folder") await this.fdMoveFolder(cmd.payload);
            else await this.fdMoveDocument(cmd.payload);
            break;
          case "duplicate": {
            const doc = findDoc(cmd.id);
            if (doc) await this.handleDocumentAction({ action: "duplicate", document: doc });
            break;
          }
          case "delete":
            if (cmd.kind === "folder") await this.fdDeleteFolder(cmd.id);
            else {
              const doc = findDoc(cmd.id);
              if (doc) await this.handleDocumentAction({ action: "delete", document: doc });
            }
            break;
          default:
            break;
        }
      } catch (error) {
        console.error("[focus-sidebar]", error);
        window.alert("操作失败，请重试。");
      }
    },

    /* FOCUS_POLISH_20261028_V2 */
    switchDialog(id) {''')

print("3) focusDialogFocusMode.css")
p = ROOT / CSS
s = p.read_text("utf-8")
MARK = "/* FOCUS_SIDEBAR_20261109_V1 */"
if MARK in s:
    print("  · 已应用")
else:
    p.write_text(s.rstrip() + "\n\n" + MARK + r'''
/* 浮出态：侧栏隐藏时，从左缘悬浮出现，不占布局 */
body .fdx-mode .focus-dialog > .fdx-sidebar.is-peek {
  position: fixed;
  z-index: 40;
  top: 48px;
  bottom: 10px;
  left: 8px;
  display: flex !important;
  width: 272px;
}
.fdx-peek-edge {
  position: fixed;
  z-index: 39;
  top: 40px;
  bottom: 0;
  left: 0;
  width: 10px;
}
/* 当前文档用灰底加粗，不再用蓝色 */
body .fdx-mode .fdx-sb-toggle.is-on { background: transparent; }
''', "utf-8")
    print("  ✓")

print("4) 自检")
for script in ["scripts/verify-sidebar.mjs", "scripts/verify-focus.mjs"]:
    if subprocess.run(["node", script], cwd=ROOT).returncode != 0:
        sys.exit(f"[FAIL] {script} 未通过，已停止提交")
print("5) 编译")
if subprocess.run(["yarn", "electron:compile"], cwd=ROOT).returncode != 0:
    sys.exit("[FAIL] 编译失败，已停止提交（把报错发给我）")

print("6) 提交并推送")
files = [DLG, VIEW, CSS, V + "FocusDialogSidebar.vue", V + "focusSidebarTree.js",
         "scripts/verify-sidebar.mjs", "patch_focus_20261109_sidebar_v1.py"]
subprocess.run(["git", "add", *files], cwd=ROOT, check=True)
if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT).returncode == 0:
    print("  · 没有需要提交的变更")
else:
    subprocess.run(["git", "commit", "-m",
        "feat(focus): 全屏侧栏 V1 重设计——树上新建/改名/移动/删除、⌘单击固定标签、右键菜单与内联移动、Pointer 拖拽、键盘导航、⌘P 搜索、浮出态；目录与宽度解耦；修复目录不实时刷新"],
        cwd=ROOT, check=True)
    subprocess.run(["git", "push"], cwd=ROOT, check=True)
print("\n完成 ✅  运行 yarn electron:serve 手动验证")
