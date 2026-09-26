/**
 * Render a self-contained preview of the theme-skin panel's CARD ORDER.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * The card order is data (`CARD_ORDER`) that only becomes visible in a running
 * app. Judging it by reading the table is exactly the kind of "looks right"
 * verification this project has been burned by, so the order is rendered here
 * instead — and the page it renders is built from the SHIPPING sources:
 *
 *   · `PAGE_CSS`            — the panel's stylesheet, read out of `lib/client.js`;
 *   · `CARD_ORDER` + `cardsInDisplayOrder` — extracted AND executed, so the page
 *                             shows the order the bundle will actually produce;
 *   · `OMITTED_IDS`, `BUILT_IN_LABELS`, `BUILT_IN_DESCRIPTIONS`, `DEFAULT_SKIN`,
 *     the `zh` copy and the inlined theme array — all read from the bundle.
 *
 * The only things this page adds are preview chrome and a rank chip per card,
 * so the screenshot can be checked against the user's own numbering at a glance.
 *
 * Run with: node scripts/build-panel-preview.mjs
 * Output:   tools/theme-bench/panel-preview.html
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/**
 * Read a module-level `const NAME = <literal>` and evaluate it in isolation.
 *
 * Brackets inside STRINGS are skipped, because the copy contains things like
 * `'{count} 个可选主题'` — a brace counter that ignores quoting would stop the
 * literal at the `}` inside that string and evaluate a truncated object.
 * @param name - the constant's name.
 * @returns the evaluated literal.
 */
function readLiteral(name) {
  const marker = `    const ${name} = `
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`lib/client.js: const ${name} not found`)
  const from = at + marker.length
  let depth = 0
  let quote = null
  let end = -1
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i]
    if (quote !== null) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    // ── 注释必须先跳过 ────────────────────────────────────────────────────────
    //
    // 这个读取器按"引号配对"扫字面量，所以注释里出现的一对**反引号**会被当成模板字符串
    // 的起止，扫描就此跑飞，报的还是 `const PAGE_CSS literal not terminated` ——
    // 指向的是 PAGE_CSS，真正的原因却在它上方一句注释里（本次实测：注释里写了
    // overflow:hidden 的反引号形式，预览页构建直接挂）。这与规则 7 是同一族：
    // **注释里提到的代码写法会骗过按文本工作的工具**，区别只是这次断的是构建而不是断言。
    if (ch === '/' && source[i + 1] === '/') {
      const lineEnd = source.indexOf('\n', i)
      if (lineEnd < 0) break
      i = lineEnd
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      const blockEnd = source.indexOf('*/', i + 2)
      if (blockEnd < 0) break
      i = blockEnd + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1
      if (depth === 0) { end = i; break }
    } else if (ch === '\n' && depth === 0) { end = i - 1; break }
  }
  if (end < 0) throw new Error(`lib/client.js: const ${name} literal not terminated`)
  // eslint-disable-next-line no-eval
  return eval(`(${source.slice(from, end + 1).trim()})`)
}

/**
 * Grab `function name(...) { ... }` by brace matching, skipping the parameter
 * list first — a destructured parameter has braces of its own.
 * @param name - the function name.
 * @returns the function's source text.
 */
function block(name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`lib/client.js: function ${name} not found`)
  let parens = 0
  let close = -1
  for (let i = source.indexOf('(', start); i < source.length; i += 1) {
    if (source[i] === '(') parens += 1
    else if (source[i] === ')') {
      parens -= 1
      if (parens === 0) { close = i; break }
    }
  }
  if (close < 0) throw new Error(`could not find the parameter list of ${name}`)
  const open = source.indexOf('{', close)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`could not find the end of ${name}`)
}

/**
 * Read the inlined theme array (same extraction as the tests).
 * @returns the bundled skin definitions.
 */
function readBundledThemes() {
  const at = source.indexOf('const BUNDLED_THEMES = ')
  if (at < 0) throw new Error('lib/client.js: BUNDLED_THEMES not found')
  const from = at + 'const BUNDLED_THEMES = '.length
  const end = source.indexOf('\n    ]', from)
  if (end < 0) throw new Error('lib/client.js: BUNDLED_THEMES terminator not found')
  // eslint-disable-next-line no-eval
  return eval(source.slice(from, end + '\n    ]'.length))
}

const PAGE_CSS = readLiteral('PAGE_CSS').join('')
const CARD_ORDER = readLiteral('CARD_ORDER')
const OMITTED_IDS = readLiteral('OMITTED_IDS')
const BUILT_IN_LABELS = readLiteral('BUILT_IN_LABELS')
const BUILT_IN_DESCRIPTIONS = readLiteral('BUILT_IN_DESCRIPTIONS')
const DEFAULT_SKIN = readLiteral('DEFAULT_SKIN')
const VERSION = readLiteral('BUNDLED_VERSION')
const zh = readLiteral('zh')
const bundled = readBundledThemes()

