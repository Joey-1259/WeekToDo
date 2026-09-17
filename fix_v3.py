#!/usr/bin/env python3

from pathlib import Path
from datetime import datetime
import shutil
import subprocess
import sys
import re

ROOT = Path(
    "/Users/joey/Desktop/Joey-Workspace/MyProject/weektodo-main"
).resolve()

TARGET = ROOT / "src/views/toDoModal/colorPicker.vue"
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP = (
    Path("/tmp")
    / f"weektodo-fix-v3-{STAMP}"
    / "src/views/toDoModal/colorPicker.vue"
)


def fail(message):
    raise RuntimeError(message)


def run(command):
    print()
    print("$ " + " ".join(command))

    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
    )

    if result.returncode != 0:
        fail(
            f"命令执行失败，退出码：{result.returncode}\n"
            f"命令：{' '.join(command)}"
        )


if not ROOT.exists():
    fail(f"项目目录不存在：{ROOT}")

if not TARGET.exists():
    fail(f"找不到文件：{TARGET}")

original = TARGET.read_text(encoding="utf-8")
text = original

BACKUP.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(TARGET, BACKUP)

print("=" * 72)
print("WeekToDo ColorPicker FocusTrap Fix V3")
print(f"目标文件：{TARGET}")
print(f"备份文件：{BACKUP}")
print("=" * 72)


# ============================================================
# 1. 移除 Teleport
#
# Bootstrap Modal 会把焦点限制在 #toDoModal 内。
# ColorPicker Teleport 到 body 后会被认为位于 Modal 外，
# panel.focus() 会触发 FocusTrap，把焦点重定向到日期输入框。
# ============================================================

teleport_open = '''    <Teleport to="body">
      <Transition name="ctp-fade">'''

transition_without_teleport = '''    <Transition name="ctp-fade">'''

if teleport_open in text:
    text = text.replace(
        teleport_open,
        transition_without_teleport,
        1,
    )

teleport_close = '''      </Transition>
    </Teleport>'''

transition_close = '''    </Transition>'''

if teleport_close in text:
    text = text.replace(
        teleport_close,
        transition_close,
        1,
    )


# ============================================================
# 2. 面板不再依赖 JS 计算 fixed 坐标
# ============================================================

text = text.replace(
    '''          :style="panelPos"
''',
    "",
    1,
)


# ============================================================
# 3. 触发按钮在 mousedown 阶段阻断默认聚焦
# ============================================================

old_trigger = '''      :title="triggerTitle"
      @click.stop="togglePanel"'''

new_trigger = '''      :title="triggerTitle"
      aria-haspopup="dialog"
      :aria-expanded="String(open)"
      @mousedown.prevent.stop
      @click.stop="togglePanel"'''

if old_trigger in text:
    text = text.replace(
        old_trigger,
        new_trigger,
        1,
    )
elif '@mousedown.prevent.stop' not in text.split(
    "</button>",
    1,
)[0]:
    fail("无法定位 ColorPicker 触发按钮")


# ============================================================
# 4. 删除不再需要的 fixed 定位计算
# ============================================================

position_pattern = re.compile(
    r'''(?ms)
      const el = this\.\$refs\.anchor;
      if \(!el\) return;
      const r = el\.getBoundingClientRect\(\);
      const W = 260, H = 260;
      let left = r\.left;
      let top = r\.bottom \+ 6;
      if \(left \+ W > window\.innerWidth - 12\) left = window\.innerWidth - W - 12;
      if \(left < 12\) left = 12;
      if \(top \+ H > window\.innerHeight - 12\) top = r\.top - H - 6;

      this\.panelPos = \{
        position: "fixed",
        left: left \+ "px",
        top: top \+ "px",
        width: W \+ "px",
      \};
'''
)

text, count = position_pattern.subn(
    "",
    text,
    count=1,
)

if count == 0 and "getBoundingClientRect()" in text:
    fail("无法安全移除 ColorPicker fixed 坐标计算")


# ============================================================
# 5. 修改焦点说明，避免以后误加 Teleport
# ============================================================

old_comment = '''      /*
       * ColorPicker 通过 Teleport 挂载到 body。
       * 如果不主动转移焦点，键盘输入可能继续进入顶部
       * 原生 date input，最终表现为日期年份被修改。
       */'''

