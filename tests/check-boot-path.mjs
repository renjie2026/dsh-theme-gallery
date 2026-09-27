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
/**
 * 每次 `sync` 报上来的"选中卡片"（= 徽标落在哪张卡上），由 store 桩记录。
 *
 * 全局一份、每次 `runBoot` 开头清空：徽标会不会跟着跳转重试的中间态来回跳（用户报的 bug）
 * 只有把这一串值记下来才看得见 —— 而那个中间态转瞬即逝，看截图是抓不住的。
 */
const syncSelectionLogs = []

/**
 * 每次 `markPet` 报上来的挂件开关状态（store 桩记录），由 runBoot 开头清空。
 * 挂件卡的徽标与 aria-pressed 都读它 —— 状态没走到 store，面板就会显示错的开关。
 */
const petMarkLogs = []

/**
 * 每次 `markPetKind` 报上来的"当前是哪只宠物"（store 桩记录），由 runBoot 开头清空。
 * 头像选择行的点亮态与卡面图案都读它 —— 二期新增，与 petMarkLogs 同一条理由。
 */
const petKindLogs = []

/**
 * 每次 `markMood` 报上来的问候状态（store 桩记录），由 runBoot 开头清空。
 * 胶囊开关与三组 chips 的点亮态都读它 —— 与 petMarkLogs 同一条理由。
 */
const moodMarkLogs = []

/**
 * 每次 `markMenuCollapse` 报上来的折叠状态（store 桩记录），由 runBoot 开头清空。
 * 折叠卡的徽标与 aria-pressed 都读它 —— 与 petMarkLogs 同一条理由。
 */
const menuMarkLogs = []

