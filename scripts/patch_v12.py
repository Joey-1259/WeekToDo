# -*- coding: utf-8 -*-
#
# WeekToDo 加固补丁 V12
#
# V11 的失败：print 里把 ASCII 双引号嵌进了双引号字符串，解析期报错，
# 整个脚本一行未执行。本版的所有字面量都回避了这个坑，并且：
#
#   1. 全部编辑在内存里完成；
#   2. 写盘前对每个受影响文件做语法校验（node --check + 标签/括号比对）；
#   3. 任一文件校验失败则整批放弃写盘，磁盘保持原状；
#   4. 单步锚点失配只跳过并记录，不中止；
#   5. 焦点守卫迁移是原子组：不能全部成功就整组回滚，
#      避免出现 mixin 与私有守卫同时挂着、两个 focusin 处理器打架。
#
import os
import re
import io
import sys
import shutil
import tempfile
import subprocess
import datetime

ROOT = os.getcwd()
MARK = "HARDENING_20260911_V12"
ALREADY = "已是目标状态"

if not os.path.isdir(os.path.join(ROOT, "src", "views", "focusDocuments")):
    sys.exit("X 请在 WeekToDo 仓库根目录执行")

buf = {}
orig = {}
done = []
skipped = []


def read(rel):
    if rel not in buf:
        full = os.path.join(ROOT, rel)
        if not os.path.isfile(full):
            return None
        with io.open(full, encoding="utf-8") as handle:
            text = handle.read()
        buf[rel] = text
        orig[rel] = text
    return buf[rel]


def ok(rel, label, detail=""):
    done.append((rel, label, detail))
    print("  OK  " + label + ("  " + detail if detail else ""))


def skip(rel, label, why):
    skipped.append((rel, label, why))
    print("  --  跳过 " + label + "  〔" + why + "〕")
    return None


# ── 结构化定位 ────────────────────────────────────────────────

def match_block(text, brace_idx):
    # brace_idx 指向 '{'，返回配对 '}' 之后的下标；跳过字符串与注释。
    depth = 0
    i = brace_idx
    n = len(text)
    quotes = "\"'`"
    while i < n:
        c = text[i]
        if c in quotes:
            q = c
            i += 1
            while i < n:
                if text[i] == "\\":
                    i += 2
                    continue
                if text[i] == q:
                    break
                i += 1
            i += 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            i = n if j < 0 else j + 1
            continue
        if c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return -1


def eat_trailing(text, end):
    if end < len(text) and text[end] == ",":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
        if end < len(text) and text[end] == "\n":
            end += 1
    return end


def eat_leading_comment(text, start):
    head = text.rfind("\n", 0, start - 1)
    while head >= 0:
        line_start = text.rfind("\n", 0, head) + 1
        line = text[line_start:head].strip()
        looks_comment = (
            line.startswith("/*")
            or line.startswith("*")
            or line.startswith("//")
            or line.endswith("*/")
        )
        if not looks_comment:
            break
        start = line_start
        if line.startswith("/*"):
            break
        head = text.rfind("\n", 0, line_start - 1)
    return start


def eat_leading_selectors(text, start):
    # 处理多行选择器列表：
    #     .a,
    #     .b {   <- 命中这一行
    # 若不把上面以逗号结尾的行一并纳入，删除后会留下悬空的 '.a,'，
    # 它会静默地和下一条规则合并 —— CSS 依然能编译，但语义已经错了。
    while True:
        line_start = text.rfind("\n", 0, start - 1) + 1
        if line_start >= start or line_start == 0 and start == 0:
            break
        line = text[line_start:start].strip()
        if line.endswith(",") and "{" not in line and "}" not in line:
            start = line_start
            continue
        break
    return start


def find_selector_lines(text, needle):
    out = []
    pattern = re.compile(
        r"(?m)^[ \t]*([^\n{};]*" + re.escape(needle) + r"[^\n{};]*)\{"
    )
    for m in pattern.finditer(text):
        end = match_block(text, m.end() - 1)
        if end > 0:
            start = eat_leading_selectors(text, m.start())
            out.append((start, eat_trailing(text, end), m.group(1).strip()))
    return out


def find_member(text, name):
    pattern = re.compile(
        r"(?m)^[ \t]*(?:async[ \t]+)?"
        + re.escape(name)
        + r"[ \t]*\([^\n)]*\)[ \t]*\{"
    )
    m = pattern.search(text)
    if not m:
        return None
    end = match_block(text, m.end() - 1)
    if end < 0:
        return None
    return (eat_leading_comment(text, m.start()), eat_trailing(text, end))


