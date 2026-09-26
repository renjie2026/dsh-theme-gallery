/**
 * 引导路径的端到端桩测试。
 *
 * 为什么需要
 * ----------
 * 皮肤颜色"重启后不出现、点一下菜单才出现"这个问题，
 * 反复卡在"某个门静默拒绝执行"上，而静态断言看不出门有没有真的打开。
 * 本文件用桩上下文把 `apply` 跑起来，模拟侧栏已经挂载，然后检查：
 *
 *   1. 引导是否真的完成（`bootSettled` 被置位）
 *   2. 皮肤是否真的被尝试应用（`setTheme` 收到过那个 id）
 *   3. 是否记录了决策事件（探针本身要工作，否则下次又看不见）
 *
 * 这是**行为测试**，与 `check-tdz-*` 的静态审计互补：
 * 静态审计回答"代码里有没有明显的顺序错误"，
 * 本文件回答"把它跑起来，门到底开没开"。
 *
 * 运行：node tests/check-boot-path.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

let failed = 0

/**
 * 断言一条。
 * @param label - 检查项。
 * @param condition - 结果。
 */
function check(label, condition) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
}

/** 加载 client bundle，拿到它的 exports。 */
function loadBundle(window_, document_, recordJsx = () => {}, bundleSource = source) {
  const registrations = []
  const windowStub = {
    ...window_,
    __ModuleLoader__: { load: (spec) => registrations.push(spec) },
  }
  /**
   * 种子模块桩。
   *
   * `defineStore` 必须返回带 `create()` 的句柄 —— `mountGallery` 会立刻调用它来固定
   * 单例（`handle.create()` 每次返回**新实例**，所以代码把它钉住）。
   * 少这一个方法，整个挂载就会被 guard 拦下，引导根本走不到注册主题那一步。
   * @param id - 模块 id。
   * @returns 最小替身。
   */
  const seed = (id) => {
    if (id === '@deepseek-ai/dsh-client-store') {
      const state = { themes: [], selected: undefined, note: undefined, revision: 0 }
      return {
        defineStore: () => ({
          create: () => ({
            getState: () => state,
            setState: (patch) => { Object.assign(state, patch) },
            subscribe: () => () => {},
            actions: {
              sync() {}, note() {}, select() {},
            },
          }),
        }),
      }
    }
    if (id === 'react') return { createElement: () => null, useState: () => [undefined, () => {}] }
    // The jsx runtime records what the page BUILT, so a test can reach the very props the
    // shell would hand to a card — including its click handler. Returning `null` (as before)
    // is still correct: nothing here renders, only the element descriptions are collected.
    if (id === 'react/jsx-runtime') {
      const record = (type, props, key) => { recordJsx({ type, props, key }); return null }
      return { jsx: record, jsxs: record, Fragment: null }
    }
    return {}
  }
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'require', bundleSource)(windowStub, document_, seed)
  return registrations[0].factory(seed)
}

/**
 * 一个能撑住引导路径的 document 桩。
 *
 * 重点是 `querySelector` 能返回一个"有布局"的侧栏列 —— 引导门就靠它判断外壳是否就绪。
 * @returns 桩 document 与记录到的样式写入。
 */