function loadBundle(window_, document_, recordJsx = () => {}, bundleSource = source) {  const registrations = []
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
      // 桩 state 跟着真实 store 的 init 长（createGalleryStore 的 init 返回值）：
      // MenuSettingsSection 经 useSyncExternalStore 读的就是这份 state，缺字段会让
      // 分节渲染抛错或渲染出空页面 —— 桩 state 与真实 init 漂移 = 分节断言测不到
      // （规则 8 的镜像：桩形状必须跟着真实数据长）。
      const state = {
        ids: [], labels: {}, descriptions: {}, swatches: {}, cardRows: {},
        scheme: '', selected: 'system', status: '', revision: -1,
        petEnabled: false, petKind: 'ban-ban',
        moodOn: true, moodSpeed: 'medium', moodDirection: 'ltr', moodZone: 'center',
        menuCollapsed: false,
      }
      return {
        defineStore: () => ({
          create: () => ({
            // 桩实例形状**对齐真实 StoreInstance 契约**：actions + getSnapshot +
            // subscribe + clearPersisted —— 契约上没有 getState/setState。白屏事故
            // 的根因正是分节按 getState 读（真实实例 undefined → 渲染抛错 → 弹窗
            // 白屏）；桩曾带 getState 把缺陷盖住了 —— 桩形状跟真实契约长（规则 8）。
            getSnapshot: () => state,
            subscribe: () => () => {},
            clearPersisted() {},
            actions: {
              // 桩的 action 表必须**跟着真实 store 长**：少一个 `markScheme`，`publish()`
              // 就会抛 `storeActions.markScheme is not a function`，整个挂载被 guard 拦下 ——
              // 而症状只是"插件没上色"（规则 8：桩少做一步副作用，缺陷就测不出来）。
              //
              // `sync` 另外**记下每次报上来的选中卡片**：徽标会不会跟着跳转重试的中间态
              // 来回跳（用户报的那个 bug）只有把这一串值记下来才看得见。
              // 真实框架调 action 时注入 draft 作第一参；桩没有框架，publish 直呼本表，
              // 所以这里是 `sync(themes, selected, revision)` —— 顺手把 themes 物化进
              // state（MenuSettingsSection 的快照读它；不物化则分节页 ids 恒空，
              // "分节渲染出完整面板"永远测不到）。
              sync(themes, selected) {
                syncSelectionLogs.push(selected)
                Object.assign(state, {
                  ids: themes.map((theme) => theme.id),
                  labels: Object.fromEntries(themes.map((theme) => [theme.id, theme.label])),
                })
              },
              note() {}, select() {}, markScheme() {},
              // 挂件卡的开关状态也走 store（publish → markPet）。桩少一个 action，
              // publish 就抛错、整个挂载被 guard 拦下 —— 规则 8 的第 N 例。
              markPet(on) { petMarkLogs.push(on) },
              // 二期：头像选择行的点亮态走 markPetKind，同一条理由（规则 8）。
              markPetKind(id) { petKindLogs.push(id) },
              // 心情问候卡的开关与三组设置走 markMood，同一条理由（规则 8）。
              // 记下每次报上来的开关状态，问候卡的断言读它。
              markMood(state) { moodMarkLogs.push(state) },
              // 菜单折叠卡的开关状态走 markMenuCollapse，同一条理由（规则 8）。
              // 与真实 action 同形：写进 state（设置分节的快照读它 —— 桩只记日志的
              // 话分节永远读到 false，「恢复侧栏入口」按钮就测不到）。
              markMenuCollapse(on) { menuMarkLogs.push(on); state.menuCollapsed = on === true },
            },
          }),
        }),
      }
    }
    if (id === 'react') return {
      createElement: () => null,
      useState: () => [undefined, () => {}],
      // 设置分节组件（MenuSettingsSection）用它把 pinned store 绑成视图。真实 React
      // 会订阅并在变化时重渲染；桩里一次性读出快照即可 —— 分节断言只关心渲染链路
      // 与当时的快照值，不关心后续更新。
      useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    }
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
  const makeNode = (tag) => {
    const node = {
      tagName: String(tag).toUpperCase(),
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
      // 结构节点是 createElement 逐个建的（宠物挂件的舞台如此），真实 DOM 里父节点能
      // 按类名找到孩子；桩里按"创建顺序在本节点之后 + 类名匹配"近似同一件事 —— 返回
      // null 的话，buildPetStage 拿不到子节点引用，整个挂件在桩里静默失效（规则 8）。
      querySelector(selector) {
        if (typeof selector !== 'string' || !selector.startsWith('.')) return null
        const wanted = selector.slice(1)
        const myAt = created.indexOf(this)
        if (myAt < 0) return null
        return created.find((n, at) => at > myAt && !n._removed
          && String(n.className).split(' ').includes(wanted)) ?? null
      },
      append(...kids) { for (const kid of kids) this.children.push(kid) },
      appendChild(kid) { this.children.push(kid) },
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
    }
    // classList 以 className 字符串为唯一事实来源 —— 真实 DOM 也是这样。
    // 缺了它，挂件的 run/bark/改名类名切换会在桩里抛 TypeError（被 effect 的 try 吞掉），
    // 测试却照样绿 —— 规则 8 的又一例，本轮真踩到。
    node.classList = {
      add: (...names) => {
        const set = new Set(String(node.className).split(' ').filter(Boolean))
        for (const item of names) set.add(item)
        node.className = [...set].join(' ')
      },
      remove: (...names) => {
        const set = new Set(String(node.className).split(' ').filter(Boolean))
        for (const item of names) set.delete(item)
        node.className = [...set].join(' ')
      },
      contains: (name) => String(node.className).split(' ').includes(name),
      // 真实 DOM 的 classList 有 toggle（挂件的弹窗隐藏标记用它）—— 桩缺它，
      // 那条路径就测不到（规则 8）。
      toggle: (name, force) => {
        const set = new Set(String(node.className).split(' ').filter(Boolean))
        const has = set.has(name)
        const want = force === undefined ? !has : Boolean(force)
        if (want) set.add(name)
        else set.delete(name)
        node.className = [...set].join(' ')
        return want
      },
    }
    // 事件监听按类型记录下来，测试用它把"用户真的点了"演出来（_fire）。
    const listeners = new Map()
    node.addEventListener = (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, [])
      listeners.get(type).push(handler)
    }
    node.removeEventListener = (type, handler) => {
      const list = listeners.get(type) ?? []
      const at = list.indexOf(handler)
      if (at >= 0) list.splice(at, 1)
    }
    /** 触发一类事件（测试专用）：按记录顺序调全部监听。 */
    node._fire = (type, event) => {
      for (const handler of [...(listeners.get(type) ?? [])]) handler(event)
    }
    return node
  }
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
   * 对话输入框链：centerCol → composer 座位 → contenteditable。
   *
   * 宠物挂件锚定输入框（阅读态用的同一套查找），桩里不补这条链，挂件同步就会
   * "找不到锚点"而静默收起 —— 挂件的行为断言一个都测不到（规则 8）。
   */
  const composerSeat = makeNode('div')
  composerSeat.getBoundingClientRect = () => ({
    left: 300, top: 700, right: 1000, bottom: 780, width: 700, height: 80, x: 300, y: 700,
  })
  const composerNode = makeNode('div')
  // 阅读态的 transcriptHasContent 会从 composer 往上走两层（座位 → 父容器）再遍历兄弟，
  // 所以补一个空包裹层，让这条链在桩里也是通的（兄弟无内容 → 判"无消息"，与旧行为一致）。
  const composerWrap = makeNode('div')
  composerWrap.children = [composerSeat]
  composerWrap.childElementCount = 1
  composerSeat.parentElement = composerWrap
  composerNode.parentElement = composerSeat
  const centreColumnNode = makeNode('div')
  centreColumnNode.querySelector = (selector) =>
    (typeof selector === 'string' && selector.includes('contenteditable') ? composerNode : null)

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
    // "生成中"信号钩子：默认查不到（=未在生成）；B9 断言往里塞节点来模拟 InputBar
    // 的 aria-label="停止生成" 按钮。真实环境由 composer 提供，桩里由测试控制。
    stopButton: null,
    // 弹窗检测（挂件的"弹窗打开就隐藏"）：默认查不到（=没有弹窗开着）；
    // 断言往里塞节点模拟弹窗开、置 null 模拟关 —— 与 stopButton 同一手法。
    dialogNode: null,
    createElement: (tag) => {
      const node = makeNode(tag)
      created.push(node)
      return node
    },
    querySelector(selector) {
      if (typeof selector !== 'string') return null
      if (selector.includes('aria-label="停止生成"') || selector.includes('aria-label="Stop generating"')) {
        return document_.stopButton
      }
      // 弹窗检测：挂件的语义选择器（dialog[open] / role="dialog" / aria-modal）
      // 一律回 dialogNode —— 桩不解析复合选择器，测试直接控制它的值。
      if (selector.includes('dialog')) return document_.dialogNode
      if (selector.includes('sidebarCol')) return column
      // 宠物挂件的舞台节点（按 id 找，含"还在不在"的判定）。
      if (selector.includes('#dsh-theme-pet')) {
        return created.find((n) => n.id === 'dsh-theme-pet' && !n._removed) ?? null
      }
      // 宠物挂件 / 阅读态的输入框锚点。
      if (selector.includes('centerCol')) return centreColumnNode
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
  return { document_, body, innerHTMLWrites, removals, sceneHtml, created }
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
  /** 只记录回调，不自动触发；由测试自行驱动。实例收集进 mutationObservers 供断言。 */
  class MutationObserverStub {
    constructor(callback) {
      this.callback = callback
      this.disconnected = false
      mutationObservers.push(this)
    }
    observe() {}
    disconnect() { this.disconnected = true }
    takeRecords() { return [] }
  }
  class ResizeObserverStub {
    constructor(callback) { this.callback = callback }
    observe() {}
    disconnect() { this.disconnected = true }
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
 * 每个 runBoot 创建的 MutationObserver 实例（按创建顺序），由 runBoot 开头清空。
 * 挂件的"弹窗打开就隐藏"observer 也走这里 —— 断言要拿到实例手动驱动它的回调
 * （桩不自动触发），并检查 removePetStage 时真的 disconnect。
 */
const mutationObservers = []

/**
 * 每次 `ctx.layout.selectPanel` 报上来的主区面板跳转（桩 ctx 记录），由 runBoot 清空。
 * 设置分节的「打开面板」按钮 = close + 官方跳转面 —— 跳没跳、跳到哪，只有记下来才看得见。
 */
const layoutSelectCalls = []

/**
 * 跑一次引导，返回观测结果。
 * @param options - 配置。
 * @param options.activeId - 主题服务一开始报告的活动主题。
 * @param options.presenterDelayTicks - 表现层要过多少个 tick 才开始写令牌（模拟它晚挂载）。
 * @param options.config - 组合配置（`ambient: false` 是急停开关）。
 * @param options.seedSkin - 预置的「记住的皮肤」；`null` 表示全新安装（从未选过）。
 * @param options.seedBuiltIn - 预置的「用户在面板里选过内置外观」标记。
 * @param options.seedPet - 预置的挂件状态（原样 JSON 串）。
 * @param options.seedMenu - 预置的「菜单折叠」状态（原样 JSON 串；种子折叠启动时
 *   侧栏入口应从未注册，设置分节照常注册）。
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
  seedPet,
  seedMenu,
  wireSlots = false,
  bundleSource = source,
} = {}) {
  const restoreObservers = installObserverStubs()
  // 每个 run 一份干净的"选中卡片"、"挂件开关"与"当前宠物"序列（模块级容器，见它们的文档）。
  syncSelectionLogs.length = 0
  petMarkLogs.length = 0
  petKindLogs.length = 0
  moodMarkLogs.length = 0
  menuMarkLogs.length = 0
  mutationObservers.length = 0
  layoutSelectCalls.length = 0
  try {
  const { document_, body, innerHTMLWrites, removals, sceneHtml, created } = documentStub()
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
    'shi-liu-jin',
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
    // 挂件的钳位需要视口宽度 —— 桩缺它时 clamp 全变 NaN（本轮实测踩到，规则 8）。
    innerWidth: 1280,
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
  // 注入句柄 → 它撤销的安装动作。`inject('sidebar.panellist'|'settings.section', cb)` 返回的
  // 撤销句柄必须撤销 cb 安装的注册 —— 菜单折叠的收放正是靠这个语义可断言。
  const injectDisposers = new Map()
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
        // 侧栏入口与设置分节的注入：真实外壳声明这两个槽位后回调立即执行并事务性
        // 安装注册；注入句柄=撤销它安装的东西（菜单折叠的收放正是靠这个语义）。
        if (name === 'sidebar.panellist' || name === 'settings.section') {
          const installed = callback()
          injectDisposers.set(name, typeof installed === 'function' ? installed : () => {})
        }
        return () => {
          const dispose = injectDisposers.get(name)
          if (dispose !== undefined) dispose()
          injectDisposers.delete(name)
        }
      },
      register: (spec, component) => {
        const record = { name: spec?.name, spec, component, unregistered: false }
        slotRegistrations.push(record)
        // 注册的撤销把记录标记出来 —— "侧栏入口被收起"在桩里就是可断言的事实。
        return () => { record.unregistered = true }
      },
    },
    effect: (cb) => { try { cb() } catch (error) { globalThis.__bootError = error } return () => {} },
    // 官方布局面：设置分节的「打开面板」按钮走 ctx.layout.selectPanel 跳主区
    // （契约原文：给其他插件做面板切换的横切面）。桩里只记录调用。
    layout: {
      selectPanel: (id) => { layoutSelectCalls.push(id) },
    },
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
  // 预置挂件状态（原样字符串，形状由测试自己负责）。
  if (seedPet !== undefined) windowStub.localStorage.setItem('theme-gallery:pet', seedPet)
  // 预置菜单折叠状态（原样字符串）。种子必须在 apply 之前落位 —— syncSidebarEntry
  // 在挂载体里读它决定侧栏入口注册不注册。
  if (seedMenu !== undefined) windowStub.localStorage.setItem('theme-gallery:menu-collapse', seedMenu)

  let applyError = null
  globalThis.__bootError = undefined
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
        labels: {}, descriptions: {}, swatches: {}, cardRows: {},
        selected: 'shan-qing-ting-cai', status: '', revision: 1,
      }),
      usePanelInfo: (selector) => selector({ activePanelId: 'theme-gallery' }),
    })
    const card = jsxCalls.find((call) => call.props?.id === id
      && typeof call.props?.onSelect === 'function')
    if (card === undefined) throw new Error(`卡片 ${id} 没有被渲染出来`)
    card.props.onSelect(id)
  }

  /**
   * 渲染页面，并**真正执行**一张卡片的组件，返回它构建出的元素描述。
   *
   * jsx 桩只记录元素描述、不渲染组件，所以卡片**里面**那一层（色块 / 色带 / 正文）
   * 平时根本不会被构建 —— 要断言"色块卡不渲染正文介绍"，必须自己把组件跑一遍，
   * 否则那条断言在**什么都没渲染**的情况下也会"通过"（规则 6 与规则 8 合起来的形状：
   * 桩少做一步副作用，缺陷就测不出来）。
   * @param id - 卡片对应的主题 id。
   * @param cardRows - store 里的色块表。
   * @param descriptions - store 里的说明文案。
   * @param onPick - 可选：替换 `pickScheme`；**不给就用页面真实拿到的那一个**，
   *   这样"点色块"走的是完整链路（页面 → `chooseScheme` → 真的切主题），而不是被记录的桩。
   * @returns 卡片元素本身，以及它内部构建出的元素描述。
   */
  const cardTree = (id, cardRows, descriptions, onPick) => {
    const page = pageRegistration()
    const face = pageFace()
    const before = jsxCalls.length
    page.component({
      t: (key) => key,
      setTheme: face.setTheme,
      pickScheme: onPick === undefined ? face.pickScheme : onPick,
      // 挂件的两条真实入口也一并传（头像点击的端到端断言会真的调用它们）。
      togglePet: face.togglePet,
      pickPet: face.pickPet,
      // 菜单折叠卡的真实入口同构（点卡开关侧栏入口）。
      toggleMenuCollapse: face.toggleMenuCollapse,
      useStore: (selector) => selector({
        ids: ['light', 'shi-liu-jin', 'shan-qing-ting-cai', 'pet-family', 'menu-collapse'],
        labels: {
          'shi-liu-jin': '石榴金 · 纯色拼色',
          'pet-family': '宠物挂件 · 七只小伙伴',
          'menu-collapse': '菜单折叠',
        },
        descriptions,
        swatches: { 'shi-liu-jin': ['#9D2933', '#574266', '#3DE1AD'] },
        cardRows,
        // 与真实 store 同形：`sync` 每次 publish 都会写 `scheme`（见 markScheme）。
        scheme: rememberedSchemeValue(),
        // 挂件开关：与插件同一条来源（localStorage 里的 on:true）。
        petEnabled: (windowStub.localStorage.getItem('theme-gallery:pet') ?? '').includes('"on":true'),
        // 当前是哪只宠物：与插件同一条来源（localStorage 里的 kind；坏值回落 ban-ban）。
        petKind: (() => {
          try { return JSON.parse(windowStub.localStorage.getItem('theme-gallery:pet') ?? '{}').kind ?? 'ban-ban' }
          catch { return 'ban-ban' }
        })(),
        // 折叠开关：与插件同一条来源（readMenuCollapseState 的消毒结果）。
        menuCollapsed: (() => {
          try {
            return JSON.parse(windowStub.localStorage.getItem('theme-gallery:menu-collapse') ?? '{}').collapsed === true
          } catch { return false }
        })(),
        selected: 'light', status: '', revision: 1,
      }),
      usePanelInfo: (selector) => selector({ activePanelId: 'theme-gallery' }),
    })
    const card = jsxCalls.slice(before).find((call) => call.props?.id === id
      && (typeof call.props?.onSelect === 'function'
        || typeof call.props?.onTogglePet === 'function'
        || typeof call.props?.onToggleMenuCollapse === 'function'))
    if (card === undefined) throw new Error(`卡片 ${id} 没有被渲染出来`)
    const inside = jsxCalls.length
    card.type(card.props)
    return { card, tree: jsxCalls.slice(inside), page: jsxCalls.slice(before, inside) }
  }

  /** store 里那一格应该点亮什么 —— 与插件同一条规则（记住的 → 否则默认石榴金）。 */
  const rememberedSchemeValue = () => windowStub.localStorage.getItem('theme-gallery:palette') || 'p-shi-liu-jin'

  return {
    setThemeCalls, registrations, body, applyError, themeState, document_,
    accentLayers, innerHTMLWrites, created,
    // effect 桩把回调里的异常吞进这个全局 —— 它非空说明某条路径在桩里抛错了
    //（规则 8：桩缺副作用会把缺陷藏起来，这里反过来把抛错暴露给断言）。
    get bootError() { return globalThis.__bootError },
    paintedProbe: body.style.getPropertyValue('--dsw-alias-bg-base'),
    overrides: ctxTheme.overrides,
    adoptPersistedPreference,
    drive,
    clickCard,
    cardTree,
    pageFace,
    petMarks: petMarkLogs,
    petKindMarks: petKindLogs,
    moodMarks: moodMarkLogs,
    menuMarks: menuMarkLogs,
    // 槽位注册记录（main / sidebar.panellist / settings.section）—— 菜单折叠的
    // "侧栏收放、分节常驻"断言读它（记录的 unregistered 标记即撤销事实）。
    slotRegistrations,
    // 本 run 创建的 MutationObserver 实例（弹窗隐藏 observer 的断言要驱动它）。
    mutationObservers,
    // ctx.layout.selectPanel 的实参序列（设置分节跳转断言读它）。
    panelJumps: layoutSelectCalls,
    localStorage: windowStub.localStorage,
    jsxCalls,
    syncSelections: syncSelectionLogs,
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

// ── 色块排版的卡片（纯色/拼色 类）────────────────────────────────────────────
//
// 这一类卡片用 `card.rows` 换掉默认色带，并且**不渲染正文介绍**（description 只作 tooltip）。
// 两件事都只有把卡片组件真的跑一遍才看得见，所以这里执行 ThemeCard 本身。
const PICKER_ROWS = [
  { kind: 'solid', schemes: ['p-xiang-se', 'p-ju-huang', 'p-tao-hong', 'p-hai-tang-hong', 'p-jiang-zi'] },
  { kind: 'solid', schemes: ['p-song-bai-lu', 'p-zhu-qing', 'p-cang-qing', 'p-dai-zi', 'p-xuan-qing'] },
  { kind: 'clash', schemes: ['p-shi-liu-jin', 'p-bao-lan-jin', 'p-qing-lian-jin', 'p-song-hua-tao', 'p-wu-jin'] },
]
const BLOCK_DESC = '只作 tooltip 的说明文案'

const blockCard = runBoot({ activeId: 'light', wireSlots: true })
const blockBuilt = blockCard.cardTree(
  'shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC },
)
const swatches = blockBuilt.tree.filter((call) => call.props?.className === 'tg-swatch')
const bands = blockBuilt.tree.filter((call) => call.props?.className === 'tg-band')
/**
 * 一个色格内部的色带。
 *
 * jsx 桩是**先记子元素、再记父元素**（子在前），所以色带出现在色格**之前** —— 要往回扫，
 * 扫到前一个色格为止。第一版按"往后扫"取，取到空数组然后 deref 崩了（读数就在这里）。
 * @param swatch - 该色格在记录里的那一项。
 * @returns 它的色带，按文档顺序。
 */
const bandsIn = (swatch) => {
  const at = blockBuilt.tree.indexOf(swatch)
  const out = []
  for (let i = at - 1; i >= 0; i -= 1) {
    const call = blockBuilt.tree[i]
    if (call.props?.className === 'tg-swatch') break
    if (call.props?.className === 'tg-band') out.unshift(call)
  }
  return out
}
/** 卡片元素本身 —— `title` 是在 `ThemeCard` 里算出来的，不在页面给的 props 上。 */
const blockCardEl = blockBuilt.tree.find((call) => call.props?.className === 'tg-card tg-picker-card')
check('配色卡渲染出 .tg-picker', blockBuilt.tree.some((call) => call.props?.className === 'tg-picker'))
check('配色卡渲染 3 排（2 排纯色 + 1 排拼色）',
  blockBuilt.tree.filter((call) => call.props?.className === 'tg-pickrow').length === 3,
  `实际 ${blockBuilt.tree.filter((c) => c.props?.className === 'tg-pickrow').length} 排`)
check('每一排 5 个色值按钮，一共 15 个（用户定的 5+5+5）', swatches.length === 15,
  `实际 ${swatches.length} 个`)
check('每个按钮都是真的 button 元素（可点、带 aria-pressed）',
  blockBuilt.tree.filter((call) => call.type === 'button' && call.props?.className === 'tg-swatch').length === 15
  && swatches.every((call) => typeof call.props?.['aria-pressed'] === 'boolean'))
// ── 拼色格的新画法：按**宽度**分带（用户要的 2/1…，不再用"底 + 圆点"）────────────
//
// 带数**从配色表推**，不写死：拼色格 = 1 条主色带 + 该方案 dots 的条数，纯色格 = 1 条。
// （早先这里写死"5 套都是 4 个次色" —— 用户把「松花·桃粉」改成只配 2 个次色后就红了，
//   而那正是**期望**的结果：2 个次色画出来就是 2/1/1。断言必须跟着数据，而不是跟着记忆。）
const PALETTE = JSON.parse(readFileSync(new URL('../lib/palette-schemes.json', import.meta.url), 'utf8')).schemes
const schemeById = (id) => PALETTE.find((scheme) => scheme.id === id)
/** 该方案在卡片上应该画几条带。 */
const expectedBands = (id) => {
  const scheme = schemeById(id)
  return scheme.kind === 'clash' ? 1 + (scheme.dots ?? []).length : 1
}
const rowIds = PICKER_ROWS.flatMap((row) => row.schemes)
check('每个色格的带数都与配色表一致（拼色 = 主色 + 次色个数；纯色 = 1 条）',
  swatches.every((swatch, at) => bandsIn(swatch).length === expectedBands(rowIds[at])),
  `实际 ${swatches.map((s) => bandsIn(s).length).join(',')} / 期望 ${rowIds.map(expectedBands).join(',')}`)
check('拼色格的第一条带是主色、占 2 份；其余每条各占 1 份（比值来自数据，不是写死的）',
  swatches.slice(10).every((swatch) => {
    const list = bandsIn(swatch)
    return list[0].props.style.flexGrow === 2
      && list.length >= 2
      && list.slice(1).every((band) => band.props.style.flexGrow === 1)
  }))
check('石榴金那一格的四条次色带与配色表一致（精白/月白/金色/翡翠，主色石榴红）',
  (() => {
    const list = bandsIn(swatches[10])
    return list[0].props.style.background === '#F20C00'
      && list.slice(1).map((band) => band.props.style.background).join(',')
        === '#FFFFFF,#D6ECF0,#EACD76,#3DE1AD'
  })(),
  `实际 ${bandsIn(swatches[10]).map((b) => b.props.style.background).join(',')}`)
check('纯色格是同一个机制的退化情况：只有一条带、占 1 份',
  swatches.slice(0, 10).every((swatch) => {
    const list = bandsIn(swatch)
    return list.length === 1 && list[0].props.style.flexGrow === 1
  })
  && bands.length === rowIds.reduce((sum, id) => sum + expectedBands(id), 0),
  `带总数 ${bands.length}`)
check('拼色格不再画圆点（`.tg-mini` 已经不存在了）',
  !blockBuilt.tree.some((call) => call.props?.className === 'tg-mini'))
// 悬停色名（用户要求：不改布局，鼠标移到色块上才显示名称）。
check('每个色格都带一个非空的色名（悬停时由 CSS 从 data-name 取出来显示）',
  swatches.every((call) => typeof call.props?.['data-name'] === 'string' && call.props['data-name'] !== ''),
  `缺名的格子：${JSON.stringify(swatches.filter((c) => !c.props?.['data-name']).map((c) => c.props?.title))}`)
check('色名与 lib/palette-schemes.json 逐字一致（不是另一份名字）',
  swatches.map((call) => call.props['data-name']).join('|')
  === (() => {
    const file = JSON.parse(readFileSync(new URL('../lib/palette-schemes.json', import.meta.url), 'utf8'))
    return PICKER_ROWS.flatMap((row) => row.schemes)
      .map((id) => file.schemes.find((scheme) => scheme.id === id)?.label).join('|')
  })(),
  `实际 ${swatches.map((call) => call.props['data-name']).join(',')}`)
// 反证 9：把 data-name 换成写死的空串，第一条必须翻转。
const mutName = source.replace("'data-name': scheme.label", "'data-name': ''")
check('反证 9 真的改动了源码（色名被抹掉）', mutName !== source)
const nameless = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutName })
  .cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC }, () => {})