def ref_count(text, name):
    return len(re.findall(r"\b" + re.escape(name) + r"\b", text))


def template_of(text):
    i = text.find("<template>")
    j = text.rfind("</template>")   # V11 用的是 find，会被具名插槽的
    if i < 0 or j <= i:             # <template #foo> 截断，导致守卫失效
        return ""
    return text[i:j]


# ── 编辑动作（全部 skip-on-mismatch） ─────────────────────────

def sub(rel, old, new, label, guard=None):
    text = read(rel)
    if text is None:
        return skip(rel, label, "文件不存在")
    if guard and guard in text:
        return skip(rel, label, ALREADY)
    if new and new in text:
        return skip(rel, label, ALREADY)
    hits = text.count(old)
    if hits != 1:
        return skip(rel, label, "锚点命中 " + str(hits) + " 次，期望 1")
    buf[rel] = text.replace(old, new, 1)
    ok(rel, label)


def sub_re(rel, pattern, repl, label, flags=re.M, guard=None):
    text = read(rel)
    if text is None:
        return skip(rel, label, "文件不存在")
    if guard and re.search(guard, text, flags):
        return skip(rel, label, ALREADY)
    hits = list(re.finditer(pattern, text, flags))
    if len(hits) != 1:
        return skip(rel, label, "正则命中 " + str(len(hits)) + " 次，期望 1")
    m = hits[0]
    buf[rel] = text[: m.start()] + repl + text[m.end():]
    ok(rel, label)


def drop_member(rel, name, label):
    # 取证式：标识符全文只出现一次（即仅定义处）才算死代码。
    text = read(rel)
    if text is None:
        return skip(rel, label, "文件不存在")
    span = find_member(text, name)
    if not span:
        return skip(rel, label, "找不到 " + name + " 的定义")
    refs = ref_count(text, name)
    if refs != 1:
        return skip(rel, label, name + " 被引用 " + str(refs) + " 次，不是死代码")
    start, end = span
    buf[rel] = text[:start] + text[end:]
    ok(rel, label, "切除 " + str(end - start) + " 字符")


def drop_css_family(rel, needle, label):
    text = read(rel)
    if text is None:
        return skip(rel, label, "文件不存在")
    if needle in template_of(text):
        return skip(rel, label, "template 仍在使用 " + needle)
    total = 0
    count = 0
    while count <= 80:
        current = read(rel)
        hits = find_selector_lines(current, needle)
        if not hits:
            break
        start, end, _sel = hits[0]
        buf[rel] = current[:start] + current[end:]
        total += end - start
        count += 1
    if not count:
        return skip(rel, label, "没有匹配的规则")
    ok(rel, label, "删除 " + str(count) + " 条规则 / " + str(total) + " 字符")


def snapshot():
    return (dict(buf), len(done), len(skipped))


def restore(state):
    saved, dlen, slen = state
    buf.clear()
    buf.update(saved)
    del done[dlen:]
    del skipped[slen:]


# ══════════════════════════════════════════════════════════════
print("\n[1/6] .gitignore")
# ══════════════════════════════════════════════════════════════
gi = read(".gitignore")
if gi is None:
    skip(".gitignore", "追加忽略项", "文件不存在")
elif ".focus-patch-backup/" in gi:
    skip(".gitignore", "追加忽略项", ALREADY)
else:
    buf[".gitignore"] = gi.rstrip() + (
        "\n\n# " + MARK + "\n"
        "# 补丁脚本的历史快照。留在仓库里有两个害处：全局搜索会命中过期\n"
        "# 实现，把读代码的人引向错误的版本；且它只会越来越大而无人阅读。\n"
        "# 要回滚请用 git，那是它的本职。\n"
        ".focus-patch-backup/\n"
    )
    ok(".gitignore", "追加 .focus-patch-backup/")

# ══════════════════════════════════════════════════════════════
print("\n[2/6] src/main.js · 隐私开关与层级令牌")
# ══════════════════════════════════════════════════════════════
REL = "src/main.js"

