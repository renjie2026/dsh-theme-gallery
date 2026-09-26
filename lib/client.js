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
    const BUNDLED_VERSION = '0.4.1'

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
      count: '{count} 款皮肤（另有内置浅色/深色两张卡）',
      current: '当前',
      applied: '已应用',
      empty: '正在读取官方主题注册表…',
      // The diagnostics below the cards are a FEATURE — a live reading of the active skin —
      // and a wall of monospace text reads as a fault unless the panel says otherwise.
      diagNote: '以下为有意设计的诊断信息，便于直观查看皮肤的实时运行状态，并非系统报错；'
        + '带 ⚠ 的行才表示装饰未生效',
    }
    const en = {
      title: 'Theme skins',
      hint: 'Click to switch; the choice is remembered',
      count: '{count} skins (+ built-in light/dark cards)',
      current: 'Current',
      applied: 'Applied',
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
     * Render one card.
     *
     * Three layouts share the card: the default token strip, the palette picker (a
     * theme that declares `card.rows`), and — for the picker — no description body,
     * because the swatches already fill it. The description still becomes the tooltip
     * (`title`), which is what the schema says the field is for.
     *
     * A picker card is a `div`, not a `button`: it CONTAINS 15 buttons, and nesting
     * buttons inside a button is invalid markup that browsers silently re-parent.
     * @param props - id, label, description, swatches, rows, selected, applied,
     *                selectedScheme, onSelect, onPickScheme.
     * @returns the card element.
     */
    function ThemeCard(props) {
      const {
        id, label, description, swatches, rows, selected, applied,
        selectedScheme, onSelect, onPickScheme, t,
      } = props
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
      const head = jsxs('div', {
        className: 'tg-card-top',
        children: [
          jsx('span', { className: 'tg-name', children: label || id }),
          selected ? jsx('span', { className: 'tg-badge', children: applied }) : null,
        ],
      })
      const body = hasPicker
        ? cardPickerElement(shape, selectedScheme, onPickScheme, PALETTE_SCHEMES)
        : swatches.length > 0
          ? jsx('span', {
            className: 'tg-strip',
            children: swatches.map((colour, index) => jsx('span', { style: { background: colour } }, index)),
          })
          : null
      // The picker fills the card, so it prints no body copy; `description` stays the
      // tooltip, which is what the schema says the field is for.
      const desc = !hasPicker && description
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
        ambientReport = { found: true, kind: '(none)', note: '该主题无装饰' }
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

    /**
     * Render the main-column gallery page.
     *
     * `usePanelInfo` comes from the layout's GlobalStandardProps, so the page can
     * render nothing when another panel is selected without the shell having to
     * mount and unmount it.
     * @param props - composed slot props.
     * @returns the page element tree.
     */
    function ThemeGalleryPage({ t, setTheme, pickScheme, useStore, usePanelInfo }) {
      const info = usePanelInfo((s) => s.activePanelId)
      const ids = useStore((s) => s.ids)
      const labels = useStore((s) => s.labels)
      const descriptions = useStore((s) => s.descriptions)
      const swatches = useStore((s) => s.swatches)
      const cardRows = useStore((s) => s.cardRows)
      const scheme = useStore((s) => s.scheme)
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
      // ── THE HEADER COUNT IS SKINS, NOT CARDS ─────────────────────────────────
      //
      // The built-in 浅色 / 深色 cards are not skins — they only switch the palette back to the
      // official appearance — so counting them here would advertise a number that disagrees
      // with the README and with npm's description ("6 skins"). The cards are named in the
      // same line instead, so nothing is hidden by leaving them out of the number.
      const builtInCards = ids.filter((id) => BUILT_IN_LABELS[id] !== undefined).length
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
          (debugEnabled() || showScenery)
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
        const themes = cardsInDisplayOrder([...snapshot.themes].filter((theme) => !OMITTED_IDS.has(theme.id)))
        storeActions.sync(themes, appliedCardId(snapshot), revision)
        // 卡片上点亮哪一格，以及要不要把那一层配色叠上去 —— 两件事都读同一份
        // localStorage，所以"看到的选中态"与"屏幕上的颜色"不可能对不上。
        storeActions.markScheme(wantedScheme())
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