check('反证 9：抹掉之后格子就没有色名了（说明上面那条断言测的是真通道）',
  nameless.tree.filter((call) => call.props?.className === 'tg-swatch')
    .every((call) => call.props['data-name'] === ''))
check('配色卡**不渲染正文介绍**（.tg-desc 缺席）',
  !blockBuilt.tree.some((call) => call.props?.className === 'tg-desc'))
check('说明文字仍然保留为 tooltip（title）', blockCardEl?.props.title === BLOCK_DESC,
  `实际 ${JSON.stringify(blockCardEl?.props.title)}`)
check('配色卡是 div 而不是 button（button 套 15 个 button 是非法标记）',
  blockCardEl !== undefined && blockCardEl.type === 'div')

// 点一个色值按钮：调用的是页面交给卡片的那条 `pickScheme`，与用户点击同一个函数。
const pickedIds = []
const clickable = blockCard.cardTree(
  'shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC },
  (schemeId) => pickedIds.push(schemeId),
)
const clickableSwatches = clickable.tree.filter((call) => call.props?.className === 'tg-swatch')
// 前 10 个是纯色排，第 11 个（下标 10）是拼色排的第一格 = 石榴金。
clickableSwatches[10].props.onClick()
check('点一个色值按钮会把**它自己的** scheme id 交给页面（记进 localStorage 并切到锚主题）',
  pickedIds.length === 1 && pickedIds[0] === 'p-shi-liu-jin', `实际 ${JSON.stringify(pickedIds)}`)
clickableSwatches[0].props.onClick()
check('点另一格交出去的是另一格的 id（不是写死的那一个）',
  pickedIds[1] === 'p-xiang-se', `实际 ${JSON.stringify(pickedIds)}`)

// 反证 5：把按钮交出去的 id 写死，上面两条断言必须翻转。
const mutPick = source.replace('onPick(scheme.id)', "onPick('p-wu-jin')")
check('反证 5 真的改动了源码（按钮交出去的 id 被写死）', mutPick !== source)
const pickLeak = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutPick })
const pickLeakIds = []
const pickLeakTree = pickLeak.cardTree(
  'shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC },
  (schemeId) => pickLeakIds.push(schemeId),
)
pickLeakTree.tree.filter((call) => call.props?.className === 'tg-swatch')[0].props.onClick()
check('反证 5：id 写死后，点第一格交出去的不是它自己的 id（说明上面那条断言测的是真通道）',
  pickLeakIds[0] === 'p-wu-jin', `实际 ${JSON.stringify(pickLeakIds)}`)

// ── 石榴金那一格必须等于"第一版那整套配色"（用户实机指出：不是第一遍做的颜色）────────
//
// 第一版那套 = 两排 10 个纯色 + 拼色那一排，合起来这一整套，落在锚主题皮肤自己手工写的
// 67 个 token 里（侧栏渐变、两层底、正文、按钮族都在里面）。所以点这一格**不能**用
// `main/ground/ink` 三个颜色去重新派生 —— 那样得到的是"相似但不等"的一套。
// 断言的是"这一格不叠派生层"：锚主题活动时 `syncSkin` 已经叠了皮肤自己的调色。
const anchorPick = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
anchorPick.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[10].props.onClick()
anchorPick.drive(30)
check('点石榴金那一格：活动主题切到锚主题',
  anchorPick.themeState.active.id === 'shi-liu-jin', `实际 ${anchorPick.themeState.active.id}`)
check('点石榴金那一格：记录的就是石榴金那一格',
  anchorPick.localStorage.getItem('theme-gallery:palette') === 'p-shi-liu-jin',
  `实际 ${anchorPick.localStorage.getItem('theme-gallery:palette')}`)
check('点石榴金那一格：**不叠派生层**（屏幕上是皮肤自己那 67 个 token = 第一版那套配色）',
  !anchorPick.overrides.has('theme-gallery: 配色'),
  `实际层：${JSON.stringify([...anchorPick.overrides.keys()])}`)
// 上面那条不能是"这一格点了没反应"蒙对的：先点别的拼色格叠上层，再点石榴金必须撤层。
const backToAnchor = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
backToAnchor.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[12].props.onClick()
backToAnchor.drive(30)
check('先点青莲·金玉会叠上配色层（对照组）', backToAnchor.overrides.has('theme-gallery: 配色'))
backToAnchor.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[10].props.onClick()
backToAnchor.drive(30)
check('再点石榴金，配色层被撤掉（回到皮肤自己那套 = 第一版）',
  !backToAnchor.overrides.has('theme-gallery: 配色'),
  `实际层：${JSON.stringify([...backToAnchor.overrides.keys()])}`)

// 反证 10：把"石榴金不叠层"这一条去掉，上面两条必须翻转。
const mutAnchorScheme = source.replace(' && remembered !== DEFAULT_SCHEME', '')
check('反证 10 真的改动了源码（石榴金那一格又会去派生一套颜色）', mutAnchorScheme !== source)
const derivedAnchor = runBoot({
  activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai',
  wireSlots: true, bundleSource: mutAnchorScheme,
})
derivedAnchor.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[10].props.onClick()
derivedAnchor.drive(30)
check('反证 10：去掉之后石榴金又会叠一层派生配色（说明上面那条测的是真通道）',
  derivedAnchor.overrides.has('theme-gallery: 配色'),
  `实际层：${JSON.stringify([...derivedAnchor.overrides.keys()])}`)

// 反向：同一张卡在 store 里没有配色表时，必须走默认色带并且**照常渲染正文** ——
// 否则上面那条"没有正文"可能只是因为文案缺失，与配色分支无关。
const stripBuilt = blockCard.cardTree(
  'shi-liu-jin', {}, { 'shi-liu-jin': BLOCK_DESC },
)
check('没有 cardRows 时走默认色带，并照常渲染正文（说明上一条测的确实是配色分支）',
  !stripBuilt.tree.some((call) => call.props?.className === 'tg-picker')
  && stripBuilt.tree.some((call) => call.props?.className === 'tg-strip')
  && stripBuilt.tree.some((call) => call.props?.className === 'tg-desc'))

// 消毒器：外来的坏数据必须退回默认色带，而不是把 undefined 画进背景（静默空白）。
const rottenBuilt = blockCard.cardTree(
  'shi-liu-jin',
  { 'shi-liu-jin': [PICKER_ROWS[0]] },
  { 'shi-liu-jin': BLOCK_DESC },
)
check('配色数据不合法时退回默认色带（一排 → 不画色值按钮）',
  !rottenBuilt.tree.some((call) => call.props?.className === 'tg-picker')
  && rottenBuilt.tree.some((call) => call.props?.className === 'tg-strip'))

// 反证 4：拆掉"配色/挂件卡不渲染正文"的守卫，上面那条断言必须翻转。
const mutBlockDesc = source.replace('!hasPicker && !isWidget && !isMood && !isMenuCollapse && description', 'description')
check('反证 4 真的改动了源码（配色卡的正文守卫被拆掉）', mutBlockDesc !== source)
const leaked = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutBlockDesc })
const leakedBuilt = leaked.cardTree(
  'shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC },
)
check('反证 4：拆掉守卫后正文就冒出来了（说明上面那条断言测的是真通道）',
  leakedBuilt.tree.some((call) => call.props?.className === 'tg-desc'))

// ── 用户实机报的那个 bug：点色块"没反应" ─────────────────────────────────────
//
// 根因：`chooseScheme` 只记录了方案、**没有真的切主题**。而 `rememberCardChoice` 从不写
// `last-skin`，于是 `syncRememberedSkin` 见到活动主题是本包皮肤，就把它原样记回去继续维持 ——
// 锚主题永远不生效，`syncScheme` 的判据（`active.id === PALETTE_ANCHOR`）不成立，
// 配色层永不叠加。**症状是"点了什么都没发生"，没有任何日志。**
//
// 这一组跑的是**完整链路**：点色格 → 页面 → `pickScheme` → `chooseScheme` → 真的切主题
// → `syncScheme` 叠层（`cardTree` 不传 onPick 时用的就是页面真实拿到的那一个）。
const live = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
const livePicker = live.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
const liveSlots = livePicker.tree.filter((call) => call.props?.className === 'tg-swatch')
check('点色格之前：活动主题是山青婷彩（本包皮肤，正是会"被记回去"的那种情形）',
  live.themeState.active.id === 'shan-qing-ting-cai', `实际 ${live.themeState.active.id}`)