new_comment = '''      /*
       * 颜色面板必须保留在 Bootstrap Modal 的 DOM 内。
       * 不可 Teleport 到 body，否则 Modal FocusTrap 会把
       * 焦点重定向到顶部第一个日期输入框。
       */'''

if old_comment in text:
    text = text.replace(
        old_comment,
        new_comment,
        1,
    )


# ============================================================
# 6. CSS 改为 Modal 内部绝对定位
# ============================================================

style_anchor = '''<style scoped lang="scss">
/* ── 触发按钮 ── */'''

style_replacement = '''<style scoped lang="scss">
/*
 * ColorPicker 必须建立自己的定位上下文。
 * 面板保留在 Bootstrap Modal 内，避免 FocusTrap 将焦点
 * 错误重定向到顶部的日期输入框。
 */
.color-tag-picker {
  position: relative;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  isolation: isolate;
}

/* ── 触发按钮 ── */'''

if ".color-tag-picker {" not in text:
    if style_anchor not in text:
        fail("无法定位 ColorPicker style 开始位置")

    text = text.replace(
        style_anchor,
        style_replacement,
        1,
    )


old_panel_css = '''.ctp-panel {
  z-index: 22000; padding: 10px 12px;'''

new_panel_css = '''.ctp-panel {
  position: absolute;
  top: calc(100% + 7px);
  left: 0;
  z-index: 22000;
  width: 260px;
  padding: 10px 12px;'''

if old_panel_css in text:
    text = text.replace(
        old_panel_css,
        new_panel_css,
        1,
    )
elif "position: absolute;" not in text:
    fail("无法定位 .ctp-panel 样式")


# ============================================================
# 7. 确保父级工具条不会裁剪面板
#
# scoped 样式下，使用 :global 定位到事项弹窗内部容器。
# ============================================================

overflow_fix = '''
/*
 * 属性工具条及属性区域必须允许颜色浮层越界显示。
 */
:global(#toDoModal .task-properties-section),
:global(#toDoModal .attribute-toolbar),
:global(#toDoModal .attribute-tools) {
  overflow: visible;
}
'''

if (
    ":global(#toDoModal .attribute-toolbar)"
    not in text
):
    text = text.replace(
        "\n/* ── 触发按钮 ── */",
        overflow_fix
        + "\n/* ── 触发按钮 ── */",
        1,
    )


# ============================================================
# 8. 保留 data 字段兼容性
#
# panelPos 留着不会造成问题，但为了避免死状态，这里删除。
# ============================================================

text = text.replace(
    '''      panelPos: {},
''',
    "",
    1,
)


# ============================================================
# 9. 静态验证
# ============================================================

required = [
    'aria-haspopup="dialog"',
    '@mousedown.prevent.stop',
    "position: absolute;",
    "top: calc(100% + 7px);",
    ":global(#toDoModal .attribute-toolbar)",
]

for marker in required:
    if marker not in text:
        fail(f"补丁验证失败，缺少标记：{marker}")

if '<Teleport to="body">' in text:
    fail("补丁验证失败：Teleport 仍然存在")

if ':style="panelPos"' in text:
    fail("补丁验证失败：panelPos 样式绑定仍然存在")

if text == original:
    print("SKIP：当前文件已经是 V3 状态")
else:
    TARGET.write_text(
        text.rstrip() + "\n",
        encoding="utf-8",
    )
    print(f"PATCH {TARGET.relative_to(ROOT)}")

print()
print("开始执行差异检查和 Electron 编译……")

run([
    "git",
    "diff",
    "--check",
    "--",
    "src/views/toDoModal/colorPicker.vue",
])

run([
    "yarn",
    "electron:compile",
])

print()
print("=" * 72)
print("V3 修复完成，编译通过。")
print()
print("下一步运行：")
print("  yarn electron:preview")
print()
print("确认交互无误后提交：")
print(
    '  git add src/views/toDoModal/colorPicker.vue '
    '&& git commit -m '
    '"fix: keep color picker inside modal focus trap" '
    '&& git push'
)
print("=" * 72)