function documentStub() {
  /**
   * Every scene write, in order.
   *
   * The scene is supposed to be drawn into exactly ONE container. Two containers existed while
   * the painting defect was being investigated — a `#dsh-theme-ambient` seat and the
   * `.dsh-amb-control` layer — and because both were real, every animated element appeared twice.
   * Counting writes at runtime catches that; counting `innerHTML` occurrences in the source does
   * not, since a duplicate path can reach the same assignment.
   */
  const innerHTMLWrites = []

  /**
   * 每一次节点移除，按顺序记下来。
   *
   * 桩原先的 `remove()` 是空函数，于是"装饰层被删掉"这件事**完全不可观测** —— 而切换主题时
   * "该不该清掉上一套皮肤的素材"正是靠它判断的（用户明确要求保留那份素材）。
   * 桩缺少真实副作用 = 缺陷测不出来（规则 8）。
   */
  const removals = []

  /** 侧栏列：`getBoundingClientRect` 返回真实感的矩形。 */
  const column = {
    className: 'ZTP-Xa_sidebarCol',
    childElementCount: 3,
    dataset: {},
    style: { setProperty() {}, getPropertyValue: () => '' },
    getBoundingClientRect: () => ({
      left: 0, top: 40, right: 280, bottom: 910, width: 280, height: 870,
      x: 0, y: 40,
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    append() {},
    appendChild() {},
    setAttribute() {},
    remove() {},
    closest: () => null,
  }
  /** 装饰层节点。 */
  const makeNode = (tag) => ({    tagName: String(tag).toUpperCase(),
    id: '', className: '',
    dataset: {},
    attributes: new Map(),
    style: { setProperty() {}, getPropertyValue: () => '' },
    children: [], childElementCount: 0, firstElementChild: null,
    // Records every scene write, which is how a remaining "drawn twice" path would be caught.
    _html: '',
    get innerHTML() { return this._html },
    set innerHTML(value) {
      this._html = String(value)
      innerHTMLWrites.push({ tag: this.tagName, len: this._html.length })
    },
    textContent: '',
    getBoundingClientRect: () => ({
      left: 0, top: 620, right: 280, bottom: 850, width: 280, height: 230, x: 0, y: 620,
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    append() {}, appendChild() {}, replaceChildren() {},
    setAttribute(name, value) { this.attributes.set(name, String(value)) },
    getAttribute(name) { return this.attributes.get(name) ?? null },
    removeAttribute(name) { this.attributes.delete(name) },
    hasAttribute(name) { return this.attributes.has(name) },
    _removed: false,
    remove() {
      if (this._removed) return
      this._removed = true
      removals.push({ id: this.id, className: String(this.className) })
    },
    closest: () => null,
  })
  const body = makeNode('body')
  body.style = {
    _v: new Map(),
    setProperty(name, value) { this._v.set(name, String(value)) },
    getPropertyValue(name) { return this._v.get(name) ?? '' },
    removeProperty(name) { this._v.delete(name) },
  }
  const head = makeNode('head')
  const documentElement = makeNode('html')

  /**
   * Every node `createElement` has produced, so `querySelector` can find them by class.
   *
   * Without this the stub answered `null` for `.dsh-amb-control`, `drawScene` created a fresh
   * layer on every pass, and the scene was never observable — which is how the write counter
   * first reported zero.
   */
  const created = []

  /**
   * 按选择器找出仍未被移除的节点。
   *
   * `querySelectorAll` 原先恒返回 `[]`，于是 `removeAllAmbientSeats()`（以及任何按选择器
   * 清理装饰节点的代码）在桩里**什么都不做** —— 一个"清空装饰层"的改动可以在桩里悄悄通过。
   * 这里按插件真正用到的两类选择器作答，让"移除了什么"变成可断言的事实。
   * @param selector - 选择器文本。
   * @returns 匹配的节点数组。
   */
  const findAll = (selector) => {
    if (typeof selector !== 'string') return []
    const alive = created.filter((node) => !node._removed)
    if (selector.includes('#dsh-theme-ambient')) {
      return alive.filter((node) => node.id === 'dsh-theme-ambient')
    }
    if (selector.includes('.dsh-amb-control')) {
      return alive.filter((node) =>
        String(node.className).split(' ').some((name) => name.startsWith('dsh-amb-control')))
    }
    return []
  }

  /** 当前装饰层里的场景标记（最后一个场景盒），没有时返回 null。 */
  const sceneHtml = () => {
    const boxes = created.filter((node) => !node._removed
      && String(node.className).split(' ').includes('dsh-amb-control-scene'))
    return boxes.length === 0 ? null : boxes[boxes.length - 1]._html
  }

  const document_ = {
    head, body, documentElement,
    visibilityState: 'visible',
    createElement: (tag) => {
      const node = makeNode(tag)
      created.push(node)
      return node
    },
    querySelector(selector) {
      if (typeof selector !== 'string') return null
      if (selector.includes('sidebarCol')) return column
      // The ambient stylesheet is installed with `dataset.pluginCss` and looked up by attribute.
      // Answering `null` here made `ensureAmbientStylesheet` create a fresh sheet on every pass,
      // and because `syncAmbient` bails out while the sheet is "absent", the scene was never
      // drawn at all — the stub, not the plugin, was hiding the code path under test.
      if (selector.includes('style[data-plugin-css')) {
        const wanted = /data-plugin-css="([^"]+)"/.exec(selector)?.[1]
        return created.find((n) => n.tagName === 'STYLE' && n.dataset.pluginCss === wanted) ?? null
      }
      // Class lookups: match what the plugin actually assigns via `className`.
      for (const className of ['.dsh-amb-control-scene', '.dsh-amb-control']) {
        if (selector.includes(className)) {
          const wanted = className.slice(1)
          return created.find((n) => String(n.className).split(' ').includes(wanted)) ?? null
        }
      }
      if (selector.includes('#dsh-theme-ambient')) {
        return created.find((n) => n.id === 'dsh-theme-ambient') ?? null
      }
      return null
    },
    querySelectorAll: (selector) => findAll(selector),
    addEventListener() {}, removeEventListener() {},
  }
  return { document_, body, innerHTMLWrites, removals, sceneHtml }
}

/**
 * 装上浏览器观察器桩。
 *
 * Node 里没有 `MutationObserver` / `ResizeObserver`，而场景 effect 的第一行就是
 * `typeof MutationObserver === 'undefined'` 时直接返回 —— 于是"几何稳定"循环从未建立、
 * `bootSettled` 永不置位。这不是插件的问题，而是桩不完整：
 * 只有把这两个全局补齐，引导路径才真的被走到。
 * @returns 一个还原函数。
 */
function installObserverStubs() {
  const saved = {
    MutationObserver: globalThis.MutationObserver,
    ResizeObserver: globalThis.ResizeObserver,
  }
  /** 只记录回调，不自动触发；由测试自行驱动。 */
  class MutationObserverStub {
    constructor(callback) { this.callback = callback }
    observe() {}
    disconnect() {}
    takeRecords() { return [] }
  }
  class ResizeObserverStub {
    constructor(callback) { this.callback = callback }
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  globalThis.MutationObserver = MutationObserverStub
  globalThis.ResizeObserver = ResizeObserverStub
  return () => {
    if (saved.MutationObserver === undefined) delete globalThis.MutationObserver
    else globalThis.MutationObserver = saved.MutationObserver
    if (saved.ResizeObserver === undefined) delete globalThis.ResizeObserver
    else globalThis.ResizeObserver = saved.ResizeObserver
  }
}

/**
 * 跑一次引导，返回观测结果。
 * @param options - 配置。
 * @param options.activeId - 主题服务一开始报告的活动主题。
 * @param options.presenterDelayTicks - 表现层要过多少个 tick 才开始写令牌（模拟它晚挂载）。
 * @param options.config - 组合配置（`ambient: false` 是急停开关）。
 * @param options.seedSkin - 预置的「记住的皮肤」；`null` 表示全新安装（从未选过）。
 * @param options.seedBuiltIn - 预置的「用户在面板里选过内置外观」标记。
 * @param options.wireSlots - 是否让 `slots.inject('main', …)` 真的执行回调，
 *   从而拿到页面 `inject` 面（`setTheme`）—— 用来测"点卡片"这条真实入口。
 * @param options.bundleSource - 用哪份源码加载 bundle（缺省即真实文件）。
 *   存在的理由是**反证**：把源码改坏再从改坏的源码跑一遍，确认断言真的会失败。
 * @returns 观测到的 setTheme 调用、探针文字、以及主题服务状态。
 */
function runBoot({
  activeId = 'light',
  presenterDelayTicks = 3,
  config,
  seedSkin = 'shan-qing-ting-cai',
  seedBuiltIn,
  wireSlots = false,
  bundleSource = source,
} = {}) {
  const restoreObservers = installObserverStubs()
  try {
  const { document_, body, innerHTMLWrites, removals, sceneHtml } = documentStub()
  const setThemeCalls = []
  let accentLayers = 0
  const registrations = []
  /** 页面构建过的所有元素描述（jsx 桩记录），用来拿到卡片真实的 props。 */
  const jsxCalls = []
  /** 等待表现层写入的皮肤。 */
  const pendingPaints = []

  // 主题服务桩：只记录调用，并在 setTheme 时同步更新 active。
  const themeState = { active: { id: activeId, tokens: {} } }
  const builtinThemes = [
    { id: 'light', label: 'Light', colorScheme: 'light', tokens: {} },
    { id: 'dark', label: 'Dark', colorScheme: 'dark', tokens: {} },
    { id: 'system', label: 'System', colorScheme: 'light', tokens: {} },
  ]
  // 本插件提供的皮肤 id：表现层对它们都是慢写入（桩里按此建模）。
  const SKIN_IDS = [
    'meng-hai-you-yu',
    'shan-qing-ting-cai',
    'ying-mu-cai-yun',
    'pei-an-jie-xin',
    'hu-po-mao-mi',
    'hu-zi-a-huang',
  ]

  const timers = []
  const windowStub = {
    _: null,
    localStorage: {
      store: new Map(),
      getItem(k) { return this.store.get(k) ?? null },
      setItem(k, v) { this.store.set(k, String(v)) },
      // 真实浏览器的 localStorage 有 removeItem —— 桩里缺了它，插件"点内置卡先清掉记住的皮肤"
      // 这一步会抛 TypeError（被插件自己的 catch 记下来，于是症状只是"点了没反应"）。
      // 桩缺少真实副作用 = 缺陷测不出来，这个坑本仓库记录在规则 8。
      removeItem(k) { this.store.delete(k) },
      clear() { this.store.clear() },
    },
    innerHeight: 950,
    addEventListener() {}, removeEventListener() {},
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length },
    clearTimeout: () => {},
    requestAnimationFrame: (fn) => { timers.push({ fn, delay: 0 }); return timers.length },
  }
  windowStub.window = windowStub

  /**
   * Emit `theme/change` to the plugin's subscribers.
   *
   * Both writers in the real service (`setTheme`, `overrideTokens`) do this, so the stub must too
   * — otherwise the self-driving cycle (write → emit → subscribe → write) cannot be reproduced
   * here, and the guard that breaks it would look unnecessary.
   */
  const changeHandlers = []
  const emitChange = () => {
    for (const handler of [...changeHandlers]) {
      try { handler(ctxTheme.getTheme()) } catch (error) { globalThis.__changeError = error }
    }
  }

  const ctxTheme = {
    getTheme: () => ({
      active: themeState.active,
      // Only the BUILT-IN themes are pre-registered. The skins must be contributed by this
      // plugin — listing them here made `contribute` skip them as "another provider's", which
      // is the opposite of what the real profile does.
      themes: [...builtinThemes],
      preference: 'system', fontSize: 14, revision: 1,
    }),
    register: (definition) => { registrations.push(definition); return () => {} },
    setTheme: (id) => {
      setThemeCalls.push(id)
      themeState.active = { id, tokens: {} }
      // ── THE PRESENTER IS MODELLED AS SLOW, BECAUSE IT IS ────────────────────
      //
      // In the real shell the tokens are written by ui-layout's presenter, which subscribes some
      // time AFTER boot. A stub that painted synchronously would make the boot-time request look
      // sufficient and hide the very race this file exists to catch. So the write is deferred by
      // `presenterDelayTicks` ticks — a skin requested while the presenter is not yet listening
      // is therefore missed, exactly as it is in the app.
      if (SKIN_IDS.includes(id)) {
        pendingPaints.push({ id, remaining: presenterDelayTicks })
      }
      // And it emits, like the real one. This is what closes the loop the guard must break.
      emitChange()
    },
    /**
     * Token layers, keyed by source, exactly as the official service keeps them.
     *
     * These are what the palette assertions are about: `adopt()` moves the PREFERENCE, but it
     * never touches this map — so a layer stacked here survives the shell reverting the theme.
     */
    overrides: new Map(),
    overrideTokens(source, tokens) {
      accentLayers += 1
      ctxTheme.overrides.set(source, tokens)
      // ── THE OFFICIAL METHOD EMITS, AND THAT EMISSION IS THE HAZARD ──────────
      //
      // `overrideTokens` calls `publish()` internally, so it emits `theme/change` synchronously
      // — and this plugin subscribes to that event. A stub that merely stored the layer would
      // hide the entire self-driving loop, which is the defect this file now guards.
      emitChange()
      const layer = ctxTheme.overrides.get(source)
      return () => {
        if (ctxTheme.overrides.get(source) === layer) {
          ctxTheme.overrides.delete(source)
          emitChange()
        }
      }
    },
  }

  /**
   * Simulate the shell adopting its persisted preference.
   *
   * This is what `ui-theme`'s `adopt()` does whenever the settings document changes: it copies
   * the PERSISTED value over the in-memory preference and republishes. The persisted value can
   * only ever be a built-in id, so this always reverts an active skin — which is why the colours
   * used to appear and then vanish, and why a single click on the skin was not enough.
   */
  const adoptPersistedPreference = () => {
    themeState.active = { id: 'light', tokens: {} }
  }

  /**
   * Advance the pretend presenter by one tick, writing any due palette to the body.
   *
   * The probe token is the one `skinIsPainted` reads back, so this is what turns "the service
   * asked for the skin" into "the document shows the skin".
   */
  const pumpPresenter = () => {
    if (pendingPaints.length === 0) return
    pendingPaints[0].remaining -= 1
    if (pendingPaints[0].remaining > 0) return
    const { id } = pendingPaints.shift()
    const definition = exports_.BUNDLED_THEMES?.find?.((t) => t.id === id)
    const gradient = definition?.tokens?.['--dsw-alias-bg-base']
    body.style.setProperty('--dsw-alias-bg-base', String(gradient ?? `skin:${id}`))
  }

  const exports_ = loadBundle(windowStub, document_, (call) => { jsxCalls.push(call) }, bundleSource)
  /**
   * 槽位注册记录。
   *
   * 页面是通过 `ctx.slots.inject('main', cb)` 注册的：`cb` 里才调用 `ctx.slots.register`，
   * 并把 `{ setTheme }` 作为页面的 `inject` 面交出去。默认（`wireSlots: false`）**不执行** `cb`，
   * 与旧行为完全一致；只有需要走"用户点卡片"这条真实入口时才执行它。
   */
  const slotRegistrations = []
  let mainInjectCallback
  const ctx = {
    theme: ctxTheme,
    // The composition config, as the loader hands it to the row. `ambient: false` is the kill
    // switch, and it has to be readable from BOTH the factory-level helpers and the mount body.
    config,
    locale: { register() {} },
    slots: {
      inject: (name, callback) => {
        if (wireSlots && name === 'main') {
          mainInjectCallback = callback
          callback()
        }
        return () => {}
      },
      register: (spec, component) => {
        slotRegistrations.push({ name: spec?.name, spec, component })
        return () => {}
      },
    },
    effect: (cb) => { try { cb() } catch (error) { globalThis.__bootError = error } return () => {} },
    // The subscription is REAL here: the plugin's echo guard is only meaningful if its own writes
    // actually reach it.
    on: (event, handler) => {
      if (event !== 'theme/change') return () => {}
      changeHandlers.push(handler)
      return () => {
        const at = changeHandlers.indexOf(handler)
        if (at >= 0) changeHandlers.splice(at, 1)
      }
    },
    inject() {},
  }

  // 预置上一次会话的选择。`seedSkin: null` = 全新安装（从未选过任何主题）；
  // `seedBuiltIn` = 用户在本面板里选过内置外观（浅色/深色），那是一次明确的选择。
  if (seedSkin !== null) windowStub.localStorage.setItem('theme-gallery:last-skin', seedSkin)
  if (seedBuiltIn !== undefined) {
    windowStub.localStorage.setItem('theme-gallery:built-in-choice', seedBuiltIn)
  }

  let applyError = null
  try { exports_.apply(ctx) } catch (error) { applyError = error }

  /**
   * 驱动桩定时器若干轮。
   *
   * 引导门由"几何稳定"循环推进，皮肤上色由"paintWatch"推进；每轮先推一下表现层，
   * 模拟它在若干 tick 之后才开始写令牌。
   * @param rounds - 最多推进多少轮（定时器排空即停）。
   */
  const drive = (rounds) => {
    for (let round = 0; round < rounds && timers.length > 0; round += 1) {
      pumpPresenter()
      const batch = timers.splice(0, timers.length)
      for (const t of batch) { try { t.fn() } catch { /* 桩环境忽略 */ } }
    }
    // 收尾再推几次，让最后一批写入落定。
    for (let i = 0; i < 5; i += 1) pumpPresenter()
  }

  drive(120)

  /** 页面组件（真实的那一个），以及它的 `inject` 面。 */
  const pageRegistration = () => {
    const page = slotRegistrations.find((entry) => entry.name === 'main')
    if (page === undefined) throw new Error('main 插槽没有注册（wireSlots 没打开？）')
    return page
  }

  /**
   * 页面的 `inject` 面，**解析一次就缓存**。
   *
   * 真实外壳在挂载页面时解析一次，把 `setTheme` 当成 prop 交下去；本桩若每次点击都重新解析，
   * 就会多出一次"以当前活动主题为内容"的 `publish()` —— 那一次会把刚被点击清掉的
   * `last-skin` 又写回去，于是**桩自己制造出**"点内置卡被弹回"的假象。
   * @returns `{ setTheme }`。
   */
  const pageFace = () => {
    const page = pageRegistration()
    if (page.face === undefined) page.face = page.spec.inject()
    return page.face
  }

  /**
   * 走**真实入口**点一张卡片。
   *
   * 渲染页面组件（jsx 桩只记录元素、不真的挂载），从记录里取出那张卡片的 props，
   * 再调用它的 `onSelect` —— 与用户点击调用的是同一个函数，包含"先记录选择"那一步。
   * @param id - 卡片对应的主题 id。
   */
  const clickCard = (id) => {
    const page = pageRegistration()
    const face = pageFace()
    page.component({
      t: (key) => key,
      setTheme: face.setTheme,
      useStore: (selector) => selector({
        ids: ['light', 'dark', 'ying-mu-cai-yun', 'shan-qing-ting-cai', 'meng-hai-you-yu'],
        labels: {}, descriptions: {}, swatches: {},
        selected: 'shan-qing-ting-cai', status: '', revision: 1,
      }),
      usePanelInfo: (selector) => selector({ activePanelId: 'theme-gallery' }),
    })
    const card = jsxCalls.find((call) => call.props?.id === id
      && typeof call.props?.onSelect === 'function')
    if (card === undefined) throw new Error(`卡片 ${id} 没有被渲染出来`)
    card.props.onSelect(id)
  }

  return {
    setThemeCalls, registrations, body, applyError, themeState, document_,
    accentLayers, innerHTMLWrites,
    paintedProbe: body.style.getPropertyValue('--dsw-alias-bg-base'),
    overrides: ctxTheme.overrides,
    adoptPersistedPreference,
    drive,
    clickCard,
    localStorage: windowStub.localStorage,
    jsxCalls,
    mainInjectCallback,
    removals,
    sceneHtml,
  }
  } finally {
    restoreObservers()
  }
}

// ── 引导必须真的完成，并把记住的皮肤应用上去 ─────────────────────────────────
const boot = runBoot({ activeId: 'light' })
check('apply 不抛错', boot.applyError === null)
check('皮肤被注册进主题服务',
  boot.registrations.some((d) => d.id === 'shan-qing-ting-cai'))
check('记住的皮肤被应用（setTheme 收到过它）',
  boot.setThemeCalls.includes('shan-qing-ting-cai'))

// ── 场景只能画一遍 ───────────────────────────────────────────────────────────
//
// Two render paths used to exist — a `#dsh-theme-ambient` seat and the `.dsh-amb-control` layer
// — and both produced real DOM, so every animated element appeared twice. On screen: duplicated
// dragonflies. This counts the writes that actually happen at runtime, which is what the eye
// sees; counting `innerHTML` occurrences in the source would not catch a second path reaching
// the same assignment.
check('场景只被写入一次（没有双份 DOM）', boot.innerHTMLWrites.length === 1)
check('写入的是真正的场景内容', (boot.innerHTMLWrites[0]?.len ?? 0) > 500)

// ── 上色必须**自己**发生，不能等别人来触发 ───────────────────────────────────
//
// 素材与配色属于同一个主题定义，却由不同的代码落地：素材由本插件直接写 DOM，配色必须由
// ui-layout 的表现层接收一次 `theme/change` 才会写到 body —— 而那个表现层晚挂载。
// 所以"素材自动出现、配色不出现"完全可以同时成立，真机上正是如此。
//
// 桩把表现层建模为**延迟若干 tick 才写令牌**。延迟刻意设得比"几何稳定"循环更长
// （那个循环约 100ms 就结束），因为那正是真机上的时间关系：表现层就绪时，
// 短命循环早已退出，只剩一个独立核对还能把它补上。
const tardy = runBoot({ activeId: 'light', presenterDelayTicks: 40 })
check('表现层晚于短命循环就绪时，配色仍会被补上（不依赖 publish）',
  tardy.paintedProbe !== '')
check('上色后不再重复请求',
  tardy.setThemeCalls.filter((id) => id === 'shan-qing-ting-cai').length <= 4)

// 反证：表现层始终不写令牌，就不该被"补上" —— 证明上面那条断言测的是真实通道，
// 而不是别的东西顺手把颜色刷上去了。
const never = runBoot({ activeId: 'light', presenterDelayTicks: 100000 })
check('表现层始终不就绪时不会假装成功', never.paintedProbe === '')
check('核对窗口有限，不会无限重试', never.setThemeCalls.length <= 60)

// ── 皮肤配色必须能扛住外壳"采纳持久化偏好" ───────────────────────────────────
//
// 这是用户报告的最后一种现象：颜色**先出现、随后消失**，而且**只点一次皮肤不够**。
//
// 机制：`ui-theme` 的 `adopt()` 在设置文档变化时，把**持久化的偏好**（只可能是内置值）
// 拷回内存并且重新发布 —— 于是刚设好的皮肤被改回内置主题。屏幕上是"闪一下又没了"。
//
// 由于 `setTheme` 只写内存偏好，它必然会被这一步覆盖；只有 `overrideTokens` 的**层**
// 不在 `adopt()` 的管辖范围内。所以断言：即使外壳采纳了内置偏好，
// **皮肤的令牌层依然在**，颜色不会消失。
const reverted = runBoot({ activeId: 'light', presenterDelayTicks: 0 })
const hadLayer = reverted.overrides.has('theme-gallery: palette')
check('皮肤令牌层已叠加', hadLayer)
// 外壳随后把活动主题改回内置值
reverted.adoptPersistedPreference()
check('外壳把主题改回内置后，令牌层仍在（颜色不会被撤掉）',
  reverted.overrides.has('theme-gallery: palette'))
check('令牌层带着皮肤的探针令牌',
  typeof reverted.overrides.get('theme-gallery: palette')?.['--dsw-alias-bg-base']?.light === 'string')

// ── 活动主题一开始就是皮肤时，也要确认文档真的上色 ───────────────────────────
const already = runBoot({ activeId: 'shan-qing-ting-cai' })
check('活动主题已是皮肤时不会反复 setTheme',
  already.setThemeCalls.filter((id) => id === 'shan-qing-ting-cai').length <= 2)

// ── 激活态标记必须真的叠加 ───────────────────────────────────────────────────
//
// `syncAccent` 是工厂级辅助函数，却曾引用只在挂载体内存在的 `ctx`：
// 每次调用都抛 `ReferenceError: ctx is not defined`，被调用方的 `try` 吞掉，
// 于是"主题特征色激活态标记"这一整个功能**从未生效**，而且不报错。
// 这里断言它真的走到了 `overrideTokens`。
check('激活态标记真的叠加了（overrideTokens 被调用）',
  already.accentLayers > 0 || boot.accentLayers > 0)

// ── 引导完成这件事必须被记录，否则诊断看不到门有没有开 ───────────────────────
//
// 这是本次事故的直接教训：门静默拒绝执行时，日志里什么都没有。
const probeSource = source
check('引导就绪会被记录', /noteAmbientEvent\('外壳就绪'\)/.test(probeSource))
check('"等待外壳"的拒绝会被记录', /noteAmbientEvent\('等待外壳'/.test(probeSource))
check('跳转被限流这件事会被记录', /noteAmbientEvent\('跳转已用尽'|noteAmbientEvent\('未上色·跳转一次'/.test(probeSource))
check('置为皮肤这一步会被记录', /noteAmbientEvent\('置为皮肤'/.test(probeSource))
check('已上色状态会被记录', /noteAmbientEvent\('已上色'/.test(probeSource))
check('日志带页面启动锚点，晚启动可见', /page: sincePageStart\(\)/.test(probeSource))

// ── 跑飞：写入次数必须有界 ───────────────────────────────────────────────────
//
// 真机上 renderer 涨到 11 GB、305 秒烧掉 820 秒 CPU，根因是**自激环**：
//
//     publish → syncSkin → overrideTokens → theme/change → publish → …
//
// 这条路不让出事件循环，所以不是"慢"而是"转" —— 主进程/GPU 全正常、不抛异常、不写崩溃日志。
//
// ── 关于这两条断言能证明什么、不能证明什么 ──────────────────────────────────
//
// 我试过"去掉自激保护看计数是否爆炸"来反证，结果是**计数不变**：这个桩里
// `stackSkinTokens` 先写好 `stackedSkin` 才发事件，重入时被自己的 `id === stackedSkin`
// 挡住了。真实自激发生在"清空 `stackedSkin`"与"`overrideTokens()` 返回"之间那一瞬，
// 那是一个时序，桩复现不了。所以这两条断言**不能**证明自激保护是必需的。
//
// 能证明的是（也就是用户报告里要求的第②条）：**全局预算与冷却生效**。
// 把 `requestTheme` 的预算去掉后，下面的 setTheme 计数会超出上限 —— 那才是可验证的部分。
check('令牌层叠加次数有界（不随发布次数增长）', boot.accentLayers <= 20,
  `实际 ${boot.accentLayers} 次`)
check('setTheme 调用次数受全局预算约束', boot.setThemeCalls.length <= 12,
  `实际 ${boot.setThemeCalls.length} 次`)
// 预算是按会话计数的常量，且冷却存在 —— 两者都在源码里可查，
// 因为"每次发布都调用一次"正是旧代码无上限的原因。
check('存在全局写入预算与冷却', /THEME_WRITE_BUDGET/.test(probeSource)
  && /THEME_WRITE_COOLDOWN_MS/.test(probeSource))
check('预算耗尽后安静停止', /主题写入预算耗尽/.test(probeSource))
check('自激写入被标记（emitting 守卫）', /selfEmitDepth > 0/.test(probeSource)
  && /function emitting\(/.test(probeSource))

// ── 紧急刹车：`config.ambient = false` 必须停掉两层 ──────────────────────────
//
// 这是用户报告里要求的第④条。之所以必要：插件出问题时唯一可用的杠杆是把它从
// `dsh.profile.bundles` 摘掉，而桌面端那个清单**不是手写的** —— 每次插件安装/启用/优化后
// 应用都会按 `dependencies` 里声明了 `dsh.bundle.patch` 的包自动推导重建，删了会被写回来。
// 插件侧此前没有任何刹车。
const off = runBoot({ activeId: 'light', config: { ambient: false } })
check('ambient:false 时不再应用皮肤（不发 setTheme）', off.setThemeCalls.length === 0,
  `实际 ${off.setThemeCalls.length} 次`)
check('ambient:false 时不再叠加令牌层', off.overrides.size === 0)
check('ambient:false 时不再绘制装饰', off.innerHTMLWrites.length === 0)
// 反向：省略配置必须保持原样，不能因为"读不到配置"就把功能关掉。
const on = runBoot({ activeId: 'light' })
check('省略配置时功能保持开启（与旧行为一致）', on.innerHTMLWrites.length > 0)

// ── 全新安装要默认落到山青婷彩 ───────────────────────────────────────────────
//
// 用户的要求：激活本插件后默认使用山青婷彩。此前"从未选过任何主题"时插件什么都不做，
// 新装用户看到的是系统默认主题，得自己去面板里点一下。
//
// wireSlots 打开，是为了让 `theme/change` 订阅真的存在（真实应用里它就是存在的）：
// 默认皮肤的落地要靠"服务报告皮肤 → 记入 localStorage"这条回路被走完。
const fresh = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true })
check('全新安装：默认请求山青婷彩', fresh.setThemeCalls.includes('shan-qing-ting-cai'),
  `实际 ${fresh.setThemeCalls.join(',') || '(无)'}`)
check('全新安装：默认皮肤的配色真的写上了文档',
  fresh.paintedProbe === 'skin:shan-qing-ting-cai', `实际 ${fresh.paintedProbe || '(空)'}`)
// 默认皮肤特意**不写** last-skin：它每一步都由"没有选择"推导出来。写进去反而会把
// 一次默认固化成一个"用户的选择"，之后用户改用系统设置里的外观就再也退不出来了。
check('全新安装：不把默认写进 last-skin（免得把默认固化成用户选择）',
  fresh.localStorage.getItem('theme-gallery:last-skin') === null)
check('全新安装：默认皮肤的令牌层已叠加（颜色确实在生效）',
  fresh.overrides.has('theme-gallery: palette'))

// ── 用户选过内置外观，就不许再被皮肤弹回 ─────────────────────────────────────
//
// 这是"深色卡点不动"的机制性原因：只要 localStorage 里记着皮肤，恢复逻辑就会在
// 每一次 publish 时把内置主题改回皮肤。用户明确选过内置外观后，恢复必须让路。
const picked = runBoot({ activeId: 'dark', seedSkin: null, seedBuiltIn: 'dark', wireSlots: true })
check('用户选过内置外观后，不再请求任何皮肤', picked.setThemeCalls.length === 0,
  `实际 ${picked.setThemeCalls.join(',') || '(无)'}`)

// ── 点内置卡片这条真实入口（用户报告的那次点击）─────────────────────────────
//
// 点卡片走的是页面组件里的 `onSelect`：先记录选择，再把点击交给外壳。
// 这里渲染真实组件、取出那张卡片的 props、调用它的 onSelect —— 与用户点击同一个函数。
const click = runBoot({ activeId: 'shan-qing-ting-cai', wireSlots: true })
check('点卡片之前：记得的是山青婷彩',
  click.localStorage.getItem('theme-gallery:last-skin') === 'shan-qing-ting-cai')
const beforeClick = click.setThemeCalls.length
click.clickCard('dark')
click.drive(30)
check('点深色后：主题服务停在 dark', click.themeState.active.id === 'dark',
  `实际 ${click.themeState.active.id}`)
check('点深色后：没有被恢复逻辑弹回皮肤',
  click.setThemeCalls.slice(beforeClick).filter((id) => id === 'shan-qing-ting-cai').length === 0,
  `点击后 setTheme 序列：${click.setThemeCalls.slice(beforeClick).join(',') || '(无)'}`)
check('点深色后：记住的皮肤已被清掉',
  click.localStorage.getItem('theme-gallery:last-skin') === null)
check('点深色后：内置选择被记下（重启后不会被默认皮肤覆盖）',
  click.localStorage.getItem('theme-gallery:built-in-choice') === 'dark')

// ── 点皮肤卡：选择要能跨重启 ─────────────────────────────────────────────────
//
// 与上面相反的方向：点皮肤卡时 `setTheme` 是**不加守卫**的槽位动作，所以订阅者会收到
// 那次 `theme/change` 并跑 `publish()` —— 皮肤 id 就是在这条路上写进 localStorage 的。
const pickSkin = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true })
check('点皮肤卡之前：还没有记住的皮肤', pickSkin.localStorage.getItem('theme-gallery:last-skin') === null)
pickSkin.clickCard('meng-hai-you-yu')
pickSkin.drive(30)
check('点皮肤卡后：主题服务停在梦海游鱼',
  pickSkin.themeState.active.id === 'meng-hai-you-yu', `实际 ${pickSkin.themeState.active.id}`)
check('点皮肤卡后：皮肤 id 被记入 localStorage（下次启动复用）',
  pickSkin.localStorage.getItem('theme-gallery:last-skin') === 'meng-hai-you-yu')
check('点皮肤卡后：内置选择的旧标记被清掉',
  pickSkin.localStorage.getItem('theme-gallery:built-in-choice') === null)

// ── 切到内置主题（浅色/深色）后，上一套皮肤的侧栏素材必须保留 ─────────────────
//
// 用户明确要求保留的设计（"惊喜"）：先选一套主题皮肤，再切到浅色/深色 —— 调色回到系统外观，
// 而侧栏里的气球 / 游鱼 / 山峦等素材**留在原处**。浅色/深色卡片的说明文字就在宣传它。
//
// 机制：素材画在 `.dsh-amb-control` 图层里，而"该主题没有装饰"这一支只清
// `#dsh-theme-ambient` 座位（历史容器），从不触碰活动图层 —— 活动图层只由 `drawScene()` 改写。
// 这条断言把该行为钉住，一个"顺手清理"的改动会让它变红。
const scenery = runBoot({ activeId: 'ying-mu-cai-yun', seedSkin: 'ying-mu-cai-yun', wireSlots: true })
const beforeScene = scenery.sceneHtml()
check('切换前：营慕彩云的气球场景已画进装饰层',
  typeof beforeScene === 'string' && beforeScene.length > 500,
  `实际 ${beforeScene === null ? '(无装饰层)' : `${beforeScene.length} 字符`}`)
const writesBefore = scenery.innerHTMLWrites.length
const layerRemovalsBefore = scenery.removals.filter((r) => r.className.includes('dsh-amb-control')).length
scenery.clickCard('dark')
scenery.drive(30)
check('切到深色后：主题服务真的停在 dark（没有弹回皮肤）',
  scenery.themeState.active.id === 'dark', `实际 ${scenery.themeState.active.id}`)
check('切到深色后：没有清空装饰层（没有新的场景写入）',
  scenery.innerHTMLWrites.length === writesBefore,
  `新增写入 ${scenery.innerHTMLWrites.length - writesBefore} 次`)
check('切到深色后：也没有把装饰层节点删掉',
  scenery.removals.filter((r) => r.className.includes('dsh-amb-control')).length === layerRemovalsBefore)
check('切到深色后：装饰层里仍是上一套皮肤的素材（这就是「惊喜」）',
  scenery.sceneHtml() === beforeScene)

// 反向：切到另一套**有装饰**的皮肤时，素材必须真的被换掉 —— 不能把上一套留在屏幕上。
const swap = runBoot({ activeId: 'ying-mu-cai-yun', seedSkin: 'ying-mu-cai-yun', wireSlots: true })
const caiyunScene = swap.sceneHtml()
swap.clickCard('shan-qing-ting-cai')
swap.drive(30)
check('切到另一套皮肤时：素材被替换成新皮肤的（不留上一套）',
  typeof swap.sceneHtml() === 'string' && swap.sceneHtml() !== caiyunScene,
  `实际 ${swap.sceneHtml() === caiyunScene ? '仍是彩云场景' : '已替换'}`)

// ── 反证：上面两条新断言必须真的会失败（硬性规则 9）──────────────────────────
//
// 合成样本上通过证明不了真实文件上还有效；而"通过"看起来和真的通过一模一样。
// 这里把两处修复点分别改坏，再从**改坏的源码**加载 bundle 跑同一段流程，
// 断言结论必须翻转。每一步都先确认"变异真的改动了源码"，否则下面的结论什么都没测。

const mutChoice = source.replace('if (builtInChoice() !== null) return null', 'if (false) return null')
check('反证 1 真的改动了源码（内置选择不再优先）', mutChoice !== source)
const bounced = runBoot({
  activeId: 'shan-qing-ting-cai', wireSlots: true, bundleSource: mutChoice,
})
bounced.clickCard('dark')
bounced.drive(30)
check('反证 1：去掉"内置选择优先"后，点深色确实会被弹回皮肤',
  bounced.themeState.active.id === 'shan-qing-ting-cai'
  && bounced.setThemeCalls.includes('shan-qing-ting-cai'),
  `实际 active=${bounced.themeState.active.id} 序列=${bounced.setThemeCalls.join(',')}`)

const mutDefault = source.replace('return DEFAULT_SKIN\n', 'return null\n')
check('反证 2 真的改动了源码（默认皮肤不再启用）', mutDefault !== source)
const noDefault = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, bundleSource: mutDefault })
check('反证 2：去掉默认皮肤后，全新安装不会再请求山青婷彩',
  !noDefault.setThemeCalls.includes('shan-qing-ting-cai'),
  `实际 ${noDefault.setThemeCalls.join(',') || '(无)'}`)

// 反证 3：把"没有装饰时保留活动图层"改坏（模拟一次"顺手清理"），"惊喜"断言必须翻转。
//
// 注意 `removeAllAmbientSeats()` 在源码里出现多次，所以变异锚在**紧随其后的那一行**上，
// 否则改的是别的分支；同时断言"变异真的改动了源码"。
const mutClear = source.replace(
  /removeAllAmbientSeats\(\)\r?\n(\s*)if \(record\) noteAmbientAttempt\(\{ kind, column: true, band: '无装饰' \}\)/,
  (whole, indent) => 'for (const node of document.querySelectorAll(\'.dsh-amb-control, .dsh-amb-control-scene\'))'
    + ` node.remove()\n${indent}if (record) noteAmbientAttempt({ kind, column: true, band: '无装饰' })`,
)
check('反证 3 真的改动了源码（没有装饰时改为清空活动图层）', mutClear !== source)
const cleared = runBoot({
  activeId: 'ying-mu-cai-yun', seedSkin: 'ying-mu-cai-yun', wireSlots: true, bundleSource: mutClear,
})
const clearedBefore = cleared.sceneHtml()
cleared.clickCard('dark')
cleared.drive(30)
check('反证 3：一旦在"无装饰"分支清理图层，「惊喜」素材就没了（说明上面那组断言测的是真通道）',
  clearedBefore !== null && cleared.sceneHtml() === null,
  `实际 ${cleared.sceneHtml() === null ? '装饰层已消失' : '装饰层仍在'}`)

if (failed > 0) {
  console.error(`\n${failed} boot path check(s) failed`)
  process.exit(1)
}
console.log('\nboot path checks passed')