liveSlots[12].props.onClick()
live.drive(30)
check('点一个色格后：活动主题真的切到锚主题（用户报的 bug 就死在这一步）',
  live.themeState.active.id === 'shi-liu-jin', `实际 ${live.themeState.active.id}`)
check('点一个色格后：选中的方案写进了 localStorage',
  live.localStorage.getItem('theme-gallery:palette') === 'p-qing-lian-jin',
  `实际 ${live.localStorage.getItem('theme-gallery:palette')}`)
check('点一个色格后：配色层真的叠上了（服务里能查到这一层）',
  live.overrides.has('theme-gallery: 配色'), `实际 ${JSON.stringify([...live.overrides.keys()])}`)
// ── 用户报的"第一次点变成浅色、第二次才生效" ──────────────────────────────────
//
// 根因：`ensureSkinPainted` 的**跳转重试**（先切内置 `light`、再切回皮肤）。点卡片时
// `chooseScheme` 紧接着自己 `publish()`，而那一刻表现层**必然还没落色**（它是异步写 token 的），
// 于是被误判成"这次切换丢了" → 先切浅色再切回。用户看到的就是"点了没反应、反而变成浅色"。
// 这条断言要看的是**服务真的被写过浅色**（`setThemeCalls`），而不是看截图或面板文字。
//
// 注：`check()` 只收两个参数（第三参一直被丢掉），所以诊断信息在这里自己打印 ——
// 失败时才有读数，正是排查这类问题需要的东西。
if (live.setThemeCalls.includes('light')) {
  console.error(`  实际写过的主题：${JSON.stringify(live.setThemeCalls)}`)
}
check('点色格只应把主题切到锚主题，绝不该顺路写一次内置「浅色」（用户报的第一次点击失效）',
  !live.setThemeCalls.includes('light'))

// 反证 11：把"给表现层的耐心"调成 0，上面那条必须翻转（否则它是空转的）。
const mutGrace = source.replace('const PAINT_GRACE_MS = 400', 'const PAINT_GRACE_MS = 0')
check('反证 11 真的改动了源码（把等待时间调成 0）', mutGrace !== source)
const impatient = runBoot({
  activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai',
  wireSlots: true, bundleSource: mutGrace,
})
impatient.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[12].props.onClick()
impatient.drive(30)
check('反证 11：没有耐心时，点一次色格就会顺路写一次「浅色」（说明上面那条测的是真通道）',
  impatient.setThemeCalls.includes('light'),
  `实际 ${JSON.stringify(impatient.setThemeCalls)}`)

// 反证 6：把"真的切主题"那一步删掉，上面两条必须翻转 —— 这正是第一版的形状。
const mutNoSwitch = source.replace('emitting(() => ctx.theme.setTheme(PALETTE_ANCHOR))', '')
check('反证 6 真的改动了源码（删掉"真的切主题"那一步）', mutNoSwitch !== source)
const noSwitch = runBoot({
  activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true, bundleSource: mutNoSwitch,
})
noSwitch.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[12].props.onClick()
noSwitch.drive(30)
check('反证 6：删掉切主题那一步后，活动主题卡在山青婷彩、配色层也不叠（说明上面那两条测的是真通道）',
  noSwitch.themeState.active.id === 'shan-qing-ting-cai'
  && !noSwitch.overrides.has('theme-gallery: 配色'),
  `实际 ${noSwitch.themeState.active.id} / ${JSON.stringify([...noSwitch.overrides.keys()])}`)

// 卡片本体：点它 = 用"亮着的那一格"（从没选过时就是默认的石榴金）。
//
// 用一次**全新的** runBoot：上面那一次已经选过青莲·金玉，而"亮着的那一格"本来就该跟着
// 记住的方案走 —— 那条规则另有一组断言（下面第二条）。这里要测的是"从没选过时的默认"。
const bodyPicks = []
const bodyRun = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
const bodyTree = bodyRun.cardTree(
  'shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC },
  (schemeId) => bodyPicks.push(schemeId),
)
const pickerCardEl = bodyTree.tree.find((call) => call.props?.className === 'tg-card tg-picker-card')
check('配色卡本体带点击处理（用户要求：点卡片就要生效）',
  pickerCardEl !== undefined && typeof pickerCardEl.props.onClick === 'function')
pickerCardEl.props.onClick()
check('点卡片本体 = 应用亮着的那一格（没选过时是默认的石榴金）',
  bodyPicks.length === 1 && bodyPicks[0] === 'p-shi-liu-jin', `实际 ${JSON.stringify(bodyPicks)}`)
// 选过之后，卡片本体跟随"记住的那一套"。
const rememberedPicks = []
const rememberedTree = live.cardTree(
  'shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC },
  (schemeId) => rememberedPicks.push(schemeId),
)
rememberedTree.tree.find((call) => call.props?.className === 'tg-card tg-picker-card').props.onClick()
check('选过之后，点卡片本体用的是记住的那一套（青莲·金玉），不是永远回到默认',
  rememberedPicks[0] === 'p-qing-lian-jin', `实际 ${JSON.stringify(rememberedPicks)}`)

// 点色格必须拦住冒泡：不然卡片的处理器会紧接着把它覆盖回原来那格（症状同样是"点了没反应"）。
const bubblePicks = []
let bubbleStopped = false
const bubbleTree = live.cardTree(
  'shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC },
  (schemeId) => bubblePicks.push(schemeId),
)
const bubbleSlot = bubbleTree.tree.filter((call) => call.props?.className === 'tg-swatch')[3]
bubbleSlot.props.onClick({ stopPropagation: () => { bubbleStopped = true } })
check('点色格会拦住冒泡，并且只交出它自己的 id',
  bubbleStopped && bubblePicks.length === 1 && bubblePicks[0] === 'p-hai-tang-hong',
  `stopped=${bubbleStopped} picks=${JSON.stringify(bubblePicks)}`)

// 反证 7：拆掉 stopPropagation，上面那条必须翻转。
const mutBubble = source.replace(
  "if (event !== undefined && typeof event.stopPropagation === 'function') event.stopPropagation()", '',
)
check('反证 7 真的改动了源码（拆掉拦住冒泡那一行）', mutBubble !== source)
let leakedStopped = false
runBoot({ activeId: 'shi-liu-jin', seedSkin: 'shi-liu-jin', wireSlots: true, bundleSource: mutBubble })
  .cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[3]
  .props.onClick({ stopPropagation: () => { leakedStopped = true } })
check('反证 7：拆掉之后不再拦冒泡（说明上面那条断言测的是真通道）', leakedStopped === false)

// ── 用户报的第二个 bug：徽标在「浅色」与「纯色/拼色」之间来回跳 ────────────────
//
// 根因：徽标原先读服务当下的 `preference`，而 `ensureSkinPainted` 的**跳转重试**会先切到
// 内置主题（`BUILT_IN_PROBE_THEME` = `light`）再切回皮肤 —— 中间态一旦被报上来，徽标就跳一下。
//
// ⚠️ 这条不能靠"点一下再断言序列里没有 light"来测：**第一版就是这么写的，而它是空转的**
// ——桩里表现层在 `drive()` 期间就落色了，跳转重试压根不触发，于是"没有 light"必然成立，
// 反证（拆掉排除逻辑）也不翻转。反证当场把这条空转断言抓了出来（规则 3）。
// 所以改成**把判定函数抽出来直接喂中间态**：这是唯一能确定性地构造那一帧的办法。
const constOf = (name) => {
  const found = new RegExp(`const ${name} = ([^\\n]+)`).exec(source)
  if (found === null) throw new Error(`const ${name} not found`)
  // eslint-disable-next-line no-new-func
  return `const ${name} = ${found[1].trim()}`
}
/** 从一个函数声明的 `{` 起做括号配对，切出完整函数体（缩进无关）。 */
const sliceFunction = (text, name) => {
  const at = text.indexOf(`function ${name}(`)
  if (at < 0) throw new Error(`function ${name} not found`)
  let depth = 0
  for (let i = text.indexOf('{', at); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return text.slice(at, i + 1)
    }
  }
  throw new Error(`function ${name} is unbalanced`)
}
/**
 * 抽出「徽标落在哪张卡」的判定，喂给它一个**确定性的** store 与 localStorage。
 * @param text - 源码文本。
 * @param store - 假装 localStorage 里存着的东西。
 * @param activeId - 快照里服务报告的**活动主题**（中间态就是在这里构造的）。
 * @returns 判定结果。
 */
const badgeFor = (text, store, activeId) => {
  const fakeWindow = {
    localStorage: {
      getItem: (key) => (key in store ? store[key] : null),
      setItem: (key, value) => { store[key] = String(value) },
      removeItem: (key) => { delete store[key] },
    },
  }
  const bundled = (id) => (id === 'shi-liu-jin' || id === 'shan-qing-ting-cai' ? { id } : undefined)
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'window', 'bundledTheme',
    [
      constOf('SKIN_KEY'), constOf('BUILT_IN_KEY'), constOf('SCHEME_KEY'),
      constOf('DEFAULT_SKIN'), constOf('DEFAULT_SCHEME'), constOf('PALETTE_ANCHOR'),
      constOf('BUILT_IN_PROBE_THEME'), 'const PALETTE_SCHEMES = []',
      sliceFunction(text, 'rememberedScheme'), sliceFunction(text, 'rememberedSkin'),
      sliceFunction(text, 'builtInChoice'), sliceFunction(text, 'wantedSkin'),
      sliceFunction(text, 'appliedCardId'),
      'return { appliedCardId }',
    ].join('\n'),
  )
  return factory(fakeWindow, bundled).appliedCardId({ active: { id: activeId }, preference: activeId })
}

const SKIN_KEY = 'theme-gallery:last-skin'
const BUILT_IN_KEY = 'theme-gallery:built-in-choice'
check('跳转中间态（服务临时报 light）不会把徽标挪到浅色上 —— 用户报的来回跳',
  badgeFor(source, { [SKIN_KEY]: 'shi-liu-jin' }, 'light') === 'shi-liu-jin',
  `实际 ${badgeFor(source, { [SKIN_KEY]: 'shi-liu-jin' }, 'light')}`)
check('跳转结束、服务报回皮肤时，徽标仍在皮肤上（同一格，不会闪两次）',
  badgeFor(source, { [SKIN_KEY]: 'shi-liu-jin' }, 'shi-liu-jin') === 'shi-liu-jin')
check('用户**主动**选过内置外观时，徽标照样走到浅色（上面那条只排除中间态，不排除用户的选择）',
  badgeFor(source, { [BUILT_IN_KEY]: 'light' }, 'light') === 'light',
  `实际 ${badgeFor(source, { [BUILT_IN_KEY]: 'light' }, 'light')}`)
check('用户主动选深色时同理', badgeFor(source, { [BUILT_IN_KEY]: 'dark' }, 'dark') === 'dark')
check('什么都没选过时跟随服务当下的活动主题（不是永远回到默认皮肤）',
  badgeFor(source, {}, 'shan-qing-ting-cai') === 'shan-qing-ting-cai',
  `实际 ${badgeFor(source, {}, 'shan-qing-ting-cai')}`)

// 反证 8：把"排除中间态"那一步拆掉，第一条断言必须翻转。
const mutBadge = source.replace(
  'if (wanted !== null && active.id === BUILT_IN_PROBE_THEME && builtInChoice() === null) return wanted', '',
)
check('反证 8 真的改动了源码（拆掉中间态的排除）', mutBadge !== source)
check('反证 8：拆掉之后，中间态就把徽标挪到浅色上了（说明第一条断言测的是真通道）',
  badgeFor(mutBadge, { [SKIN_KEY]: 'shi-liu-jin' }, 'light') === 'light',
  `实际 ${badgeFor(mutBadge, { [SKIN_KEY]: 'shi-liu-jin' }, 'light')}`)

// 端到端那一半：点子格之后，store 报上来的最后一个"选中卡片"必须是这张卡。
const livePick = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
livePick.cardTree('shi-liu-jin', { 'shi-liu-jin': PICKER_ROWS }, { 'shi-liu-jin': BLOCK_DESC })
  .tree.filter((call) => call.props?.className === 'tg-swatch')[10].props.onClick()
