/**
 * Browser half of the theme gallery.
 *
 * ## What changed, and why it matters
 *
 * An earlier revision sourced the theme list from the `theme-gallery` settings
 * namespace and declared `settingsScope` as a **hard** dependency. That service
 * is provided by `@deepseek-ai/dsh-client-ui-settings`, which itself waits on
 * `remote.settings` — so under the desktop composition it never arrived, the
 * fiber stayed `pending` forever, and the boot-complete check refused to start
 * the app:
 *
 *   web boot: 1 entry did not activate
 *   dsh-theme-gallery: pending (waiting for service: settingsScope)
 *
 * Cordis' array-form `inject` makes every entry required, so a service you do
 * not control is a service that can brick the app. This revision needs no
 * settings domain at all:
 *
 *   - the theme list is `ctx.theme.getTheme().themes` — the official registry;
 *   - selecting is `ctx.theme.setTheme(id)`, and ui-theme persists that
 *     preference itself, in the `ui-theme` namespace it owns;
 *   - the picker lives in the left sidebar, not in Settings.
 *
 * The only hard requirements are `slots` and `locale`, both shipped by
 * statically-composed UI packages (`dsh-client-ui-layout` consumes them, so they
 * exist in every web composition).
 *
 * ## Where the picker lives
 *
 * `sidebar.panellist` (a list slot: one icon per panel) plus `main` (a **keyed**
 * slot addressed by the same id). That pairing is this app's plugin mechanism —
 * one plugin is one sidebar entrance plus one main-column page — so it has room
 * for previews, descriptions and whatever this gallery grows into.
 *
 * ## 出处与致谢（这是别人的劳动成果，必须写清楚）
 *
 * - **纯色/拼色卡片上的 15 个色值，全部取自「中国传统色库」项目**
 *   （chinese-colors）：<https://github.com/zerosoul/chinese-colors>
 *   作者 **tristan**（GitHub [@zerosoul](https://github.com/zerosoul)），
 *   在线手册 <https://colors.ichuantong.cn>，许可 ISC。
 *   该项目的 `src/assets/colors.json` 整理了 170 个中国传统色的名字与色值，
 *   本插件只做**取色与派生**（每套方案只挑三四个名字色，其余 token 由
 *   `schemeTokens()` 按同一条造色规则算出来）。色值与命名是作者整理的成果，
 *   **感谢作者 tristan 的整理与开源**。取色数据见 `lib/palette-schemes.json`，
 *   每套方案都带 `source` 字段记着它在色库里的「组 + id」。
 * - 七套**复刻**皮肤的场景与配色复刻自**蜂链商城**电商新零售系统管理后台的主题，
 *   项目地址：<https://github.com/renjie2026/fenglianshop-open>（该项目的开发者即本插件作者）。
 * - 两套宠物主题（琥珀猫咪、虎子阿黄）为本插件原创。
 *
 * ## Two conversational states
 *
 * A skin covers the screen; a screen covered by a gradient is what makes a long
 * conversation tiring to read. So once the transcript has messages, the centre
 * column gets a lightened card. Detection is DOM-derived because DSH exposes no
 * public "does this session have messages" API; if it stops matching, the plugin
 * degrades to the idle look and never breaks the UI.
 *
 * ## Why the skin itself needs no injected stylesheet
 *
 * The official frame already paints the sidebar column AND the Windows caption
 * row with `var(--dsw-specific-sidebar-fill)`, and the centre with
 * `var(--dsw-alias-bg-base)`. Themes set that token to a gradient, so the screen
 * is covered by tokens alone. Only the reading card needs one injected rule,
 * scoped to the official `[data-windows-titlebar] .centerCol` anchor.
 *
 * This file is a lazy-CJS factory, the bundle format the client module system
 * loads (`window.__ModuleLoader__.load({ id, factory })`); the module body lives
 * inside the factory closure so it runs at materialization, not at script load.
 * The registration contract was type-checked against the real official packages
 * — see ../types/client-panel.ts.
 */
window.__ModuleLoader__.load({
  id: 'dsh-theme-gallery',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // Value requires only. Like the official ui-theme bundle, these are NOT
    // listed in `dsh.client.inject`: they resolve from the client's platform
    // module seed (`dsh-client-store`) or the shell (`react/jsx-runtime`).
    const { defineStore } = require('@deepseek-ai/dsh-client-store')
    const { jsx, jsxs } = require('react/jsx-runtime')

    /** Panel id shared by the sidebar icon and the main-column page. */
    const PANEL_ID = 'theme-gallery'

    /** Locale namespace this plugin owns its copy in. */
    const NS = 'theme-gallery'

    /**
     * Display names for the themes the theme plugin ships with itself.
     *
     * They carry no `label` — the official Appearance row localizes them from its
     * own dictionaries — so the gallery names them here instead of showing a bare
     * `light` / `dark` id on a card.
     */
    const BUILT_IN_LABELS = { light: '浅色', dark: '深色', system: '跟随系统' }

    /**
     * One-line copy for the built-in cards.
     *
     * The official themes declare no `description` of their own, so without this their
     * cards would be a bare label. These two cards switch the PALETTE back to the system
     * appearance — and they deliberately keep the previous skin's sidebar scenery on
     * screen, which is the behaviour the second sentence advertises (see `syncAmbient`).
     */
    const BUILT_IN_DESCRIPTIONS = {
      light: '系统默认浅色外观：与「设置 → 通用 → 外观」里的浅色是同一套配色。'
        + '先选中主题皮肤，再切换浅色/深色 会有惊喜哦',
      dark: '系统默认深色外观：与「设置 → 通用 → 外观」里的深色是同一套配色。'
        + '先选中主题皮肤，再切换浅色/深色 会有惊喜哦',
      system: '跟随系统外观设置（按桌面端的浅色/深色自动决定，因此不作为卡片展示）',
    }

    /**
     * Built-in ids the gallery does not show as a card.
     *
     * `system` is a preference value rather than a look of its own — it resolves to
     * `light` or `dark` depending on the desktop — so a card for it would duplicate one
     * of the two cards above and change meaning with the OS setting. `light` and `dark`
     * are BOTH shown now: together they are the way back out of every skin.
     */
    const OMITTED_IDS = new Set(['system'])

    /**
     * Display order of the gallery's cards — larger first.
     *
     * These are the user's own ranking numbers, kept as one table so the order is data
     * rather than an implicit consequence of some other list. The REGISTRY order (and
     * with it the contribution order in `BUNDLED_THEMES`) is deliberately untouched:
     * this table is applied to the copy the page renders, and to nothing else.
     *
     * A theme with no entry sorts after every ranked one and keeps its registry order
     * among the unranked (the sort is stable), so a theme contributed by another plugin
     * still appears on the page instead of silently vanishing.
     */
    const CARD_ORDER = {
      light: 99,
      dark: 98,
      'shi-liu-jin': 97,
      'ying-mu-cai-yun': 96,
      'shan-qing-ting-cai': 95,
      'pei-an-jie-xin': 91,
      'meng-hai-you-yu': 80,
      'hu-po-mao-mi': 76,
      'hu-zi-a-huang': 75,
      'pet-family': 74,
      'mood-greeting': 73,
    }

    /**
     * The skin this plugin puts in effect when the user has never chosen anything.
     *
     * Requested behaviour: installing/enabling the plugin lands on 山青婷彩 instead of the
     * built-in white theme. Applied by the ordinary restore path, so it obeys the same
     * global write budget and paint confirmation as a remembered skin — and it stops the
     * moment the user makes any choice of their own, because that choice is recorded.
     */
    const DEFAULT_SKIN = 'shan-qing-ting-cai'

    /**
     * The two keys this plugin owns in `localStorage`.
     *
     * Never `ui-theme.preference`: that field is read while the boot graph is still
     * assembling, and a skin id in it makes `buildSnapshot()` throw `theme registry lost`
     * and refuse to start. `localStorage` is private to this plugin, so a disabled or
     * uninstalled plugin simply stops being consulted — that is the fallback.
     *
     * They live at module scope because the card-click handler runs in the page component,
     * far from `mountGallery`, and it must be able to write them BEFORE the click reaches
     * the theme service (which publishes synchronously).
     */
    const SKIN_KEY = 'theme-gallery:last-skin'
    const BUILT_IN_KEY = 'theme-gallery:built-in-choice'

    /**
     * A theme's card rank; unranked themes sort last.
     * @param id - the theme id.
     * @returns its rank, or -1 when the table has no entry for it.
     */
    function cardRank(id) {
      const rank = CARD_ORDER[id]
      return typeof rank === 'number' ? rank : -1
    }

    /**
     * Order a card list for display: highest rank first.
     *
     * Applied to the copy the page renders, never to the array the service is given, so a
     * theme's registration and its card position are independent concerns (and a reorder
     * can never change which themes exist or what they contain).
     * @param themes - theme definitions, in registry order.
     * @returns a new array in display order.
     */
    function cardsInDisplayOrder(themes) {
      return [...themes].sort((a, b) => cardRank(b.id) - cardRank(a.id))
    }

    /** 配色方案 id 的形态：`p-` 前缀，避免与主题 id 混淆（锚主题就叫 `shi-liu-jin`）。 */
    const SCHEME_ID = /^p-[a-z0-9-]+$/

    /**
     * 15 套「纯色/拼色」配色方案的落点。
     *
     * 声明在这里、赋值在文件下方（紧接内联的 `BUNDLED_PALETTES`）—— 工厂体自上而下执行，
     * 而 `const BUNDLED_PALETTES` 内联在主题数组之后，所以这里只能先给一个空表。
     * 表为空时**不会**静默画错：`cardRowShape` 找不到方案就退回默认色带，
     * 而建期（`embed-themes.mjs`）与测试都要求每个方案 id 真实存在。
     */
    let PALETTE_SCHEMES = []

    /** 配色卡自己的主题 id（"锚"）：只有它是活动主题时，所选方案才有效。 */
    const PALETTE_ANCHOR = 'shi-liu-jin'

    /** 所选配色方案记在这里。与皮肤 id 一样，**绝不**写进 `ui-theme.preference`。 */
    const SCHEME_KEY = 'theme-gallery:palette'

    /* ═══════════════════ 宠物挂件卡（宠物家族 × 7）═══════════════════
     *
     * 这张卡**不是主题**：它不进 `lib/themes/`、不被 `contribute()` 注册进主题服务、
     * 官方「设置 → 通用 → 外观」不会多出这一项，点它也**不切主题** —— 只开关/挑选挂件。
     * 因此它天然能与任何皮肤（包括山青婷彩 / 梦海游鱼）同时开启，也不消耗主题写入预算。
     * 卡片数据只在面板里合成（见 `petWidgetCardTheme`），挂件本体画在
     * `#dsh-theme-pet` 固定层，锚定对话输入框 —— 不配 `ambient`，不碰侧栏素材区。
     * 二期：卡内是 7 只宠物的头像选择行（`petPickerElement`），点头像换宠物并放它出场。
     */

    /**
     * 挂件卡的 id、标题与 tooltip 文案。
     *
     * 卡片正面**不渲染** description（与「纯色/拼色」卡同一条分支，见 `ThemeCard`）：
     * 卡面是标题、状态徽标、当前宠物与它的道具图案，再加一行头像选择，这段文案只作
     * 悬停提示（title）。schema 对主题 JSON 的 description 非空约束管不到它 —— 它
     * 本来就不是主题 JSON。
     */
    const PET_WIDGET = {
      id: 'pet-family',
      label: '宠物挂件 · 七只小伙伴',
      description: '七只小宠物轮流陪聊：点头像换一只并放它出场，点卡身空白处仅开关。'
        + '挂件不改变当前主题皮肤；移到宠物身上可改名、戳一戳；拖动宠物或它的道具，'
        + '它会跑向道具。它还会在你想事情时说悄悄话、在模型生成时为你加油。',
    }

    /** 挂件的启停 / 名字 / 位置记在这里。与皮肤 id 同一条铁律：绝不写 `ui-theme.preference`。 */
    const PET_KEY = 'theme-gallery:pet'

    /**
     * 宠物的显示缩放。注册表 `size` 是逻辑坐标（与 viewBox 1:1，全部几何以它推），
     * 实机验收反馈整体偏小 —— 屏幕显示统一放大 15%，宠物与道具同缩放。
     * 放大只发生在**消费端**（petDisplaySize / petPropDisplaySize 两个助手）：
     * 注册表数据与 viewBox 一个数字都不动（check-pet-registry 的 P3 钉的就是 1:1）。
     * 声明在这里（而非宠物运行区）是因为面板卡 petCardSceneHTML 也要读它 ——
     * TDZ 审计要求 const 声明在第一个读取者之前。
     */
    const PET_SCALE = 1.15

    /**
     * 按 id 取一套配色方案。
     * @param id - 方案 id。
     * @param schemes - 方案表（显式传入，便于测试与预览各自喂数据）。
     * @returns 方案，或 undefined。
     */
    function schemeById(id, schemes) {
      const list = Array.isArray(schemes) ? schemes : []
      return list.find((scheme) => scheme !== null && typeof scheme === 'object' && scheme.id === id)
    }

    /**
     * 两个 6 位 hex 之间线性插值。
     * @param a - 起点 `#rrggbb`。
     * @param b - 终点 `#rrggbb`。
     * @param t - 0 = a，1 = b。
     * @returns `#rrggbb`。
     */
    function blendHex(a, b, t) {
      const parts = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
      const [r1, g1, b1] = parts(a)
      const [r2, g2, b2] = parts(b)
      const mix = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
      return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`
    }

    /**
     * 把颜色往白（t > 0）或往黑（t < 0）推。
     *
     * 15 套配色里除了主色与底色，其余 60 多个 token 全靠它派生 —— 这样 15 套不会各写各的，
     * 也就不会彼此漂移。压深出来的色值不是色库里的名字色，这是**派生的深浅阶**，
     * 与既有皮肤的做法一致（例如琥珀猫咪用「琥珀深焙」做按钮族、`琥珀` 做强调色）。
     * @param hex - `#rrggbb`。
     * @param t - 正数提亮、负数压深，绝对值是幅度。
     * @returns `#rrggbb`。
     */
    function shade(hex, t) {
      if (!/^#[0-9a-fA-F]{6}$/.test(String(hex))) return hex
      return t >= 0 ? blendHex(hex, '#FFFFFF', t) : blendHex(hex, '#000000', -t)
    }

    /**
     * 卡片上那 15 个色值按钮的数据。
     *
     * ── 这一版换了语义 ─────────────────────────────────────────────────────────
     *
     * 早先 `card.rows` 直接写十六进制色块（纯展示）。现在每一格是**一个可点的配色方案 id**：
     * 颜色从方案表来，所以卡片显示什么、点下去换什么，是同一条数据，不可能对不上。
     *
     * 仍然按老规矩消毒：`embed-themes.mjs` 校验的是本包出货的皮肤，而注册表里还有别的插件
     * 贡献的主题；坏数据在这里退回默认色带，而不是把 `undefined` 画进背景。
     * @param theme - 注册表里的主题定义。
     * @param schemes - 配色方案表。
     * @returns 两到三排 `{ kind, schemes }`，或 undefined（回落默认色带）。
     */
    function cardRowShape(theme, schemes) {
      const card = theme.card
      const rows = card === undefined || card === null ? undefined : card.rows
      if (!Array.isArray(rows) || rows.length < 2 || rows.length > 3) return undefined
      const clean = []
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index]
        if (row === null || typeof row !== 'object') return undefined
        // 最后一排是「拼色」，前面都是「纯色」：这是用户定的版式，也让"哪一排是拼色"
        // 不再靠眼睛判断。写歪就整张卡退回默认色带（可见地与预期不同，而不是微妙地错）。
        const isLast = index === rows.length - 1
        const wanted = isLast ? 'clash' : 'solid'
        if (row.kind !== wanted) return undefined
        if (!Array.isArray(row.schemes) || row.schemes.length < 1 || row.schemes.length > 5) return undefined
        for (const id of row.schemes) {
          if (typeof id !== 'string' || !SCHEME_ID.test(id)) return undefined
          const scheme = schemeById(id, schemes)
          // 方案存在、且它自己的 kind 与本排一致 —— 否则会把拼色画成一块纯色。
          if (scheme === undefined || scheme.kind !== wanted) return undefined
        }
        clean.push({ kind: wanted, schemes: [...row.schemes] })
      }
      return clean
    }

    /**
     * WCAG 对比度（1..21）。与 `scripts/lib/card-rows.mjs` 里那份是同一条公式的两个落点：
     * 那份在**建期**拦配色表，这份在**运行期**决定按钮文字取白还是取深。
     * @param a - `#rrggbb`。
     * @param b - `#rrggbb`。
     * @returns 对比度；任一输入非法时返回 0。
     */
    function wcagContrast(a, b) {
      const lum = (hex) => {
        if (!/^#[0-9a-fA-F]{6}$/.test(String(hex))) return null
        const linear = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
          .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
      }
      const la = lum(a)
      const lb = lum(b)
      if (la === null || lb === null) return 0
      // 先算再返回，**不要**写成 `return (…)`：`check-scope-reach.mjs` 的调用识别会把
      // `return (` 读成"调用了名为 return 的函数"，于是报一条假违规（规则 6 的另一面：
      // 审计误报同样要消除，否则它就不再可信）。
      const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
      return ratio
    }

    /**
     * 这个方案的按钮/链接填充色。
     *
     * 缃色、橘黄、桃红这类**亮色**做填充时，白字压上去只有 1.7–3.7:1（读不清）。
     * 所以填充色按对比度**逐个候选**试出来，而不是写死一个压深量：
     *
     *   1. 本色 + 本方案的深色文字（最好：按钮留在色库那个名字色上）—— 缃色/橘黄/桃红都是这一条；
     *   2. 本色 + 白字；
     *   3. 依次压深 0.35 / 0.5 / 0.65 再用白字（海棠红、松柏绿、竹青、苍青走这条）。
     *
     * 方案可以用 `fill` 显式指定（石榴金就是：用户定的按钮色是色库里的「胭脂」`#9D2933`，
     * 而不是把石榴红压深出来的合成色）。
     * @param scheme - 一套配色方案。
     * @returns `#rrggbb`。
     */
    function schemeButtonFill(scheme) {
      const choice = schemeButtonChoice(scheme)
      return choice[0]
    }

    /**
     * 按钮填充色上的文字色（白或方案自己的深色），取对比度更高的那个。
     * @param scheme - 一套配色方案。
     * @returns `#rrggbb`。
     */
    function schemeOnMain(scheme) {
      return schemeButtonChoice(scheme)[1]
    }

    /**
     * 选出「填充色 + 文字色」这一对（规则见 {@link schemeButtonFill}）。
     * @param scheme - 一套配色方案。
     * @returns `[fill, onFill]`。
     */
    function schemeButtonChoice(scheme) {
      const main = String(scheme.main)
      const ink = String(scheme.ink)
      if (typeof scheme.fill === 'string' && /^#[0-9a-fA-F]{6}$/.test(scheme.fill)) {
        const onFill = wcagContrast(scheme.fill, '#FFFFFF') >= wcagContrast(scheme.fill, ink)
          ? '#FFFFFF' : ink
        return [scheme.fill, onFill]
      }
      const candidates = [
        [main, ink],
        [main, '#FFFFFF'],
        [shade(main, -0.35), '#FFFFFF'],
        [shade(main, -0.5), '#FFFFFF'],
        [shade(main, -0.65), '#FFFFFF'],
      ]
      for (const candidate of candidates) {
        if (wcagContrast(candidate[0], candidate[1]) >= 4.5) return candidate
      }
      return candidates.reduce((best, candidate) => (
        wcagContrast(candidate[0], candidate[1]) > wcagContrast(best[0], best[1]) ? candidate : best
      ))
    }

    /**
     * 把一套配色方案展开成完整的 67 个 token（`overrideTokens` 层的成对格式）。
     *
     * 只有 `main` / `ground` / `ink` / `dots` 是色库里的名字色，其余全部由
     * {@link shade} 派生：底色深浅阶、主色透明度边线、侧栏渐变。侧栏**刻意停在浅阶**
     * （最深处只到主色的 0.42 白化），因为 `label-*` 是全界面共享的 —— 深底会让导航文字读不清，
     * 这条教训写在 SKILL §14（深色系源侧栏一律"保色相提明度"）。
     *
     * `state-{error,success,warn}` 三族**不随配色变**：它们是语义色，跟着调色板走的后果是
     * 报错不再像报错。`state-business-primary` 除外 —— 它画"当前文件夹"的图标，属于品牌语汇：
     * 纯色方案用主色，拼色方案用第三个点缀色（那正是"撞"出来的那个）。
     * @param scheme - 一套配色方案。
     * @returns `{ token: { light, dark } }`。
     */
    function schemeTokens(scheme) {
      const main = String(scheme.main)
      const ground = String(scheme.ground)
      const ink = String(scheme.ink)
      const fill = schemeButtonFill(scheme)
      const onFill = schemeOnMain(scheme)
      const business = scheme.kind === 'clash' && Array.isArray(scheme.dots) && scheme.dots.length > 2
        ? String(scheme.dots[2])
        : main
      const pair = (value) => ({ light: value, dark: value })
      const stops = [0, 20, 36, 50, 62, 74, 86, 100]
      const sidebar = [0.94, 0.86, 0.78, 0.70, 0.62, 0.54, 0.48, 0.42]
        .map((t, index) => `${shade(main, t)} ${stops[index]}%`).join(',')
      return {
        '--dsw-alias-bg-base': pair(`linear-gradient(to bottom,${shade(ground, 0.5)} 0%,${ground} 55%,${shade(ground, -0.06)} 100%)`),
        '--dsw-alias-bg-layer-1': pair(shade(ground, 0.72)),
        '--dsw-alias-bg-layer-2': pair('#FFFFFF'),
        '--dsw-alias-bg-layer-3': pair('#FFFFFF'),
        '--dsw-alias-bg-overlay': pair(shade(ground, -0.1)),
        '--dsw-alias-bg-skeleton': pair(`${main}14`),
        '--dsw-alias-bg-module-platform': pair(shade(ground, -0.1)),
        '--dsw-alias-bg-multi-select': pair(shade(ground, -0.1)),
        '--dsw-alias-border-l1': pair(`${main}0F`),
        '--dsw-alias-border-l2': pair(`${main}21`),
        '--dsw-alias-border-l3': pair(`${main}2E`),
        '--dsw-alias-border-l4': pair(`${main}3D`),
        '--dsw-alias-brand-primary': pair(fill),
        '--dsw-alias-brand-primary-invert': pair('#FFFFFF'),
        '--dsw-alias-brand-text': pair(fill),
        '--dsw-alias-label-primary': pair(ink),
        '--dsw-alias-label-primary-bluish': pair(ink),
        '--dsw-alias-label-secondary': pair(shade(ink, 0.22)),
        '--dsw-alias-label-tertiary': pair(shade(ink, 0.42)),
        '--dsw-alias-label-caption': pair(shade(ink, 0.42)),
        '--dsw-alias-label-dimmed': pair(shade(ink, 0.62)),
        '--dsw-alias-label-primary-dimmed': pair(shade(ink, 0.22)),
        '--dsw-alias-label-primary-foreground': pair(onFill),
        '--dsw-alias-label-primary-inverted': pair('#FFFFFF'),
        '--dsw-alias-link': pair(fill),
        '--dsw-alias-interactive-bg-hover': pair(`${main}14`),
        '--dsw-alias-interactive-bg-active': pair(`${main}2E`),
        '--dsw-alias-interactive-bg-hover-solid': pair(shade(ground, -0.08)),
        '--dsw-alias-interactive-bg-hover-accent': pair(`${main}3D`),
        '--dsw-alias-button-primary-fill': pair(fill),
        '--dsw-alias-button-primary-hover': pair(shade(fill, 0.12)),
        '--dsw-alias-button-primary-dimmed': pair(`${fill}47`),
        '--dsw-alias-button-ghost-active-fill': pair(`${main}29`),
        '--dsw-alias-button-ghost-active-border': pair(main),
        '--dsw-alias-button-ghost-active-hover': pair(`${main}47`),
        '--dsw-alias-button-info-fill': pair(shade(ink, 0.22)),
        '--dsw-alias-button-info-hover': pair(shade(ink, 0.1)),
        '--dsw-alias-button-elevated-fill': pair('#FFFFFF'),
        '--dsw-alias-button-floating-fill': pair('#FFFFFF'),
        '--dsw-alias-button-floating-hover': pair(shade(ground, 0.8)),
        '--dsw-alias-button-contrast-fill': pair(ink),
        '--dsw-alias-markdown-code-block': pair(shade(ground, 0.6)),
        '--dsw-alias-markdown-code-block-banner': pair(shade(ground, 0.45)),
        '--dsw-alias-markdown-inline-code': pair(shade(ground, -0.08)),
        '--dsw-alias-markdown-citation': pair(shade(ground, -0.08)),
        '--dsw-alias-markdown-tag': pair(shade(ground, -0.08)),
        '--dsw-alias-markdown-placeholder': pair(shade(ground, 0.4)),
        '--dsw-alias-markdown-code-segment-selected': pair(`${main}29`),
        '--dsw-alias-markdown-code-segment-unselected': pair(shade(ground, 0.6)),
        '--dsw-alias-scrollbar-bg-l1': pair(`${main}29`),
        '--dsw-alias-scrollbar-bg-l2': pair(`${main}38`),
        '--dsw-alias-scrollbar-hover-l1': pair(`${main}52`),
        '--dsw-alias-scrollbar-hover-l2': pair(`${main}66`),
        '--dsw-alias-tooltip-bg': pair(ink),
        '--dsw-alias-toast-bg': pair('#FFFFFF'),
        '--dsw-alias-state-error-primary': pair('#C2352B'),
        '--dsw-alias-state-error-secondary': pair('#DB5A6B'),
        '--dsw-alias-state-success-primary': pair('#1DA981'),
        '--dsw-alias-state-success-secondary': pair('#7FE3C0'),
        '--dsw-alias-state-success-tertiary': pair('#D8F5E8'),
        '--dsw-alias-state-warn-primary': pair('#C89B40'),
        '--dsw-alias-state-warn-secondary': pair('#EACD76'),
        '--dsw-alias-state-warn-tertiary': pair('#F7EBC8'),
        '--dsw-alias-state-warn-label': pair('#7A5A0E'),
        '--dsw-alias-state-business-primary': pair(business),
        '--dsw-alias-state-business-tertiary': pair(shade(business, 0.55)),
        '--dsw-specific-sidebar-fill': pair(`linear-gradient(to bottom,${sidebar})`),
      }
    }

    /**
     * Record the user's card choice BEFORE it reaches the theme service.
     *
     * ── WHY THE ORDER IS LOAD-BEARING ───────────────────────────────────────────
     *
     * `ctx.theme.setTheme()` publishes synchronously, and the publisher re-applies the
     * remembered skin whenever the active theme is not one of ours. So a built-in card
     * clicked after any skin had been chosen used to be undone a microtask later: the click
     * landed, the restore read `SKIN_KEY`, and the skin came straight back. On screen the
     * 深色 card simply did nothing.
     *
     * Removing `SKIN_KEY` here, before the write, is what makes a built-in choice stick.
     * `BUILT_IN_KEY` is written so the default skin does NOT fire on the next restart and
     * undo the choice — see `wantedSkin`.
     *
     * Any theme this package does not provide counts as "not a skin": another plugin's
     * theme must win as well, for exactly the same reason.
     * @param id - the card's theme id.
     */
    function rememberCardChoice(id) {
      try {
        if (typeof window === 'undefined') return
        const storage = window.localStorage
        if (storage === undefined || storage === null) return
        if (bundledTheme(id) === undefined) {
          storage.removeItem(SKIN_KEY)
          storage.setItem(BUILT_IN_KEY, String(id))
          return
        }
        // A skin: it is recorded by the restore once it is genuinely active, so the stale
        // built-in marker is cleared here rather than there.
        storage.removeItem(BUILT_IN_KEY)
      } catch (error) {
        console.error('[theme-gallery] could not record the card choice:', error)
      }
    }

    /**
     * The built-in appearance the user picked in this panel, if any.
     * @returns the id, or null when the user never picked one here.
     */
    function builtInChoice() {
      try {
        if (typeof window === 'undefined') return null
        const value = window.localStorage?.getItem(BUILT_IN_KEY)
        return typeof value === 'string' && value !== '' ? value : null
      } catch {
        return null
      }
    }

    /**
     * Record the palette scheme the user clicked on the picker card.
     *
     * Same storage rule as the skin id: **`localStorage` only**, never
     * `ui-theme.preference` (a value the boot graph reads would have to be a built-in
     * id, and an unknown one makes `buildSnapshot()` throw and refuse to start).
     * @param id - the scheme id (`p-…`).
     */
    function rememberScheme(id) {
      try {
        if (typeof window === 'undefined') return
        window.localStorage?.setItem(SCHEME_KEY, String(id))
      } catch (error) {
        console.error('[theme-gallery] could not record the palette scheme:', error)
      }
    }

    /**
     * The palette scheme the user picked, if any.
     * @returns the id, or null when the user never picked one.
     */
    function rememberedScheme() {
      try {
        if (typeof window === 'undefined') return null
        const value = window.localStorage?.getItem(SCHEME_KEY)
        if (typeof value !== 'string' || value === '') return null
        // 只认表里真实存在的 id：换过色表、手改过 localStorage 时，宁可当作没选，
        // 也不要叠一层空方案（那会把整屏的颜色悄悄换掉）。
        return schemeById(value, PALETTE_SCHEMES) === undefined ? null : value
      } catch {
        return null
      }
    }

    /** 卡片上默认点亮的那一格：锚主题自己的那套配色（没选过任何方案时）。 */
    const DEFAULT_SCHEME = 'p-shi-liu-jin'

    /**
     * 卡片上应当点亮哪一格。
     *
     * 没选过时给默认值**只是为了显示**：那时并不叠配色层，屏幕上是锚主题自己
     * 手工写的那套 token（与这一格同一组关键色，观感几乎一致）。
     * @returns 方案 id。
     */
    function wantedScheme() {
      return rememberedScheme() ?? DEFAULT_SCHEME
    }

    /** Body attribute publishing the reading state; the injected rule reads it. */
    const READING_ATTRIBUTE = 'data-dsh-theme-reading'

    /**
     * Reading-state defaults, tuned in `tools/theme-bench`.
     *
     * One shared setting rather than one per theme: the gallery does not own the
     * theme definitions (the official registry does), so per-theme reading values
     * would need a side table keyed by theme id. These values were chosen against
     * both bundled skins and are the ones the bench exports as its defaults.
     */
    const READING = { bg: '#FFFFFF', alpha: 0.62, blur: 3, maxWidth: 640 }

    /**
     * The package version this bundle was built from.
     *
     * Written by `scripts/embed-themes.mjs` from package.json, because the browser
     * half cannot read its own manifest: the client module system resolves `require`
     * against the platform seed table and other plugins' boot-graph rows, not
     * against this package's files. The panel shows it so a reader can compare what
     * they have with what npm publishes.
     *
     * Kept honest by two checks: `scripts/publish-check.mjs` compares it with
     * package.json, and the release workflow fails when re-running the embed step
     * changes a tracked file.
     */
    const BUNDLED_VERSION = '0.5.0'

    /**
     * Themes this package contributes, inlined from lib/themes/*.json.
     *
     * Someone has to put them into the registry, and on this side that is this
     * plugin: the browser half is where `ctx.theme` lives. The picker then lists
     * whatever the registry holds, so themes contributed by other plugins appear
     * beside these without either plugin knowing about the other.
     *
     * Regenerate after editing those files: `node scripts/embed-themes.mjs`.
     */
    const BUNDLED_THEMES = [
      {
        "id": "hu-po-mao-mi",
        "label": "琥珀猫咪",
        "description": "琥珀暖光，双猫伴读 —— 原创宠物主题：两只虎斑短毛猫守着洒满阳光的窗台",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#FEFBF5 0%,#FBF2E3 55%,#F8EDD8 100%)",
            "dark": "linear-gradient(to bottom,#FEFBF5 0%,#FBF2E3 55%,#F8EDD8 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FEFCF7",
            "dark": "#FEFCF7"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#F3E5CD",
            "dark": "#F3E5CD"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#9C5F2414",
            "dark": "#9C5F2414"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#F3E5CD",
            "dark": "#F3E5CD"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#F3E5CD",
            "dark": "#F3E5CD"
          },
          "--dsw-alias-border-l1": {
            "light": "#9C5F240F",
            "dark": "#9C5F240F"
          },
          "--dsw-alias-border-l2": {
            "light": "#9C5F2421",
            "dark": "#9C5F2421"
          },
          "--dsw-alias-border-l3": {
            "light": "#9C5F242E",
            "dark": "#9C5F242E"
          },
          "--dsw-alias-border-l4": {
            "light": "#9C5F243D",
            "dark": "#9C5F243D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#9C5F24",
            "dark": "#9C5F24"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#9C5F24",
            "dark": "#9C5F24"
          },
          "--dsw-alias-label-primary": {
            "light": "#453019",
            "dark": "#453019"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#453019",
            "dark": "#453019"
          },
          "--dsw-alias-label-secondary": {
            "light": "#6A4E2F",
            "dark": "#6A4E2F"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#8C6F4C",
            "dark": "#8C6F4C"
          },
          "--dsw-alias-label-caption": {
            "light": "#8C6F4C",
            "dark": "#8C6F4C"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#B49C7F",
            "dark": "#B49C7F"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#6A4E2F",
            "dark": "#6A4E2F"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#CA6924",
            "dark": "#CA6924"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#9C5F2414",
            "dark": "#9C5F2414"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#CA69242E",
            "dark": "#CA69242E"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#F3E5CD",
            "dark": "#F3E5CD"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#CA69243D",
            "dark": "#CA69243D"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#9C5F24",
            "dark": "#9C5F24"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#B0702F",
            "dark": "#B0702F"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#9C5F2447",
            "dark": "#9C5F2447"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#CA692429",
            "dark": "#CA692429"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#CA6924",
            "dark": "#CA6924"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#CA692447",
            "dark": "#CA692447"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#B0702F",
            "dark": "#B0702F"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#9C5F24",
            "dark": "#9C5F24"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#FDF8F0",
            "dark": "#FDF8F0"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#453019",
            "dark": "#453019"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#F7EEDF",
            "dark": "#F7EEDF"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#F0E3CB",
            "dark": "#F0E3CB"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#F3E9D6",
            "dark": "#F3E9D6"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#F3E9D6",
            "dark": "#F3E9D6"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#F3E9D6",
            "dark": "#F3E9D6"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#F0E3CB",
            "dark": "#F0E3CB"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#CA692429",
            "dark": "#CA692429"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#F7EEDF",
            "dark": "#F7EEDF"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#9C5F2429",
            "dark": "#9C5F2429"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#9C5F2438",
            "dark": "#9C5F2438"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#9C5F2452",
            "dark": "#9C5F2452"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#9C5F2466",
            "dark": "#9C5F2466"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#453019",
            "dark": "#453019"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C65B6A",
            "dark": "#C65B6A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#9C5F24",
            "dark": "#9C5F24"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#CFBA9C",
            "dark": "#CFBA9C"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#B97F3A",
            "dark": "#B97F3A"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#D9A45E",
            "dark": "#D9A45E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#EFDCC0",
            "dark": "#EFDCC0"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A5A22",
            "dark": "#8A5A22"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#CA6924",
            "dark": "#CA6924"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#E29C45",
            "dark": "#E29C45"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#FBF0DE 0%,#F5E3C6 20%,#EDD5AE 36%,#E3C593 50%,#D8B57D 62%,#CBA468 74%,#C69E5F 86%,#BB904F 100%)",
            "dark": "linear-gradient(to bottom,#FBF0DE 0%,#F5E3C6 20%,#EDD5AE 36%,#E3C593 50%,#D8B57D 62%,#CBA468 74%,#C69E5F 86%,#BB904F 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#CA6924",
        "ambient": {
          "kind": "humao",
          "dust": 6
        }
      },
      {
        "id": "hu-zi-a-huang",
        "label": "虎子阿黄",
        "description": "麦香田园，黄犬相迎 —— 原创宠物主题：中黄田园犬「虎子阿黄」摇着尾巴守在田埂上",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#FEFDF6 0%,#FBF5E0 55%,#F7EFD0 100%)",
            "dark": "linear-gradient(to bottom,#FEFDF6 0%,#FBF5E0 55%,#F7EFD0 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FEFCF4",
            "dark": "#FEFCF4"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#F4EAD0",
            "dark": "#F4EAD0"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#896C3914",
            "dark": "#896C3914"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#F4EAD0",
            "dark": "#F4EAD0"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#F4EAD0",
            "dark": "#F4EAD0"
          },
          "--dsw-alias-border-l1": {
            "light": "#896C390F",
            "dark": "#896C390F"
          },
          "--dsw-alias-border-l2": {
            "light": "#896C3921",
            "dark": "#896C3921"
          },
          "--dsw-alias-border-l3": {
            "light": "#896C392E",
            "dark": "#896C392E"
          },
          "--dsw-alias-border-l4": {
            "light": "#896C393D",
            "dark": "#896C393D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#896C39",
            "dark": "#896C39"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#896C39",
            "dark": "#896C39"
          },
          "--dsw-alias-label-primary": {
            "light": "#3B3018",
            "dark": "#3B3018"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#3B3018",
            "dark": "#3B3018"
          },
          "--dsw-alias-label-secondary": {
            "light": "#5D4E2B",
            "dark": "#5D4E2B"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#857451",
            "dark": "#857451"
          },
          "--dsw-alias-label-caption": {
            "light": "#857451",
            "dark": "#857451"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#B2A47E",
            "dark": "#B2A47E"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#5D4E2B",
            "dark": "#5D4E2B"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#AE7000",
            "dark": "#AE7000"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#896C3914",
            "dark": "#896C3914"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#F0C2392E",
            "dark": "#F0C2392E"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#F4EAD0",
            "dark": "#F4EAD0"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#F0C2393D",
            "dark": "#F0C2393D"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#896C39",
            "dark": "#896C39"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#A88462",
            "dark": "#A88462"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#896C3947",
            "dark": "#896C3947"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#F0C23929",
            "dark": "#F0C23929"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#F0C239",
            "dark": "#F0C239"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#F0C23947",
            "dark": "#F0C23947"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#A88462",
            "dark": "#A88462"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#896C39",
            "dark": "#896C39"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#FCF8EC",
            "dark": "#FCF8EC"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#3B3018",
            "dark": "#3B3018"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#F8F1DC",
            "dark": "#F8F1DC"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#F1E7C6",
            "dark": "#F1E7C6"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#F4EAD0",
            "dark": "#F4EAD0"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#F4EAD0",
            "dark": "#F4EAD0"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#F4EAD0",
            "dark": "#F4EAD0"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#F1E7C6",
            "dark": "#F1E7C6"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#F0C23929",
            "dark": "#F0C23929"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#F8F1DC",
            "dark": "#F8F1DC"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#896C3929",
            "dark": "#896C3929"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#896C3938",
            "dark": "#896C3938"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#896C3952",
            "dark": "#896C3952"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#896C3966",
            "dark": "#896C3966"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#3B3018",
            "dark": "#3B3018"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C65B6A",
            "dark": "#C65B6A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#896C39",
            "dark": "#896C39"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#D1C69C",
            "dark": "#D1C69C"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#B97F3A",
            "dark": "#B97F3A"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#D9A45E",
            "dark": "#D9A45E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#EFDCC0",
            "dark": "#EFDCC0"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A5A22",
            "dark": "#8A5A22"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#F0C239",
            "dark": "#F0C239"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#F5D46B",
            "dark": "#F5D46B"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#FAF3DC 0%,#F4EAC2 20%,#ECDFAB 36%,#E2D191 50%,#D6C078 62%,#C9AF63 74%,#C4A85F 86%,#B89B51 100%)",
            "dark": "linear-gradient(to bottom,#FAF3DC 0%,#F4EAC2 20%,#ECDFAB 36%,#E2D191 50%,#D6C078 62%,#C9AF63 74%,#C4A85F 86%,#B89B51 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#F0C239",
        "ambient": {
          "kind": "ahuang",
          "dust": 5
        }
      },
      {
        "id": "meng-hai-you-yu",
        "label": "梦海游鱼",
        "description": "梦幻海洋，游鱼作伴 —— 复刻自蜂链商城电商新零售系统管理后台的默认主题",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#F7FBFF 0%,#EDF5FD 55%,#E2EEFA 100%)",
            "dark": "linear-gradient(to bottom,#F7FBFF 0%,#EDF5FD 55%,#E2EEFA 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FBFDFF",
            "dark": "#FBFDFF"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#E1EFFB",
            "dark": "#E1EFFB"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#177CB014",
            "dark": "#177CB014"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-border-l1": {
            "light": "#177CB00F",
            "dark": "#177CB00F"
          },
          "--dsw-alias-border-l2": {
            "light": "#177CB021",
            "dark": "#177CB021"
          },
          "--dsw-alias-border-l3": {
            "light": "#177CB02E",
            "dark": "#177CB02E"
          },
          "--dsw-alias-border-l4": {
            "light": "#177CB03D",
            "dark": "#177CB03D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-label-primary": {
            "light": "#16384F",
            "dark": "#16384F"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#16384F",
            "dark": "#16384F"
          },
          "--dsw-alias-label-secondary": {
            "light": "#2E4A63",
            "dark": "#2E4A63"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#5A7B96",
            "dark": "#5A7B96"
          },
          "--dsw-alias-label-caption": {
            "light": "#5A7B96",
            "dark": "#5A7B96"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#8FAAC0",
            "dark": "#8FAAC0"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#2E4A63",
            "dark": "#2E4A63"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#B8860B",
            "dark": "#B8860B"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#2B74B512",
            "dark": "#2B74B512"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#2B74B529",
            "dark": "#2B74B529"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#06527929",
            "dark": "#06527929"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#2B74B5",
            "dark": "#2B74B5"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#177CB047",
            "dark": "#177CB047"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#2B74B524",
            "dark": "#2B74B524"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#2B74B5",
            "dark": "#2B74B5"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#2B74B53D",
            "dark": "#2B74B53D"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#4C8DAE",
            "dark": "#4C8DAE"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#F5FAFF",
            "dark": "#F5FAFF"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#16384F",
            "dark": "#16384F"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#EAF5FF",
            "dark": "#EAF5FF"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#D6E9F8",
            "dark": "#D6E9F8"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#D6E9F8",
            "dark": "#D6E9F8"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#2B74B524",
            "dark": "#2B74B524"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#EAF5FF",
            "dark": "#EAF5FF"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#2B74B529",
            "dark": "#2B74B529"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#2B74B538",
            "dark": "#2B74B538"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#2B74B552",
            "dark": "#2B74B552"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#2B74B566",
            "dark": "#2B74B566"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#065279",
            "dark": "#065279"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C0566A",
            "dark": "#C0566A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#9CC3E4",
            "dark": "#9CC3E4"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#CA6924",
            "dark": "#CA6924"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#E09A4E",
            "dark": "#E09A4E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#F3E3CB",
            "dark": "#F3E3CB"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A4A12",
            "dark": "#8A4A12"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#4C8DAE",
            "dark": "#4C8DAE"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#EAF5FF 0%,#DDF0FF 26%,#CDE9FB 52%,#C7E7FA 62%,#CDEEFC 70%,#C4E7FA 80%,#B9DCF3 90%,#B0D9F0 100%)",
            "dark": "linear-gradient(to bottom,#EAF5FF 0%,#DDF0FF 26%,#CDE9FB 52%,#C7E7FA 62%,#CDEEFC 70%,#C4E7FA 80%,#B9DCF3 90%,#B0D9F0 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#FFD166",
        "ambient": {
          "kind": "dream",
          "bubbles": 9,
          "motes": 5,
          "fish": 3
        }
      },
      {
        "id": "pei-an-jie-xin",
        "label": "佩安杰心",
        "description": "檀香禅影，自在安顿 —— 复刻自蜂链商城电商新零售系统管理后台同名主题",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#FCFAF5 0%,#F8F3E9 55%,#F3ECDD 100%)",
            "dark": "linear-gradient(to bottom,#FCFAF5 0%,#F8F3E9 55%,#F3ECDD 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FDFBF7",
            "dark": "#FDFBF7"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#EFE7D7",
            "dark": "#EFE7D7"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#7A5C3E14",
            "dark": "#7A5C3E14"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#F3EBDD",
            "dark": "#F3EBDD"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#F3EBDD",
            "dark": "#F3EBDD"
          },
          "--dsw-alias-border-l1": {
            "light": "#7A5C3E0F",
            "dark": "#7A5C3E0F"
          },
          "--dsw-alias-border-l2": {
            "light": "#7A5C3E21",
            "dark": "#7A5C3E21"
          },
          "--dsw-alias-border-l3": {
            "light": "#7A5C3E2E",
            "dark": "#7A5C3E2E"
          },
          "--dsw-alias-border-l4": {
            "light": "#7A5C3E3D",
            "dark": "#7A5C3E3D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#7A5C3E",
            "dark": "#7A5C3E"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#7A5C3E",
            "dark": "#7A5C3E"
          },
          "--dsw-alias-label-primary": {
            "light": "#3F3222",
            "dark": "#3F3222"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#3F3222",
            "dark": "#3F3222"
          },
          "--dsw-alias-label-secondary": {
            "light": "#5E4A38",
            "dark": "#5E4A38"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#85705A",
            "dark": "#85705A"
          },
          "--dsw-alias-label-caption": {
            "light": "#85705A",
            "dark": "#85705A"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#AC9C86",
            "dark": "#AC9C86"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#5E4A38",
            "dark": "#5E4A38"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#B4653A",
            "dark": "#B4653A"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#9C7B5814",
            "dark": "#9C7B5814"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#B4653A2E",
            "dark": "#B4653A2E"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#F3EBDD",
            "dark": "#F3EBDD"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#B4653A3D",
            "dark": "#B4653A3D"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#7A5C3E",
            "dark": "#7A5C3E"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#9C7B58",
            "dark": "#9C7B58"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#7A5C3E47",
            "dark": "#7A5C3E47"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#B4653A29",
            "dark": "#B4653A29"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#B4653A",
            "dark": "#B4653A"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#B4653A47",
            "dark": "#B4653A47"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#9C7B58",
            "dark": "#9C7B58"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#8A6E52",
            "dark": "#8A6E52"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#FAF6EE",
            "dark": "#FAF6EE"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#3F3222",
            "dark": "#3F3222"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#F5EFE3",
            "dark": "#F5EFE3"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#EDE4D2",
            "dark": "#EDE4D2"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#F3EBDD",
            "dark": "#F3EBDD"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#F3EBDD",
            "dark": "#F3EBDD"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#F3EBDD",
            "dark": "#F3EBDD"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#EDE4D2",
            "dark": "#EDE4D2"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#B4653A29",
            "dark": "#B4653A29"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#F5EFE3",
            "dark": "#F5EFE3"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#7A5C3E29",
            "dark": "#7A5C3E29"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#7A5C3E38",
            "dark": "#7A5C3E38"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#7A5C3E52",
            "dark": "#7A5C3E52"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#7A5C3E66",
            "dark": "#7A5C3E66"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#3F3222",
            "dark": "#3F3222"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C65B6A",
            "dark": "#C65B6A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#7A5C3E",
            "dark": "#7A5C3E"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#C4B39A",
            "dark": "#C4B39A"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#B97F3A",
            "dark": "#B97F3A"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#D9A45E",
            "dark": "#D9A45E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#EFDCC0",
            "dark": "#EFDCC0"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A5A22",
            "dark": "#8A5A22"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#B4653A",
            "dark": "#B4653A"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#D08A5C",
            "dark": "#D08A5C"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#F2E8D8 0%,#EBDCC4 22%,#E0CDAD 42%,#D4BC98 60%,#C3A87F 78%,#A98D6B 100%)",
            "dark": "linear-gradient(to bottom,#F2E8D8 0%,#EBDCC4 22%,#E0CDAD 42%,#D4BC98 60%,#C3A87F 78%,#A98D6B 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#B4653A",
        "ambient": {
          "kind": "jiexin",
          "dust": 4
        }
      },
      {
        "id": "shan-qing-ting-cai",
        "label": "山青婷彩",
        "description": "青山叠翠，蜓舞生姿 —— 复刻自蜂链商城电商新零售系统管理后台同名主题",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#F7FCF9 0%,#EDF7F1 55%,#E4F2EA 100%)",
            "dark": "linear-gradient(to bottom,#F7FCF9 0%,#EDF7F1 55%,#E4F2EA 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FBFEFC",
            "dark": "#FBFEFC"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#E3F1E8",
            "dark": "#E3F1E8"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#2F7D5E14",
            "dark": "#2F7D5E14"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-border-l1": {
            "light": "#2F7D5E0F",
            "dark": "#2F7D5E0F"
          },
          "--dsw-alias-border-l2": {
            "light": "#2F7D5E21",
            "dark": "#2F7D5E21"
          },
          "--dsw-alias-border-l3": {
            "light": "#2F7D5E2E",
            "dark": "#2F7D5E2E"
          },
          "--dsw-alias-border-l4": {
            "light": "#2F7D5E3D",
            "dark": "#2F7D5E3D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-label-primary": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-label-secondary": {
            "light": "#3C6B57",
            "dark": "#3C6B57"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#5C8474",
            "dark": "#5C8474"
          },
          "--dsw-alias-label-caption": {
            "light": "#5C8474",
            "dark": "#5C8474"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#8AA79B",
            "dark": "#8AA79B"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#3C6B57",
            "dark": "#3C6B57"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#D97BA4",
            "dark": "#D97BA4"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#3E9B7A14",
            "dark": "#3E9B7A14"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#E88BB02E",
            "dark": "#E88BB02E"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#E88BB03D",
            "dark": "#E88BB03D"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#3E9B7A",
            "dark": "#3E9B7A"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#2F7D5E47",
            "dark": "#2F7D5E47"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#E88BB029",
            "dark": "#E88BB029"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#E88BB0",
            "dark": "#E88BB0"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#E88BB047",
            "dark": "#E88BB047"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#4C9B78",
            "dark": "#4C9B78"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#3E9B7A",
            "dark": "#3E9B7A"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#F4FBF7",
            "dark": "#F4FBF7"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#EAF7F0",
            "dark": "#EAF7F0"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#DCEEE2",
            "dark": "#DCEEE2"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#DCEEE2",
            "dark": "#DCEEE2"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#E88BB029",
            "dark": "#E88BB029"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#EAF7F0",
            "dark": "#EAF7F0"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#2F7D5E29",
            "dark": "#2F7D5E29"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#2F7D5E38",
            "dark": "#2F7D5E38"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#2F7D5E52",
            "dark": "#2F7D5E52"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#2F7D5E66",
            "dark": "#2F7D5E66"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C65B6A",
            "dark": "#C65B6A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#9DCDBA",
            "dark": "#9DCDBA"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#B97F3A",
            "dark": "#B97F3A"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#D9A45E",
            "dark": "#D9A45E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#EFDCC0",
            "dark": "#EFDCC0"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A5A22",
            "dark": "#8A5A22"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#E88BB0",
            "dark": "#E88BB0"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#F8A8C2",
            "dark": "#F8A8C2"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#EAF7F0 0%,#D8EFE4 20%,#C9E8DA 36%,#BFE2D2 50%,#B4DCCA 62%,#A8D2BE 74%,#9CC9B2 86%,#90C0A8 100%)",
            "dark": "linear-gradient(to bottom,#EAF7F0 0%,#D8EFE4 20%,#C9E8DA 36%,#BFE2D2 50%,#B4DCCA 62%,#A8D2BE 74%,#9CC9B2 86%,#90C0A8 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#E88BB0",
        "ambient": {
          "kind": "shan",
          "petals": 7
        }
      },
      {
        "id": "shi-liu-jin",
        "label": "纯色/拼色",
        "description": "石榴红撞赤金与翡翠 —— 纯色排 × 拼色排的配色卡：15 个色块铺满卡面，不含侧栏素材",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#FBF7EC 0%,#F2ECDE 55%,#EADFC4 100%)",
            "dark": "linear-gradient(to bottom,#FBF7EC 0%,#F2ECDE 55%,#EADFC4 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#F0F0F4",
            "dark": "#F0F0F4"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFBF0",
            "dark": "#FFFBF0"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFBF0",
            "dark": "#FFFBF0"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#EEDEB0",
            "dark": "#EEDEB0"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#D1D9E0",
            "dark": "#D1D9E0"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#EEDEB0",
            "dark": "#EEDEB0"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#EEDEB0",
            "dark": "#EEDEB0"
          },
          "--dsw-alias-border-l1": {
            "light": "#9D29330F",
            "dark": "#9D29330F"
          },
          "--dsw-alias-border-l2": {
            "light": "#9D293321",
            "dark": "#9D293321"
          },
          "--dsw-alias-border-l3": {
            "light": "#9D29332E",
            "dark": "#9D29332E"
          },
          "--dsw-alias-border-l4": {
            "light": "#D1D9E080",
            "dark": "#D1D9E080"
          },
          "--dsw-alias-brand-primary": {
            "light": "#9D2933",
            "dark": "#9D2933"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#9D2933",
            "dark": "#9D2933"
          },
          "--dsw-alias-label-primary": {
            "light": "#312520",
            "dark": "#312520"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#312520",
            "dark": "#312520"
          },
          "--dsw-alias-label-secondary": {
            "light": "#574266",
            "dark": "#574266"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#75664D",
            "dark": "#75664D"
          },
          "--dsw-alias-label-caption": {
            "light": "#75664D",
            "dark": "#75664D"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#9A8C76",
            "dark": "#9A8C76"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#574266",
            "dark": "#574266"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#9D2933",
            "dark": "#9D2933"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#9D293314",
            "dark": "#9D293314"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#F20C002E",
            "dark": "#F20C002E"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#EEDEB0",
            "dark": "#EEDEB0"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#F20C003D",
            "dark": "#F20C003D"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#9D2933",
            "dark": "#9D2933"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#B33A45",
            "dark": "#B33A45"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#9D293347",
            "dark": "#9D293347"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#F20C0029",
            "dark": "#F20C0029"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#F20C00",
            "dark": "#F20C00"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#F20C0047",
            "dark": "#F20C0047"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#574266",
            "dark": "#574266"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#75664D",
            "dark": "#75664D"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFBF0",
            "dark": "#FFFBF0"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFBF0",
            "dark": "#FFFBF0"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#F7F0E0",
            "dark": "#F7F0E0"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#312520",
            "dark": "#312520"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#F0F0F4",
            "dark": "#F0F0F4"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#E4E6EC",
            "dark": "#E4E6EC"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#EEDEB0",
            "dark": "#EEDEB0"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#EEDEB0",
            "dark": "#EEDEB0"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#EEDEB0",
            "dark": "#EEDEB0"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#D1D9E0",
            "dark": "#D1D9E0"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#F20C0029",
            "dark": "#F20C0029"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#F0F0F4",
            "dark": "#F0F0F4"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#9D293329",
            "dark": "#9D293329"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#9D293338",
            "dark": "#9D293338"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#9D293352",
            "dark": "#9D293352"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#9D293366",
            "dark": "#9D293366"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#312520",
            "dark": "#312520"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFBF0",
            "dark": "#FFFBF0"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C2352B",
            "dark": "#C2352B"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#1DA981",
            "dark": "#1DA981"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#7FE3C0",
            "dark": "#7FE3C0"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#D8F5E8",
            "dark": "#D8F5E8"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#C89B40",
            "dark": "#C89B40"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#EACD76",
            "dark": "#EACD76"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#F7EBC8",
            "dark": "#F7EBC8"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#7A5A0E",
            "dark": "#7A5A0E"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#3DE1AD",
            "dark": "#3DE1AD"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#A8F0D8",
            "dark": "#A8F0D8"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#D6ECF0 0%,#E4E6E4 8%,#F2ECDE 18%,#F5E7CE 30%,#EFD6AE 44%,#E5BE86 58%,#D6A45C 72%,#C48F3C 86%,#BA8330 100%)",
            "dark": "linear-gradient(to bottom,#D6ECF0 0%,#E4E6E4 8%,#F2ECDE 18%,#F5E7CE 30%,#EFD6AE 44%,#E5BE86 58%,#D6A45C 72%,#C48F3C 86%,#BA8330 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFBF0",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "card": {
          "rows": [
            {
              "kind": "solid",
              "schemes": [
                "p-xiang-se",
                "p-ju-huang",
                "p-tao-hong",
                "p-hai-tang-hong",
                "p-jiang-zi"
              ]
            },
            {
              "kind": "solid",
              "schemes": [
                "p-song-bai-lu",
                "p-zhu-qing",
                "p-cang-qing",
                "p-dai-zi",
                "p-xuan-qing"
              ]
            },
            {
              "kind": "clash",
              "schemes": [
                "p-shi-liu-jin",
                "p-bao-lan-jin",
                "p-qing-lian-jin",
                "p-song-hua-tao",
                "p-wu-jin"
              ]
            }
          ]
        },
        "accent": "#F20C00"
      },
      {
        "id": "ying-mu-cai-yun",
        "label": "营慕彩云",
        "description": "营幕之下，彩云为伴 —— 复刻自蜂链商城电商新零售系统管理后台同名主题",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#FBFCF8 0%,#F5F8EF 55%,#EEF3E4 100%)",
            "dark": "linear-gradient(to bottom,#FBFCF8 0%,#F5F8EF 55%,#EEF3E4 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FBFDF7",
            "dark": "#FBFDF7"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#E7EFE0",
            "dark": "#E7EFE0"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#2D5A3D14",
            "dark": "#2D5A3D14"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#ECF3E6",
            "dark": "#ECF3E6"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#ECF3E6",
            "dark": "#ECF3E6"
          },
          "--dsw-alias-border-l1": {
            "light": "#2D5A3D0F",
            "dark": "#2D5A3D0F"
          },
          "--dsw-alias-border-l2": {
            "light": "#2D5A3D21",
            "dark": "#2D5A3D21"
          },
          "--dsw-alias-border-l3": {
            "light": "#2D5A3D2E",
            "dark": "#2D5A3D2E"
          },
          "--dsw-alias-border-l4": {
            "light": "#2D5A3D3D",
            "dark": "#2D5A3D3D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#2D5A3D",
            "dark": "#2D5A3D"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#2D5A3D",
            "dark": "#2D5A3D"
          },
          "--dsw-alias-label-primary": {
            "light": "#234030",
            "dark": "#234030"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#234030",
            "dark": "#234030"
          },
          "--dsw-alias-label-secondary": {
            "light": "#3E6B4A",
            "dark": "#3E6B4A"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#62816C",
            "dark": "#62816C"
          },
          "--dsw-alias-label-caption": {
            "light": "#62816C",
            "dark": "#62816C"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#93A996",
            "dark": "#93A996"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#3E6B4A",
            "dark": "#3E6B4A"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#C4899F",
            "dark": "#C4899F"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#3E6B4A14",
            "dark": "#3E6B4A14"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#FFB3472E",
            "dark": "#FFB3472E"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#ECF3E6",
            "dark": "#ECF3E6"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#FFB3473D",
            "dark": "#FFB3473D"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#2D5A3D",
            "dark": "#2D5A3D"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#3E6B4A",
            "dark": "#3E6B4A"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#2D5A3D47",
            "dark": "#2D5A3D47"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#FFB34729",
            "dark": "#FFB34729"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#FFB347",
            "dark": "#FFB347"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#FFB34747",
            "dark": "#FFB34747"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#3E6B4A",
            "dark": "#3E6B4A"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#4A7D58",
            "dark": "#4A7D58"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#F6FAF2",
            "dark": "#F6FAF2"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#234030",
            "dark": "#234030"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#EFF6EA",
            "dark": "#EFF6EA"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#E3EEDC",
            "dark": "#E3EEDC"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#ECF3E6",
            "dark": "#ECF3E6"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#ECF3E6",
            "dark": "#ECF3E6"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#ECF3E6",
            "dark": "#ECF3E6"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#E3EEDC",
            "dark": "#E3EEDC"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#FFB34729",
            "dark": "#FFB34729"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#EFF6EA",
            "dark": "#EFF6EA"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#2D5A3D29",
            "dark": "#2D5A3D29"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#2D5A3D38",
            "dark": "#2D5A3D38"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#2D5A3D52",
            "dark": "#2D5A3D52"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#2D5A3D66",
            "dark": "#2D5A3D66"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#234030",
            "dark": "#234030"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C65B6A",
            "dark": "#C65B6A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#2D5A3D",
            "dark": "#2D5A3D"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#A8C8B2",
            "dark": "#A8C8B2"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#B97F3A",
            "dark": "#B97F3A"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#D9A45E",
            "dark": "#D9A45E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#EFDCC0",
            "dark": "#EFDCC0"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A5A22",
            "dark": "#8A5A22"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#FFB347",
            "dark": "#FFB347"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#FFD08A",
            "dark": "#FFD08A"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(160deg,#D9E8DC 0%,#E6D9C6 28%,#F2E0BE 58%,#F6E1EE 88%,#DCD5F0 100%)",
            "dark": "linear-gradient(160deg,#D9E8DC 0%,#E6D9C6 28%,#F2E0BE 58%,#F6E1EE 88%,#DCD5F0 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#FFB347",
        "ambient": {
          "kind": "caiyun",
          "stars": 12
        }
      }
    ]

    /**
     * 15 套「纯色/拼色」配色（`lib/palette-schemes.json`，由 embed-themes 内联）。
     *
     * 它们**不是主题**：不注册进主题服务、不占面板卡片、不进官方「外观」下拉。
     * 点卡片上的色值按钮时，插件把 {@link schemeTokens} 展出来的这一层叠上去，
     * 整屏就换成那套配色；切到别的皮肤时这一层必须撤除（见 `syncScheme`）。
     */
    const BUNDLED_PALETTES = [
      {
        "id": "p-xiang-se",
        "kind": "solid",
        "label": "缃色",
        "main": "#F0C239",
        "ground": "#F2ECDE",
        "ink": "#312520",
        "source": "黄 1-9 缃色（浅黄色）"
      },
      {
        "id": "p-ju-huang",
        "kind": "solid",
        "label": "橘黄",
        "main": "#FF8936",
        "ground": "#F2ECDE",
        "ink": "#312520",
        "source": "黄 1-5 橘黄（柑橘的黄色）"
      },
      {
        "id": "p-tao-hong",
        "kind": "solid",
        "label": "桃红",
        "main": "#F47983",
        "ground": "#EDD1D8",
        "ink": "#56004F",
        "source": "红 0-3 桃红（桃花的颜色）"
      },
      {
        "id": "p-hai-tang-hong",
        "kind": "solid",
        "label": "海棠红",
        "main": "#DB5A6B",
        "ground": "#EDD1D8",
        "ink": "#56004F",
        "source": "红 0-4 海棠红（淡紫红色、较桃红色深一些）"
      },
      {
        "id": "p-jiang-zi",
        "kind": "solid",
        "label": "绛紫",
        "main": "#8C4356",
        "ground": "#EDD1D8",
        "ink": "#56004F",
        "source": "红 0-9 绛紫（紫中略带红的颜色）"
      },
      {
        "id": "p-song-bai-lu",
        "kind": "solid",
        "label": "松柏绿",
        "main": "#057748",
        "ground": "#E0F0E9",
        "ink": "#424C50",
        "source": "绿 2-30 松花绿（松柏叶的墨绿）"
      },
      {
        "id": "p-zhu-qing",
        "kind": "solid",
        "label": "竹青",
        "main": "#789262",
        "ground": "#E0EEE8",
        "ink": "#424C50",
        "source": "绿 2-3 竹青（竹子的绿色）"
      },
      {
        "id": "p-cang-qing",
        "kind": "solid",
        "label": "苍青",
        "main": "#7397AB",
        "ground": "#D6ECF0",
        "ink": "#4A4266",
        "source": "苍 4-3 苍青"
      },
      {
        "id": "p-dai-zi",
        "kind": "solid",
        "label": "黛紫",
        "main": "#574266",
        "ground": "#E4C6D0",
        "ink": "#56004F",
        "source": "蓝 3-12 黛紫（深紫色）"
      },
      {
        "id": "p-xuan-qing",
        "kind": "solid",
        "label": "玄青",
        "main": "#3D3B4F",
        "ground": "#F0F0F4",
        "ink": "#312520",
        "source": "黑 7-1 玄青（深黑色）"
      },
      {
        "id": "p-shi-liu-jin",
        "kind": "clash",
        "label": "石榴金",
        "main": "#F20C00",
        "ground": "#F2ECDE",
        "ink": "#312520",
        "fill": "#9D2933",
        "dots": [
          "#FFFFFF",
          "#D6ECF0",
          "#EACD76",
          "#3DE1AD"
        ],
        "source": "红 0-5 石榴红 + 金银 8-0 赤金 + 绿 2-14 翡翠色；按钮族用红 0-11 胭脂（白字 7.50:1，而压在石榴红上只有 4.35:1）"
      },
      {
        "id": "p-bao-lan-jin",
        "kind": "clash",
        "label": "宝蓝·赤金",
        "main": "#4B5CC4",
        "ground": "#D6ECF0",
        "ink": "#4A4266",
        "dots": [
          "#F2BE45",
          "#EACD76",
          "#D9B611",
          "#FFFFFF"
        ],
        "source": "蓝 3-5 宝蓝（多和小面积纯黄色（金色）配合使用）+ 金银 8-0 赤金"
      },
      {
        "id": "p-qing-lian-jin",
        "kind": "clash",
        "label": "青莲·金玉",
        "main": "#801DAE",
        "ground": "#E4C6D0",
        "ink": "#56004F",
        "dots": [
          "#F2BE45",
          "#FFF143",
          "#3DE1AD",
          "#FFFFFF"
        ],
        "source": "蓝 3-19 青莲（偏蓝的紫色）+ 黄 1-0 鹅黄 + 绿 2-14 翡翠色"
      },
      {
        "id": "p-song-hua-tao",
        "kind": "clash",
        "label": "松花·桃粉",
        "main": "#BCE672",
        "ground": "#F7FBEC",
        "ink": "#424C50",
        "dots": [
          "#C93756",
          "#057748"
        ],
        "source": "绿 2-31 松花色（嫩黄绿）+ 红 0-1 樱桃色 + 绿 2-30 松花绿"
      },
      {
        "id": "p-wu-jin",
        "kind": "clash",
        "label": "藏青·鹅黄",
        "main": "#2E4E7E",
        "ground": "#E2E9F2",
        "ink": "#312520",
        "dots": [
          "#F2BE45",
          "#FFFFFF",
          "#FFB3A7",
          "#3DE1AD"
        ],
        "source": "蓝 8-2 藏青（深蓝）+ 金银 8-0 赤金 + 精白 + 红 0-0 粉红 + 绿 2-14 翡翠色"
      }
    ]

    const BUNDLED_MOOD_LINES = {
      "$comment": "心情问候语库（标题栏跑马灯）。出处：40 条种子复制自作者自己的「更新管理平台」站点（装修管理-心情问候语，2026-09-27 抓取，seq 1-40）；seq 101+ 为插件新增。分类沿用站点五类：morning 早安 / day 白天 / night 夜深 / general 通用 / holiday 节假日。节日区间为 MM-DD（去年份，每年复用）。红线：禁止负面、消极或敏感言论——embed-themes.mjs 建期黑名单校验，命中即构建失败。单条 text 不超过 100 字符。",
      "version": 1,
      "lines": [
        {
          "id": "m001",
          "seq": 1,
          "category": "morning",
          "text": "寻必寻见，想必到达"
        },
        {
          "id": "m002",
          "seq": 2,
          "category": "morning",
          "text": "晨光不负赶路人，新的一天从心安开始"
        },
        {
          "id": "m003",
          "seq": 3,
          "category": "morning",
          "text": "今天也要做自己的太阳，无需凭借谁的光"
        },
        {
          "id": "m004",
          "seq": 4,
          "category": "morning",
          "text": "万物皆有裂痕，那是光照进来的地方"
        },
        {
          "id": "m005",
          "seq": 5,
          "category": "morning",
          "text": "早安，愿你所遇皆温柔，所行皆坦途"
        },
        {
          "id": "m006",
          "seq": 6,
          "category": "morning",
          "text": "把昨天的疲惫留在梦里，把今天的期待装进行囊"
        },
        {
          "id": "m007",
          "seq": 7,
          "category": "morning",
          "text": "山高路远，看世界，也找自己"
        },
        {
          "id": "m008",
          "seq": 8,
          "category": "morning",
          "text": "每一个清晨，都是世界温柔的重新开始"
        },
        {
          "id": "m009",
          "seq": 9,
          "category": "day",
          "text": "你对我来说真的很重要"
        },
        {
          "id": "m010",
          "seq": 10,
          "category": "day",
          "text": "心若无所求，有风无风皆自由"
        },
        {
          "id": "m011",
          "seq": 11,
          "category": "day",
          "text": "慢慢来，比较快"
        },
        {
          "id": "m012",
          "seq": 12,
          "category": "day",
          "text": "生活的答案，都藏在认真过好的今天里"
        },
        {
          "id": "m013",
          "seq": 13,
          "category": "day",
          "text": "保持热爱，奔赴山海"
        },
        {
          "id": "m014",
          "seq": 14,
          "category": "day",
          "text": "心中有丘壑，眉目作山河"
        },
        {
          "id": "m015",
          "seq": 15,
          "category": "day",
          "text": "世界盛大，欢迎回家"
        },
        {
          "id": "m016",
          "seq": 16,
          "category": "day",
          "text": "别慌，月亮也正在大海的某处迷茫"
        },
        {
          "id": "m017",
          "seq": 17,
          "category": "day",
          "text": "与其追风去，不如等风来；等风来，不如乘风起"
        },
        {
          "id": "m018",
          "seq": 18,
          "category": "day",
          "text": "认真生活的人，生活从不亏待"
        },
        {
          "id": "m019",
          "seq": 19,
          "category": "night",
          "text": "我来到你待过的星空，算不算相逢"
        },
        {
          "id": "m020",
          "seq": 20,
          "category": "night",
          "text": "夜色温柔，愿你好梦"
        },
        {
          "id": "m021",
          "seq": 21,
          "category": "night",
          "text": "晚风吹人醒，万事藏于心"
        },
        {
          "id": "m022",
          "seq": 22,
          "category": "night",
          "text": "星光不问赶路人，时光不负有心人"
        },
        {
          "id": "m023",
          "seq": 23,
          "category": "night",
          "text": "今晚的月色替我说晚安"
        },
        {
          "id": "m024",
          "seq": 24,
          "category": "night",
          "text": "熬过漫长黑夜，才配拥有满天星辰"
        },
        {
          "id": "m025",
          "seq": 25,
          "category": "night",
          "text": "愿所有的疲惫，都被这个夜晚温柔收留"
        },
        {
          "id": "m026",
          "seq": 26,
          "category": "night",
          "text": "深夜的坚持，是明天惊喜的伏笔"
        },
        {
          "id": "m027",
          "seq": 27,
          "category": "holiday",
          "text": "盛世华诞，与国同庆；山河远阔，人间烟火",
          "holiday": {
            "from": "10-01",
            "to": "10-08"
          }
        },
        {
          "id": "m028",
          "seq": 28,
          "category": "holiday",
          "text": "新年快乐，愿新岁胜旧年，万事尽可期",
          "holiday": {
            "from": "01-01",
            "to": "01-03"
          }
        },
        {
          "id": "m029",
          "seq": 29,
          "category": "holiday",
          "text": "新春吉祥，灯火可亲，岁岁常安",
          "holiday": {
            "from": "02-05",
            "to": "02-12"
          }
        },
        {
          "id": "m030",
          "seq": 30,
          "category": "holiday",
          "text": "清明时节，追思故人，也惜眼前春光",
          "holiday": {
            "from": "04-04",
            "to": "04-06"
          }
        },
        {
          "id": "m031",
          "seq": 31,
          "category": "holiday",
          "text": "劳动节快乐，向每一位认真生活的人致敬",
          "holiday": {
            "from": "05-01",
            "to": "05-05"
          }
        },
        {
          "id": "m032",
          "seq": 32,
          "category": "holiday",
          "text": "粽叶飘香，端午安康",
          "holiday": {
            "from": "06-09",
            "to": "06-11"
          }
        },
        {
          "id": "m033",
          "seq": 33,
          "category": "holiday",
          "text": "但愿人长久，千里共婵娟",
          "holiday": {
            "from": "09-15",
            "to": "09-16"
          }
        },
        {
          "id": "m034",
          "seq": 34,
          "category": "holiday",
          "text": "举国同庆，家和人安，愿岁并谢，与友长兮",
          "holiday": {
            "from": "10-01",
            "to": "10-08"
          }
        },
        {
          "id": "m035",
          "seq": 35,
          "category": "general",
          "text": "愿你眼中总有光芒，活成你想要的模样"
        },
        {
          "id": "m036",
          "seq": 36,
          "category": "general",
          "text": "万事顺遂，毫无蹉跎"
        },
        {
          "id": "m037",
          "seq": 37,
          "category": "general",
          "text": "所有的美好，都在赶来的路上"
        },
        {
          "id": "m038",
          "seq": 38,
          "category": "general",
          "text": "心里有光，慢一点又何妨"
        },
        {
          "id": "m039",
          "seq": 39,
          "category": "general",
          "text": "平安喜乐，得偿所愿"
        },
        {
          "id": "m040",
          "seq": 40,
          "category": "general",
          "text": "岁月不扰，余生静好"
        },
        {
          "id": "m101",
          "seq": 101,
          "category": "morning",
          "text": "清晨的风，是今天寄来的第一封信"
        },
        {
          "id": "m102",
          "seq": 102,
          "category": "morning",
          "text": "新的一天：把小事做好，把心情调亮"
        },
        {
          "id": "m103",
          "seq": 103,
          "category": "morning",
          "text": "太阳照常升起，你也照常了不起"
        },
        {
          "id": "m104",
          "seq": 104,
          "category": "morning",
          "text": "今天的你，比昨天多一点点勇敢"
        },
        {
          "id": "m105",
          "seq": 105,
          "category": "morning",
          "text": "晨光已就位，慢慢来，别着急"
        },
        {
          "id": "m106",
          "seq": 106,
          "category": "day",
          "text": "慢慢走，路上有花"
        },
        {
          "id": "m107",
          "seq": 107,
          "category": "day",
          "text": "把日子过成自己喜欢的样子"
        },
        {
          "id": "m108",
          "seq": 108,
          "category": "day",
          "text": "今天的风很温柔，很适合认真生活"
        },
        {
          "id": "m109",
          "seq": 109,
          "category": "day",
          "text": "一步一步，都是向上的路"
        },
        {
          "id": "m110",
          "seq": 110,
          "category": "day",
          "text": "保持微笑，好运正在排队"
        },
        {
          "id": "m111",
          "seq": 111,
          "category": "night",
          "text": "夜深了，把烦恼调成静音"
        },
        {
          "id": "m112",
          "seq": 112,
          "category": "night",
          "text": "星星已就位，陪你收工"
        },
        {
          "id": "m113",
          "seq": 113,
          "category": "night",
          "text": "今晚适合早点休息，明天见"
        },
        {
          "id": "m114",
          "seq": 114,
          "category": "night",
          "text": "愿你被月光温柔以待"
        },
        {
          "id": "m115",
          "seq": 115,
          "category": "night",
          "text": "辛苦了，今天也好好完成了"
        },
        {
          "id": "m116",
          "seq": 116,
          "category": "general",
          "text": "慢慢来，一切都会如期而至"
        },
        {
          "id": "m117",
          "seq": 117,
          "category": "general",
          "text": "生活明朗，万物可爱"
        },
        {
          "id": "m118",
          "seq": 118,
          "category": "general",
          "text": "你走的每一步，都算数"
        },
        {
          "id": "m119",
          "seq": 119,
          "category": "general",
          "text": "所求皆如愿，所行化坦途"
        },
        {
          "id": "m120",
          "seq": 120,
          "category": "holiday",
          "text": "致每一位闪闪发光的她，节日快乐",
          "holiday": {
            "from": "03-08",
            "to": "03-08"
          }
        },
        {
          "id": "m121",
          "seq": 121,
          "category": "holiday",
          "text": "愿你我童心未泯，简单快乐",
          "holiday": {
            "from": "06-01",
            "to": "06-01"
          }
        }
      ]
    }
    PALETTE_SCHEMES = Array.isArray(BUNDLED_PALETTES) ? BUNDLED_PALETTES : []

    /**
     * Marks the ambient nodes this run created.
     *
     * The layer lives on the document body, so parentage can no longer identify
     * ownership. Anything found without this stamp is debris from an earlier build —
     * and because the shell keeps its DOM across a plugin reload, such nodes outlive
     * the code that made them.
     */
    const AMBIENT_OWNER = 'theme-gallery'

    /**
     * Ambient scenery drawn inside the sidebar column.
     *
     * Ported from the source admin system, where each theme carried its own
     * animation component mounted into a `left-sidebar-theme-container`. The
     * artwork is reproduced here (mountains, mist, water, dragonflies, falling
     * petals for 山青婷彩; corner glow, rising bubbles, swaying seaweed for
     * 梦海游鱼) with two deliberate changes:
     *
     *  - sizes are expressed in **percentages and em**, not the source system's
     *    fixed 223 px sidebar width, so the scene scales to whatever width the
     *    user drags the sidebar to;
     *  - nothing here carries colour of its own beyond the ported artwork, and the
     *    layer is `pointer-events:none` / `z-index:0`, so it can never intercept a
     *    click or cover a menu item. The source system has the same rule, and a
     *    bug note there records opaque mountains hiding the bottom menu rows.
     *
     * `#dsh-theme-ambient` is a seat this plugin injects into the sidebar column;
     * `syncAmbient()` fills it, and each theme chooses its scene by `ambient.kind`.
     */
    const AMBIENT_CSS = [
      /* The layer, arranged exactly like the working `dsh-theme-firefly` ambient layer:
         a full-viewport fixed element styled by a CLASS, appended to `document.body`, at
         `z-index: 60`.
         Every other arrangement of this layer failed to paint on this machine — precise
         inline geometry, maximum z-index, `documentElement` as the parent, inline styles
         per element. The firefly plugin uses this one and renders, so this is now the
         layer's arrangement. The scenery is placed INSIDE it (`.dsh-ambient-scene`). */
      '#dsh-theme-ambient{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:60}',
      '.dsh-ambient-scene{overflow:hidden}',
      /* The scene roots carry their own positioning inline too; the selectors below are
         kept only where a rule cannot be inlined (`@keyframes`) or where they must reach
         a shell element. */
      '.ZTP-Xa_sidebarCol{position:relative}',

      /* BRING-UP PROBE — remove with the rest of the diagnostics.
         The control layer, copied rule-for-rule from the working `dsh-theme-firefly`
         plugin: geometry and stacking from a class, motion from `@keyframes`, and only
         the per-element random values inline. */
      '.dsh-amb-control{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden}',
      /* BRING-UP PROBE — the scene box inside the proven layer. No `pointer-events` here on
         purpose: the layer above already disables it, and this box is the thing being
         tested rather than a decoration that must stay click-through. */
      '.dsh-amb-control-scene{overflow:hidden}',

      /* The scenery's own geometry. These live here rather than inline because the scene
         markup is built as a string, and they must reach it wherever it is mounted — which
         is now inside the proven layer rather than a layer of its own. */
      '.dsh-amb-control-scene .sta-mountains{position:absolute;left:0;right:0;bottom:0;height:46%;z-index:3}',
      '.dsh-amb-control-scene .sta-mountains svg{display:block;width:100%;height:100%}',
      '.dsh-amb-control-scene .sta-mist{position:absolute;height:1.6em;border-radius:1000px;z-index:4;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);',
      'filter:blur(5px);opacity:.85;animation:dsh-amb-mist 26s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .sta-mist-1{width:62%;top:56%;left:12%}',
      '.dsh-amb-control-scene .sta-mist-2{width:44%;top:61%;left:38%;opacity:.6;',
      'animation-duration:32s;animation-delay:-9s}',
      '.dsh-amb-control-scene .sta-pond{position:absolute;left:0;right:0;bottom:0;height:13%;z-index:5;',
      'background:linear-gradient(to bottom,rgba(104,178,150,.62),rgba(66,141,113,.78))}',
      '.dsh-amb-control-scene .sta-pond-line{position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.6;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent)}',
      '.dsh-amb-control-scene .sta-ripple{position:absolute;z-index:6;width:.55em;height:.55em}',
      '.dsh-amb-control-scene .sta-ripple span{position:absolute;inset:0;',
      'border:1.6px solid rgba(217,123,164,.9);border-radius:50%;',
      'animation:dsh-amb-ring 3.2s ease-out infinite}',
      '.dsh-amb-control-scene .sta-ripple span:nth-child(2){animation-delay:1.6s}',
      '@keyframes dsh-amb-ring{0%{transform:scale(.4);opacity:.8}100%{transform:scale(4.2);opacity:0}}',
      '.dsh-amb-control-scene .sta-dfly{position:absolute;z-index:8;will-change:transform}',
      '.dsh-amb-control-scene .sta-dfly svg{display:block;width:100%;height:auto}',
      '.dsh-amb-control-scene .sta-bob{animation:dsh-amb-bob .9s ease-in-out infinite}',
      '.dsh-amb-control-scene .sta-dfly-2 .sta-bob{animation-duration:1.1s;animation-delay:-.4s}',
      /* The flight paths are bounded INSIDE the sidebar. The previous ones swept up to
         5.4em to the right, which carried the dragonfly out of the 280px column and under
         the main column, where it was hidden — the drift is now horizontal-left-biased and
         half the amplitude. */
      '@keyframes dsh-amb-hover1{0%{transform:translate(0,0)}18%{transform:translate(1.4em,.7em)}',
      '38%{transform:translate(2.4em,-.5em)}55%{transform:translate(1.2em,.5em)}',
      '70%{transform:translate(-.5em,-.9em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-hover2{0%{transform:translate(0,0)}25%{transform:translate(-1.5em,-1.2em)}',
      '50%{transform:translate(-2.4em,.5em)}75%{transform:translate(-.7em,1.2em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2.5px) rotate(-2deg)}}',
      '.dsh-amb-control-scene .sta-petals{position:absolute;inset:0;z-index:2;pointer-events:none}',
      '.dsh-amb-control-scene .sta-petal{position:absolute;top:-1em;',
      'border-radius:60% 40% 55% 45%/60% 55% 45% 40%;opacity:1;animation:dsh-amb-fall linear infinite;',
      'box-shadow:0 0 3px rgba(217,123,164,.45)}',
      '@keyframes dsh-amb-fall{0%{transform:translate(0,-1em) rotate(0);opacity:0}8%{opacity:.9}',
      '35%{transform:translate(-1.2em,5em) rotate(140deg)}70%{transform:translate(.9em,10em) rotate(280deg)}',
      '100%{transform:translate(-.5em,15em) rotate(380deg);opacity:0}}',
      '@keyframes dsh-amb-mist{from{transform:translateX(0)}to{transform:translateX(11%)}}',
      /* 梦海游鱼 */
      '.dsh-amb-control-scene .dof-glow{position:absolute;inset:0;z-index:2}',
      '.dsh-amb-control-scene .dof-corner{position:absolute;top:0;left:-30%;width:150%;height:40%;',
      'background:radial-gradient(ellipse at 32% 50%,rgba(255,255,255,.55),rgba(255,255,255,0) 62%);',
      'filter:blur(12px);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'animation:dsh-amb-wash 18s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .dof-wash{position:absolute;left:-20%;width:140%;height:30%;filter:blur(12px);',
      'opacity:.5;background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);',
      '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'animation:dsh-amb-wash 24s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .dof-wash-1{top:14%}',
      '.dsh-amb-control-scene .dof-wash-2{top:34%;opacity:.34;animation-duration:31s;animation-delay:-8s}',
      '@keyframes dsh-amb-wash{from{transform:translateX(0)}to{transform:translateX(9%)}}',
      '.dsh-amb-control-scene .dof-bubbles{position:absolute;inset:0;z-index:6;pointer-events:none}',
      // The ORIGINAL rising bubbles, restored exactly as they were: pale spheres with a white
      // inset ring. An earlier revision replaced them with glowing motes, which was wrong —
      // the motes are a SECOND effect, not a new look for these.
      '.dsh-amb-control-scene .dof-bubble{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95),rgba(190,232,246,.55));',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);animation:dsh-amb-rise linear infinite}',
      '@keyframes dsh-amb-rise{0%{transform:translate(0,0) scale(.6);opacity:0}12%{opacity:.85}',
      '55%{transform:translate(1em,-7em) scale(1)}100%{transform:translate(-.6em,-12.5em) scale(.8);opacity:0}}',
      // The glowing motes, added alongside the bubbles.
      //
      // This is the effect the firefly control layer had: a soft light-blue core with a halo,
      // drifting upward. Both layers are drawn at once, so the scene shows outlined bubbles
      // AND glowing motes — two separate effects, as requested.
      '.dsh-amb-control-scene .dof-motes{position:absolute;inset:0;z-index:7;pointer-events:none}',
      '.dsh-amb-control-scene .dof-mote{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 34% 30%,#FFFFFF 0%,#D6F1FF 40%,rgba(122,205,255,.5) 72%,rgba(122,205,255,0) 100%);',
      'box-shadow:0 0 10px 3px rgba(122,205,255,.55),0 0 22px 6px rgba(122,205,255,.22);',
      'animation:dsh-amb-mote linear infinite}',
      // A straighter, quicker climb than the bubbles, so the two read as distinct effects
      // rather than one doubled-up stream.
      '@keyframes dsh-amb-mote{0%{transform:translate(0,0) scale(.5);opacity:0}10%{opacity:.95}',
      '50%{transform:translate(-.8em,-8em) scale(1)}100%{transform:translate(.5em,-13em) scale(.85);opacity:0}}',
      // Swimming fish, ported from the source system's separate `FishAnimation.vue`.
      // The component drove them through entering / bubbling / leaving phases in JavaScript;
      // a static bundle has nowhere to run that, so the same artwork crosses the water
      // continuously instead, on CSS animations.
      '.dsh-amb-control-scene .dof-fish{position:absolute;left:0;z-index:6;pointer-events:none;',
      'will-change:transform}',
      '.dsh-amb-control-scene .dof-fish svg{display:block;width:100%;height:auto}',
      // Right-to-left fish are mirrored, so the nose leads in both directions.
      '.dsh-amb-control-scene .dof-fish-flip svg{transform:scaleX(-1)}',
      '.dsh-amb-control-scene .dof-fish-bob{animation:dsh-amb-fish-bob 2.4s ease-in-out infinite}',
      '.dsh-amb-control-scene .dof-fish-tail{transform-origin:10px 10px;',
      'animation:dsh-amb-fish-tail .9s ease-in-out infinite alternate}',
      // Crossings start well off one edge and finish well off the other, so a fish enters and
      // leaves instead of appearing and vanishing mid-water.
      '@keyframes dsh-amb-swim{0%{transform:translateX(-6em)}100%{transform:translateX(24em)}}',
      '@keyframes dsh-amb-swim-back{0%{transform:translateX(24em)}100%{transform:translateX(-6em)}}',
      '@keyframes dsh-amb-fish-bob{0%,100%{transform:translateY(0) rotate(0)}',
      '50%{transform:translateY(-3px) rotate(-1.6deg)}}',
      '@keyframes dsh-amb-fish-tail{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}',
      '.dsh-amb-control-scene .dof-seaweed{position:absolute;left:0;right:0;bottom:0;height:34%;z-index:5}',
      '.dsh-amb-control-scene .dof-seaweed svg{display:block;width:100%;height:100%}',
      '.dsh-amb-control-scene .dof-blade{transform-origin:50% 100%;',
      'animation:dsh-amb-sway 6s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .dof-blade-2{animation-duration:7.4s;animation-delay:-1.6s}',
      '.dsh-amb-control-scene .dof-blade-3{animation-duration:5.2s;animation-delay:-2.8s}',
      '.dsh-amb-control-scene .dof-blade-4{animation-duration:8.1s;animation-delay:-.9s}',
      '.dsh-amb-control-scene .dof-blade-5{animation-duration:6.6s;animation-delay:-3.4s}',
      '@keyframes dsh-amb-sway{from{transform:rotate(-3.5deg)}to{transform:rotate(3.5deg)}}',
      '@media (prefers-reduced-motion:reduce){.dsh-amb-control-scene *{animation:none!important}}',


      /* ── 山青婷彩 ─────────────────────────────────────────────────────── */
      '#dsh-theme-ambient .sta-mountains{position:absolute;left:0;right:0;bottom:0;height:46%;z-index:3}',
      '#dsh-theme-ambient .sta-mountains svg{display:block;width:100%;height:100%}',
      '#dsh-theme-ambient .sta-mist{position:absolute;height:1.6em;border-radius:1000px;z-index:4;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);',
      'filter:blur(5px);opacity:.85;animation:dsh-amb-mist 26s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .sta-mist-1{width:66%;top:58.5%;left:13%}',
      '#dsh-theme-ambient .sta-mist-2{width:48%;top:63%;left:40%;opacity:.6;animation-duration:32s;animation-delay:-9s}',
      '@keyframes dsh-amb-mist{from{transform:translateX(0)}to{transform:translateX(11%)}}',

      '#dsh-theme-ambient .sta-pond{position:absolute;left:0;right:0;bottom:0;height:14%;z-index:5;',
      'background:linear-gradient(to bottom,rgba(104,178,150,.62),rgba(66,141,113,.78))}',
      '#dsh-theme-ambient .sta-pond-line{position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.6;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent)}',

      '#dsh-theme-ambient .sta-ripple{position:absolute;z-index:6;width:.55em;height:.55em}',
      '#dsh-theme-ambient .sta-ripple span{position:absolute;inset:0;border:1.6px solid rgba(232,139,176,.92);',
      'border-radius:50%;animation:dsh-amb-ring 3.2s ease-out infinite}',
      '#dsh-theme-ambient .sta-ripple span:nth-child(2){animation-delay:1.6s}',
      '@keyframes dsh-amb-ring{0%{transform:scale(.4);opacity:.8}100%{transform:scale(4.2);opacity:0}}',

      '#dsh-theme-ambient .sta-dfly{position:absolute;z-index:8;width:6.4em;will-change:transform}',
      '#dsh-theme-ambient .sta-dfly svg{display:block;width:100%;height:auto}',
      '#dsh-theme-ambient .sta-dfly-1{top:30%;left:16%;animation:dsh-amb-hover1 11s ease-in-out infinite}',
      '#dsh-theme-ambient .sta-dfly-2{top:52%;left:48%;width:4.4em;opacity:.95;',
      'animation:dsh-amb-hover2 13s ease-in-out infinite;animation-delay:-5s}',
      '#dsh-theme-ambient .sta-bob{animation:dsh-amb-bob .9s ease-in-out infinite}',
      '#dsh-theme-ambient .sta-dfly-2 .sta-bob{animation-duration:1.1s;animation-delay:-.4s}',
      '@keyframes dsh-amb-hover1{0%{transform:translate(0,0)}18%{transform:translate(2.4em,.9em)}',
      '38%{transform:translate(5.4em,-.6em)}55%{transform:translate(2.8em,.6em)}',
      '70%{transform:translate(-1.1em,-1.3em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-hover2{0%{transform:translate(0,0)}25%{transform:translate(-2.8em,-1.7em)}',
      '50%{transform:translate(-4.8em,.7em)}75%{transform:translate(-1.9em,1.7em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2.5px) rotate(-2deg)}}',

      '#dsh-theme-ambient .sta-petals{position:absolute;inset:0;z-index:7;pointer-events:none}',
      '#dsh-theme-ambient .sta-petal{position:absolute;top:-1em;border-radius:60% 40% 55% 45%/60% 55% 45% 40%;',
      'background:linear-gradient(135deg,#F9A8C8 0%,#E88BB0 55%,#CF6B96 100%);opacity:.9;animation:dsh-amb-fall linear infinite}',
      /* Distances are measured against the BAND the seat occupies, not the viewport.
         `vh` units were fine when the seat filled the column; in a band they carried
         petals and bubbles straight past its bottom edge, where `overflow:hidden`
         removed them mid-flight. The band is roughly a third of the viewport, so
         these values cover it with a little margin. */
      '@keyframes dsh-amb-fall{0%{transform:translate(0,-1em) rotate(0);opacity:0}8%{opacity:.9}',
      '35%{transform:translate(-1.5em,10em) rotate(140deg)}70%{transform:translate(1.1em,20em) rotate(280deg)}',
      '100%{transform:translate(-.6em,30em) rotate(380deg);opacity:0}}',

      /* ── 梦海游鱼 ─────────────────────────────────────────────────────── */
      '#dsh-theme-ambient .dof-glow{position:absolute;inset:0;z-index:2}',
      '#dsh-theme-ambient .dof-corner{position:absolute;top:0;left:-30%;width:150%;height:40%;',
      'background:radial-gradient(ellipse at 32% 50%,rgba(255,255,255,.55),rgba(255,255,255,0) 62%);',
      'filter:blur(12px);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'animation:dsh-amb-wash 18s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-wash{position:absolute;left:-20%;width:140%;height:30%;filter:blur(12px);opacity:.5;',
      'background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);',
      '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'animation:dsh-amb-wash 24s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-wash-1{top:14%}',
      '#dsh-theme-ambient .dof-wash-2{top:34%;opacity:.34;animation-duration:31s;animation-delay:-8s}',
      '@keyframes dsh-amb-wash{from{transform:translateX(0)}to{transform:translateX(9%)}}',

      '#dsh-theme-ambient .dof-bubbles{position:absolute;inset:0;z-index:6;pointer-events:none}',
      '#dsh-theme-ambient .dof-bubble{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95),rgba(190,232,246,.55));',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);animation:dsh-amb-rise linear infinite}',
      '@keyframes dsh-amb-rise{0%{transform:translate(0,0) scale(.6);opacity:0}12%{opacity:.85}',
      '55%{transform:translate(1em,-7em) scale(1)}100%{transform:translate(-.6em,-12.5em) scale(.8);opacity:0}}',

      '#dsh-theme-ambient .dof-seaweed{position:absolute;left:0;right:0;bottom:0;height:38%;z-index:5}',
      '#dsh-theme-ambient .dof-seaweed svg{display:block;width:100%;height:100%}',
      '#dsh-theme-ambient .dof-blade{transform-origin:50% 100%;animation:dsh-amb-sway 6s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-blade-2{animation-duration:7.4s;animation-delay:-1.6s}',
      '#dsh-theme-ambient .dof-blade-3{animation-duration:5.2s;animation-delay:-2.8s}',
      '#dsh-theme-ambient .dof-blade-4{animation-duration:8.1s;animation-delay:-.9s}',
      '#dsh-theme-ambient .dof-blade-5{animation-duration:6.6s;animation-delay:-3.4s}',
      '@keyframes dsh-amb-sway{from{transform:rotate(-3.5deg)}to{transform:rotate(3.5deg)}}',
      /* Fish rules for the PREVIEW page, which mounts the scene into a
         `#dsh-theme-ambient` seat rather than the live `.dsh-amb-control-scene`
         box. The live layer styles these classes in its own section above; the
         preview would otherwise draw fish that never mirror, bob or beat their
         tails — a lying preview. */
      '#dsh-theme-ambient .dof-fish{position:absolute;left:0;z-index:6;pointer-events:none;',
      'will-change:transform}',
      '#dsh-theme-ambient .dof-fish svg{display:block;width:100%;height:auto}',
      '#dsh-theme-ambient .dof-fish-flip svg{transform:scaleX(-1)}',
      '#dsh-theme-ambient .dof-fish-bob{animation:dsh-amb-fish-bob 2.4s ease-in-out infinite}',
      '#dsh-theme-ambient .dof-fish-tail{transform-origin:10px 10px;',
      'animation:dsh-amb-fish-tail .9s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-mote{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 34% 30%,#FFFFFF 0%,#D6F1FF 40%,rgba(122,205,255,.5) 72%,rgba(122,205,255,0) 100%);',
      'box-shadow:0 0 10px 3px rgba(122,205,255,.55),0 0 22px 6px rgba(122,205,255,.22);',
      'animation:dsh-amb-mote linear infinite}',

      /* ── 营慕彩云 / 江畔冬云 / 徐山军月 / 佩安杰心 / 光彩凤晨 ─────────────
         The five scenes ported alongside shan and dream. Their element geometry,
         colour and per-element timing are INLINE in the scene builders (same rule
         as shan: a stylesheet that never applies cannot silently collapse them),
         so the only things that must live here are the `@keyframes` — the one
         construct that cannot be expressed inline. Each scene prefixes its own
         keyframe names (ym / jp / xs / pj / gc) so they cannot collide. */
      '@keyframes dsh-amb-ym-star{0%{opacity:.35;transform:scale(1)}100%{opacity:1;transform:scale(1.25)}}',
      '@keyframes dsh-amb-ym-drift{from{transform:translateX(0)}to{transform:translateX(24em)}}',
      '@keyframes dsh-amb-ym-sea{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
      '@keyframes dsh-amb-ym-bob{0%,100%{transform:translateY(0) rotate(-2.5deg)}50%{transform:translateY(-9px) rotate(2.5deg)}}',
      /* The balloons' wide round-trip paths. Deliberately two distinct keyframes, so the
         two never move as a pair: the lower sidebar rows are covered and exposed in turn
         rather than blocked by one stationary balloon.
         The main balloon's loop is (0, +1.5em) → (7em, +0.5em) → back: the START and END
         sit 1.5em below its resting line and the rightmost apex sits 0.5em below it, so the
         path rises while travelling right and falls while returning — up, down, left and
         right — while the apex itself stays exactly where it was accepted.
         EVERY vertical term is at or below the resting baseline (y >= 0), and that is a
         requirement, not taste: the scene box clips at its own top edge (`overflow:hidden`),
         so any stop above y=0 slices the envelope's crown off at the apex, which is the hard
         crop the user reported. */
      '@keyframes dsh-amb-ym-wander{0%{transform:translate(0,1.5em)}50%{transform:translate(7em,0.5em)}100%{transform:translate(0,1.5em)}}',
      '@keyframes dsh-amb-ym-wander-2{0%{transform:translate(0,0)}50%{transform:translate(-5em,1.6em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-jp-cloud{from{transform:translateX(0)}to{transform:translateX(22em)}}',
      '@keyframes dsh-amb-jp-snow{0%{transform:translate(0,-0.5em);opacity:0}8%{opacity:.9}'
        + '50%{transform:translate(0.9em,9em)}92%{opacity:.9}100%{transform:translate(-0.5em,19em);opacity:0}}',
      '@keyframes dsh-amb-jp-ripple{from{transform:translateX(0)}to{transform:translateX(25em)}}',
      '@keyframes dsh-amb-jp-glint{0%{opacity:.25;transform:scale(.8)}100%{opacity:.95;transform:scale(1.3)}}',
      '@keyframes dsh-amb-jp-boat{from{transform:translateX(0)}to{transform:translateX(3em)}}',
      '@keyframes dsh-amb-jp-bob{0%,100%{transform:translateY(0) rotate(-1.2deg)}50%{transform:translateY(-3px) rotate(1.4deg)}}',
      '@keyframes dsh-amb-jp-sway{0%,100%{transform:rotate(0deg)}50%{transform:rotate(3deg)}}',
      '@keyframes dsh-amb-xs-star{0%{opacity:.3;transform:scale(.85)}100%{opacity:1;transform:scale(1.25)}}',
      '@keyframes dsh-amb-xs-night{from{transform:translateX(0)}to{transform:translateX(26em)}}',
      '@keyframes dsh-amb-xs-meteor{0%{transform:rotate(-32deg) translateX(0);opacity:0}3%{opacity:1}'
        + '9%{transform:rotate(-32deg) translateX(-9em);opacity:0}'
        + '100%{transform:rotate(-32deg) translateX(-9em);opacity:0}}',
      '@keyframes dsh-amb-pj-smoke{0%{stroke-dashoffset:90;opacity:0}12%{opacity:.7}70%{opacity:.45}'
        + '100%{stroke-dashoffset:-20;opacity:0}}',
      '@keyframes dsh-amb-pj-dust{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}'
        + '55%{transform:translate(-0.6em,-1.9em);opacity:.5}100%{transform:translate(0.5em,-4em);opacity:0}}',
      '@keyframes dsh-amb-gc-ray{0%{transform:translateY(-40%);opacity:.3}50%{transform:translateY(30%);opacity:.8}'
        + '100%{transform:translateY(90%);opacity:.3}}',
      '@keyframes dsh-amb-gc-feather{0%{transform:translate(0,0) rotate(0deg);opacity:0}10%{opacity:.85}'
        + '25%{transform:translate(1.9em,6em) rotate(95deg)}50%{transform:translate(-1.9em,13em) rotate(190deg);opacity:.85}'
        + '75%{transform:translate(1.9em,20em) rotate(285deg)}90%{opacity:.8}'
        + '100%{transform:translate(0,26em) rotate(380deg);opacity:0}}',
      '@keyframes dsh-amb-gc-fly{0%{transform:translate(-11em,0.6em) scaleX(1);opacity:0}6%{opacity:.95}'
        + '40%{transform:translate(-3em,-1.1em) scaleX(1);opacity:.95}'
        + '46%{transform:translate(2.5em,-0.5em) scaleX(1);opacity:.85}'
        + '50%{transform:translate(9em,0) scaleX(1);opacity:0}'
        + '50.1%{transform:translate(9em,0) scaleX(-1);opacity:0}'
        + '56%{transform:translate(2.5em,-0.6em) scaleX(-1);opacity:.9}'
        + '90%{transform:translate(-9em,0.4em) scaleX(-1);opacity:.6}'
        + '96%{transform:translate(-11em,0.7em) scaleX(-1);opacity:0}'
        + '96.1%{transform:translate(-11em,0.7em) scaleX(1);opacity:0}'
        + '100%{transform:translate(-11em,0.6em) scaleX(1);opacity:0}}',
      '@keyframes dsh-amb-gc-bob{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-5px) rotate(-1.5deg)}}',
      '@keyframes dsh-amb-gc-wing{0%{transform:rotate(0deg)}40%{transform:rotate(-3.5deg)}60%{transform:rotate(2.5deg)}100%{transform:rotate(0deg)}}',
      '@keyframes dsh-amb-gc-dew{0%{opacity:.3;transform:scale(1)}100%{opacity:1;transform:scale(1.5)}}',

      /* ── 琥珀猫咪 / 虎子阿黄（原创宠物场景）──────────────────────────────
         Like the five ported scenes above: element geometry, colour and
         per-element timing are INLINE in the scene builders, so only the
         @keyframes live here — each prefixed (hm / hz) so they cannot collide,
         and each defined exactly once (a duplicate would silently win). Every
         animated vertical term stays at or below the resting baseline, because
         the scene box clips at its own top edge. */
      '@keyframes dsh-amb-hm-glow{from{opacity:.55}to{opacity:.85}}',
      '@keyframes dsh-amb-hm-dust{0%{transform:translate(0,0);opacity:0}12%{opacity:.9}'
        + '60%{transform:translate(-.5em,-3.2em);opacity:.45}100%{transform:translate(.4em,-4.6em);opacity:0}}',
      '@keyframes dsh-amb-hm-tail{from{transform:rotate(-3deg)}to{transform:rotate(5deg)}}',
      '@keyframes dsh-amb-hm-breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.03)}}',
      '@keyframes dsh-amb-hm-ear{0%,86%,100%{transform:rotate(0)}90%{transform:rotate(-9deg)}94%{transform:rotate(4deg)}}',
      '@keyframes dsh-amb-hm-zzz{0%{transform:translate(0,0);opacity:0}18%{opacity:.85}'
        + '100%{transform:translate(1.2em,-2.6em);opacity:0}}',
      '@keyframes dsh-amb-hz-glow{from{opacity:.45}to{opacity:.75}}',
      /* The fluff crosses the whole band and dies at the far edge; its vertical
         wobble stays within ±1.2em so a low-seeded puff never reaches the clip. */
      '@keyframes dsh-amb-hz-fluff{0%{transform:translate(0,0);opacity:0}7%{opacity:.95}'
        + '30%{transform:translate(8em,-1.2em)}55%{transform:translate(14em,.7em)}'
        + '80%{transform:translate(20em,-.9em);opacity:.75}96%{opacity:.4}'
        + '100%{transform:translate(26em,0);opacity:0}}',
      '@keyframes dsh-amb-hz-wag{from{transform:rotate(-9deg)}to{transform:rotate(11deg)}}',
      '@keyframes dsh-amb-hz-grass{from{transform:rotate(-2.2deg)}to{transform:rotate(2.6deg)}}',
      '@keyframes dsh-amb-hz-tilt{0%,40%,100%{transform:rotate(0)}55%{transform:rotate(2.4deg)}75%{transform:rotate(-1.4deg)}}',

      /* Respect a user who has asked the system for less motion: the scenery
         stays, the movement does not. */
      '@media (prefers-reduced-motion:reduce){#dsh-theme-ambient *{animation:none!important}}',
    ].join('\n')

    /** Gallery page copy. */
    const zh = {
      title: '主题皮肤',
      hint: '点一下即切换，选中会记入设置',
      count: '{count} 款皮肤（另有内置浅色/深色、宠物挂件与心情问候四张卡）',
      current: '当前',
      applied: '已应用',
      petOn: '已开启',
      petOff: '已关闭',
      empty: '正在读取官方主题注册表…',
      // The diagnostics below the cards are a FEATURE — a live reading of the active skin —
      // and a wall of monospace text reads as a fault unless the panel says otherwise.
      diagNote: '以下为有意设计的诊断信息，便于直观查看皮肤的实时运行状态，并非系统报错；'
        + '带 ⚠ 的行才表示装饰未生效',
    }
    const en = {
      title: 'Theme skins',
      hint: 'Click to switch; the choice is remembered',
      count: '{count} skins (+ built-in light/dark, the pet-widget card and the mood-greeting card)',
      current: 'Current',
      applied: 'Applied',
      petOn: 'On',
      petOff: 'Off',
      empty: 'Reading the theme registry…',
      diagNote: 'The lines below are intentional diagnostics of the live skin state, '
        + 'not an error report; only lines starting with ⚠ mean the scenery is not working',
    }

    /**
     * Lighten a colour toward white by an alpha.
     *
     * Done in JS rather than CSS `color-mix` so the value needs no support check
     * and the same string is available without reading computed styles.
     * @param hex - `#rrggbb` or `#rgb`.
     * @param alpha - 0..1: how much of the original colour survives over white.
     * @returns an `rgb()` string, or the input when it is not a hex colour.
     */
    function lighten(hex, alpha) {
      const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim())
      if (m === null) return String(hex)
      let h = m[1]
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      const mix = (c) => Math.round(255 - (255 - c) * alpha)
      return `rgb(${mix(parseInt(h.slice(0, 2), 16))},${mix(parseInt(h.slice(2, 4), 16))},${mix(parseInt(h.slice(4, 6), 16))})`
    }

    /** The gallery page's stylesheet, installed once and owned by this plugin. */
    const PAGE_CSS = [
      '.tg-page{padding:20px 24px;display:flex;flex-direction:column;gap:16px;height:100%;overflow:auto}',
      '.tg-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
      '.tg-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.tg-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.tg-debug{font:11px/1.6 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-tertiary);',
      'background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l3);',
      'border-radius:8px;padding:8px 10px;word-break:break-all}',
      '.tg-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}',
      /* The diagnostics live BELOW the cards, set apart by their own margin and a divider,
         so they read as a separate reference block rather than as part of the picker — and
         so the picker itself stays the first thing the eye lands on. */
      '.tg-diag{margin-top:14px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l2);',
      'display:flex;flex-direction:column;gap:10px}',
      '.tg-diag-note{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
      '.tg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}',
      '.tg-card{display:flex;flex-direction:column;gap:8px;padding:12px;text-align:left;cursor:pointer;',
      'background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);',
      'border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;font:inherit;transition:border-color .15s,background .15s}',
      '.tg-card:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.tg-card[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);',
      'box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}',
      '.tg-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.tg-name{font-size:13.5px;font-weight:600}',
      '.tg-badge{font-size:11px;padding:1px 7px;border-radius:999px;',
      'background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}',
      '.tg-desc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5}',
      '.tg-strip{display:flex;height:6px;border-radius:999px;overflow:hidden;border:.5px solid var(--dsw-alias-border-l3)}',
      '.tg-strip span{flex:1}',
      /* ── the PALETTE PICKER card (15 clickable colour buttons) ────────────────
         ** 这些色格里的颜色全部来自「中国传统色库」项目（chinese-colors）**
            https://github.com/zerosoul/chinese-colors
            作者 tristan（GitHub @zerosoul）｜在线手册 https://colors.ichuantong.cn ｜许可 ISC
            取色表见 lib/palette-schemes.json（每套都带 source = 该库的「组 + id」）。
            色名与色值是作者整理的开源成果，本插件只做取色与派生 —— **感谢作者 tristan**。

         Three rows of 16px keep the picker within a few px of a strip card that
         carries a two-line description, so it does not sit visibly short in the
         grid. Each slot carries its own hairline: the pale schemes are near-white,
         and against a white card in the official LIGHT appearance a borderless
         swatch would simply vanish. `--dsw-alias-border-l3` adapts to both. */
      '.tg-picker{display:flex;flex-direction:column;gap:3px}',
      '.tg-pickrow{display:flex;gap:3px;height:16px}',
      /* 卡片本体也可点（= 用亮着的那一格），所以要给出"可点"的手势提示 —— 它是一个 div，
         浏览器不会自带 cursor:pointer。 */
      '.tg-picker-card{cursor:pointer}',
      /* 色格本体做成 flex 行：里面的色带按 `flex-grow` 分宽度（主色 2、次色各 1）。 */
      '.tg-swatch{flex:1;min-width:0;padding:0;background:none;cursor:pointer;position:relative;',
      'display:flex;border:.5px solid var(--dsw-alias-border-l3);border-radius:3px;font:inherit}',
      '.tg-swatch[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);',
      'box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}',
      '.tg-swatch:focus-visible{outline:1.5px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      /* 一条色带。宽度由内联的 `flex-grow` 决定（纯色格是"一条带占满"的特例），
         左右两端的圆角靠 `:first-child` / `:last-child` 补 —— 色格自己没有 overflow:hidden
         （那会把悬停标签裁掉）。 */
      '.tg-band{display:block;height:100%;min-width:0}',
      '.tg-band:first-child{border-radius:2px 0 0 2px}',
      '.tg-band:last-child{border-radius:0 2px 2px 0}',
      '.tg-band:only-child{border-radius:2px}',
      /* ── THE HOVER NAME (user's request: no layout change, name on hover) ──────
         15 slots at ~34px wide cannot carry a legible name, and adding a name line
         would change the card's height — so the name appears ONLY while the pointer
         is on that slot, as an absolutely positioned chip (out of flow: nothing in
         the card moves by a single pixel).

         Note `.tg-swatch` deliberately has NO `overflow:hidden`: it would clip this
         chip. The rounded corners are kept by rounding the CHILDREN (`.tg-band`)
         instead, which is what the clipping was for. */
      '.tg-swatch:hover::after,.tg-swatch:focus-visible::after{content:attr(data-name);',
      'position:absolute;left:50%;bottom:calc(100% + 5px);transform:translateX(-50%);',
      'white-space:nowrap;z-index:5;pointer-events:none;padding:2px 6px;border-radius:4px;',
      'font-size:11px;line-height:1.3;background:var(--dsw-alias-bg-base);',
      'color:var(--dsw-alias-label-primary);border:.5px solid var(--dsw-alias-border-l3);',
      'box-shadow:0 2px 8px rgba(0,0,0,.18)}',
      /* ── the PET-FAMILY card (宠物挂件 · 七只小伙伴) ────────────────────────
         卡面放标题、状态徽标、当前宠物与道具的图案，再加一行 7 颗头像（`petPickerElement`）
         —— description 只作 tooltip（与配色卡同一条"不渲染 desc"分支）。卡身是 div
         （内含头像按钮，button 套 button 非法）：点卡身 = 开关挂件，点头像 = 换宠物。 */
      '.tg-pet-card{justify-content:space-between}',
      '.tg-pet-body{display:flex;flex-direction:column;gap:6px}',
      '.tg-pet-art{display:flex;align-items:flex-end;gap:14px;padding:6px 2px 2px;min-height:48px}',
      '.tg-pet-art svg{display:block}',
      '.tg-petrow{display:flex;gap:6px;flex-wrap:wrap;padding:2px}',
      '.tg-petswatch{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;'
        + 'padding:2px;border:none;border-radius:9px;cursor:pointer;background:var(--dsw-alias-bg-layer-2)}',
      '.tg-petswatch:hover{background:var(--dsw-alias-bg-layer-3)}',
      '.tg-petswatch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}',
      '.tg-petswatch[aria-pressed="true"]{background:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px var(--dsw-alias-state-business-primary) inset}',
      '.tg-petswatch svg{display:block}',
      /* 挂件"关着"的徽标：中性色，与亮着的"已应用"/"已开启"品牌徽标区分开。 */
      '.tg-badge-off{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary)}',
      /* ── 心情问候卡：胶囊开关 + 三组设置 chips ───────────────────────────
         卡身是 div（内含按钮），点卡身与点开关等效（toggleMood）；
         chip 点亮态走品牌 token，与头像选择行同一视觉语言。 */
      '.tg-mood-body{display:flex;flex-direction:column;gap:8px;padding:4px 2px 2px}',
      '.tg-mood-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '.tg-mood-row-label{flex:none;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      /* ── 心情问候卡（用户二轮返工重设计）：分段选择器（segmented）替代散排 pill——
         一组内相连、共享圆角、选中段"浮起"，视觉整齐得多；区域四档放不下一行，用 2×2 网格。 */
      '.tg-mood-body{display:flex;flex-direction:column;gap:10px;padding:4px 2px 2px}',
      '.tg-mood-row{display:flex;align-items:center;gap:8px}',
      '.tg-mood-row-label{flex:none;width:26px;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      /* 胶囊开关（一轮返工的版本保留）：胶囊与文字分离，圆球滑块滑到端点。 */
      '.tg-mood-switch{display:inline-flex;align-items:center;gap:8px;height:24px;border:none;'
        + 'background:none;padding:0;cursor:pointer;font:inherit;font-size:12px;'
        + 'color:var(--dsw-alias-label-secondary)}',
      '.tg-mood-pill{position:relative;flex:none;width:40px;height:22px;border-radius:999px;'
        + 'background:var(--dsw-alias-bg-layer-3);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l3);'
        + 'transition:background .18s var(--ds-ease-in-out)}',
      '.tg-mood-pill::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;'
        + 'border-radius:50%;background:var(--dsw-alias-label-primary);'
        + 'box-shadow:0 1px 3px rgba(0,0,0,.2);transition:transform .18s var(--ds-ease-in-out)}',
      '.tg-mood-switch[aria-checked="true"] .tg-mood-pill{background:var(--dsw-alias-state-business-primary);'
        + 'box-shadow:none}',
      '.tg-mood-switch[aria-checked="true"] .tg-mood-pill::after{transform:translateX(18px);background:#fff}',
      '.tg-mood-switch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);'
        + 'outline-offset:2px;border-radius:12px}',
      /* 分段选择器：槽用 layer-3，选中段是浮起的"卡片底"小块 + 主文字色。 */
      '.tg-mood-seg{flex:1;display:inline-flex;gap:2px;background:var(--dsw-alias-bg-layer-3);'
        + 'border-radius:9px;padding:2px;box-sizing:border-box}',
      '.tg-mood-zone{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:2px;'
        + 'background:var(--dsw-alias-bg-layer-3);border-radius:9px;padding:2px;box-sizing:border-box}',
      '.tg-mood-chip{height:20px;padding:0 6px;border:none;border-radius:7px;background:none;'
        + 'color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer;'
        + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tg-mood-seg .tg-mood-chip{flex:1;min-width:0}',
      '.tg-mood-chip:hover{color:var(--dsw-alias-label-secondary)}',
      '.tg-mood-chip[aria-pressed="true"]{background:var(--dsw-alias-bg-base);'
        + 'color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgba(0,0,0,.12)}',
      '.tg-mood-chip:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}',
    ].join('')

    /**
     * Mirror the registry into the page's store.
     *
     * Same shape as the official settings-store.ts, including why it passes no
     * explicit type arguments: the generics settle from `init` plus the untyped
     * draft parameter in one inference round.
     * @returns store handle used as the page registration's `store` seat.
     */
    function createGalleryStore() {
      return defineStore({
        init: () => ({
          ids: [], labels: {}, descriptions: {}, swatches: {}, cardRows: {},
          scheme: '', selected: 'system', status: '', revision: -1,
          petEnabled: false, petKind: 'ban-ban',
          moodOn: true, moodSpeed: 'medium', moodDirection: 'ltr', moodZone: 'center',
        }),
        actions: {
          sync: (draft, themes, selected, revision) => {
            if (revision <= draft.revision) return
            const labels = {}
            const descriptions = {}
            const swatches = {}
            const cardRows = {}
            for (const theme of themes) {
              // Built-in themes carry no label — the official Appearance row
              // localizes them from its own dictionaries — so name them here
              // rather than showing a bare `light` / `dark` id.
              labels[theme.id] = theme.label || BUILT_IN_LABELS[theme.id] || theme.id
              // A built-in theme derives its colours from the base palette rather than
              // declaring tokens, so its card gets a plain line — and it carries no
              // description of its own, so the copy for the built-in cards is the
              // gallery's own (`BUILT_IN_DESCRIPTIONS`).
              descriptions[theme.id] = theme.description || BUILT_IN_DESCRIPTIONS[theme.id] || ''
              // A card's colour strip comes from the theme's own tokens, so a
              // theme authored anywhere shows its identity without extra metadata.
              const tokens = theme.tokens || {}
              const pick = (name) => {
                const value = tokens[name]
                if (value === undefined || value === null) return undefined
                return typeof value === 'string' ? value : value[theme.colorScheme]
              }
              swatches[theme.id] = [
                pick('--dsw-alias-brand-primary'),
                pick('--dsw-alias-label-secondary'),
                pick('--dsw-alias-state-business-primary'),
              ].filter((value) => typeof value === 'string' && value !== '')
              // A palette-shaped skin can replace the strip with the palette picker
              // (`card.rows`). Absent — which is every scene-carrying skin and both
              // built-in cards — the strip above stays exactly as it was.
              const rows = cardRowShape(theme, PALETTE_SCHEMES)
              if (rows !== undefined) cardRows[theme.id] = rows
            }
            draft.ids = themes.map((theme) => theme.id)
            draft.labels = labels
            draft.descriptions = descriptions
            draft.swatches = swatches
            draft.cardRows = cardRows
            draft.selected = selected
            draft.revision = revision
          },
          /**
           * Record why the page has nothing to show.
           *
           * An empty picker is indistinguishable from a broken picker without
           * this, and the boot screen only ever says "failed" — never why.
           * @param draft - store draft.
           * @param status - one line describing the state.
           */
          note: (draft, status) => { draft.status = status },
          /**
           * 记住配色卡上点亮的是哪一格。
           *
           * 与主题列表分开放：方案 id 不是主题，混进 `ids` 会让"皮肤数"的计数口径
           * 与 README、与 npm 描述一起失真。
           * @param draft - store draft.
           * @param id - the scheme id.
           */
          markScheme: (draft, id) => { draft.scheme = String(id) },
          /**
           * 记录宠物挂件的开与关，给挂件卡的徽标与 aria-pressed 用。
           *
           * 与 `markScheme` 同一条理由：挂件状态不是主题，混进主题列表会让计数口径失真，
           * 所以单独放一个字段，由 `publish()` 从 localStorage 读出后写进来。
           * @param draft - store draft。
           * @param on - 挂件是否已开启。
           */
          markPet: (draft, on) => { draft.petEnabled = on === true },
          /**
           * 记住挂件当前是哪只宠物（头像选择行的点亮态与卡面图案都读它）。
           *
           * 与 `markPet` 同一条理由：宠物选择不是主题，单独一个字段，由 `publish()`
           * 从 localStorage 读出后写进来。**测试桩的 action 表必须跟着长**（规则 8：
           * 桩少一个 action，publish 就抛错、整个挂载被 guard 拦下）。
           * @param draft - store 草稿。
           * @param id - 宠物 id（PET_KINDS 之一）。
           */
          markPetKind: (draft, id) => { draft.petKind = String(id) },
          /**
           * 记录心情问候的开关与三组设置（速度/方向/区域），给第 14 张卡的
           * 胶囊开关、chip 点亮态与 aria-pressed 用。
           *
           * 与 `markPet` 同一条理由：问候状态不是主题，单独字段，由 `publish()`
           * 从 localStorage 读出后写进来。**测试桩的 action 表必须跟着长**（规则 8）。
           * @param draft - store 草稿。
           * @param state - `readMoodState()` 的消毒结果。
           */
          markMood: (draft, state) => {
            draft.moodOn = state.on === true
            draft.moodSpeed = String(state.speed)
            draft.moodDirection = String(state.direction)
            draft.moodZone = String(state.zone)
          },
        },
      })
    }

    /**
     * Render one palette slot: a button that applies a colour scheme.
     *
     * ── 拼色格的画法：按**宽度比例**分带（不再用"底 + 圆点"）──────────────────────
     *
     * 用户要的：拼色不要点子，改成把色块**按宽度分份** —— 主色占 2 份、每个次色各占 1 份。
     * 于是 2/1 就是"一主一次"、2/1/1 就是"一主两次"；而当前 5 套拼色都是"一主四次"
     * （`dots` 各有 4 个），画出来自然是 2/1/1/1/1 —— **比值由数据算出来，不是写死的**。
     * 纯色格是同一机制的退化情况（一条带占满整格），所以两类格子共用一套 DOM 与样式，
     * 不会出现"两种格子两套画法"的漂移。
     *
     * 画出来的颜色与实际点击后生效的颜色来自**同一张表**，所以按钮不可能宣传一个
     * 方案根本没画的颜色。
     * @param scheme - one entry from `lib/palette-schemes.json`.
     * @param selected - whether this scheme is the one in effect.
     * @param onPick - called with the scheme id.
     * @param index - React key.
     * @returns the swatch button.
     */
    function schemeSwatch(scheme, selected, onPick, index) {
      const accents = Array.isArray(scheme.dots) ? scheme.dots : []
      const bands = scheme.kind === 'clash'
        ? [[scheme.main, 2]].concat(accents.map((colour) => [colour, 1]))
        : [[scheme.main, 1]]
      const inner = bands.map(([colour, weight], band) => jsx('span', {
        className: 'tg-band',
        style: { background: colour, flexGrow: weight },
      }, band))
      return jsx('button', {
        type: 'button',
        className: 'tg-swatch',
        'aria-pressed': selected,
        // 悬停/聚焦时显示的色名（CSS `content:attr(data-name)`，不改布局）。
        'data-name': scheme.label,
        // The label is the only text a picker slot carries; the full provenance
        // (which colour-library entry it came from) lives in the tooltip.
        title: scheme.source === undefined ? scheme.label : `${scheme.label} · ${scheme.source}`,
        onClick: (event) => {
          // ── 必须拦住冒泡 ──────────────────────────────────────────────────────
          //
          // 卡片本体也处理点击（用它记住的那一格）。不拦的话，点子格会先切到那一格，
          // 紧接着冒泡到卡片的处理器、被覆盖回原来那格 —— 症状就是"点色块没反应"。
          // 事件参数在测试里可能缺省，所以要容错（jsx 桩调用处理器时不给事件）。
          if (event !== undefined && typeof event.stopPropagation === 'function') event.stopPropagation()
          onPick(scheme.id)
        },
        children: inner,
      }, index)
    }

    /**
     * Render the palette-picker card's three rows of slots.
     * @param rows - rows sanitised by {@link cardRowShape}.
     * @param selectedScheme - the scheme id currently in effect, if any.
     * @param onPick - called with the scheme id.
     * @param schemes - the palette table.
     * @returns the picker element.
     */
    function cardPickerElement(rows, selectedScheme, onPick, schemes) {
      return jsx('span', {
        className: 'tg-picker',
        children: rows.map((row, index) => jsx('span', {
          className: 'tg-pickrow',
          children: row.schemes.map((id, slot) => {
            const scheme = schemeById(id, schemes)
            // `cardRowShape` already proved every id resolves; the guard is here so a
            // table that changed between sanitising and rendering can only drop a
            // slot, never throw inside the render and blank the panel.
            if (scheme === undefined) return null
            return schemeSwatch(scheme, id === selectedScheme, onPick, slot)
          }),
        }, index)),
      })
    }

    /**
     * 挂件卡面上的当前宠物与它的道具（静态装饰，markup 与运行时舞台同源 —— 都出自
     * PET_KINDS 注册表，结构上不可能漂移）。
     *
     * 卡面在面板里由 jsx 渲染，HTML 经 React 的正规注入通道 dangerouslySetInnerHTML
     * 进来：内容是插件自己的静态注册表字符串，没有任何用户输入，注入面为零。
     * @param kindId - 当前宠物 id（store 里的 petKind）。
     * @returns 卡面图案。
     */
    function petCardSceneHTML(kindId) {
      const kind = petKindById(kindId)
      // 卡面图案与舞台同源同比例：舞台显示尺寸（已含 PET_SCALE）再缩到 0.72。
      // 道具缩 0.9 与舞台一致 —— 卡面是舞台的缩影，不是注册表的直译。
      const scale = 0.72
      const pet = `<svg viewBox="${kind.viewBox}" width="${Math.round(petDisplaySize(kind).w * scale)}"`
        + ` height="${Math.round(petDisplaySize(kind).h * scale)}" aria-hidden="true">${kind.art.side}</svg>`
      const prop = `<svg viewBox="${kind.propViewBox}" width="${Math.round(petPropDisplaySize(kind).w * 0.9)}"`
        + ` height="${Math.round(petPropDisplaySize(kind).h * 0.9)}" aria-hidden="true">${kind.propArt}</svg>`
      return pet + prop
    }

    /** 卡面图案的元素形态（排版交给 .tg-pet-art 的 flex）。 */
    function petCardArt(kindId) {
      return jsx('span', {
        className: 'tg-pet-art',
        dangerouslySetInnerHTML: { __html: petCardSceneHTML(kindId) },
      })
    }

    /** 头像素描（选择行里那颗小圆头像）。 */
    function petFaceHTML(kind, edge) {
      return `<svg viewBox="${kind.faceViewBox}" width="${edge}" height="${edge}" aria-hidden="true">${kind.faceArt}</svg>`
    }

    /**
     * 挂件卡上的头像选择行：每只宠物一颗头（7 个 button，绝不能套进 button 卡身 ——
     * 所以挂件卡的卡身是 div，与配色卡同一条规则）。
     * @param selectedKind - 当前宠物 id（点亮那一颗）。
     * @param onPick - 点头像的回调（参数是宠物 id）。
     * @returns 选择行元素。
     */
    function petPickerElement(selectedKind, onPick) {
      return jsx('span', {
        className: 'tg-petrow',
        children: PET_KINDS.map((kind, index) => jsx('button', {
          type: 'button',
          className: 'tg-petswatch',
          'aria-pressed': kind.id === selectedKind,
          title: `${kind.home} · ${kind.species}`,
          // 与配色格同一条规矩：必须拦冒泡，否则"点了头像"先执行、随后被卡身的
          // 开关处理器覆盖回去（配色卡踩过的坑，见 schemeSwatch 的注释）。
          onClick: (event) => {
            if (event !== undefined && typeof event.stopPropagation === 'function') event.stopPropagation()
            onPick(kind.id)
          },
          dangerouslySetInnerHTML: { __html: petFaceHTML(kind, 26) },
        }, index)),
      })
    }

    /** 方向的两档文案（卡面 chips 与自检行共用）。 */
    const MOOD_DIR_LABELS = { ltr: '自左至右', rtl: '自右至左' }

    /**
     * 心情问候卡的卡面控件：胶囊开关（role="switch"）+ 三组设置 chips。
     *
     * ── 为什么点什么都必须拦冒泡 ─────────────────────────────────────────────
     *
     * 卡身自己的 onClick = 开关问候；不拦冒泡的话，"点慢速"会先写速度、随后被
     * 卡身的开关处理器覆盖成一次 toggle —— 配色卡色格踩过的同一个坑
     * （schemeSwatch 注释里的原话）。事件参数要容错：jsx 桩调用处理器时不给事件。
     * @param props - `{ mood, onToggleMood, onSetMood, t }`：消毒后的状态、开关回调、
     *                设置回调、字典（取 已开启/已关闭 文案）。
     * @returns 卡面控件元素。
     */
    function moodControlsElement({ mood, onToggleMood, onSetMood, dict }) {
      const swallowEvent = (event) => {
        if (event !== undefined && typeof event.stopPropagation === 'function') event.stopPropagation()
      }
      const chip = (label, pressed, title, onPick) => jsx('button', {
        type: 'button',
        className: 'tg-mood-chip',
        'aria-pressed': pressed,
        title,
        onClick: (event) => { swallowEvent(event); onPick() },
        children: label,
      })
      return jsxs('div', {
        className: 'tg-mood-body',
        children: [
          jsxs('div', {
            className: 'tg-mood-row',
            children: [
              // 胶囊（圆球滑块）+ 状态文字分离 —— 用户返工：去掉「标题栏问候」、
              // 胶囊两端全半圆、开/关时圆球滑到一侧顶端。
              jsxs('button', {
                type: 'button',
                className: 'tg-mood-switch',
                role: 'switch',
                'aria-checked': mood.on,
                title: '开或关标题栏的滚动问候（与点卡身等效）',
                onClick: (event) => { swallowEvent(event); onToggleMood() },
                children: [
                  jsx('span', { className: 'tg-mood-pill', 'aria-hidden': 'true' }),
                  jsx('span', { className: 'tg-mood-state', children: mood.on ? dict('petOn') : dict('petOff') }),
                ],
              }),
            ],
          }),
          jsx('div', {
            className: 'tg-mood-row',
            children: [
              jsx('span', { className: 'tg-mood-row-label', children: '速度' }),
              jsx('span', {
                className: 'tg-mood-seg',
                children: Object.keys(MOOD_SPEEDS).map((id) => chip(
                  MOOD_SPEED_LABELS[id],
                  mood.speed === id,
                  `滚动速度：${MOOD_SPEED_LABELS[id]}`,
                  () => { onSetMood({ speed: id }) },
                )),
              }),
            ],
          }),
          jsx('div', {
            className: 'tg-mood-row',
            children: [
              jsx('span', { className: 'tg-mood-row-label', children: '方向' }),
              jsx('span', {
                className: 'tg-mood-seg',
                children: Object.keys(MOOD_DIR_LABELS).map((id) => chip(
                  MOOD_DIR_LABELS[id],
                  mood.direction === id,
                  `滚动方向：${MOOD_DIR_LABELS[id]}`,
                  () => { onSetMood({ direction: id }) },
                )),
              }),
            ],
          }),
          jsx('div', {
            className: 'tg-mood-row',
            children: [
              jsx('span', { className: 'tg-mood-row-label', children: '区域' }),
              // 四档一行放不下（卡片 ~217px）：2×2 网格，选中态与分段选择器同一语言。
              jsx('span', {
                className: 'tg-mood-zone',
                children: Object.keys(MOOD_ZONE_GEOMETRY).map((id) => chip(
                  MOOD_ZONE_LABELS[id],
                  mood.zone === id,
                  `位置区域：${MOOD_ZONE_LABELS[id]}`,
                  () => { onSetMood({ zone: id }) },
                )),
              }),
            ],
          }),
        ],
      })
    }

    /**
     * Render one card.
     *
     * Four layouts share the card: the default token strip, the palette picker (a
     * theme that declares `card.rows`), the pet-widget toggle card, and — for the
     * picker and the widget — no description body. The description still becomes
     * the tooltip (`title`), which is what the schema says the field is for.
     *
     * The pet-widget card is NOT a theme: clicking it never touches the theme
     * service, it toggles the widget (`onTogglePet`), and its badge shows the
     * widget's on/off state instead of "applied". Like the picker flag, the
     * widget flag is read off the DATA (the id table), never off a rendered
     * element — the jsx stub returns null while React returns elements, so an
     * element-identity test silently takes the wrong branch in every test.
     *
     * A picker card is a `div`, not a `button`: it CONTAINS 15 buttons, and nesting
     * buttons inside a button is invalid markup that browsers silently re-parent.
     * The pet-family card is a `div` for the same reason (7 portrait buttons).
     * @param props - id, label, description, swatches, rows, selected, applied,
     *                selectedScheme, onSelect, onPickScheme, onTogglePet, petEnabled,
     *                petKind, onPickPet, t.
     * @returns the card element.
     */
    function ThemeCard(props) {
      const {
        id, label, description, swatches, rows, selected, applied,
        selectedScheme, onSelect, onPickScheme, onTogglePet, petEnabled, petKind, onPickPet,
        mood, onToggleMood, onSetMood, t,
      } = props
      const isWidget = id === PET_WIDGET.id
      const isMood = id === MOOD_WIDGET.id
      // ── WHY THE FLAG, AND NOT `blocks !== null` ──────────────────────────────
      //
      // Whether this card is a picker has to be read off the DATA, not off the rendered
      // element. `jsx()` returns a real element in React but `null` under this
      // repository's jsx stub, so an element-identity test silently takes the STRIP
      // branch in every test while being correct in the app — a stub that does not
      // reproduce the runtime's return value is the same trap rule 8 records for
      // missing side effects.
      //
      // The flag comes from re-running the sanitiser rather than from a bare
      // `rows !== undefined`, so a component never trusts its inputs: whatever ends up
      // in the store, the card either draws a valid picker or falls back to the strip.
      // Handing malformed rows to the picker would throw inside the render and blank
      // the whole panel — the silent-failure shape this project keeps paying for.
      const shape = cardRowShape({ card: { rows } }, PALETTE_SCHEMES)
      const hasPicker = shape !== undefined
      // 挂件/问候卡的徽标永远在场（它就是"开关状态"的读数）；其余卡保持原样：选中才亮。
      const badgeText = (isWidget || isMood)
        ? ((isWidget ? petEnabled === true : mood?.on === true) ? t('petOn') : t('petOff'))
        : applied
      const head = jsxs('div', {
        className: 'tg-card-top',
        children: [
          jsx('span', { className: 'tg-name', children: label || id }),
          (selected || isWidget || isMood)
            ? jsx('span', {
              className: (isWidget && petEnabled !== true) || (isMood && mood?.on !== true)
                ? 'tg-badge tg-badge-off'
                : 'tg-badge',
              children: badgeText,
            })
            : null,
        ],
      })
      const body = hasPicker
        ? cardPickerElement(shape, selectedScheme, onPickScheme, PALETTE_SCHEMES)
        : isWidget
          ? jsxs('div', {
            className: 'tg-pet-body',
            children: [
              petCardArt(petKind || DEFAULT_PET_KIND.id),
              petPickerElement(petKind || DEFAULT_PET_KIND.id, onPickPet),
            ],
          })
          : isMood
            ? moodControlsElement({
              mood: {
                on: mood?.on === true,
                speed: mood?.speed ?? 'medium',
                direction: mood?.direction ?? 'ltr',
                zone: mood?.zone ?? 'center',
              },
              onToggleMood,
              onSetMood,
              dict: t,
            })
            : swatches.length > 0
              ? jsx('span', {
                className: 'tg-strip',
                children: swatches.map((colour, index) => jsx('span', { style: { background: colour } }, index)),
              })
              : null
      // The picker fills the card and the widget/mood cards draw their own controls,
      // so none of them prints body copy; `description` stays the tooltip, which is
      // what the schema says the field is for.
      const desc = !hasPicker && !isWidget && !isMood && description
        ? jsx('span', { className: 'tg-desc', children: description })
        : null
      if (hasPicker) {
        return jsxs('div', {
          className: 'tg-card tg-picker-card',
          title: description || label,
          // ── 点卡片本体 = 用"亮着的那一格"──────────────────────────────────────
          //
          // 用户要的：点这张卡要**生效**（换成它的配色），点具体某一格才换成那一格。
          // 亮着的那一格就是记住的那套；从没选过时是 `DEFAULT_SCHEME`（石榴金，
          // 也就是锚主题自己那套）。所以"卡片本体"与"最左那格"最终落到同一件事上，
          // 只是入口不同 —— 用户不必知道这个区别。
          onClick: () => { onPickScheme(selectedScheme || DEFAULT_SCHEME) },
          children: [head, body, desc],
        })
      }
      if (isWidget) {
        // 挂件卡是 div 而不是 button：卡里现在装着 7 颗头像按钮，button 套 button 是
        // 非法标记（浏览器会静默重排），与配色卡同一条规则。点卡身 = 开关挂件，
        // **绝不**调用 setTheme —— 这是它与任何皮肤同时开启的前提；点头像 = 换宠物
        // （selectPetWidget，见挂载体）。开关状态由徽标文字（已开启/已关闭）表达，
        // "选中的是哪只"由头像的 aria-pressed 表达。
        return jsxs('div', {
          className: 'tg-card tg-pet-card',
          onClick: () => { onTogglePet() },
          title: description || label,
          children: [head, body, desc],
        })
      }
      if (isMood) {
        // 心情问候卡与挂件卡同一条规矩：div 卡身（内含胶囊开关与 chips 按钮）、
        // 点卡身 = 开关问候（toggleMood），**绝不**调用 setTheme；开关状态由徽标与
        // 胶囊开关的 aria-checked 表达，三组设置的点亮态由各 chip 的 aria-pressed 表达。
        return jsxs('div', {
          className: 'tg-card tg-mood-card',
          onClick: () => { onToggleMood() },
          title: description || label,
          children: [head, body, desc],
        })
      }
      return jsxs('button', {
        type: 'button',
        className: 'tg-card',
        'aria-pressed': selected,
        onClick: () => { onSelect(id) },
        title: description || label,
        children: [head, body, desc],
      })
    }

    /**
     * Where the debug switch is remembered.
     *
     * A localStorage flag in addition to the URL fragment, because this plugin
     * ships as a package inside the desktop app: there is no address bar to add
     * `#theme-gallery-debug` to, so DevTools is the way in.
     */
    const DEBUG_KEY = 'theme-gallery:debug'

    /**
     * Whether the gallery shows its diagnostic detail lines.
     *
     * The raw readings — token counts, geometry, hit tests, the attempt log — are
     * for whoever is debugging, not for whoever is picking a skin, and this is a
     * shipped package. So they are opt-in, through either switch:
     *
     *   DevTools console:  localStorage.setItem('theme-gallery:debug', '1')
     *   …or a URL with      #theme-gallery-debug
     *   turn it off:       localStorage.removeItem('theme-gallery:debug')
     *
     * The switch gates DETAIL, never bad news: a line that reports a problem prints
     * whether or not it is on (see `sceneryLineIsWarning`), because "没有报错" and
     * "没有观测到报错" have been confused in this project before.
     * @returns true when the detail lines should render.
     */
    function debugEnabled() {
      try {
        if (typeof window !== 'undefined'
          && typeof window.location?.hash === 'string'
          && window.location.hash.includes('theme-gallery-debug')) return true
        return typeof window !== 'undefined' && window.localStorage?.getItem(DEBUG_KEY) === '1'
      } catch {
        return false
      }
    }

    /**
     * Read the theme state straight out of the document.
     *
     * It reads the live DOM rather than the theme service so a divergence between
     * the two becomes visible instead of being assumed away — that divergence is
     * exactly what a broken token or a stylesheet painting over the skin looks
     * like.
     * @param selected - the preference the page is showing as selected.
     * @returns one line describing the chain.
     */
    function themeDiagnostics(selected) {
      try {
        if (typeof document === 'undefined') return 'no document'
        const ctx = window.__DSH_THEME_DEBUG__ ?? {}
        const active = ctx.activeId === undefined ? '?' : String(ctx.activeId)
        const tokens = ctx.activeTokens === undefined ? '?' : String(ctx.activeTokens)
        const body = document.body
        const scheme = body === null ? '?' : (body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light')
        const background = body === null ? '?' : getComputedStyle(body).backgroundColor
        const brand = body === null
              ? '?'
              : getComputedStyle(body).getPropertyValue('--dsw-alias-brand-primary').trim() || '(unset)'
        const sidebar = body === null
              ? '?'
              : getComputedStyle(body).getPropertyValue('--dsw-specific-sidebar-fill').trim() || '(unset)'
        return `诊断 · 选中=${selected} · 服务内活动主题=${active} · 该主题 token=${tokens}`
              + ` · 配色=${scheme} · body 背景=${background}`
              + ` · brand=${brand} · sidebar-fill=${sidebar}`
              + ` · ${describeAccentLayer()}`
              + ` · 装饰=${describeAmbientReport()}`
      } catch (error) {
        return `诊断失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * Whether the scenery the active theme asks for actually reached the document.
     *
     * The plugin cannot see the app's console, and "the scenery did not appear" has
     * several indistinguishable causes. So the panel checks the one thing it can:
     * the active theme declares `ambient`, and the layer is missing, empty, or
     * unstyled. When that happens the reader is owed the reason on screen rather
     * than in a log they would have to know to open.
     * @param selected - the preference the page is showing as selected.
     * @returns a warning line, or null when nothing is wrong.
     */
    function ambientWarning(selected) {
      try {
        const wanted = bundledTheme(selected)?.ambient
        if (wanted === undefined) return null
        const report = ambientReport
        if (report === undefined) return `装饰未同步：syncSkin 尚未运行（期望 ${wanted.kind}）`
        if (report.found === false) return `装饰未生效：${report.note}（期望 ${wanted.kind}）`
        if (report.paintError !== undefined) return `装饰绘制抛错：${report.paintError}`
        if (report.children === 0) return `装饰层已插入但为空（期望 ${wanted.kind}）：未能构建任何节点`
        // The layer deliberately lives on the document body now, so "inside the sidebar
        // column" is no longer a requirement — checking it produced a permanent false
        // alarm and hid the readings that mattered.
        if (report.css !== true) return '样式表未生效：AMBIENT_CSS 不在 document 中'
        if (report.size === '0x0') return `装饰层尺寸为 0：display=${report.display} position=${report.position}`
        if (report.html === '(空)') return '装饰层里没有内容：innerHTML 未被写入'
        if (report.probe === '未建出') return '探针未建出：说明绘制在探针之前就中断了'
        if (report.artSize === '0x0') return '素材高度塌缩为 0：百分比的参照物没有高度'
        return null
      } catch (error) {
        return `装饰自检失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * The one-line scenery status shown on the panel.
     *
     * Deliberately dumb: it prints the report whatever it says. An earlier
     * revision only spoke when a self-check considered something wrong, so a check
     * that PASSED while the scenery was still invisible produced **silence** — the
     * worst possible output for a diagnostic. Keeping the numbers means the reader
     * sees the geometry even when the code's opinion of it is wrong.
     *
     * It was unconditional while the scenery was being brought up; now that the
     * package is public the RENDER SITE decides: routine reports wait for
     * `debugEnabled()`, while warnings and errors always print.
     * @param selected - the preference the page is showing as selected.
     * @returns the line, or null when the active theme asks for no scenery.
     */
    function sceneryLine(selected) {
      try {
        if (bundledTheme(selected)?.ambient === undefined) return null
        const warning = ambientWarning(selected)
        const prefix = warning === null ? '装饰自检通过' : `⚠ ${warning}`
        return `${prefix} · ${describeAmbientReport()}`
      } catch (error) {
        return `装饰自检失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * Whether the scenery line reports a problem rather than a routine pass.
     *
     * The line has three shapes: `装饰自检通过 · …` (routine), `⚠ <warning> · …`,
     * and `装饰自检失败: …`. Only the first may hide behind the debug switch — a
     * failure has to reach the person looking at the panel without them knowing
     * that a switch exists.
     * @param line - the scenery line.
     * @returns true when the line carries a warning or an error.
     */
    function sceneryLineIsWarning(line) {
      return typeof line === 'string' && (line.startsWith('⚠') || line.includes('失败'))
    }

    /**
     * Render the scenery report as one line.
     * @returns the report text.
     */
    function describeAmbientReport() {
      const report = ambientReport
      // The attempt log comes FIRST, because it answers the question the final state cannot:
      // whether the scenery was ever placed while the sidebar existed. Boot-time silence
      // leaves a perfectly healthy final report — the successful run happens later — so the
      // sequence is the only thing that shows the failure.
      const tried = `同步记录[${describeAmbientLog()}]`
      if (report === undefined) return `尚未同步（syncSkin 未运行） · ${tried}`
      if (report.found === false) return `未生效：${report.note} · ${tried}`
      if (report.note !== undefined) return `${report.kind} · ${report.note} · ${tried}`
      return `${report.kind} · 子元素=${report.children} · 座位=${report.size}`
        + ` · 挂载于=${report.parent}`
        + ` · 定位=${report.placement}`
        + ` · 内容=${report.html}`
        + ` · 子链=${report.kids}`
        + ` · 场景=${report.sceneSize} · 素材=${report.artSize}`
        + ` · 命中测试[${report.hitTest}]`
        + ` · 列几何[${report.columns}]`
        + ` · display=${report.display} · position=${report.position} · z-index=${report.zIndex}`
        + ` · ${tried}`
    }

    /**
     * The 山青婷彩 scene: two mountain ridges with a mist band, water at the foot
     * with expanding ripples, two hovering dragonflies, and falling petals.
     *
     * Ported from the source system's `ShanQingTingCaiAnimation.vue` one-to-one —
     * same paths, same gradients, same hues — so the port is recognisably the same
     * artwork rather than an approximation. Gradient ids are prefixed `dsh-` so
     * two themes can never collide through a shared `<defs>` id.
     * @param petals - how many petals to seed.
     * @returns the scene element.
     */
    /* ---------------- scenery markup ----------------
     *
     * The scenes are HTML STRINGS, injected with `innerHTML`, rather than React
     * elements mounted into a root owned by this plugin.
     *
     * Two earlier attempts failed silently and cost real debugging time:
     * `createRoot` mounted nothing at all in the shipped app, and a hand-written
     * walker that created nodes itself also produced an empty seat — while a plain
     * pseudo-element on the same seat was visible, which proved the seat paints and
     * put the fault squarely in how the children were constructed.
     *
     * Markup removes the two things those approaches had to get right by hand:
     * the HTML parser switches to the SVG namespace on its own inside `<svg>`, and
     * attribute names are written as the SVG actually spells them (`stop-color`)
     * instead of being translated from JSX casing. Everything here is also plain
     * text, so it can be asserted without a DOM.
     *
     * Only attributes and hex/CSS values reach this builder — no text content, no
     * user input — and `sceneMarkup` refuses anything script-bearing regardless.
     */
    const SVG_TAGS = new Set(['svg', 'defs', 'linearGradient', 'stop', 'path', 'ellipse', 'g', 'circle'])

    /**
     * Serialise one attribute.
     * @param name - the attribute name, already in its markup spelling.
     * @param value - its value.
     * @returns the attribute, or an empty string when it carries no value.
     */
    function attr(name, value) {
      const text = String(value)
      const safe = SVG_TAGS.has('svg') && (name.startsWith('on') || /^javascript:/i.test(text))
        ? ''
        : ` ${name}="${text.replace(/"/g, '&quot;')}"`
      return safe
    }

    /**
     * Open a tag.
     * @param tag - element name.
     * @param attributes - attribute map; nullish values are dropped.
     * @returns the opening tag.
     */
    function open(tag, attributes) {
      let out = `<${tag}`
      for (const [name, value] of Object.entries(attributes ?? {})) {
        if (value === null || value === undefined) continue
        out += attr(name, value)
      }
      return `${out}>`
    }

    /**
     * The 山青婷彩 scene: two mountain ridges, a mist band, water at the foot with
     * expanding ripples, two hovering dragonflies, and falling petals.
     *
     * Ported from the source system's \`ShanQingTingCaiAnimation.vue\` — same paths,
     * same gradients, same structure. Colours are darkened from the source values:
     * the originals sat behind a 223px sidebar and, at this width, the far ridge
     * landed on the sidebar's own gradient value and was invisible.
     * @param petals - how many petals to seed.
     * @returns the scene markup.
     */
    function shanAmbientScene(petals) {
      const count = Math.max(0, Math.min(20, petals ?? 7))
      let petalNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const petalSize = 7 + ((n * 3) % 4)
        petalNodes += open('div', {
          class: 'sta-petal',
          // Everything inline: position, size, colour, shape and the animation timing.
          style: 'position:absolute;top:-1em;'
            + `left:${((n * 17) % 80) + 8}%;width:${petalSize}px;height:${petalSize - 1}px;`
            + 'background:linear-gradient(135deg,#F8BBD2 0%,#E88BB0 60%,#D97BA4 100%);'
            + 'border-radius:60% 40% 55% 45%/60% 55% 45% 40%;opacity:.9;'
            + `animation:dsh-amb-fall ${6 + ((n * 5) % 3)}s linear infinite;animation-delay:${-(n * 0.9)}s`,
        }) + '</div>'
      }

      const mountains = open('div', {
        class: 'sta-mountains',
        // Inline, like the layer itself: if the ridge appears but stays flat, the
        // stylesheet is not being applied at all, which the computed readings could not
        // reveal because they were reading the layer's inline values.
        style: 'position:absolute;left:0;right:0;bottom:0;height:46%;z-index:3',
      })
        + open('svg', {
          viewBox: '0 0 223 190',
          preserveAspectRatio: 'none',
          // No background. A magenta fill lived here while the layer's ability to paint was
          // still in question; it is what the user saw as a bright pink block over the
          // sidebar, and the ridges below are the actual artwork.
          style: 'display:block;width:100%;height:100%',
        })
        + open('defs', {})
        + open('linearGradient', { id: 'dsh-sta-back', x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0', 'stop-color': '#8FBFAA' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#74AE96' }) + '</stop>'
        + '</linearGradient>'
        + open('linearGradient', { id: 'dsh-sta-front', x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0', 'stop-color': '#3E8A66' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#2B6E4F' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + open('path', {
          d: 'M 0 78 Q 30 48 62 66 Q 96 34 128 60 Q 160 40 190 62 Q 208 50 223 58 L 223 190 L 0 190 Z',
          fill: 'url(#dsh-sta-back)',
        }) + '</path>'
        + open('path', {
          d: 'M 0 122 Q 36 92 70 110 Q 104 84 140 108 Q 176 90 223 116 L 223 190 L 0 190 Z',
          fill: 'url(#dsh-sta-front)',
        }) + '</path>'
        + '</svg>'
        + '</div>'

      return open('div', {
        class: 'sta',
        // Fills the scene box — the sidebar's blank area — and no more.
        //
        // This was stretched to the full viewport during bring-up. That left it 1280x820
        // inside a 280x260 box, so every percentage-positioned child (the ridges at 46%
        // height, the dragonflies at 58%/74%) resolved against the SCREEN and landed
        // outside the box, where `overflow:hidden` removed them. Only the petals stayed
        // visible, because they start at the box's top edge and fall into it.
        style: 'position:absolute;inset:0;display:block',
      })
        + mountains
        + open('div', {
          class: 'sta-mist sta-mist-1',
          style: 'position:absolute;height:1.6em;width:66%;top:58.5%;left:13%;border-radius:1000px;z-index:4;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);'
            + 'filter:blur(5px);opacity:.85;animation:dsh-amb-mist 26s ease-in-out infinite alternate',
        }) + '</div>'
        + open('div', {
          class: 'sta-mist sta-mist-2',
          style: 'position:absolute;height:1.6em;width:48%;top:63%;left:40%;border-radius:1000px;z-index:4;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);'
            + 'filter:blur(5px);opacity:.6;animation:dsh-amb-mist 32s ease-in-out infinite alternate;'
            + 'animation-delay:-9s',
        }) + '</div>'
        + open('div', {
          class: 'sta-pond',
          style: 'position:absolute;left:0;right:0;bottom:0;height:14%;z-index:5;'
            + 'background:linear-gradient(to bottom,rgba(104,178,150,.62),rgba(66,141,113,.78))',
        })
        + open('div', {
          class: 'sta-pond-line',
          style: 'position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.6;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent)',
        }) + '</div>'
        + '</div>'
        + rippleMarkup('38%', '5.2%', '0s')
        + rippleMarkup('62%', '3.4%', '1.6s')
        + dragonflyBlock('1', 'sta-dfly-1', 'top:58%;left:6%;width:3.8em', 'dsh-amb-hover1 11s ease-in-out infinite', '0s')
        + dragonflyBlock('2', 'sta-dfly-2', 'top:74%;left:16%;width:2.6em;opacity:.95', 'dsh-amb-hover2 13s ease-in-out infinite', '-5s')
        + open('div', { class: 'sta-petals', style: 'position:absolute;inset:0;z-index:7;pointer-events:none' })
        + petalNodes + '</div>'
        + '</div>'
    }

    /**
     * The dragonfly artwork, shared by both instances.
     *
     * Each copy carries its own \`<defs>\` and a suffixed gradient id, because the two
     * dragonflies are separate elements that animate independently and gradient ids
     * must stay unique across the document.
     * @param suffix - makes the gradient id unique per instance.
     * @returns the dragonfly markup.
     */
    function dragonflyMarkup(suffix) {
      const gradient = `dsh-sta-dfly-body-${suffix}`
      return open('svg', { viewBox: '0 0 100 70' })
        + open('defs', {})
        + open('linearGradient', { id: gradient, x1: '1', y1: '0', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#1F6B4C' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#2E8C66' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + open('ellipse', { cx: '36', cy: '15', rx: '17', ry: '4.4', fill: 'rgba(150,200,222,0.5)', transform: 'rotate(-40 36 15)' }) + '</ellipse>'
        + open('ellipse', { cx: '38', cy: '24', rx: '15', ry: '4', fill: 'rgba(150,200,222,0.42)', transform: 'rotate(-14 38 24)' }) + '</ellipse>'
        + open('ellipse', {
          cx: '31', cy: '11', rx: '19', ry: '5', fill: 'rgba(214,242,248,0.7)',
          transform: 'rotate(-30 31 11)', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': '0.6',
        }) + '</ellipse>'
        + open('ellipse', {
          cx: '34', cy: '22', rx: '16', ry: '4.6', fill: 'rgba(240,214,242,0.62)',
          transform: 'rotate(-6 34 22)', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': '0.6',
        }) + '</ellipse>'
        + open('path', {
          d: 'M 27 32 C 42 39, 60 46, 84 55',
          stroke: `url(#${gradient})`, 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('circle', { cx: '84', cy: '55', r: '1.4', fill: '#17513C' }) + '</circle>'
        + open('ellipse', { cx: '27', cy: '30', rx: '6.5', ry: '5', fill: '#1F6B4C' }) + '</ellipse>'
        + open('circle', { cx: '18.5', cy: '27.5', r: '4.2', fill: '#17513C' }) + '</circle>'
        + open('circle', { cx: '16.2', cy: '25.8', r: '1.9', fill: '#0F3D2E' }) + '</circle>'
        + open('circle', { cx: '20.6', cy: '25.4', r: '1.9', fill: '#0F3D2E' }) + '</circle>'
        + open('circle', { cx: '15.6', cy: '25.2', r: '0.6', fill: '#DFF3EC' }) + '</circle>'
        + open('circle', { cx: '20', cy: '24.8', r: '0.6', fill: '#DFF3EC' }) + '</circle>'
        + '</svg>'
    }

    /**
     * The 梦海游鱼 scene: a soft corner glow with two drifting light washes, rising
     * bubbles, a second layer of glowing motes, and swaying seaweed over stones,
     * all grounded on a water-floor band. The floor is what makes the scene read as
     * one piece the way shan's mountains do: it starts fully transparent (the
     * sidebar's own gradient shows through at the junction) and deepens downward,
     * so the elements emerge from the water instead of floating on it.
     *
     * Ported from \`DreamOceanAmbient.vue\`. The source also keeps a separate
     * cartoon-fish animation on top; that is a distinct component there and is not
     * part of this ambience.
     * @param bubbles - how many bubbles to seed.
     * @param motes - how many glowing motes to seed. A separate effect from the bubbles,
     *   and deliberately seeded separately so either can be tuned without touching the other.
     * @returns the scene markup.
     */
    function dreamAmbientScene(bubbles, motes, fish) {
      const count = Math.max(0, Math.min(24, bubbles ?? 9))
      let bubbleNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 3 + ((n * 4) % 4)
        bubbleNodes += open('div', {
          class: 'dof-bubble',
          style: 'position:absolute;bottom:-1em;border-radius:50%;'
            + 'background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95),rgba(190,232,246,.55));'
            + 'box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);'
            + `left:${((n * 23) % 86) + 6}%;width:${size}px;height:${size}px;`
            + `animation:dsh-amb-rise ${8 + ((n * 7) % 8)}s linear infinite;animation-delay:${-(n * 1.7)}s`,
        }) + '</div>'
      }

      // The cartoon fish, from the source system's own `FishAnimation.vue`. They are a
      // distinct effect again — not bubbles and not motes — so they get their own container
      // and their own count.
      const fishCount = Math.max(0, Math.min(6, fish ?? 3))
      // size(em), top(%), duration(s), delay(s), direction. Three different depths, sizes and
      // speeds so they read as separate fish rather than one repeated sprite.
      const FISH_PLAN = [
        [2.4, 26, 34, -4, false],
        [1.7, 52, 46, -18, true],
        [1.3, 71, 40, -29, false],
        [2.0, 40, 52, -36, true],
        [1.5, 63, 38, -11, false],
        [1.1, 33, 48, -24, true],
      ]
      let fishNodes = ''
      for (let n = 0; n < fishCount; n += 1) {
        const [size, top, duration, delay, flip] = FISH_PLAN[n % FISH_PLAN.length]
        fishNodes += fishMarkup(String(n + 1), size, top, duration, delay, flip)
      }

      // The glowing motes: a second, independent effect drawn over the bubbles.
      const moteCount = Math.max(0, Math.min(24, motes ?? 5))
      let moteNodes = ''
      for (let n = 1; n <= moteCount; n += 1) {
        const size = 5 + ((n * 3) % 4)
        moteNodes += open('div', {
          class: 'dof-mote',
          style: 'position:absolute;bottom:-1em;border-radius:50%;'
            + 'background:radial-gradient(circle at 34% 30%,#FFFFFF 0%,#D6F1FF 40%,'
            + 'rgba(122,205,255,.5) 72%,rgba(122,205,255,0) 100%);'
            + 'box-shadow:0 0 10px 3px rgba(122,205,255,.55),0 0 22px 6px rgba(122,205,255,.22);'
            + `left:${((n * 31) % 84) + 8}%;width:${size}px;height:${size}px;`
            + `animation:dsh-amb-mote ${9 + ((n * 5) % 7)}s linear infinite;animation-delay:${-(n * 2.1)}s`,
        }) + '</div>'
      }

      return open('div', { class: 'dof', style: 'position:absolute;inset:0;display:block' })
        + open('div', { class: 'dof-glow', style: 'position:absolute;inset:0;z-index:2' })
        // The sunlight pool. It used to be centred ON the band's top edge at full
        // brightness, so the scene box's overflow clip cut it into a hard white line
        // against the un-lit middle of the sidebar — the boundary the user reported.
        // Now it starts AT the edge, is dimmer, and is masked to zero there; the
        // sidebar gradient's own light-pool stop (meng-hai-you-yu.json, 62–70%)
        // continues the bloom above the edge.
        + open('div', {
          class: 'dof-corner',
          style: 'position:absolute;top:0;left:-30%;width:150%;height:40%;'
            + 'background:radial-gradient(ellipse at 32% 50%,rgba(255,255,255,.55),rgba(255,255,255,0) 62%);'
            + 'filter:blur(12px);'
            + '-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 45%);'
            + 'mask-image:linear-gradient(to bottom,transparent 0,#000 45%);'
            + 'animation:dsh-amb-wash 18s ease-in-out infinite alternate',
        }) + '</div>'
        + open('div', {
          class: 'dof-wash dof-wash-1',
          style: 'position:absolute;left:-20%;width:140%;height:30%;top:14%;filter:blur(12px);opacity:.5;'
            + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);'
            + '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'animation:dsh-amb-wash 24s ease-in-out infinite alternate',
        }) + '</div>'
        + open('div', {
          class: 'dof-wash dof-wash-2',
          style: 'position:absolute;left:-20%;width:140%;height:30%;top:34%;filter:blur(12px);opacity:.34;'
            + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);'
            + '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'animation:dsh-amb-wash 31s ease-in-out infinite alternate;animation-delay:-8s',
        }) + '</div>'
        + '</div>'
        + open('div', { class: 'dof-bubbles', style: 'position:absolute;inset:0;z-index:6;pointer-events:none' })
        + bubbleNodes + '</div>'
        + open('div', { class: 'dof-fish-layer', style: 'position:absolute;inset:0;z-index:6;pointer-events:none' })
        + fishNodes + '</div>'
        + open('div', { class: 'dof-motes', style: 'position:absolute;inset:0;z-index:7;pointer-events:none' })
        + moteNodes + '</div>'
        + open('div', {
          class: 'dof-floor',
          style: 'position:absolute;left:0;right:0;bottom:0;height:20%;z-index:4;'
            + 'background:linear-gradient(to bottom,rgba(126,184,222,0) 0%,rgba(126,184,222,.4) 46%,rgba(84,152,199,.62) 100%)',
        }) + '</div>'
        + open('div', {
          class: 'dof-seaweed',
          style: 'position:absolute;left:0;right:0;bottom:0;height:38%;z-index:5',
        }) + seaweedMarkup() + '</div>'
        + '</div>'
    }

    /**
     * The seaweed artwork, reproduced from the source system's paths.
     *
     * Five blades from three gradients, each animating on its own phase so the bed
     * sways rather than moving as one rigid shape, over three resting stones.
     * @returns the seaweed markup.
     */
/**
     * One expanding ring on the water, positioned inline.
     * @param left - horizontal position.
     * @param bottom - vertical position.
     * @param delay - animation delay, so the rings do not pulse in unison.
     * @returns the ring markup.
     */
    function rippleMarkup(left, bottom, delay) {
      const ring = 'position:absolute;inset:0;border:1.6px solid rgba(232,139,176,.92);border-radius:50%;'
        + `animation:dsh-amb-ring 3.2s ease-out infinite;animation-delay:${delay}`
      return open('div', {
        class: 'sta-ripple',
        style: `position:absolute;z-index:6;width:.55em;height:.55em;left:${left};bottom:${bottom}`,
      }) + `<span style="${ring}"></span><span style="${ring}"></span></div>`
    }

    /**
     * One hovering dragonfly: an outer element on its flight path and an inner one
     * bobbing on the wingbeat, so the two motions compose.
     * @param suffix - gradient id suffix.
     * @param className - the positioning class.
     * @param position - inline position.
     * @param flight - animation shorthand for the flight path.
     * @param delay - animation delay.
     * @returns the dragonfly markup.
     */
    function dragonflyBlock(suffix, className, position, flight, delay) {
      return open('div', {
        class: `sta-dfly ${className}`,
        style: `position:absolute;z-index:8;will-change:transform;${position};`
          + `animation:${flight};animation-delay:${delay}`,
      }) + open('div', {
        class: 'sta-bob',
        style: `animation:dsh-amb-bob ${suffix === '2' ? '1.1s' : '.9s'} ease-in-out infinite;`
          + `animation-delay:${suffix === '2' ? '-.4s' : '0s'}`,
      }) + dragonflyMarkup(suffix) + '</div></div>'
    }

    /**
     * One seaweed blade. The sway is applied to the group so the blades move from their
     * base, and each blade animates on its own phase.
     * @param key - blade index.
     * @param d - path data.
     * @param gradient - gradient id.
     * @param width - stroke width.
     * @param opacity - blade opacity.
     * @returns the blade markup.
     */
    function bladeMarkup(key, d, gradient, width, opacity) {
      const durations = { 1: '6s', 2: '7.4s', 3: '5.2s', 4: '8.1s', 5: '6.6s' }
      const delays = { 1: '0s', 2: '-1.6s', 3: '-2.8s', 4: '-.9s', 5: '-3.4s' }
      return open('g', {
        class: `dof-blade dof-blade-${key}`,
        style: `transform-origin:50% 100%;animation:dsh-amb-sway ${durations[key]} ease-in-out infinite alternate;`
          + `animation-delay:${delays[key]}`,
      }) + open('path', {
        d, fill: `url(#${gradient})`, stroke: `url(#${gradient})`, 'stroke-width': width, opacity,
      }) + '</path></g>'
    }

    function seaweedMarkup() {
      const blade = bladeMarkup

      return open('svg', {
        viewBox: '0 0 140 120',
        preserveAspectRatio: 'none',
        style: 'display:block;width:100%;height:100%',
      })
        + open('defs', {})
        + open('linearGradient', { id: 'dsh-dof-weed-a', x1: '0', y1: '1', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#1E6E93' }) + '</stop>'
        + open('stop', { offset: '0.55', 'stop-color': '#3E93BC' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#A5DEF0', 'stop-opacity': '0.85' }) + '</stop>'
        + '</linearGradient>'
        + open('linearGradient', { id: 'dsh-dof-weed-b', x1: '0', y1: '1', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#2B7FA6' }) + '</stop>'
        + open('stop', { offset: '0.6', 'stop-color': '#4FA3C6' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#B8E2F2', 'stop-opacity': '0.85' }) + '</stop>'
        + '</linearGradient>'
        + open('linearGradient', { id: 'dsh-dof-weed-c', x1: '0', y1: '1', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#4A78A8' }) + '</stop>'
        + open('stop', { offset: '0.6', 'stop-color': '#7FA9CE' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#CBE2F4', 'stop-opacity': '0.8' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + blade('1', 'M 22 120 C 12 96, 26 74, 18 48 C 15 38, 18 28, 24 20 C 20 34, 24 44, 30 60 C 36 80, 30 100, 32 120 Z', 'dsh-dof-weed-a', '2.2', '0.95')
        + blade('2', 'M 48 120 C 40 98, 54 80, 46 56 C 42 44, 48 34, 56 24 C 50 40, 56 52, 60 68 C 64 88, 56 104, 58 120 Z', 'dsh-dof-weed-b', '2', '0.92')
        + blade('3', 'M 74 120 C 68 102, 78 88, 72 68 C 69 58, 72 48, 78 40 C 74 52, 78 62, 82 76 C 86 94, 80 108, 82 120 Z', 'dsh-dof-weed-c', '1.8', '0.88')
        + blade('4', 'M 96 120 C 92 104, 102 90, 96 72 C 93 62, 96 54, 102 46 C 98 58, 102 68, 106 82 C 110 98, 102 110, 104 120 Z', 'dsh-dof-weed-a', '1.6', '0.85')
        + blade('5', 'M 118 120 C 114 108, 122 96, 117 82 C 115 74, 117 68, 121 62 C 118 72, 121 80, 124 92 C 127 104, 121 112, 123 120 Z', 'dsh-dof-weed-b', '1.4', '0.8')
        + open('ellipse', { cx: '30', cy: '119', rx: '14', ry: '4', fill: '#7FAFC6', opacity: '0.55' }) + '</ellipse>'
        + open('ellipse', { cx: '72', cy: '120', rx: '10', ry: '3.4', fill: '#8FB9CE', opacity: '0.5' }) + '</ellipse>'
        + open('ellipse', { cx: '108', cy: '119.5', rx: '12', ry: '3.6', fill: '#7FAFC6', opacity: '0.45' }) + '</ellipse>'
        + '</svg>'
    }

    /**
     * One cartoon fish, swimming across the water.
     *
     * Ported from the source system's separate `FishAnimation.vue`. That component drives the
     * fish from JavaScript through entering / bubbling / leaving phases on a 60-second cycle,
     * but this skin is a static bundle with no component runtime to host a script — so the
     * same artwork swims continuously instead, on a CSS `@keyframes` cross, with the tail and
     * the whole body on separate animations so it reads as swimming rather than sliding.
     *
     * The artwork is reproduced shape for shape: the body curve, tail, dorsal fin, pectoral
     * fin, and the three-part eye. The colours are retuned into the theme's blue family —
     * the source values (`#38bdf8` body, `#1d4ed8` fins) sat outside the dream palette and
     * read as a sticker, the same treatment shan's mountains got when their source greens
     * were darkened for this sidebar.
     * @param suffix - unique id suffix, so several fish can coexist.
     * @param size - rendered width in em.
     * @param top - vertical position within the water, as a percentage.
     * @param duration - seconds for one crossing.
     * @param delay - animation delay, so the fish do not move in lockstep.
     * @param flip - whether this fish swims right-to-left instead.
     * @returns the fish markup.
     */
    function fishMarkup(suffix, size, top, duration, delay, flip) {
      const anim = flip ? 'dsh-amb-swim-back' : 'dsh-amb-swim'
      return open('div', {
        class: `dof-fish${flip ? ' dof-fish-flip' : ''}`,
        style: 'position:absolute;left:0;opacity:.94;'
          + `top:${top}%;width:${size}em;`
          + `animation:${anim} ${duration}s linear infinite;animation-delay:${delay}s`,
      })
        + open('div', {
          class: 'dof-fish-bob',
          style: `animation-duration:${(duration / 8).toFixed(2)}s`,
        })
        + open('svg', {
          viewBox: '0 0 50 18',
          preserveAspectRatio: 'xMidYMid meet',
          style: 'display:block;width:100%;height:auto;overflow:visible',
        })
        + open('g', { class: 'dof-fish-body' })
        // Body — recoloured into the theme's own blue family. The source values
        // (`#38bdf8` body, `#1d4ed8` fins) sat outside the dream palette and read
        // as a sticker pasted on the water; the same treatment shan's mountains
        // got when their source greens were darkened for this sidebar.
        + open('path', {
          d: 'M10 10 C20 5 35 5 45 10 C40 15 25 15 10 10 Z',
          fill: '#5FA5D6', stroke: '#2B6E9E', 'stroke-width': '1',
        }) + '</path>'
        // Tail
        + open('path', {
          d: 'M10 10 L5 7 L5 13 Z',
          fill: '#2B6E9E', stroke: '#2B6E9E', 'stroke-width': '1', class: 'dof-fish-tail',
        }) + '</path>'
        // Dorsal fin
        + open('path', {
          d: 'M20 7 L25 3 L30 7',
          fill: '#2B6E9E', stroke: '#2B6E9E', 'stroke-width': '1',
        }) + '</path>'
        // Pectoral fin
        + open('path', {
          d: 'M35 9 L40 12 L45 9',
          fill: '#5FA5D6', stroke: '#2B6E9E', 'stroke-width': '1',
        }) + '</path>'
        // Eye: white, pupil, highlight
        + open('circle', { cx: '40', cy: '8', r: '2', fill: '#FFFFFF' }) + '</circle>'
        + open('circle', { cx: '41', cy: '8', r: '1', fill: '#16384F' }) + '</circle>'
        + open('circle', { cx: '40.5', cy: '7.5', r: '0.5', fill: '#FFFFFF' }) + '</circle>'
        + '</g>'
        + '</svg>'
        + '</div></div>'
    }

    /**
     * One drifting cloud-sea copy for 营慕彩云, ported shape-for-shape from
     * `YingMuCaiYunAnimation.vue`. The source drifts a 200%-wide flex track holding
     * two copies of the same SVG, so one marquee keyframe loops seamlessly; each
     * copy carries its own gradient id because two tracks (back and front) and two
     * preview seats all live in one document.
     * @param variant - 'back' (deep purple, slow) or 'front' (pink-gold, quicker).
     * @param copy - unique id suffix for this copy's gradient.
     * @returns one sea-section SVG.
     */
    function ymSeaSvg(variant, copy) {
      const back = variant === 'back'
      const gradient = `dsh-ym-sea-${variant}-${copy}`
      return open('svg', {
        viewBox: back ? '0 0 240 70' : '0 0 240 80',
        preserveAspectRatio: 'none',
        style: 'width:50%;height:100%;flex:none;display:block',
      })
        + open('defs', {})
        + open('linearGradient', { id: gradient, x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0', 'stop-color': back ? '#C9B6E4' : '#FFF0F7' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': back ? '#A68FCA' : '#E8B4D6' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + open('path', {
          d: back
            ? 'M0 70 L0 44 Q14 40 22 46 Q26 28 44 30 Q54 16 72 22 Q84 8 102 16 Q118 6 134 14 '
              + 'Q150 8 164 18 Q178 12 190 24 Q206 20 216 34 Q230 32 240 42 L240 70 Z'
            : 'M0 80 L0 52 Q12 48 22 54 Q28 36 48 38 Q60 24 78 30 Q92 14 110 24 Q126 12 142 22 '
              + 'Q158 14 172 26 Q188 22 198 36 Q214 34 224 48 Q234 50 240 56 L240 80 Z',
          fill: `url(#${gradient})`,
        }) + '</path>'
        + '</svg>'
    }

    /**
     * One hot-air balloon for 营慕彩云, ported from the source component's two
     * inline SVGs: envelope with highlight, suspension ropes, and a basket.
     * @param variant - 'main' (orange-gold-pink, near) or 'mini' (pink-purple, far).
     * @returns the balloon SVG.
     */
    function ymBalloonMarkup(variant) {
      const main = variant === 'main'
      const gradient = main ? 'dsh-ym-balloon-main' : 'dsh-ym-balloon-mini'
      const svg = open('svg', {
        viewBox: main ? '0 0 64 96' : '0 0 40 62',
        style: 'display:block;width:100%;height:auto;overflow:visible;'
          + 'filter:drop-shadow(0 4px 6px rgba(90,58,90,.25))',
      })
        + open('defs', {})
        + open('linearGradient', { id: gradient, x1: '0', y1: '0', x2: '1', y2: '1' })
        + (main
          ? open('stop', { offset: '0', 'stop-color': '#FFC96B' }) + '</stop>'
            + open('stop', { offset: '0.55', 'stop-color': '#FFB347' }) + '</stop>'
            + open('stop', { offset: '1', 'stop-color': '#F08BB4' }) + '</stop>'
          : open('stop', { offset: '0', 'stop-color': '#F2C9E3' }) + '</stop>'
            + open('stop', { offset: '1', 'stop-color': '#A68FCA' }) + '</stop>')
        + '</linearGradient>'
        + '</defs>'
      if (main) {
        return svg
          + open('path', {
            d: 'M32 3 C48 3 59 15 59 30 C59 45 47 58 38 66 L26 66 C17 58 5 45 5 30 C5 15 16 3 32 3 Z',
            fill: `url(#${gradient})`,
          }) + '</path>'
          + open('path', {
            d: 'M32 3 C36 3 39 15 39 30 C39 45 37 58 35.5 66 L28.5 66 C27 58 25 45 25 30 C25 15 28 3 32 3 Z',
            fill: '#FFE3B8', opacity: '0.85',
          }) + '</path>'
          + open('path', { d: 'M13 13 C9 22 10 40 18 55', stroke: '#E88BB0', 'stroke-width': '1.4', fill: 'none', opacity: '0.55' }) + '</path>'
          + open('path', { d: 'M51 13 C55 22 54 40 46 55', stroke: '#E88BB0', 'stroke-width': '1.4', fill: 'none', opacity: '0.55' }) + '</path>'
          + open('path', { d: 'M27.5 66 L28.5 75 M36.5 66 L35.5 75', stroke: '#8A6A4A', 'stroke-width': '1.2' }) + '</path>'
          + open('rect', { x: '25.5', y: '75', width: '13', height: '9', rx: '2.5', fill: '#9C7C5C' }) + '</rect>'
          + open('path', { d: 'M25.5 78.5 L38.5 78.5', stroke: '#7E6146', 'stroke-width': '1.2' }) + '</path>'
          + '</svg>'
      }
      return svg
        + open('path', {
          d: 'M20 2 C30 2 36 10 36 19 C36 29 28 37 22.5 42 L17.5 42 C12 37 4 29 4 19 C4 10 10 2 20 2 Z',
          fill: `url(#${gradient})`,
        }) + '</path>'
        + open('path', {
          d: 'M20 2 C23 2 25.5 10 25.5 19 C25.5 29 24 37 23 42 L17 42 C16 37 14.5 29 14.5 19 C14.5 10 17 2 20 2 Z',
          fill: '#F6E7F4', opacity: '0.9',
        }) + '</path>'
        + open('path', { d: 'M17.5 42 L18 47 M22.5 42 L22 47', stroke: '#8A6A4A', 'stroke-width': '1' }) + '</path>'
        + open('rect', { x: '16', y: '47', width: '8', height: '6', rx: '1.5', fill: '#8A6A4A' }) + '</rect>'
        + '</svg>'
    }

    /**
     * The 营慕彩云 scene: a dusk glow, warm stars, blurred drifting clouds, two
     * marquee cloud-seas (deep purple behind, pink-gold in front) and two bobbing
     * hot-air balloons.
     *
     * Ported from `YingMuCaiYunAnimation.vue`. The source stars are white on a dusk
     * sky; on this sidebar's pastel gradient white would vanish, so they are retuned
     * into the theme's warm gold — the same treatment the dream fish got when their
     * sticker blues moved into the theme family.
     * @param stars - how many stars to seed.
     * @returns the scene markup.
     */
    function caiyunAmbientScene(stars) {
      const count = Math.max(0, Math.min(30, stars ?? 12))
      let starNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 2 + ((n * 3) % 2)
        starNodes += open('div', {
          class: 'ym-star',
          style: 'position:absolute;border-radius:50%;'
            + `left:${((n * 37) % 84) + 6}%;top:${((n * 23) % 44) + 4}%;`
            + `width:${size}px;height:${size}px;`
            + 'background:radial-gradient(circle,#FFF7E2 0%,rgba(255,232,190,.55) 100%);'
            + 'box-shadow:0 0 4px rgba(255,224,160,.8);'
            + 'animation:dsh-amb-ym-star 2.2s ease-in-out infinite alternate;'
            + `animation-delay:${-(n * 0.37)}s`,
        }) + '</div>'
      }

      const DRIFTS = [
        ['1', '18em', '5em', '8%', '70s', '-22s'],
        ['2', '24em', '7em', '28%', '110s', '-44s'],
        ['3', '16em', '4.5em', '52%', '90s', '-66s'],
      ]
      let driftNodes = ''
      for (const [key, width, height, top, duration, delay] of DRIFTS) {
        driftNodes += open('div', {
          class: `ym-drift ym-drift-${key}`,
          style: `position:absolute;border-radius:1000px;left:-14em;top:${top};width:${width};height:${height};`
            + 'background:radial-gradient(ellipse,rgba(232,180,214,.55) 0%,rgba(166,143,202,.3) 60%,rgba(166,143,202,0) 100%);'
            + 'filter:blur(10px);'
            + `animation:dsh-amb-ym-drift ${duration} linear infinite;animation-delay:${delay}`,
        }) + '</div>'
      }

      const sea = (variant, bottom, height, zIndex, opacity, duration) => open('div', {
        class: `ym-sea ym-sea-${variant}`,
        style: `position:absolute;left:0;right:0;bottom:${bottom};height:${height};z-index:${zIndex};`
          + `opacity:${opacity};overflow:hidden`,
      })
        + open('div', {
          class: 'ym-sea-track',
          style: `position:absolute;left:0;top:0;width:200%;height:100%;display:flex;`
            + `animation:dsh-amb-ym-sea ${duration} linear infinite`,
        })
        + ymSeaSvg(variant, 'a') + ymSeaSvg(variant, 'b')
        + '</div></div>'

      // The outer element carries a WIDE WANDER and the inner one keeps the source's
      // small bob + sway. Two separate transforms on two elements, so they compose:
      // the balloon drifts across the band while still breathing.
      //
      // Why the wander: the balloons legitimately float over the sidebar's lower rows,
      // and a bigger path means they take turns covering and exposing that text instead
      // of hovering in one spot. The layer/z-index is deliberately NOT lowered — being
      // in front is what gives them depth, and they are never still for long.
      const balloon = (variant, position, size, duration, delay, zIndex, wander, wanderDelay) => open('div', {
        class: `ym-balloon ym-balloon-${variant}`,
        style: `position:absolute;pointer-events:none;${position}width:${size};z-index:${zIndex};`
          + `animation:${wander} ease-in-out infinite;animation-delay:${wanderDelay}`,
      })
        + open('div', {
          class: 'ym-bob',
          style: `transform-origin:50% 25%;animation:dsh-amb-ym-bob ${duration} ease-in-out infinite;`
            + `animation-delay:${delay}`,
        })
        + ymBalloonMarkup(variant)
        + '</div></div>'

      return open('div', { class: 'ym', style: 'position:absolute;inset:0;display:block' })
        + open('div', {
          class: 'ym-glow',
          style: 'position:absolute;left:0;right:0;bottom:0;height:52%;z-index:1;'
            + 'background:radial-gradient(ellipse at 35% 100%,rgba(255,214,170,.4) 0%,rgba(255,214,170,0) 70%)',
        }) + '</div>'
        + starNodes
        + driftNodes
        + sea('back', '16%', '26%', 4, '0.75', '80s')
        + balloon('mini', 'right:10%;bottom:56%;', '2.6em', '9.5s', '-3.5s', 5,
          'dsh-amb-ym-wander-2 38s', '-13s')
        + sea('front', '0%', '32%', 6, '1', '50s')
        + balloon('main', 'left:12%;bottom:38%;', '4.6em', '7s', '0s', 7,
          'dsh-amb-ym-wander 30s', '0s')
        + '</div>'
    }

    /**
     * One 乌篷船 (black-awning boat) for 江畔冬云, ported from
     * `JiangPanDongYunAnimation.vue`: hull, awning, poling oar and a warm bow
     * lantern, plus its water reflection. The source carries the reflection as a
     * second SVG; here one SVG holds both, the mirror produced by a flipped
     * `<use>`, so there is no second element to keep in place.
     * @returns the boat SVG.
     */
    function jpBoatMarkup() {
      return open('svg', { viewBox: '0 0 120 92', style: 'display:block;width:100%;height:auto' })
        + open('defs', {})
        + open('g', { id: 'dsh-jp-boat-art' })
        + open('path', { d: 'M 6 24 Q 60 36 114 22 Q 106 36 62 40 Q 22 38 6 24 Z', fill: '#10222C' }) + '</path>'
        + open('path', { d: 'M 38 24 C 44 10, 78 10, 88 23 Z', fill: '#0C1B24' }) + '</path>'
        + open('path', { d: 'M 22 26 L 30 -4', stroke: '#0C1B24', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none' }) + '</path>'
        + open('circle', { cx: '14', cy: '21', r: '2.6', fill: '#F2C879' }) + '</circle>'
        + open('circle', { cx: '14', cy: '21', r: '5.5', fill: '#F2C879', opacity: '0.25' }) + '</circle>'
        + '</g>'
        + '</defs>'
        + open('use', { href: '#dsh-jp-boat-art' }) + '</use>'
        + open('use', {
          href: '#dsh-jp-boat-art',
          transform: 'translate(0,90) scale(1,-1)',
          style: 'opacity:.22;filter:blur(2.5px)',
        }) + '</use>'
        + '</svg>'
    }

    /**
     * The 江畔冬云 scene: a pale winter moon, slow drifting clouds, fine snow, and a
     * river band carrying a moonlight column, flowing ripples, twinkling wave
     * glints, a drifting sampan with its reflection, and swaying bank reeds.
     *
     * Ported from `JiangPanDongYunAnimation.vue`. The source moon and clouds sit on
     * a near-black sky; here they sit on the pastel one, so the moon keeps its
     * source colours but leans on its halo to separate, and the night clouds keep
     * their shape at a lighter opacity.
     * @param snow - how many snowflakes to seed.
     * @returns the scene markup.
     */
    function dongyunAmbientScene(snow) {
      const count = Math.max(0, Math.min(30, snow ?? 8))
      let snowNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 2 + ((n * 3) % 3)
        snowNodes += open('div', {
          class: 'jp-snowflake',
          style: 'position:absolute;top:-0.5em;border-radius:50%;'
            + `left:${((n * 29) % 88) + 5}%;width:${size}px;height:${size}px;`
            + 'background:radial-gradient(circle,#FFFFFF 0%,rgba(255,255,255,.75) 100%);'
            + 'box-shadow:0 0 4px rgba(255,255,255,.85);'
            + `animation:dsh-amb-jp-snow ${9 + ((n * 7) % 8)}s linear infinite;`
            + `animation-delay:${-(n * 1.9)}s`,
        }) + '</div>'
      }

      const CLOUDS = [
        ['1', '12em', '3.2em', '10%', '95s', '0s'],
        ['2', '15em', '4em', '27%', '130s', '-40s'],
        ['3', '10.5em', '2.8em', '44%', '110s', '-70s'],
      ]
      let cloudNodes = ''
      for (const [key, width, height, top, duration, delay] of CLOUDS) {
        cloudNodes += open('div', {
          class: `jp-cloud jp-cloud-${key}`,
          style: `position:absolute;border-radius:1000px;left:-16em;top:${top};width:${width};height:${height};z-index:3;`
            + 'background:radial-gradient(ellipse,rgba(226,235,242,.85) 0%,rgba(190,206,220,.45) 60%,rgba(190,206,220,0) 100%);'
            + 'filter:blur(10px);'
            + `animation:dsh-amb-jp-cloud ${duration} linear infinite;animation-delay:${delay}`,
        }) + '</div>'
      }

      const RIPPLES = [
        ['1', '9em', '30%', '17s', '0s', '0.4'],
        ['2', '7em', '55%', '23s', '-9s', '0.3'],
        ['3', '10.5em', '78%', '14s', '-4s', '0.4'],
      ]
      let rippleNodes = ''
      for (const [key, width, top, duration, delay, opacity] of RIPPLES) {
        rippleNodes += open('div', {
          class: `jp-ripple jp-ripple-${key}`,
          style: `position:absolute;height:2px;border-radius:2px;left:-10em;top:${top};width:${width};opacity:${opacity};`
            + 'background:linear-gradient(90deg,transparent 0%,rgba(210,232,240,.9) 30%,rgba(210,232,240,.5) 60%,transparent 100%);'
            + `animation:dsh-amb-jp-ripple ${duration} linear infinite;animation-delay:${delay}`,
        }) + '</div>'
      }

      let glintNodes = ''
      for (let n = 1; n <= 5; n += 1) {
        glintNodes += open('div', {
          class: 'jp-glint',
          style: 'position:absolute;width:3px;height:3px;border-radius:50%;'
            + `left:${12 + ((n * 19) % 76)}%;top:${28 + ((n * 23) % 58)}%;`
            + 'background:radial-gradient(circle,#EAF6FA 0%,rgba(234,246,250,.4) 100%);'
            + 'box-shadow:0 0 6px rgba(220,240,250,.9);'
            + 'animation:dsh-amb-jp-glint 2.6s ease-in-out infinite alternate;'
            + `animation-delay:${-(n * 0.6)}s`,
        }) + '</div>'
      }

      const REEDS = [
        ['1', 'M 14 120 C 15 92, 17 62, 24 34', 'M 26 27', '4.6', '13', '9 26 27', '5.2s', '0s'],
        ['2', 'M 34 120 C 36 96, 42 66, 54 42', 'M 57 35', '4.2', '12', '16 57 35', '6.1s', '-2.1s'],
        ['3', 'M 56 120 C 56 100, 58 78, 62 56', 'M 63 49', '3.8', '11', '5 63 49', '4.6s', '-1.2s'],
        ['4', 'M 76 120 C 80 100, 90 78, 102 58', 'M 105 51', '3.6', '10.5', '22 105 51', '5.8s', '-3s'],
      ]
      let reedNodes = ''
      for (const [key, stem, head, rx, ry, rot, duration, delay] of REEDS) {
        const [angle, cx, cy] = rot.split(' ')
        reedNodes += open('g', {
          class: `jp-reed jp-reed-${key}`,
          style: `transform-box:fill-box;transform-origin:50% 100%;`
            + `animation:dsh-amb-jp-sway ${duration} ease-in-out infinite;animation-delay:${delay}`,
        })
          + open('path', { d: stem, stroke: '#0E202A', 'stroke-width': '2.2', fill: 'none', 'stroke-linecap': 'round' }) + '</path>'
          + open('ellipse', {
            cx, cy, rx, ry, fill: '#12242F',
            transform: `rotate(${angle} ${cx} ${cy})`,
          }) + '</ellipse>'
          + '</g>'
      }

      return open('div', { class: 'jp', style: 'position:absolute;inset:0;display:block' })
        + open('div', {
          class: 'jp-moon',
          style: 'position:absolute;top:5%;right:9%;width:3em;height:3em;border-radius:50%;z-index:2;opacity:.95;'
            + 'background:radial-gradient(circle at 38% 34%,#FDFAF2 0%,#E8E4D4 55%,#CBD2D8 100%);'
            + 'box-shadow:0 0 1.4em 0.35em rgba(240,244,240,.5),0 0 3.5em 1em rgba(190,210,225,.4)',
        }) + '</div>'
        + cloudNodes
        + snowNodes
        + open('div', {
          class: 'jp-river',
          style: 'position:absolute;left:0;right:0;bottom:0;height:38%;z-index:7;'
            + 'background:linear-gradient(to bottom,rgba(150,178,196,.4) 0%,rgba(110,142,164,.5) 100%);'
            + 'box-shadow:inset 0 0.9em 1.1em -0.6em rgba(16,34,44,.5)',
        })
        + open('div', {
          class: 'jp-waterline',
          style: 'position:absolute;top:0;left:0;right:0;height:1.5px;opacity:.5;'
            + 'background:linear-gradient(90deg,transparent 0%,rgba(214,234,242,.9) 35%,rgba(214,234,242,.35) 70%,transparent 100%)',
        }) + '</div>'
        + open('div', {
          class: 'jp-moonlight',
          style: 'position:absolute;top:4%;left:62%;width:3em;height:82%;border-radius:40%;filter:blur(5px);'
            + 'background:linear-gradient(to bottom,rgba(226,240,246,.18) 0%,rgba(226,240,246,.06) 55%,transparent 100%)',
        }) + '</div>'
        + rippleNodes
        + glintNodes
        + '</div>'
        + open('div', {
          class: 'jp-boat',
          style: 'position:absolute;bottom:22%;left:13%;width:7em;z-index:8;'
            + 'animation:dsh-amb-jp-boat 46s ease-in-out infinite alternate',
        })
        + open('div', {
          class: 'jp-boat-bob',
          style: 'transform-origin:50% 100%;animation:dsh-amb-jp-bob 5.2s ease-in-out infinite',
        })
        + jpBoatMarkup()
        + '</div></div>'
        + open('div', {
          class: 'jp-reeds',
          style: 'position:absolute;bottom:0;left:0;width:9em;z-index:9',
        })
        + open('svg', { viewBox: '0 0 120 120', style: 'display:block;width:100%;height:auto' })
        + reedNodes
        + open('path', { d: 'M 2 120 C 20 118, 42 112, 62 103', stroke: '#0E202A', 'stroke-width': '2.4', fill: 'none', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M 6 120 C 28 118.5, 54 114, 82 108', stroke: '#0E202A', 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round', opacity: '0.85' }) + '</path>'
        + open('path', { d: 'M 18 120 C 40 119, 64 116.5, 92 113', stroke: '#0E202A', 'stroke-width': '1.6', fill: 'none', 'stroke-linecap': 'round', opacity: '0.7' }) + '</path>'
        + '</svg>'
        + '</div>'
        + '</div>'
    }

    /**
     * One silhouette pine for 徐山军月, ported verbatim from
     * `XuShanJunYueAnimation.vue`'s `<defs>` art: a tiered pine over a short trunk.
     * @returns the pine group markup (a `<g>` for reuse inside one SVG).
     */
    function xsPineMarkup() {
      return open('g', { id: 'dsh-xsj-pine-art' })
        + open('path', {
          d: 'M 12 120 L 12 112 L 5 112 L 12 100 L 3 100 L 10 88 L 4 88 L 12 74 L 20 88 L 14 88 L 21 100 L 12 100 L 19 112 L 12 112 Z',
          fill: '#101A11',
        }) + '</path>'
        + open('rect', { x: '10.6', y: '112', width: '2.8', height: '8', fill: '#101A11' }) + '</rect>'
        + '</g>'
    }

    /**
     * The 徐山军月 scene: a starfield, a full moon veiled by slow night clouds, a
     * periodic meteor, two dark mountain ridges, and a row of standing pines.
     *
     * Ported from `XuShanJunYueAnimation.vue`. The source stars and moon are pale
     * cream on a near-black sky; on the pastel sidebar they would vanish, so they
     * are warmed into the theme's brass family (the same retune the dream fish and
     * the caiyun stars got), while the ridges and pines keep their verbatim dark
     * silhouettes — dark on light reads as the classic ink shape.
     * @param stars - how many stars to seed.
     * @returns the scene markup.
     */
    function junyueAmbientScene(stars) {
      const count = Math.max(0, Math.min(30, stars ?? 12))
      let starNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 2 + ((n * 3) % 2)
        starNodes += open('div', {
          class: 'xs-star',
          style: 'position:absolute;border-radius:50%;'
            + `left:${((n * 37) % 84) + 6}%;top:${((n * 23) % 48) + 4}%;`
            + `width:${size}px;height:${size}px;`
            + 'background:radial-gradient(circle,#F5EFD2 0%,rgba(212,178,102,.55) 100%);'
            + 'box-shadow:0 0 5px rgba(212,178,102,.75);'
            + 'animation:dsh-amb-xs-star 2.4s ease-in-out infinite alternate;'
            + `animation-delay:${-(n * 0.7)}s`,
        }) + '</div>'
      }

      const CLOUDS = [
        ['1', '10.5em', '1.6em', '12%', '90s', '0s'],
        ['2', '8.5em', '1.25em', '26%', '120s', '-55s'],
      ]
      let cloudNodes = ''
      for (const [key, width, height, top, duration, delay] of CLOUDS) {
        cloudNodes += open('div', {
          class: `xs-cloud xs-cloud-${key}`,
          style: `position:absolute;border-radius:1000px;left:-12em;top:${top};width:${width};height:${height};z-index:3;`
            + 'background:linear-gradient(90deg,rgba(24,32,25,0) 0%,rgba(24,32,25,.22) 30%,rgba(24,32,25,.22) 70%,rgba(24,32,25,0) 100%);'
            + 'filter:blur(5px);'
            + `animation:dsh-amb-xs-night ${duration} linear infinite;animation-delay:${delay}`,
        }) + '</div>'
      }

      return open('div', { class: 'xs', style: 'position:absolute;inset:0;display:block' })
        + starNodes
        + open('div', {
          class: 'xs-moon',
          style: 'position:absolute;top:7%;right:11%;width:3.6em;height:3.6em;border-radius:50%;z-index:2;'
            + 'background:radial-gradient(circle at 36% 32%,#FBF6E4 0%,#EFE7CB 58%,#D6CCA8 100%);'
            + 'box-shadow:0 0 1.6em 0.5em rgba(245,239,217,.5),0 0 4em 1.4em rgba(212,178,102,.22)',
        }) + '</div>'
        + cloudNodes
        + open('div', {
          class: 'xs-meteor',
          style: 'position:absolute;top:16%;left:66%;width:4.6em;height:2px;border-radius:2px;z-index:4;'
            + 'background:linear-gradient(90deg,transparent,rgba(245,242,220,.95));'
            + 'animation:dsh-amb-xs-meteor 9s ease-in infinite',
        })
        + open('span', {
          style: 'position:absolute;right:-2px;top:-2.2px;width:5px;height:5px;border-radius:50%;'
            + 'background:#FFFBEA;box-shadow:0 0 8px 2px rgba(255,251,234,.9)',
        }) + '</span>'
        + '</div>'
        + open('div', {
          class: 'xs-ridges',
          style: 'position:absolute;left:0;right:0;bottom:0;height:46%;z-index:5',
        })
        + open('svg', { viewBox: '0 0 223 160', preserveAspectRatio: 'none', style: 'display:block;width:100%;height:100%' })
        + open('defs', {})
        + open('linearGradient', { id: 'dsh-xsj-ridge-back', x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0', 'stop-color': '#31412F' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#273528' }) + '</stop>'
        + '</linearGradient>'
        + open('linearGradient', { id: 'dsh-xsj-ridge-front', x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0', 'stop-color': '#1F2C1F' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#161F16' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + open('path', {
          d: 'M 0 62 Q 28 30 58 52 Q 92 18 126 46 Q 158 24 188 50 Q 206 38 223 46 L 223 160 L 0 160 Z',
          fill: 'url(#dsh-xsj-ridge-back)',
        }) + '</path>'
        + open('path', {
          d: 'M 0 104 Q 34 72 68 94 Q 104 64 142 92 Q 176 74 223 100 L 223 160 L 0 160 Z',
          fill: 'url(#dsh-xsj-ridge-front)',
        }) + '</path>'
        + '</svg>'
        + '</div>'
        + open('div', {
          class: 'xs-pines',
          style: 'position:absolute;bottom:0;left:3%;width:8.5em;z-index:6',
        })
        + open('svg', { viewBox: '0 0 140 120', style: 'display:block;width:100%;height:auto' })
        + open('defs', {}) + xsPineMarkup() + '</defs>'
        + open('use', { href: '#dsh-xsj-pine-art', transform: 'translate(-4,-8) scale(1.35)' }) + '</use>'
        + open('use', { href: '#dsh-xsj-pine-art', transform: 'translate(34,2) scale(1.0)' }) + '</use>'
        + open('use', { href: '#dsh-xsj-pine-art', transform: 'translate(66,-4) scale(1.18)' }) + '</use>'
        + open('use', { href: '#dsh-xsj-pine-art', transform: 'translate(102,6) scale(0.88)' }) + '</use>'
        + open('use', { href: '#dsh-xsj-pine-art', transform: 'translate(126,0) scale(1.05)' }) + '</use>'
        + '</svg>'
        + '</div>'
        + '</div>'
    }

    /**
     * The 佩安杰心 scene: misty hills behind, a zen enso circle with a seated
     * meditator, an incense burner with two rising smoke threads, drifting dust
     * motes, and the theme's own words.
     *
     * Ported from `PeiAnJieXinAnimation.vue`. The artwork paths are verbatim; the
     * scene SVG's viewBox is cropped to the artwork (the source spans a full-height
     * sidebar and places the group far down inside it), which keeps the same drawing
     * coordinates while fitting the band.
     * @param dust - how many dust motes to seed.
     * @returns the scene markup.
     */
    function jiexinAmbientScene(dust) {
      const count = Math.max(0, Math.min(20, dust ?? 4))
      let dustNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 2.5 + ((n * 5) % 4)
        dustNodes += open('div', {
          class: 'pj-dust',
          style: 'position:absolute;border-radius:50%;'
            + `left:${((n * 17) % 50) + 26}%;top:${((n * 13) % 30) + 28}%;`
            + `width:${size}px;height:${size}px;`
            + 'background:radial-gradient(circle,rgba(255,244,214,.95) 0%,rgba(255,244,214,0) 100%);'
            + 'box-shadow:0 0 6px rgba(255,236,190,.8);'
            + `animation:dsh-amb-pj-dust ${8 + ((n * 5) % 5)}s linear infinite;`
            + `animation-delay:${-(n * 2)}s`,
        }) + '</div>'
      }

      return open('div', { class: 'pj', style: 'position:absolute;inset:0;display:block' })
        + open('div', {
          class: 'pj-hills',
          style: 'position:absolute;left:0;right:0;top:8%;height:24%;z-index:2;opacity:.62',
        })
        + open('svg', { viewBox: '0 0 223 80', preserveAspectRatio: 'none', style: 'display:block;width:100%;height:100%' })
        + open('path', {
          d: 'M 0 60 Q 34 22 70 46 Q 108 14 146 44 Q 186 20 223 48 L 223 80 L 0 80 Z',
          fill: '#B49B78', opacity: '0.55',
        }) + '</path>'
        + open('path', {
          d: 'M 0 72 Q 40 42 82 60 Q 126 34 168 58 Q 196 44 223 60 L 223 80 L 0 80 Z',
          fill: '#A08A67', opacity: '0.6',
        }) + '</path>'
        + '</svg>'
        + '</div>'
        + open('div', {
          class: 'pj-zenscene',
          style: 'position:absolute;left:0;right:0;bottom:8%;height:62%;z-index:3',
        })
        + open('svg', {
          viewBox: '0 480 200 175',
          preserveAspectRatio: 'xMidYMax meet',
          style: 'display:block;width:100%;height:100%',
        })
        + open('defs', {})
        + open('radialGradient', { id: 'dsh-pjx-fig-grad', cx: '50%', cy: '32%', r: '80%' })
        + open('stop', { offset: '0%', 'stop-color': '#6B5238', 'stop-opacity': '0.9' }) + '</stop>'
        + open('stop', { offset: '60%', 'stop-color': '#57432C', 'stop-opacity': '0.85' }) + '</stop>'
        + open('stop', { offset: '100%', 'stop-color': '#4A3823', 'stop-opacity': '0.8' }) + '</stop>'
        + '</radialGradient>'
        + open('filter', { id: 'dsh-pjx-haze', x: '-30%', y: '-30%', width: '160%', height: '160%' })
        + open('feGaussianBlur', { stdDeviation: '1.8' }) + '</feGaussianBlur>'
        + '</filter>'
        + open('filter', { id: 'dsh-pjx-soft-glow', x: '-60%', y: '-60%', width: '220%', height: '220%' })
        + open('feGaussianBlur', { stdDeviation: '7' }) + '</feGaussianBlur>'
        + '</filter>'
        + open('g', { id: 'dsh-pjx-enso-art' })
        + open('circle', {
          cx: '80', cy: '64', r: '56', fill: 'none', stroke: '#A87E4C', 'stroke-width': '5',
          'stroke-linecap': 'round', 'stroke-dasharray': '316 36',
          transform: 'rotate(-78 80 64)', opacity: '0.62',
        }) + '</circle>'
        + open('circle', {
          cx: '80', cy: '64', r: '56', fill: 'none', stroke: '#D9B98C', 'stroke-width': '1.8',
          'stroke-linecap': 'round', 'stroke-dasharray': '255 92',
          transform: 'rotate(-60 80 64)', opacity: '0.5',
        }) + '</circle>'
        + '</g>'
        + open('g', { id: 'dsh-pjx-meditator-art' })
        + open('g', { filter: 'url(#dsh-pjx-soft-glow)', opacity: '0.35' })
        + open('path', {
          d: 'M 37 112 C 41 97, 58 90, 80 90 C 102 90, 119 97, 123 112 C 112 117.5, 96 119.5, 80 119.5 C 64 119.5, 48 117.5, 37 112 Z',
          fill: '#6B5238',
        }) + '</path>'
        + open('circle', { cx: '80', cy: '33', r: '13.5', fill: '#6B5238' }) + '</circle>'
        + open('path', {
          d: 'M 64 52 C 60 68, 62 80, 67 93 C 75 97.5, 85 97.5, 93 93 C 98 80, 100 68, 96 52 C 91 44.5, 69 44.5, 64 52 Z',
          fill: '#6B5238',
        }) + '</path>'
        + '</g>'
        + open('ellipse', {
          cx: '80', cy: '119', rx: '47', ry: '8.5', fill: '#8A6A46', opacity: '0.7',
          filter: 'url(#dsh-pjx-haze)',
        }) + '</ellipse>'
        + open('g', { fill: 'url(#dsh-pjx-fig-grad)', filter: 'url(#dsh-pjx-haze)' })
        + open('path', {
          d: 'M 37 112 C 41 97, 58 90, 80 90 C 102 90, 119 97, 123 112 C 112 117.5, 96 119.5, 80 119.5 C 64 119.5, 48 117.5, 37 112 Z',
        }) + '</path>'
        + open('path', {
          d: 'M 64 52 C 60 68, 62 80, 67 93 C 75 97.5, 85 97.5, 93 93 C 98 80, 100 68, 96 52 C 91 44.5, 69 44.5, 64 52 Z',
        }) + '</path>'
        + open('path', { d: 'M 64 54 C 55 62, 51 78, 53 93 C 56 99, 62 101, 67 99 C 62 85, 62 68, 67 56 Z' }) + '</path>'
        + open('path', { d: 'M 96 54 C 105 62, 109 78, 107 93 C 104 99, 98 101, 93 99 C 98 85, 98 68, 93 56 Z' }) + '</path>'
        + open('ellipse', { cx: '80', cy: '95', rx: '7', ry: '4.5' }) + '</ellipse>'
        + open('circle', { cx: '80', cy: '33', r: '13.5' }) + '</circle>'
        + '</g>'
        + '</g>'
        + '</defs>'
        + open('g', { transform: 'translate(18, 492) scale(1.17)' })
        + open('use', { href: '#dsh-pjx-enso-art' }) + '</use>'
        + open('use', { href: '#dsh-pjx-meditator-art' }) + '</use>'
        + '</g>'
        + open('g', {})
        + open('path', {
          d: 'M 20 631 C 20 623, 25 619, 32 619 C 39 619, 44 623, 44 631 Z',
          fill: '#6B5644', opacity: '0.8',
        }) + '</path>'
        + open('ellipse', { cx: '32', cy: '620', rx: '11.7', ry: '3', fill: '#55432F', opacity: '0.9' }) + '</ellipse>'
        + open('path', { d: 'M 32 620 L 32 604', stroke: '#8A6E52', 'stroke-width': '1.9', 'stroke-linecap': 'round', fill: 'none' }) + '</path>'
        + open('circle', { cx: '32', cy: '603.5', r: '1.9', fill: '#E8A05A' }) + '</circle>'
        + open('circle', { cx: '32', cy: '603.5', r: '4', fill: '#E8A05A', opacity: '0.3' }) + '</circle>'
        + open('path', {
          class: 'pj-smoke pj-smoke-1',
          d: 'M 32 601 C 28 593, 36 586, 32 577 C 28 568, 35 561, 31 551',
          fill: 'none', stroke: '#FFFFFF', 'stroke-width': '2.4', 'stroke-linecap': 'round', opacity: '0.85',
          style: 'stroke-dasharray:90;stroke-dashoffset:90;filter:blur(1.4px);'
            + 'animation:dsh-amb-pj-smoke 7s linear infinite',
        }) + '</path>'
        + open('path', {
          class: 'pj-smoke pj-smoke-2',
          d: 'M 32 601 C 36 592, 28 584, 33 575 C 37 566, 30 558, 34 549',
          fill: 'none', stroke: '#FFF6E8', 'stroke-width': '1.9', 'stroke-linecap': 'round', opacity: '0.6',
          style: 'stroke-dasharray:90;stroke-dashoffset:90;filter:blur(1.6px);'
            + 'animation:dsh-amb-pj-smoke 7s linear infinite;animation-delay:-3.5s',
        }) + '</path>'
        + '</g>'
        + '</svg>'
        + '</div>'
        + dustNodes
        + open('div', {
          class: 'pj-words',
          style: 'position:absolute;left:0;right:0;bottom:2%;text-align:center;z-index:7;'
            + "font-family:'KaiTi','STKaiti','SimSun',serif;font-size:1.05em;line-height:1;"
            + 'color:#6B5233;letter-spacing:.45em;text-shadow:0 1px 0 rgba(255,250,240,.6)',
        })
        + '自在<span style="color:#B08D5F;margin:0 2px"> · </span>安顿'
        + '</div>'
        + '</div>'
    }

    /**
     * One falling phoenix feather for 光彩凤晨, ported from
     * `GuangCaiFengChenAnimation.vue`: a full gradient vane over a gold rachis.
     * Each feather carries its own gradient id, the same rule the dragonflies follow.
     * @param key - unique id suffix for this feather's gradient.
     * @returns the feather SVG.
     */
    function gcFeatherMarkup(key) {
      const gradient = `dsh-gc-feather-${key}`
      return open('svg', {
        viewBox: '0 0 40 90',
        style: 'display:block;width:100%;height:auto;overflow:visible;'
          + 'filter:drop-shadow(0 0 5px rgba(255,214,0,.3))',
      })
        + open('defs', {})
        + open('linearGradient', { id: gradient, x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0%', 'stop-color': '#FFEB3B', 'stop-opacity': '0.9' }) + '</stop>'
        + open('stop', { offset: '60%', 'stop-color': '#FF6F00', 'stop-opacity': '0.8' }) + '</stop>'
        + open('stop', { offset: '100%', 'stop-color': '#D50000', 'stop-opacity': '0' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + open('path', { d: 'M 20 4 C 27 22, 27 50, 20 86 C 13 50, 13 22, 20 4 Z', fill: `url(#${gradient})` }) + '</path>'
        + open('path', { d: 'M 20 8 L 20 82', stroke: '#FFE082', 'stroke-width': '1.2', 'stroke-linecap': 'round', opacity: '0.55', fill: 'none' }) + '</path>'
        + '</svg>'
    }

    /**
     * The 光彩凤晨 scene: sweeping dawn rays, falling phoenix feathers, a
     * brush-stroke phoenix flying out and back (the flip happens while transparent,
     * exactly as the source notes), and twinkling dew.
     *
     * Ported from `GuangCaiFengChenAnimation.vue`. The source's fill path references
     * a gradient that file never defines, so the rendered phoenix is strokes only —
     * this port keeps that rendered look with `fill="none"` instead of inventing a
     * fill the source never showed. Stroke widths are the source's effective values
     * (its `!important` class overrides baked in).
     * @param feathers - how many feathers to seed.
     * @param dew - how many dew drops to seed.
     * @returns the scene markup.
     */
    function fengchenAmbientScene(feathers, dew) {
      const featherCount = Math.max(0, Math.min(16, feathers ?? 6))
      let featherNodes = ''
      for (let n = 1; n <= featherCount; n += 1) {
        featherNodes += open('div', {
          class: 'gc-feather',
          style: `position:absolute;top:-6em;left:${((n * 23) % 80) + 8}%;width:2.6em;opacity:0;`
            + `animation:dsh-amb-gc-feather ${15 + ((n * 3) % 8)}s ease-in-out infinite;`
            + `animation-delay:${-(n * 1.5)}s`,
        })
          + open('div', {
            style: `transform:scale(${(0.5 + ((n * 7) % 6) / 10).toFixed(1)})`,
          })
          + gcFeatherMarkup(String(n))
          + '</div></div>'
      }

      const dewCount = Math.max(0, Math.min(30, dew ?? 10))
      let dewNodes = ''
      for (let n = 1; n <= dewCount; n += 1) {
        dewNodes += open('div', {
          class: 'gc-dew',
          style: 'position:absolute;width:3px;height:3px;border-radius:50%;opacity:.5;'
            + `left:${((n * 37) % 84) + 6}%;top:${((n * 29) % 62) + 6}%;`
            + 'background:radial-gradient(circle,#FFFFFF 0%,rgba(255,214,0,.8) 100%);'
            + 'box-shadow:0 0 8px rgba(255,214,0,.8);'
            + 'animation:dsh-amb-gc-dew 3s ease-in-out infinite alternate;'
            + `animation-delay:${-(n * 0.2)}s`,
        }) + '</div>'
      }

      const ray = (key, rotation, delay) => open('div', {
        class: `gc-ray gc-ray-${key}`,
        style: `position:absolute;top:26%;left:-30%;width:160%;height:46%;`
          + `transform:rotate(${rotation}deg);opacity:.5;pointer-events:none`,
      })
        + open('div', {
          style: 'position:absolute;inset:0;'
            + 'background:linear-gradient(45deg,transparent 0%,rgba(255,214,0,.12) 30%,rgba(255,111,0,.06) 60%,transparent 100%);'
            + `animation:dsh-amb-gc-ray 8s ease-in-out infinite alternate;animation-delay:${delay}`,
        }) + '</div>'
        + '</div>'

      return open('div', { class: 'gc', style: 'position:absolute;inset:0;display:block' })
        + ray('1', '-18', '0s')
        + ray('2', '-9', '-0.5s')
        + ray('3', '0', '-1s')
        + ray('4', '9', '-1.5s')
        + ray('5', '18', '-2s')
        + dewNodes
        + featherNodes
        + open('div', {
          class: 'gc-phoenix',
          style: 'position:absolute;top:14%;left:0;width:9.5em;z-index:8;will-change:transform;'
            + 'animation:dsh-amb-gc-fly 28s linear infinite',
        })
        + open('div', {
          class: 'gc-bob',
          style: 'animation:dsh-amb-gc-bob 3.4s ease-in-out infinite',
        })
        + open('svg', {
          viewBox: '0 0 800 600',
          style: 'display:block;width:100%;height:auto;overflow:visible;'
            + 'filter:drop-shadow(0 0 18px rgba(255,214,0,.55))',
        })
        + open('defs', {})
        + open('linearGradient', { id: 'dsh-gc-phoenix-stroke', x1: '0', y1: '0', x2: '1', y2: '0' })
        + open('stop', { offset: '0%', 'stop-color': '#FFEB3B' }) + '</stop>'
        + open('stop', { offset: '40%', 'stop-color': '#FF9800' }) + '</stop>'
        + open('stop', { offset: '100%', 'stop-color': '#D50000' }) + '</stop>'
        + '</linearGradient>'
        + open('filter', { id: 'dsh-gc-glow' })
        + open('feGaussianBlur', { stdDeviation: '2', result: 'coloredBlur' }) + '</feGaussianBlur>'
        + open('feMerge', {})
        + open('feMergeNode', { in: 'coloredBlur' }) + '</feMergeNode>'
        + open('feMergeNode', { in: 'SourceGraphic' }) + '</feMergeNode>'
        + '</feMerge>'
        + '</filter>'
        + '</defs>'
        + open('g', { filter: 'url(#dsh-gc-glow)', transform: 'translate(100, 100) scale(1.2)' })
        + open('path', {
          d: 'M 380 50 C 360 40 350 60 360 90 C 350 120 380 140 320 180 C 280 220 350 280 200 350 C 150 380 100 360 50 400 C 140 300 220 220 320 180 C 360 140 380 90 380 50 Z',
          fill: 'none',
        }) + '</path>'
        + open('path', {
          class: 'gc-head',
          d: 'M 380 50 Q 360 40 346 58 T 358 90 L 374 86',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '3.5', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-crest',
          d: 'M 360 50 Q 340 20 310 30',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '2.5', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-crest',
          d: 'M 365 55 Q 355 35 330 40',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '2.5', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-neck',
          d: 'M 360 90 C 350 120, 380 140, 320 180',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '7', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-wing gc-wing-main',
          d: 'M 340 110 C 260 70, 200 40, 140 90',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '6', fill: 'none', 'stroke-linecap': 'round',
          style: 'transform-box:fill-box;transform-origin:30% 40%;animation:dsh-amb-gc-wing 3.4s ease-in-out infinite',
        }) + '</path>'
        + open('path', {
          d: 'M 300 100 C 250 80, 180 80, 140 120',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          d: 'M 280 110 C 240 100, 180 110, 150 140',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-wing gc-wing-back',
          d: 'M 360 100 C 400 78, 452 66, 490 92',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round',
          style: 'transform-box:fill-box;transform-origin:30% 40%;animation:dsh-amb-gc-wing 3.4s ease-in-out infinite',
        }) + '</path>'
        + open('path', {
          d: 'M 370 110 C 400 100, 430 95, 460 110',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-tail-1',
          d: 'M 320 180 C 280 220, 350 280, 200 350 C 150 380, 100 360, 50 400',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '5', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-tail-2',
          d: 'M 310 185 C 250 250, 200 280, 100 300',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          class: 'gc-tail-3',
          d: 'M 330 175 C 300 220, 250 350, 150 420',
          stroke: 'url(#dsh-gc-phoenix-stroke)', 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('circle', { cx: '365', cy: '70', r: '2.5', fill: '#FFE082' }) + '</circle>'
        + '</g>'
        + '</svg>'
        + '</div></div>'
        + '</div>'
    }

    /**
     * One sun-warmed haze for the two ORIGINAL pet scenes (琥珀猫咪 / 虎子阿黄).
     *
     * Both scenes open with the same soft light pool at the band's top, built the way
     * dream's corner glow was taught to behave: it starts AT the edge, is dimmer than
     * the source skies, and is masked to zero at its top so the scene box's
     * `overflow:hidden` clip never cuts a hard line against the un-lit sidebar above.
     * @param tint - the rgba() fill of the haze, in the theme's own family.
     * @param keyframe - the pulse animation, `dsh-amb-hm-glow` or `dsh-amb-hz-glow`.
     * @returns the haze markup.
     */
    function petHazeMarkup(tint, keyframe) {
      return open('div', {
        class: 'pet-haze',
        style: `position:absolute;top:0;left:-20%;width:130%;height:52%;z-index:2;`
          + `background:radial-gradient(ellipse at 30% 0%,${tint} 0%,rgba(255,236,200,0) 64%);`
          + 'filter:blur(10px);'
          + '-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 42%);'
          + 'mask-image:linear-gradient(to bottom,transparent 0,#000 42%);'
          + `animation:${keyframe} 9s ease-in-out infinite alternate`,
      }) + '</div>'
    }

    /**
     * The 琥珀猫咪 scene: a warm haze, a sunlit sill, TWO tabby shorthairs —
     * one sitting with a slow tail sway and the odd ear twitch, one curled asleep,
     * breathing, with tiny z's drifting off it — and amber dust motes floating
     * through the light.
     *
     * This is the first ORIGINAL scene in the pack (not ported from a source
     * system), drawn in the pack's own idiom: inline geometry in % / em, flat
     * fills from one warm amber family, the count knob seeding the dust, and
     * every animated transform bounded below the band's top edge — the sleeping
     * cat breathes from its base and the z's fade out well before they could
     * reach the clip.
     * @param dust - how many dust motes to seed.
     * @returns the scene markup.
     */
    function humaoAmbientScene(dust) {
      const count = Math.max(0, Math.min(20, dust ?? 6))
      let dustNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 2.5 + ((n * 5) % 4)
        dustNodes += open('div', {
          class: 'hm-dust',
          style: 'position:absolute;border-radius:50%;'
            + `left:${((n * 19) % 52) + 22}%;top:${((n * 13) % 24) + 36}%;`
            + `width:${size}px;height:${size}px;`
            + 'background:radial-gradient(circle,rgba(255,236,200,.95) 0%,rgba(255,214,140,0) 100%);'
            + 'box-shadow:0 0 6px rgba(255,214,140,.75);'
            + `animation:dsh-amb-hm-dust ${9 + ((n * 7) % 6)}s linear infinite;`
            + `animation-delay:${-(n * 2.3)}s`,
        }) + '</div>'
      }

      // 猫 A —— 坐姿虎斑，面朝左（第一版形态：地面绕尾、橄榄形上身、后侧三道
      // 弧纹）。连接方式按用户指定：**不垫任何脖子形状**，头部整组（头圆 + 双耳
      // + 五官 + 胡须 + 额头纹）作为整体下移 28、右移 2，头圆下缘直接压进身体
      // 上缘约 7.5 个单位（肩点 (52,52) 距头心 14.1 < r15，也埋进头圆），同色
      // 填充使接缝不可见；下巴与胸口之间留下的小凹角正是猫下巴该有的位置。
      // 奶油色胸部椭圆按用户要求落在 (39,76)。
      const catSit = open('svg', {
        viewBox: '0 0 100 118',
        style: 'display:block;width:100%;height:auto;overflow:visible',
      })
        + open('g', {
          class: 'hm-tail',
          style: 'transform-box:fill-box;transform-origin:0% 100%;'
            + 'animation:dsh-amb-hm-tail 5.5s ease-in-out infinite alternate',
        })
        + open('path', {
          d: 'M62 112 C82 115 90 103 85 90 C82 82 74 80 70 84',
          fill: 'none', stroke: '#C98B4B', 'stroke-width': '7', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          d: 'M86 92 C83 84 76 81 71 84',
          fill: 'none', stroke: '#8A5A2B', 'stroke-width': '7', 'stroke-linecap': 'round',
        }) + '</path>'
        + '</g>'
        + open('path', {
          d: 'M30 116 C26 106 26 92 30 78 C34 64 42 56 52 52 C62 48 70 56 72 70 C74 86 72 104 66 116 Z',
          fill: '#D9A05B',
        }) + '</path>'
        + open('ellipse', { cx: '39', cy: '76', rx: '10', ry: '19', fill: '#F0D6A6' }) + '</ellipse>'
        + open('rect', { x: '32', y: '88', width: '6', height: '28', rx: '3', fill: '#E5BC7E', stroke: '#C98B4B', 'stroke-width': '1' }) + '</rect>'
        + open('rect', { x: '42', y: '88', width: '6', height: '28', rx: '3', fill: '#E5BC7E', stroke: '#C98B4B', 'stroke-width': '1' }) + '</rect>'
        + open('path', { d: 'M56 54 C64 58 68 64 70 72', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '4', 'stroke-linecap': 'round', opacity: '0.85' }) + '</path>'
        + open('path', { d: 'M60 74 C66 78 69 84 70 90', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '4', 'stroke-linecap': 'round', opacity: '0.85' }) + '</path>'
        + open('path', { d: 'M58 96 C63 99 66 104 67 110', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '4', 'stroke-linecap': 'round', opacity: '0.85' }) + '</path>'
        + open('path', { d: 'M34 40 L34 46 M38 39 L38 45 M30 41 L30 47', stroke: '#8A5A2B', 'stroke-width': '2', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M26 46 L23 31 L35 39 Z', fill: '#D9A05B' }) + '</path>'
        + open('path', { d: 'M27.5 43 L26 35 L33 40 Z', fill: '#C97B6B', opacity: '0.75' }) + '</path>'
        + open('g', {
          class: 'hm-ear',
          style: 'transform-box:fill-box;transform-origin:0% 100%;'
            + 'animation:dsh-amb-hm-ear 7s ease-in-out infinite',
        })
        + open('path', { d: 'M44 42 L52 30 L50 44 Z', fill: '#D9A05B' }) + '</path>'
        + open('path', { d: 'M46 40.5 L50.5 33.5 L48.5 41.5 Z', fill: '#C97B6B', opacity: '0.75' }) + '</path>'
        + '</g>'
        + open('circle', { cx: '38', cy: '54', r: '15', fill: '#D9A05B' }) + '</circle>'
        + open('circle', { cx: '32', cy: '52', r: '2.2', fill: '#3B2A16' }) + '</circle>'
        + open('circle', { cx: '44', cy: '52', r: '2.2', fill: '#3B2A16' }) + '</circle>'
        + open('circle', { cx: '32.7', cy: '51.2', r: '0.7', fill: '#FFFFFF' }) + '</circle>'
        + open('circle', { cx: '44.7', cy: '51.2', r: '0.7', fill: '#FFFFFF' }) + '</circle>'
        + open('path', { d: 'M36 58 L40 58 L38 61 Z', fill: '#C97B6B' }) + '</path>'
        + open('path', { d: 'M38 61 C38 63 36 64 34 64 M38 61 C38 63 40 64 42 64', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '1', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M26 57 L14 55 M26 60 L14 62 M52 57 L62 55 M52 60 L62 62', stroke: '#B98A55', 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.8' }) + '</path>'
        + '</svg>'

      // 猫 B —— 蜷成一团酣睡：圆头明显叠在身子右前侧（同色相接），折耳 +
      // 闭眼 + 鼻尖胡须 + 身前露出一只奶油色前爪，尾巴沿身前绕一圈、
      // 深色尾尖收在左侧；整体随呼吸微微起伏，头顶冒出两枚会消散的小 z。
      const catCurled = open('svg', {
        viewBox: '0 0 112 66',
        style: 'display:block;width:100%;height:auto;overflow:visible',
      })
        + open('g', {
          class: 'hm-breathe',
          style: 'transform-box:fill-box;transform-origin:50% 100%;'
            + 'animation:dsh-amb-hm-breathe 3.8s ease-in-out infinite',
        })
        + open('path', {
          d: 'M6 62 C6 44 24 28 52 27 C80 26 100 40 99 53 C98 60 92 62 84 62 Z',
          fill: '#D9A05B',
        }) + '</path>'
        + open('path', { d: 'M26 30 C28 38 28 48 26 57', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '4', 'stroke-linecap': 'round', opacity: '0.8' }) + '</path>'
        + open('path', { d: 'M38 28 C40 37 40 49 38 59', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '4', 'stroke-linecap': 'round', opacity: '0.8' }) + '</path>'
        + open('path', { d: 'M50 27 C52 36 52 47 51 56', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '4', 'stroke-linecap': 'round', opacity: '0.8' }) + '</path>'
        + open('path', { d: 'M6 58 C26 66 62 67 92 59', fill: 'none', stroke: '#C98B4B', 'stroke-width': '6', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M6 58 C12 61 18 63 24 64', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '6', 'stroke-linecap': 'round' }) + '</path>'
        + open('circle', { cx: '80', cy: '44', r: '15', fill: '#D9A05B' }) + '</circle>'
        + open('path', { d: 'M70 33 L65 23 L75.5 28.5 Z', fill: '#D9A05B' }) + '</path>'
        + open('path', { d: 'M88 31 L94 22 L95.5 32 Z', fill: '#D9A05B' }) + '</path>'
        + open('path', { d: 'M70.5 30.5 L68 25 L73.5 28 Z', fill: '#C97B6B', opacity: '0.75' }) + '</path>'
        + open('path', { d: 'M88.5 29.5 L92.5 24 L93.5 30.5 Z', fill: '#C97B6B', opacity: '0.75' }) + '</path>'
        + open('path', { d: 'M72 45 Q75 48 78 45', fill: 'none', stroke: '#8A5A2B', 'stroke-width': '1.4', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M65.5 46.5 L69 46.5 L67.25 49.5 Z', fill: '#C97B6B' }) + '</path>'
        + open('path', { d: 'M62 48.5 L54 47.5 M62 51 L55 52.5', stroke: '#B98A55', 'stroke-width': '1', 'stroke-linecap': 'round', opacity: '0.8' }) + '</path>'
        + open('ellipse', { cx: '60', cy: '60', rx: '7', ry: '3.5', fill: '#F0D6A6', stroke: '#C98B4B', 'stroke-width': '1' }) + '</ellipse>'
        + '</g>'
        + '</svg>'
        + open('span', {
          class: 'hm-z hm-z-1',
          style: 'position:absolute;right:12%;top:-12%;font-size:.85em;font-style:italic;'
            + "font-family:Georgia,'Times New Roman',serif;color:#A97F4C;"
            + 'animation:dsh-amb-hm-zzz 5s ease-in-out infinite',
        }) + 'z</span>'
        + open('span', {
          class: 'hm-z hm-z-2',
          style: 'position:absolute;right:5%;top:-22%;font-size:.65em;font-style:italic;'
            + "font-family:Georgia,'Times New Roman',serif;color:#B98F55;"
            + 'animation:dsh-amb-hm-zzz 5s ease-in-out infinite;animation-delay:-2.5s',
        }) + 'z</span>'

      return open('div', { class: 'hm', style: 'position:absolute;inset:0;display:block' })
        + petHazeMarkup('rgba(255,214,140,.5)', 'dsh-amb-hm-glow')
        + open('div', {
          class: 'hm-sill',
          style: 'position:absolute;left:0;right:0;bottom:0;height:12%;z-index:4;'
            + 'background:linear-gradient(to bottom,rgba(154,95,36,0) 0%,rgba(154,95,36,.16) 40%,rgba(138,84,30,.3) 100%)',
        })
        + open('div', {
          class: 'hm-sill-line',
          style: 'position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.55;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,244,220,.9),transparent)',
        }) + '</div>'
        + '</div>'
        + open('div', {
          class: 'hm-cat-sit',
          style: 'position:absolute;left:7%;bottom:9%;width:7.5em;z-index:6',
        }) + catSit + '</div>'
        + open('div', {
          class: 'hm-cat-curled',
          style: 'position:absolute;right:6%;bottom:7%;width:8.4em;z-index:6',
        }) + catCurled + '</div>'
        + dustNodes
        + '</div>'
    }

    /**
     * The 虎子阿黄 scene: a golden haze, a field-path bank, the yellow Chinese
     * pastoral dog himself — upright ears, a sickle tail wagging at speed, an
     * occasional curious head tilt, a straw collar with a bell — with dry
     * grass tufts, a ball in the theme's own 缃色, and dandelion fluff drifting
     * across on the wind.
     *
     * The second ORIGINAL scene in the pack, same idiom as the cat: inline
     * % / em geometry, one warm wheat-gold family, and every animated transform
     * bounded below the band's top edge — the fluff fades out at the far edge
     * instead of clipping.
     * @param dust - how many dandelion-fluff puffs to seed.
     * @returns the scene markup.
     */
    function ahuangAmbientScene(dust) {
      const count = Math.max(0, Math.min(20, dust ?? 5))
      let fluffNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 4 + ((n * 3) % 3)
        fluffNodes += open('div', {
          class: 'hz-fluff',
          style: 'position:absolute;border-radius:50%;'
            + `left:-6%;top:${((n * 11) % 30) + 18}%;`
            + `width:${size}px;height:${size}px;`
            + 'background:radial-gradient(circle,#FFFDF4 0%,rgba(255,246,214,.85) 55%,rgba(255,246,214,0) 100%);'
            + 'box-shadow:0 0 5px rgba(255,244,200,.8);'
            + `animation:dsh-amb-hz-fluff ${15 + ((n * 7) % 8)}s linear infinite;`
            + `animation-delay:${-(n * 2.6)}s`,
        }) + '</div>'
      }

      // 虎子阿黄 —— 坐姿面朝左。头与躯干同样按「必须重叠」构造：头部圆下缘
      // 压进胸腔椭圆上缘 3 个单位，项圈画在重叠带上把脖子束出来；立耳、
      // 镰刀尾（尾根埋进后臀圆里）快速摇摆、偶尔歪头，吐着舌头等主人。
      const dog = open('svg', {
        viewBox: '0 0 112 122',
        style: 'display:block;width:100%;height:auto;overflow:visible',
      })
        + open('g', {
          class: 'hz-tail',
          style: 'transform-box:fill-box;transform-origin:0% 100%;'
            + 'animation:dsh-amb-hz-wag .95s ease-in-out infinite alternate',
        })
        + open('path', {
          d: 'M76 70 C92 66 100 50 92 36 C88 30 82 29 78 32',
          fill: 'none', stroke: '#D8A44E', 'stroke-width': '8', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('path', {
          d: 'M93 37 C90 32 85 30 79 32',
          fill: 'none', stroke: '#B97F3A', 'stroke-width': '8', 'stroke-linecap': 'round',
        }) + '</path>'
        + '</g>'
        + open('circle', { cx: '72', cy: '94', r: '26', fill: '#E8B45A' }) + '</circle>'
        + open('ellipse', { cx: '44', cy: '93', rx: '18', ry: '27', fill: '#E8B45A' }) + '</ellipse>'
        + open('ellipse', { cx: '56', cy: '117', rx: '13', ry: '5', fill: '#E8B45A' }) + '</ellipse>'
        + open('ellipse', { cx: '42', cy: '97', rx: '10', ry: '19', fill: '#F6E3B8' }) + '</ellipse>'
        + open('rect', { x: '32', y: '92', width: '7.5', height: '26', rx: '3.7', fill: '#E8B45A', stroke: '#C98F35', 'stroke-width': '1' }) + '</rect>'
        + open('rect', { x: '44', y: '92', width: '7.5', height: '26', rx: '3.7', fill: '#E8B45A', stroke: '#C98F35', 'stroke-width': '1' }) + '</rect>'
        + open('ellipse', { cx: '35.7', cy: '117', rx: '6', ry: '3.2', fill: '#F6E3B8' }) + '</ellipse>'
        + open('ellipse', { cx: '47.7', cy: '117', rx: '6', ry: '3.2', fill: '#F6E3B8' }) + '</ellipse>'
        + open('path', { d: 'M31 68 C38 74 50 74 56 66', fill: 'none', stroke: '#896C39', 'stroke-width': '5', 'stroke-linecap': 'round' }) + '</path>'
        + open('circle', { cx: '33', cy: '72.5', r: '2.6', fill: '#F0C239', stroke: '#B98A20', 'stroke-width': '0.8' }) + '</circle>'
        + open('path', { d: 'M30.6 72.5 L35.4 72.5', stroke: '#B98A20', 'stroke-width': '0.8' }) + '</path>'
        + open('g', {
          class: 'hz-head',
          style: 'transform-box:fill-box;transform-origin:60% 88%;'
            + 'animation:dsh-amb-hz-tilt 7s ease-in-out infinite',
        })
        + open('path', { d: 'M28 40 C24 30 23 23 26 18 C30 21 34 28 35.5 36 Z', fill: '#D8A44E' }) + '</path>'
        + open('path', { d: 'M48 38 C50 28 52 21 56 18 C58 23 56 30 52.5 38.5 Z', fill: '#D8A44E' }) + '</path>'
        + open('path', { d: 'M29 36 C27 29 26.5 25 28 21.5 C30.5 24.5 32.5 29 33.5 34 Z', fill: '#C97B6B', opacity: '0.7' }) + '</path>'
        + open('path', { d: 'M49.5 34 C51 27.5 52.5 23.5 55 21 C56 25 54.5 30 52 35.5 Z', fill: '#C97B6B', opacity: '0.7' }) + '</path>'
        + open('circle', { cx: '42', cy: '51', r: '18', fill: '#E8B45A' }) + '</circle>'
        + open('ellipse', { cx: '27', cy: '57', rx: '11', ry: '8.5', fill: '#F6E3B8' }) + '</ellipse>'
        + open('ellipse', { cx: '19', cy: '53.5', rx: '3', ry: '2.4', fill: '#4A331C' }) + '</ellipse>'
        + open('circle', { cx: '44', cy: '47', r: '2.4', fill: '#3B2A16' }) + '</circle>'
        + open('circle', { cx: '44.8', cy: '46.2', r: '0.8', fill: '#FFFFFF' }) + '</circle>'
        + open('path', { d: 'M22.5 61 C24.5 64.5 29.5 65.5 32.5 62.5', fill: 'none', stroke: '#8A5F2B', 'stroke-width': '1.3', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M24 62.5 C28 63.5 29 67.5 27 70 C25 72 22 71 22 68.5 C22 66 22.5 64 24 62.5 Z', fill: '#DE7E68' }) + '</path>'
        + open('path', { d: 'M24.5 64 C25.5 65.5 25.8 67.5 25.2 69.5', fill: 'none', stroke: '#C05E4E', 'stroke-width': '0.9', 'stroke-linecap': 'round' }) + '</path>'
        + '</g>'
        + '</svg>'

      const grassTuft = (left, bottom, width, zIndex) => open('div', {
        class: 'hz-grass',
        style: `position:absolute;${left};bottom:${bottom};width:${width};z-index:${zIndex}`,
      })
        + open('svg', {
          viewBox: '0 0 60 30',
          style: 'display:block;width:100%;height:auto;overflow:visible',
        })
        + open('g', {
          class: 'hz-blades',
          style: 'transform-box:fill-box;transform-origin:50% 100%;'
            + 'animation:dsh-amb-hz-grass 5.2s ease-in-out infinite alternate',
        })
        + open('path', { d: 'M6 30 C4 22 6 14 10 8', fill: 'none', stroke: '#C2A24E', 'stroke-width': '2.6', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M14 30 C13 20 16 12 20 6', fill: 'none', stroke: '#B08F3E', 'stroke-width': '2.4', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M24 30 C24 20 27 12 32 7', fill: 'none', stroke: '#C2A24E', 'stroke-width': '2.2', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M36 30 C38 22 42 15 48 10', fill: 'none', stroke: '#B08F3E', 'stroke-width': '2.4', 'stroke-linecap': 'round' }) + '</path>'
        + open('path', { d: 'M46 30 C48 24 52 18 56 14', fill: 'none', stroke: '#C2A24E', 'stroke-width': '2.2', 'stroke-linecap': 'round' }) + '</path>'
        + '</g>'
        + '</svg>'
        + '</div>'

      return open('div', { class: 'hz', style: 'position:absolute;inset:0;display:block' })
        + petHazeMarkup('rgba(240,194,57,.42)', 'dsh-amb-hz-glow')
        + open('div', {
          class: 'hz-bank',
          style: 'position:absolute;left:0;right:0;bottom:0;height:14%;z-index:4;'
            + 'background:linear-gradient(to bottom,rgba(137,108,57,0) 0%,rgba(137,108,57,.16) 40%,rgba(120,92,44,.3) 100%)',
        })
        + open('div', {
          class: 'hz-bank-line',
          style: 'position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.5;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,250,228,.9),transparent)',
        }) + '</div>'
        + '</div>'
        + grassTuft('left:2%', '0', '4.5em', '5')
        + grassTuft('left:17%', '1%', '3.6em', '7')
        + grassTuft('right:3%', '0', '4.2em', '5')
        + open('div', {
          class: 'hz-ball',
          style: 'position:absolute;left:14%;bottom:8%;width:1.7em;z-index:6',
        })
        + open('svg', {
          viewBox: '0 0 20 20',
          style: 'display:block;width:100%;height:auto',
        })
        + open('circle', { cx: '10', cy: '10', r: '9', fill: '#F0C239', stroke: '#C9A02F', 'stroke-width': '1' }) + '</circle>'
        + open('path', { d: 'M4 4 C8 8 8 12 4 16 M16 4 C12 8 12 12 16 16', fill: 'none', stroke: '#B98A20', 'stroke-width': '1.2', 'stroke-linecap': 'round' }) + '</path>'
        + open('ellipse', { cx: '7', cy: '6.5', rx: '2.6', ry: '1.6', fill: '#FFF3C4', opacity: '0.85' }) + '</ellipse>'
        + '</svg>'
        + '</div>'
        + open('div', {
          class: 'hz-dog',
          style: 'position:absolute;left:32%;bottom:7%;width:8em;z-index:6',
        }) + dog + '</div>'
        + fluffNodes
        + '</div>'
    }

    /**
     * Apply a function on every tick until the thing it observes stops changing.
     *
     * This exists because the scenery has to be placed against a layout that is still being
     * built. The previous approach fired a fixed burst of animation frames plus three fixed
     * delays, all counted from the moment the plugin applied — the wrong clock entirely. The
     * shell mounts its sidebar whenever it is ready (after fonts, stores and window state),
     * which on this machine is later than 900ms; by then every retry had been spent and the
     * scenery stayed absent until something unrelated fired one more sync.
     *
     * So the wait is driven by the OBSERVED GEOMETRY rather than by elapsed time: sample it,
     * and once two consecutive samples agree, the shell has settled and the measurement can be
     * trusted. `apply` runs on every tick so the scenery keeps up while the layout moves, and
     * the loop stops as soon as it is stable — or after a bounded window, so a failed boot
     * cannot leave a timer running forever.
     *
     * The loop body is isolated from the DOM so it can be tested directly against a stub clock
     * and a stub sample: the bug it fixes is a timing bug, and a timing bug that cannot be
     * tested is how this one survived several rounds.
     * @param options - the loop's collaborators.
     * @param options.sample - returns a geometry fingerprint, or null when unavailable.
     * @param options.apply - runs each tick, before sampling.
     * @param options.setTimer - schedules a callback after a delay, returning a handle.
     * @param options.clearTimer - cancels a handle from `setTimer`.
     * @param options.now - current time in milliseconds.
     * @param options.intervalMs - delay between ticks.
     * @param options.maxMs - give up after this long.
     * @param options.stableTicks - consecutive equal samples required to call it settled.
     * @returns a handle with `stop()`, which cancels any pending tick.
     */
    function repeatUntilStable(options) {
      const {
        sample, apply, setTimer, clearTimer, now,
        intervalMs = 100,
        maxMs = 15000,
        stableTicks = 2,
      } = options
      const startedAt = now()
      let previous
      let stable = 0
      let handle
      let stopped = false

      const tick = () => {
        if (stopped) return
        apply()
        const signature = sample()
        if (signature !== null && signature === previous) stable += 1
        else stable = 0
        previous = signature
        const settled = signature !== null && stable >= stableTicks
        if (settled || now() - startedAt > maxMs) return
        handle = setTimer(tick, intervalMs)
      }

      handle = setTimer(tick, intervalMs)

      return {
        stop() {
          stopped = true
          if (handle !== undefined) clearTimer(handle)
          handle = undefined
        },
      }
    }

    /**
     * Pick the scene markup for a theme.
     *
     * Returns an empty string for a theme with no scenery, which is what clears the
     * seat — the scenery belongs to the skin, not to the app.
     * @param kind - the ambient kind.
     * @param options - the theme's ambient options.
     * @returns the markup.
     */
    function sceneMarkup(kind, options) {
      const markup = kind === 'shan'
        ? shanAmbientScene(options?.petals)
        : kind === 'dream'
          ? dreamAmbientScene(options?.bubbles, options?.motes, options?.fish)
          : kind === 'caiyun'
            ? caiyunAmbientScene(options?.stars)
            : kind === 'dongyun'
              ? dongyunAmbientScene(options?.snow)
              : kind === 'junyue'
                ? junyueAmbientScene(options?.stars)
                : kind === 'jiexin'
                  ? jiexinAmbientScene(options?.dust)
                  : kind === 'fengchen'
                    ? fengchenAmbientScene(options?.feathers, options?.dew)
                    : kind === 'humao'
                      ? humaoAmbientScene(options?.dust)
                      : kind === 'ahuang'
                        ? ahuangAmbientScene(options?.dust)
                        : ''
      // The builder is fed only attributes and hex values, but this is the one place
      // markup from outside this file could ever arrive, so it refuses anyway.
      if (/<script|\son[a-z]+\s*=/i.test(markup)) {
        throw new Error('theme-gallery: refusing scenery markup containing script or handlers')
      }
      return markup
    }

    function sidebarColumn() {
      if (typeof document === 'undefined') return null
      return document.querySelector('[data-windows-titlebar] .ZTP-Xa_sidebarCol')
        || document.querySelector('.ZTP-Xa_sidebarCol')
        || document.querySelector('[class*="_sidebarCol"]')
        || document.querySelector('aside[class*="sidebar" i]')
        || null
    }

    /**
     * Mount a React element into a plain DOM node owned by this plugin.
     *
     * The scenery cannot go through the slot system — the sidebar column has no
     * slot for scenery, and a slot component would be a child of the column rather
     * than a layer behind it. So this owns the seat, and is the ONLY place in this
     * plugin that touches the shell's DOM directly.
     */
    let ambientPaintError

    /**
     * What the last scenery sync actually achieved, for the debug line.
     *
     * Kept because "the scenery did not appear" has several indistinguishable
     * causes from outside the app — sidebar not found, seat never created, a mount
     * that failed, or a seat with zero size — and only the live element separates
     * them.
     */
    let ambientReport

    /**
     * The signature of the last scenery sync that actually touched the DOM.
     *
     * `syncAmbient` is invoked from a body-wide `MutationObserver` and also writes to the DOM,
     * so it can observe its own writes. Comparing this before doing any work is what breaks
     * that cycle — see the long note inside `syncAmbient`. Reset to `undefined` whenever the
     * sync bails out, so the next call is allowed to try again.
     */
    let lastAmbientFingerprint

    /**
     * A rolling log of every attempt to place the scenery, newest last.
     *
     * The previous diagnostics reported only the FINAL state, which cannot distinguish
     * "never computed" from "computed wrongly and then corrected". That gap is exactly where
     * the boot-time bug lived: the scenery was synced while the sidebar did not exist yet,
     * bailed out, and nothing said so — the report simply showed the last, healthy run.
     *
     * Each entry records when an attempt happened, whether the column was found, and the
     * geometry that was actually used.
     */
    const AMBIENT_LOG_LIMIT = 12
    let ambientLog = []

    /** When this module began, for readable relative timings in the log. */
    const bootAt = typeof Date.now === 'function' ? Date.now() : 0

    /** When the page itself started, so a late first sync is visible as such. */
    const pageAt = (() => {
      try {
        const origin = typeof performance !== 'undefined' ? performance.timeOrigin : undefined
        return typeof origin === 'number' && origin > 0 ? origin : bootAt
      } catch {
        return bootAt
      }
    })()

    /**
     * Milliseconds since the page began loading.
     *
     * The log used to be relative to PLUGIN start only, which hid the single most important fact
     * during the boot investigation: when the first sync actually happened. Every entry shown was
     * already tens of seconds old, so "did anything run during startup?" could not be answered
     * from the panel at all. Anchoring to the page makes a late start obvious.
     * @returns milliseconds since page start.
     */
    function sincePageStart() {
      try {
        return Math.max(0, Math.round(Date.now() - pageAt))
      } catch {
        return 0
      }
    }

    /**
     * Record one scenery-sync attempt.
     * @param entry - the attempt, without its timestamp.
     */
    function noteAmbientAttempt(entry) {
      try {
        const now = Date.now()
        ambientLog.push({
          // `bootAt` is 0 only when `Date.now` is unavailable, and then 0 is the honest value.
          t: bootAt === 0 ? 0 : now - bootAt,
          page: sincePageStart(),
          ...entry,
        })
        if (ambientLog.length > AMBIENT_LOG_LIMIT) ambientLog = ambientLog.slice(-AMBIENT_LOG_LIMIT)
      } catch {
        // Diagnostics must never break the feature they are diagnosing.
      }
    }

    /**
     * Record a lifecycle DECISION, which is not a sync attempt.
     *
     * The boot investigation kept stalling because the log held only sync attempts, so a gate that
     * silently refused to act left no trace whatsoever — `ensureSkinPainted` returning early
     * because `bootSettled` was still false, or `markBootSettled` never firing, were both
     * invisible. Decisions are now recorded alongside the attempts.
     *
     * A repeated state COLLAPSES into its existing line instead of appending another. These paths
     * run every frame, and a ring buffer of twelve identical entries buries the one line that
     * matters: during the boot investigation the first sync was tens of seconds earlier than
     * everything else, and by the time the panel was opened to read the log it had long been
     * pushed out by repeats.
     * @param label - a short decision label, e.g. `未上色·跳转一次`.
     * @param detail - optional extra context.
     */
    function noteAmbientEvent(label, detail) {
      try {
        const text = detail === undefined ? label : `${label}(${detail})`
        const last = ambientLog.length === 0 ? undefined : ambientLog[ambientLog.length - 1]
        if (last !== undefined && last.band === text) {
          // Same state: refresh the clock rather than adding a line, so "still here" reads as a
          // recent time and the rest of the buffer stays available for state CHANGES.
          last.t = bootAt === 0 ? 0 : Date.now() - bootAt
          last.page = sincePageStart()
          return
        }
        ambientLog.push({
          t: bootAt === 0 ? 0 : Date.now() - bootAt,
          page: sincePageStart(),
          column: true,
          band: text,
        })
        if (ambientLog.length > AMBIENT_LOG_LIMIT) ambientLog = ambientLog.slice(-AMBIENT_LOG_LIMIT)
      } catch {
        // Diagnostics must never break the feature they are diagnosing.
      }
    }

    /**
     * Render the attempt log as one line.
     * @returns a compact, ordered summary of recent attempts.
     */
    function describeAmbientLog() {
      if (ambientLog.length === 0) return '（无记录）'
      return ambientLog
        .map((e) => {
          // Two clocks: `p` is since page start (when boot really began), `+` is since this plugin
          // mounted. Comparing them is what exposes a late start.
          const at = `p${e.page ?? '?'}/+${e.t}ms`
          if (e.column === false) return `${at} 无侧栏`
          return `${at} ${e.band === undefined ? '几何未测' : e.band}`
        })
        .join(' | ')
    }


    /**
     * Draw a scene into the seat.
     *
     * @param element - the scene element, or null to clear the seat.
     * @param seat - the seat node inside the sidebar column.
     */
    /**
     * Where the scenery band goes, in viewport coordinates.
     *
     * The band fills the sidebar's BLANK AREA: it stops above the account row and reaches
     * up roughly a third of the column.
     *
     * Two corrections are folded in here. A cap of 420px once put the band's top at 55% of
     * a 780px column — the middle of the sidebar rather than its lower third. And the band
     * used to run to the column's very bottom, which is where the account row lives: the
     * water band ended up over the signed-in user's avatar and name, and because this layer
     * is pointer-transparent the area stayed clickable, so it read as a broken menu rather
     * than a covered one.
     *
     * `footerHeight()` measures that reserved strip instead of hard-coding a value, so the
     * band follows the row if its size changes.
     * @param column - the sidebar column.
     * @returns the band box, or null when the column is unmeasurable.
     */
    function bandBox(column) {
      const rect = column.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null

      // Reserved strip at the bottom: the account row with the avatar and nickname.
      //
      // Clamped so the measurement can never consume the band. Early in boot the shell's
      // layout is not settled and this probe can read something far too tall; without the
      // clamp the band collapsed and the scenery silently disappeared until an unrelated
      // repaint brought it back — which is why the artwork only showed up after opening the
      // settings panel.
      const reserved = Math.min(footerHeight(column), Math.max(0, Math.round(rect.height * 0.25)))

      // The band is placed by POSITION, not by a share of the height.
      //
      // Sizing it as a fraction of the column ("height = 30% of usable", "40%") kept the
      // right footprint but moved its CENTRE around: on a 780px column a 288px band spanned
      // 472..760, so its middle sat at y=616 — inside the sidebar's MIDDLE third, not the
      // bottom third the artwork is meant to occupy. The user's framing is the correct one:
      // the sidebar reads as three stacked regions, and the scenery belongs in the lowest
      // one.
      //
      // So the top edge is pinned to the start of the bottom third and the band extends down
      // to the account row. On a taller window the third starts lower, the band is taller,
      // and the artwork grows in place instead of drifting upward.
      const thirdStart = rect.top + (rect.height * 2) / 3
      const bottom = Math.min(rect.bottom - reserved, viewportBottomOf(rect))
      let top = Math.max(thirdStart, rect.top)
      // A very short column would leave nothing; fall back to a usable minimum.
      if (bottom - top < 150) top = Math.max(rect.top, bottom - 150)
      return {
        left: Math.round(rect.left),
        top: Math.round(top),
        width: Math.round(rect.width),
        height: Math.max(1, Math.round(bottom - top)),
      }
    }

    /**
     * The lowest y the scenery may reach.
     *
     * On a short window the column's bottom edge can sit below the viewport, and artwork
     * placed there is simply not visible, so the visible bottom wins.
     * @param rect - the column's rectangle.
     * @returns the y coordinate to stop at.
     */
    function viewportBottomOf(rect) {
      if (typeof window === 'undefined') return rect.bottom
      return Math.min(rect.bottom, window.innerHeight)
    }

    /**
     * Height of the strip at the column's bottom that scenery must not cover.
     *
     * That strip is the account row — the avatar and nickname the user is signed in as. The
     * artwork used to be drawn straight over it, and because this layer is
     * pointer-transparent the row stayed clickable, so it read as a broken menu rather than
     * a covered one.
     *
     * Measuring "the descendant nearest the bottom edge" does not work: the shell's own
     * full-height wrappers are flush with it, so the shortest distance is always 0. What
     * distinguishes the account row is its SHAPE — a short, full-width bar anchored to the
     * bottom — so that is what is matched.
     * @param column - the sidebar column.
     * @returns the reserved height in px, clamped to a sane range.
     */
    function footerHeight(column) {
      try {
        const rect = column.getBoundingClientRect()
        let reserve = 0
        for (const node of column.querySelectorAll('*')) {
          // Skip this plugin's own overlay, which is not part of the shell's layout.
          if (node.closest('#dsh-theme-ambient, .dsh-amb-control') !== null) continue
          const r = node.getBoundingClientRect()
          if (r.width < rect.width * 0.5) continue
          if (r.height < 28 || r.height > 96) continue
          const distance = rect.bottom - r.bottom
          if (distance > 24) continue
          const needed = r.height + distance
          if (needed > reserve) reserve = needed
        }
        // The reservation is kept as tight as the measurement allows. It only has to clear
        // the account row, and every pixel beyond that shows as a gap between the artwork
        // and the row — which is what "too much height reserved" describes. A small constant
        // padding is added rather than a proportional one, because the row is a fixed-height
        // control that does not grow with the window.
        const measured = reserve === 0 ? 52 : reserve
        return Math.max(56, Math.min(measured + 2, 72))
      } catch {
        return 60
      }
    }

    /**
     * Whether this plugin's ambient stylesheet is actually in the document.
     *
     * The seat must never be created before it. `syncAmbient` runs on every shell
     * mutation, so without this guard it could create the seat during a window when
     * `AMBIENT_CSS` was not yet installed — leaving an UNSTYLED div in normal flow at
     * the bottom of the sidebar. That is exactly the stray block that appeared over
     * the main column and covered conversation text: an unstyled element joins the
     * layout instead of sitting behind it, and every later report still looks
     * healthy because the element does exist.
     *
     * A seat without its stylesheet is worse than no seat.
     * @returns true when the stylesheet element is in the document.
     */
    function ambientStylesheetReady() {
      if (typeof document === 'undefined') return false
      return document.querySelector('style[data-plugin-css="theme-gallery/ambient"]') !== null
    }

    /**
     * Put the ambient stylesheet into the document, and keep it there.
     *
     * Self-healing on purpose. A one-shot install inside an effect assumed the sheet
     * would survive, and in the shipped app it did not: the report kept reading
     * `css=false`, which silently turned the guard above into a permanent no-op — the
     * guard was right, the sheet was simply never there. Because the guard bails out
     * while the sheet is absent, one failed install disabled the scenery for good.
     *
     * The document is searched for the sheet directly rather than trusting a cached
     * reference, because the failure being defended against is precisely "our
     * reference is stale".
     * @returns the stylesheet element, or null when there is no document.
     */
    function ensureAmbientStylesheet() {
      if (typeof document === 'undefined') return null
      const existing = document.querySelector('style[data-plugin-css="theme-gallery/ambient"]')
      // A sheet that is present but STALE is worse than none. The shell keeps its DOM
      // across a plugin reload, so the previous build's sheet survives — and a check that
      // only asks "is a sheet there?" happily reuses rules that no longer match this
      // build. That is exactly what happened: the layer was restructured, the old sheet
      // stayed, and every new rule was missing while the check insisted the sheet existed.
      if (existing !== null) {
        if (existing.textContent === AMBIENT_CSS) return existing
        existing.remove()
      }

      const tag = document.createElement('style')
      tag.dataset.plugin = 'theme-gallery'
      tag.dataset.pluginCss = 'theme-gallery/ambient'
      tag.textContent = AMBIENT_CSS
      // `head` can be absent if this runs before the parser produced one; appending to
      // the document element still applies the rules.
      if (document.head !== null) document.head.append(tag)
      else document.documentElement.append(tag)
      return tag
    }

    /**
     * Remove any ambient node that this run does not own.
     *
     * An earlier revision could leave a stray seat behind — unstyled, in the layout,
     * covering the main column — and because the shell keeps its DOM across a plugin
     * reload, such a node outlives the code that made it. Cleaning up on sight means a
     * fixed build repairs the previous build's damage instead of inheriting it.
     *
     * Seats are matched anywhere in the document now that the layer lives on the body,
     * so ownership is decided by an attribute this run stamps rather than by parentage.
     */
    function removeStrayAmbientSeats() {
      if (typeof document === 'undefined') return
      for (const seat of document.querySelectorAll('#dsh-theme-ambient')) {
        if (seat.dataset.ambientOwner === AMBIENT_OWNER) continue
        seat.remove()
      }
    }

    /**
     * Remove every legacy ambient SEAT, ownership aside.
     *
     * Despite the name it does NOT touch the live `.dsh-amb-control` layer: that layer is
     * owned by `drawScene`, and it is only rewritten when a theme actually has scenery. So
     * this call is safe on the "theme has no scenery" path, where leaving the layer in
     * place is the INTENDED behaviour — see the note in `syncAmbient`.
     */
    function removeAllAmbientSeats() {
      if (typeof document === 'undefined') return
      for (const seat of document.querySelectorAll('#dsh-theme-ambient')) seat.remove()
    }

    /**
     * Depth counter for theme changes this plugin causes ITSELF.
     *
     * ── THE SELF-DRIVING LOOP THIS EXISTS TO STOP ───────────────────────────
     *
     * `ctx.theme.overrideTokens()` and `ctx.theme.setTheme()` both emit `theme/change`, and the
     * plugin subscribes to that event and calls `publish()`, which calls `syncSkin()`, which
     * calls back into `overrideTokens()`. Nothing in that cycle yields to the event loop, so it
     * is not a slow loop — it is a spin.
     *
     * The old brake was `stackedSkin === id`, and it could not work: `stackSkinTokens` clears
     * `stackedSkin` BEFORE calling `overrideTokens` (to dispose the previous layer), so the
     * handler that `overrideTokens` synchronously triggers sees `stackedSkin === undefined` and
     * stacks another layer — for ever. Measured on the real app: renderer RSS to 11 GB and ~2.7
     * cores of accumulated CPU, with main/host/GPU perfectly normal and no crash log, because
     * nothing throws.
     *
     * A depth counter is used rather than a boolean so nested emits (a disposer called while
     * stacking) are handled correctly: the flag is only clear once every emit has returned.
     * @type {number}
     */
    let selfEmitDepth = 0

    /**
     * Run something that will emit `theme/change` as a consequence of this plugin's own action.
     *
     * The subscription installed later checks {@link selfEmitDepth} and declines to react, so an
     * action cannot be re-entered through the event it caused. That is the only reliable brake:
     * comparing values cannot distinguish "the service changed underneath me" from "I just
     * changed the service", and the whole defect was that distinction.
     * @param action - the action to run under the guard.
     * @returns whatever the action returns.
     */
    function emitting(action) {
      selfEmitDepth += 1
      try {
        return action()
      } finally {
        selfEmitDepth -= 1
      }
    }

    /**
     * A kill switch, read from this bundle's own composition patch.
     *
     * Until now the only lever for stopping a misbehaving skin was removing the plugin from
     * `dsh.profile.bundles` — and on the desktop that list is not hand-maintained. The
     * application re-derives it from `dependencies` whenever a package is installed, enabled or
     * optimised, so a package declaring `dsh.bundle.patch` is written straight back and the
     * plugin returns on its own. There was no emergency brake on the plugin's side.
     *
     * With this, either layer can be switched off in `cordis.patch.yml` without touching the
     * bundle list, which means a broken skin can be defused without fighting the installer:
     *
     *     - id: theme-gallery
     *       name: dsh-theme-gallery
     *       config:
     *         ambient: false      # 停掉氛围装饰层与皮肤恢复
     *
     * Anything other than an explicit `false` leaves both layers on, so an absent config behaves
     * exactly as before.
     * @returns whether the ambient and skin-restore layers may run.
     */
    function ambientEnabled() {
      try {
        const config = ctx?.config
        if (config === undefined || config === null) return true
        return config.ambient !== false
      } catch {
        // A config that cannot be read must not disable the feature.
        return true
      }
    }

    let restoreDisabledReason
    /**
     * A global budget and cooldown for `setTheme`.
     *
     * The per-skin "one bounce" allowance only covered the `wanted === activeId` branch. The
     * other branch — a plain `setTheme(wanted)` taken whenever the service reports a different
     * theme — had no cooldown and no budget, and it runs on every publish. Because the shell's
     * `adopt()` puts the active id back to a built-in value, that branch could be taken
     * indefinitely: setTheme → theme/change → publish → setTheme.
     *
     * These counters bound the damage no matter which path asks: at most 6 calls per session and
     * at least 1 second apart. When the budget is gone the plugin stops asking and says so in the
     * panel, rather than burning the renderer to no effect.
     */
    const THEME_WRITE_BUDGET = 6
    const THEME_WRITE_COOLDOWN_MS = 1000
    let themeWrites = 0
    let lastThemeWriteAt = 0

    /**
     * Ask the theme service for a skin, under the global budget.
     * @param id - the theme id to request.
     * @returns whether the request was actually made.
     */
    function requestTheme(id) {
      if (restoreDisabledReason !== undefined) return false
      if (themeWrites >= THEME_WRITE_BUDGET) {
        restoreDisabledReason = `已停止自动恢复皮肤（本次会话写主题 ${THEME_WRITE_BUDGET} 次上限已到）`
        noteAmbientEvent('主题写入预算耗尽', id)
        return false
      }
      if (Date.now() - lastThemeWriteAt < THEME_WRITE_COOLDOWN_MS) return false
      themeWrites += 1
      lastThemeWriteAt = Date.now()
      // Marked as self-caused so the subscription ignores the `theme/change` this produces.
      emitting(() => ctx.theme.setTheme(id))
      return true
    }

    /**
     * Render the active theme's scenery into the sidebar column.
     *
     * Idempotent: the scene box is reused and its content is replaced only when the markup
     * changes, so re-running never stacks duplicate scenes (two copies of a scene = two of
     * every animated element, which is what produced the duplicated dragonflies).
     *
     * Two different "no scenery" cases, and they are NOT the same:
     *
     *  · switching to ANOTHER skin — the markup differs, so the box is repainted with the
     *    new skin's artwork;
     *  · switching to a theme that has no `ambient` at all — the BUILT-IN 浅色 / 深色 cards.
     *    Only the legacy seats are swept; the live `.dsh-amb-control` layer is deliberately
     *    LEFT ALONE, so the previous skin's artwork (balloons, fish, mountains…) stays on
     *    screen over the system palette. That leftover is a feature the user asked to keep
     *    — the built-in cards advertise it ("会有惊喜哦") and
     *    `tests/check-boot-path.mjs` asserts it, so a later "cleanup" cannot remove it
     *    without turning the test red.
     * @param kind - the ambient kind, or undefined for none.
     * @param options - the theme's ambient options.
     */
    function syncAmbient(kind, options, record = true) {
      if (typeof document === 'undefined') return
      // The kill switch. `cordis.patch.yml` sets `config: { ambient: false }` to stop the whole
      // scenery layer, which is the only lever that works without editing the bundle list — the
      // desktop re-derives that list from `dependencies`, so removing the package does not stick.
      if (!ambientEnabled()) return

      // ── THE IDEMPOTENCE TEST MUST COME BEFORE *ANY* WRITE ────────────────────
      //
      // This function is driven by a `MutationObserver` over the whole body, so anything it
      // writes schedules another call. The guard therefore has to be the FIRST thing that happens,
      // and the two calls below it write DOM:
      //
      //   • `ensureAmbientStylesheet()` appends (or replaces) the `<style>` node;
      //   • `removeStrayAmbientSeats()` removes nodes.
      //
      // Both used to run BEFORE the fingerprint test, which meant the test could never prevent a
      // write — every pass wrote at least the stylesheet's absence-check, the observer fired
      // again, and the cycle was self-sustaining regardless of the fingerprint. The test also
      // reset the fingerprint on its two bail-out paths, so those windows disabled it entirely.
      //
      // The order is now: measure cheaply (a rect read and a string) → decide → only then write.
      // The fingerprint is intentionally cheap — a few numbers and a markup length — because this
      // runs up to once per frame and anything geometry-derived would call `footerHeight`, which
      // walks every descendant of the sidebar.
      const column = sidebarColumn()
      if (column !== null) {
        const columnRect = column.getBoundingClientRect()
        const markup = sceneMarkup(kind, options)
        const fingerprint = [
          kind ?? '',
          JSON.stringify(options ?? {}),
          markup.length,
          Math.round(columnRect.width),
          Math.round(columnRect.height),
          ambientStylesheetReady() ? 'css' : 'nocss',
        ].join('|')
        if (fingerprint === lastAmbientFingerprint && ambientReport !== undefined) {
          if (record) noteAmbientAttempt({ kind: kind ?? '(无)', column: true, band: '未变化(跳过)' })
          return
        }
        lastAmbientFingerprint = fingerprint
      }

      // Repair, then proceed. A one-shot install was assumed to survive and did not —
      // the report kept reading `css=false`, which quietly turned the guard below into
      // a permanent no-op. Re-adding the sheet here makes the scenery independent of
      // whatever removes the node.
      ensureAmbientStylesheet()
      removeStrayAmbientSeats()
      // A seat created before the stylesheet landed is a stray block in the layout,
      // not scenery. Remove it so the next pass can build a properly positioned one;
      // the un-styled state is the only one that can spill over the main column.
      if (!ambientStylesheetReady()) {
        removeAllAmbientSeats()
        if (record) noteAmbientAttempt({ kind, column: column !== null, note: '样式表未就绪' })
        ambientReport = { found: false, note: '等待氛围样式表就位（已清除无样式节点，避免其落入布局）' }
        return
      }
      if (column === null) {
        removeAllAmbientSeats()
        if (record) noteAmbientAttempt({ kind, column: false })
        ambientReport = { found: false, note: '未找到侧栏列（三个选择器全部落空）' }
        return
      }

      const markup = sceneMarkup(kind, options)

      if (markup === '') {
        // ── THE LIVE LAYER IS NOT TOUCHED HERE, ON PURPOSE ───────────────────────
        //
        // This branch runs when the active theme has no scenery — i.e. after clicking one of
        // the built-in 浅色 / 深色 cards. `removeAllAmbientSeats()` only sweeps
        // `#dsh-theme-ambient` SEATS (a container earlier builds created); the layer that
        // actually paints is `.dsh-amb-control`, and it is only ever rewritten by
        // `drawScene()`. So the previous skin's artwork stays where it is.
        //
        // That is the user's "惊喜": pick a skin, then switch to 浅色 / 深色, and the
        // sidebar keeps the balloons / fish / mountains while the palette goes back to the
        // system appearance. It is asserted in `tests/check-boot-path.mjs`
        // (「切到内置主题后装饰层保留」) — do not "fix" it by clearing the layer here.
        removeAllAmbientSeats()
        if (record) noteAmbientAttempt({ kind, column: true, band: '无装饰' })
        ambientReport = { found: true, kind: '(none)', note: '该主题无装饰', css: ambientStylesheetReady() }
        return
      }

      // ── ONE RENDER PATH, NOT TWO ─────────────────────────────────────────────
      //
      // This used to draw the scene TWICE into two sibling containers: once into a
      // `#dsh-theme-ambient` seat, and again into the `.dsh-amb-control` layer that was added
      // while the painting defect was being investigated. The control layer is the one that
      // actually renders, so the seat was dead weight — except that its copy of the DOM was
      // real. Two copies of the same scene means two of every animated element, which is what
      // produced the duplicated dragonflies.
      //
      // The surviving container is `.dsh-amb-control`, whose arrangement is the one proven to
      // paint (see the comment on AMBIENT_CSS); the seat is no longer created and any seat left
      // over from an earlier build is swept away above.
      const placement = drawScene(column, markup, kind)
      if (record) noteAmbientAttempt({ kind, column: true, band: placement.band })
      ambientReport = placement.report
    }

    /**
     * Draw the scene into the single ambient layer, and report what landed.
     *
     * The layer itself is a full-viewport fixed element styled by a CLASS — the arrangement copied
     * from the working `dsh-theme-firefly` plugin. Inside it, the scene box is positioned over the
     * sidebar's blank area. Splitting those two concerns is what makes both possible at once: the
     * layer takes the arrangement known to paint, and the artwork keeps the placement asked for.
     * @param column - the sidebar column to anchor the scene to.
     * @param markup - the scene markup.
     * @param kind - the ambient kind, for the report.
     * @returns the band description and the report.
     */
    function drawScene(column, markup, kind) {
      let wrap = document.querySelector('.dsh-amb-control')
      if (wrap === null) {
        wrap = document.createElement('div')
        wrap.className = 'dsh-amb-control'
        document.body.appendChild(wrap)
      }
      let box = wrap.querySelector(':scope > .dsh-amb-control-scene')
      if (box === null) {
        box = document.createElement('div')
        box.className = 'dsh-amb-control-scene'
        wrap.appendChild(box)
      }

      // GEOMETRY every pass; CONTENT only when it changes.
      //
      // Re-assigning `innerHTML` rebuilt every scene node, which restarts all CSS animations from
      // zero — visible as the artwork snapping back to its starting position. Geometry has to be
      // rewritten because it is measured; the markup does not, because it is derived from the
      // theme alone.
      applySceneBox(box, column)
      const painted = box.dataset.ambientMarkup
      if (painted !== markup) {
        box.dataset.ambientMarkup = markup
        box.innerHTML = String(markup)
      }

      const rect = box.getBoundingClientRect()
      return {
        band: `y${Math.round(rect.top)}..${Math.round(rect.bottom)}`,
        report: describeAmbient(wrap, kind, `场景=${Math.round(rect.width)}x${Math.round(rect.height)}`),
      }
    }

    /**
     * Position the scene box over the sidebar's blank area.
     *
     * Split out from the painting so a resync can refresh the geometry without disturbing the
     * scene's DOM — and therefore without restarting its animations.
     * @param box - the scene box.
     * @param column - the sidebar column to anchor to.
     */
    function applySceneBox(box, column) {
      // The scenery occupies the sidebar's BLANK AREA, not its whole height.
      //
      // Full height put the water band at the column's bottom, which is where the account
      // row lives — the artwork ended up covering the signed-in user's avatar and name
      // (clicks still reached it, because the layer is pointer-transparent, so the menu
      // looked broken rather than covered). The bottom third is the region the request
      // named for the main artwork, and it stops short of the account row.
      const band = bandBox(column)
      const rect = column.getBoundingClientRect()
      const top = band === null ? Math.round(rect.top) : band.top
      const height = band === null ? Math.round(rect.height) : band.height
      box.setAttribute('style', [
        'position:absolute',
        `left:${Math.round(rect.left)}px`,
        `top:${top}px`,
        `width:${Math.round(rect.width)}px`,
        `height:${height}px`,
        // No background of its own: anything opaque here would sit on top of the sidebar
        // and hide the shell's own menu. The box exists to give the artwork a frame, not to
        // be seen.
        'overflow:hidden',
      ].join(';'))
    }


    /**
     * Name the topmost element at a point, and why it is on top.
     *
     * `elementFromPoint` alone said *who* wins; it did not say *why*, and this layer
     * kept losing to the shell's own containers even at the maximum z-index. That means
     * an ancestor stacking context decides the order, not the element's own `z-index`.
     * Walking the winner's ancestors and reporting the nearest one that establishes a
     * stacking context names the thing that actually has to be outranked.
     * @param x - viewport x.
     * @param y - viewport y.
     * @returns a short description.
     */
    function describeTopmost(x, y) {
      const hit = document.elementFromPoint(x, y)
      if (hit === null) return '空'
      const tag = hit.tagName === undefined ? '?' : hit.tagName.toLowerCase()
      const classes = typeof hit.className === 'string' && hit.className !== ''
        ? `.${hit.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : ''
      let node = hit
      let context = '无'
      let depth = 0
      while (node !== null && depth < 12) {
        const style = getComputedStyle(node)
        const positioned = style.position !== 'static'
        const opacity = Number(style.opacity)
        const owns = (positioned && style.zIndex !== 'auto')
          || (Number.isFinite(opacity) && opacity < 1)
          || style.isolation === 'isolate'
          || style.transform !== 'none'
        if (owns) {
          const owner = node === hit ? '自身' : node.tagName.toLowerCase()
          context = `${owner} z=${style.zIndex} pos=${style.position}`
          break
        }
        node = node.parentElement
        depth += 1
      }
      return `${tag}${classes}[${context}]`
    }

    /**
     * Sample the points where the artwork should be visible.
     *
     * Every measurement kept agreeing that the scenery exists with the right size,
     * while nothing was visible. `getBoundingClientRect` reports GEOMETRY, and geometry
     * cannot tell "painted" from "painted and then covered". Hit testing can.
     * @param seat - the seat node.
     * @returns one short token per sample.
     */
    function hitTestAmbient(seat) {
      try {
        if (typeof document.elementFromPoint !== 'function') return 'elementFromPoint 不可用'
        const rect = seat.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return '座位尺寸为 0'
        const samples = [
          ['远山', rect.left + rect.width * 0.5, rect.bottom - rect.height * 0.30],
          ['近山', rect.left + rect.width * 0.5, rect.bottom - rect.height * 0.12],
          ['水面', rect.left + rect.width * 0.5, rect.bottom - rect.height * 0.05],
          // The layer's own top-left corner, where the probe sits. If the probe is not
          // visible, this point says who took its place.
          ['探针', rect.left + 20, rect.top + 20],
        ]
        return samples.map(([label, x, y]) => `${label}:${describeTopmost(x, y)}`).join(' ')
      } catch (error) {
        return `命中测试失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * Describe the scenery layer as the document actually has it.
     *
     * A layer that is missing, empty, zero-sized or transparent all look identical
     * from outside the app, and each has a different cause. Reading the live element
     * is the only way to tell them apart.
     * @param seat - the seat node.
     * @param kind - the scene that was requested.
     * @returns the report.
     */
    function describeAmbient(seat, kind, placement) {
      try {
        const style = getComputedStyle(seat)
        const rect = seat.getBoundingClientRect()
        const column = seat.parentElement
        const columnRect = column === null ? null : column.getBoundingClientRect()
        const columnStyle = column === null ? null : getComputedStyle(column)
        // Measure the artwork itself, not just its container: a healthy-looking
        // 280x780 seat can still hold a scene that collapsed to zero height, and
        // the two need different fixes.
        const scene = seat.firstElementChild
        const sceneRect = scene === null ? null : scene.getBoundingClientRect()
        const art = seat.querySelector(
          '.sta-mountains, .dof-seaweed, .ym-sea-front, .jp-river, .xs-ridges, .pj-zenscene, .gc-phoenix',
        )
        const artRect = art === null ? null : art.getBoundingClientRect()
        return {
          found: true,
          kind,
          children: seat.childElementCount,
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          display: style.display,
          position: style.position,
          zIndex: style.zIndex,
          overflow: style.overflow,
          // Where the seat landed, relative to the column it was inserted into.
          // A large negative or oversized offset means it was placed outside the
          // visible box rather than covered.
          offsetInColumn: columnRect === null
            ? '?'
            : `${Math.round(rect.left - columnRect.left)},${Math.round(rect.top - columnRect.top)}`,
          columnPosition: columnStyle === null ? '?' : columnStyle.position,
          columnOverflow: columnStyle === null ? '?' : columnStyle.overflow,
          sceneSize: sceneRect === null ? '?' : `${Math.round(sceneRect.width)}x${Math.round(sceneRect.height)}`,
          artSize: artRect === null ? '?' : `${Math.round(artRect.width)}x${Math.round(artRect.height)}`,
          // The column clips its own overflow, so artwork painted outside the
          // column's box is invisible while every other reading looks healthy.
          artInsideColumn: artRect !== null && columnRect !== null
            && artRect.bottom > columnRect.top
            && artRect.top < columnRect.bottom,
          css: document.querySelector('style[data-plugin-css="theme-gallery/ambient"]') !== null,
          // The stylesheet is the other half of the mechanism: without it the seat
          // is a plain static div and every child collapses to nothing.
          inColumn: column !== null && column.className.includes('sidebarCol'),
          siblings: column === null ? -1 : column.childElementCount,
          // Who is on top where the artwork should be: the one reading that can
          // tell "never painted" apart from "painted and then covered".
          hitTest: hitTestAmbient(seat),
          // Whoever wins the hit test, measured. The previous round named `div.tg-page` —
          // this plugin's OWN panel — at every sample point, which would mean the scenery
          // IS painted and is then covered by the panel being looked at. Reporting the
          // winner's rectangle and the two column rectangles turns "covered" from a guess
          // into a comparison.
          columns: (() => {
            const out = []
            for (const selector of ['.ZTP-Xa_sidebarCol', '.ZTP-Xa_centerCol']) {
              const node = document.querySelector(selector)
              if (node === null) { out.push(`${selector.replace('.ZTP-Xa_', '')}=无`); continue }
              const r = node.getBoundingClientRect()
              out.push(`${selector.replace('.ZTP-Xa_', '')}=${Math.round(r.left)},${Math.round(r.top)}`
                + ` ${Math.round(r.width)}x${Math.round(r.height)}`)
            }
            // The winner at one point over the SIDEBAR, measured. The centre column starts
            // at x=280, so a panel inside it cannot legitimately cover x=0..280 — if this
            // reports a rectangle that does reach the sidebar, that is a finding in itself.
            const seatRect = seat.getBoundingClientRect()
            const sampleX = seatRect.left + 140
            const sampleY = seatRect.top + 140
            const top = document.elementFromPoint(sampleX, sampleY)
            if (top === null) {
              out.push(`采样(${Math.round(sampleX)},${Math.round(sampleY)})=空`)
            } else {
              const r = top.getBoundingClientRect()
              const s = getComputedStyle(top)
              const cls = typeof top.className === 'string' && top.className !== ''
                ? `.${String(top.className).split(' ')[0]}`
                : ''
              out.push(`采样(${Math.round(sampleX)},${Math.round(sampleY)})`
                + `=${top.tagName.toLowerCase()}${cls}`
                + `@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
                + ` pos=${s.position} z=${s.zIndex} pe=${s.pointerEvents}`)
            }
            return out.join(' ')
          })(),
          placement,
          // A preview of what the layer actually CONTAINS. If the scene markup never
          // arrived, every geometry reading still looks healthy — the container has the
          // right size either way — so the content has to be reported, not assumed.
          html: (() => {
            const raw = seat.innerHTML
            return raw.length === 0 ? '(空)' : `${raw.length}字符`
          })(),
          // The first three descendants with their OWN computed geometry and paint state.
          // The seat can be perfectly sized and full of markup while every child is
          // zero-sized, hidden or clipped — and the parent's numbers look identical in all
          // three cases. The probe proves a simple element renders here; this reports the
          // complex one, which is where the difference must lie.
          kids: (() => {
            const out = []
            let node = seat.firstElementChild
            while (node !== null && out.length < 3) {
              const r = node.getBoundingClientRect()
              const s = getComputedStyle(node)
              const cls = String(node.className).split(' ')[0]
              out.push(`<${node.tagName.toLowerCase()}${cls === '' ? '' : `.${cls}`}`
                + ` ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
                + ` pos=${s.position} disp=${s.display} vis=${s.visibility} op=${s.opacity}>`)
              node = node.firstElementChild
            }
            return out.length === 0 ? '(无子元素)' : out.join(' ')
          })(),
          // The seat's OWN box, inline-styled from `placeAmbient`. Its colour is the
          // one signal that separates "the layer paints" from "the layer's children
          // paint": the probe proved an overlay can be drawn, this proves THIS one is.
          seatBackground: style.backgroundColor,
          // WHERE the layer hangs. The whole defect came down to this: an identical
          // minimal element on `documentElement` rendered while the layer on `body`
          // painted nothing. Reporting the parent turns that into a reading instead of
          // something to be inferred from the code.
          parent: seat.parentElement === null
            ? '(无父节点)'
            : `${seat.parentElement.tagName.toLowerCase()}`
              + `${seat.parentElement.id === '' ? '' : `#${seat.parentElement.id}`}`,
          paintError: ambientPaintError,
        }
      } catch (error) {
        return {
          found: true,
          kind,
          note: `读取失败: ${String(error && error.message ? error.message : error)}`,
        }
      }
    }

    /**
     * Resolve a bundled theme by id.
     *
     * Only this package's own themes are addressable: they are the ones whose
     * `accent` and `ambient` fields this plugin can trust. A theme contributed by
     * another plugin is simply skipped, which degrades to "no scenery, base accent"
     * rather than to an error.
     * @param id - the theme id.
     * @returns the bundled theme, or undefined.
     */
    function bundledTheme(id) {
      return BUNDLED_THEMES.find((theme) => theme.id === id)
    }

    /**
     * Read one token out of a bundled skin, resolving the pair form to the skin's own scheme.
     *
     * The bundled skins store most tokens as `{ light, dark }` pairs even though a skin itself is
     * single-scheme. `flatten` collapses them for `register`; this is the same read, exposed
     * separately because the accent diagnostic needs ONE token's declared value without building
     * the whole registrable definition — and because that diagnostic lives at factory scope, where
     * `flatten` (declared inside `mountGallery`) is not reachable. Reaching for it from here is the
     * exact scope error `tests/check-scope-reach.mjs` exists to catch.
     * @param definition - a bundled skin.
     * @param name - the token name.
     * @returns the declared value, or undefined when the skin has no such token.
     */
    function declaredToken(definition, name) {
      const raw = definition?.tokens?.[name]
      if (raw === undefined) return undefined
      // Deliberately not `raw?.[…]`: a skin whose token is neither a string nor a pair is a data
      // error, and `flatten` (the other caller) must keep failing loudly on it rather than
      // registering an unset variable that paints nothing.
      return typeof raw === 'string' ? raw : raw[definition.colorScheme]
    }

    /**
     * Disposer of the active accent layer, when one is stacked.
     *
     * Declared BEFORE `syncAccent`, which reads it. The body runs top to bottom during
     * mount, so a `let` read above its own declaration throws a ReferenceError — and the
     * caller wraps this in a `try`, so the error was swallowed and the accent marker
     * silently never appeared. Same shape as the `paintAttempts` fault; see
     * `tests/check-tdz-order.mjs`, which now covers declarations that precede the function
     * reading them, not just declarations inside it.
     */
    let accentLayerDispose

    /**
     * The accent colour {@link accentLayerDispose} was built from.
     *
     * Declared here for the same reason as the disposer above: `syncAccent` both reads and writes
     * it, and it is called during mount, so a `let` initialised later in the body would be in its
     * temporal dead zone at the first call.
     *
     * It exists so that re-stacking can be skipped when the colour has not moved. Without it every
     * `theme/change` — including ones this plugin caused and ones caused by something else —
     * disposed and re-created the layer, which emits again.
     * @type {string|undefined}
     */
    let stackedAccent

    /**
     * The plugin context, published for the factory-level helpers.
     *
     * `syncAccent` and `themeDiagnostics` are defined at factory scope but were written when they
     * lived inside the mount body, where `ctx` was a parameter. Extracting that body left them
     * without it, so their `ctx` reads threw — and because their callers wrap them in `try`, the
     * failure was invisible and the features simply never worked.
     *
     * Assigned once, by `applyGallery`, before anything can call those helpers.
     * @type {object|undefined}
     */
    let ctx

    /**
     * Stack the active theme's accent colour over the selection states.
     *
     * The source system's design rules are explicit that an active marker takes the
     * theme's own characteristic colour rather than a colour invented for it, and
     * that the marker must be unmistakable: a coloured left bar **plus** coloured
     * text **plus** a 600 weight **plus** a translucent fill. In this shell those
     * states read from the `button-ghost-active-*` family, which is what the
     * sidebar entry and the selected conversation row both use.
     *
     * Two constraints matter more than the colours themselves:
     *
     *  - **Only the ACTIVE theme may contribute.** `overrideTokens` layers compose
     *    over whatever theme is active, so reading a fixed accent would paint
     *    山青婷彩's pink onto 梦海游鱼 and onto the built-in light/dark themes too.
     *    The layer is withdrawn whenever the active theme is not one this package
     *    contributed, so every other theme keeps its own selection colour.
     *  - **The theme's brand colour is left alone.** Repointing `brand-primary` at a
     *    warm accent would also repoint links, primary buttons and status chips —
     *    far more than the marker this is about.
     *
     * Alpha is composed here because the token is a colour: the source stores the
     * active fill as `rgba(...,0.15)`-style values, and an 8-digit hex is how the
     * same intent is expressed in a token.
     * @param accent - the active theme's accent colour, or undefined for none.
     */
    function syncAccent(accent) {
      // A factory-level helper that needs the plugin context.
      //
      // These helpers used to live INSIDE the mount body, where `ctx` was a parameter in scope.
      // Extracting the body into `mountGallery(ctx)` left them at factory level, where `ctx` does
      // not exist at all — so every call threw `ReferenceError: ctx is not defined`, the caller's
      // `try` swallowed it, and the accent marker silently never appeared. The module-level `ctx`
      // below is assigned at mount and read here.
      if (ctx === undefined) return
      const wanted = typeof accent === 'string' && accent !== '' ? accent : undefined
      // ── WHY BOTH A SKIP AND THE SELF-EMIT GUARD ARE NEEDED ───────────────────────────────────
      //
      // `overrideTokens` and the disposer it returns BOTH emit `theme/change`, and this function
      // is reached from `publish()`, which is itself driven by that event:
      //
      //     publish → syncSkin → syncAccent → overrideTokens → theme/change → publish → …
      //
      // Every level nests inside the previous CALL, so nothing ever yields to the event loop. The
      // stack therefore grows until the engine refuses to grow it further and throws
      // `RangeError: Maximum call stack size exceeded` — and because every level has its own
      // `try/catch` (see `syncSkin`), each one logs the SAME message on the way out. That is why
      // the console showed a flood of "could not stack the accent layer" lines rather than one
      // error: one flood, hundreds of identical lines, each from a different depth.
      //
      // Fixing it takes both halves, and they are not interchangeable:
      //
      //   • the SKIP stops the churn — an accent that has not moved does not need a new layer, so
      //     an unrelated `theme/change` (the shell's `adopt()`, a streamed render, another plugin)
      //     no longer replaces the layer and causes a repaint;
      //   • the GUARD stops the RE-ENTRY — it is what makes the `theme/change` emitted by our own
      //     write invisible to the subscription, so the cycle cannot close even when the colour
      //     genuinely did change.
      //
      // Only the guard is a correctness requirement; the skip is what keeps the layer stable. The
      // same shape is used by `stackSkinTokens` for the palette and by `syncReadingLayer`.
      if (wanted === stackedAccent) return
      emitting(() => {
        if (accentLayerDispose !== undefined) {
          accentLayerDispose()
          accentLayerDispose = undefined
        }
        stackedAccent = undefined
        if (wanted === undefined) return
        accentLayerDispose = ctx.theme.overrideTokens('theme-gallery: accent', {
          '--dsw-alias-button-ghost-active-fill': { light: `${wanted}29`, dark: `${wanted}29` },
          '--dsw-alias-button-ghost-active-border': { light: wanted, dark: wanted },
          '--dsw-alias-button-ghost-active-hover': { light: `${wanted}47`, dark: `${wanted}47` },
        })
        stackedAccent = wanted
      })
    }

    /** 当前叠着的配色方案 id，没有就是 undefined。 */
    let stackedScheme

    /** 配色层的 disposer（见 `syncScheme`）。 */
    let schemeLayerDispose

    /**
     * 把所选配色方案叠到整屏上。
     *
     * ── 两条与 `syncAccent` 同源的约束 ────────────────────────────────────────
     *
     *  1. **只有锚主题是活动主题时才叠。** `overrideTokens` 的层是压在"当前活动主题"
     *     之上的，所以用户切到山青婷彩之后这一层必须撤除，否则会把配色糊到别人身上。
     *     判据取 `snapshot.active.id`，与 `syncAccent` 完全一致（**不能**引用
     *     `wantedSkin` —— 那个函数在 `mountGallery` 内部，工厂级函数够不到它，
     *     正是硬性规则 4 记着的那个作用域事故）。
     *  2. **既有跳过、又有自发光守卫。** `overrideTokens` 与它返回的 disposer **都会**
     *     emit `theme/change`，而本函数是被 `publish()` 调的，`publish` 又由那个事件驱动 ——
     *     少了守卫就是 0.1.4 那次 `RangeError` 刷屏的同一形状（规则 1）。
     * @param snapshot - 官方主题快照。
     */
    function syncScheme(snapshot) {
      if (ctx === undefined) return
      const active = snapshot === undefined || snapshot === null ? {} : (snapshot.active ?? {})
      const remembered = rememberedScheme()
      // ── 石榴金那一格**不叠派生层**（用户实机反馈："不是你第一遍做的颜色"）──────────
      //
      // 第一版那套配色（两排 10 个纯色 + 拼色那一排，合起来这一整套）**不是三个颜色**，
      // 而是锚主题皮肤 `lib/themes/shi-liu-jin.json` 里手工写好的 67 个 token —— 侧栏渐变、
      // 两层底、正文、按钮族都在里面。用户说"这个配色保留，很漂亮"，留的就是这一整套。
      //
      // 所以这一格必须**等于皮肤自己那套**：只要锚主题是活动主题，`syncSkin` 就已经把
      // 皮肤自己的调色叠上了，这里撤掉配色层即可精确复原第一版。
      // 反过来说：若照旧拿 `main/ground/ink` 去派生 67 个 token，得到的是一套"相似但不等"
      // 的颜色（`state-business-primary` 会变成金色圆点色、侧栏渐变会按主色重算），
      // 用户一眼就看出来了 —— 这正是本次被指出来的问题。
      const wanted = remembered !== null && remembered !== DEFAULT_SCHEME && active.id === PALETTE_ANCHOR
        ? remembered
        : null
      if (wanted === stackedScheme) return
      const scheme = wanted === null ? undefined : schemeById(wanted, PALETTE_SCHEMES)
      emitting(() => {
        if (schemeLayerDispose !== undefined) {
          schemeLayerDispose()
          schemeLayerDispose = undefined
        }
        stackedScheme = undefined
        if (scheme === undefined) return
        schemeLayerDispose = ctx.theme.overrideTokens('theme-gallery: 配色', schemeTokens(scheme))
        stackedScheme = wanted
      })
    }

    /* ═══════════════════ 宠物挂件运行时（宠物家族 × 7）═══════════════════
     *
     * 与侧栏素材（ambient）完全独立的第二层装饰：画在自己的固定层里，锚定**对话输入框**
     * （阅读态已验证的 composer 定位法），地面线 = 输入框下缘。规则照抄ambient 的教训：
     *
     *  · 幂等判据（廉价指纹）在**一切 DOM 写入之前**（规则 3）；
     *  · 移动循环复用工厂级单帧助手 `step()`（本文件 requestAnimationFrame 只此一处），
     *    且只在跑动中自续，停下即断 —— 没有任何常驻定时器（闲聊是单个可取消句柄，见后）；
     *  · 脚印 / 气泡都有**数量上限**与超时回收，绝不无界增长；
     *  · 不写主题服务：开关、宠物、名字、位置全部存 localStorage，绝不碰 preference；
     *  · 容器 pointer-events:none，只有宠物与它的道具可交互 —— 绝不挡输入框的点击。
     *
     * ── 二期（宠物家族）───────────────────────────────────────────────────────
     *
     * "这只宠物长什么样、跑多快、说什么话"全部在下面的 PET_KINDS 注册表里，框架零硬编码：
     * 美术常量只存 <svg> 内部内容（不含标签本身），由 petSvg/petPropSvg 统一包裹 ——
     * 舞台、面板卡面、预览页三处共用同一份字符串，结构上不可能漂移。
     * 活性机制（闲聊 / 打字回头 / 生成中加油）见本区后半（petNoteInteraction 起）。
     */

    /** 挂件舞台的 id；也是清扫跨热重载残留节点的依据。 */
    const PET_STAGE_ID = 'dsh-theme-pet'

    /** 跨物种一致的安全预算：脚印枚数 / 脚印寿命 / 同场气泡数。 */
    const PET_TRAIL_MAX = 14
    const PET_TRAIL_FADE_MS = 3500
    const PET_BUBBLE_MAX = 3
    /** hop 步态：一跳的水平长度与最高抬升（px）。 */
    const PET_HOP_LEN_PX = 34
    const PET_HOP_LIFT_PX = 9
    /**
     * 视口回退时的地面线抬高量（px）。锚点（输入框）在屏上时地面线贴它的下缘；
     * 主题面板页等 composer 隐藏的场合走视口回退，宠物直接贴窗口底缘会被裁掉一截
     * （实机验收反馈）—— 抬高一段让整只宠物完整落地。
     */
    const PET_FALLBACK_GROUND_GAP = 48

    /* ── 美术常量（<svg> 内部内容；斑斑是一期资产拆分，形状与色值零改动）────── */

    const PET_BAN_SIDE = ''
      + '<path class="dsh-pet-tail" d="M15 36 Q4 31 6.5 21" stroke="#A9744F" stroke-width="5" fill="none" stroke-linecap="round" style="transform-origin:14px 36px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="19" y="41" width="7" height="13" rx="3" fill="#C79A6B" style="transform-origin:22px 42px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="41" y="41" width="7" height="13" rx="3" fill="#C79A6B" style="transform-origin:44px 42px"/>'
      + '<ellipse cx="32" cy="35" rx="17.5" ry="13.5" fill="#F5E7CE"/>'
      + '<ellipse cx="25" cy="31.5" rx="7" ry="5" fill="#C79A6B" opacity=".9"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="25" y="42" width="7" height="13" rx="3" fill="#F5E7CE" style="transform-origin:28px 43px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="37" y="42" width="7" height="13" rx="3" fill="#FBF3E4" style="transform-origin:40px 43px"/>'
      + '<circle cx="46" cy="18" r="12.5" fill="#F5E7CE"/>'
      + '<circle cx="51.5" cy="9.5" r="5.2" fill="#C79A6B"/>'
      + '<ellipse cx="40" cy="10.5" rx="6" ry="8.6" fill="#A9744F" transform="rotate(-20 40 10.5)"/>'
      + '<ellipse cx="55" cy="22.5" rx="6.2" ry="5" fill="#FBF3E4"/>'
      + '<circle cx="58.6" cy="20.6" r="2.2" fill="#4A372F"/>'
      + '<circle cx="49" cy="16" r="1.9" fill="#3B2B23" class="dsh-pet-eye"/>'
      + '<path d="M54.5 27 q2.2 2 4.4 .4" stroke="#4A372F" stroke-width="1.2" fill="none" stroke-linecap="round"/>'

    const PET_BAN_FRONT = ''
      + '<path d="M50 40 q7 -3 6 -9" stroke="#A9744F" stroke-width="4.6" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="24" cy="12" rx="5.6" ry="9" fill="#A9744F" transform="rotate(-17 24 12)"/>'
      + '<ellipse cx="40" cy="12" rx="5.6" ry="9" fill="#A9744F" transform="rotate(17 40 12)"/>'
      + '<circle cx="32" cy="19" r="13" fill="#F5E7CE"/>'
      + '<circle cx="38.5" cy="10.5" r="5" fill="#C79A6B"/>'
      + '<circle cx="27" cy="17.5" r="1.9" fill="#3B2B23" class="dsh-pet-eye"/>'
      + '<circle cx="37" cy="17.5" r="1.9" fill="#3B2B23" class="dsh-pet-eye"/>'
      + '<ellipse cx="32" cy="24.5" rx="7" ry="5.4" fill="#FBF3E4"/>'
      + '<circle cx="32" cy="22.4" r="2.2" fill="#4A372F"/>'
      + '<ellipse cx="32" cy="28.4" rx="2.9" ry="2.4" fill="#7C4A3A"/>'
      + '<ellipse cx="32" cy="41.5" rx="14" ry="10.5" fill="#F5E7CE"/>'
      + '<ellipse cx="32" cy="44" rx="8" ry="6.2" fill="#FBF3E4"/>'
      + '<ellipse cx="22.5" cy="38" rx="4.6" ry="3.6" fill="#C79A6B" opacity=".9"/>'
      + '<ellipse cx="25" cy="51" rx="4.2" ry="3.1" fill="#FBF3E4"/>'
      + '<ellipse cx="39" cy="51" rx="4.2" ry="3.1" fill="#FBF3E4"/>'

    const PET_BAN_PROP = ''
      + '<circle cx="13" cy="12" r="9.5" fill="#E06A4E"/>'
      + '<path d="M5 8.5 Q13 4 21 8.5" stroke="#B84A33" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M4.5 14 Q13 10 21.5 14" stroke="#B84A33" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M8 18.6 Q13 15 18 18.6" stroke="#B84A33" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
      + '<path d="M21.6 11 q5 1.4 3.8 6.4" stroke="#B84A33" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="9.6" cy="7.4" rx="2.6" ry="1.5" fill="#FFFFFF" opacity=".3" transform="rotate(-24 9.6 7.4)"/>'

    const PET_BAN_FACE = ''
      + '<ellipse cx="8.5" cy="7.5" rx="3.4" ry="5" fill="#A9744F" transform="rotate(-18 8.5 7.5)"/>'
      + '<ellipse cx="19.5" cy="7.5" rx="3.4" ry="5" fill="#A9744F" transform="rotate(18 19.5 7.5)"/>'
      + '<circle cx="14" cy="15.5" r="9.6" fill="#F5E7CE"/>'
      + '<circle cx="17.5" cy="9.6" r="3.6" fill="#C79A6B"/>'
      + '<circle cx="10.4" cy="14.5" r="1.5" fill="#3B2B23" class="dsh-pet-eye"/>'
      + '<circle cx="17.6" cy="14.5" r="1.5" fill="#3B2B23" class="dsh-pet-eye"/>'
      + '<ellipse cx="14" cy="19" rx="4.6" ry="3.4" fill="#FBF3E4"/>'
      + '<circle cx="14" cy="17.8" r="1.6" fill="#4A372F"/>'
      + '<path d="M12.6 21.4 q1.4 1.2 2.8 0" stroke="#4A372F" stroke-width="1" fill="none" stroke-linecap="round"/>'

    const PET_BAN_TRAIL = ''
      + '<g fill="#8F969C"><ellipse cx="6" cy="7.6" rx="3.1" ry="2.5"/>'
      + '<circle cx="2.7" cy="3.7" r="1.35"/><circle cx="5" cy="2.3" r="1.35"/>'
      + '<circle cx="7.3" cy="2.3" r="1.35"/><circle cx="9.5" cy="3.8" r="1.35"/></g>'

    const PET_JU_SIDE = ''
      + '<path class="dsh-pet-tail" d="M14 36 Q2 28 7 13" stroke="#F2A65A" stroke-width="5" fill="none" stroke-linecap="round" style="transform-origin:14px 36px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="18" y="40" width="7" height="12" rx="3" fill="#E0A060" style="transform-origin:21px 41px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="40" y="40" width="7" height="12" rx="3" fill="#F2A65A" style="transform-origin:43px 41px"/>'
      + '<ellipse cx="29" cy="36" rx="17" ry="12.5" fill="#F2A65A"/>'
      + '<path d="M17 34 q7 -9 15 -9" stroke="#D98032" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M26 28 q7 -7 14 -6" stroke="#D98032" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      + '<path d="M35 27 q6 -5 11 -2" stroke="#D98032" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="40" cy="39" rx="6.5" ry="5" fill="#FBE8CC"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="24" y="41" width="7" height="11" rx="3" fill="#F2A65A" style="transform-origin:27px 42px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="35" y="41" width="7" height="11" rx="3" fill="#F2A65A" style="transform-origin:38px 42px"/>'
      + '<ellipse cx="27.5" cy="51.4" rx="3" ry="1.8" fill="#FBE8CC"/>'
      + '<ellipse cx="38.5" cy="51.4" rx="3" ry="1.8" fill="#FBE8CC"/>'
      + '<circle cx="45" cy="19" r="11" fill="#F2A65A"/>'
      + '<path d="M36 13 L33.5 4 L43.5 8 Z" fill="#F2A65A"/>'
      + '<path d="M37.4 11.6 L36.2 6.6 L41.4 9 Z" fill="#E79B72"/>'
      // 后耳：两只耳尖对称朝外上，基边两点都落在头圆上（实机验收"一个耳朵位置
      // 不对"——旧后耳的基点浮在头缘外 4.6 单位，看起来悬空长错了地方）。
      + '<path d="M48.5 9 L55.5 3.5 L54.5 12 Z" fill="#F2A65A"/>'
      + '<path d="M50.3 9.6 L54.4 5.6 L53.9 10.7 Z" fill="#E79B72"/>'
      + '<path d="M42 8.5 l1.6 3.6" stroke="#D98032" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M46 8 l.6 3.8" stroke="#D98032" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M49.6 8.8 l-.6 3.4" stroke="#D98032" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
      + '<circle cx="49.5" cy="16.5" r="1.9" fill="#3F3A36" class="dsh-pet-eye"/>'
      // 嘴：小鼻三角贴脸前缘 + 从鼻下勾回的嘴弧 + 脸侧两根短须，与正面像同款
      // （实机验收"嘴巴像是鸟嘴"——旧版是一个凸出脸缘的实心三角，读成喙）。
      + '<path d="M54.8 19.9 l2.5 .9 l-1.9 1.9 z" fill="#C96F5E"/>'
      + '<path d="M56.4 23.2 q-1.5 1.5 -3.1 .8" stroke="#B98A5F" stroke-width="1" fill="none" stroke-linecap="round"/>'
      + '<path d="M51.6 20.6 l5.3 -1.1 M52.1 22.7 l5.3 .5" stroke="#B98A5F" stroke-width=".9" fill="none" stroke-linecap="round"/>'
      + '<path d="M18 27 Q26 20.5 36 19" stroke="#F8C48C" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/>'

    const PET_JU_FRONT = ''
      + '<path d="M45 46 q9 -2 8 -9" stroke="#F2A65A" stroke-width="4.6" fill="none" stroke-linecap="round"/>'
      + '<path d="M21 10 L18.5 1.5 L27.5 5.5 Z" fill="#F2A65A"/>'
      + '<path d="M22 8.6 L20.6 4.2 L25.8 6.4 Z" fill="#E79B72"/>'
      + '<path d="M41 10 L43.5 1.5 L34.5 5.5 Z" fill="#F2A65A"/>'
      + '<path d="M40 8.6 L41.4 4.2 L36.2 6.4 Z" fill="#E79B72"/>'
      + '<ellipse cx="31" cy="42" rx="13.5" ry="9.5" fill="#F2A65A"/>'
      + '<ellipse cx="31" cy="43" rx="8" ry="6.5" fill="#FBE8CC"/>'
      + '<path d="M20 40 q-2 4 1 7" stroke="#D98032" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      + '<path d="M42 40 q2 4 -1 7" stroke="#D98032" stroke-width="1.8" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="25" cy="50.6" rx="3.4" ry="2.4" fill="#F2A65A"/>'
      + '<ellipse cx="37" cy="50.6" rx="3.4" ry="2.4" fill="#F2A65A"/>'
      + '<circle cx="31" cy="17" r="12" fill="#F2A65A"/>'
      + '<path d="M27 6.5 l1.2 3.2" stroke="#D98032" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M31 5.8 l.4 3.4" stroke="#D98032" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M35 6.5 l-.8 3.2" stroke="#D98032" stroke-width="1.5" fill="none" stroke-linecap="round"/>'
      + '<circle cx="26" cy="16" r="2" fill="#3F3A36" class="dsh-pet-eye"/>'
      + '<circle cx="36" cy="16" r="2" fill="#3F3A36" class="dsh-pet-eye"/>'
      + '<path d="M29.8 20 l2.4 0 l-1.2 1.8 z" fill="#C96F5E"/>'
      + '<path d="M31 21.8 q-1.6 2 -3.4 1" stroke="#B98A5F" stroke-width="1" fill="none" stroke-linecap="round"/>'
      + '<path d="M31 21.8 q1.6 2 3.4 1" stroke="#B98A5F" stroke-width="1" fill="none" stroke-linecap="round"/>'
      + '<path d="M20 18 l-6 -1.6 M20 20.5 l-6 .4 M42 18 l6 -1.6 M42 20.5 l6 .4" stroke="#B98A5F" stroke-width=".9" fill="none" stroke-linecap="round"/>'

    const PET_JU_PROP = ''
      + '<path d="M17 9 l5 -3.5 l-1.4 3.5 l1.4 3.5 z" fill="#D99A3F"/>'
      + '<ellipse cx="10" cy="9" rx="8" ry="4" fill="#E8B15C"/>'
      + '<path d="M7 6.4 q1 2.6 0 5.2" stroke="#D99A3F" stroke-width="1.1" fill="none" stroke-linecap="round"/>'
      + '<path d="M11 6 q1 2.8 0 5.6" stroke="#D99A3F" stroke-width="1.1" fill="none" stroke-linecap="round"/>'
      + '<circle cx="4.6" cy="8.2" r="1" fill="#5B4632"/>'

    const PET_JU_FACE = ''
      + '<path d="M8 9 L5.5 2.5 L13 5.5 Z" fill="#F2A65A"/>'
      + '<path d="M8.6 7.9 L7.3 4.5 L11.6 6.2 Z" fill="#E79B72"/>'
      + '<path d="M20 9 L22.5 2.5 L15 5.5 Z" fill="#F2A65A"/>'
      + '<path d="M19.4 7.9 L20.7 4.5 L16.4 6.2 Z" fill="#E79B72"/>'
      + '<circle cx="14" cy="15" r="9.8" fill="#F2A65A"/>'
      + '<path d="M11.5 6.8 l.9 2.8 M14 6.4 l.3 3 M16.5 6.8 l-.7 2.8" stroke="#D98032" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
      + '<circle cx="10.4" cy="14.5" r="1.5" fill="#3F3A36" class="dsh-pet-eye"/>'
      + '<circle cx="17.6" cy="14.5" r="1.5" fill="#3F3A36" class="dsh-pet-eye"/>'
      + '<path d="M13 18 l2 0 l-1 1.5 z" fill="#C96F5E"/>'
      + '<path d="M14 19.6 q-1.2 1.4 -2.4 .7 M14 19.6 q1.2 1.4 2.4 .7" stroke="#B98A5F" stroke-width=".9" fill="none" stroke-linecap="round"/>'
      + '<path d="M6.5 16.5 l-4 -1 M6.8 18.4 l-4 .5 M21.5 16.5 l4 -1 M21.2 18.4 l4 .5" stroke="#B98A5F" stroke-width=".8" fill="none" stroke-linecap="round"/>'

    const PET_JU_TRAIL = ''
      + '<g fill="#A98F7A"><ellipse cx="5.5" cy="6.8" rx="2.7" ry="2.1"/>'
      + '<circle cx="2.4" cy="3.3" r="1.15"/><circle cx="4.6" cy="2" r="1.15"/>'
      + '<circle cx="6.6" cy="2" r="1.15"/><circle cx="8.6" cy="3.4" r="1.15"/></g>'

    const PET_TU_SIDE = ''
      + '<circle cx="7.5" cy="36" r="4.5" fill="#FFFFFF"/>'
      + '<ellipse cx="20" cy="42" rx="7.5" ry="6" fill="#EFE6D8"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="26" y="42" width="5.5" height="10" rx="2.7" fill="#FBF6EF" style="transform-origin:28.7px 43px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="34" y="42" width="5.5" height="10" rx="2.7" fill="#F4EADF" style="transform-origin:36.7px 43px"/>'
      + '<ellipse cx="26" cy="38" rx="16" ry="12.5" fill="#FBF6EF"/>'
      + '<ellipse cx="28" cy="42" rx="9" ry="6" fill="#F4EADF" opacity=".7"/>'
      + '<path class="dsh-pet-ear" d="M37 5 Q30 6 31 16 Q31.5 24 35 24 Q38.5 24 38.5 16 Q38.5 8 37 5 Z" fill="#FBF6EF" style="transform-origin:37px 6px"/>'
      + '<path d="M34.6 9.5 Q32.6 11 33 17 Q33.3 21.5 35 21.5 Q36.7 21.5 36.7 16.5 Q36.6 11.5 34.6 9.5 Z" fill="#F2C9C4"/>'
      + '<circle cx="40" cy="23" r="10.5" fill="#FBF6EF"/>'
      + '<path d="M33 17 Q37 12.5 43 12" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>'
      + '<circle cx="44.5" cy="21.5" r="1.8" fill="#4A4038" class="dsh-pet-eye"/>'
      + '<path d="M49.5 23.8 l2.4 .6 l-1.7 1.7 z" fill="#EFA8A0"/>'
      + '<path d="M50.6 26.2 q-1.2 1.4 -2.8 .8" stroke="#C9A9A0" stroke-width="1" fill="none" stroke-linecap="round"/>'
      + '<circle cx="46.5" cy="25" r="1.6" fill="#F6CFC9" opacity=".85"/>'

    const PET_TU_FRONT = ''
      + '<path class="dsh-pet-ear" d="M9 6 Q3 8 4.5 17 Q5.6 23.5 9 23 Q12 22.6 11.6 15 Q11.2 8.6 9 6 Z" fill="#FBF6EF" style="transform-origin:9px 7px"/>'
      + '<path d="M7.4 10.5 Q5.8 12 6.4 17 Q6.9 21 8.8 20.8 Q10.4 20.6 10.2 15.4 Q10 11.5 7.4 10.5 Z" fill="#F2C9C4"/>'
      + '<path class="dsh-pet-ear" d="M49 6 Q55 8 53.5 17 Q52.4 23.5 49 23 Q46 22.6 46.4 15 Q46.8 8.6 49 6 Z" fill="#FBF6EF" style="transform-origin:49px 7px"/>'
      + '<path d="M50.6 10.5 Q52.2 12 51.6 17 Q51.1 21 49.2 20.8 Q47.6 20.6 47.8 15.4 Q48 11.5 50.6 10.5 Z" fill="#F2C9C4"/>'
      + '<ellipse cx="29" cy="41" rx="12.5" ry="10" fill="#FBF6EF"/>'
      + '<ellipse cx="29" cy="42" rx="7.5" ry="6.5" fill="#FFFFFF"/>'
      + '<ellipse cx="24.5" cy="36" rx="2.6" ry="2" fill="#F4EADF"/>'
      + '<ellipse cx="33.5" cy="36" rx="2.6" ry="2" fill="#F4EADF"/>'
      + '<ellipse cx="24" cy="50.6" rx="2.8" ry="2.2" fill="#FBF6EF"/>'
      + '<ellipse cx="34" cy="50.6" rx="2.8" ry="2.2" fill="#FBF6EF"/>'
      + '<circle cx="29" cy="17" r="11.5" fill="#FBF6EF"/>'
      + '<circle cx="24" cy="16" r="1.9" fill="#4A4038" class="dsh-pet-eye"/>'
      + '<circle cx="34" cy="16" r="1.9" fill="#4A4038" class="dsh-pet-eye"/>'
      + '<path d="M28 20 l2 0 l-1 1.6 z" fill="#EFA8A0"/>'
      + '<path d="M29 21.6 q-1.4 1.6 -2.8 .8 M29 21.6 q1.4 1.6 2.8 .8" stroke="#C9A9A0" stroke-width="1" fill="none" stroke-linecap="round"/>'
      + '<rect x="27.2" y="22.6" width="1.7" height="2.2" rx=".6" fill="#FFFFFF"/>'
      + '<rect x="29.9" y="22.6" width="1.7" height="2.2" rx=".6" fill="#FFFFFF"/>'
      + '<circle cx="20.5" cy="19.5" r="1.8" fill="#F6CFC9"/>'
      + '<circle cx="37.5" cy="19.5" r="1.8" fill="#F6CFC9"/>'

    const PET_TU_PROP = ''
      + '<path d="M12 8 q-2.5 -5 -6 -6 q2 5 6 6 z" fill="#67B35F"/>'
      + '<path d="M13 8 q2.5 -5 6 -6 q-2 5 -6 6 z" fill="#4E9B4A"/>'
      + '<path d="M12 7 Q16 10 15 15 Q14 20 12 21 Q10 20 9 15 Q8 10 12 7 Z" fill="#EF8A3C"/>'
      + '<path d="M10 11.5 q2 1 4 0 M9.7 15 q2.3 1 4.6 0" stroke="#D9702A" stroke-width="1.1" fill="none" stroke-linecap="round"/>'

    const PET_TU_FACE = ''
      + '<path d="M6.5 8 Q3.5 12 5 17 Q6 20 8 19 Q9.8 18 9.4 13 Q9 9 6.5 8 Z" fill="#FBF6EF"/>'
      + '<path d="M6.9 10.5 Q5.9 13 6.7 16.4 Q7.4 18.2 8.3 17.8 Q9.2 17.4 9 13.6 Q8.8 11 6.9 10.5 Z" fill="#F2C9C4"/>'
      + '<path d="M21.5 8 Q24.5 12 23 17 Q22 20 20 19 Q18.2 18 18.6 13 Q19 9 21.5 8 Z" fill="#FBF6EF"/>'
      + '<path d="M21.1 10.5 Q22.1 13 21.3 16.4 Q20.6 18.2 19.7 17.8 Q18.8 17.4 19 13.6 Q19.2 11 21.1 10.5 Z" fill="#F2C9C4"/>'
      + '<circle cx="14" cy="14" r="9.6" fill="#FBF6EF"/>'
      + '<circle cx="10.3" cy="13.5" r="1.5" fill="#4A4038" class="dsh-pet-eye"/>'
      + '<circle cx="17.7" cy="13.5" r="1.5" fill="#4A4038" class="dsh-pet-eye"/>'
      + '<path d="M13 16.6 l2 0 l-1 1.5 z" fill="#EFA8A0"/>'
      + '<rect x="12.8" y="18.4" width="1.2" height="1.7" rx=".5" fill="#FFFFFF"/>'
      + '<rect x="14.4" y="18.4" width="1.2" height="1.7" rx=".5" fill="#FFFFFF"/>'
      + '<circle cx="7.6" cy="16.4" r="1.5" fill="#F6CFC9"/>'
      + '<circle cx="20.4" cy="16.4" r="1.5" fill="#F6CFC9"/>'

    const PET_TU_TRAIL = ''
      + '<g fill="#C9BCA8"><circle cx="3" cy="4.5" r="1.3"/><circle cx="7" cy="3.5" r="1.3"/></g>'

    const PET_KE_SIDE = ''
      + '<path d="M9.6 44 l-4.5 3 l5.2 .8 z" fill="#26303C"/>'
      + '<ellipse cx="20" cy="54.5" rx="4.6" ry="2.4" fill="#F5A623"/>'
      + '<ellipse cx="30" cy="54.5" rx="4.6" ry="2.4" fill="#E8961B"/>'
      + '<ellipse cx="26" cy="33" rx="17" ry="21" fill="#2E3A48"/>'
      + '<ellipse cx="30" cy="38" rx="11.5" ry="14" fill="#FDFDFB"/>'
      + '<path class="dsh-pet-wing" d="M12 24 Q6 32 10 42 Q14 40 15.5 31 Q15 25 12 24 Z" fill="#26303C" style="transform-origin:12px 25px"/>'
      + '<path d="M18 14 Q24 9.5 31 11" stroke="#3E4E60" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/>'
      + '<circle cx="33.5" cy="22" r="2" fill="#242C36" class="dsh-pet-eye"/>'
      + '<circle cx="34.2" cy="21.3" r=".6" fill="#FFFFFF"/>'
      + '<path d="M42 24 l7 2.2 l-7 2.6 z" fill="#F5A623"/>'

    const PET_KE_FRONT = ''
      + '<ellipse cx="19" cy="55" rx="4.4" ry="2.3" fill="#F5A623"/>'
      + '<ellipse cx="33" cy="55" rx="4.4" ry="2.3" fill="#F5A623"/>'
      + '<ellipse cx="26" cy="34" rx="17" ry="21" fill="#2E3A48"/>'
      + '<ellipse cx="26" cy="39" rx="12" ry="14.5" fill="#FDFDFB"/>'
      + '<path class="dsh-pet-wing" d="M9 26 Q3 34 7.5 44 Q12 42 13 32 Q12.4 26 9 26 Z" fill="#26303C" style="transform-origin:9px 27px"/>'
      + '<path class="dsh-pet-wing" d="M43 26 Q49 34 44.5 44 Q40 42 39 32 Q39.6 26 43 26 Z" fill="#26303C" style="transform-origin:43px 27px"/>'
      + '<path d="M16 13 Q22 8.5 29 10" stroke="#3E4E60" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".9"/>'
      + '<circle cx="20" cy="23" r="2" fill="#242C36" class="dsh-pet-eye"/>'
      + '<circle cx="32" cy="23" r="2" fill="#242C36" class="dsh-pet-eye"/>'
      + '<circle cx="20.7" cy="22.3" r=".6" fill="#FFFFFF"/>'
      + '<circle cx="32.7" cy="22.3" r=".6" fill="#FFFFFF"/>'
      + '<path d="M22.5 27.5 l7 0 l-3.5 4.4 z" fill="#F5A623"/>'

    const PET_KE_PROP = ''
      + '<path d="M18 7 l4.4 -3 l-1 3 l1 3 z" fill="#C7D6E0"/>'
      + '<path d="M2 7 Q8 2.5 15 5.5 Q18.5 7 18.5 7 Q18.5 7 15 8.5 Q8 11.5 2 7 Z" fill="#9FB6C6"/>'
      + '<path d="M4 5.8 Q10 2.8 16 5.8" stroke="#7C96A8" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
      + '<circle cx="4.8" cy="6.4" r=".9" fill="#33424E"/>'

    const PET_KE_FACE = ''
      + '<circle cx="14" cy="15" r="10" fill="#2E3A48"/>'
      + '<ellipse cx="9.5" cy="14" rx="4" ry="4.6" fill="#FDFDFB"/>'
      + '<ellipse cx="18.5" cy="14" rx="4" ry="4.6" fill="#FDFDFB"/>'
      + '<path d="M9 7.5 Q12 5.6 15 6.4" stroke="#3E4E60" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>'
      + '<circle cx="9.5" cy="14" r="1.5" fill="#242C36" class="dsh-pet-eye"/>'
      + '<circle cx="18.5" cy="14" r="1.5" fill="#242C36" class="dsh-pet-eye"/>'
      + '<circle cx="10" cy="13.5" r=".5" fill="#FFFFFF"/>'
      + '<circle cx="19" cy="13.5" r=".5" fill="#FFFFFF"/>'
      + '<path d="M12 18.5 l4 0 l-2 2.6 z" fill="#F5A623"/>'

    const PET_KE_TRAIL = ''
      + '<g fill="#8FA3B0"><ellipse cx="6" cy="7.6" rx="3.1" ry="2.5"/>'
      + '<circle cx="2.7" cy="3.7" r="1.35"/><circle cx="5" cy="2.3" r="1.35"/>'
      + '<circle cx="7.3" cy="2.3" r="1.35"/><circle cx="9.5" cy="3.8" r="1.35"/></g>'

    const PET_SHU_SIDE = ''
      + '<circle cx="6.2" cy="26" r="1.6" fill="#E3C9A4"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="12" y="31" width="4" height="5.5" rx="2" fill="#D9BE97" style="transform-origin:14px 32px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="22" y="31" width="4" height="5.5" rx="2" fill="#E3C9A4" style="transform-origin:24px 32px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="29" y="31" width="4" height="5.5" rx="2" fill="#E3C9A4" style="transform-origin:31px 32px"/>'
      + '<ellipse cx="21" cy="24" rx="16" ry="11" fill="#F0DCC0"/>'
      + '<ellipse cx="21" cy="18.5" rx="13" ry="5.5" fill="#E3C9A4" opacity=".8"/>'
      + '<ellipse class="dsh-pet-belly" cx="20" cy="28" rx="9" ry="4.5" fill="#F9EDD8" style="transform-origin:20px 28px"/>'
      + '<path d="M12 17.5 Q17 13.5 23 13.5" stroke="#F9EDD8" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>'
      + '<circle cx="31.5" cy="12.5" r="2.8" fill="#E3C9A4"/>'
      + '<circle cx="31.7" cy="12.6" r="1.5" fill="#EFB9A8"/>'
      + '<circle cx="29.5" cy="15.5" r="1.7" fill="#3F3630" class="dsh-pet-eye"/>'
      + '<ellipse cx="33.5" cy="22" rx="5" ry="4.2" fill="#F6E6CE"/>'
      + '<circle cx="38.8" cy="18.5" r="1.1" fill="#E2A69B"/>'
      + '<path d="M37.4 20.6 q1.2 1 2.4 .2" stroke="#C89F82" stroke-width=".9" fill="none" stroke-linecap="round"/>'
      + '<path d="M36.5 19.5 l5.5 -1 M36.8 20.6 l5.5 .6" stroke="#C9AD8C" stroke-width=".8" fill="none" stroke-linecap="round"/>'

    const PET_SHU_FRONT = ''
      + '<ellipse cx="23" cy="26" rx="14" ry="10.5" fill="#F0DCC0"/>'
      + '<ellipse cx="23" cy="28" rx="8.5" ry="6.5" fill="#F9EDD8"/>'
      + '<ellipse cx="18.5" cy="36" rx="2.6" ry="1.8" fill="#E3C9A4"/>'
      + '<ellipse cx="27.5" cy="36" rx="2.6" ry="1.8" fill="#E3C9A4"/>'
      + '<circle cx="13.5" cy="19" r="6.5" fill="#F6E6CE"/>'
      + '<circle cx="32.5" cy="19" r="6.5" fill="#F6E6CE"/>'
      + '<circle cx="23" cy="17" r="9.5" fill="#F0DCC0"/>'
      + '<circle cx="16.5" cy="9" r="2.6" fill="#E3C9A4"/>'
      + '<circle cx="16.6" cy="9.1" r="1.3" fill="#EFB9A8"/>'
      + '<circle cx="29.5" cy="9" r="2.6" fill="#E3C9A4"/>'
      + '<circle cx="29.4" cy="9.1" r="1.3" fill="#EFB9A8"/>'
      + '<circle cx="19" cy="15.5" r="1.7" fill="#3F3630" class="dsh-pet-eye"/>'
      + '<circle cx="27" cy="15.5" r="1.7" fill="#3F3630" class="dsh-pet-eye"/>'
      + '<circle cx="23" cy="19.2" r="1.1" fill="#E2A69B"/>'
      + '<path d="M23 20.3 q-1.2 1.2 -2.3 .6 M23 20.3 q1.2 1.2 2.3 .6" stroke="#C89F82" stroke-width=".9" fill="none" stroke-linecap="round"/>'
      + '<rect x="21.7" y="21.4" width="1.9" height="2.4" rx=".7" fill="#FFFFFF"/>'
      + '<rect x="24.4" y="21.4" width="1.9" height="2.4" rx=".7" fill="#FFFFFF"/>'
      + '<ellipse cx="19.5" cy="29" rx="2.4" ry="2" fill="#E3C9A4"/>'
      + '<ellipse cx="26.5" cy="29" rx="2.4" ry="2" fill="#E3C9A4"/>'
      + '<ellipse cx="23" cy="28" rx="2" ry="1.3" fill="#4A4038"/>'
      + '<circle cx="24.6" cy="27.6" r=".7" fill="#F7F2E8"/>'

    const PET_SHU_PROP = ''
      + '<path d="M3 7 Q7 2.5 13 4.5 Q17 6 17 7 Q17 8 13 9.5 Q7 11.5 3 7 Z" fill="#4A4038"/>'
      + '<path d="M7 4.2 l0 5.6 M10.5 3.8 l0 6.2 M14 4.8 l0 4.4" stroke="#2E2A26" stroke-width="1.1" fill="none" stroke-linecap="round"/>'
      + '<ellipse cx="16.8" cy="7" rx="1.5" ry="1.1" fill="#F7F2E8"/>'

    const PET_SHU_FACE = ''
      + '<circle cx="8.5" cy="8.5" r="2.5" fill="#E3C9A4"/>'
      + '<circle cx="8.6" cy="8.6" r="1.2" fill="#EFB9A8"/>'
      + '<circle cx="19.5" cy="8.5" r="2.5" fill="#E3C9A4"/>'
      + '<circle cx="19.4" cy="8.6" r="1.2" fill="#EFB9A8"/>'
      + '<circle cx="14" cy="15.5" r="9.8" fill="#F0DCC0"/>'
      + '<circle cx="7.2" cy="18" r="3.8" fill="#F6E6CE"/>'
      + '<circle cx="20.8" cy="18" r="3.8" fill="#F6E6CE"/>'
      + '<circle cx="10.5" cy="14.5" r="1.5" fill="#3F3630" class="dsh-pet-eye"/>'
      + '<circle cx="17.5" cy="14.5" r="1.5" fill="#3F3630" class="dsh-pet-eye"/>'
      + '<circle cx="14" cy="17.6" r="1" fill="#E2A69B"/>'
      + '<rect x="12.6" y="18.8" width="1.3" height="1.9" rx=".5" fill="#FFFFFF"/>'
      + '<rect x="14.2" y="18.8" width="1.3" height="1.9" rx=".5" fill="#FFFFFF"/>'

    const PET_SHU_TRAIL = ''
      + '<g fill="#B9A88C"><circle cx="2.5" cy="3.2" r="1.1"/><circle cx="5.6" cy="2.6" r="1.1"/></g>'

    const PET_HU_SIDE = ''
      + '<g class="dsh-pet-tail" style="transform-origin:16px 34px">'
      + '<path d="M16 34 Q4 26 6.5 14 Q8 8 13 10 Q20 13 21.5 24 Q22 31 16 34 Z" fill="#D9663D"/>'
      + '<path d="M7 14 Q8.2 9.6 12 10.4 Q10.8 14.4 8.6 17.4 Q7.2 16 7 14 Z" fill="#FBF3E8"/></g>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="18" y="38" width="6" height="12" rx="3" fill="#8A4A2F" style="transform-origin:21px 39px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="40" y="38" width="6" height="12" rx="3" fill="#8A4A2F" style="transform-origin:43px 39px"/>'
      + '<path d="M14 30 Q20 20 34 21 Q46 22 50 30 Q47 37 36 37.5 Q22 38 14 30 Z" fill="#D9663D"/>'
      + '<ellipse cx="22" cy="32" rx="6.5" ry="5.5" fill="#C25832" opacity=".9"/>'
      + '<ellipse cx="46" cy="31" rx="6" ry="6.5" fill="#FBF3E8"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="24" y="38" width="5.5" height="12" rx="2.7" fill="#D9663D" style="transform-origin:26.7px 39px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="35" y="38" width="5.5" height="12" rx="2.7" fill="#D9663D" style="transform-origin:37.7px 39px"/>'
      + '<ellipse cx="27" cy="49.6" rx="2.8" ry="1.7" fill="#8A4A2F"/>'
      + '<ellipse cx="37.6" cy="49.6" rx="2.8" ry="1.7" fill="#8A4A2F"/>'
      + '<path d="M20 26 Q30 20.5 40 22" stroke="#E8845C" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"/>'
      + '<path d="M44.5 11.5 L43 2 L51 7.5 Z" fill="#D9663D"/>'
      + '<path d="M43 2 L47 5.6 L45.9 8.4 Z" fill="#4A372F"/>'
      + '<circle cx="51" cy="17" r="9.5" fill="#D9663D"/>'
      + '<path d="M49.5 10 L51 2 L56.5 8.5 Z" fill="#D9663D"/>'
      + '<path d="M51 2 L54.8 6.8 L52.9 9 Z" fill="#4A372F"/>'
      + '<circle cx="51.5" cy="15.5" r="1.8" fill="#3A2E28" class="dsh-pet-eye"/>'
      + '<path d="M56 15 Q63 16.5 63.5 19.5 Q60 22 55.6 21 Z" fill="#FBF3E8"/>'
      + '<circle cx="63" cy="18.6" r="1.5" fill="#3A2E28"/>'
      + '<path d="M57 20.8 q2.4 1.4 4.6 -.2" stroke="#8A4A2F" stroke-width=".9" fill="none" stroke-linecap="round"/>'

    const PET_HU_FRONT = ''
      + '<path d="M52 42 Q62 38 61 28 Q57 30.5 54.5 36 Q53 39.5 52 42 Z" fill="#D9663D"/>'
      + '<path d="M61 28 Q58.6 29.6 57 33.4 Q59.6 32.6 61 28 Z" fill="#FBF3E8"/>'
      + '<ellipse cx="31" cy="40" rx="13" ry="10" fill="#D9663D"/>'
      + '<ellipse cx="31" cy="40" rx="7" ry="7.5" fill="#FBF3E8"/>'
      + '<rect x="25.5" y="44" width="5" height="7" rx="2.5" fill="#8A4A2F"/>'
      + '<rect x="33" y="44" width="5" height="7" rx="2.5" fill="#8A4A2F"/>'
      + '<path d="M22.5 9 L19.5 1 L27.5 5 Z" fill="#D9663D"/>'
      + '<path d="M19.5 1 L23.6 4.7 L22.2 8 Z" fill="#4A372F"/>'
      + '<path d="M39.5 9 L42.5 1 L34.5 5 Z" fill="#D9663D"/>'
      + '<path d="M42.5 1 L38.4 4.7 L39.8 8 Z" fill="#4A372F"/>'
      + '<path d="M20.5 14 l-4.5 -1.5 l3 5 z" fill="#D9663D"/>'
      + '<path d="M41.5 14 l4.5 -1.5 l-3 5 z" fill="#D9663D"/>'
      + '<circle cx="31" cy="16" r="11" fill="#D9663D"/>'
      + '<ellipse cx="31" cy="20.5" rx="6" ry="4.6" fill="#FBF3E8"/>'
      + '<circle cx="26" cy="15" r="1.9" fill="#3A2E28" class="dsh-pet-eye"/>'
      + '<circle cx="36" cy="15" r="1.9" fill="#3A2E28" class="dsh-pet-eye"/>'
      + '<ellipse cx="31" cy="18.6" rx="1.5" ry="1.2" fill="#3A2E28"/>'
      + '<path d="M31 19.8 q-1.5 1.6 -3 .8 M31 19.8 q1.5 1.6 3 .8" stroke="#8A4A2F" stroke-width=".9" fill="none" stroke-linecap="round"/>'

    const PET_HU_PROP = ''
      + '<rect x="9.2" y="0.5" width="1.6" height="3" rx=".8" fill="#5E3D22"/>'
      + '<path d="M10 3 Q15.5 7 15 13 Q14.5 19.5 10 21.5 Q5.5 19.5 5 13 Q4.5 7 10 3 Z" fill="#9C6B3F"/>'
      + '<path d="M7 8 q3 1.6 6 0 M6.4 12 q3.6 1.8 7.2 0 M6.8 16 q3.2 1.7 6.4 0 M8.4 5 q1.6 1.2 3.2 0" stroke="#7C5230" stroke-width="1.2" fill="none" stroke-linecap="round"/>'

    const PET_HU_FACE = ''
      + '<path d="M8 8 L5.5 1 L12 4.5 Z" fill="#D9663D"/>'
      + '<path d="M5.5 1 L9 3.9 L7.6 6.4 Z" fill="#4A372F"/>'
      + '<path d="M20 8 L22.5 1 L16 4.5 Z" fill="#D9663D"/>'
      + '<path d="M22.5 1 L19 3.9 L20.4 6.4 Z" fill="#4A372F"/>'
      + '<circle cx="14" cy="15" r="9.8" fill="#D9663D"/>'
      + '<ellipse cx="14" cy="19.5" rx="5.4" ry="4.2" fill="#FBF3E8"/>'
      + '<circle cx="10" cy="14" r="1.5" fill="#3A2E28" class="dsh-pet-eye"/>'
      + '<circle cx="18" cy="14" r="1.5" fill="#3A2E28" class="dsh-pet-eye"/>'
      + '<ellipse cx="14" cy="17.8" rx="1.3" ry="1" fill="#3A2E28"/>'
      + '<path d="M14 18.8 q-1.3 1.4 -2.6 .7 M14 18.8 q1.3 1.4 2.6 .7" stroke="#8A4A2F" stroke-width=".9" fill="none" stroke-linecap="round"/>'

    const PET_HU_TRAIL = ''
      + '<g fill="#8F7A66"><ellipse cx="5.5" cy="6.6" rx="2.3" ry="1.9"/>'
      + '<circle cx="2.7" cy="3.5" r="1.05"/><circle cx="5" cy="2.3" r="1.05"/>'
      + '<circle cx="7.3" cy="2.3" r="1.05"/><circle cx="9.3" cy="3.7" r="1.05"/></g>'

    const PET_XIONG_SIDE = ''
      // 熊猫的黑色分布（实机验收"完全不像是熊猫"后的重画）：黑耳 / 大黑眼斑 /
      // 黑肩带连前肢 / 黑后臀连后腿，脸与身体中段是白 —— 旧版身体上下各一条
      // 孤立黑边（像被黑布勒住的白身体），观感不是熊猫。眼睛用黑斑里的白点
      // （旧版棕色眼在黑斑里看不清，眼斑读不出来）。
      + '<ellipse cx="15.5" cy="40" rx="9.5" ry="11" fill="#2E2A28"/>'
      + '<ellipse cx="30" cy="37" rx="16.5" ry="12.5" fill="#FAFAF7"/>'
      + '<ellipse cx="42" cy="34" rx="6.5" ry="9.5" fill="#2E2A28"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-b" x="16" y="38" width="7.5" height="13" rx="3.7" fill="#2E2A28" style="transform-origin:19.7px 39px"/>'
      + '<rect class="dsh-pet-leg dsh-pet-leg-a" x="38.5" y="38" width="7.5" height="13" rx="3.7" fill="#2E2A28" style="transform-origin:42.2px 39px"/>'
      + '<ellipse class="dsh-pet-belly" cx="29" cy="42" rx="9" ry="7.5" fill="#FFFFFF" style="transform-origin:29px 42px"/>'
      + '<circle cx="38.5" cy="7" r="4.2" fill="#2E2A28"/>'
      + '<circle cx="53" cy="7" r="4.2" fill="#2E2A28"/>'
      + '<circle cx="45.5" cy="17" r="11.5" fill="#FAFAF7"/>'
      + '<ellipse cx="41" cy="15" rx="4.4" ry="5.6" fill="#2E2A28" transform="rotate(-18 41 15)"/>'
      + '<ellipse cx="51.5" cy="14.5" rx="4.4" ry="5.6" fill="#2E2A28" transform="rotate(14 51.5 14.5)"/>'
      + '<circle cx="41.5" cy="15.8" r="1.5" fill="#FFFFFF" class="dsh-pet-eye"/>'
      + '<circle cx="51" cy="15.2" r="1.5" fill="#FFFFFF" class="dsh-pet-eye"/>'
      + '<ellipse cx="46.8" cy="21.8" rx="2" ry="1.5" fill="#2E2A28"/>'
      + '<path d="M46.8 23.3 q-1.4 1.6 -3 1 M46.8 23.3 q1.2 1.6 2.6 .8" stroke="#6B6560" stroke-width="1" fill="none" stroke-linecap="round"/>'

    const PET_XIONG_FRONT = ''
      // 正面：头下加黑色肩领（熊猫脖子处本就是黑肩带，头身连接也由它承载——
      // 白头直接坐在白身上会"头身分离"，琥珀猫咪那次的教训），手臂加粗成
      // 圆肩短臂，眼斑放大让"黑眼圈"这个第一辨识特征读得出来。
      + '<circle cx="16" cy="8.5" r="4.6" fill="#2E2A28"/>'
      + '<circle cx="42" cy="8.5" r="4.6" fill="#2E2A28"/>'
      + '<ellipse cx="29" cy="39.5" rx="15.5" ry="11.5" fill="#FAFAF7"/>'
      + '<ellipse cx="29" cy="30" rx="11" ry="5" fill="#2E2A28"/>'
      + '<path d="M16.5 32 q-4.5 9 1 15.5 q7 -1.5 8.5 -8 Q24 33.5 16.5 32 Z" fill="#2E2A28"/>'
      + '<path d="M41.5 32 q4.5 9 -1 15.5 q-7 -1.5 -8.5 -8 Q34 33.5 41.5 32 Z" fill="#2E2A28"/>'
      + '<ellipse cx="21.5" cy="51" rx="5.4" ry="3" fill="#2E2A28"/>'
      + '<ellipse cx="36.5" cy="51" rx="5.4" ry="3" fill="#2E2A28"/>'
      + '<ellipse class="dsh-pet-belly" cx="29" cy="41" rx="8.5" ry="6.5" fill="#FFFFFF" style="transform-origin:29px 41px"/>'
      + '<circle cx="29" cy="16.5" r="12.5" fill="#FAFAF7"/>'
      + '<ellipse cx="22.5" cy="14.8" rx="4.8" ry="6" fill="#2E2A28" transform="rotate(-16 22.5 14.8)"/>'
      + '<ellipse cx="35.5" cy="14.8" rx="4.8" ry="6" fill="#2E2A28" transform="rotate(16 35.5 14.8)"/>'
      + '<circle cx="23" cy="15.6" r="1.55" fill="#FFFFFF" class="dsh-pet-eye"/>'
      + '<circle cx="35" cy="15.6" r="1.55" fill="#FFFFFF" class="dsh-pet-eye"/>'
      + '<ellipse cx="29" cy="20.8" rx="2.1" ry="1.6" fill="#2E2A28"/>'
      + '<path d="M29 22.4 q-1.4 1.6 -2.8 .9 M29 22.4 q1.4 1.6 2.8 .9" stroke="#6B6560" stroke-width="1" fill="none" stroke-linecap="round"/>'

    const PET_XIONG_PROP = ''
      + '<path d="M10 3 Q9 .8 7.4 .6 Q9.6 -.2 10.9 1.4 Q10.7 2.4 10 3 Z" fill="#67B35F"/>'
      + '<path d="M10 3 Q15 8 14 14 Q13 20.5 10 22.5 Q7 20.5 6 14 Q5 8 10 3 Z" fill="#D9C08A"/>'
      + '<path d="M7.6 8.4 q2.4 1.6 4.8 0 M7 13 q3 1.8 6 0 M7.8 17.6 q2.2 1.5 4.4 0 M8.8 5.2 q1.2 1 2.4 0" stroke="#B99C63" stroke-width="1.3" fill="none" stroke-linecap="round"/>'

    const PET_XIONG_FACE = ''
      + '<circle cx="7.5" cy="7" r="3.8" fill="#2E2A28"/>'
      + '<circle cx="20.5" cy="7" r="3.8" fill="#2E2A28"/>'
      + '<circle cx="14" cy="15.5" r="10" fill="#FAFAF7"/>'
      + '<ellipse cx="9.6" cy="14.3" rx="4.2" ry="5.2" fill="#2E2A28" transform="rotate(-15 9.6 14.3)"/>'
      + '<ellipse cx="18.4" cy="14.3" rx="4.2" ry="5.2" fill="#2E2A28" transform="rotate(15 18.4 14.3)"/>'
      + '<circle cx="9.9" cy="14.8" r="1.4" fill="#FFFFFF" class="dsh-pet-eye"/>'
      + '<circle cx="18.1" cy="14.8" r="1.4" fill="#FFFFFF" class="dsh-pet-eye"/>'
      + '<ellipse cx="14" cy="18.8" rx="1.8" ry="1.4" fill="#2E2A28"/>'
      + '<path d="M14 20.2 q-1.3 1.4 -2.6 .8 M14 20.2 q1.3 1.4 2.6 .8" stroke="#6B6560" stroke-width=".9" fill="none" stroke-linecap="round"/>'

    const PET_XIONG_TRAIL = ''
      + '<g fill="#57534E"><ellipse cx="7" cy="8" rx="3.6" ry="2.8"/>'
      + '<circle cx="2.6" cy="4" r="1.15"/><circle cx="4.8" cy="2.6" r="1.15"/>'
      + '<circle cx="7" cy="2.2" r="1.15"/><circle cx="9.2" cy="2.7" r="1.15"/>'
      + '<circle cx="11.2" cy="4.2" r="1.15"/></g>'

    /**
     * 宠物注册表 —— 二期的核心数据。顺序 = 面板头像行顺序 = 预览页顺序；
     * `ban-ban` 永远第一（缺省宠物）。全部字段是**数据**，不许出现函数。
     *
     * · `motion`：run（平滑直线）/ hop（抛物线蹦跳，起伏由运行时驱动）/ waddle（左右摇步）。
     * · `place`：未被拖过时的缺省摆位（视口右/下缘偏移；语义同一期）。
     * · `react.lines`：戳一下的两声；`cheer/done`：生成中加油 / 完成庆祝；`chat`：闲聊。
     */
    const PET_KINDS = [
      {
        id: 'ban-ban', species: '小奶狗', home: '斑斑',
        viewBox: '0 0 64 56', size: { w: 64, h: 56 },
        art: { side: PET_BAN_SIDE, front: PET_BAN_FRONT },
        propViewBox: '0 0 26 22', propSize: { w: 26, h: 22 }, propArt: PET_BAN_PROP,
        faceViewBox: '0 0 28 28', faceArt: PET_BAN_FACE,
        trail: { art: PET_BAN_TRAIL, w: 12, h: 11, everyPx: 26, side: 5 },
        motion: 'run', speed: 130,
        react: { lines: ['汪！', '汪汪！'], ms: 1450 },
        cheer: '汪汪！加油！', done: '汪汪！完成啦！',
        chat: [
          '汪…斑斑在看着你写代码～',
          '要不要休息一下？斑斑可以陪你玩毛线团！',
          '汪！今天的代码也写得棒棒的！',
          '（歪头）这个 bug 闻起来有线索的味道…',
        ],
        place: { pet: { dx: -100, dy: -56 }, prop: { dx: -132, dy: -22 } },
      },
      {
        id: 'da-ju', species: '橘猫', home: '大橘',
        viewBox: '0 0 62 54', size: { w: 62, h: 54 },
        art: { side: PET_JU_SIDE, front: PET_JU_FRONT },
        propViewBox: '0 0 24 18', propSize: { w: 24, h: 18 }, propArt: PET_JU_PROP,
        faceViewBox: '0 0 28 28', faceArt: PET_JU_FACE,
        trail: { art: PET_JU_TRAIL, w: 11, h: 10, everyPx: 22, side: 4 },
        motion: 'run', speed: 140,
        react: { lines: ['喵～？', '喵喵！'], ms: 1350 },
        cheer: '喵！在跑了在跑了！', done: '喵～搞定，可以吸猫了',
        chat: [
          '喵～敲键盘的手不可以摸鱼，但是可以摸猫',
          '代码写累了？本橘允许你吸三分钟猫',
          '喵呜…小鱼干和 commit，都再来一点嘛',
          '本橘监工中，摸鱼是会被记小本本的哦',
        ],
        place: { pet: { dx: -96, dy: -54 }, prop: { dx: -130, dy: -18 } },
      },
      {
        id: 'xue-qiu', species: '垂耳兔', home: '雪球',
        viewBox: '0 0 58 56', size: { w: 58, h: 56 },
        art: { side: PET_TU_SIDE, front: PET_TU_FRONT },
        propViewBox: '0 0 24 22', propSize: { w: 24, h: 22 }, propArt: PET_TU_PROP,
        faceViewBox: '0 0 28 28', faceArt: PET_TU_FACE,
        trail: { art: PET_TU_TRAIL, w: 10, h: 8, everyPx: 34, side: 0 },
        motion: 'hop', speed: 150,
        react: { lines: ['哼哼！', '蹦！'], ms: 1250 },
        cheer: '加油加油！蹦！', done: '写完啦！蹦蹦庆祝！',
        chat: [
          '胡萝卜含量：0。兔兔有点失望…',
          '蹦蹦跳跳，bug 全都跑掉！',
          '兔兔在呢，慢慢想，不着急～',
          '耳朵告诉你：这一版写得不错哦！',
        ],
        place: { pet: { dx: -92, dy: -56 }, prop: { dx: -124, dy: -22 } },
      },
      {
        id: 'bo-bo', species: '小企鹅', home: '波波',
        viewBox: '0 0 52 58', size: { w: 52, h: 58 },
        art: { side: PET_KE_SIDE, front: PET_KE_FRONT },
        propViewBox: '0 0 24 14', propSize: { w: 24, h: 14 }, propArt: PET_KE_PROP,
        faceViewBox: '0 0 28 28', faceArt: PET_KE_FACE,
        trail: { art: PET_KE_TRAIL, w: 12, h: 10, everyPx: 30, side: 6 },
        motion: 'waddle', speed: 110,
        react: { lines: ['嘎！', '嘎嘎！'], ms: 1300 },
        cheer: '嘎！冲鸭！', done: '嘎！收工，鱼干时间！',
        chat: [
          '嘎！南极的网速都没这么慢过…',
          '扑通扑通，为你打 call！',
          '企鹅不怕冷，你的代码也要不惧重构！',
          '鱼给你留着，记得吃饭呀～',
        ],
        place: { pet: { dx: -86, dy: -58 }, prop: { dx: -118, dy: -14 } },
      },
      {
        id: 'nuo-mi', species: '仓鼠', home: '糯米',
        viewBox: '0 0 46 38', size: { w: 46, h: 38 },
        art: { side: PET_SHU_SIDE, front: PET_SHU_FRONT },
        propViewBox: '0 0 20 14', propSize: { w: 20, h: 14 }, propArt: PET_SHU_PROP,
        faceViewBox: '0 0 28 28', faceArt: PET_SHU_FACE,
        trail: { art: PET_SHU_TRAIL, w: 8, h: 6, everyPx: 14, side: 3 },
        motion: 'run', speed: 170,
        react: { lines: ['吱！', '吱吱！'], ms: 1100 },
        cheer: '吱吱吱！跑起来！', done: '吱！存进颊囊啦！',
        chat: [
          '吱吱！瓜子分你一半，bug 也分你一半！',
          '仓鼠球蓄力中…能量 +1',
          '颊囊已清空，可以继续装需求了！',
          '吱…今天的代码香香的，像葵花籽',
        ],
        place: { pet: { dx: -78, dy: -38 }, prop: { dx: -108, dy: -14 } },
      },
      {
        id: 'a-chi', species: '小狐狸', home: '阿赤',
        viewBox: '0 0 66 52', size: { w: 66, h: 52 },
        art: { side: PET_HU_SIDE, front: PET_HU_FRONT },
        propViewBox: '0 0 20 24', propSize: { w: 20, h: 24 }, propArt: PET_HU_PROP,
        faceViewBox: '0 0 28 28', faceArt: PET_HU_FACE,
        trail: { art: PET_HU_TRAIL, w: 11, h: 10, everyPx: 24, side: 4 },
        motion: 'run', speed: 155,
        react: { lines: ['咕？', '咕咕！'], ms: 1250 },
        cheer: '咕！冲！', done: '咕～漂亮！收工！',
        chat: [
          '咕？这条路径，狐狸觉得可疑哦',
          '悄悄告诉你：尾巴比代码先跑完～',
          '森林法则第一条：先写测试！',
          '咕～松果给你，创意也给你！',
        ],
        place: { pet: { dx: -100, dy: -52 }, prop: { dx: -138, dy: -24 } },
      },
      {
        id: 'tuan-tuan', species: '熊猫', home: '团团',
        viewBox: '0 0 60 56', size: { w: 60, h: 56 },
        art: { side: PET_XIONG_SIDE, front: PET_XIONG_FRONT },
        propViewBox: '0 0 20 24', propSize: { w: 20, h: 24 }, propArt: PET_XIONG_PROP,
        faceViewBox: '0 0 28 28', faceArt: PET_XIONG_FACE,
        trail: { art: PET_XIONG_TRAIL, w: 14, h: 12, everyPx: 34, side: 6 },
        motion: 'waddle', speed: 95,
        react: { lines: ['嘿嘿！', '抱抱！'], ms: 1500 },
        cheer: '嘿嘿，冲呀！', done: '嘿嘿，完成！干饭！',
        chat: [
          '嘿嘿…竹子要一口一口吃，代码要一行一行写',
          '团团营业中，干饭与陪写两不误～',
          '黑眼圈是天生的，你的可不能熬出来！',
          '抱住竹笋，也抱住今天的 KPI！',
        ],
        place: { pet: { dx: -94, dy: -56 }, prop: { dx: -128, dy: -24 } },
      },
    ]

    /** id → 注册表项；不认识的 id 一律回落第一只（缺省宠物）。 */
    const PET_KIND_BY_ID = new Map(PET_KINDS.map((kind) => [kind.id, kind]))

    /** 缺省宠物 = 注册表第一只（ban-ban）。切换逻辑与兜底逻辑都以它为准。 */
    const DEFAULT_PET_KIND = PET_KINDS[0]

    /** 宠物的显示尺寸（px）—— 注册表 size × PET_SCALE。消费尺寸一律走这里。 */
    function petDisplaySize(kind) {
      return { w: kind.size.w * PET_SCALE, h: kind.size.h * PET_SCALE }
    }

    /** 道具的显示尺寸（px）。与宠物同一缩放：道具不同步放大就会显得相对变小。 */
    function petPropDisplaySize(kind) {
      return { w: kind.propSize.w * PET_SCALE, h: kind.propSize.h * PET_SCALE }
    }

    /** 按注册表包裹一件姿势/道具/头像（<svg> 内部内容 → 完整 svg 字符串）。 */
    function petKindById(id) {
      return PET_KIND_BY_ID.get(id) ?? DEFAULT_PET_KIND
    }

    /**
     * 包一层姿势 svg。cls 是 dsh-pet-side / dsh-pet-front（正反面由 CSS 切换显示）。
     * 只做拼接、不读任何运行态 —— 面板卡面与预览页都能单独调用它。
     */
    function petSvg(kind, pose, cls) {
      return `<svg class="${cls}" viewBox="${kind.viewBox}" aria-hidden="true">${kind.art[pose]}</svg>`
    }

    /** 道具 svg（无类名：道具没有姿势切换）。 */
    function petPropSvg(kind) {
      return `<svg viewBox="${kind.propViewBox}" aria-hidden="true">${kind.propArt}</svg>`
    }

    /**
     * 挂件状态的缺省值：默认关；名字按注册表逐只给（names 是 kind → 名字的表，
     * 每只宠物各自记住自己的名字）；没拖过时按**当前宠物**的 place 摆位。
     */
    const PET_DEFAULTS = {
      on: false,
      kind: DEFAULT_PET_KIND.id,
      names: Object.fromEntries(PET_KINDS.map((kind) => [kind.id, kind.home])),
      placed: false,
      pet: { ...DEFAULT_PET_KIND.place.pet },
      prop: { ...DEFAULT_PET_KIND.place.prop },
    }

    /** 读到不认识的 kind 时置位（自检行要用），下一次成功读取时清掉。 */
    let stateKindFallback = false

    /**
     * 挂件运行态。`enabled` 是 localStorage 的内存镜像：resync 每帧都会进来，
     * 不能每次都读一遍 localStorage。`mode` = idle（待机）/ run（跑向道具）/
     * drag（被拖住）/ react（面对用户的反应）。
     *
     * 坐标语义（相对舞台左上角的 px）：x/y 是宠物的**左上角**；propX 是道具的
     * **中心 x**、propY 是它的上缘。dir 是水平朝向：1 = 朝右（美术原方向），-1 = 朝左
     * （镜像）—— 缺省朝左，因为缺省摆位里道具就在宠物左侧，它一出生就该看着玩具。
     * hop 步态：hopFrac 是 0..1 的相位，lift 是当前视觉抬升（只影响显示，不动逻辑坐标）。
     */
    const petRun = {
      enabled: false, mode: 'idle', dir: -1, kindId: '',
      x: 0, y: 0, propX: 0, propY: 0, groundY: 0,
      hopFrac: 0, lift: 0,
      dragDX: 0, dragDY: 0, dragging: null,
      trailDist: 0, trailSide: 1, lastAt: 0, anchorKey: '', reactWasRunning: false,
      working: false, firstSyncAt: 0, everWorked: false,
    }
    /** 舞台与关键子节点的引用；null = 未挂载。 */
    let petStage = null
    const petRefs = { actor: null, prop: null, flip: null, figure: null, tag: null, name: null, input: null }
    /** 活着的脚印 / 气泡数量（有上限）。 */
    let petTrailCount = 0
    let petBubbleCount = 0
    /** react/cheer 的短时定时器；卸载时统一清掉，避免对已拆除的节点说话。 */
    let petTimers = []
    /** 本次模块实例的属主戳：热重载后旧实例留下的舞台会被清扫（ambient 同款做法）。 */
    const PET_OWNER = `p${Date.now()}`

    /**
     * 读取并消毒挂件状态。
     *
     * localStorage 里的东西不可信：换版本、手改、损坏的 JSON 都可能遇到。宁可回到缺省，
     * 也不把一个 `undefined` 画进 transform。旧形状（一期：name/dog/ball 标量键）在这里
     * **原地迁移**：dog→pet、ball→prop、name→names['ban-ban']，用户实机已在一期存过
     * 数据，升级不该让他重新摆位、重新起名。
     * @returns `{ on, kind, names, placed, pet: {dx,dy}, prop: {dx,dy} }`。
     */
    function readPetState() {
      const defaults = () => ({
        on: PET_DEFAULTS.on,
        kind: PET_DEFAULTS.kind,
        names: { ...PET_DEFAULTS.names },
        placed: PET_DEFAULTS.placed,
        pet: { ...PET_DEFAULTS.pet },
        prop: { ...PET_DEFAULTS.prop },
      })
      try {
        const raw = window.localStorage?.getItem(PET_KEY)
        if (typeof raw !== 'string' || raw === '') return defaults()
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return defaults()
        const out = defaults()
        const num = (value, fallback) =>
          (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
        const offset = (value, fallback) => {
          const obj = value !== null && typeof value === 'object' ? value : {}
          return { dx: num(obj.dx, fallback.dx), dy: num(obj.dy, fallback.dy) }
        }
        // kind：不认识的（含被手改成乱码）一律回落缺省宠物，并留痕给自检行。
        stateKindFallback = false
        if (typeof parsed.kind === 'string' && PET_KIND_BY_ID.has(parsed.kind)) {
          out.kind = parsed.kind
        } else if (typeof parsed.kind === 'string' && parsed.kind !== '') {
          stateKindFallback = true
        }
        const kind = petKindById(out.kind)
        // 名字表：按宠物各自记忆；当前宠物保证有名字（缺 → 注册表的 home）。
        if (parsed.names !== null && typeof parsed.names === 'object') {
          for (const key of Object.keys(out.names)) {
            const value = parsed.names[key]
            if (typeof value === 'string' && value.trim() !== '') {
              out.names[key] = value.trim().slice(0, 10)
            }
          }
        }
        // 一期迁移：顶层 name 只属于斑斑；dog/ball 是 pet/prop 的旧键名。
        if (typeof parsed.name === 'string' && parsed.name.trim() !== '') {
          out.names['ban-ban'] = parsed.name.trim().slice(0, 10)
        }
        if (typeof out.names[kind.id] !== 'string' || out.names[kind.id] === '') {
          out.names[kind.id] = kind.home
        }
        out.on = parsed.on === true
        out.placed = parsed.placed === true
        const petOffset = parsed.pet !== undefined ? parsed.pet : parsed.dog
        const propOffset = parsed.prop !== undefined ? parsed.prop : parsed.ball
        out.pet = offset(petOffset, kind.place.pet)
        out.prop = offset(propOffset, kind.place.prop)
        return out
      } catch {
        return defaults()
      }
    }

    /**
     * 合并写回挂件状态。写失败只记录 —— localStorage 被禁用时挂件仍可在本次会话里玩。
     * @param patch - 要合并进状态的部分字段。
     */
    function savePetState(patch) {
      try {
        window.localStorage?.setItem(PET_KEY, JSON.stringify({ ...readPetState(), ...patch }))
      } catch (error) {
        console.error('[theme-gallery] could not save the pet state:', error)
      }
    }

    /** 挂件现在是否开着（给卡片徽标与同步判据用）。 */
    function petWidgetOn() {
      return readPetState().on
    }

    /**
     * 挂件卡的"伪主题"形态。
     *
     * 面板卡片完全从主题注册表推导，而挂件不是主题 —— 所以给它一张**只在面板里存在**
     * 的卡片数据：走同一条排序与渲染管线（CARD_ORDER 序号、tooltip、禁用逻辑与其他卡
     * 一致），却不会被注册进主题服务（BUNDLED_THEMES 里没有它），官方外观列表也就
     * 多不出这一项。
     * @returns 只带卡片字段的对象（没有 tokens，默认色带为空）。
     */
    function petWidgetCardTheme() {
      return {
        id: PET_WIDGET.id,
        label: PET_WIDGET.label,
        description: PET_WIDGET.description,
        colorScheme: 'light',
        tokens: {},
      }
    }

    /**
     * 心情问候卡的卡片数据（petWidgetCardTheme 同构）：只在面板里存在的非主题卡，
     * 走同一条排序与渲染管线（CARD_ORDER 73、tooltip），不注册进主题服务，
     * 官方外观列表不会多出这一项。
     * @returns 只带卡片字段的对象（没有 tokens，默认色带为空）。
     */
    function moodCardTheme() {
      return {
        id: MOOD_WIDGET.id,
        label: MOOD_WIDGET.label,
        description: MOOD_WIDGET.description,
        colorScheme: 'light',
        tokens: {},
      }
    }

    /**
     * 输入框（composer 座位）的矩形。
     *
     * 这里**故意**不复用 mountGallery 里的 centreColumn / composerOf：那是挂载体内部的
     * 函数，工厂级的本函数够不到（硬性规则 4 的形状）。查找逻辑与它们一致，注释写明
     * 重复的原因 —— 两份实现谁坏了都会在"挂件不出现"上显形，而不是静默错位。
     *
     * ── 为什么不能只写 `.centerCol`（真机事故：挂件永远建不出来）────────────────
     *
     * 框架类名是**构建期哈希**：侧栏列在真机上叫 `ZTP-Xa_sidebarCol`，中心列同理是
     * `…_centerCol`。SKILL §13 的老教训在这里换了个形态复发——选择器命中 0 个元素、
     * 无异常无日志。所以中心列的查找必须像 `sidebarColumn()` 一样**哈希容忍**
     * （`[class*="_centerCol"]`），并再加两级兜底：全局找第一个 contenteditable /
     * textarea（聊天输入框几乎必然是其一）；连它都没有时由调用方回退到视口定位。
     * @returns 矩形，或 null（连全局输入框都找不到）。
     */
    function petAnchorBox() {
      if (typeof document === 'undefined') return null
      const centre = document.querySelector('[data-windows-titlebar] .centerCol')
        || document.querySelector('[class*="_centerCol"]')
        || document.querySelector('[class*="centerCol" i]')
      const composer = (centre === null ? null
        : centre.querySelector('[contenteditable="true"]') || centre.querySelector('textarea'))
        || document.querySelector('[contenteditable="true"]')
        || document.querySelector('textarea')
      if (composer === null && centre === null) return null
      for (const node of [composer === null ? undefined : composer.parentElement, composer, centre]) {
        if (node === undefined || node === null) continue
        const rect = node.getBoundingClientRect()
        if (rect.width > 0 || rect.height > 0) return rect
      }
      return null
    }

    /** 把 x 夹进窗口（狗按其半宽、球按其半径留边），拖出去也会被接住。 */
    function petClampX(x, half, width) {
      return Math.max(half, Math.min(x, Math.max(half, width - half)))
    }

    /**
     * 视口尺寸，带兜底：个别环境读不到 innerWidth / innerHeight 时钳位会变成 NaN，
     * 狗会瞬间飞出屏幕 —— 与其信任它们存在，不如在这里回退成常见值。
     * @returns `{ width, height }`（px）。
     */
    function petViewport() {
      const pick = (value, fallback) =>
        (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback)
      try {
        return {
          width: pick(window.innerWidth, 1280),
          height: pick(window.innerHeight, 800),
        }
      } catch {
        return { width: 1280, height: 800 }
      }
    }

    /** 指针坐标；桩环境给不出数字时返回 null（调用方直接忽略这一帧）。 */
    function petPointOf(event) {
      const x = event?.clientX
      const y = event?.clientY
      if (typeof x !== 'number' || typeof y !== 'number') return null
      return { x, y }
    }

    /** 挂件层自己的样式表（与 PAGE_CSS 分开：它属于运行时舞台，不属于面板页面）。 */
    const PET_CSS = [
      `#${PET_STAGE_ID}{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:1200}`,
      '.dsh-pet-actor,.dsh-pet-prop{position:absolute;left:0;top:0;pointer-events:auto;cursor:grab;will-change:transform}',
      '.dsh-pet-actor:active,.dsh-pet-prop:active{cursor:grabbing}',
      // flip 层与 figure 层必须分开：**镜像（内联 transform）绝不能和跑步动画（keyframes）
      // 放在同一个元素上** —— CSS 动画会覆盖内联 transform，放在一层就会"朝左跑时镜像
      // 失效、倒着跑"（真机事故）。尺寸由 buildPetStage 按注册表写内联（每只宠物不同）。
      '.dsh-pet-flip,.dsh-pet-figure{display:block;width:100%;height:100%}',
      '.dsh-pet-side,.dsh-pet-front{display:block;width:100%;height:100%}',
      '.dsh-pet-front{display:none}',
      '.dsh-pet-react .dsh-pet-side{display:none}',
      '.dsh-pet-react .dsh-pet-front{display:block}',
      // 眨眼：所有宠物共用（markup 里带 dsh-pet-eye 类的眼睛都会眨）。
      '.dsh-pet-eye{transform-box:fill-box;transform-origin:center;animation:dsh-pet-blink 4.6s infinite}',
      '@keyframes dsh-pet-blink{0%,91%,94.5%,100%{transform:scaleY(1)}92.8%{transform:scaleY(.12)}}',
      // 待机微动画锚点（幅度刻意克制："活着"，不是"表演"）；origin 由各宠物 markup 内联。
      '.dsh-pet-tail{animation:dsh-pet-wag 1.5s ease-in-out infinite}',
      '@keyframes dsh-pet-wag{from{transform:rotate(-7deg)}to{transform:rotate(9deg)}}',
      '.dsh-pet-ear{animation:dsh-pet-ear-flop 3.4s ease-in-out infinite}',
      '@keyframes dsh-pet-ear-flop{0%,86%,100%{transform:rotate(0)}91%{transform:rotate(7deg)}96%{transform:rotate(-5deg)}}',
      '.dsh-pet-wing{animation:dsh-pet-wing-idle 3s ease-in-out infinite}',
      '@keyframes dsh-pet-wing-idle{0%,88%,100%{transform:rotate(0)}93%{transform:rotate(-8deg)}}',
      '.dsh-pet-belly{animation:dsh-pet-breathe 3.8s ease-in-out infinite}',
      '@keyframes dsh-pet-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}',
      // 跑动（run 步态）：腿部摆动 + 身体起伏。
      '@keyframes dsh-pet-gallop-a{0%,100%{transform:rotate(17deg)}50%{transform:rotate(-17deg)}}',
      '@keyframes dsh-pet-gallop-b{0%,100%{transform:rotate(-15deg)}50%{transform:rotate(15deg)}}',
      '.dsh-pet-run .dsh-pet-leg-a{animation:dsh-pet-gallop-a .3s linear infinite}',
      '.dsh-pet-run .dsh-pet-leg-b{animation:dsh-pet-gallop-b .3s linear infinite}',
      '.dsh-pet-run .dsh-pet-figure{animation:dsh-pet-bob .3s ease-in-out infinite}',
      '@keyframes dsh-pet-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.6px)}}',
      // 摇摆步态（企鹅/熊猫）：身体左右摇；不挂腿部动画（脚贴地）。
      '.dsh-pet-waddle .dsh-pet-figure{animation:dsh-pet-rock .46s ease-in-out infinite}',
      '@keyframes dsh-pet-rock{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}',
      // 蹦跳步态（兔）：无循环类，起伏由运行时驱动（petRun.lift），落地即脚印。
      // 戳一下：正面像 + 两次小跳；加油/庆祝/精神一下共用这条 hop（关键帧在后）。
      '@keyframes dsh-pet-hop{0%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}60%{transform:translateY(-2px)}}',
      '.dsh-pet-react .dsh-pet-figure{animation:dsh-pet-hop .55s ease-in-out 2}',
      '.dsh-pet-cheer .dsh-pet-figure{animation:dsh-pet-hop .5s ease-in-out 2}',
      '.dsh-pet-perk .dsh-pet-figure{animation:dsh-pet-perk .9s ease-out 1}',
      '@keyframes dsh-pet-perk{0%{transform:scale(1)}30%{transform:scale(1.045)}100%{transform:scale(1)}}',
      // 名牌：opacity/visibility 显隐 + 隐藏侧 1.2s 延迟。实机验收：鼠标从宠物
      // 移向「改名/戳一下」的途中要穿过名牌与宠物之间的 5px 空隙，hover 一断名牌
      // 就消失。两处纯 CSS 的修法（不引 JS 定时器，符合有界性纪律）：
      //   · ::before 是跨过空隙的**透明桥**——名牌是 actor 的子元素，鼠标在桥上
      //     时 actor:hover 仍成立，可以一路走上名牌；
      //   · 隐藏侧 visibility 延迟 1.2s：离开 actor 后名牌仍可交互一小会儿，
      //     鼠标来得及走上去。显示侧 delay 归零（transition-delay 作用于全部属性）。
      '.dsh-pet-tag{display:inline-flex;position:absolute;left:50%;bottom:calc(100% + 5px);',
      'transform:translateX(-50%);pointer-events:auto;white-space:nowrap;z-index:3;',
      'align-items:center;gap:4px;padding:3px 6px;border-radius:8px;background:rgba(40,33,28,.92);',
      'color:#fff;font:11.5px/1.5 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;',
      'box-shadow:0 3px 10px rgba(0,0,0,.22);opacity:0;visibility:hidden;',
      'transition:opacity .18s ease,visibility 0s linear 1.2s}',
      '.dsh-pet-tag::before{content:"";position:absolute;left:0;right:0;bottom:-12px;height:12px}',
      '.dsh-pet-actor:hover .dsh-pet-tag,.dsh-pet-tag.dsh-pet-editing{opacity:1;visibility:visible;transition-delay:0s}',
      '.dsh-pet-name{max-width:96px;overflow:hidden;text-overflow:ellipsis}',
      '.dsh-pet-actions{display:inline-flex;gap:4px}',
      '.dsh-pet-tag button{border:none;border-radius:5px;padding:1px 7px;cursor:pointer;',
      'font:11px/1.6 inherit;color:#fff;background:rgba(255,255,255,.18)}',
      '.dsh-pet-tag button:hover{background:rgba(255,255,255,.34)}',
      '.dsh-pet-input{display:none;width:88px;border:none;border-radius:5px;padding:2px 6px;',
      'font:11.5px/1.5 inherit;color:#2b2320}',
      '.dsh-pet-editing .dsh-pet-name,.dsh-pet-editing .dsh-pet-actions{display:none}',
      '.dsh-pet-editing .dsh-pet-input{display:block}',
      // 拖拽中的反馈：影子加深，让人看清"它离地了"。
      '.dsh-pet-dragging .dsh-pet-figure{filter:drop-shadow(0 7px 6px rgba(0,0,0,.28))}',
      // 脚印：随物种换形状与颜色（注册表 trail.art），落一次淡一次；
      // 超时由 JS 兜底回收（reduced-motion 关掉动画时也成立）。
      '.dsh-pet-trailmark{position:absolute;left:0;top:0;opacity:.5;',
      'pointer-events:none;animation:dsh-pet-trail-fade 3.4s ease-out forwards}',
      '@keyframes dsh-pet-trail-fade{0%{opacity:.5}70%{opacity:.34}100%{opacity:0}}',
      // 叫声/闲聊/加油气泡。
      '.dsh-pet-bubble{position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;',
      'padding:2px 8px;border-radius:9px;background:#fff;color:#3B2B23;border:1px solid #E4CBA2;',
      'font:12px/1.6 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;',
      'box-shadow:0 2px 7px rgba(0,0,0,.16);animation:dsh-pet-bubble 1.15s ease-out forwards}',
      '@keyframes dsh-pet-bubble{0%{opacity:0;transform-origin:bottom left;scale:.6}',
      '14%{opacity:1;scale:1}78%{opacity:1;scale:1}100%{opacity:0;scale:1;translate:0 -9px}}',
      '@media (prefers-reduced-motion:reduce){',
      `#${PET_STAGE_ID} *{animation:none!important}`,
      // 名牌的 visibility 延迟是"鼠标能走上去"的功能窗口（透明桥），不是装饰动画：
      // reduced-motion 只去掉 opacity 淡入淡出，把交互窗口原样保留。
      `#${PET_STAGE_ID} .dsh-pet-tag{transition:visibility 0s linear 1.2s}}`,
    ].join('\n')

    /**
     * 挂件层样式表的就位与自愈（与 ambient 的 ensureAmbientStylesheet 同一策略）：
     * 每次同步都检查，不在就装、内容陈旧就换 —— "一次安装应该能活下来"这个假设
     * 在这台机器上已经失败过一次。
     * @returns 样式表元素，或 null（没有 document）。
     */
    function ensurePetStylesheet() {
      if (typeof document === 'undefined') return null
      const existing = document.querySelector('style[data-plugin-css="theme-gallery/pet"]')
      if (existing !== null) {
        if (existing.textContent === PET_CSS) return existing
        existing.remove()
      }
      const tag = document.createElement('style')
      tag.dataset.plugin = 'theme-gallery'
      tag.dataset.pluginCss = 'theme-gallery/pet'
      tag.textContent = PET_CSS
      if (document.head !== null) document.head.append(tag)
      else document.documentElement.append(tag)
      return tag
    }

    /* ── 活性机制的常量与状态（闲聊 / 打字回头 / 生成中加油）───────────────────
     *
     * 三重有界：闲聊是**单个可取消句柄**（petChatterTimer，任意时刻至多一个）；
     * 加油/庆祝只挂短时类名（句柄进 petTimers）；打字回头是 document 上唯一的
     * input 监听（搭舞台才装、拆舞台即卸）。任何一级检测失效都静默降级。
     */

    /** 闲聊：距最近互动至少 2 分钟才可能出现；之后每 2.5 分钟一个窗口。 */
    const CHATTER_FIRST_MS = 120000
    const CHATTER_GAP_MS = 150000
    /** 窗口内的随机延迟上限：避免"整点报时"的机械感，也挡住测试桩的立即定时器。 */
    const CHATTER_JITTER_MS = 90000
    /** 最近一次互动时刻（戳/拖/切宠/改名/加油都算）；0 = 尚未发生过。 */
    let petLastInteractAt = 0
    /** 闲聊的单句柄；0 = 无排程。 */
    let petChatterTimer = 0

    /** 打字回头：两次反应至少隔 15s；监听只此一个。 */
    const PET_TYPE_REACT_MS = 15000
    let petLastTypingAt = 0

    /**
     * "模型正在生成"的 DOM 信号：composer 主按钮在生成中会把 aria-label 置为
     * 「停止生成」/「Stop generating」（app.asar 内嵌 InputBar 实测，无哈希、
     * 框架有意设置的语义属性 —— SKILL §13 认可的稳定钩子类型）。
     * 查不到 = 未在生成（或界面改版），两种都按"闲"处理，静默降级。
     */
    const PET_WORKING_SELECTORS = [
      'button[aria-label="停止生成"]',
      'button[aria-label="Stop generating"]',
    ]
    /** 最近一次确认"在生成"的时刻；用于"忙过又闲下来"才庆祝。 */
    let petLastWorkedAt = 0

    /**
     * 记一次互动并重置闲聊计时。三机制共用的时间轴：宠物"和你玩过"之后，
     * 悄悄话才愿意再等一会儿。
     */
    function petNoteInteraction() {
      petLastInteractAt = Date.now()
      schedulePetChatter()
    }

    /** 排一次闲聊（先清旧句柄；舞台不在就不排）。 */
    function schedulePetChatter() {
      if (petStage === null) return
      if (typeof window.clearTimeout === 'function') window.clearTimeout(petChatterTimer)
      const base = petLastInteractAt === 0 ? CHATTER_FIRST_MS : CHATTER_GAP_MS
      const wait = base + Math.floor(Math.random() * CHATTER_JITTER_MS)
      petChatterTimer = window.setTimeout(petChatterTick, wait)
    }

    /**
     * 闲聊到点。三道闸都过才冒泡：舞台在、宠物待机、页面可见、距最近互动 ≥ 首闸。
     * 时间闸同时是**测试闸**：桩的 drive() 会把定时器立即执行，而桩里只过去了几毫秒，
     * 闸门挡住 → 测试不会看到伪闲聊（断言见 check-boot-path）。
     */
    function petChatterTick() {
      petChatterTimer = 0
      if (petStage === null) return
      if (petRun.mode !== 'idle') { schedulePetChatter(); return }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        schedulePetChatter()
        return
      }
      const idleFor = Date.now() - petLastInteractAt
      if (petLastInteractAt === 0 || idleFor < CHATTER_FIRST_MS) { schedulePetChatter(); return }
      const kind = petKindById(petRun.kindId)
      const line = kind.chat[Math.floor(Math.random() * kind.chat.length)]
      if (typeof line === 'string' && line !== '') petBubble(line)
      petLastInteractAt = Date.now()
      schedulePetChatter()
    }

    /** 是否检出"生成中"信号（找不到 = false，绝不抛错）。 */
    function petWorkingSignal() {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return false
      try {
        for (const selector of PET_WORKING_SELECTORS) {
          if (document.querySelector(selector) !== null) return true
        }
      } catch {
        return false
      }
      return false
    }

    /** 生成开始：冒加油台词 + 原地小跳两下（CSS 两次迭代，无 JS 循环）。 */
    function petCheer() {
      if (petStage === null || petRun.mode === 'drag') return
      petNoteInteraction()
      petBubble(petKindById(petRun.kindId).cheer)
      petFlash('dsh-pet-cheer', 1700)
    }

    /** 生成结束（忙过又闲下来）：冒完成台词 + 小跳一下。 */
    function petCelebrate() {
      if (petStage === null || petRun.mode === 'drag') return
      petNoteInteraction()
      petBubble(petKindById(petRun.kindId).done)
      petFlash('dsh-pet-cheer', 900)
    }

    /** 在宠物身上挂一个短时类名（挂/摘各一次，句柄入 petTimers，拆台统一清）。 */
    function petFlash(cls, ms) {
      if (petRefs.actor === null) return
      petRefs.actor.classList.add(cls)
      petTimers.push(window.setTimeout(() => {
        if (petRefs.actor !== null) petRefs.actor.classList.remove(cls)
      }, ms))
    }

    /**
     * 打字回头：用户在聊天输入框里敲字（节流 15s 内不重复）→ 宠物转身面向输入框，
     * 精神一下。反应是锦上添花，任何失败都吞掉保持安静。
     */
    function petOnTyping(event) {
      try {
        if (petStage === null || petRun.mode === 'drag') return
        const target = event?.target
        if (target === undefined || target === null) return
        const isComposer = target.isContentEditable === true || target.tagName === 'TEXTAREA'
        if (!isComposer) return
        const now = Date.now()
        if (now - petLastTypingAt < PET_TYPE_REACT_MS) return
        petLastTypingAt = now
        const box = petAnchorBox()
        if (box !== null && petRefs.actor !== null) {
          const kind = petKindById(petRun.kindId)
          const centre = petRun.x + petDisplaySize(kind).w / 2
          const nextDir = (box.left + box.right) / 2 > centre ? 1 : -1
          if (nextDir !== petRun.dir) {
            petRun.dir = nextDir
            applyPetPositions()
          }
        }
        petFlash('dsh-pet-perk', 900)
      } catch {
        // 反应失败不值得打扰任何人。
      }
    }

    /**
     * 拆掉舞台与其样式表，清空运行态。
     *
     * 定时器、闲聊句柄、document 监听一并清掉：任何一句话都不许对已拆除的节点说。
     */
    function removePetStage() {
      for (const handle of petTimers) window.clearTimeout(handle)
      petTimers = []
      if (typeof window.clearTimeout === 'function') window.clearTimeout(petChatterTimer)
      petChatterTimer = 0
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('input', petOnTyping, true)
      }
      if (petStage !== null) petStage.remove()
      petStage = null
      for (const key of Object.keys(petRefs)) petRefs[key] = null
      petTrailCount = 0
      petBubbleCount = 0
      petRun.mode = 'idle'
      petRun.dragging = null
      petRun.anchorKey = ''
      petRun.lastAt = 0
      petRun.kindId = ''
      petRun.lift = 0
      petRun.hopFrac = 0
      petLastInteractAt = 0
      petLastTypingAt = 0
      // 注意：petRun.working / petLastWorkedAt / everWorked **不**随舞台重置 ——
      // "模型在不在生成"是对应用的观察，不是舞台的状态；重置它会让换宠/重搭期间的
      // 边沿（尤其忙→闲的完成庆祝）静默丢失。陈旧触发由庆祝的 60s 时效窗挡住。
    }

    /** 把宠物与道具画到它们该在的位置（transform-only，不触发布局；hop 抬升只进显示）。 */
    function applyPetPositions() {
      if (petRefs.actor === null || petRefs.prop === null || petRefs.flip === null) return
      const kind = petKindById(petRun.kindId)
      petRefs.actor.style.transform = `translate(${Math.round(petRun.x)}px,${Math.round(petRun.y - petRun.lift)}px)`
      petRefs.prop.style.transform
        = `translate(${Math.round(petRun.propX - petPropDisplaySize(kind).w / 2)}px,${Math.round(petRun.propY)}px)`
      // 镜像写在独立的 flip 层 —— 绝不与跑步动画同层（动画会覆盖内联 transform，
      // 那正是"朝左跑却倒着跑"的事故根因）。
      petRefs.flip.style.transform = petRun.dir === 1 ? 'none' : 'scaleX(-1)'
    }

    /**
     * 跑动类名按步态挂：run → 腿部摆动 + 起伏；waddle → 身体左右摇；
     * hop 不挂循环类（起伏由运行时驱动，落地节奏即脚步）。
     */
    function petMotionClass() {
      return petKindById(petRun.kindId).motion === 'waddle' ? 'dsh-pet-waddle' : 'dsh-pet-run'
    }

    /** 开始跑向道具（幂等：跑动中 / 拖拽中 / 已在道具旁都不会白跑一轮）。 */
    function petStartRun() {
      if (petStage === null || petRun.mode === 'run' || petRun.mode === 'drag') return
      if (petDistanceToProp() <= 5) {
        petRun.mode = 'idle'
        return
      }
      petRun.mode = 'run'
      petRun.trailDist = 0
      petRun.hopFrac = 0
      petRun.lift = 0
      petRun.lastAt = 0
      petRefs.actor.classList.add(petMotionClass())
      // 复用工厂级单帧助手 step()：本文件的 requestAnimationFrame 预算因此不加一。
      step(petTick)
    }

    /** 宠物（左上角）到道具（中心）的直线距离（显示坐标系）。 */
    function petDistanceToProp() {
      const kind = petKindById(petRun.kindId)
      return Math.hypot(petRun.propX - petRun.x,
        (petRun.propY + petPropDisplaySize(kind).h / 2) - (petRun.y + petDisplaySize(kind).h / 2))
    }

    /** 停下（回到待机）。步态类名一并摘掉，腿/摇摆动画随之停止。 */
    function petStopRun() {
      if (petRefs.actor !== null) {
        petRefs.actor.classList.remove('dsh-pet-run')
        petRefs.actor.classList.remove('dsh-pet-waddle')
      }
      petRun.mode = 'idle'
      petRun.lastAt = 0
      petRun.lift = 0
    }

    /**
     * 跑动的每一帧。只在 mode === 'run' 时自续，停下即断 —— 这条循环有界：
     * 终点是道具，距离单调收敛，超时（标签页隐藏时 rAF 自动暂停）也不会累积。
     * 移动是**二维**的：朝道具的直线方向走，头始终朝向它（水平分量定镜像）。
     * 三种步态在这里分岔：run/waddle 直线推进（后者靠 CSS 摇摆）；hop 抛物线蹦跳
     * （hopFrac 是 0..1 的相位，lift 只影响显示坐标，落地一枚脚印）。
     */
    function petTick() {
      if (petStage === null || petRun.mode !== 'run') return
      const kind = petKindById(petRun.kindId)
      const now = Date.now()
      const dt = petRun.lastAt === 0 ? 0.016 : Math.min((now - petRun.lastAt) / 1000, 0.064)
      // 防线：任何非有限数进来都立即停车并留痕 —— NaN 若混进位置，宠物会凭空消失，
      // 而"消失"没有任何报错。宁可停下来让面板/控制台说一句话。
      if (!Number.isFinite(dt) || !Number.isFinite(petRun.x) || !Number.isFinite(petRun.y)
        || !Number.isFinite(petRun.propX) || !Number.isFinite(petRun.propY)) {
        console.error('[theme-gallery] pet run got a non-finite number; stopping the run loop.'
          + ` dt=${dt} pet=(${petRun.x},${petRun.y}) prop=(${petRun.propX},${petRun.propY})`)
        petStopRun()
        return
      }
      petRun.lastAt = now
      const dx = petRun.propX - petRun.x
      const dy = (petRun.propY + petPropDisplaySize(kind).h / 2) - (petRun.y + petDisplaySize(kind).h / 2)
      const dist = Math.hypot(dx, dy)
      if (dist <= 5) {
        petStopRun()
        return
      }
      // 先调头再跑：水平朝向由水平分量决定（几乎竖直的短途不改变朝向）。
      if (dx > 1) petRun.dir = 1
      else if (dx < -1) petRun.dir = -1
      const pace = Math.min(kind.speed * dt, dist)
      petRun.x += (dx / dist) * pace
      petRun.y += (dy / dist) * pace
      if (kind.motion === 'hop') {
        // 一跳 = PET_HOP_LEN_PX 的水平路程：相位推进，抛物线抬升，落地留印。
        petRun.hopFrac += pace / PET_HOP_LEN_PX
        if (petRun.hopFrac >= 1) {
          petRun.hopFrac -= 1
          petRun.trailSide = -petRun.trailSide
          dropTrail()
        }
        petRun.lift = Math.round(Math.sin(Math.PI * Math.min(petRun.hopFrac, 1)) * PET_HOP_LIFT_PX)
      } else {
        petRun.lift = 0
        petRun.trailDist += pace
        if (petRun.trailDist >= kind.trail.everyPx) {
          petRun.trailDist = 0
          petRun.trailSide = -petRun.trailSide
          dropTrail()
        }
      }
      applyPetPositions()
      step(petTick)
    }

    /**
     * 落一枚脚印（随物种换形状与颜色），落在宠物当前脚下；
     * 超时由 JS 兜底回收，活节点数有上限。
     */
    function dropTrail() {
      if (petStage === null || petTrailCount >= PET_TRAIL_MAX) return
      const kind = petKindById(petRun.kindId)
      const display = petDisplaySize(kind)
      const mark = document.createElement('span')
      mark.className = 'dsh-pet-trailmark'
      mark.innerHTML = `<svg viewBox="0 0 ${kind.trail.w} ${kind.trail.h}" width="${kind.trail.w}"`
        + ` height="${kind.trail.h}" aria-hidden="true">${kind.trail.art}</svg>`
      mark.style.transform = `translate(${Math.round(petRun.x + display.w / 2 + kind.trail.side * petRun.trailSide) - kind.trail.w / 2}px,`
        + `${Math.round(petRun.y + display.h) - kind.trail.h + 1}px)`
      petStage.append(mark)
      petTrailCount += 1
      window.setTimeout(() => {
        mark.remove()
        petTrailCount = Math.max(0, petTrailCount - 1)
      }, PET_TRAIL_FADE_MS + 200)
    }

    /** 冒一句气泡（叫声/闲聊/加油共用；文案是常量；数量有上限）。 */
    function petBubble(text) {
      if (petStage === null || petBubbleCount >= PET_BUBBLE_MAX) return
      const kind = petKindById(petRun.kindId)
      const bubble = document.createElement('span')
      bubble.className = 'dsh-pet-bubble'
      bubble.textContent = String(text)
      bubble.style.transform = `translate(${Math.round(petRun.x) + Math.round(petDisplaySize(kind).w) + 6}px,`
        + `${Math.round(petRun.y) - 30}px)`
      petStage.append(bubble)
      petBubbleCount += 1
      window.setTimeout(() => {
        bubble.remove()
        petBubbleCount = Math.max(0, petBubbleCount - 1)
      }, 1250)
    }

    /**
     * 戳一下：宠物转过身面对用户，说两句它的口头禅，然后该干嘛干嘛（刚才在跑就接着跑）。
     * react 期间再戳是空操作 —— 不然定时器会互相叠。
     */
    function petReact() {
      if (petStage === null || petRun.mode === 'drag' || petRun.mode === 'react') return
      const kind = petKindById(petRun.kindId)
      petNoteInteraction()
      petRun.reactWasRunning = petRun.mode === 'run'
      petStopRun()
      petRun.mode = 'react'
      petRefs.actor.classList.add('dsh-pet-react')
      petBubble(kind.react.lines[0])
      petTimers.push(window.setTimeout(() => petBubble(kind.react.lines[1]), Math.round(kind.react.ms * 0.4)))
      petTimers.push(window.setTimeout(() => {
        // react 不可重入（mode 门在函数开头），所以此刻挂起的定时器只有这一组：
        // 直接清空即可，数组不会随戳的次数增长。
        petTimers = []
        if (petRefs.actor === null) return
        petRefs.actor.classList.remove('dsh-pet-react')
        petRun.mode = 'idle'
        if (petRun.reactWasRunning || petDistanceToProp() > 5) petStartRun()
      }, kind.react.ms))
    }

    /** 点「改名」：名牌切换成输入框并钉住显示（不依赖悬停）。 */
    function petStartRename() {
      if (petRefs.tag === null || petRefs.input === null) return
      const kind = petKindById(petRun.kindId)
      petRefs.tag.classList.add('dsh-pet-editing')
      petRefs.input.value = readPetState().names[kind.id] ?? kind.home
      try {
        petRefs.input.focus()
        petRefs.input.select()
      } catch {
        // 无焦点可给（极端环境）就跳过；输入框仍在，点击即得焦点。
      }
    }

    /** 提交改名：空值回退旧名，最长 10 字；textContent 写回，注入面为零；名字按宠记忆。 */
    function petCommitRename() {
      if (petRefs.tag === null || petRefs.input === null) return
      if (!petRefs.tag.classList.contains('dsh-pet-editing')) return
      petRefs.tag.classList.remove('dsh-pet-editing')
      const kind = petKindById(petRun.kindId)
      const state = readPetState()
      const current = state.names[kind.id] ?? kind.home
      const raw = String(petRefs.input.value ?? '').trim().slice(0, 10)
      const name = raw === '' ? current : raw
      savePetState({ names: { ...state.names, [kind.id]: name } })
      if (petRefs.name !== null) petRefs.name.textContent = name
      petNoteInteraction()
    }

    /** 取消改名（Esc）。 */
    function petCancelRename() {
      if (petRefs.tag !== null) petRefs.tag.classList.remove('dsh-pet-editing')
    }

    /**
     * 开始拖宠物 / 拖道具。指针捕获尽量用上（指针出了窗口也能收到 pointerup），
     * 事件监听挂在被捕获元素上、结束时成对摘除 —— 不给全局留下常驻监听。
     * @param event - pointerdown 事件（桩环境可能缺字段，逐项容错）。
     * @param which - 'actor' 或 'prop'。
     */
    function petDragStart(event, which) {
      try {
        if (petStage === null || petRun.mode === 'react') return
        const point = petPointOf(event)
        if (point === null) return
        const target = event.currentTarget
        if (target === undefined || target === null) return
        // 先停跑、再进拖拽态 —— 顺序不能反：petStopRun 会把 mode 写回 idle，
        // 而宠物移动的每一帧都靠 mode === 'drag' 才跟手（反着写，拖动就静默失效）。
        petStopRun()
        petRun.mode = 'drag'
        petRun.dragging = which
        petRun.dragDX = point.x - (which === 'actor' ? petRun.x : petRun.propX)
        petRun.dragDY = point.y - (which === 'actor' ? petRun.y : petRun.propY)
        petStage.classList.add('dsh-pet-dragging')
        if (typeof target.setPointerCapture === 'function' && typeof event.pointerId === 'number') {
          try { target.setPointerCapture(event.pointerId) } catch { /* 指针可能已经释放 */ }
        }
        const move = (moveEvent) => petDragMove(moveEvent)
        const end = (endEvent) => {
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerup', end)
          target.removeEventListener('pointercancel', end)
          petDragEnd(endEvent)
        }
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', end)
        target.addEventListener('pointercancel', end)
      } catch (error) {
        console.error('[theme-gallery] pet drag could not start:', error)
      }
    }

    /** 拖动中：全屏二维跟手（x / y 都自由，钳位只保证不出屏）。 */
    function petDragMove(event) {
      if (petRun.mode !== 'drag') return
      const point = petPointOf(event)
      if (point === null) return
      const viewport = petViewport()
      const kind = petKindById(petRun.kindId)
      const display = petDisplaySize(kind)
      const propDisplay = petPropDisplaySize(kind)
      if (petRun.dragging === 'actor') {
        // 宠物的 transform 用左上角坐标，钳位按左上角算（右/下各留出它的宽高）。
        petRun.x = petClampX(point.x - petRun.dragDX, 0, viewport.width - display.w)
        petRun.y = petClampX(point.y - petRun.dragDY, 0, viewport.height - display.h)
      } else {
        petRun.propX = petClampX(point.x - petRun.dragDX, propDisplay.w / 2, viewport.width)
        petRun.propY = petClampX(point.y - petRun.dragDY, 0, viewport.height - propDisplay.h)
      }
      applyPetPositions()
    }

    /**
     * 松手：记住新位置（视口相对偏移，重启/缩放后自愈），然后宠物跑向道具
     * （拖道具同理 —— 道具到哪它追到哪，直线跑过去）。
     */
    function petDragEnd() {
      if (petStage === null) return
      petStage.classList.remove('dsh-pet-dragging')
      const which = petRun.dragging
      petRun.dragging = null
      petRun.mode = 'idle'
      const viewport = petViewport()
      if (which === 'actor') {
        savePetState({
          placed: true,
          pet: { dx: Math.round(petRun.x - viewport.width), dy: Math.round(petRun.y - viewport.height) },
        })
      } else if (which === 'prop') {
        savePetState({
          placed: true,
          prop: { dx: Math.round(petRun.propX - viewport.width), dy: Math.round(petRun.propY - viewport.height) },
        })
      }
      petNoteInteraction()
      applyPetPositions()
      petStartRun()
    }

    /**
     * 搭建舞台。结构节点全部用 createElement 逐个搭建（事件挂得上、桩环境找得到），
     * 美术件按注册表包裹注入（petSvg/petPropSvg）；名字用 textContent 写入 ——
     * 用户输入永远不进 HTML 字符串。尺寸（每只宠物不同）写内联，CSS 只管布局。
     */
    function buildPetStage() {
      const state = readPetState()
      const kind = petKindById(state.kind)
      const display = petDisplaySize(kind)
      const propDisplay = petPropDisplaySize(kind)
      const stage = document.createElement('div')
      stage.id = PET_STAGE_ID
      stage.dataset.plugin = 'theme-gallery'
      stage.dataset.petOwner = PET_OWNER
      stage.dataset.petKind = kind.id

      const prop = document.createElement('div')
      prop.className = 'dsh-pet-prop'
      prop.style.width = `${propDisplay.w}px`
      prop.style.height = `${propDisplay.h}px`
      prop.innerHTML = petPropSvg(kind)

      const actor = document.createElement('div')
      actor.className = 'dsh-pet-actor'
      actor.style.width = `${display.w}px`
      actor.style.height = `${display.h}px`

      // flip 层（水平镜像，内联 transform）与 figure 层（跑步/跳跃动画）必须分开 ——
      // 同层时 CSS 动画覆盖内联 transform，宠物会朝左跑却头朝右（真机事故）。
      const flip = document.createElement('span')
      flip.className = 'dsh-pet-flip'
      const figure = document.createElement('span')
      figure.className = 'dsh-pet-figure'
      figure.innerHTML = petSvg(kind, 'side', 'dsh-pet-side') + petSvg(kind, 'front', 'dsh-pet-front')
      flip.append(figure)

      const tag = document.createElement('span')
      tag.className = 'dsh-pet-tag'
      const name = document.createElement('span')
      name.className = 'dsh-pet-name'
      const actions = document.createElement('span')
      actions.className = 'dsh-pet-actions'
      const renameButton = document.createElement('button')
      renameButton.type = 'button'
      renameButton.className = 'dsh-pet-rename'
      renameButton.textContent = '改名'
      const pokeButton = document.createElement('button')
      pokeButton.type = 'button'
      pokeButton.className = 'dsh-pet-poke'
      pokeButton.textContent = '戳一下'
      const input = document.createElement('input')
      input.className = 'dsh-pet-input'
      input.maxLength = 10
      input.setAttribute('aria-label', `${kind.home}的名字`)
      actions.append(renameButton, pokeButton)
      tag.append(name, actions, input)
      actor.append(tag, flip)
      stage.append(prop, actor)

      petRefs.actor = actor
      petRefs.prop = prop
      petRefs.flip = flip
      petRefs.figure = figure
      petRefs.tag = tag
      petRefs.name = name
      petRefs.input = input
      petRefs.actor.addEventListener('pointerdown', (event) => petDragStart(event, 'actor'))
      petRefs.prop.addEventListener('pointerdown', (event) => petDragStart(event, 'prop'))
      // 名牌里的按钮不许触发拖拽：按住"戳一下"把宠物拖着走，谁都会觉得坏了。
      for (const control of [renameButton, pokeButton, input]) {
        control.addEventListener('pointerdown', (event) => {
          if (event !== undefined && typeof event.stopPropagation === 'function') event.stopPropagation()
        })
      }
      renameButton.addEventListener('click', () => petStartRename())
      pokeButton.addEventListener('click', () => petReact())
      input.addEventListener('keydown', (event) => {
        if (event?.key === 'Enter') petCommitRename()
        else if (event?.key === 'Escape') petCancelRename()
      })
      input.addEventListener('blur', () => petCommitRename())
      name.textContent = state.names[kind.id] ?? kind.home
      petRun.kindId = kind.id

      petStage = stage
      document.body.append(stage)
      // 活性机制随舞台一起起停：打字监听装上、闲聊排一次（时间闸见 petChatterTick）。
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('input', petOnTyping, true)
      }
      schedulePetChatter()
    }

    /** 最近一次挂件同步的读数（面板诊断用，与 ambientReport 同一角色）。 */
    let petReport

    /**
     * 把最近一次同步的读数写进 petReport。
     * @param entry - 读数片段（enabled / stage / display / anchor / 几何 / css / note）。
     */
    function notePetReport(entry) {
      petReport = { ...entry }
    }

    /** 面板上的挂件读数，一句话（与 describeAmbientReport 同一风格，刻意笨）。 */
    function describePetReport() {
      const r = petReport
      if (r === undefined) return '挂件[尚未同步]'
      const parts = [r.enabled === true ? '开' : '关', `舞台=${r.stage ?? '?'}`, `显示=${r.display === true ? '在' : '收'}`,
        `锚点=${r.anchor ?? '?'}`, `品种=${r.kind ?? '-'}`, `活动=${r.activity ?? '-'}`]
      if (r.right !== undefined) parts.push(`锚右=${r.right}`, `锚底=${r.bottom}`)
      // 地面= 独立输出：视口回退（锚点断）时恰恰最需要这个读数来核对抬量 ——
      // 旧实现把它挂在 锚右 那一支里，而 right 只在锚点找到时才写，回退时地面
      // 读数跟着一起消失（读数通道静默断裂，实机核对无从做起）。
      if (r.groundY !== undefined) parts.push(`地面=${r.groundY}`)
      if (r.x !== undefined) parts.push(`宠x=${r.x}`, `宠y=${r.y ?? '?'}`, `道具x=${r.propX}`, `道具y=${r.propY ?? '?'}`)
      parts.push(`样式=${r.css === true ? '在' : '缺'}`, `模式=${r.mode ?? '-'}`)
      if (r.note !== undefined) parts.push(r.note)
      return `挂件[${parts.join(' ')}]`
    }

    /**
     * 面板上的挂件自检行。
     *
     * 挂件关闭时不产出行（不打扰）；开启时的**警告**（舞台没建出 / 被收起 / 样式缺失）
     * 必须无条件到达面板 —— "开了但什么都不出现"正是本项目最典型的静默失败，
     * 这一行就是它的可观测出口。
     * @param petEnabled - store 里的挂件开关。
     * @returns 一行自检文字，或 null（挂件关闭）。
     */
    function petLineOf(petEnabled) {
      try {
        if (petEnabled !== true) return null
        const r = petReport
        if (r === undefined || r.enabled !== true) return '⚠ 挂件已开启但尚未同步（syncPetStage 未运行）'
        if (r.stage === 'absent') return `⚠ 挂件未建出舞台：${r.note ?? '锚点（输入框）未找到'}`
        if (r.display !== true) return `⚠ 挂件舞台已建但被收起：锚点=${r.anchor}`
        if (r.css !== true) return '⚠ 挂件样式表未生效（PET_CSS 不在文档中）'
        return `挂件自检通过 · ${describePetReport()}`
      } catch (error) {
        return `⚠ 挂件自检失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /** 与 sceneryLineIsWarning 同一条判据：⚠ 开头或带"失败"的行不算例行汇报。 */
    function petLineIsWarning(line) {
      return typeof line === 'string' && (line.startsWith('⚠') || line.includes('失败'))
    }

    /**
     * 挂件层的同步入口：resync（每帧至多一次，与 ambient 共用节流）与开关切换都会进来。
     *
     * 幂等判据在最前面（规则 3）：几何指纹没变就一个字节都不写。输入框不在屏幕上
     * （比如正看着别的面板）时挂件收起，等它回来 —— 收起不算状态变化。
     * 每一条退出路径都写 petReport：挂件的失败形态就是"什么都不出现"，没有读数就永远查不下去。
     *
     * 二期新增两件事，都在一切写入之前完成判定：
     *  · **换宠物**：localStorage 里的 kind 与舞台当前的 kindId 不一致 → 拆旧舞台、
     *    按新宠物重建（缺省摆位 + 出场跑向道具由既有逻辑自然发生）。
     *  · **生成中信号**（petWorkingSignal）在这里顺路检测 —— resync 本来就随 DOM
     *    变化节流触发，不需要新观察器；上升沿加油、下降沿（忙过之后）庆祝。
     */
    function syncPetStage() {
      if (typeof document === 'undefined') return
      // 急停开关与 ambient 同源：config.ambient:false 把这层装饰一并停掉。
      if (!petRun.enabled || !ambientEnabled()) {
        if (petStage !== null) removePetStage()
        notePetReport({ enabled: petRun.enabled, stage: 'absent', display: false, 'anchor': '-', note: ambientEnabled() ? '开关为关' : '急停开关(ambient:false)' })
        return
      }
      const state = readPetState()
      const kind = petKindById(state.kind)
      const viewport = petViewport()
      if (petRun.firstSyncAt === 0) petRun.firstSyncAt = Date.now()
      // 地面线：锚点（输入框）找到时贴它的下缘；找不到回退到屏幕底缘**抬高一段**
      // （实机验收：主题面板页 composer 隐藏 → 视口回退 → 宠物贴着窗口最底边被裁掉
      // 一截。抬高 48px 让它完整可见；输入框在屏上时本行一个像素都不变）。
      // 自检行有 锚点=视口回退 与 地面= 两个读数，实机可直接核对回退边距。
      const anchor = petAnchorBox()
      const anchorKind = anchor === null ? '视口回退' : 'found'
      const anchorRead = anchor === null ? {} : { right: Math.round(anchor.right), bottom: Math.round(anchor.bottom) }
      const groundTop = anchor === null ? viewport.height - PET_FALLBACK_GROUND_GAP : anchor.bottom
      petRun.groundY = Math.min(groundTop - 2, viewport.height - 6)
      ensurePetStylesheet()
      // 换宠物：不是当前舞台这只 → 拆掉重建（removePetStage 会清干净定时器与监听）。
      if (petStage !== null && petRun.kindId !== kind.id) removePetStage()
      // 热重载会把上一个实例的舞台留在 body 上：不是本实例属主的直接清扫（ambient 同款）。
      for (const stray of document.querySelectorAll(`#${PET_STAGE_ID}`)) {
        if (stray.dataset.petOwner !== PET_OWNER) stray.remove()
      }
      if (petStage === null) buildPetStage()
      if (petStage === null) {
        notePetReport({ enabled: true, stage: 'absent', display: false, anchor: anchorKind, note: '舞台搭建失败（见控制台）' })
        return
      }
      petStage.style.display = ''
      // 生成中信号：边缘检测（闲→忙加油；忙→闲且忙过才庆祝）。放在舞台建成**之后**：
      // 边沿若恰好落在"舞台刚被拆掉待重建"的那次同步里（比如换宠物），在前面检测就会
      // 静默丢失这次加油。任何检测失败都按"闲"处理，静默降级。
      const working = petWorkingSignal()
      if (working !== petRun.working) {
        petRun.working = working
        if (working) petCheer()
        // 60s 时效窗：忙过的记录太旧（比如挂件关了一阵再开）就不庆祝，
        // 那不是"刚完成的对话"。
        else if (petLastWorkedAt !== 0 && Date.now() - petLastWorkedAt < 60000) petCelebrate()
      }
      if (working) {
        petRun.everWorked = true
        petLastWorkedAt = Date.now()
      } else {
        petLastWorkedAt = 0
      }
      const key = [
        Math.round(viewport.width), Math.round(viewport.height),
        Math.round(petRun.groundY), state.placed === true, kind.id,
      ].join('|')
      const shownNow = petStage.style.display !== 'none'
      const cssReady = ambientStylesheetReady()
        && document.querySelector('style[data-plugin-css="theme-gallery/pet"]') !== null
      const activity = petRun.everWorked === false && Date.now() - petRun.firstSyncAt > 300000
        ? '未检出'
        : (petRun.working ? '生成中' : '闲')
      const kindNote = stateKindFallback ? '注=kind回落' : undefined
      const withNote = (base) => [base, kindNote].filter(Boolean).join(' ')
      if (key === petRun.anchorKey) {
        notePetReport({
          enabled: true, stage: 'built', display: shownNow, anchor: anchorKind,
          kind: kind.id, activity, ...anchorRead,
          groundY: Math.round(petRun.groundY),
          x: Math.round(petRun.x), y: Math.round(petRun.y),
          propX: Math.round(petRun.propX), propY: Math.round(petRun.propY),
          css: cssReady, mode: petRun.mode, note: withNote('几何未变化'),
        })
        return
      }
      petRun.anchorKey = key
      // 拖拽中位置归指针管：几何变化（如拖动的同时改了窗口）等松手后再算，
      // 否则这里改写位置会和指针打架，松手时还会存下错的偏移。
      if (petRun.mode === 'drag') {
        notePetReport({
          enabled: true, stage: 'built', display: true, anchor: anchorKind,
          kind: kind.id, activity, ...anchorRead,
          groundY: Math.round(petRun.groundY), css: cssReady, mode: petRun.mode, note: withNote('拖拽中：位置归指针管'),
        })
        return
      }
      if (state.placed) {
        // 用户拖过：以视口右/下缘的偏移还原（窗口缩放后自愈），只保证不出屏。
        const display = petDisplaySize(kind)
        const propDisplay = petPropDisplaySize(kind)
        petRun.propX = petClampX(viewport.width + state.prop.dx, propDisplay.w / 2, viewport.width)
        petRun.propY = petClampX(viewport.height + state.prop.dy, 0, viewport.height - propDisplay.h)
        if (petRun.mode === 'idle') {
          petRun.x = petClampX(viewport.width + state.pet.dx, 0, viewport.width - display.w)
          petRun.y = petClampX(viewport.height + state.pet.dy, 0, viewport.height - display.h)
        }
      } else {
        // 缺省摆位（每只宠物自带）：道具在宠物**左侧**、宠物**面朝左**看着玩具，
        // 两者都站在地面线上；水平位置锚定屏幕右缘（输入框右侧的空白区域）。
        const display = petDisplaySize(kind)
        const propDisplay = petPropDisplaySize(kind)
        petRun.propX = petClampX(viewport.width + kind.place.prop.dx, propDisplay.w / 2, viewport.width)
        petRun.propY = petRun.groundY - propDisplay.h
        if (petRun.mode === 'idle') {
          petRun.x = petClampX(viewport.width + kind.place.pet.dx, 0, viewport.width - display.w)
          petRun.y = petRun.groundY - display.h
        }
      }
      applyPetPositions()
      // 开局（或几何变化后）离道具远就跑过去 —— 也是它每次启用的小入场。
      if (petRun.mode === 'idle' && petDistanceToProp() > 6) petStartRun()
      notePetReport({
        enabled: true, stage: 'built', display: true, anchor: anchorKind,
        kind: kind.id, activity, ...anchorRead,
        groundY: Math.round(petRun.groundY),
        x: Math.round(petRun.x), y: Math.round(petRun.y),
        propX: Math.round(petRun.propX), propY: Math.round(petRun.propY),
        css: cssReady, mode: petRun.mode, note: kindNote,
      })
    }

    /**
     * Report whether the accent token layer actually reached the theme snapshot.
     *
     * ── WHY THIS READING IS NEEDED ───────────────────────────────────────────
     *
     * `syncAccent` stacks three tokens (`button-ghost-active-fill` / `-border` / `-hover`) with
     * `ctx.theme.overrideTokens`. Whether that layer works had **never been verified**, and one
     * earlier attempt to verify it used the wrong evidence: the active workspace FOLDER icon
     * turns the accent colour, which was taken as proof — but that icon is painted by the skin's
     * own `--dsw-alias-state-business-primary` token and has nothing to do with the layer.
     *
     * The service makes this checkable without any guesswork: `composeActive` folds every
     * override layer into `snapshot.active.tokens` before publishing, so the composed value is
     * readable straight off `getTheme()`.
     *
     * ── WHAT CAN AND CANNOT PROVE IT ─────────────────────────────────────────
     *
     * The composed VALUE is the only channel that carries information, and only when it differs
     * from what the skin declares for that same token:
     *
     *  • both bundled skins already ship `button-ghost-active-*` in their own palettes, AND the
     *    palette layer supplies them too — so the token COUNT is 67 either way. An earlier
     *    comment here claimed a count that "does not move" disproves the layer; for these skins
     *    it cannot move, so the claim was wrong and the count is reported for context only;
     *  • 梦海游鱼 declares `#2B74B5` for that token but its accent is `#FFD166`, so reading back
     *    `#FFD166` proves the accent layer composed OVER the palette — the palette alone cannot
     *    produce it;
     *  • 山青婷彩's accent is `#E88BB0` and it declares `#E88BB0` for the same token, so its
     *    reading is identical whether or not the layer is there. That is a property of the SKIN,
     *    not of the layer, and the verdict below says so instead of implying the reading proved
     *    something.
     *
     * The verdict is therefore computed, never asserted: it compares the composed value with the
     * skin's declared value and with the accent the layer was built from.
     * @returns the reading, as one segment of the panel line.
     */
    function describeAccentLayer() {
      try {
        const theme = ctx?.theme
        if (theme === undefined) return '激活层[无 theme 服务]'
        const snapshot = theme.getTheme()
        const active = snapshot?.active
        const tokens = active?.tokens ?? {}
        const TOKEN = '--dsw-alias-button-ghost-active-border'
        const composed = tokens[TOKEN]
        const definition = typeof active?.id === 'string' ? bundledTheme(active.id) : undefined
        const declared = declaredToken(definition, TOKEN)
        const accent = definition?.accent
        const layers = snapshot?.overrides === undefined
          ? '(服务未暴露)'
          : String(snapshot.overrides.size ?? snapshot.overrides.length ?? '?')
        // Computed, not assumed — see the note above. `不可分辨` is a real answer: it says this
        // skin's own value coincides with its accent, so this reading proves nothing either way.
        const verdict = accent === undefined
          ? '非本包皮肤(无法判断)'
          : accent === declared
            ? '不可分辨(强调色=皮肤自备值)'
            : composed === accent
              ? '生效(强调色压过自备值)'
              : composed === declared
                ? '未生效(仍是自备值)'
                : `未知(既非强调色也非自备值)`
        return `激活层[id=${active?.id ?? '?'}`
          + ` 层数=${layers}`
          + ` token数=${Object.keys(tokens).length}(自备同名令牌，不构成判据)`
          + ` ${TOKEN.replace('--dsw-alias-', '')}=${composed === undefined ? '(缺失)' : String(composed)}`
          + ` 自备=${declared === undefined ? '(无)' : String(declared)}`
          + ` 强调色=${accent ?? '(无)'}`
          + ` 判据=${verdict}]`
      } catch (error) {
        return `激活层[读取失败: ${String(error && error.message ? error.message : error)}]`
      }
    }

    /* ═══════════════════ 心情问候语（标题栏跑马灯）═══════════════════
     *
     * 面板第 14 张卡「心情问候」控制的第三种非主题卡面（与宠物挂件同一模式）：
     * 一条滚动的问候文字住在标题栏条内（应用/编辑菜单右侧、原生窗口按钮左侧的
     * 空拖拽带上），每 35 分钟换一条，语言料库里的正向短句。需求与决策记录见
     * docs/DESIGN-心情问候语-位置与语料方案.md，实施细节见 IMP-心情问候语-A/B/C。
     *
     *  · 不写主题服务：开关、设置、选句指针全部存 localStorage，绝不碰 preference；
     *  · 文字**只经 textContent** 进 DOM —— 语料虽是自家数据，注入面也按零算；
     *  · 有界工作：一个链式 setTimeout（35 分钟换条）+ 一个 resize listener，
     *    没有轮询、没有 interval（自旋事故的家规）；
     *  · 座位是 shell.overlay 槽位里的一张静态 div（见 mountGallery 的槽位注册段），
     *    本模块命令式地往里建条；座位还没渲染时留读数等下一次 sync，不轮询。
     */

    /** 卡片数据：id、标题与 tooltip（卡面**不渲染** description，与配色/挂件卡同一条分支）。 */
    const MOOD_WIDGET = {
      id: 'mood-greeting',
      label: '心情问候',
      description: '标题栏上滚动的问候语：默认开启，35 分钟换一条。卡上可开关，'
        + '并可调滚动速度（慢/中/快）、方向（左→右/右→左）与位置区域'
        + '（居中/左靠齐/左右缩进/右靠齐）。它不改变当前主题皮肤，可与任何皮肤同时开启。',
    }

    /** 问候的开关与三组设置记在这里。挂件同一条铁律：绝不写 `ui-theme.preference`。 */
    const MOOD_KEY = 'theme-gallery:mood'

    /** 选句指针（当天消费到第几条）单独存：形状与用户设置无关，坏了自己愈合。 */
    const MOOD_POINTER_KEY = 'theme-gallery:mood-pointer'

    /** 换条周期（用户定的 35 分钟）。 */
    const MOOD_PERIOD_MS = 35 * 60 * 1000

    /** 滚动速度三档（px/s）。中速默认；数值是初值，实机看着不合适就调表——
     *  调了要同步改 check-mood 的常量断言。60 偏快（用户二轮返工），中速降到 50。 */
    const MOOD_SPEEDS = { slow: 30, medium: 50, fast: 100 }

    /**
     * 位置区域的 5 等份映射（用户原话的几何化，DESIGN 第九节）：
     * 区域 = 标题栏条减去左侧菜单后的水平段分成 5 等份，每一档占用其中几份。
     * 留空的等份是给"将来装的其他插件"的（用户原话）。
     */
    const MOOD_ZONE_GEOMETRY = {
      left: { first: 1, parts: 4 },   // 左靠齐：占第 1–4 等份，右侧留 1
      center: { first: 1, parts: 5 }, // 居中（默认）：占满
      indent: { first: 2, parts: 3 }, // 左右缩进：中间 3 等份，左右各留 1
      right: { first: 2, parts: 4 },  // 右靠齐：占第 2–5 等份，左侧留 1
    }

    /**
     * 时段池边界（已确认）：早安 05:00–11:00 / 白天 11:00–22:00 / 夜深 22:00–次日 05:00。
     * 夜深的 `to: 29` 是环形写法：小时数 <5 时先加 24（见 moodPoolName），24–28 落进夜深。
     */
    const MOOD_TIME_POOLS = [
      { pool: 'morning', from: 5, to: 11 },
      { pool: 'day', from: 11, to: 22 },
      { pool: 'night', from: 22, to: 29 },
    ]

    /**
     * 原生窗口控制按钮（最小化/最大化/关闭）的预留宽度。它们是 OS 层 overlay，
     * DOM 测不到，只能预留——135px 是按钮本身，**用户返工（2026-09-27 截图）**：
     * 文字要离右上角按钮"远一点"，所以再让出 45px 呼吸位，共 180。
     */
    const MOOD_WINBTN_RESERVE = 180

    /**
     * 左端让位（用户二轮返工）：侧栏分界线到问候文字的呼吸位；菜单右缘的间隙
     * （侧栏收起时才由菜单决定左端，此时多让一些）。兜底常量 = 展开时侧栏 280 + 呼吸位。
     */
    const MOOD_SIDEBAR_GAP = 12
    const MOOD_MENU_GAP = 48
    const MOOD_FALLBACK_MENU_RIGHT = 292

    /** shell.overlay 里那张静态座位的选择器（槽位注册段渲染），与问候条元素 id。 */
    const MOOD_SEAT_SELECTOR = '[data-dsh-mood-seat]'
    const MOOD_BAR_ID = 'dsh-mood-bar'

    /** 语料分类枚举——与 embed-themes.mjs 的 MOOD_CATEGORIES 同一张表（建期已校验，运行期再认一遍）。 */
    const MOOD_CATEGORIES = ['morning', 'day', 'night', 'general', 'holiday']

    /**
     * 运行期再消毒一遍内联语料（不信任模块级常量的形状）。
     * 手改过 client.js、或旧版本内联了坏数据时，坏条目**逐条丢弃**，
     * 好条目照用——而不是整体抛错把问候功能打死。
     * @param pack - 内联的 BUNDLED_MOOD_LINES。
     * @returns 消毒后的行数组（可能为空；空库由 moodLineOf 报警告）。
     */
    function sanitizeMoodLines(pack) {
      const source = pack !== null && typeof pack === 'object' && Array.isArray(pack.lines) ? pack.lines : []
      const out = []
      for (const line of source) {
        if (line === null || typeof line !== 'object') continue
        if (typeof line.text !== 'string' || line.text.length === 0 || line.text.length > 200) continue
        if (!MOOD_CATEGORIES.includes(line.category)) continue
        if (typeof line.id !== 'string' || line.id === '') continue
        const clean = {
          id: line.id,
          seq: typeof line.seq === 'number' && Number.isFinite(line.seq) ? line.seq : 0,
          category: line.category,
          text: line.text,
        }
        if (line.category === 'holiday'
          && line.holiday !== null && typeof line.holiday === 'object'
          && typeof line.holiday.from === 'string' && typeof line.holiday.to === 'string') {
          clean.holiday = { from: line.holiday.from, to: line.holiday.to }
        }
        out.push(clean)
      }
      return out
    }

    /** 消毒副本：mood 运行区只读这一份，永远不直接摸 BUNDLED_MOOD_LINES。 */
    const MOOD_LINES = sanitizeMoodLines(BUNDLED_MOOD_LINES)

    /**
     * 读用户设置。localStorage 里的东西不可信（readPetState 同款理由）：
     * 逐字段消毒，坏字段回缺省；**缺省是开**（用户定的"默认开"）。
     * @returns `{ on, speed, direction, zone }`。
     */
    function readMoodState() {
      const fallback = { on: true, speed: 'medium', direction: 'ltr', zone: 'center' }
      try {
        const raw = window.localStorage?.getItem(MOOD_KEY)
        if (typeof raw !== 'string' || raw === '') return fallback
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return fallback
        return {
          on: parsed.on === true,
          speed: typeof parsed.speed === 'string' && parsed.speed in MOOD_SPEEDS ? parsed.speed : fallback.speed,
          direction: parsed.direction === 'rtl' ? 'rtl' : fallback.direction,
          zone: typeof parsed.zone === 'string' && parsed.zone in MOOD_ZONE_GEOMETRY ? parsed.zone : fallback.zone,
        }
      } catch {
        return fallback
      }
    }

    /**
     * 合并写回设置。写失败只记录 —— localStorage 被禁用时问候仍在本次会话里活着。
     * @param patch - 要合并的字段（先经调用方认可）。
     */
    function saveMoodState(patch) {
      try {
        window.localStorage?.setItem(MOOD_KEY, JSON.stringify({ ...readMoodState(), ...patch }))
      } catch (error) {
        console.error('[theme-gallery] could not save the mood state:', error)
      }
    }

    /** 本地日期键 `YYYY-MM-DD`（选句的"今天"以本地时区为准）。 */
    function moodDateKey(date) {
      const pad = (n) => String(n).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }

    /** `MM-DD` 键（节日区间比较用）。 */
    function moodMonthDay(date) {
      const pad = (n) => String(n).padStart(2, '0')
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }

    /**
     * 当前小时属于哪个时段池。夜深的环形边界：小时 <5 时加 24 归入"昨晚延续"。
     * @param hour - `date.getHours()`（0–23）。
     * @returns 池名。
     */
    function moodPoolName(hour) {
      const h = hour < 5 ? hour + 24 : hour
      for (const range of MOOD_TIME_POOLS) {
        if (h >= range.from && h < range.to) return range.pool
      }
      return 'general'
    }

    /**
     * 一条节日语料今天是否命中。`from > to` 视为跨年区间（如 12-31 → 01-02）。
     * @param line - 语料行（带 holiday 区间）。
     * @param mmdd - 今天的 `MM-DD`。
     * @returns 命中与否。
     */
    function moodHolidayMatches(line, mmdd) {
      if (line.holiday === undefined) return false
      const { from, to } = line.holiday
      if (from <= to) return mmdd >= from && mmdd <= to
      return mmdd >= from || mmdd <= to
    }

    /**
     * 此刻该用的语料池：节日命中 → 节日池（全部命中条目的并集）；否则时段池；
     * 池空（理论不发生——建期断言五类非空）回落 general。
     * @param date - "现在"。
     * @param lines - 消毒后的语料。
     * @returns `{ pool, items }`；items 可为空数组。
     */
    function moodPicksFor(date, lines) {
      const mmdd = moodMonthDay(date)
      const holiday = lines.filter((line) => line.category === 'holiday' && moodHolidayMatches(line, mmdd))
      if (holiday.length > 0) return { pool: 'holiday', items: holiday }
      const poolName = moodPoolName(date.getHours())
      const picked = lines.filter((line) => line.category === poolName)
      if (picked.length > 0) return { pool: poolName, items: picked }
      return { pool: 'general', items: lines.filter((line) => line.category === 'general') }
    }

    /** FNV-1a 32 位——日期种子的原料（无依赖、确定性）。 */
    function moodHash(text) {
      let hash = 0x811c9dc5
      for (let at = 0; at < text.length; at += 1) {
        hash ^= text.charCodeAt(at)
        hash = Math.imul(hash, 0x01000193)
      }
      return hash >>> 0
    }

    /** mulberry32 PRNG——小、快、确定性，够洗牌用。 */
    function mulberry32(seed) {
      let a = seed >>> 0
      // 先把函数赋给常量再返回：`return (…) =>` 里的 `return (` 会被 scope 审计
      // 读成"调用了名为 return 的函数"（wcagContrast 同一条教训的第三种形态）。
      const next = () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        const out = ((t ^ (t >>> 14)) >>> 0) / 4294967296
        return out
      }
      return next
    }

    /**
     * 当日确定性洗牌：同一天同池顺序稳定（会话重启不换血），跨天不同——
     * "每天不重样"的体验由种子里的日期实现，不依赖任何在线内容。
     * @param items - 池内语料。
     * @param date - "今天"。
     * @param pool - 池名（进种子，跨池顺序也不同）。
     * @returns 新数组（不改入参）。
     */
    function moodDayOrder(items, date, pool) {
      const next = mulberry32(moodHash(`${moodDateKey(date)}|${pool}`))
      const order = [...items]
      for (let at = order.length - 1; at > 0; at -= 1) {
        const swap = Math.floor(next() * (at + 1))
        const hold = order[at]
        order[at] = order[swap]
        order[swap] = hold
      }
      return order
    }

    /** 读选句指针；坏/缺返回 null（轮换逻辑自愈到 index 0）。 */
    function moodPointer() {
      try {
        const raw = window.localStorage?.getItem(MOOD_POINTER_KEY)
        if (typeof raw !== 'string' || raw === '') return null
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return null
        return {
          date: typeof parsed.date === 'string' ? parsed.date : '',
          pool: typeof parsed.pool === 'string' ? parsed.pool : '',
          index: Number.isInteger(parsed.index) && parsed.index >= 0 ? parsed.index : 0,
          lastId: typeof parsed.lastId === 'string' ? parsed.lastId : '',
        }
      } catch {
        return null
      }
    }

    /** 写选句指针；写失败只是明天从头开始，不值得打断谁。 */
    function saveMoodPointer(pointer) {
      try {
        window.localStorage?.setItem(MOOD_POINTER_KEY, JSON.stringify(pointer))
      } catch { /* 存储被禁时问候仍可显示，只是换条顺序回到队首 */ }
    }

    /**
     * 选下一条并推进指针（每次调用都消费一格——启动首条也一样，指针保证
     * 同一天内尽量不重复；池耗尽回绕，回绕后与上一条相同且池里不止一条时跳一格）。
     * @param now - "现在"。
     * @param lines - 消毒后的语料。
     * @returns 语料行，或 null（语料不可用）。
     */
    function moodNextLine(now, lines) {
      if (!Array.isArray(lines) || lines.length === 0) return null
      const { pool, items } = moodPicksFor(now, lines)
      if (items.length === 0) return null
      const dateKey = moodDateKey(now)
      const pointer = moodPointer()
      const fresh = pointer === null || pointer.date !== dateKey || pointer.pool !== pool
      const start = fresh ? 0 : pointer.index
      const order = moodDayOrder(items, now, pool)
      let pick = start % order.length
      if (order.length > 1 && order[pick].id === pointer?.lastId) pick = (pick + 1) % order.length
      saveMoodPointer({ date: dateKey, pool, index: pick + 1, lastId: order[pick].id })
      return order[pick]
    }

    /**
     * 应用/编辑菜单的右缘（问候区左端）。菜单是 preload 注入的固定元素
     * （`[data-windows-menu]`，见 preload 的 installWindowsMenu），
     * 侧栏折叠时它会挪位——每次都实测，几何自动跟随，不做写死常量。
     * @returns 菜单右缘 + 间隙；读不到时给兜底常量。
     */
    /**
     * 问候区左端。**用户二轮返工（截图）**：左端要让开**整个左侧菜单栏列**——
     * 侧栏与工作区有明显分界线（卡通素材也渲染在侧栏内），问候从分界线右侧开始，
     * 不再只是避开"编辑"按钮。所以取两者较大值：
     *
     *   · 侧栏列的实测右缘（`sidebarColumn()`，展开 ≈ 280，即分界线）+ 小呼吸位；
     *   · 应用/编辑菜单的右缘（侧栏**收起**时列宽为 0、菜单挪到 84px 起，此时由它兜底）。
     *
     * 都读不到（异常环境/旧版本）才落常量兜底。每次都实测：侧栏宽度是用户可拖的，
     * 收起/展开也随时切——写死必错（SKILL §13 同一条哲学）。
     * @returns 左端 x（px）。
     */
    function moodMenuRight() {
      let boundary = 0
      try {
        const column = sidebarColumn()
        if (column !== null && typeof column.getBoundingClientRect === 'function') {
          const rect = column.getBoundingClientRect()
          if (Number.isFinite(rect.right) && rect.right > 0) boundary = rect.right + MOOD_SIDEBAR_GAP
        }
      } catch { /* 桩环境没有 rect —— 由菜单/兜底接管 */ }
      try {
        const host = document.querySelector('[data-windows-menu]')
        if (host !== null && typeof host.getBoundingClientRect === 'function') {
          const rect = host.getBoundingClientRect()
          if (Number.isFinite(rect.right) && rect.right > 0) boundary = Math.max(boundary, rect.right + MOOD_MENU_GAP)
        }
      } catch { /* 同上 */ }
      if (boundary > 0) return boundary
      return MOOD_FALLBACK_MENU_RIGHT
    }

    /**
     * 位置区域的矩形：5 等份映射（MOOD_ZONE_GEOMETRY）作用在
     * 「问候区左端（侧栏分界线右侧）→ 窗口按钮左缘」这段上。
     * @param zone - `readMoodState().zone`。
     * @param viewportWidth - 窗口宽。
     * @param menuRight - `moodMenuRight()` 的读数（即左端）。
     * @returns `{ left, width }`（px），几何不可算时 null。
     */
    function moodZoneRect(zone, viewportWidth, menuRight) {
      const geo = MOOD_ZONE_GEOMETRY[zone]
      if (geo === undefined) return null
      const right = viewportWidth - MOOD_WINBTN_RESERVE
      const left = Math.min(menuRight, right - 160)
      // 左端为负 = 窗口窄到连菜单都放不下（异常环境）——宁可不渲染（自检行会给读数），
      // 也不要把条画到屏幕外去。
      if (!(right > left) || left < 0) return null
      const unit = (right - left) / 5
      const rectLeft = left + unit * (geo.first - 1)
      const rectWidth = unit * geo.parts
      if (!Number.isFinite(rectLeft) || !Number.isFinite(rectWidth) || rectWidth <= 0) return null
      return { left: rectLeft, width: rectWidth }
    }

    /** 问候条的样式表（一次性安装；元素树全部经 createElement/textContent）。 */
    const MOOD_CSS = [
      `#${MOOD_BAR_ID}{position:fixed;top:0;height:var(--dsh-windows-titlebar-height,40px);`
        + 'display:flex;align-items:center;overflow:hidden;pointer-events:none;'
        + 'font-size:12px;letter-spacing:.12em;color:var(--dsw-alias-label-tertiary)}',
      '.dsh-mood-track{display:inline-flex;white-space:nowrap;will-change:transform;'
        + 'animation:dsh-mood-rtl linear infinite}',
      '[data-dsh-mood-dir="ltr"] .dsh-mood-track{animation-name:dsh-mood-ltr}',
      '@keyframes dsh-mood-rtl{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
      '@keyframes dsh-mood-ltr{from{transform:translateX(-50%)}to{transform:translateX(0)}}',
      '.dsh-mood-half{display:inline-flex;align-items:center}',
      /* 句尾间隙 = **整个区域宽**（内联 width 由 moodBuildBar 按实测写入）：
         间隙 ≥ 区域宽时，数学上保证任一时刻区域内至多一句可见 —— 用户返工
         （2026-09-27 截图）："同一时刻，只有一句话显示在一处"。 */
      '.dsh-mood-text{flex:none}',
      '.dsh-mood-gap{flex:none;display:inline-block}',
      /* reduced-motion：功能保留、只停动画（挂件先例）——静止显示一份，超长省略。
         ⚠ 全杀规则必须待在媒体查询**里面**：裸写一条无条件 `animation:none!important`
         会把跑马灯动画本身一起杀掉（实机读数抓到过：animationName 变成 none）。 */
      '@media (prefers-reduced-motion:reduce){'
        + `#${MOOD_BAR_ID} *{animation:none!important}`
        + '.dsh-mood-half+.dsh-mood-half{display:none}'
        + `#${MOOD_BAR_ID} .dsh-mood-half{overflow:hidden;text-overflow:ellipsis;max-width:100%}}`,
    ].join('\n')

    /** 样式表是否已在文档里（自检读数之一）。 */
    function moodCssInstalled() {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return false
      return document.querySelector('style[data-plugin-css="theme-gallery/mood"]') !== null
    }

    /** 安装样式表（幂等）。 */
    function installMoodCss() {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return
      if (moodCssInstalled()) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-theme-gallery'
      tag.dataset.pluginCss = 'theme-gallery/mood'
      tag.textContent = MOOD_CSS
      document.head.appendChild(tag)
    }

    /** 拆除样式表（teardown 路径用）。 */
    function removeMoodCss() {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return
      for (const stale of document.querySelectorAll('style[data-plugin-css="theme-gallery/mood"]')) stale.remove()
    }

    /** 问候条运行态。`enabled` 是 localStorage 的内存镜像（petRun 同款理由）。 */
    const moodRun = { enabled: false, timer: null, retryTimer: null, retryTries: 0, resizeBound: false, fingerprint: '', line: null, pool: '-' }

    /**
     * 座位缺席的有界重试。shell.overlay 的渲染时机由外壳决定，常常晚于本插件的
     * 首轮 publish（实机读数：指针已走、座位已在、条还没建 —— 就是这个缺口），
     * 而之后可能再没有 publish 路过。所以缺席时用**单个可取消句柄**每 2 秒重试，
     * 至多 `MOOD_SEAT_RETRY_MAX` 次（约 30 秒）—— 建成即停，拆条即清，
     * 不做持续轮询（有界工作的家规）。
     */
    const MOOD_SEAT_RETRY_MS = 2000
    const MOOD_SEAT_RETRY_MAX = 15

    function moodArmSeatRetry() {
      if (moodRun.retryTimer !== null || moodRun.retryTries >= MOOD_SEAT_RETRY_MAX) return
      if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') return
      moodRun.retryTimer = window.setTimeout(() => {
        moodRun.retryTimer = null
        moodRun.retryTries += 1
        try {
          if (!moodRun.enabled) return
          const seat = document.querySelector(MOOD_SEAT_SELECTOR)
          if (seat === null) {
            moodArmSeatRetry()
            return
          }
          moodRun.retryTries = 0
          moodBuildBar()
        } catch (error) {
          console.error('[theme-gallery] could not retry the mood seat:', error)
        }
      }, MOOD_SEAT_RETRY_MS)
    }

    function moodCancelSeatRetry() {
      moodClearTimer(moodRun.retryTimer)
      moodRun.retryTimer = null
    }

    /** 自检读数。挂件 petReport 同款：每条退出路径都写，失败形态是"什么都不出现"，没有读数就查不下去。 */
    let moodReport
    function noteMoodReport(patch) {
      moodReport = { ...(moodReport ?? {}), ...patch }
    }

    /** 例行读数用的中文标签（自检行是给人读的）。 */
    const MOOD_ZONE_LABELS = { left: '左靠齐', center: '居中', indent: '左右缩进', right: '右靠齐' }
    const MOOD_SPEED_LABELS = { slow: '慢速', medium: '中速', fast: '快速' }

    /**
     * 面板自检行（petLineOf 同款形状）：关着返回 null；开着出问题给 ⚠ 警告；
     * 一切正常给一行读数。警告无条件显示、读数走 debug 开关——既有口径。
     * @param on - 问候是否开启（store 的 moodOn）。
     * @returns 自检行或 null。
     */
    function moodLineOf(on) {
      try {
        if (on !== true) return null
        const r = moodReport
        if (r === undefined || r.enabled !== true) return '⚠ 问候已开启但尚未同步（syncMoodBar 未运行）'
        if (r.seat !== 'ok') return `⚠ 问候条未建出：${r.note ?? '座位（shell.overlay）尚未渲染'}`
        if (r.css !== true) return '⚠ 问候样式表未生效（MOOD_CSS 不在文档中）'
        if (r.line === null || r.line === undefined) return `⚠ 语料不可用：${r.note ?? '没有可用语料'}`
        return `问候自检通过 · 条=${r.line} 池=${r.pool} 区域=${r.zoneLabel} 方向=${r.dirLabel} 速度=${r.speedLabel} 左=${r.left} 右=${r.right}`
      } catch (error) {
        return `⚠ 问候自检失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /** 与 petLineIsWarning 同一条判据：⚠ 开头或带"失败"的行不算例行汇报。 */
    function moodLineIsWarning(line) {
      return typeof line === 'string' && (line.startsWith('⚠') || line.includes('失败'))
    }

    /** 拆掉问候条元素（不动计时器——那是 teardown 的事）。 */
    function removeMoodBar() {
      if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return
      const bar = document.getElementById(MOOD_BAR_ID)
      if (bar !== null) bar.remove()
    }

    /**
     * 按当前状态（重）建问候条。幂等判据在最前：指纹没变一个字节都不写
     * （bounded-work 的守卫规矩；publish 每次都路过这里，不能每次都重建 DOM）。
     *
     * 文字**只经 textContent** 进 DOM；两半内容逐字节相同，translateX 0↔-50% 的
     * 循环天然无缝；时长 = 半宽 ÷ 速度档，速度换算全部落在动画时长上。
     */
    function moodBuildBar() {
      if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return
      const state = readMoodState()
      if (!moodRun.enabled || !ambientEnabled()) {
        removeMoodBar()
        noteMoodReport({
          enabled: moodRun.enabled, seat: 'absent', css: moodCssInstalled(), line: null,
          note: moodRun.enabled ? '急停开关(ambient:false)' : '开关为关',
        })
        return
      }
      installMoodCss()
      const seatNode = document.querySelector(MOOD_SEAT_SELECTOR)
      if (seatNode === null) {
        noteMoodReport({
          enabled: true, seat: 'absent', css: moodCssInstalled(),
          line: moodRun.line === null ? null : moodRun.line.id,
          pool: moodRun.pool, note: '座位（shell.overlay）尚未渲染',
        })
        moodArmSeatRetry()
        return
      }
      const viewport = petViewport()
      const menuRight = moodMenuRight()
      const rect = moodZoneRect(state.zone, viewport.width, menuRight)
      if (rect === null) {
        noteMoodReport({
          enabled: true, seat: 'ok', css: moodCssInstalled(),
          line: moodRun.line === null ? null : moodRun.line.id, pool: moodRun.pool,
          note: `几何不可算（viewport=${viewport.width} 菜单右缘=${menuRight}）`,
        })
        return
      }
      const active = moodRun.line
      if (active === null) {
        noteMoodReport({ enabled: true, seat: 'ok', css: moodCssInstalled(), line: null, pool: moodRun.pool, note: '语料不可用' })
        return
      }
      const fingerprint = [active.id, state.speed, state.direction, state.zone, rect.left, rect.width, viewport.width].join('|')
      let bar = document.getElementById(MOOD_BAR_ID)
      if (bar !== null && moodRun.fingerprint === fingerprint) {
        moodCancelSeatRetry()
        moodRun.retryTries = 0
        noteMoodReport({
          enabled: true, seat: 'ok', css: true, line: active.id, pool: moodRun.pool,
          zoneLabel: MOOD_ZONE_LABELS[state.zone], dirLabel: state.direction === 'ltr' ? '左→右' : '右→左',
          speedLabel: MOOD_SPEED_LABELS[state.speed], left: Math.round(rect.left), right: Math.round(rect.left + rect.width),
        })
        return
      }
      // —— 指纹变了：整条重建。重建比 diff 便宜，也是把旧速度/旧方向的动画一并带走的唯一途径。
      if (bar === null) {
        bar = document.createElement('div')
        bar.id = MOOD_BAR_ID
      }
      bar.textContent = ''
      bar.dataset.dshMoodDir = state.direction
      bar.style.left = `${rect.left}px`
      bar.style.width = `${rect.width}px`
      // **先把 bar 挂进座位再量宽度**：脱离 DOM 的元素 getBoundingClientRect() 是 0
      // （实机读数抓到过）。track 也一样——量宽前先把它挂进 bar。
      seatNode.appendChild(bar)
      const track = document.createElement('div')
      track.className = 'dsh-mood-track'
      bar.appendChild(track)
      // 每半 = **一句 + 一段等于区域宽的间隙**。间隙 ≥ 区域宽 ⇒ 两句不可能同时
      // 落在区域内（B 的左缘与 A 的右缘至少隔一个区域宽），滚动到接缝处 A 出、
      // B 进，视觉上"同一时刻只有一句话显示在一处"（用户返工要求）。
      const buildHalf = () => {
        const half = document.createElement('span')
        half.className = 'dsh-mood-half'
        const text = document.createElement('span')
        text.className = 'dsh-mood-text'
        text.textContent = active.text
        half.appendChild(text)
        const gap = document.createElement('span')
        gap.className = 'dsh-mood-gap'
        gap.style.width = `${rect.width}px`
        half.appendChild(gap)
        track.appendChild(half)
        return half
      }
      const first = buildHalf()
      track.appendChild(first.cloneNode(true))
      // 建成即停：座位重试链清零（它只在缺席时武装）。
      moodCancelSeatRetry()
      moodRun.retryTries = 0
      // 区域随窗口宽重算：唯一的事件 listener，首次建条时绑定、teardown 时拆除。
      if (!moodRun.resizeBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('resize', moodOnResize)
        moodRun.resizeBound = true
      }
      const halfWidth = first.getBoundingClientRect().width
      const speed = MOOD_SPEEDS[state.speed] ?? MOOD_SPEEDS.medium
      const duration = halfWidth > 0 && Number.isFinite(halfWidth) ? halfWidth / speed : 0
      // 时长非法（量不到宽度）就不写样式——交给 reduced-motion 的静止形态兜底，绝不写 NaN。
      if (duration > 0 && Number.isFinite(duration)) track.style.animationDuration = `${duration}s`
      // 字体加载完成后**重建一次**：副本数与滚动时长刚才按回退字体量的（实机读数：
      // 12 份、47.8s），字体就位后宽度才真实。一次性 promise、指纹守卫仍在 —— 有界。
      if (typeof document !== 'undefined' && document.fonts?.ready?.then === 'function') {
        document.fonts.ready.then(() => {
          if (moodRun.fingerprint !== fingerprint || moodRun.enabled !== true) return
          moodRun.fingerprint = ''
          moodBuildBar()
        }).catch(() => { /* 字体 API 异常就用首次的度量，不追 */ })
      }
      moodRun.fingerprint = fingerprint
      noteMoodReport({
        enabled: true, seat: 'ok', css: true, line: active.id, pool: moodRun.pool,
        zoneLabel: MOOD_ZONE_LABELS[state.zone], dirLabel: state.direction === 'ltr' ? '左→右' : '右→左',
        speedLabel: MOOD_SPEED_LABELS[state.speed], left: Math.round(rect.left), right: Math.round(rect.left + rect.width),
      })
    }

    /**
     * 计时器只走 **`window.setTimeout` / `window.clearTimeout`**（挂件同款）：
     * 测试桩拦得住，也绝不留一个裸的全局定时器把进程吊住（有界工作的家规）。
     */
    function moodClearTimer(handle) {
      if (handle === null) return
      if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') window.clearTimeout(handle)
    }

    /** 35 分钟后的下一次换条（单句柄链式；任何路径先 clear 自己）。 */
    function moodScheduleNext() {
      moodClearTimer(moodRun.timer)
      moodRun.timer = null
      if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') return
      moodRun.timer = window.setTimeout(() => {
        moodRun.timer = null
        try {
          if (!moodRun.enabled) return
          const line = moodNextLine(new Date(), MOOD_LINES)
          if (line === null) {
            noteMoodReport({ enabled: true, seat: moodReport?.seat ?? 'absent', css: moodCssInstalled(), line: null, pool: moodRun.pool, note: '语料不可用' })
            return
          }
          moodRun.line = line
          moodRun.pool = line.category === 'holiday' ? 'holiday' : moodRun.pool
          moodBuildBar()
        } catch (error) {
          console.error('[theme-gallery] could not rotate the mood line:', error)
        } finally {
          moodScheduleNext()
        }
      }, MOOD_PERIOD_MS)
    }

    /**
     * 问候条的同步入口（幂等）：publish 顺路调用、开关与设置路径显式调用。
     * 与 syncPetStage 同一条哲学——每条退出路径都写 moodReport。
     * 计时器只在第一次启动（句柄存在就不动它），换条节奏不随 publish 漂移。
     */
    function syncMoodBar() {
      try {
        const state = readMoodState()
        moodRun.enabled = state.on
        if (!state.on) {
          moodTeardown()
          return
        }
        if (moodRun.timer === null) moodScheduleNext()
        if (moodRun.line === null) {
          const line = moodNextLine(new Date(), MOOD_LINES)
          moodRun.line = line
          if (line !== null) moodRun.pool = line.category
        }
        moodBuildBar()
      } catch (error) {
        console.error('[theme-gallery] could not sync the mood bar:', error)
      }
    }

    /** resize 时区域要重算（唯一的事件 listener；挂载/拆卸成对）。 */
    function moodOnResize() {
      try {
        moodBuildBar()
      } catch (error) {
        console.error('[theme-gallery] could not resize the mood bar:', error)
      }
    }

    /**
     * 全部拆除：计时器、resize listener、条元素、样式表、运行态。
     * **刻意不叫 `…Dispose`**——那是自发光守卫审计里主题层专用模式的名字（规则 1）。
     */
    function moodTeardown() {
      moodClearTimer(moodRun.timer)
      moodRun.timer = null
      moodCancelSeatRetry()
      moodRun.retryTries = 0
      if (moodRun.resizeBound && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('resize', moodOnResize)
      }
      moodRun.resizeBound = false
      removeMoodBar()
      removeMoodCss()
      moodRun.fingerprint = ''
      moodRun.line = null
      noteMoodReport({ enabled: false, seat: 'absent', css: false, line: null, pool: '-', note: '开关为关' })
    }

    /**
     * Render the main-column gallery page.
     *
     * `usePanelInfo` comes from the layout's GlobalStandardProps, so the page can
     * render nothing when another panel is selected without the shell having to
     * mount and unmount it.
     * @param props - composed slot props.
     * @returns the page element tree.
     */
    function ThemeGalleryPage({ t, setTheme, pickScheme, togglePet, pickPet, toggleMood, setMood, useStore, usePanelInfo }) {
      const info = usePanelInfo((s) => s.activePanelId)
      const ids = useStore((s) => s.ids)
      const labels = useStore((s) => s.labels)
      const descriptions = useStore((s) => s.descriptions)
      const swatches = useStore((s) => s.swatches)
      const cardRows = useStore((s) => s.cardRows)
      const scheme = useStore((s) => s.scheme)
      const petEnabled = useStore((s) => s.petEnabled)
      const petKind = useStore((s) => s.petKind)
      const moodOn = useStore((s) => s.moodOn)
      const moodSpeed = useStore((s) => s.moodSpeed)
      const moodDirection = useStore((s) => s.moodDirection)
      const moodZone = useStore((s) => s.moodZone)
      const selected = useStore((s) => s.selected)
      const status = useStore((s) => s.status)
      // The layout keeps this page registered whatever the selection is, so it
      // renders nothing while another panel owns the main column.
      if (info !== PANEL_ID) return null
      // An empty picker must explain itself: the boot screen says only "failed",
      // and a silent empty page is indistinguishable from a broken one.
      if (ids.length === 0) {
        return jsxs('div', {
          className: 'tg-page',
          children: [
            jsx('div', { className: 'tg-title', children: t('title') }),
            jsx('div', { className: 'tg-hint', children: status || t('empty') }),
          ],
        })
      }
      // Detail lines are opt-in; a line that reports a problem is not detail.
      const scenery = sceneryLine(selected)
      const showScenery = scenery !== null && (debugEnabled() || sceneryLineIsWarning(scenery))
      // 挂件行同理：开了挂件却建不出舞台，警告必须无条件出现在面板上。
      const petLine = petLineOf(petEnabled === true)
      const showPet = petLine !== null && (debugEnabled() || petLineIsWarning(petLine))
      // 问候行同理：开着却没建出条（或样式缺失），必须无条件可见。
      const moodLine = moodLineOf(moodOn === true)
      const showMood = moodLine !== null && (debugEnabled() || moodLineIsWarning(moodLine))
      // ── THE HEADER COUNT IS SKINS, NOT CARDS ─────────────────────────────────
      //
      // The built-in 浅色 / 深色 cards are not skins — they only switch the palette back to the
      // official appearance — so counting them here would advertise a number that disagrees
      // with the README and with npm's description ("6 skins"). The cards are named in the
      // same line instead, so nothing is hidden by leaving them out of the number.
      // 宠物挂件卡同理：它不是主题、不换配色，只开关挂件，所以与内置卡一起排除在
      // "皮肤数"之外（copy-consistency 的正则钉住的是 skinCount 那一行的形状）。
      const builtInCards = ids.filter((id) => BUILT_IN_LABELS[id] !== undefined
        || id === PET_WIDGET.id || id === MOOD_WIDGET.id).length
      const skinCount = ids.length - builtInCards
      return jsxs('div', {
        className: 'tg-page',
        children: [
          jsxs('div', {
            className: 'tg-head',
            children: [
              jsx('span', { className: 'tg-title', children: t('title') }),
              jsx('span', { className: 'tg-hint', children: t('hint') }),
              jsx('span', { className: 'tg-hint', children: t('count', { count: skinCount }) }),
              // What this copy is, so a reader can compare it with the version npm
              // publishes without digging through the profile.
              jsx('span', { className: 'tg-hint', children: `v${BUNDLED_VERSION}` }),
            ],
          }),
          jsx('div', {
            className: 'tg-grid',
            children: ids.map((id) => jsx(ThemeCard, {
              id,
              label: labels[id],
              description: descriptions[id],
              swatches: swatches[id] || [],
              // Absent for every strip card; the palette-picker card is the only one
              // that has it.
              rows: (cardRows || {})[id],
              // Which of the picker's 15 slots is lit. Ignored by strip cards.
              selectedScheme: scheme,
              selected: id === selected,
              applied: t('applied'),
              // The click is recorded BEFORE it is handed to the shell, because the theme
              // service publishes synchronously and the publisher re-applies the remembered
              // skin: a built-in card clicked after a skin used to be undone immediately.
              // `rememberCardChoice` is what lets 浅色 / 深色 win — see its documentation.
              onSelect: (id) => { rememberCardChoice(id); setTheme(id) },
              // A picker slot: record the scheme first, then hand the anchor theme to the
              // shell exactly like clicking the card would — so the anchor becomes active
              // and the scheme layer has something to sit on.
              onPickScheme: (schemeId) => { pickScheme(schemeId) },
              // 挂件卡：点击 = 开关挂件（见 ThemeCard 的挂件分支）。开关状态也一并传下去，
              // 徽标与 aria-pressed 都读它。
              onTogglePet: () => { togglePet() },
              petEnabled: petEnabled === true,
              // 头像选择行：点亮哪颗、卡面画哪只，都读这个字段（publish 从 localStorage 报来）。
              petKind: typeof petKind === 'string' && petKind !== '' ? petKind : 'ban-ban',
              onPickPet: (kindId) => { pickPet(kindId) },
              // 心情问候卡：胶囊开关与三组 chips 都读这些字段（publish 从 localStorage 报来）。
              mood: { on: moodOn === true, speed: moodSpeed, direction: moodDirection, zone: moodZone },
              onToggleMood: () => { toggleMood() },
              onSetMood: (patch) => { setMood(patch) },
              t,
            }, id)),
          }),
          // ── the diagnostics go BELOW the cards, set apart, behind a caption ──────
          //
          // They used to sit between the header and the picker, where a wall of monospace
          // text buried the thing the panel exists for. Below the cards they read as a
          // reference block — and the caption is what keeps them from being mistaken for a
          // malfunction, which is exactly how a user read them. They stay CONDITIONAL:
          // detail waits for the debug switch, while a warning or a failure always prints.
          (debugEnabled() || showScenery || showPet || showMood)
            ? jsxs('div', {
              className: 'tg-diag',
              children: [
                jsx('div', { className: 'tg-diag-note', children: t('diagNote') }),
                debugEnabled() ? jsx('div', { className: 'tg-debug', children: themeDiagnostics(selected) }) : null,
                // Routine reports wait for the debug switch; warnings and errors print
                // regardless — when the active skin's decorations are missing, the reason
                // has to reach the person looking at the panel.
                showScenery
                  ? jsx('div', {
                    className: `tg-debug${ambientWarning(selected) === null ? '' : ' tg-warn'}`,
                    children: scenery,
                  })
                  : null,
                showPet
                  ? jsx('div', {
                    className: `tg-debug${petLineIsWarning(petLine) ? ' tg-warn' : ''}`,
                    children: petLine,
                  })
                  : null,
                showMood
                  ? jsx('div', {
                    className: `tg-debug${moodLineIsWarning(moodLine) ? ' tg-warn' : ''}`,
                    children: moodLine,
                  })
                  : null,
              ],
            })
            : null,
        ],
      })
    }

    /**
     * Render the sidebar panel entry.
     *
     * The sidebar owns the button and resolves the row label from the list
     * metadata; this renders only the glyph. Drawn inline rather than imported
     * from ui-primitives, whose payload is not part of the client's seeded module
     * table — the same reason the official bundle carries its own icons.
     * @param props - owner share (size, active).
     * @returns an inline SVG glyph.
     */
    function PanelGlyph({ size, active }) {
      const edge = typeof size === 'number' ? size : 16
      return jsxs('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        children: [
          jsx('circle', {
            cx: 8, cy: 8, r: 6,
            stroke: 'currentColor',
            'stroke-width': active ? 1.8 : 1.4,
          }),
          jsx('path', {
            d: 'M8 2a6 6 0 0 0 0 12z',
            fill: 'currentColor',
            opacity: active ? 0.9 : 0.55,
          }),
        ],
      })
    }

    /** Display name used in client diagnostics. */
    exports.name = 'theme-gallery'

    /**
     * 心情问候的座位：shell.overlay 槽位里的一张静态 div。
     *
     * 零 hooks、零 props——问候条的几何/文本/速度全由 mood 模块命令式管理
     * （见 moodBuildBar），这张 div 只是给 React 一个可卸载的挂载点。
     * `data-dsh-mood-seat` 是 MOOD_SEAT_SELECTOR 找它的稳定钩子（自己的数据属性，
     * 不依赖框架的哈希类名——SKILL §13 的老规矩）。
     * @returns the seat element.
     */
    function MoodSeat() {
      return jsx('div', {
        className: 'dsh-mood-seat',
        'data-dsh-mood-seat': '',
        'aria-hidden': 'true',
      })
    }

    /**
     * The HARD dependency list — deliberately ONE entry.
     *
     * Cordis' array form makes every entry REQUIRED: if an entry never becomes available the
     * fiber parks in `pending` forever, the loader's `await` never returns, and the desktop app
     * stops at "Loading plugins..." with nothing written to the crash log. This plugin has paid
     * for that lesson three times:
     *
     *   - `settingsScope` — provided by the CLIENT half of ui-theme, so a HOST-side request for
     *     it could never be satisfied: `pending (waiting for service: settingsScope)`.
     *   - `theme` together with a reverse `modifies: [ui-theme]` in the bundle patch — the
     *     loader was told to start this row both before AND after ui-theme, so both fibers
     *     waited on each other: `dsh-theme-gallery: failed`.
     *   - the same `theme` entry with no `dsh.client.inject` in the manifest, so nothing
     *     guaranteed the module providing the service was loaded first — a hang with NO log line.
     *
     * ── WHY `theme` IS BACK, AND WHY THAT IS NOW SAFE ────────────────────────
     *
     * An attempt was made to avoid the hazard entirely by taking `theme` as a soft dependency
     * through `ctx.inject([], cb)`. That does not work, and the side effect was visible on the
     * page: the toolbar showed "主题服务不可用" and no panel appeared, because a context given an
     * EMPTY inject list cannot read the service at all. The probe in
     * `scripts/probe-soft-inject.mjs` records the two semantics that were considered.
     *
     * The deciding evidence is on this machine: the two third-party client plugins that work
     * both declare `theme` as a HARD dependency — `dsh-theme-firefly` uses exactly
     * `inject: ['theme']` — and both also declare the providing module in `dsh.client.inject`.
     * That is the pair that makes it safe, and this package now has both:
     *
     *   package.json  dsh.client.inject = ["@deepseek-ai/dsh-client-locale",
     *                                      "@deepseek-ai/dsh-client-ui-theme"]
     *   here          exports.inject   = ['slots', 'locale', 'theme']
     *
     * The two earlier failures were the `modifies` cycle and the missing module declaration.
     * Both are fixed, and both are asserted in `tests/check-boot-safety.mjs`.
     *
     * `locale` is declared for the same reason: the sidebar row resolves its label through it,
     * and the providing module is declared in the manifest.
     * @type {string[]}
     */
    exports.inject = ['slots', 'locale', 'theme']

    /**
     * Marks this client module as a PLUGIN rather than a plain service module.
     *
     * This flag was missing, and the web-boot log recorded the entry as
     *
     *     dsh-theme-gallery: failed
     *
     * which is distinct from `pending (waiting for service: settingsScope)` — the other half
     * of the same boot hang. `pending` means the loader knew about this entry and was waiting
     * on a dependency it was promised; `failed` is what an entry reports when it is evaluated
     * but never activates, which is the shape a missing plugin flag produces. Every working
     * third-party client plugin on this machine declares it (`dsh-theme-firefly`:
     * `exports.isPlugin = true`). `@deepseek-ai/dsh-client-ui-theme` does not, but it belongs
     * to the official composition and is mounted through a different path, so it is not the
     * pattern to copy here.
     * @type {boolean}
     */
    exports.isPlugin = true

    /**
     * Client plugin body: register the sidebar page and track the reading state.
     *
     * WRAPPED SO A FAILURE HERE CANNOT HANG THE APPLICATION.
     *
     * The desktop shell waits for EVERY plugin's fiber to settle before it leaves the
     * "Loading plugins..." screen. A plugin that throws while mounting does not settle, so a
     * bug in a decoration plug-in becomes a boot hang — with the added cruelty that nothing
     * reaches the crash log, because no exception escapes. That is exactly how a theme skin
     * once stranded a real install.
     *
     * The body is therefore built in stages, and each stage is isolated: whatever fails is
     * reported and skipped, and the remaining stages still run. This plugin is an ENHANCEMENT
     * — a skin — so degrading it must never cost the user their application.
     *
     * @param ctx - the plugin context.
     */
    exports.apply = function apply(ctx) {
      // Nothing below is allowed to escape. A synchronous throw in `apply` is the one
      // failure mode that takes the whole boot down with it.
      try {
        applyGallery(ctx)
      } catch (error) {
        console.error('[theme-gallery] mount failed; the app continues without this plugin:', error)
        reportMountFailure(error)
      }
    }

    /**
     * Record a mount failure where the user can see it.
     *
     * A console nobody opens is not a diagnosis, and this failure mode is invisible by
     * nature — the app simply never finishes loading. The message is written onto the document
     * so it survives the partial mount.
     * @param error - whatever was thrown.
     */
    function reportMountFailure(error) {
      try {
        if (typeof document === 'undefined') return
        const note = document.createElement('div')
        note.dataset.plugin = 'theme-gallery'
        note.dataset.pluginError = 'mount'
        note.setAttribute('style', 'position:fixed;left:0;bottom:0;z-index:2147483647;'
          + 'max-width:60ch;padding:6px 10px;font:12px/1.5 system-ui,sans-serif;'
          + 'background:#7f1d1d;color:#fff;pointer-events:none;white-space:pre-wrap')
        note.textContent = '主题皮肤插件挂载失败，已跳过（不影响使用）：'
          + String(error && error.message ? error.message : error)
        document.body?.append?.(note)
      } catch {
        // Reporting must never be the thing that breaks the boot.
      }
    }

    /**
     * Run a callback on the next frame, or as soon as possible when there is no frame clock.
     *
     * Used to coalesce DOM work: the scenery sync is triggered by a body-wide mutation observer
     * and by resize events, and streaming a reply mutates the transcript many times per frame.
     * Running the sync once per frame keeps its cost proportional to frames rather than to
     * mutations, which is the difference between "some work when the layout changes" and a
     * process that climbs to 11 GB.
     * @param callback - what to run.
     */
    function step(callback) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => callback())
        return
      }
      // A documentless or animation-less environment (a test harness): a timeout still
      // coalesces, it just does not align to a paint.
      setTimeout(callback, 16)
    }

    /**
     * The plugin body proper, run inside `apply`'s guard.
     *
     * The services this needs — `slots`, `locale`, `theme` — are DECLARED in `exports.inject`,
     * which is the same shape the two working third-party client plugins on this machine use
     * (`dsh-theme-firefly` declares `theme` and nothing else). By the time `apply` runs, the
     * framework has resolved all three, so they are used directly.
     *
     * An attempt was made to take `theme` softly instead, to remove every possible boot hazard.
     * It does not work: a context carrying an EMPTY inject list cannot read the service, so the
     * plugin reported "主题服务不可用" and never mounted. The safety that matters is not achieved
     * by weakening this list — it is achieved by the two fixes that actually address the hangs,
     * both asserted in `tests/check-boot-safety.mjs`: no `modifies` against the providing row,
     * and the providing module declared in `dsh.client.inject`.
     * @param ctx - the plugin context, with every declared service resolved.
     */
    function applyGallery(pluginCtx) {
      // Published for the factory-level helpers (`syncAccent`, `themeDiagnostics`). The parameter
      // is deliberately NOT named `ctx`: that would shadow the module-level binding this line
      // needs to assign, and the assignment would silently do nothing.
      ctx = pluginCtx
      mountGallery(pluginCtx)
    }

    /**
     * Show, on the page, that a service this plugin needs never arrived.
     *
     * Kept even though nothing calls it now: a plugin that cannot load should be able to say so
     * where a person will see it, rather than disappearing silently. Silence is exactly how the
     * earlier boot failures stayed invisible for several rounds.
     * @param name - the service name.
     * @param message - what to display.
     */
    function reportMissingService(name, message) {
      console.error(`[theme-gallery] service "${name}" unavailable; skipping the skin`)
      try {
        if (typeof document === 'undefined' || document.body == null) return
        const note = document.createElement('div')
        note.dataset.plugin = 'theme-gallery'
        note.dataset.pluginMissing = name
        note.setAttribute('style', 'position:fixed;left:0;bottom:0;z-index:2147483647;'
          + 'max-width:60ch;padding:6px 10px;font:12px/1.5 system-ui,sans-serif;'
          + 'background:#78350f;color:#fff;pointer-events:none;white-space:pre-wrap')
        note.textContent = message
        document.body.append(note)
      } catch {
        // Reporting must never be what breaks the boot.
      }
    }

    /**
     * The gallery itself.
     *
     * Every service it needs — `slots`, `locale`, `theme` — was declared in `exports.inject`, so
     * the framework resolved them before `apply` ran and they are used directly here.
     * @param ctx - the plugin context.
     */
    function mountGallery(ctx) {
      // Dictionaries first: the page's `locale` seat needs them installed.
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'theme-gallery: dictionaries')

      // The page stylesheet, owned for this plugin's lifetime.
      ctx.effect(() => {
        if (typeof document === 'undefined') return
        const tag = document.createElement('style')
        tag.dataset.plugin = 'theme-gallery'
        tag.dataset.pluginCss = 'theme-gallery/page'
        tag.textContent = PAGE_CSS
        document.head.append(tag)
        return () => { tag.remove() }
      }, 'theme-gallery: page stylesheet')

      /* ---------------- gallery page ---------------- */

      const storeHandle = createGalleryStore()
      /**
       * The one live store instance, shared by the publisher and the page.
       *
       * `handle.create()` returns a NEW instance on every call — verified by
       * `tests/check-store-contract.mjs` — so the render machinery's instance and
       * the one this code writes through would otherwise be different objects and
       * every publish would land in a throwaway. That is exactly why the shipped
       * panel plugins pin theirs: `{ ...handle, create: () => instance }`.
       */
      const storeInstance = storeHandle.create()
      const store = { ...storeHandle, create: () => storeInstance }
      /**
       * The shared instance's write surface.
       *
       * Publishing goes through THIS, not through the registration's `inject`
       * factory. `inject` supplies the component's business face, and the page
       * does not need one — it reads the store seat directly — so a page could
       * render perfectly while `inject` never ran, leaving every publish written
       * into `undefined` and the banner silent. Writing to the pinned instance
       * removes that whole class of silent failure.
       */
      const storeActions = storeInstance.actions

      let revision = -1
      /** Whether the `main` slot gate has fired — i.e. the page really registered. */
      let gateRan = false
      /** Whether the registration's inject factory has run (diagnostics only). */
      let injectRan = false

      /**
       * Reflect the ACTIVE theme's scenery and accent.
       *
       * Called from `publish()`, so it tracks whatever the theme service reports as
       * active — including themes selected through the official Appearance row, not
       * just through this plugin's picker.
       *
       * Both effects are driven by the same lookup, and both must be **withdrawn**
       * when the active theme is not one this package contributed: the scenery
       * belongs to the skin rather than to the app, and an accent layer would
       * otherwise colour some other theme's selection states. Active themes that
       * this package does not know resolve to `undefined`, which is what withdraws
       * both.
       * @param snapshot - the official theme snapshot.
       */
      function syncSkin(snapshot) {
        const activeId = snapshot?.active?.id
        const theme = typeof activeId === 'string' ? bundledTheme(activeId) : undefined

        // ── THE PALETTE LAYER IS DRIVEN BY WHAT THE USER CHOSE, NOT BY WHAT IS ACTIVE ──
        //
        // Everything below follows `snapshot.active` — the theme the SERVICE currently reports.
        // That is right for the artwork and the accent marker, which belong to whichever skin is
        // active. It is NOT right for the palette: the shell reverts the active theme to a
        // built-in id whenever it adopts the persisted preference (`ui-theme`'s `adopt()`), so
        // following `active` would tear the skin's colours down moments after they appear —
        // exactly the "colours show, then vanish" that was reported.
        //
        // The layer therefore follows the REMEMBERED skin instead. It is withdrawn only when the
        // user has genuinely moved to a theme this package does not provide.
        try {
          stackSkinTokens(theme === undefined ? undefined : (rememberedSkin() ?? activeId))
        } catch (error) {
          console.error('[theme-gallery] could not stack the skin palette:', error)
        }

        try {
          syncAmbient(theme?.ambient?.kind, theme?.ambient)
        } catch (error) {
          console.error('[theme-gallery] could not render sidebar scenery:', error)
        }
        try {
          syncAccent(theme?.accent)
        } catch (error) {
          console.error('[theme-gallery] could not stack the accent layer:', error)
        }
      }

      /**
       * Remember the user's skin, and put it back after a restart.
       *
       * The composition layer does carry `ui-theme.config.preference`, but it is read while
       * the boot graph is still assembling — before this plugin has registered its themes —
       * so a preference naming one of our skins does not survive that moment. Every restart
       * therefore came up on the built-in white theme and the skin had to be picked by hand.
       *
       * The choice is kept where this plugin can reach it early instead: written whenever a
       * bundled skin becomes active, and re-applied once the registry holds that id again.
       *
       * ── THIS IS ALSO THE FALLBACK, AND IT IS WHY THE FALLBACK CANNOT FAIL ──────
       *
       * The skin id is deliberately NOT persisted through the preference at all. The official
       * service only stores built-in values —
       *
       *     if (isThemePreference(id)) this.host.set(THEME_PREFERENCE_FIELD, id)
       *     const THEME_PREFERENCES = ['light', 'dark', 'system']
       *
       * — so `preference` in the profile can only ever hold a built-in id. If this plugin is
       * disabled, uninstalled or simply fails to mount, the next boot reads a built-in
       * preference and starts normally on the built-in theme. The skin selection survives in
       * `localStorage`, which is private to this plugin and simply stops being consulted.
       *
       * That is the automatic fallback the user asked for, and it is stronger than anything
       * this plugin could do at runtime: a plugin that is not loaded cannot run a recovery
       * handler, so the safety has to live in the CONFIGURATION CONTRACT rather than in code.
       * The one way to break it is to hand-write a skin id into `preference` — which the
       * official service would then reject at boot. Never do that.
       *
       * The keys themselves live at MODULE scope ({@link SKIN_KEY} / {@link BUILT_IN_KEY}):
       * the card-click handler runs in the page component, far from this body, and it must
       * be able to write them before the click reaches the theme service.
       */

      /**
       * The token used to prove a skin's palette reached the document.
       *
       * `ui-layout`'s presenter writes every token with `body.style.setProperty`, so this can be
       * read straight back as an inline declaration. `--dsw-alias-bg-base` is chosen because every
       * bundled skin gives it a `linear-gradient(...)` literal while the built-in themes give it a
       * `var(...)` reference — two forms that cannot be mistaken for one another.
       */
      const PROBE_TOKEN = '--dsw-alias-bg-base'

      /**
       * A built-in theme to bounce through when the presenter missed a change.
       *
       * `setTheme` short-circuits when the id is already active, so re-applying the same skin
       * emits nothing. Switching to a built-in value and back produces the two real changes that
       * force a repaint — the same thing the user was doing by hand.
       */
      const BUILT_IN_PROBE_THEME = 'light'

      /** @returns the remembered skin id, or null. */
      function rememberedSkin() {
        try {
          const value = window.localStorage.getItem(SKIN_KEY)
          return typeof value === 'string' && value !== '' && bundledTheme(value) !== undefined
            ? value
            : null
        } catch {
          return null
        }
      }

      /**
       * Record that a skin is the active theme — the restart-time memory.
       *
       * Written only once the service actually reports the skin, so the key never names a
       * skin that was merely requested and then lost. Clearing the built-in marker in the
       * same breath keeps the two keys from disagreeing about what the user last chose.
       * @param id - the active skin id.
       */
      function rememberActiveSkin(id) {
        try {
          if (window.localStorage.getItem(SKIN_KEY) !== id) window.localStorage.setItem(SKIN_KEY, id)
          if (window.localStorage.getItem(BUILT_IN_KEY) !== null) window.localStorage.removeItem(BUILT_IN_KEY)
        } catch (error) {
          console.error('[theme-gallery] could not remember the active skin:', error)
        }
      }

      /**
       * The skin this plugin should be showing, or null when the user is entitled to a
       * built-in appearance.
       *
       * Three-way precedence, and all three arms are load-bearing:
       *
       *  1. a skin the user chose — restore it, across restarts (the original feature);
       *  2. a built-in the user chose IN THIS PANEL — null, so the restore does not fight it;
       *  3. nothing chosen yet — the gallery's own default ({@link DEFAULT_SKIN}), which is
       *     what makes a fresh install land on 山青婷彩 instead of the built-in white.
       *
       * Arm 2 is why the built-in cards work at all: without it, arm 1 keeps winning and the
       * click is undone a moment later.
       * @returns the skin id, or null.
       */
      function wantedSkin() {
        const remembered = rememberedSkin()
        if (remembered !== null) return remembered
        if (builtInChoice() !== null) return null
        return DEFAULT_SKIN
      }

      /** The skin whose palette layer is currently stacked, and how to remove it. */
      let stackedSkin
      let stackedSkinDispose




      /** Set once a rate limit or the kill switch has stopped the restore. */

      /**
       * Stack a skin's palette as an OVERRIDE LAYER, which the shell cannot undo.
       *
       * ── WHY SETTING THE THEME IS NOT ENOUGH ─────────────────────────────────
       *
       * `setTheme(id)` writes `this.preference` in memory, and that is all. The official service
       * ALSO adopts a persisted preference whenever the settings document changes:
       *
       *     adopt() {
       *       const section = this.host.getSnapshot().value
       *       if (this.preference === section.preference && …) return
       *       this.preference = section.preference     // ← overwrites what we just set
       *       this.publish()
       *     }
       *
       * The persisted value can only ever be a BUILT-IN id (`light`/`dark`/`system`) — the service
       * stores no others — so that adoption always reverts the skin. On screen the colours appear
       * and then vanish a moment later, and clicking the skin once is not enough because the same
       * adoption can land straight after; only switching away and back produces changes late
       * enough to survive.
       *
       * An override layer does not have that problem. `overrideTokens` keeps layers in their own
       * map, keyed by source, and `buildSnapshot` composes them OVER whatever theme is active —
       * `adopt()` never touches them. The layer is owned by this plugin's fiber, so it also
       * disappears cleanly when the plugin unloads.
       *
       * Re-stacking is guarded by `stackedSkin`: `overrideTokens` emits `theme/change` itself, so
       * registering unconditionally would drive `publish` from inside `publish`.
       * @param id - the skin id, or undefined to withdraw the layer.
       */
      function stackSkinTokens(id) {
        if (!ambientEnabled()) return
        if (id === stackedSkin) return
        try {
          // The whole body runs under the self-emit guard.
          //
          // Both `stackedSkinDispose()` and `overrideTokens()` emit `theme/change`, and the
          // subscription that consumes that event would otherwise re-enter `syncSkin` →
          // `stackSkinTokens` at a moment when `stackedSkin` is deliberately undefined (it is
          // cleared below to release the previous layer). That re-entry used to stack another
          // layer, which emitted again — the spin that took the renderer to 11 GB.
          emitting(() => {
            if (stackedSkinDispose !== undefined) {
              stackedSkinDispose()
              stackedSkinDispose = undefined
            }
            stackedSkin = undefined
            if (typeof id !== 'string') return
            const definition = bundledTheme(id)
            if (definition === undefined) return
            const tokens = {}
            for (const [name, value] of Object.entries(flatten(definition).tokens)) {
              // The override format is a `{ light, dark }` pair. These palettes are a single
              // scheme by design, so both arms carry the same value rather than leaving one
              // undefined — an absent arm would render as a bare `undefined` inside the variable.
              tokens[name] = { light: value, dark: value }
            }
            stackedSkinDispose = ctx.theme.overrideTokens('theme-gallery: palette', tokens)
            // Handed to the plugin's fiber as well, so the layer is withdrawn even on the paths
            // that do not go through `stackSkinTokens` again (plugin unload).
            ctx.effect(() => stackedSkinDispose, 'theme-gallery: palette layer')
            stackedSkin = id
            noteAmbientEvent('叠加皮肤令牌层', id)
          })
        } catch (error) {
          noteAmbientEvent('令牌层抛错', String(error && error.message ? error.message : error))
          console.error('[theme-gallery] could not stack the skin palette layer:', error)
        }
      }

      /**
       * Whether the shell has finished assembling, so a theme change will actually be painted.
       *
       * Set by the scenery effect once it has found a laid-out sidebar column — the same
       * readiness signal the artwork uses, and the earliest point at which the document is known
       * to have a real layout.
       *
       * Declared BEFORE `syncRememberedSkin` because `publish()` can run while this body is still
       * executing, and reading a `let` in its temporal dead zone would throw — producing a
       * misleading "could not restore" error on the very first publish.
       */
      let bootSettled = false

      /**
       * Called by the scenery effect when the shell is ready.
       *
       * Re-reads the snapshot so the remembered skin gets a chance to be applied now that a
       * theme change is more likely to be observed.
       */
      function markBootSettled() {
        if (bootSettled) return
        bootSettled = true
        noteAmbientEvent('外壳就绪')
        try {
          syncRememberedSkin(ctx.theme.getTheme())
        } catch (error) {
          noteAmbientEvent('就绪复核抛错', String(error && error.message ? error.message : error))
          console.error('[theme-gallery] could not re-check the remembered skin:', error)
        }
      }

      /**
       * Whether the document is actually showing the given skin's palette.
       *
       * ── WHY THIS DETECTOR IS NECESSARY ───────────────────────────────────────
       *
       * `ui-layout`'s presenter does this on mount:
       *
       *     const presenter = new ThemePresenter()
       *     presenter.apply(ctx.theme.getTheme())      // applies whatever is active NOW
       *     const off = ctx.on('theme/change', ...)    // and only then starts listening
       *
       * So it paints the theme that is active at mount time, and any `setTheme` call made before
       * that subscription is observed by nobody. The service still records the skin as active —
       * which is why the scenery switches but the colours do not — and because `setTheme`
       * short-circuits on `preference === id`, clicking the same skin afterwards emits NOTHING.
       * Only switching to another skin and back produces the two genuine changes that repaint.
       *
       * The presenter writes each token with `body.style.setProperty(name, value)`, so the tokens
       * are readable back as INLINE styles. That makes the effect verifiable instead of assumed:
       * an inline declaration carrying the skin's own value means the presenter has run for this
       * skin, and a missing one means the change was missed and must be retried.
       *
       * `--dsw-alias-bg-base` is the probe token because the skin gives it a gradient literal
       * while the built-in light theme gives it `var(--dsw-static-neutral-bluish-00)` — the two
       * forms cannot be confused.
       * @param id - the skin id to look for.
       * @returns whether the skin's palette is on the document.
       */
      function skinIsPainted(id) {
        try {
          if (typeof document === 'undefined' || document.body == null) return false
          const definition = bundledTheme(id)
          if (definition === undefined) return false
          const expected = flatten(definition).tokens[PROBE_TOKEN]
          if (typeof expected !== 'string' || expected === '') return false
          const actual = document.body.style.getPropertyValue(PROBE_TOKEN)
          return actual.trim() === expected.trim()
        } catch {
          return false
        }
      }

      /**
       * How many times a bounce has been spent on a given skin.
       *
       * Declared BEFORE `ensureSkinPainted`, which reads it. This body runs top to bottom during
       * mount, so a `const` read above its own declaration throws a ReferenceError — and because
       * every caller here sits inside a `try`, that error is swallowed and the feature silently
       * does nothing. That is exactly what happened: the declaration sat below its reader, the
       * first `markBootSettled()` threw, `bootSettled` never became true, and the skin colours
       * were never applied.
       *
       * A bounce means switching to a built-in theme and straight back, which forces the
       * presenter to repaint — but it is two real repaints, so it is rationed to ONE per skin and
       * only used once the document has demonstrably failed to follow the service.
       */
      const paintAttempts = new Map()

      /**
       * 观察到"服务已报告、文档未落色"的**时刻**（配合 {@link PAINT_GRACE_MS} 使用）。
       * @type {{id: string, at: number}|undefined}
       */
      let paintSeen

      /**
       * 判"这次切换丢了"之前要等多久（毫秒）。
       *
       * 表现层是异步写 token 的，所以 `setTheme` 之后**一段时间内**文档一定还是旧色 ——
       * 那不是"错过"，只是"还没轮到表现层"。原先没有这个等待，于是**每点一次配色卡都先跳转
       * 一次浅色**（用户报的"第一次点击不生效、反而变成浅色主题，再点一次才行"）。
       *
       * 为什么不能只按"经过了一次 publish"来判：外壳的 `theme/change` 常常是**延迟送达**的，
       * 同一次点击里会再来一次 publish（实测读数：一次点击的 `setTheme` 序列是
       * `…, 'shi-liu-jin', 'light', 'shi-liu-jin'`，中间那对就是跳转）。所以要**按时间**等。
       * 400ms 足以覆盖表现层的一到两帧，又远小于人再点一次的反应时间。
       */
      const PAINT_GRACE_MS = 400
      /**
       * Apply the remembered skin, and confirm it landed.
       *
       * Called on every publish while the app sits on a built-in theme, and also when the service
       * already reports a skin — the second case is the one that used to be unreachable, because
       * the id looked correct while the document had never been repainted.
       *
       * The retry is BOUNDED and cooled down. `publish()` fires often, and each attempt that has
       * to bounce through another theme causes two real repaints, so an unbounded retry would
       * flicker the whole interface while the presenter is still unavailable. A handful of spaced
       * attempts is enough to cover the mount window; after that the plugin stays quiet rather
       * than fighting the shell.
       * @param wanted - the skin id to put in effect.
       * @param activeId - what the service currently reports as active.
       */
      function ensureSkinPainted(wanted, activeId) {
        if (!ambientEnabled()) return
        if (restoreDisabledReason !== undefined) return
        if (!bootSettled) {
          // The gate that silently refused to act. It is the likeliest explanation for "the
          // colours never appear until something else happens", and it used to leave no trace.
          noteAmbientEvent('等待外壳', wanted)
          return
        }
        if (skinIsPainted(wanted)) {
          paintAttempts.clear()
          paintSeen = undefined
          noteAmbientEvent('已上色', wanted)
          return
        }

        // ── THE BOUNCE IS THE LAST RESORT, NOT THE FIRST MOVE ──────────────────
        //
        // The presenter writes tokens asynchronously: for a frame or two after a real theme
        // change the document still shows the old palette. Treating that window as "missed" made
        // this code bounce `built-in → skin` repeatedly, and every bounce is two genuine repaints
        // — which is what showed on screen as the interface flashing between coloured and plain.
        //
        // So a bounce happens only after the skin has failed to appear across a PAUSE, and only
        // once per skin. Telling the service first is always safe: when the id is already active
        // it is a documented no-op.
        if (wanted !== activeId) {
          // Budgeted and cooled down. This branch used to call `setTheme` unconditionally on every
          // publish, with no throttle at all, so the shell putting the active id back to a
          // built-in value made it a perpetual request ↔ publish ping-pong.
          paintSeen = undefined
          if (requestTheme(wanted)) noteAmbientEvent('置为皮肤', wanted)
          // Give the presenter a chance to land before judging it.
          return
        }

        // ── 先给它一段**时间**的耐心（代码上方那句"要跨过一次 PAUSE 才跳转"原本并没实现）──
        //
        // 直接 `setTheme` 之后的那几帧里，文档一定还没落色 —— 那不是"错过"，只是"还没轮到
        // 表现层"。在这里就跳转的代价是：**每点一次配色卡都先闪一次浅色**，而且跳转里那两次
        // 写入会和外壳的偏好处理打架（用户报的"第一次点击不生效、反而变成浅色"）。
        // 第一次只记时刻，过了 {@link PAINT_GRACE_MS} 仍未落色，才说明真的错过了。
        const now = Date.now()
        if (paintSeen === undefined || paintSeen.id !== wanted) {
          paintSeen = { id: wanted, at: now }
          noteAmbientEvent('等待上色', wanted)
          return
        }
        if (now - paintSeen.at < PAINT_GRACE_MS) {
          noteAmbientEvent('等待上色', wanted)
          return
        }

        // The service ALREADY reports this skin, yet the document does not show it: the change
        // was missed by a presenter that had not subscribed yet. Only now is a bounce justified.
        const bounced = paintAttempts.get(wanted) ?? 0
        if (bounced >= 1) {
          noteAmbientEvent('跳转已用尽', wanted)
          return
        }
        paintAttempts.set(wanted, bounced + 1)
        noteAmbientEvent('未上色·跳转一次', wanted)
        try {
          // Two writes, both under the global budget, and both marked as self-caused so the
          // subscription ignores the `theme/change` they produce.
          emitting(() => ctx.theme.setTheme(BUILT_IN_PROBE_THEME))
          emitting(() => ctx.theme.setTheme(wanted))
        } catch (error) {
          noteAmbientEvent('跳转抛错', String(error && error.message ? error.message : error))
          console.error('[theme-gallery] could not re-apply the remembered skin:', error)
        }
      }


      /**
       * Record the active skin, or restore the remembered one.
       *
       * ── TIMING IS THE WHOLE POINT HERE ───────────────────────────────────────
       *
       * The restore must not be a one-shot hope. `ctx.theme.setTheme(id)` updates the registry
       * and emits `theme/change`; the tokens reach the document only if the layout package's
       * presenter is already subscribed. When this plugin restored during mount, the call landed
       * before that subscription existed: the service recorded the skin as active while nothing
       * repainted — and because the service now believes the skin IS active, clicking it again
       * emits nothing at all. That is why the user had to switch to a different skin and back.
       *
       * Two things make the restore dependable:
       *
       *  1. it waits for the shell (`bootSettled`), so a change is far more likely to be seen;
       *  2. it CONFIRMS the effect by reading the tokens back off the document
       *     (`skinIsPainted`), and re-applies while the confirmation is missing — so a change
       *     that was missed is retried on the next publish instead of being lost for the session.
       *
       * When the service already reports the skin as active but the document disagrees, the plain
       * `setTheme` call is a documented no-op, so the retry bounces through a built-in theme and
       * back. That is exactly the manual toggle the user had to perform.
       * @param snapshot - the official theme snapshot.
       */
      function syncRememberedSkin(snapshot) {
        try {
          const activeId = snapshot?.active?.id
          // A contributed skin is active: remember it for the next boot, and make sure the document
          // is genuinely painted with it. The id alone is not proof — a change that arrived before
          // the presenter subscribed leaves the service reporting the skin while the page still
          // shows the built-in palette.
          if (typeof activeId === 'string' && bundledTheme(activeId) !== undefined) {
            rememberActiveSkin(activeId)
            ensureSkinPainted(activeId, activeId)
            return
          }

          // The app is on a built-in theme even though one of our skins is wanted: either the
          // boot race lost the preference, or nothing has been chosen yet and the gallery's
          // default has still to be applied. Re-checked on every publish rather than once per
          // session, because a single attempt can be swallowed by a presenter that is not
          // listening yet.
          //
          // `wantedSkin()` returns null when the user deliberately picked a built-in card, and
          // that null is the whole fix for "点深色又被弹回皮肤" — see its documentation.
          const wanted = wantedSkin()
          if (wanted === null) return
          ensureSkinPainted(wanted, activeId)
        } catch (error) {
          console.error('[theme-gallery] could not restore the remembered skin:', error)
        }
      }


      /* ---------------- scenery stylesheet ----------------
       *
       * Installed before anything can create the seat, and installed defensively:
       * the sheet must be in the document before `#dsh-theme-ambient` exists, because
       * an UNSTYLED seat is not merely invisible — being a plain block, it joins the
       * sidebar's layout and spills over the main column, covering conversation text.
       * That happened for real, and it is why `syncAmbient` refuses to create a seat
       * while this sheet is absent.
       *
       * `head` can be missing if this runs before the parser has produced one, so the
       * fallback appends to the document element rather than dropping the sheet.
       *
       * Installation happens here for the earliest possible mount, but the sheet is
       * also re-checked and re-added by `ensureAmbientStylesheet()` on every sync —
       * this effect is the first attempt, not the only one.
       */
      ctx.effect(() => {
        if (typeof document === 'undefined') return
        const tag = ensureAmbientStylesheet()
        return () => {
          // Unloading is the one legitimate reason for the sheet to disappear, so the
          // cleanup removes it and the seat together.
          if (tag !== null) tag.remove()
          const column = sidebarColumn()
          if (column !== null) {
            const seat = column.querySelector(':scope > #dsh-theme-ambient')
            if (seat !== null) seat.remove()
          }
        }
      }, 'theme-gallery: sidebar scenery stylesheet')

      /* ---------------- contribute themes, unconditionally ----------------
       *
       * Deliberately NOT inside the `main` gate. Contribution needs nothing but
       * the theme service — guaranteed present because `theme` is in `inject` —
       * and putting it behind the gate made the symptom ambiguous: when the panel
       * page came up empty there was no way to tell "the gate never ran" from "the
       * page never rendered".
       *
       * The call itself is placed AFTER `contribute` is defined, not here:
       * `ctx.effect` runs its callback synchronously, so an earlier call would hit
       * the temporal dead zone on the `contributed` set that `contribute` closes
       * over. That failure surfaced on the page as "Cannot access 'contributed'
       * before initialization".
       */

      /**
       * Push the current registry into the page's store.
       *
       * Writes straight to the pinned instance, so it does not care whether the
       * registration's `inject` factory has run.
       *
       * Also records a status line when there is nothing to show, because an
       * empty picker is otherwise indistinguishable from a broken one and the
       * boot screen only ever says "failed". The line names which link is
       * missing: the slot gate, the contribution call, or the registry itself.
       * @param snapshot - the official theme snapshot.
       */
      function publish(snapshot) {
        revision += 1
        // DISPLAY ORDER IS APPLIED HERE, TO THE PAGE'S COPY ONLY.
        //
        // The registry keeps the order things were registered in, so re-ranking a card can
        // never change which themes exist, what they contain, or the order they were
        // contributed — `cardsInDisplayOrder` is a view over the filtered list.
        // 宠物挂件卡不是主题、不在注册表里：作为一张**只存在于面板**的卡片数据追加进来，
        // 与其他卡走同一条排序管线（见 `petWidgetCardTheme`）。
        const themes = cardsInDisplayOrder([...snapshot.themes].filter((theme) => !OMITTED_IDS.has(theme.id))
          .concat([petWidgetCardTheme(), moodCardTheme()]))
        storeActions.sync(themes, appliedCardId(snapshot), revision)
        // 卡片上点亮哪一格，以及要不要把那一层配色叠上去 —— 两件事都读同一份
        // localStorage，所以"看到的选中态"与"屏幕上的颜色"不可能对不上。
        storeActions.markScheme(wantedScheme())
        // 挂件卡的徽标读同一个来源：localStorage 里记着的开关状态。
        storeActions.markPet(petWidgetOn())
        // 头像选择行的点亮态与卡面图案也读同一个来源：当前是哪只宠物。
        storeActions.markPetKind(readPetState().kind)
        // 心情问候卡的胶囊开关与三组 chips 读同一个来源。
        storeActions.markMood(readMoodState())
        // 问候条是幂等同步：状态/几何/文本没变就一个字节都不写（moodBuildBar 指纹守卫），
        // 所以 publish 顺路调用它没有性能负担，还负责把"座位晚渲染"捡起来。
        syncMoodBar()
        syncSkin(snapshot)
        syncRememberedSkin(snapshot)
        syncScheme(snapshot)
        // Expose what the theme SERVICE believes, so the page can compare it with
        // what is actually in effect on the document. The presenter consumes this
        // same snapshot (`snapshot.active.tokens`) and writes it to `body`, so a
        // mismatch between the two points at the presenter, and agreement points
        // at the colours themselves having no visible effect.
        const active = snapshot.active ?? {}
        window.__DSH_THEME_DEBUG__ = {
          activeId: active.id ?? '?',
          activeTokens: active.tokens === undefined ? '?' : Object.keys(active.tokens).length,
          themeIds: snapshot.themes.map((theme) => theme.id).join(','),
        }
        if (themes.length === 0) {
          storeActions.note(
            !gateRan
              ? 'main 插槽的 gate 尚未触发（页面外壳还没声明该插槽）'
              : !injectRan
                ? '页面已注册但尚未渲染；主题注册表为空'
                : '主题注册表为空：贡献调用已执行但没有皮肤进入注册表',
          )
        }
      }

      /**
       * 用户点了配色卡上的一个色值按钮（或卡片本体 = 用它记住的那一套，没有就是默认那套）。
       *
       * ── 为什么必须显式切主题（第一版漏了这一步，用户实机报"点了没反应"）──────────
       *
       * 第一版只做了 `rememberScheme` + `rememberCardChoice(锚主题)` + `publish()`，以为
       * `syncRememberedSkin` 会把锚主题切过去。**它不会**：
       *
       *   • `rememberCardChoice` 只**清掉**"内置外观"标记，它从不写 `last-skin`；
       *   • 于是 `wantedSkin()` 仍指向原来那套皮肤，而 `syncRememberedSkin` 见到活动主题
       *     是本包皮肤就走"记住它"那条分支 —— 活动主题被原样记回去并继续维持；
       *   • `syncScheme` 的判据是 `active.id === PALETTE_ANCHOR`，不成立 → 配色层永不叠加。
       *
       * 面板上的普通皮肤卡之所以能切，是因为它把 `setTheme` 交给了外壳（槽位动作那条例外）。
       *
       * ── 为什么这里用 `emitting(...)` 而不是再加一条审计例外 ─────────────────────
       *
       * 这次 `theme/change` 确实是"用户换了主题"的信号，但它**不需要**靠事件传递：本函数
       * 紧接着自己调一次 `publish()`，那一次的快照里活动主题已经是锚主题。把它标成"我造成的"，
       * 订阅者就跳过这次回声，正好避免一次点击触发两轮同步（规则 1）。
       * @param schemeId - 配色方案 id（`p-…`）。
       */
      function chooseScheme(schemeId) {
        // 不认识的 id 直接丢：写进 localStorage 会让下次启动带着一个永远点不亮的选中态。
        if (schemeById(schemeId, PALETTE_SCHEMES) === undefined) return
        try {
          rememberScheme(schemeId)
          rememberCardChoice(PALETTE_ANCHOR)
          // 锚主题不是活动主题时必须真的切过去，否则上面那条链一步都不会发生。判据取活动主题，
          // 所以"已经在锚主题上再点另一格"不会白写一次 setTheme（同一个 id 的 setTheme
          // 是**不会 emit 的**，见 SKILL §12）。
          const activeId = ctx.theme.getTheme()?.active?.id
          if (activeId !== PALETTE_ANCHOR) {
            emitting(() => ctx.theme.setTheme(PALETTE_ANCHOR))
          }
          publish(ctx.theme.getTheme())
        } catch (error) {
          console.error('[theme-gallery] could not switch the palette scheme:', error)
        }
      }

      /**
       * 用户点了挂件卡（或卡上的开关动作）：翻转开关、同步舞台、刷新面板。
       *
       * 这条路**完全不碰主题服务** —— 挂件与当前是什么皮肤正交，所以它能与任何皮肤
       * （包括山青婷彩 / 梦海游鱼）同时开启，也不消耗主题写入预算。
       * `publish()` 会把新状态经 `markPet` 报给页面，徽标与 aria-pressed 随之更新。
       */
      function togglePetWidget() {
        try {
          const next = !petWidgetOn()
          savePetState({ on: next })
          petRun.enabled = next
          syncPetStage()
          publish(ctx.theme.getTheme())
        } catch (error) {
          console.error('[theme-gallery] could not toggle the pet widget:', error)
        }
      }

      /**
       * 用户点了心情问候卡（或卡上的胶囊开关）：翻转开关、同步问候条、刷新面板。
       *
       * 与 `togglePetWidget` 同一条路：**完全不碰主题服务** —— 问候与当前是什么皮肤
       * 正交；`publish()` 会把新状态经 `markMood` 报给页面，徽标与 aria-checked 随之更新。
       */
      function toggleMoodWidget() {
        try {
          const next = !readMoodState().on
          saveMoodState({ on: next })
          syncMoodBar()
          publish(ctx.theme.getTheme())
        } catch (error) {
          console.error('[theme-gallery] could not toggle the mood greeting:', error)
        }
      }

      /**
       * 用户点了问候卡上的一枚设置 chip（速度/方向/区域）。
       * 只认表里真实存在的值（MOOD_SPEEDS / ltr-rtl / MOOD_ZONE_GEOMETRY），
       * 不认识的静默丢 —— 与 chooseScheme 拒绝不认识方案 id 同一条规矩：
       * 写进 localStorage 会让下次启动带着一个点不亮的选中态。
       * @param patch - `{ speed? , direction?, zone? }` 的部分字段。
       */
      function setMoodSettings(patch) {
        try {
          const clean = {}
          if (patch !== null && typeof patch === 'object') {
            if (typeof patch.speed === 'string' && patch.speed in MOOD_SPEEDS) clean.speed = patch.speed
            if (patch.direction === 'ltr' || patch.direction === 'rtl') clean.direction = patch.direction
            if (typeof patch.zone === 'string' && patch.zone in MOOD_ZONE_GEOMETRY) clean.zone = patch.zone
          }
          if (Object.keys(clean).length === 0) return
          saveMoodState(clean)
          syncMoodBar()
          publish(ctx.theme.getTheme())
        } catch (error) {
          console.error('[theme-gallery] could not set the mood settings:', error)
        }
      }

      /**
       * 用户点了挂件卡上的一颗头像：换成那只宠物并放它出场。
       *
       * 语义（需求 R2）：挂件关着时点头像 = 顺路**打开**（"点哪只出哪只"，即时反馈）；
       * 开着时 = 只换宠物。`placed` 一并复位 —— 不同宠物尺寸不同，继承上一只的
       * 视口偏移会错位，切宠即按新宠物的缺省摆位重新入座、跑向自己的道具。
       * 这条路与 `togglePetWidget` 一样**完全不碰主题服务**。
       * @param kindId - 宠物 id（不认识的静默拒绝，照 chooseScheme 的规矩）。
       */
      function selectPetWidget(kindId) {
        try {
          if (!PET_KIND_BY_ID.has(kindId)) return
          const turningOn = !petWidgetOn()
          const patch = { kind: kindId, placed: false }
          if (turningOn) patch.on = true
          savePetState(patch)
          petRun.enabled = true
          removePetStage()
          petNoteInteraction()
          syncPetStage()
          publish(ctx.theme.getTheme())
        } catch (error) {
          console.error('[theme-gallery] could not select the pet:', error)
        }
      }

      /**
       * 卡片上「已应用」徽标应该落在哪一张卡上。
       *
       * ── 为什么不直接用 `snapshot.preference`（用户实机报的 bug）────────────────
       *
       * 点一个色值按钮时，徽标在「浅色」与「纯色/拼色」之间来回跳。根因是
       * {@link ensureSkinPainted} 的**跳转重试**：当服务已经报告皮肤、而文档还没落色时，
       * 它会先切到内置主题再切回皮肤（`emitting(() => ctx.theme.setTheme(BUILT_IN_PROBE_THEME))`），
       * 每次都是一次真实的 preference 变化 → 一次 publish → 徽标跟着那个**中间态**跳一下。
       *
       * 徽标要回答的是"用户选的是哪一张卡"，不是"服务此刻停在哪一帧"。中间态有两个特征可以
       * 一票排除：它等于 {@link BUILT_IN_PROBE_THEME}，而且用户**没有**在面板里选过任何内置外观
       * （`builtInChoice()` 为空）。两条同时成立时，按"想要的那套皮肤"显示 —— 跳转只是为了
       * 让表现层重新落色，不是一次选择。
       *
       * 其余情况一律照服务当下的活动主题显示（用户点深色就走深色、外部改外观也跟着走），
       * 所以这不是"徽标只认 localStorage"，而是"只把中间态排除掉"。
       * @param snapshot - 官方主题快照。
       * @returns 应该带徽标的卡片 id。
       */
      function appliedCardId(snapshot) {
        const active = snapshot === undefined || snapshot === null ? {} : (snapshot.active ?? {})
        const wanted = wantedSkin()
        if (wanted !== null && active.id === BUILT_IN_PROBE_THEME && builtInChoice() === null) return wanted
        return active.id ?? snapshot?.preference
      }

      /**
       * Resolve a bundled theme into the shape `register` actually consumes.
       *
       * `register()` stores the definition BY REFERENCE and `composeActive()`
       * passes it through untouched when no override layer exists — so the
       * `{ light, dark }` pair format belongs to `overrideTokens` layers, NOT
       * here. `ThemeDefinition.tokens` is `Record<string, string>`, one value for
       * the theme's own `colorScheme`. Feeding pairs to `register` writes
       * literally `[object Object]` into the CSS variables, which paints nothing
       * and reads on the page as a theme with no colours at all.
       * @param definition - the bundled theme.
       * @returns the registrable definition.
       */
      function flatten(definition) {
        const tokens = {}
        for (const name of Object.keys(definition.tokens ?? {})) {
          // Delegated so the pair rule has exactly ONE implementation — the accent diagnostic reads
          // a single token through the same helper, and two copies of this rule would drift.
          tokens[name] = declaredToken(definition, name)
        }
        return { ...definition, tokens }
      }

      /**
       * Put this package's themes into the registry, once each.
       *
       * `ctx.theme.register` THROWS on a duplicate id, and this runs again on
       * every `theme/change` — including the change its own first registration
       * causes. A local set of ids this plugin has already offered is what makes
       * it idempotent without depending on the snapshot being fresh one
       * microtask later, which is not guaranteed.
       *
       * Disposers land on the plugin fiber through `ctx.effect`, so unloading
       * withdraws this package's themes.
       * @param snapshot - the official theme snapshot.
       */
      const contributed = new Set()
      function contribute(snapshot) {
        const known = new Set(snapshot.themes.map((theme) => theme.id))
        for (const definition of BUNDLED_THEMES) {
          if (contributed.has(definition.id)) continue
          contributed.add(definition.id)
          // Another provider already registers this id: leave it to them.
          if (known.has(definition.id)) continue
          ctx.effect(
            () => ctx.theme.register(flatten(definition)),
            `theme-gallery: theme ${definition.id}`,
          )
        }
      }

      // Placed after both declarations above, because `ctx.effect` calls its
      // callback synchronously.
      ctx.effect(() => {
        try {
          contribute(ctx.theme.getTheme())
        } catch (error) {
          console.error('[theme-gallery] could not contribute themes:', error)
          try { storeActions.note(`主题注册失败：${String(error && error.message ? error.message : error)}`) } catch { /* store unavailable */ }
        }
      }, 'theme-gallery: theme contribution')

      /* ---------------- scenery follows the sidebar ----------------
       *
       * `publish()` can run before the shell has mounted the sidebar, and the seat
       * has to live inside that column. So the snapshot is remembered and the
       * scenery is re-synced when the column appears — and again if the shell ever
       * re-creates it, which is why this observes rather than checks once.
       */
      let lastSnapshot
      let ambientObserver
      let ambientResizeObserver
      let ambientResizeHandler
      let visibilityHandler

      /**
       * A cheap fingerprint of the sidebar's geometry.
       *
       * Used to decide when the layout has stopped moving. Two consecutive equal samples mean
       * the shell has finished laying the sidebar out and a measurement can be trusted.
       * @returns a string, or null when the column does not exist.
       */
      function columnSignature() {
        const column = sidebarColumn()
        if (column === null) return null
        const r = column.getBoundingClientRect()
        const style = getComputedStyle(column)
        const band = bandBox(column)
        return [
          Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height),
          style.display, style.visibility,
          band === null ? 'no-band' : `${band.top}:${band.height}`,
        ].join('|')
      }

      ctx.effect(() => {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
        lastSnapshot = ctx.theme.getTheme()

        /**
         * The single action every trigger funnels into: put the scenery where the sidebar is
         * right now. Everything is recomputed, so a call that lands on unchanged geometry is
         * cheap and harmless — which is what makes it safe to call from many triggers.
         */
        /**
         * Coalesce every trigger into at most one sync per frame, and never let a sync's own
         * DOM writes queue the next one.
         *
         * Two separate hazards are handled here, and both of them were live:
         *
         *  1. FEEDBACK. The observer watches the whole body with `subtree: true`, and the sync
         *     appends/removes nodes on the same body. A write therefore scheduled a sync, whose
         *     write scheduled another. The idempotence guard inside `syncAmbient` stops the
         *     cascade from doing work, but the round trip still costs a full-body mutation
         *     delivery each time, so it is closed properly here as well: mutations queued while
         *     a sync is running are discarded.
         *
         *  2. STAMPEDE. Streaming a reply mutates the transcript many times per frame. Calling
         *     the sync per mutation multiplied the sidebar measurements by that factor, which is
         *     what turned "a bit of work on layout change" into continuous CPU burn. Batching to
         *     one call per frame makes the cost proportional to frames instead of mutations.
         */
        let syncInFlight = false
        let syncQueued = false

        const runSync = () => {
          if (syncInFlight) {
            // Our own write. Do not re-enter: the geometry cannot have changed as a result.
            return
          }
          syncInFlight = true
          try {
            resync()
          } finally {
            syncInFlight = false
          }
        }

        const requestSync = () => {
          if (syncQueued) return
          syncQueued = true
          step(() => {
            syncQueued = false
            runSync()
          })
        }

        const resync = () => {
          // The snapshot is re-read rather than reused. If the theme changed while the shell
          // was still assembling, a cached `lastSnapshot` would describe the wrong skin.
          try {
            lastSnapshot = ctx.theme.getTheme()
          } catch {
            // Keep the previous snapshot if the registry is not ready yet.
          }
          const active = lastSnapshot?.active?.id
          const kind = typeof active === 'string' ? bundledTheme(active)?.ambient?.kind : undefined
          // 宠物挂件不依赖侧栏，只锚输入框：放在侧栏存在性判断**之前**，节流与本帧合并
          // 共用（resync 至多每帧一次）。未开启时它第一行就返回，成本是一次布尔判断。
          syncPetStage()
          if (sidebarColumn() === null) {
            // Recorded even though there is nothing to draw. An attempt that finds no sidebar
            // is the likeliest explanation for boot-time silence, and the old report could not
            // show it because it only ever described the final, successful run.
            noteAmbientAttempt({ kind: kind ?? '(无)', column: false })
            return
          }
          syncSkin(lastSnapshot)
        }

        ambientObserver = new MutationObserver(requestSync)
        if (document.body !== null) ambientObserver.observe(document.body, { childList: true, subtree: true })

        // The geometry is measured, so it must be recomputed whenever it changes — including
        // when the shell REPLACES the sidebar node, which unregisters the observer with it.
        // Rebinding is therefore part of every sync rather than something done once at setup.
        let observed = null
        const bindResize = () => {
          if (typeof ResizeObserver === 'undefined') return
          const column = sidebarColumn()
          if (column === null || column === observed) return
          if (ambientResizeObserver !== undefined) ambientResizeObserver.disconnect()
          ambientResizeObserver = new ResizeObserver(requestSync)
          ambientResizeObserver.observe(column)
          observed = column
        }

        ambientResizeHandler = () => {
          bindResize()
          requestSync()
        }
        window.addEventListener('resize', ambientResizeHandler)

        // A backgrounded window does not lay out; on return the geometry may be stale.
        visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            bindResize()
            requestSync()
          }
        }
        document.addEventListener('visibilitychange', visibilityHandler)

        /**
         * Keep asking for the remembered skin until the document actually shows it.
         *
         * ── WHY THIS IS A SEPARATE LOOP ──────────────────────────────────────────
         *
         * The skin check used to live only in two places, and both of them stop early:
         * `publish()` (which the shell may not call during startup) and the settling loop above
         * (which finishes as soon as the geometry holds still — about 100 ms in). Meanwhile the
         * LAYOUT presenter that actually paints tokens mounts later, so the boot-time request was
         * simply not observed, and nothing was watching any more by the time it could have been.
         *
         * On screen: the artwork appears (it is drawn directly and does not need the presenter)
         * while the colours do not, and opening any panel — which triggers the shell's first
         * `publish()` — finally applies them. That is exactly what was reported.
         *
         * So the check gets its own bounded window, driven by a plain interval, and stops the
         * moment the palette is confirmed OR the window closes. Confirmation is what keeps it
         * cheap: once the tokens are on the document this does nothing at all.
         */
        const paintWatch = (() => {
          const INTERVAL_MS = 500
          const MAX_MS = 20000
          const startedAt = Date.now()
          let handle

          const tick = () => {
            handle = undefined
            let done = false
            try {
              const snapshot = ctx.theme.getTheme()
              const active = snapshot?.active?.id
              // The default skin counts here too: on a fresh install this window is what keeps
              // asking until 山青婷彩 is genuinely on the document, not merely requested.
              const wanted = wantedSkin()
              if (wanted === null) {
                done = true
              } else if (skinIsPainted(wanted)) {
                paintAttempts.clear()
                done = true
              } else {
                if (active !== wanted) noteAmbientEvent('启动核对', `${active ?? '?'}→${wanted}`)
                ensureSkinPainted(wanted, active)
              }
            } catch (error) {
              noteAmbientEvent('启动核对抛错', String(error && error.message ? error.message : error))
            }
            const expired = Date.now() - startedAt > MAX_MS
            if (!done && !expired) handle = window.setTimeout(tick, INTERVAL_MS)
            else if (!done) noteAmbientEvent('启动核对超时')
          }

          handle = window.setTimeout(tick, 0)
          return {
            stop() {
              if (handle !== undefined) window.clearTimeout(handle)
              handle = undefined
            },
          }
        })()

        /**
         * Settle the scenery against a MOVING layout.
         *
         * The waiting itself lives in `repeatUntilStable`, which is driven by the observed
         * geometry rather than by elapsed time — see its documentation for why the earlier
         * fixed retry timing could not work. `stableTicks` and `maxMs` are hard bounds: the loop
         * always terminates, so it can never become the frame-by-frame loop that burned a core
         * and grew the process to 11 GB.
         */
        const settling = repeatUntilStable({
          sample: columnSignature,
          apply: () => {
            // The column having a layout is the readiness signal for the whole plugin: it means
            // the shell has mounted, so a `theme/change` now reaches ui-theme's presenter and is
            // actually painted. Restoring the remembered skin before this point was silently
            // swallowed — the scenery appeared (it is derived from the service) while the colours
            // never reached the document.
            if (sidebarColumn() !== null) markBootSettled()
            bindResize()
            runSync()
          },
          setTimer: (fn, delay) => window.setTimeout(fn, delay),
          clearTimer: (handle) => window.clearTimeout(handle),
          now: () => Date.now(),
          intervalMs: 100,
          maxMs: 15000,
          stableTicks: 2,
        })

        // One immediate pass, so a sidebar that is already mounted shows the scenery on the
        // first paint rather than after the first interval.
        runSync()

        return () => {
          settling.stop()
          paintWatch.stop()
          if (ambientObserver !== undefined) ambientObserver.disconnect()
          ambientObserver = undefined
          if (ambientResizeObserver !== undefined) ambientResizeObserver.disconnect()
          ambientResizeObserver = undefined
          if (ambientResizeHandler !== undefined) window.removeEventListener('resize', ambientResizeHandler)
          ambientResizeHandler = undefined
          if (visibilityHandler !== undefined) document.removeEventListener('visibilitychange', visibilityHandler)
          visibilityHandler = undefined
        }
      }, 'theme-gallery: scenery follows the sidebar')

      /* ---------------- slot registrations ----------------
       *
       * Both registrations go through `ctx.slots.inject(key, callback)`, which is
       * what the shipped panel plugins do and what the contract requires: the
       * callback runs only AFTER the target slot is declared, and its returned
       * disposers are installed transactionally. Registering into an undeclared
       * slot creates a pending wait whose entry then vanishes when the shell
       * recomposes — the sidebar entry did exactly that before this change.
       */

      // Main-column page, addressed by the same key as the sidebar entry.
      //
      // The callback returns a single disposer, which is the plainest shape the
      // contract documents ("callback effects are synchronous disposers"). An
      // earlier revision returned a generator to yield several disposers; both
      // shipped panel plugins use the plain form, so this does too — the extra
      // machinery was unverified, and a subscription that never installs is
      // indistinguishable from a panel that never registers.
      ctx.slots.inject('main', () => {
        const disposePage = ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          store,
          locale: NS,
          inject: () => {
            // The only thing this face exists for is switching a theme; all state
            // is published straight into the pinned store instance, so nothing
            // silences the page if this factory never runs. `injectRan` records
            // that it did, purely so the empty state can say which link is missing
            // — so it is set BEFORE the publish that reads it.
            injectRan = true
            publish(ctx.theme.getTheme())
            return {
              setTheme: (id) => { ctx.theme.setTheme(id) },
              // 配色卡上的 15 个色值按钮走这条。它**不直接**切主题（见 `chooseScheme`），
              // 所以这里不新增主题写入点。
              pickScheme: (schemeId) => { chooseScheme(schemeId) },
              // 挂件卡走这条：只开关挂件、只写 localStorage，同样不新增主题写入点。
              togglePet: () => { togglePetWidget() },
              // 头像选择行走这条：换宠物（必要时顺路打开），同样零主题写入。
              pickPet: (kindId) => { selectPetWidget(kindId) },
              // 心情问候卡走这两条：胶囊开关/点卡身开关、三组设置 chips。
              // 一样零主题写入 —— 问候与皮肤正交。
              toggleMood: () => { toggleMoodWidget() },
              setMood: (patch) => { setMoodSettings(patch) },
            }
          },
        }, ThemeGalleryPage)

        // The page is now live, so record that the gate ran — an empty picker has
        // to be able to say whether the panel registered or the registry is bare.
        gateRan = true
        publish(ctx.theme.getTheme())

        // ── THE ECHO GUARD ───────────────────────────────────────────────────────
        //
        // This plugin WRITES to the theme service (`setTheme`, `overrideTokens`) and also
        // SUBSCRIBES to the event those writes emit. Without a guard the two feed each other:
        //
        //     publish → syncSkin → overrideTokens → theme/change → publish → …
        //
        // Nothing yields to the event loop along that path, so it is not a slow loop but a spin —
        // which is exactly what was measured: renderer RSS to 11 GB, ~2.7 cores of accumulated
        // CPU, main/host/GPU untouched, and no crash log because nothing throws.
        //
        // Comparing values cannot break it. `stackSkinTokens` clears `stackedSkin` before asking
        // for the new layer, so a re-entrant call always sees a different value; and `setTheme`
        // legitimately has to be called when the active id differs, which the shell's own
        // `adopt()` guarantees will keep happening. What CAN be distinguished is *who caused the
        // event*, and `emitting()` records exactly that.
        const disposeChange = ctx.on('theme/change', (snapshot) => {
          if (selfEmitDepth > 0) {
            // Our own write coming back. Applying our own change would re-enter the write.
            return
          }
          contribute(snapshot)
          publish(snapshot)
        })

        return () => {
          disposeChange()
          disposePage()
        }
      })

      // Sidebar entrance: the list id IS the main-panel key. `locale` is declared
      // the way the shipped panel entries declare it, so the row label resolves
      // through the dictionary rather than a raw string.
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        locale: NS,
        label: () => zh.title,
      }, PanelGlyph))

      /* ---------------- mood greeting seat ----------------
       *
       * 问候条本体由 mood 模块命令式地建进这张座位（`shell.overlay` 是官方扩展点：
       * 布局壳在 AppFrame 最后渲染 `[data-shell-overlay]`，quota 提示、快捷键弹窗等
       * 五个官方包都往里注册组件）。座位是一张**静态 div**：零 hooks（本插件只引
       * jsx/jsxs，不引 react），一切状态由 localStorage 报给 store、由 publish 驱动
       * syncMoodBar。`aria-hidden`：滚动文字对读屏是噪音，装饰读数走面板自检行。
       *
       * 为什么不直接 append 到 body（挂件的做法）：overlay 条目随外壳的 React 生命
       * 周期走，外壳重组合时不会留下孤儿条；"座位还没渲染"由 moodReport 留读数、
       * 下一次 publish 再捡，不轮询。
       *
       * 注入回调返回的清理函数在插件卸载时收尾全部计时器/监听器/样式表 ——
       * **刻意不叫 `…Dispose`**：那是自发光守卫审计里主题层专用模式的名字（规则 1）。
       */
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'theme-gallery:mood',
        locale: NS,
        inject: () => ({}),
      }, MoodSeat))

      /* ---------------- pet widget ----------------
       *
       * 启用状态在挂载时读一次 localStorage（存进 petRun.enabled 作镜像，避免 resync
       * 每帧都读存储），开着就把舞台建起来；关闭时什么都不装。卸载时整层拆掉 ——
       * 舞台、样式表与全部定时器都在 removePetStage 里收尾。
       */
      ctx.effect(() => {
        if (typeof document === 'undefined') return
        petRun.enabled = petWidgetOn()
        if (petRun.enabled) syncPetStage()
        return () => { removePetStage() }
      }, 'theme-gallery: pet widget')

      /* 心情问候：挂载即首建（座位可能还没渲染——syncMoodBar 会留读数，等 publish
       * 顺路再捡），卸载时收尾全部计时器/监听器/条/样式表。 */
      ctx.effect(() => {
        if (typeof document === 'undefined') return
        syncMoodBar()
        return () => { moodTeardown() }
      }, 'theme-gallery: mood greeting')

      /* ---------------- reading state ---------------- */

      /** The stylesheet element carrying the one reading rule, once installed. */
      let readingTag
      /** Disposer of the active reading token layer, when one is stacked. */
      let readingLayerDispose
      /**
       * The lightened ground {@link readingLayerDispose} was built from.
       *
       * Same role as `stackedAccent`: `syncReadingLayer` writes to the theme service, and it is
       * scheduled from a `MutationObserver` on `document.body` — so without this, every batch of
       * DOM mutations would replace the layer, which emits `theme/change`, which repaints the
       * shell, which mutates the DOM again. That is a loop through the microtask queue rather than
       * through the stack, so it would burn CPU steadily instead of throwing.
       * @type {string|undefined}
       */
      let stackedReading

      /**
       * Install the reading rule, once per plugin lifetime.
       *
       * It constrains the reading measure only. Earlier revisions painted the
       * centre column here — first with a lightened card, then (while reading) with
       * `background: transparent`. The transparent form was the reason a selected
       * theme looked like a plain white app: the column stopped showing the theme's
       * own `--dsw-alias-bg-base`, and what showed through was the app's default
       * ground. A skin must never be painted over by its own plugin.
       *
       * Lightening is a TOKEN concern, so it goes through `overrideTokens` — the
       * service's own mechanism for stacking a layer over the active theme — and
       * not through this stylesheet.
       */
      function installReadingStyle() {
        if (typeof document === 'undefined' || readingTag !== undefined) return
        readingTag = document.createElement('style')
        readingTag.dataset.plugin = 'theme-gallery'
        readingTag.dataset.pluginCss = 'theme-gallery/reading'
        const sel = `[data-windows-titlebar] body[${READING_ATTRIBUTE}] .centerCol,body[${READING_ATTRIBUTE}] .centerCol`
        readingTag.textContent = `${sel}>*{max-width:var(--dsh-reading-width,640px);margin-inline:auto;width:100%;}`
        document.head.append(readingTag)
      }

      /**
       * Find the centre column: the official stylesheet's own Windows anchor.
       * @returns the centre column element, or null before the shell mounts.
       */
      function centreColumn() {
        if (typeof document === 'undefined') return null
        return document.querySelector('[data-windows-titlebar] .centerCol')
          || document.querySelector('.centerCol')
      }

      /**
       * Find the composer: the contenteditable inside the centre column.
       * @param centre - the centre column element.
       * @returns the composer element, or null.
       */
      function composerOf(centre) {
        if (centre === null) return null
        return centre.querySelector('[contenteditable="true"]') || centre.querySelector('textarea')
      }

      /**
       * Decide whether the transcript holds messages.
       *
       * The composer's parent is its own seat; the transcript is a sibling that
       * holds element children. If the layout changes and this stops matching, the
       * plugin degrades to the idle look rather than breaking anything.
       * @param centre - the centre column element.
       * @returns true when a transcript sibling has content.
       */
      function transcriptHasContent(centre) {
        const composer = composerOf(centre)
        if (composer === null) return false
        const seat = composer.parentElement
        if (seat === null) return false
        const parent = seat.parentElement
        if (parent === null) return false
        for (const sibling of parent.children) {
          if (sibling === seat) continue
          if (sibling.childElementCount > 0) return true
        }
        return false
      }

      /**
       * Apply the reading state for the current document.
       *
       * Lightening the transcript is a token concern, so it is expressed as an
       * `overrideTokens` layer (applied by `syncReadingLayer`) rather than a
       * stylesheet rule: a rule that paints over the centre column also paints
       * over the theme, which is how a selected skin came to look like a plain
       * white app.
       */
      function applyReading() {
        if (typeof document === 'undefined') return
        const centre = centreColumn()
        const body = document.body
        if (body === null) return

        if (centre !== null) {
          centre.style.setProperty('--dsh-reading-width', `${READING.maxWidth}px`)
        }

        if (transcriptHasContent(centre)) body.setAttribute(READING_ATTRIBUTE, 'card')
        else body.removeAttribute(READING_ATTRIBUTE)
        syncReadingLayer()
      }

      /**
       * Stack or retract the reading token layer.
       *
       * `overrideTokens(source, tokens)` folds a `{ light, dark }`-shaped layer
       * over the ACTIVE theme, so the lightening follows whichever skin and
       * palette is in play and disappears cleanly when the transcript empties.
       *
       * The source string is the layer's identity, so re-stacking the same source
       * REPLACES the layer instead of adding a second one. Replacement alone is not
       * idempotence: the call still emits `theme/change`, so it is the skip below
       * (`wanted === stackedReading`) that keeps an unchanged document from churning
       * the layer on every mutation batch.
       */
      function syncReadingLayer() {
        if (typeof document === 'undefined') return
        const reading = document.body !== null && document.body.hasAttribute(READING_ATTRIBUTE)
        // Computed before the skip test, because the skip compares VALUES. `lighten` is pure, so
        // the same document state always yields the same pair and the comparison is exact.
        const wanted = reading ? lighten(READING.bg, READING.alpha) : undefined
        const wantedDark = reading
          // Lightened ground for both palettes: a light theme wants a softer wash, a dark one a
          // slightly raised surface. Both keep the theme's hue.
          ? lighten(READING.bg, Math.max(0, READING.alpha - 0.2))
          : undefined

        // Both writes below emit `theme/change`, and this function is reached from a
        // `MutationObserver` on `document.body` — the same tree the shell repaints when the theme
        // changes. See the comment in `syncAccent` for the full shape; the short version is that
        // an unguarded write here lets the layer drive its own trigger.
        if (wanted === stackedReading) return
        emitting(() => {
          if (readingLayerDispose !== undefined) {
            readingLayerDispose()
            readingLayerDispose = undefined
          }
          stackedReading = undefined
          if (wanted === undefined) return
          readingLayerDispose = ctx.theme.overrideTokens('theme-gallery: reading', {
            '--dsw-alias-bg-base': { light: wanted, dark: wantedDark },
          })
          stackedReading = wanted
        })
      }

      // Debounced onto a microtask: streaming a reply mutates the transcript many
      // times per frame, and only the settled answer matters here.
      let pending
      const schedule = () => {
        if (pending !== undefined) return
        pending = Promise.resolve().then(() => {
          pending = undefined
          applyReading()
        })
      }

      ctx.effect(() => {
        installReadingStyle()
        // The shell may not be mounted yet when apply runs.
        const observer = new MutationObserver(schedule)
        if (document.body !== null) observer.observe(document.body, { childList: true, subtree: true })
        else document.addEventListener('DOMContentLoaded', () => {
          if (document.body !== null) observer.observe(document.body, { childList: true, subtree: true })
          schedule()
        }, { once: true })
        schedule()
        return () => {
          observer.disconnect()
          if (readingTag !== undefined) readingTag.remove()
          readingTag = undefined
          // Guarded for the same reason as the writes in `syncReadingLayer`, and the remembered
          // value is cleared with the layer: leaving it set would make that function's skip test
          // believe a layer is still stacked after this one removed it, and it would then refuse
          // to re-stack.
          emitting(() => {
            if (readingLayerDispose !== undefined) {
              readingLayerDispose()
              readingLayerDispose = undefined
            }
            stackedReading = undefined
          })
          document.body.removeAttribute(READING_ATTRIBUTE)
          const centre = centreColumn()
          if (centre !== null) centre.style.removeProperty('--dsh-reading-width')
        }
      }, 'theme-gallery: reading state')
    }

    return module.exports
  },
})