sub(
    REL,
    'import "./assets/style/globalVars.scss";',
    "/* " + MARK + " · z-index 台账\n"
    "   这些数字原先散在多个文件里当字面量，新增浮层只能翻代码猜比谁大。\n"
    "   集中成令牌后，Bootstrap 占用的 1050 / 1055 也被显式记录下来。 */\n"
    'import "./assets/style/layers.scss";\n'
    "\n"
    'import "./assets/style/globalVars.scss";',
    "引入 layers.scss",
    guard="assets/style/layers.scss",
)

sub_re(
    REL,
    r"(?m)^[ \t]*dsn:[ \t]*process\.env\.VUE_APP_SENTRY_DNS,[ \t]*$",
    "  /* " + MARK + " · 防御性取值\n"
    "     渲染进程默认没有 process 这个全局量。若构建配置里没有 define 它，\n"
    "     本行会在模块求值阶段抛 ReferenceError —— 时机早于 createApp，\n"
    "     下面所有 try/catch 兜底都还没装上，症状是纯白屏加一行看不出\n"
    "     因果的报错。读不到就当没配 DSN。 */\n"
    "  dsn:\n"
    "    (typeof process !== undefined_guard_placeholder &&\n"
    "      process.env &&\n"
    "      process.env.VUE_APP_SENTRY_DNS) ||\n"
    "    undefined,",
    "DSN 取值加防御",
    guard=r"typeof process !==",
)
# 上面的占位符换成正确的字符串字面量（避免在 Python 里嵌套引号）
if REL in buf and "undefined_guard_placeholder" in buf[REL]:
    buf[REL] = buf[REL].replace(
        "typeof process !== undefined_guard_placeholder",
        "typeof process !== " + chr(34) + "undefined" + chr(34),
    )

sub_re(
    REL,
    r"(?m)^[ \t]*tracesSampleRate:[^\n]*$",
    "  /* " + MARK + " · 桌面端不需要全量性能追踪来发现回归，\n"
    "     而 1.0 意味着每次交互都产生一条外发记录。 */\n"
    "  tracesSampleRate: 0.05,",
    "降低 tracesSampleRate",
    guard=r"tracesSampleRate:[ \t]*0\.05",
)

sub_re(
    REL,
    r"(?m)^[ \t]*replaysSessionSampleRate:[^\n]*$",
    "  replaysSessionSampleRate: 0,",
    "关闭会话回放采样",
    guard=r"replaysSessionSampleRate:[ \t]*0,",
)

sub_re(
    REL,
    r"(?m)^[ \t]*replaysOnErrorSampleRate:[^\n]*$",
    "  replaysOnErrorSampleRate: 0,",
    "关闭错误回放采样",
    guard=r"replaysOnErrorSampleRate:[ \t]*0,",
)

BEFORE_SEND = (
    "  /* " + MARK + " · 让错误上报开关真正生效\n"
    "   *\n"
    "   * beforeSend 此前整段是注释，意味着设置里那个开关完全不起作用：\n"
    "   * 用户关掉它，数据照样发。对一个把 focused on privacy 写进\n"
    "   * package.json description 的产品，这是最该修的一条，\n"
    "   * 优先级高于任何观感问题。\n"
    "   */\n"
    "  beforeSend(event) {\n"
    "    try {\n"
    "      /* 读不到配置时按未同意处理 —— 隐私默认值必须站在保守一侧。 */\n"
    "      if (!store.getters.config.reportErrors) return null;\n"
    "    } catch (error) {\n"
    "      return null;\n"
    "    }\n"
    "    return event;\n"
    "  },\n"
    "\n"
    "  beforeSendTransaction(event) {\n"
    "    try {\n"
    "      if (!store.getters.config.reportErrors) return null;\n"
    "    } catch (error) {\n"
    "      return null;\n"
    "    }\n"
    "    return event;\n"
    "  },\n"
)

text = read(REL)
if text is None:
    skip(REL, "恢复 beforeSend 隐私开关", "文件不存在")
elif re.search(r"(?m)^[ \t]*beforeSend\(", text):
    skip(REL, "恢复 beforeSend 隐私开关", ALREADY)
else:
    sub_re(
        REL,
        r"(?ms)^[ \t]*// beforeSend\(event\).*?^[ \t]*// \},[ \t]*\n",
        BEFORE_SEND,
        "恢复 beforeSend 隐私开关",
        flags=0,
    )

sub_re(
    REL,
    r"z-index:999999;",
    "z-index:var(--z-diagnostic,99999);",
    "启动失败遮罩改用 --z-diagnostic",
    flags=0,
)