livePick.drive(30)
check('点色块后，最后报给 store 的选中卡片是纯色/拼色那张',
  livePick.syncSelections[livePick.syncSelections.length - 1] === 'shi-liu-jin',
  `实际 ${JSON.stringify(livePick.syncSelections)}`)
const toBuiltIn = runBoot({ activeId: 'shi-liu-jin', seedSkin: 'shi-liu-jin', wireSlots: true })
toBuiltIn.clickCard('light')
toBuiltIn.drive(30)
check('主动点浅色卡时，最后报给 store 的选中卡片是浅色',
  toBuiltIn.syncSelections[toBuiltIn.syncSelections.length - 1] === 'light',
  `实际 ${JSON.stringify(toBuiltIn.syncSelections)}`)

// 反证 8 已在上面的「判定函数」那一组里做（同一份 mutBadge）—— 端到端那条在这里不需要
// 再来一次：空转的正是"跑一遍再断言序列"，所以这里**刻意只留判定函数的反证**。

// ── 宠物挂件卡（宠物家族 × 7）：开关不碰主题、舞台真的建得起来 ────────────────
//
// 挂件卡与主题服务正交：点它**绝不 setTheme**（这是"可与任何皮肤同时开启"的前提），
// 状态写 localStorage，舞台画在自己的固定层里、锚定对话输入框。渲染那一半走 cardTree
// （挂件 id 已在桩的 ids 里），行为那一半走 pageFace().togglePet()/pickPet() —— 与用户
// 点击同一条链。PET_WIDGET 的文案直接从源码里求值，tooltip 断言钉的是出货文案，
// 不是测试里另抄的一份。它是多行对象字面量，constOf 的单行正则取不了 —— 用花括号
// 配平取完整字面量。
const petWidgetLiteral = (() => {
  const marker = 'const PET_WIDGET = '
  const at = source.indexOf(marker)
  if (at < 0) throw new Error('const PET_WIDGET not found')
  const from = at + marker.length
  let depth = 0
  let end = -1
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) { end = i; break }
    }
  }
  if (end < 0) throw new Error('const PET_WIDGET literal not terminated')
  return source.slice(from, end + 1)
})()
// eslint-disable-next-line no-new-func
const PET_WIDGET_DATA = new Function(`return ${petWidgetLiteral}`)()
const PET_DESC = PET_WIDGET_DATA.description
const PET_ON_SEED = JSON.stringify({ on: true })

// 渲染那一半：卡面形态（div 卡身 + 7 颗头像 + 与舞台同源的卡面图案）。
const petRender = runBoot({ activeId: 'light', wireSlots: true })
petRender.localStorage.setItem('theme-gallery:pet', PET_ON_SEED)
const petBuilt = petRender.cardTree('pet-family', {}, { 'pet-family': PET_DESC })
const petCardEl = petBuilt.tree.find((call) => call.props?.className === 'tg-card tg-pet-card')
const petSwatches = petBuilt.tree.filter((call) => call.props?.className === 'tg-petswatch')
const petArtEl = petBuilt.tree.find((call) => call.props?.className === 'tg-pet-art')
check('挂件卡渲染出来，是 div（内含 7 颗头像按钮，button 套 button 非法）',
  petCardEl !== undefined && petCardEl.type === 'div')
check('头像选择行 7 颗齐全，当前宠物（ban-ban）那颗 aria-pressed=true、其余 false',
  petSwatches.length === 7
  && petSwatches.every((call) => call.type === 'button')
  && petSwatches.filter((call) => call.props['aria-pressed'] === true).length === 1
  && petSwatches[0].props['aria-pressed'] === true
  && petSwatches[0].props.title === '斑斑 · 小奶狗')
check('挂件卡不渲染正文介绍（与配色卡同一条"不渲染 desc"分支）',
  !petBuilt.tree.some((call) => call.props?.className === 'tg-desc'))
check('挂件卡的 tooltip 是 description（schema 那个字段在这里只作 tooltip）',
  petCardEl?.props.title === PET_DESC,
  `实际 ${JSON.stringify(petCardEl?.props.title)}`)
check('卡面图案与舞台同源（dangerouslySetInnerHTML 里是注册表的 side markup + 道具）',
  petArtEl !== undefined
  && String(petArtEl.props.dangerouslySetInnerHTML.__html).includes('M15 36 Q4 31 6.5 21')
  && String(petArtEl.props.dangerouslySetInnerHTML.__html).includes('#E06A4E'))
check('开启时徽标显示"开启"态（t 桩返回键名，所以看到的是 petOn）',
  petBuilt.tree.some((call) => call.props?.className === 'tg-badge' && call.props.children === 'petOn'))
const petOffBuilt = runBoot({ activeId: 'light', wireSlots: true })
  .cardTree('pet-family', {}, { 'pet-family': PET_DESC })
const petOffEl = petOffBuilt.tree.find((call) => call.props?.className === 'tg-card tg-pet-card')
check('关闭时徽标走"关"态（卡身是 div 没有 pressed 语义，开关状态由徽标文字承载）',
  petOffBuilt.tree.some((call) => call.props?.className === 'tg-badge tg-badge-off'
    && call.props.children === 'petOff')
  && petOffEl !== undefined)

// 行为那一半：完整链路（点卡片 → togglePet → togglePetWidget → 舞台 + publish + markPet）。
const petLive = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
const petWritesBefore = petLive.setThemeCalls.length
petLive.pageFace().togglePet()
petLive.drive(30)
check('点挂件卡：状态写进 localStorage（下次启动还记得）',
  (petLive.localStorage.getItem('theme-gallery:pet') ?? '').includes('"on":true'))
check('点挂件卡：主题服务一次都没被碰（setTheme 序列不变 —— 可与任何皮肤同时开启的前提）',
  petLive.setThemeCalls.length === petWritesBefore,
  `点击前后序列：${JSON.stringify(petLive.setThemeCalls)}`)
check('点挂件卡：舞台真的建起来了（#dsh-theme-pet 在文档里）',
  petLive.document_.querySelector('#dsh-theme-pet') !== null)
check('点挂件卡：面板徽标收到"已开启"（store 桩记下 markPet 的实参）',
  petLive.petMarks[petLive.petMarks.length - 1] === true)
check('publish 把"当前是哪只"报给 store（markPetKind 链路通，头像点亮靠它）',
  petLive.petKindMarks[petLive.petKindMarks.length - 1] === 'ban-ban')
// 再点一次：关掉，舞台拆掉。
petLive.pageFace().togglePet()
petLive.drive(30)
check('再点一次：挂件关闭，舞台被拆除（开关是双向的，不是单向门）',
  petLive.document_.querySelector('#dsh-theme-pet') === null
  && petLive.petMarks[petLive.petMarks.length - 1] === false)

// 启用状态随启动恢复：上次开着，这次启动舞台就在（不用再点一次）。
const petRestore = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED })
check('上次开着时，启动即建舞台（不用再点一次）',
  petRestore.document_.querySelector('#dsh-theme-pet') !== null)

// 急停开关一并停掉挂件：它是与 ambient 同源的装饰层刹车。
const petKilled = runBoot({
  activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, config: { ambient: false },
})
check('ambient:false 时挂件也不启动（急停开关管全部装饰层）',
  petKilled.document_.querySelector('#dsh-theme-pet') === null)

// ── 二期：点头像换宠物（完整链路 pickPet → selectPetWidget → 舞台重建）────────
const petPick = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
const pickWritesBefore = petPick.setThemeCalls.length
petPick.pageFace().pickPet('da-ju')
petPick.drive(30)
const pickStage = petPick.document_.querySelector('#dsh-theme-pet')
check('点头像：kind 落盘（da-ju），舞台按新宠物重建（dataset.petKind）',
  pickStage !== null && pickStage.dataset.petKind === 'da-ju'
  && (petPick.localStorage.getItem('theme-gallery:pet') ?? '').includes('"kind":"da-ju"'))
check('点头像：舞台上真的是橘猫（figure 的 markup 含橘猫本体色 #F2A65A，注册表独家）',
  (() => {
    const figure = pickStage === null ? null : pickStage.querySelector('.dsh-pet-figure')
    return figure !== null && figure.innerHTML.includes('#F2A65A')
  })())
check('点头像：placed 复位为 false（切宠按新宠物缺省摆位重新入座）',
  (() => {
    try { return JSON.parse(petPick.localStorage.getItem('theme-gallery:pet')).placed === false } catch { return false }
  })())
check('点头像：跑动类名按新宠物步态挂上（橘猫 = run）',
  (() => {
    const actor = pickStage === null ? null : pickStage.children.find((n) => String(n.className).includes('dsh-pet-actor'))
    return actor !== undefined && actor.classList.contains('dsh-pet-run')
  })())
check('点头像全程不碰主题服务（挂件与皮肤正交的另一半证据）',
  petPick.setThemeCalls.length === pickWritesBefore,
  `点击前后序列：${JSON.stringify(petPick.setThemeCalls)}`)
check('点头像后，store 收到新的 kind（头像点亮跟着换）',
  petPick.petKindMarks[petPick.petKindMarks.length - 1] === 'da-ju')
check('不认识的宠物 id 被静默拒绝（照 chooseScheme 的规矩，localStorage 不被污染）',
  (() => {
    petPick.pageFace().pickPet('no-such-pet')
    return !(petPick.localStorage.getItem('theme-gallery:pet') ?? '').includes('no-such-pet')
  })())

// 关着时点头像 = 顺路打开（"点哪只出哪只"）。
const petPickOn = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true })
petPickOn.pageFace().pickPet('bo-bo')
petPickOn.drive(30)
check('挂件关着时点头像：连 on:true 一起落盘，舞台直接建出来',
  (petPickOn.localStorage.getItem('theme-gallery:pet') ?? '').includes('"on":true')
  && petPickOn.document_.querySelector('#dsh-theme-pet')?.dataset.petKind === 'bo-bo')

// 头像按钮必须拦冒泡（配色卡踩过的坑：不拦会被卡身处理器覆盖）。
const petBubbleGuard = runBoot({ activeId: 'light', wireSlots: true })
petBubbleGuard.localStorage.setItem('theme-gallery:pet', PET_ON_SEED)
const guardTree = petBubbleGuard.cardTree('pet-family', {}, { 'pet-family': PET_DESC })
const guardSwatch = guardTree.tree.find((call) => call.props?.className === 'tg-petswatch'
  && call.props['aria-pressed'] === false)
let guardStopped = false
guardSwatch.props.onClick({ stopPropagation: () => { guardStopped = true } })
check('点头像先拦冒泡、再走换宠链路（kind 落盘 = 拦截没把点击吞掉）',
  guardStopped === true
  && (petBubbleGuard.localStorage.getItem('theme-gallery:pet') ?? '').includes('"kind"'))

// ── 旧状态迁移：一期形状 {on,name,placed,dog,ball} 原地升级 ────────────────────
const PET_OLD_SEED = JSON.stringify({
  on: true, name: '小白', placed: true,
  dog: { dx: -200, dy: -100 }, ball: { dx: -260, dy: -40 },
})
const petMigrated = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_OLD_SEED })
const migratedStage = petMigrated.document_.querySelector('#dsh-theme-pet')
check('一期形状迁移：启动即建舞台（on:true 被读懂），kind 落回 ban-ban',
  migratedStage !== null && migratedStage.dataset.petKind === 'ban-ban')
check('一期形状迁移：名字"小白"没丢（name → names["ban-ban"]）',
  migratedStage?.querySelector('.dsh-pet-name')?.textContent === '小白')
check('一期形状迁移：拖动后保存的是新键（pet/prop），不再是 dog/ball',
  (() => {
    const actor = migratedStage.children.find((n) => String(n.className).includes('dsh-pet-actor'))
    actor._fire('pointerdown', { clientX: 500, clientY: 400, pointerId: 1, currentTarget: actor })
    actor._fire('pointermove', { clientX: 400, clientY: 400 })
    actor._fire('pointerup', {})
    try {
      const saved = JSON.parse(petMigrated.localStorage.getItem('theme-gallery:pet'))
      return saved.pet !== undefined && saved.dog === undefined
        && saved.names?.['ban-ban'] === '小白'
    } catch { return false }
  })())

