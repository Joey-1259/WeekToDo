/* FOCUS_OWNERSHIP_MIXIN_20260911_V1 */

/**
 * 浮层焦点归属守卫。
 *
 * ── 背景 ────────────────────────────────────────────────────────
 * Bootstrap 5.3 util/focustrap.js 的核心逻辑：
 *
 *   activate() {
 *     EventHandler.on(document, EVENT_FOCUSIN, e => this._handleFocusin(e))
 *   }
 *   _handleFocusin(event) {
 *     const { trapElement } = this._config
 *     if (event.target === document || event.target === trapElement
 *         || trapElement.contains(event.target)) return
 *     SelectorEngine.focusableChildren(trapElement)[0].focus()
 *   }
 *
 * 监听挂在 document 的【冒泡】阶段，凡是落在 trapElement 子树之外的
 * 焦点一律被拽回 modal 的第一个可聚焦子元素。
 *
 * 任何 Teleport 到 body 的浮层天生在那棵子树之外，于是只要它是在某个
 * Bootstrap modal 打开期间被唤起的，里面的输入框就永远拿不到焦点 ——
 * 用户看到弹层好好地盖在上面，键入却全部落进了被遮住的字段。
 *
 * ── 修法 ────────────────────────────────────────────────────────
 * 在 document 的【捕获】阶段先行截断。捕获先于冒泡，Bootstrap 的
 * handler 因此永远收不到该事件。
 *
 * 明确不采用的两条路：
 *   · data-bs-focus="false" —— 会永久废掉宿主 modal 的焦点陷阱，
 *     普通场景下 Tab 就能跑出弹窗，是拿无障碍换便利。
 *   · 读写 modal._focustrap —— 私有字段，任何小版本升级都可能失效。
 *
 * ── 用法 ────────────────────────────────────────────────────────
 *   import focusOwnership from "@/mixins/focusOwnership";
 *
 *   export default {
 *     mixins: [focusOwnership],
 *     // 约定：把浮层根元素标为 ref="panel"。
 *     // 若用别的名字，覆写 focusOwnershipRoot() 返回该元素。
 *   };
 *
 * 组件可选覆写：
 *   focusOwnershipRoot()     -> Element | null   守卫范围的根
 *   focusOwnershipEnabled()  -> boolean          临时让开（如关闭动画期间）
 */

/* 抢回焦点的限额。宁可让焦点跑掉，也绝不制造无限抢焦循环 ——
   两个都想"把焦点抢回自己"的守卫会把主线程打满。 */
const MAX_STRIKES = 3;
const STRIKE_WINDOW = 400;

export default {
  data() {
    return {
      /* 加 fo_ 前缀避免与宿主组件的字段撞名。mixin 的 data 会与
         组件 data 合并，同名时组件优先 —— 那种覆盖是静默的。 */
      fo_lastInside: null,
      fo_strikes: 0,
      fo_strikeTimer: null,
      fo_standDown: false,
    };
  },

  mounted() {
    /* 顺序要紧：守卫必须先于组件自己的首次 focus() 注册，
       否则第一次聚焦就已经被抢掉了。mixin 的 mounted 先于
       组件的 mounted 执行，正好满足。 */
    document.addEventListener(
      "focusin",
      this.fo_onFocusinCapture,
      true
    );
  },

  beforeUnmount() {
    document.removeEventListener(
      "focusin",
      this.fo_onFocusinCapture,
      true
    );

    clearTimeout(this.fo_strikeTimer);
    this.fo_strikeTimer = null;
  },

  methods: {
    /** 默认约定 ref="panel"；组件可覆写。 */
    focusOwnershipRoot() {
      return this.$refs.panel || this.$refs.dialog || this.$el || null;
    },

    focusOwnershipEnabled() {
      return !this.fo_standDown;
    },

    /**
     * 主动让开。关闭流程里调用：此时父级往往要把焦点交还给触发按钮，
     * 守卫再去抢焦就会和它打架。
     */
    releaseFocusOwnership() {
      this.fo_standDown = true;
    },

    fo_onFocusinCapture(event) {
      if (!this.focusOwnershipEnabled()) return;

      const root = this.focusOwnershipRoot();
      if (!root || !root.isConnected) return;

      const target = event.target;
      const inside = target === root || root.contains(target);

      /* body / documentElement / document 这一类"中性落点"也必须拦。
         点击浮层自身的内边距时焦点会落到 body，放过去的话焦点就被
         吸回背后的 modal，用户的下一个按键会写进错误的字段。 */
      const neutral =
        target === document ||
        target === document.body ||
        target === document.documentElement;

      if (inside || neutral) {
        if (inside) this.fo_lastInside = target;

        /* 只 stopPropagation，不 stopImmediatePropagation ——
           后者会连同其它同阶段的正当监听一起掐掉。
           Bootstrap 在冒泡阶段，stopPropagation 已足够。 */
        event.stopPropagation();
      }

      if (inside) return;

      /* 防线二：焦点确实被别处夺走时拉回来（比如将来某个库也改用
         捕获阶段）。受 MAX_STRIKES / STRIKE_WINDOW 限额约束。 */
      if (this.fo_strikes >= MAX_STRIKES) return;

      this.fo_strikes += 1;

      clearTimeout(this.fo_strikeTimer);
      this.fo_strikeTimer = setTimeout(() => {
        this.fo_strikes = 0;
      }, STRIKE_WINDOW);

      const back =
        this.fo_lastInside && root.contains(this.fo_lastInside)
          ? this.fo_lastInside
          : root.querySelector(
              "textarea, input, [contenteditable='true'], button"
            ) || root;

      if (back && typeof back.focus === "function") back.focus();
    },
  },
};