sub_re(
    REL,
    r"z-index:99999;",
    "z-index:var(--z-diagnostic,99999);",
    "错误卡片改用 --z-diagnostic",
    flags=0,
)

# ══════════════════════════════════════════════════════════════
print("\n[3/6] FocusBoardPager.vue")
# ══════════════════════════════════════════════════════════════
REL = "src/views/focusDocuments/FocusBoardPager.vue"
sub(
    REL,
    '  emits: ["step", "go"],',
    "  /* " + MARK + "：go 从未被 emit，宿主也只监听 step。\n"
    "     声明一个不存在的事件，会让下一个人去找它不存在的触发点。 */\n"
    '  emits: ["step"],',
    "移除从未 emit 的 go",
)

# ══════════════════════════════════════════════════════════════
print("\n[4/6] TaskNotesComposer.vue · 私有守卫迁移到共享 mixin〔原子组〕")
# ══════════════════════════════════════════════════════════════
REL = "src/views/toDoModal/TaskNotesComposer.vue"
group = snapshot()

if not os.path.isfile(os.path.join(ROOT, "src", "mixins", "focusOwnership.js")):
    skip(REL, "焦点守卫迁移", "src/mixins/focusOwnership.js 不存在")
    restore(group)
else:
    sub(
        REL,
        "const SAVE_DEBOUNCE = 380;",
        "/* " + MARK + "\n"
        "   焦点守卫已抽成 src/mixins/focusOwnership.js。原先这段逻辑手写在\n"
        "   本组件里，它解决了问题但只服务一个组件；仓库里 Teleport 到 body\n"
        "   的浮层不止一个，处境完全相同，只是当前缺少在 modal 打开期间唤起\n"
        "   的入口所以没显形。抽成 mixin 是让这条规则默认生效。\n"
        "   本组件根元素是 ref=panel，正好命中 mixin 的默认约定。 */\n"
        "import focusOwnership from " + chr(34) + "../../mixins/focusOwnership" + chr(34) + ";\n"
        "\n"
        "const SAVE_DEBOUNCE = 380;",
        "引入 focusOwnership",
    )

    sub(
        REL,
        '  name: "TaskNotesComposer",',
        '  name: "TaskNotesComposer",\n\n  mixins: [focusOwnership],',
        "挂载 mixin",
    )

    sub(
        REL,
        "      renderer: null,\n"
        "      /* FOCUS_OWNERSHIP_FIX_20260911 焦点归属守卫的状态 */\n"
        "      lastInside: null,\n"
        "      strikes: 0,\n"
        "      strikeTimer: null,\n"
        "      closing: false,\n"
        "    };",
        "      renderer: null,\n    };",
        "删除守卫私有状态",
    )

    sub(
        REL,
        '    document.addEventListener("focusin", this.onFocusinCapture, true);\n',
        "",
        "删除 mounted 里的 focusin 注册",
    )

    sub(
        REL,
        '    document.removeEventListener(\n'
        '      "focusin",\n'
        "      this.onFocusinCapture,\n"
        "      true\n"
        "    );\n",
        "",
        "删除 beforeUnmount 里的 focusin 解绑",
    )

    sub(
        REL,
        "    clearTimeout(this.strikeTimer);\n    this.flush();",
        "    this.flush();",
        "删除守卫定时器清理",
    )

    drop_member(REL, "onFocusinCapture", "删除私有 onFocusinCapture")

    sub(
        REL,
        "this.closing = true;",
        "this.releaseFocusOwnership();",
        "关闭流程改调 releaseFocusOwnership",
    )

    hard = [row for row in skipped[group[2]:] if row[2] != ALREADY]
    if hard:
        restore(group)
        print("  !!  本组回滚：迁移必须整组成立，否则 mixin 与私有守卫会同时")
        print("      挂着两个 focusin 处理器互相抢焦。失配项：")
        for _rel, label, why in hard:
            print("        · " + label + " -> " + why)
        skipped.append((REL, "焦点守卫迁移〔整组〕", "组内有失配，已回滚"))

# 层级令牌化（独立于上面的原子组）
text = read(REL)
if text is None:
    skip(REL, "层级改用令牌", "文件不存在")
elif "--z-overlay-notes" in text:
    skip(REL, "层级改用令牌", ALREADY)