// ── 闲聊的时间闸：桩的 drive() 会立即执行定时器，闸门必须挡住伪闲聊 ────────────
// 种子把宠物摆成"宠物左上角与道具中心重合"（petDistanceToProp 的语义）：出生即
// idle（桩里 rAF 连发、dt 常为 0，跑动永远跑不完 —— 不强制 idle 的话，"没有闲聊
// 气泡"测的是"它在跑"而不是"闸门生效"）。偏移按**显示尺寸**（PET_SCALE=1.15，
// ban-ban 73.6×64.4 / 毛线团 29.9×25.3）反推：宠物 {dx:-160,dy:-90} → 左上角
// (1120,860)；道具要与宠物**中心**同点 → 中心 (1156.8,892.2) → propY=879.55。
const PET_IDLE_SEED = JSON.stringify({
  on: true, placed: true,
  pet: { dx: -160, dy: -90 }, prop: { dx: -160, dy: -70.45 },
})
const petChatGate = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_IDLE_SEED })
petChatGate.drive(200)
check('闲聊不误触：桩里跑完 200 轮定时器，一个闲聊气泡都没冒（时间闸生效）',
  !petChatGate.created.some((n) => String(n.className).includes('dsh-pet-bubble')))

// ── 生成中反应：桩里塞一个"停止生成"按钮 → 加油；拿走 → 完成庆祝 ───────────────
const petWork = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED })
petWork.document_.stopButton = petWork.document_.createElement('button')
petWork.pageFace().pickPet('ban-ban')   // 同宠重建 → 触发一次完整同步（含信号检测）
const cheerBubbles = petWork.created.filter((n) => String(n.className).includes('dsh-pet-bubble'))
check('检测到"停止生成"按钮：加油气泡出现（文本 = 注册表的 cheer）',
  cheerBubbles.some((n) => n.textContent === '汪汪！加油！'))
petWork.document_.stopButton = null
petWork.pageFace().pickPet('ban-ban')
check('信号消失：完成气泡出现（文本 = 注册表的 done，且只在忙过之后）',
  petWork.created.some((n) => n.textContent === '汪汪！完成啦！'))
const petIdleWork = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED })
petIdleWork.pageFace().pickPet('ban-ban')
check('从没忙过就不庆祝（下降沿只在"忙过"之后才有反应）',
  !petIdleWork.created.some((n) => n.textContent === '汪汪！完成啦！'))

// 交互那一半：桩把事件监听记了下来，这里把"用户真的操作了"演出来 ——
// 戳一下、改名、拖拽，是这次需求点名的三个动作，各自断言到可观测的结果上。
const petPlay = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED })
check('挂件启动路径干净：effect 里没有抛错（桩缺副作用时在这里现形）',
  petPlay.bootError === undefined, `实际 ${String(petPlay.bootError)}`)
const petStageNode = petPlay.document_.querySelector('#dsh-theme-pet')
const playActor = petStageNode.children.find((n) => String(n.className).includes('dsh-pet-actor'))
const playProp = petStageNode.children.find((n) => String(n.className).includes('dsh-pet-prop'))
check('舞台里真的有宠物、有道具（结构节点齐全，不是一张空层）',
  playActor !== undefined && playProp !== undefined)
// 显示放大（实机验收"整体偏小"）：舞台宽高 = 注册表 size × PET_SCALE（1.15）。
// 注册表与 viewBox 保持 1:1（check-pet-registry P3 钉住），放大只发生在消费侧 ——
// 这里量的是舞台 actor 的内联宽高，正是运行时真正画出来的尺寸。
check('宠物显示尺寸 = 注册表 × 1.15（斑斑 64×56 → 73.6×64.4）',
  Math.abs(parseFloat(playActor.style.width) - 64 * 1.15) < 0.01
  && Math.abs(parseFloat(playActor.style.height) - 56 * 1.15) < 0.01)
const pokeButton = petStageNode.querySelector('.dsh-pet-poke')
const renameButton = petStageNode.querySelector('.dsh-pet-rename')
const petInput = petStageNode.querySelector('.dsh-pet-input')
const petTag = petStageNode.querySelector('.dsh-pet-tag')
const petName = petStageNode.querySelector('.dsh-pet-name')
// 拖拽先测（react 期间会被忽略 —— 那是刻意的，但桩里不会自动推进时钟）。
// 按住宠物拖到左边松手 → 位置偏移存盘，且全程不碰主题服务。
const dragWritesBefore = petPlay.setThemeCalls.length
playActor._fire('pointerdown', { clientX: 500, clientY: 400, pointerId: 1, currentTarget: playActor })
playActor._fire('pointermove', { clientX: 400, clientY: 400 })
playActor._fire('pointerup', {})
check('拖宠物松手：新位置写进 localStorage（视口相对偏移 + placed 标记，键名是 pet）',
  (() => {
    try {
      const state = JSON.parse(petPlay.localStorage.getItem('theme-gallery:pet'))
      return state.placed === true && typeof state.pet?.dx === 'number' && state.pet.dx < 0
        && typeof state.pet?.dy === 'number'
    } catch { return false }
  })())
check('拖宠物全程不碰主题服务（挂件与皮肤正交的另一半证据）',
  petPlay.setThemeCalls.length === dragWritesBefore)
// 松手后宠物要跑向道具：跑动类名应已挂上（拖完道具/宠物都会追）。
check('松手后进入跑动状态（拖完道具/宠物都会追）',
  playActor.classList.contains('dsh-pet-run'))
// 朝向与镜像：flip 层独立于跑步动画层 —— 同层时动画覆盖内联 transform，
// 宠物会朝左跑却头朝右（真机事故"倒着跑"的根因）。
const playFlip = petStageNode.querySelector('.dsh-pet-flip')
check('镜像写在独立的 flip 层（figure 是它的子节点，动画与朝向分离）',
  playFlip !== undefined && playFlip.children.some((n) => String(n.className).includes('dsh-pet-figure')))
check('缺省朝左（道具在左侧 → flip 层 scaleX(-1)）',
  playFlip !== undefined && playFlip.style.transform === 'scaleX(-1)',
  `实际 ${JSON.stringify(playFlip === undefined ? undefined : playFlip.style.transform)}`)

// 反证 14：把"先停跑、再进拖拽态"的顺序反过来，petDragMove 会因 mode 不是 drag 而
// 拒绝跟手 —— 拖动整个静默失效（这个 bug 在修好前真实存在，症状与"点了没反应"同族）。
const mutDragOrder = source.replace(
  '        petStopRun()\n        petRun.mode = \'drag\'',
  '        petRun.mode = \'drag\'\n        petStopRun()',
)
check('反证 14 真的改动了源码（先进拖拽态、再停跑 —— mode 被覆写）',
  mutDragOrder !== source && mutDragOrder.includes("petRun.mode = 'drag'\n        petStopRun()"))
const dragBroken = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, bundleSource: mutDragOrder })
const brokenActor = dragBroken.document_.querySelector('#dsh-theme-pet')
  .children.find((n) => String(n.className).includes('dsh-pet-actor'))
brokenActor._fire('pointerdown', { clientX: 500, clientY: 400, pointerId: 1, currentTarget: brokenActor })
brokenActor._fire('pointermove', { clientX: 400, clientY: 400 })
brokenActor._fire('pointerup', {})
check('反证 14：顺序反过来后，拖动不再跟手（保存的偏移还是没动过的缺省值 -100）',
  (() => {
    try {
      const state = JSON.parse(dragBroken.localStorage.getItem('theme-gallery:pet'))
      return state.pet?.dx === -100
    } catch { return false }
  })())
pokeButton._fire('click')
check('戳一下：叫声气泡真的出现在舞台上',
  petStageNode.children.some((n) => String(n.className).includes('dsh-pet-bubble')))
renameButton._fire('click')
check('点改名：名牌进入编辑态（输入框接管，不依赖悬停）',
  petTag !== undefined && petTag.classList.contains('dsh-pet-editing'))
petInput.value = '小白'
petInput._fire('keydown', { key: 'Enter' })
check('回车提交：新名字写进 localStorage 的 names 表（按宠记忆，重启后还记得）',
  (() => {
    try { return JSON.parse(petPlay.localStorage.getItem('theme-gallery:pet')).names['ban-ban'] === '小白' }
    catch { return false }
  })())
check('提交后名牌显示新名字、退出编辑态',
  petName.textContent === '小白' && !petTag.classList.contains('dsh-pet-editing'))

// 反证 12：开关不再写运行态，点卡片就建不出舞台。
const mutPetToggle = source.replace('petRun.enabled = next', 'petRun.enabled = false')
check('反证 12 真的改动了源码（开关不再写运行态）', mutPetToggle !== source)
const noPetBuild = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, bundleSource: mutPetToggle })
noPetBuild.pageFace().togglePet()
noPetBuild.drive(30)
check('反证 12：开关不写运行态后，点卡片不再建出舞台（说明上面那条测的是真通道）',
  noPetBuild.document_.querySelector('#dsh-theme-pet') === null)

// 反证 13：挂件开关一旦顺路写主题服务，setTheme 序列就不再为空 —— 正是那条"零接触"断言的镜像。
const mutPetTheme = source.replace(
  'savePetState({ on: next })',
  "savePetState({ on: next })\n          ctx.theme.setTheme('meng-hai-you-yu')",
)
check('反证 13 真的改动了源码（挂件开关顺路写了一次主题）', mutPetTheme !== source)
const petThemeLeak = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, bundleSource: mutPetTheme })
const leakBefore = petThemeLeak.setThemeCalls.length
petThemeLeak.pageFace().togglePet()
check('反证 13：挂件开关碰了主题服务后，setTheme 序列不再不变（说明那条断言测的是真通道）',
  petThemeLeak.setThemeCalls.length > leakBefore
  && petThemeLeak.setThemeCalls.includes('meng-hai-you-yu'))

// ── 挂件自检行：失败必须能被面板看见 ─────────────────────────────────────────
//
// "开了但什么都不出现"是挂件最典型的静默失败。自检行随页面渲染：健康时只进调试开关，
// 警告（舞台没建出 / 被收起 / 样式缺失）无条件显示 —— 与 sceneryLine 同一条纪律。
// 健康读数（调试开关打开时可见，且不是警告）。二期读数多了 品种= 与 活动= 两段。
const petDebug = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED })
petDebug.localStorage.setItem('theme-gallery:debug', '1')
const petDebugTree = petDebug.cardTree('pet-family', {}, { 'pet-family': PET_DESC })
check('挂件健康时，调试读数行出现在面板（含自检通过与几何读数）',
  petDebugTree.page.some((call) => call.props?.className === 'tg-debug'
    && String(call.props.children).includes('挂件自检通过')
    && String(call.props.children).includes('宠x=')))
check('调试读数含 品种= 与 活动= 段（二期的两只新读数）',
  petDebugTree.page.some((call) => call.props?.className === 'tg-debug'
    && String(call.props.children).includes('品种=ban-ban')
    && String(call.props.children).includes('活动=')))
check('挂件健康时没有 ⚠ 警告行',
  !petDebugTree.page.some((call) => String(call.props?.className ?? '').includes('tg-warn')
    && String(call.props.children).includes('挂件')))

// 锚点断裂（真机事故的真正根因：.centerCol 是带哈希的类名，精确匹配永远落空）：
// 现在的行为是回退到视口右下（dsh-pet 式），挂件绝不消失。
// 变异直接让 petAnchorBox 恒返 null（桩的松散类名匹配会"救活"单个选择器的变异）。
const mutPetAnchor = source.replace(
  '    function petAnchorBox() {\n      if (typeof document === \'undefined\') return null',
  '    function petAnchorBox() {\n      return null\n      if (typeof document === \'undefined\') return null',
)
check('反证 16 真的改动了源码（挂件找不到输入框锚点）', mutPetAnchor !== source)
const petBroken = runBoot({
  activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, bundleSource: mutPetAnchor,
})
petBroken.localStorage.setItem('theme-gallery:debug', '1')
const petBrokenTree = petBroken.cardTree('pet-family', {}, { 'pet-family': PET_DESC })
check('锚点断裂时，舞台按视口右下回退建出（dsh-pet 式），绝不"开了却消失"',
  petBroken.document_.querySelector('#dsh-theme-pet') !== null)
check('回退模式下自检行不告警（挂件可见即健康），但读数写明"视口回退"',
  !petBrokenTree.page.some((call) => String(call.props?.className ?? '').includes('tg-warn')
    && String(call.props.children).includes('挂件'))
  && petBrokenTree.page.some((call) => call.props?.className === 'tg-debug'
    && String(call.props.children).includes('视口回退')))