// The shipping order logic, executed rather than re-implemented.
// eslint-disable-next-line no-new-func
const { cardRank, cardsInDisplayOrder } = new Function(
  'CARD_ORDER',
  `${block('cardRank')}\n${block('cardsInDisplayOrder')}\nreturn { cardRank, cardsInDisplayOrder }`,
)(CARD_ORDER)

/**
 * The picker sanitiser, extracted from the bundle and executed.
 *
 * Sliced rather than read as a literal: the helpers start at `const SCHEME_ID`,
 * which is a REGEX — and the literal reader above counts `[`/`]` as brackets, so it
 * would stop at the character class and evaluate a syntax error. Taking the
 * contiguous source from the regex to the end of `cardRowShape` keeps the preview
 * on the shipping implementation (`schemeById` / `shade` sit between them).
 * @returns the sanitiser.
 */
function readCardRowShape() {
  const at = source.indexOf('    const SCHEME_ID = ')
  if (at < 0) throw new Error('lib/client.js: const SCHEME_ID not found')
  const shape = block('cardRowShape')
  const end = source.indexOf(shape) + shape.length
  // eslint-disable-next-line no-new-func
  return new Function(`${source.slice(at, end)}\nreturn { cardRowShape }`)().cardRowShape
}

const cardRowShape = readCardRowShape()

/**
 * 15 套配色方案 —— 卡片上那 15 个色值按钮的颜色与标签都从这里来。
 *
 * 直接读 `lib/palette-schemes.json`（与 `embed-themes.mjs` 内联的是同一个文件），
 * 所以预览页画出来的格子与面板里点的格子不可能对不上。
 */
const PALETTE_SCHEMES = JSON.parse(
  readFileSync(join(root, 'lib', 'palette-schemes.json'), 'utf8'),
).schemes

/**
 * The official ui-theme themes, in their real registration order. They declare no
 * tokens of their own (their card is a plain line), which is why they have no strip.
 */
const BUILT_INS = [
  { id: 'light', colorScheme: 'light', tokens: {} },
  { id: 'dark', colorScheme: 'dark', tokens: {} },
  { id: 'system', colorScheme: 'light', tokens: {} },
]

const registry = [...BUILT_INS, ...bundled]
const visible = registry.filter((theme) => !OMITTED_IDS.has(theme.id))
const shown = cardsInDisplayOrder(visible)

/**
 * 卡片数 ≠ 皮肤数，这里与面板用同一条口径。
 *
 * 标题文案是 `{count} 款皮肤（另有内置浅色/深色两张卡）`，所以数字必须是**皮肤**数：
 * 把内置浅色/深色当成皮肤去数，会报出一个与 README 不一致的数字。
 * （本页曾经就是这么错的 —— 标题打印卡片数、而卡片里含两张内置卡。这类错误没有任何
 * 运行期信号，正是发布自检现在守着的那一类。）
 */
const builtInCardCount = shown.filter((theme) => BUILT_IN_LABELS[theme.id] !== undefined).length
const skinCount = shown.length - builtInCardCount

/** Mirror of the store's `pick`: resolve a `{light,dark}` pair to one string. */
function tokenValue(theme, name) {
  const value = (theme.tokens ?? {})[name]
  if (value === undefined || value === null) return undefined
  return typeof value === 'string' ? value : value[theme.colorScheme]
}

const cards = shown.map((theme) => {  const label = theme.label || BUILT_IN_LABELS[theme.id] || theme.id
  const description = theme.description || BUILT_IN_DESCRIPTIONS[theme.id] || ''
  const swatches = [
    tokenValue(theme, '--dsw-alias-brand-primary'),
    tokenValue(theme, '--dsw-alias-label-secondary'),
    tokenValue(theme, '--dsw-alias-state-business-primary'),
  ].filter((value) => typeof value === 'string' && value !== '')
  // A picker card replaces the strip AND drops the description body (it stays the
  // tooltip) — the same branch the panel takes, decided by the same function.
  const rows = cardRowShape(theme, PALETTE_SCHEMES)
  const picker = rows === undefined
    ? ''
    : `
        <span class="tg-picker">${rows.map((row) => `<span class="tg-pickrow">`
      + `${row.schemes.map((id) => {
        const scheme = PALETTE_SCHEMES.find((entry) => entry.id === id) ?? { label: id, main: '#000000', kind: 'solid' }
        const accents = scheme.dots ?? []
        // 与面板同一套规则：拼色按宽度分带（主色 2 份、每个次色 1 份），
        // 纯色是"一条带占满"的退化情况。
        const bands = scheme.kind === 'clash'
          ? [[scheme.main, 2], ...accents.map((colour) => [colour, 1])]
          : [[scheme.main, 1]]
        const inner = bands
          .map(([colour, weight]) => `<span class="tg-band" style="background:${colour};flex-grow:${weight}"></span>`)
          .join('')
        // 预览里按钮不可点（点了也不会真的换色），所以 aria-pressed 一律 false：
        // 它只是"排版与颜色长什么样"的对照，不是交互演示。`data-name` 是悬停标签的内容
        // （CSS `content:attr(data-name)`），预览页里鼠标移上去就能看到名字。
        return `<button type="button" class="tg-swatch" aria-pressed="false" data-name="${scheme.label}" `
          + `title="${scheme.label}${scheme.source === undefined ? '' : ` · ${scheme.source}`}">${inner}</button>`
      }).join('')}</span>`).join('')}</span>`
  const strip = rows !== undefined || swatches.length === 0
    ? ''
    : `
        <span class="tg-strip">${swatches.map((colour) => `<span style="background:${colour}"></span>`).join('')}</span>`
  const selected = theme.id === DEFAULT_SKIN
  const rank = cardRank(theme.id)
  const head = `
        <div class="tg-card-top">
          <span class="tg-name">${label}</span>
          ${selected ? `<span class="tg-badge">${zh.applied}</span>` : ''}
        </div>`
  const tail = `${rows === undefined && description ? `<span class="tg-desc">${description}</span>` : ''}
        <span class="pv-rank">序号 ${rank}${rank < 0 ? '（未排名）' : ''} · ${theme.id}</span>`
  // 配色卡是 div（里面装着 15 个按钮），其余卡片仍是整块可点的 button —— 与面板一致。
  return rows === undefined
    ? `
      <button type="button" class="tg-card" aria-pressed="${selected}" title="${description || label}">${head}${strip}
        ${tail}
      </button>`
    : `
      <div class="tg-card tg-picker-card" title="${description || label}">${head}${picker}
        ${tail}
      </div>`
}).join('\n')