else:
    sub_re(
        REL,
        r"(?m)^([ \t]*)z-index:[ \t]*22000;",
        "",
        "层级改用 --z-overlay-notes",
    )
    # sub_re 已把该行删掉，这里补回带缩进的令牌版本
    if REL in buf and "z-index: 22000;" not in buf[REL] and "--z-overlay-notes" not in buf[REL]:
        buf[REL] = buf[REL].replace(
            ".tnc-layer {", ".tnc-layer {\n  z-index: var(--z-overlay-notes, 1230);", 1
        )

# ══════════════════════════════════════════════════════════════
print("\n[5/6] FocusDocumentsView.vue · 取证式清理 + reload 并发保护")
# ══════════════════════════════════════════════════════════════
REL = "src/views/focusDocuments/FocusDocumentsView.vue"
text = read(REL)

if text is None:
    skip(REL, "全部步骤", "文件不存在")
else:
    if "FocusFolderPicker" in template_of(text):
        skip(REL, "移除 FocusFolderPicker", "template 仍在使用")
    else:
        sub(
            REL,
            'import FocusFolderPicker from "./FocusFolderPicker.vue";\n',
            "",
            "删除 FocusFolderPicker import",
        )
        current = read(REL)
        m = re.search(r"(?m)^[ \t]*FocusFolderPicker,[ \t]*\n", current)
        if m:
            buf[REL] = current[: m.start()] + current[m.end():]
            ok(REL, "从 components 摘除 FocusFolderPicker")
        else:
            skip(REL, "从 components 摘除 FocusFolderPicker", "找不到注册行")

    for name, label in [
        ("moveDialogDirty", "删除死 computed moveDialogDirty"),
        ("equalizeColumns", "删除死方法 equalizeColumns"),
        ("createFromDirectory", "删除死方法 createFromDirectory"),
        ("closeMoveDialog", "删除死方法 closeMoveDialog"),
        ("confirmMoveDocument", "删除死方法 confirmMoveDocument"),
    ]:
        drop_member(REL, name, label)

    for name in ["moveFolderId", "moveFolders", "moveSaving"]:
        current = read(REL)
        refs = ref_count(current, name)
        if refs != 1:
            skip(REL, "删除死状态 " + name, "被引用 " + str(refs) + " 次")
            continue
        m = re.search(r"(?m)^[ \t]*" + re.escape(name) + r":[^\n]*\n", current)
        if not m:
            skip(REL, "删除死状态 " + name, "找不到声明行")
            continue
        buf[REL] = current[: m.start()] + current[m.end():]
        ok(REL, "删除死状态 " + name)

    drop_css_family(REL, "focus-move", "删除旧 move 弹窗样式")
    drop_css_family(REL, "focus-workspace-heading", "删除 heading 遗留样式")

    current = read(REL)
    if "--z-popover" in current:
        skip(REL, "搜索浮层改用 --z-popover", ALREADY)
    else:
        sub_re(
            REL,
            r"(?m)^([ \t]*)z-index:[ \t]*40;",
            "  z-index: var(--z-popover, 40);",
            "搜索浮层改用 --z-popover",
        )

    # reload 并发保护
    current = read(REL)
    if "reloadOnce" in current:
        skip(REL, "reload 并发保护", ALREADY)
    else:
        span = find_member(current, "reload")
        if not span:
            skip(REL, "reload 并发保护", "找不到 reload 定义")
        else:
            start, end = span
            body = current[start:end]
            renamed = re.sub(
                r"(?m)^([ \t]*)(async[ \t]+)?reload[ \t]*\(",
                lambda mm: mm.group(1) + (mm.group(2) or "") + "reloadOnce(",
                body,
                count=1,
            )
            wrapper = (
                "    /* " + MARK + " · reload 并发保护\n"
                "     *\n"
                "     * 原实现没有任何互斥。reload 会读全部文档、再对每篇并发取\n"
                "     * 关联事项文本；两次调用重叠时，赋值的落地顺序取决于哪次先\n"
                "     * resolve —— 后启动却先返回的那次，会被随后返回的旧数据覆盖。\n"
                "     * 紧接着的 sanitize 又基于这份可能过期的 id 列表去裁剪布局，\n"
                "     * 理论上能把刚打开的分栏裁掉。\n"
                "     *\n"
                "     * 同一时刻只允许一个在飞；期间的新请求不排队、只置标志，\n"
                "     * 结束后补跑一次。合并而非排队 —— 中间那些结果没人关心。\n"
                "     */\n"
                "    async reload() {\n"
                "      if (this.reloadInFlight) {\n"
                "        this.reloadPending = true;\n"
                "        return;\n"
                "      }\n"
                "\n"
                "      this.reloadInFlight = true;\n"
                "\n"
                "      try {\n"
                "        await this.reloadOnce();\n"
                "      } finally {\n"
                "        this.reloadInFlight = false;\n"
                "\n"
                "        if (this.reloadPending) {\n"
                "          this.reloadPending = false;\n"
                "          await this.reload();\n"
                "        }\n"
                "      }\n"
                "    },\n"
                "\n"
                "    /* 窗口聚焦去抖：桌面端切换应用会连续触发，每次都是全量读取。 */\n"
                "    onWindowFocus() {\n"
                "      clearTimeout(this.focusReloadTimer);\n"
                "\n"
                "      this.focusReloadTimer = setTimeout(() => {\n"
                "        this.reload().catch((error) => console.error(error));\n"
                "      }, 400);\n"
                "    },\n"
                "\n"
            )
            buf[REL] = current[:start] + wrapper + renamed + current[end:]
            ok(REL, "reload 改为 reloadOnce 加互斥包装")

            current = read(REL)
            m = re.search(
                r"(?m)^([ \t]*)data\(\)[ \t]*\{\n[ \t]*return[ \t]*\{\n", current
            )
            if m:
                pad = m.group(1) + "    "
                fields = (
                    pad + "/* " + MARK + "：reload 互斥标志。放在 data 里是为了随\n"
                    + pad + "   实例销毁，避免模块级变量在多实例之间串味。 */\n"
                    + pad + "reloadInFlight: false,\n"
                    + pad + "reloadPending: false,\n"
                    + pad + "focusReloadTimer: null,\n"
                )
                buf[REL] = current[: m.end()] + fields + current[m.end():]
                ok(REL, "data 补 reload 互斥标志")
            else:
                skip(
                    REL,
                    "data 补 reload 互斥标志",
                    "找不到 data 返回对象，标志会退化为非响应式实例属性，功能仍正确",
                )

    sub(
        REL,
        'window.addEventListener("focus", this.reload);',
        'window.addEventListener("focus", this.onWindowFocus);',
        "窗口聚焦监听改为去抖版",
    )
    sub(
        REL,
        'window.removeEventListener("focus", this.reload);',
        'window.removeEventListener("focus", this.onWindowFocus);\n'
        "    clearTimeout(this.focusReloadTimer);",
        "对应解绑并清理定时器",
    )

    # 只报告，不擅动
    current = read(REL)
    hits = find_selector_lines(current, "focus-workspace-header")
    if len(hits) > 1:
        print("\n  〔报告〕focus-workspace-header 相关规则 " + str(len(hits)) + " 条：")
        for start, _end, sel in hits:
            line_no = current[:start].count("\n") + 1
            print("          行 " + str(line_no).rjust(5) + "  " + sel)
        print("          合并会改变层叠结果，我没有读到这几条的完整原文，")
        print("          因此不做自动合并 —— 请照行号人工归并。")