// 回退地面线的抬量（实机验收：主题面板页 composer 隐藏 → 视口回退 → 宠物贴窗底
// 被裁掉一截）。桩视口高 950：抬 48 后地面 = 950 - 48 - 2 = 900，宠物完整在窗内。
// 锚点找到时地面贴输入框下缘，一个像素都不变 —— 那条路由真机保证，桩里测不到。
check('回退时地面线抬高 48px（地面=900，宠物不再贴窗底被裁）',
  petBrokenTree.page.some((call) => call.props?.className === 'tg-debug'
    && String(call.props.children).includes('视口回退')
    && String(call.props.children).includes('地面=900')))

// 反证 17：拆掉抬量（回退仍贴窗底）。在"锚点恒 null"的变异上再拆抬量 ——
// 只拆抬量而不拆锚点的话，桩里锚点若是好的，这条断言就在测别的路径。
const mutNoGap = mutPetAnchor.replace(
  'viewport.height - PET_FALLBACK_GROUND_GAP : anchor.bottom',
  'viewport.height : anchor.bottom',
)
check('反证 17 真的改动了源码（回退抬量被拆掉）', mutNoGap !== mutPetAnchor)
const noGapBoot = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, bundleSource: mutNoGap })
noGapBoot.localStorage.setItem('theme-gallery:debug', '1')
const noGapTree = noGapBoot.cardTree('pet-family', {}, { 'pet-family': PET_DESC })
check('反证 17：拆掉抬量后地面读数回到窗底（944 = min(950-2,950-6)，说明上面那条测的是真通道）',
  noGapTree.page.some((call) => call.props?.className === 'tg-debug'
    && String(call.props.children).includes('地面=944')))

// 反证 18：PET_SCALE 改回 1（放大被拆）→ 舞台宽高回到注册表尺寸。
const mutNoScale = source.replace('const PET_SCALE = 1.15', 'const PET_SCALE = 1')
check('反证 18 真的改动了源码（PET_SCALE 改回 1）', mutNoScale !== source)
const noScaleBoot = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, bundleSource: mutNoScale })
const noScaleActor = noScaleBoot.document_.querySelector('#dsh-theme-pet')
  ?.children.find((n) => String(n.className).includes('dsh-pet-actor'))
check('反证 18：放大拆掉后舞台宽高 = 注册表原值（64px，说明上面那条测的是真通道）',
  noScaleActor !== undefined && noScaleActor.style.width === '64px')

// 反证 15：拆掉"警告不经调试开关也要显示"的守卫，上面那条必须翻转。
const mutPetWarnHidden = source.replace(
  'const showPet = petLine !== null && (debugEnabled() || petLineIsWarning(petLine))',
  'const showPet = petLine !== null && debugEnabled()',
)
check('反证 15 真的改动了源码（警告改回只跟调试开关）', mutPetWarnHidden !== source)
const petWarnHidden = runBoot({
  activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, bundleSource: mutPetWarnHidden,
})
const petWarnHiddenTree = petWarnHidden.cardTree('pet-family', {}, { 'pet-family': PET_DESC })
check('反证 15：警告守卫被拆后，锚点断裂在面板上不再可见（说明上面那条测的是真通道）',
  !petWarnHiddenTree.page.some((call) => String(call.props?.className ?? '').includes('tg-warn')
    && String(call.props.children).includes('挂件')))

// ── 二期反证 N1..N4 + 闲聊句柄清理性（源码级，配反证）────────────────────────

// 反证 N1：切宠不再复位 placed → "重新入座"断言翻转。
const mutNoReplace = source.replace('const patch = { kind: kindId, placed: false }', 'const patch = { kind: kindId }')
check('反证 N1 真的改动了源码（切宠不再复位 placed）', mutNoReplace !== source)
const noReplaceBoot = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_OLD_SEED, bundleSource: mutNoReplace })
noReplaceBoot.pageFace().pickPet('da-ju')
check('反证 N1：不复位后 placed 仍是 true（上面"重新入座"那条测的是真通道）',
  (() => {
    try { return JSON.parse(noReplaceBoot.localStorage.getItem('theme-gallery:pet')).placed === true } catch { return false }
  })())

// 反证 N2：拆掉加油分支 → "停止生成"出现时不再有 cheer 气泡。
const mutNoCheer = source.replace('if (working) petCheer()', 'if (false) petCheer()')
check('反证 N2 真的改动了源码（加油分支被拆）', mutNoCheer !== source)
const noCheerBoot = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, bundleSource: mutNoCheer })
noCheerBoot.document_.stopButton = noCheerBoot.document_.createElement('button')
noCheerBoot.pageFace().pickPet('ban-ban')
check('反证 N2：加油分支拆掉后，"停止生成"出现也不再冒加油气泡',
  !noCheerBoot.created.some((n) => n.textContent === '汪汪！加油！'))

// 反证 N3：拆掉闲聊的时间闸 → 桩的立即定时器立刻冒出闲聊气泡。
const mutNoGate = source.replace(
  'if (petLastInteractAt === 0 || idleFor < CHATTER_FIRST_MS) { schedulePetChatter(); return }',
  'if (false) { schedulePetChatter(); return }',
)
check('反证 N3 真的改动了源码（闲聊时间闸被拆）', mutNoGate !== source)
const noGateBoot = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_IDLE_SEED, bundleSource: mutNoGate })
noGateBoot.drive(200)
check('反证 N3：时间闸拆掉后，桩里立刻冒出闲聊气泡（说明 B10 测的是真通道）',
  noGateBoot.created.some((n) => String(n.className).includes('dsh-pet-bubble')))

// 反证 N4：头像 onClick 不再拦冒泡 → 拦截断言翻转。
const mutNoStop = source.replace(
  'onClick: (event) => {\n            if (event !== undefined && typeof event.stopPropagation === \'function\') event.stopPropagation()\n            onPick(kind.id)\n          },',
  'onClick: (event) => { onPick(kind.id) },',
)
check('反证 N4 真的改动了源码（头像点击不再拦冒泡）', mutNoStop !== source)
const noStopBoot = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutNoStop, seedPet: PET_ON_SEED })
const noStopTree = noStopBoot.cardTree('pet-family', {}, { 'pet-family': PET_DESC })
const noStopSwatch = noStopTree.tree.find((call) => call.props?.className === 'tg-petswatch'
  && call.props['aria-pressed'] === false)
let noStopStopped = false
noStopSwatch.props.onClick({ stopPropagation: () => { noStopStopped = true } })
check('反证 N4：不拦冒泡后 stopPropagation 不再被调用（说明 B6 测的是真通道）',
  noStopStopped === false)

// 闲聊句柄的清理性（源码级 + 反证）：removePetStage 必须清掉闲聊句柄与 input 监听。
check('removePetStage 清闲聊句柄与 document input 监听（有界性的最后一道闸）',
  /if \(typeof window\.clearTimeout === 'function'\) window\.clearTimeout\(petChatterTimer\)/.test(source)
  && source.includes("document.removeEventListener('input', petOnTyping, true)"))
const mutNoChatterClean = source.replace(
  "if (typeof window.clearTimeout === 'function') window.clearTimeout(petChatterTimer)\n      petChatterTimer = 0",
  '',
)
check('反证 N5 真的改动了源码（闲聊句柄不再被清）', mutNoChatterClean !== source)

// ── 菜单折叠（第 15 张卡）：侧栏入口收放 + 设置分节常驻（方案二）──────────────
// 渲染一半走 cardTree，行为一半走 pageFace().toggleMenuCollapse() —— 与用户点击
// 同一条链。MENU_COLLAPSE_WIDGET 的文案直接从源码里求值，tooltip 断言钉的是出货文案，
// 不是测试里另抄的一份。它是多行对象字面量，用花括号配平取完整字面量。
const menuWidgetLiteral = (() => {
  const marker = 'const MENU_COLLAPSE_WIDGET = '
  const at = source.indexOf(marker)
  if (at < 0) throw new Error('const MENU_COLLAPSE_WIDGET not found')
  const from = at + marker.length
  let depth = 0
  let end = -1
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) { end = i; break }
    }
  }
  if (end < 0) throw new Error('const MENU_COLLAPSE_WIDGET literal not terminated')
  return source.slice(from, end + 1)
})()
// eslint-disable-next-line no-new-func
const MENU_WIDGET_DATA = new Function(`return ${menuWidgetLiteral}`)()
const MENU_DESC = MENU_WIDGET_DATA.description

// 渲染那一半：默认（从未折叠）的卡面形态。
const menuRender = runBoot({ activeId: 'light', wireSlots: true })
const menuBuilt = menuRender.cardTree('menu-collapse', {}, { 'menu-collapse': MENU_DESC })
const menuCardEl = menuBuilt.tree.find((call) => call.props?.className === 'tg-card tg-menu-card')
const menuPathEl = menuBuilt.tree.find((call) => call.props?.className === 'tg-path')
check('折叠卡渲染出来，是 div.tg-card.tg-menu-card（卡内装胶囊按钮，button 套 button 非法）',
  menuCardEl !== undefined && menuCardEl.type === 'div')
const menuSwitchEl = menuBuilt.tree.find((call) => call.props?.className === 'tg-mood-switch')
check('胶囊滑块在卡上（复用心情卡同款）：role=switch、默认 aria-checked=false、状态文字 menuShown',
  menuSwitchEl !== undefined && menuSwitchEl.type === 'button'
  && menuSwitchEl.props['aria-checked'] === false
  // 子元素在 jsx 桩里返回 null（只有 jsxCalls 有记录），状态文字从渲染树里找。
  && menuBuilt.tree.some((call) => call.props?.className === 'tg-mood-state'
    && call.props.children === 'menuShown'))
check('默认关：徽标走"侧栏显示中"态（tg-badge tg-badge-off + menuShown）',
  menuBuilt.tree.some((call) => call.props?.className === 'tg-badge tg-badge-off'
    && call.props.children === 'menuShown'))
let menuSwitchStopped = false
menuSwitchEl.props.onClick({ stopPropagation: () => { menuSwitchStopped = true } })
check('点胶囊：拦住冒泡（卡身也响应点击 —— 不拦会翻转两次）', menuSwitchStopped === true)
check('卡面正文是路径提示（.tg-path，t 桩返回键名 menuHint —— 用户要求把找回路径写在卡上）',
  menuPathEl !== undefined && menuPathEl.props.children === 'menuHint')
check('折叠卡不渲染正文介绍（与配色/挂件/问候卡同一条"不渲染 desc"分支）',
  !menuBuilt.tree.some((call) => call.props?.className === 'tg-desc'))
check('折叠卡的 tooltip 是 description（schema 那个字段在这里只作 tooltip）',
  menuCardEl?.props.title === MENU_DESC,
  `实际 ${JSON.stringify(menuCardEl?.props.title)}`)

// 行为那一半：完整链路（点卡 → toggleMenuCollapse → localStorage + 槽位收放 + publish）。
const menuLive = runBoot({ activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true })
const menuWritesBefore = menuLive.setThemeCalls.length
const liveSidebar = menuLive.slotRegistrations.find((r) => r.name === 'sidebar.panellist')
const liveSection = menuLive.slotRegistrations.find((r) => r.name === 'settings.section')
check('默认（从未折叠）：侧栏入口与设置分节都已注册、未撤销',
  liveSidebar !== undefined && liveSidebar.unregistered === false
  && liveSection !== undefined && liveSection.unregistered === false)
menuLive.pageFace().toggleMenuCollapse()
menuLive.drive(30)
check('点折叠卡：状态写进 localStorage（下次启动还记得；键是 theme-gallery:menu-collapse）',
  (menuLive.localStorage.getItem('theme-gallery:menu-collapse') ?? '').includes('"collapsed":true'))
check('点折叠卡：侧栏注册被撤销（槽位自己的 disposer —— 官方机制，不是 CSS 硬藏）',
  liveSidebar.unregistered === true)
check('点折叠卡：设置分节仍在（面板常驻，不会把自己锁在外面 —— 方案二的核心）',
  liveSection.unregistered === false)
check('点折叠卡：主题服务一次都没被碰（零主题写入 —— 本功能的铁律）',
  menuLive.setThemeCalls.length === menuWritesBefore,
  `点击前后序列：${JSON.stringify(menuLive.setThemeCalls)}`)
check('点折叠卡：面板徽标收到"已折叠"（store 桩记下 markMenuCollapse 的实参）',
  menuLive.menuMarks[menuLive.menuMarks.length - 1] === true)