/** The default skin's own palette, so the panel is painted as it looks in the app. */
const defaultTheme = bundled.find((theme) => theme.id === DEFAULT_SKIN)
if (defaultTheme === undefined) throw new Error(`lib/client.js: DEFAULT_SKIN ${DEFAULT_SKIN} is not bundled`)
const paletteVars = Object.entries(defaultTheme.tokens)
  .map(([name, value]) => `    ${name}: ${typeof value === 'string' ? value : value[defaultTheme.colorScheme]};`)
  .join('\n')

const orderLine = shown
  .map((theme, index) => `${cardRank(theme.id)} ${theme.label || BUILT_IN_LABELS[theme.id] || theme.id}${index < shown.length - 1 ? ' →' : ''}`)
  .join(' ')

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>DSH 主题皮肤面板 · 卡片顺序预览</title>
<style>
  /* ── the default skin's own tokens, verbatim from lib/client.js ─────────
     The panel's stylesheet reads these variables, so without them it would
     render unthemed and the preview would be judging the wrong picture. */
  :root {
${paletteVars}
  }

  /* ── everything below this marker is the plugin's own stylesheet ─────── */
${PAGE_CSS}

  /* ── preview chrome only ────────────────────────────────────────────── */
  body{margin:0;padding:24px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
    font:14px/1.6 system-ui,"Segoe UI","Microsoft YaHei",sans-serif}
  .pv-note{max-width:1100px;margin:0 auto 14px;font-size:12.5px;line-height:1.7;
    color:var(--dsw-alias-label-secondary)}
  .pv-note code{background:var(--dsw-alias-bg-layer-3);padding:1px 5px;border-radius:4px}
  .pv-frame{max-width:1100px;margin:0 auto;background:var(--dsw-alias-bg-base);
    border:.5px solid var(--dsw-alias-border-l3);border-radius:12px;overflow:hidden}
  .pv-rank{font:11px/1.4 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-tertiary);
    border-top:1px dashed var(--dsw-alias-border-l3);padding-top:6px}
</style>
</head>
<body>
  <p class="pv-note">
    本页由 <code>scripts/build-panel-preview.mjs</code> 生成：面板样式 <code>PAGE_CSS</code>、
    顺序表 <code>CARD_ORDER</code>、<code>cardsInDisplayOrder()</code>、内置卡文案、
    默认皮肤与内联皮肤数组，全部<strong>直接读自 <code>lib/client.js</code> 并原样执行</strong>，
    不是另抄一份。卡片顺序即出货顺序；每张卡下方的
    <code>序号 … · id</code> 一行是本页额外的校对标注，应用里没有。当前配色取自默认皮肤
    ${defaultTheme.label}。
  </p>
  <div class="pv-frame">
    <div class="tg-page">
      <div class="tg-head">
        <span class="tg-title">${zh.title}</span>
        <span class="tg-hint">${zh.hint}</span>
        <span class="tg-hint">${zh.count.replace('{count}', String(skinCount))}</span>
        <span class="tg-hint">v${VERSION}</span>
      </div>
      <div class="tg-grid">
${cards}
      </div>
    </div>
  </div>
  <p class="pv-note">顺序自检：${orderLine}</p>
</body>
</html>
`

const out = join(root, 'tools', 'theme-bench', 'panel-preview.html')
writeFileSync(out, html)
console.log(`wrote ${out}`)
console.log(`card order: ${shown.map((theme) => theme.id).join(' > ')}`)
console.log(`cards: ${shown.length} = ${skinCount} skins + ${builtInCardCount} built-in light/dark`)