# ══════════════════════════════════════════════════════════════
print("\n[6/6] 其余 Teleport 浮层挂焦点守卫")
# ══════════════════════════════════════════════════════════════
for rel, name in [
    ("src/views/focusDocuments/FocusColumnInserter.vue", "FocusColumnInserter"),
    ("src/views/focusDocuments/FocusDocumentDialog.vue", "FocusDocumentDialog"),
    ("src/views/focusDocuments/FocusDirectoryBrowser.vue", "FocusDirectoryBrowser"),
]:
    current = read(rel)
    if current is None:
        skip(rel, name + " 挂守卫", "文件不存在")
        continue
    if "focusOwnership" in current:
        skip(rel, name + " 挂守卫", ALREADY)
        continue
    if "Teleport" not in current:
        skip(rel, name + " 挂守卫", "未使用 Teleport，不受 focustrap 影响")
        continue

    anchor = 'export default {\n  name: "' + name + '",'
    if current.count(anchor) != 1:
        skip(rel, name + " 挂守卫", "找不到 name 声明，需手工添加两行")
        continue
    if current.count("<script>\n") != 1:
        skip(rel, name + " 挂守卫", "script 标签不唯一")
        continue

    patched = current.replace(
        anchor,
        "/* " + MARK + " · 焦点守卫\n"
        "   本组件 Teleport 到 body，一旦在 Bootstrap modal 打开期间被唤起，\n"
        "   内部输入框会拿不到焦点。成因与修法见 mixin 注释。\n"
        "   若根元素的 ref 不叫 panel 或 dialog，请覆写 focusOwnershipRoot。 */\n"
        'export default {\n  name: "' + name + '",\n\n'
        "  mixins: [focusOwnership],",
        1,
    )
    patched = patched.replace(
        "<script>\n",
        "<script>\nimport focusOwnership from "
        + chr(34) + "../../mixins/focusOwnership" + chr(34) + ";\n",
        1,
    )
    buf[rel] = patched
    ok(rel, name + " 挂守卫")