// 再点一次：恢复。
menuLive.pageFace().toggleMenuCollapse()
menuLive.drive(30)
const restoredSidebars = menuLive.slotRegistrations.filter((r) => r.name === 'sidebar.panellist')
check('再点一次：折叠恢复，侧栏入口重新注册且未撤销（开关是双向的，不是单向门）',
  (menuLive.localStorage.getItem('theme-gallery:menu-collapse') ?? '').includes('"collapsed":false')
  && restoredSidebars.length === 2
  && restoredSidebars[restoredSidebars.length - 1].unregistered === false
  && menuLive.menuMarks[menuLive.menuMarks.length - 1] === false)

// 种子折叠启动：侧栏入口**从未注册**（不是先出现再拆），设置分节照常注册。
const menuSeeded = runBoot({ activeId: 'light', wireSlots: true, seedMenu: '{"collapsed":true}' })
check('上次折叠时，启动即不再注册侧栏入口（从未出现，不是先出现再拆）',
  !menuSeeded.slotRegistrations.some((r) => r.name === 'sidebar.panellist'))
check('上次折叠时，设置分节仍然注册（面板从设置页可达 —— 方案二的保底）',
  menuSeeded.slotRegistrations.some((r) => r.name === 'settings.section' && r.unregistered === false))

// ── 弹窗打开时隐藏挂件（用户 2026-09-27 定）────────────────────────────────────
// 挂件层 z-index 1200 高于模态弹窗 —— 不藏会浮在弹窗内容上（实机读数）。检测走
// 语义属性（dialog[open] / role="dialog" / aria-modal），observer 事件驱动、随舞台起停。
const petDialog = runBoot({ activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED })
check('挂件开着时，弹窗 observer 已随舞台安装（事件驱动，不轮询）',
  petDialog.mutationObservers.length > 0)
const dialogProbe = petDialog.document_.createElement('div')
dialogProbe.setAttribute('role', 'dialog')
petDialog.document_.dialogNode = dialogProbe
for (const obs of petDialog.mutationObservers) obs.callback()
check('弹窗出现 → body 打上标记类（PET_CSS 一条规则据此把挂件层 display:none）',
  String(petDialog.document_.body.className).includes('dsh-dialog-open'))
petDialog.document_.dialogNode = null
for (const obs of petDialog.mutationObservers) obs.callback()
check('弹窗关闭 → 标记类移除，挂件恢复显示',
  !String(petDialog.document_.body.className).includes('dsh-dialog-open'))
check('PET_CSS 里带"弹窗开着藏挂件层"的规则',
  source.includes('body.dsh-dialog-open #dsh-theme-pet{display:none!important}'))
petDialog.pageFace().togglePet()
petDialog.drive(30)
// 不按"最后一个"认 observer —— boot 里 mood 座位的 observer 建在挂件之后，尾部不是
// 挂件的。本 runBoot 里只有挂件的 observer 会被断开（ambient/mood 的断开只发生在
// 插件卸载，boot 不触发），some() 就足够精确；配对的证据是标记类同时被清掉。
check('挂件拆除时，弹窗 observer 被断开、标记类清掉（不留任何痕迹）',
  petDialog.mutationObservers.some((obs) => obs.disconnected === true)
  && !String(petDialog.document_.body.className).includes('dsh-dialog-open'))

// 设置分节（形态 A —— 用户 2026-09-27 定）：**轻量入口**。完整面板在弹窗里会白屏
// （根因见反证 21），而且弹窗挡住换肤的全屏效果 —— 分节只报状态 + 跳转 + 恢复入口。
// 渲染链路照真实外壳：props = t + close + inject 面的展开。
const menuSection = runBoot({ activeId: 'light', wireSlots: true })
const sectionReg = menuSection.slotRegistrations.find((r) => r.name === 'settings.section')
if (sectionReg === undefined) throw new Error('settings.section 没有注册（菜单折叠链路断了）')
const sectionCloses = []
const sectionBefore = menuSection.jsxCalls.length
sectionReg.component({ t: (k) => k, close: () => { sectionCloses.push(1) }, ...sectionReg.spec.inject() })
const sectionTree = menuSection.jsxCalls.slice(sectionBefore)
check('设置分节渲染出轻量入口（标题 + 说明 + 状态行 + 「打开面板」按钮）',
  sectionTree.some((call) => call.props?.className === 'tg-section')
  && sectionTree.some((call) => call.props?.children === 'sectionHint')
  && sectionTree.some((call) => call.props?.className === 'tg-section-open'))
check('分节不渲染完整卡片网格（方案 A：弹窗里没有 tg-grid，换肤回主区全屏做）',
  !sectionTree.some((call) => call.props?.className === 'tg-grid'))
const sectionOpenButton = sectionTree.find((call) => call.props?.className === 'tg-section-open')
sectionOpenButton.props.onClick()
check('点「打开面板」：ctx.layout.selectPanel 被调、目标是本面板（官方跳转面）',
  menuSection.panelJumps[menuSection.panelJumps.length - 1] === 'theme-gallery',
  `实参序列：${JSON.stringify(menuSection.panelJumps)}`)
check('点「打开面板」：弹窗被关闭（close 是官方给分节的唯一句柄，明说用于离开设置）',
  sectionCloses.length === 1)

// 折叠开着时，分节给「恢复侧栏入口」—— 折叠后从设置找回面板的闭环（不会锁在外面）。
const menuSeededSection = runBoot({ activeId: 'light', wireSlots: true, seedMenu: '{"collapsed":true}' })
const seededSectionReg = menuSeededSection.slotRegistrations.find((r) => r.name === 'settings.section')
const seededSectionBefore = menuSeededSection.jsxCalls.length
seededSectionReg.component({ t: (k) => k, close: () => {}, ...seededSectionReg.spec.inject() })
const seededSectionTree = menuSeededSection.jsxCalls.slice(seededSectionBefore)
const restoreButton = seededSectionTree.find((call) => call.props?.className === 'tg-section-restore')
check('折叠开着时，分节渲染「恢复侧栏入口」按钮', restoreButton !== undefined)
restoreButton.props.onClick()
menuSeededSection.drive(30)
check('点「恢复侧栏入口」：折叠关回、侧栏重新注册（复用折叠卡同一条动作链）',
  (menuSeededSection.localStorage.getItem('theme-gallery:menu-collapse') ?? '').includes('"collapsed":false')
  && menuSeededSection.slotRegistrations.some((r) => r.name === 'sidebar.panellist' && r.unregistered === false)
  && menuSeededSection.menuMarks[menuSeededSection.menuMarks.length - 1] === false)

// ── 反证 21/22/23：轻量分节与挂件隐藏必须真的被测到（硬性规则 9）──────────────

// 反证 21（白屏根因的回归钉）：快照读法退回 getState（真实 StoreInstance 契约上没有）
// 且防御兜底一起消失 → 分节渲染当场抛错 —— 正是实机白屏的复现。
const mutGetState = source.replace(
  '() => (store?.getSnapshot ? store.getSnapshot() : SECTION_FALLBACK_SNAPSHOT)',
  'store.getState',
)
check('反证 21 真的改动了源码（快照读法退回 getState、兜底被拆）', mutGetState !== source)
const mutSnapBoot = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutGetState })
const mutSnapReg = mutSnapBoot.slotRegistrations.find((r) => r.name === 'settings.section')
let sectionThrew = false
try {
  mutSnapReg.component({ t: (k) => k, close: () => {}, ...mutSnapReg.spec.inject() })
} catch {
  sectionThrew = true
}
check('反证 21：快照读法退回 getState 后分节渲染抛错（= 实机白屏的复现，说明分节断言测的是真通道）',
  sectionThrew)

// 反证 22：拆掉 selectPanel 调用 → 「打开面板」只关弹窗、不跳转。
const mutNoJump = source.replace('ctx.layout.selectPanel(PANEL_ID)', 'void PANEL_ID')
check('反证 22 真的改动了源码（跳转调用被拆）', mutNoJump !== source)
const noJumpBoot = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutNoJump })
const noJumpReg = noJumpBoot.slotRegistrations.find((r) => r.name === 'settings.section')
const noJumpCloses = []
const noJumpBefore = noJumpBoot.jsxCalls.length
noJumpReg.component({ t: (k) => k, close: () => { noJumpCloses.push(1) }, ...noJumpReg.spec.inject() })
noJumpBoot.jsxCalls.slice(noJumpBefore)
  .find((call) => call.props?.className === 'tg-section-open')
  .props.onClick()
check('反证 22：跳转被拆后 selectPanel 不再被调（说明跳转断言测的是真通道）',
  noJumpBoot.panelJumps.length === 0 && noJumpCloses.length === 1)

// 反证 23：标记类不再维护 → 弹窗开着 body 上也没有 dsh-dialog-open。
const mutNoMark = source.replace("document.body?.classList?.toggle('dsh-dialog-open', open)", '')
check('反证 23 真的改动了源码（标记类不再维护）', mutNoMark !== source)
const noMarkBoot = runBoot({
  activeId: 'light', seedSkin: null, wireSlots: true, seedPet: PET_ON_SEED, bundleSource: mutNoMark,
})
noMarkBoot.document_.dialogNode = noMarkBoot.document_.createElement('div')
for (const obs of noMarkBoot.mutationObservers) obs.callback()
check('反证 23：标记类拆掉后弹窗开着也不打类（说明隐藏断言测的是真通道）',
  !String(noMarkBoot.document_.body.className).includes('dsh-dialog-open'))

// 反证 24：胶囊点击不再拦冒泡 → 卡身的 onClick 也会触发，一次点击翻转两次。
const mutNoMenuStop = source.replace(
  "if (event !== undefined && typeof event.stopPropagation === 'function') event.stopPropagation()\n"
  + '                          onToggleMenuCollapse()',
  'onToggleMenuCollapse()',
)
check('反证 24 真的改动了源码（胶囊不再拦冒泡）', mutNoMenuStop !== source)
const noMenuStopBoot = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutNoMenuStop })
const noMenuStopTree = noMenuStopBoot.cardTree('menu-collapse', {}, { 'menu-collapse': MENU_DESC })
const noMenuSwitch = noMenuStopTree.tree.find((call) => call.props?.className === 'tg-mood-switch')
let noMenuStopped = false
noMenuSwitch.props.onClick({ stopPropagation: () => { noMenuStopped = true } })
check('反证 24：不拦冒泡后 stopPropagation 不再被调用（说明胶囊拦截断言测的是真通道）',
  noMenuStopped === false)

// ── 反证 19/20：菜单折叠的收放与分节常驻必须真的被测到（硬性规则 9）────────────

// 反证 19：拆掉"撤销侧栏注册"那一步（只置 undefined、不调槽位 disposer）→ 折叠后侧栏仍在。
const mutNoTear = source.replace(
  'sidebarEntryDispose()\n          sidebarEntryDispose = undefined',
  'sidebarEntryDispose = undefined',
)
check('反证 19 真的改动了源码（撤销那一步被拆掉）', mutNoTear !== source)
const noTearBoot = runBoot({
  activeId: 'shan-qing-ting-cai', seedSkin: 'shan-qing-ting-cai', wireSlots: true, bundleSource: mutNoTear,
})
const noTearSidebar = noTearBoot.slotRegistrations.find((r) => r.name === 'sidebar.panellist')
noTearBoot.pageFace().toggleMenuCollapse()
noTearBoot.drive(30)
check('反证 19：撤销被拆后，折叠时侧栏注册仍然活着（说明"侧栏注册被撤销"那条测的是真通道）',
  noTearSidebar.unregistered === false)

// 反证 20：把分节注册的 name 改掉 → 桩里找不到 settings.section 记录。
const mutNoSection = source.replace("name: 'settings.section',", "name: 'settings.section-x',")
check('反证 20 真的改动了源码（分节注册的名字被改掉）', mutNoSection !== source)
const noSectionBoot = runBoot({ activeId: 'light', wireSlots: true, bundleSource: mutNoSection })
check('反证 20：名字改掉后，设置分节在桩里缺失（说明"分节已注册且常驻"那两条测的是真通道）',
  !noSectionBoot.slotRegistrations.some((r) => r.name === 'settings.section'))

if (failed > 0) {
  console.error(`\n${failed} boot path check(s) failed`)
  process.exit(1)
}
console.log('\nboot path checks passed')