# ══════════════════════════════════════════════════════════════
# 写盘前校验 —— 这是本版与前两版的关键差别
# ══════════════════════════════════════════════════════════════
print("\n[校验] 写盘前逐个文件做语法检查")

NODE = shutil.which("node")
if not NODE:
    print("  !  找不到 node，跳过 node --check（仅做标签与括号比对）")


def script_block(text):
    m = re.search(r"<script[^>]*>", text)
    if not m:
        return None
    j = text.rfind("</script>")
    if j <= m.end():
        return None
    return text[m.end(): j]


def node_check(code):
    if not NODE:
        return (True, "")
    handle, path = tempfile.mkstemp(suffix=".mjs")
    os.close(handle)
    try:
        with io.open(path, "w", encoding="utf-8") as out:
            out.write(code)
        proc = subprocess.run(
            [NODE, "--check", path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if proc.returncode == 0:
            return (True, "")
        message = (proc.stderr or b"").decode("utf-8", "replace")
        lines = [ln for ln in message.split("\n") if ln.strip()][:6]
        return (False, "\n        ".join(lines))
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


failures = []

for rel in sorted(buf):
    if rel == ".gitignore" or rel.endswith(".scss"):
        print("  ok  " + rel + "  〔纯文本，免检〕")
        continue

    new_text = buf[rel]
    old_text = orig.get(rel, "")

    if rel.endswith(".vue"):
        for tag in ["<template>", "</template>", "<script>", "</script>", "<style", "</style>"]:
            if new_text.count(tag) != old_text.count(tag):
                failures.append((rel, "标签数量变化：" + tag))
        before = old_text.count("{") - old_text.count("}")
        after = new_text.count("{") - new_text.count("}")
        if before != after:
            failures.append(
                (rel, "花括号平衡从 " + str(before) + " 变为 " + str(after))
            )
        code = script_block(new_text)
        if code is None:
            failures.append((rel, "取不到 script 段"))
        else:
            good, detail = node_check(code)
            if not good:
                failures.append((rel, "script 段语法错误:\n        " + detail))
    else:
        good, detail = node_check(new_text)
        if not good:
            failures.append((rel, "语法错误:\n        " + detail))

    if not [row for row in failures if row[0] == rel]:
        print("  ok  " + rel)
    else:
        print("  XX  " + rel)

bar = "=" * 64

if failures:
    print("\n" + bar)
    print("校验未通过，整批放弃写盘。磁盘上的文件一个字节都没改。")
    for rel, why in failures:
        print("\n  X " + rel)
        print("    " + why)
    print("\n涉及该文件的改动项（怀疑对象）：")
    for rel, label, _detail in done:
        if rel in [row[0] for row in failures]:
            print("  · " + label)
    print(bar)
    sys.exit(1)

if not done:
    sys.exit("\n没有任何改动可落地〔可能补丁已打过〕。未写盘。")

stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
backup = os.path.join(ROOT, ".ui-patch-backup", stamp + "-v12")
os.makedirs(backup, exist_ok=True)
for rel in buf:
    source = os.path.join(ROOT, rel)
    if not os.path.isfile(source):
        continue
    target = os.path.join(backup, rel)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    shutil.copy2(source, target)

for rel, content in buf.items():
    with io.open(os.path.join(ROOT, rel), "w", encoding="utf-8") as out:
        out.write(content)

print("\n" + bar)
print("落地 " + str(len(done)) + " 项，跳过 " + str(len(skipped)) + " 项")
print("备份：" + os.path.relpath(backup, ROOT))
if skipped:
    print("\n跳过明细〔标注 " + ALREADY + " 的无需处理，其余需人工确认〕：")
    for rel, label, why in skipped:
        print("  ! " + label + "  ->  " + why)
        print("      " + rel)
print("\n下一步：")
print("  yarn electron:compile && yarn electron:preview")
print(bar)
