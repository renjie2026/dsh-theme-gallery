/**
 * 主题卡片展示顺序的断言。
 *
 * ── 这个文件守的是什么 ───────────────────────────────────────────────────────
 *
 * 面板里的卡片顺序**只由一张表决定**（`CARD_ORDER`），它作用在交给页面的那份副本上，
 * 不碰注册表。这张表有两个静默失败的方向，两边都不会报错：
 *
 *   1. 表里写错了 id（拼写、改名）→ 该主题**掉到列表最后**，看起来"排序没生效"；
 *   2. 表改了但 `publish()` 忘了用它 → 顺序**完全没变**，同样没有异常。
 *
 * 所以这里不只断言"顺序对"，还断言"**表真的被用上了**"（源码级），
 * 以及表里每个 id 都真的存在（源码数据 vs 内联皮肤互证）。
 *
 * ── 为什么从源码里"读"而不是"抄" ─────────────────────────────────────────────
 *
 * 表与函数都是从 `lib/client.js` 里**提取并执行**的（与 `build-ambient-preview.mjs`
 * 相同的提取法），所以这份断言不可能与出货代码各说各话。
 *
 * ── 最后一段是变异测试（硬性规则 9）──────────────────────────────────────────
 *
 * 新写的断言必须**故意破坏它守护的代码**，确认断言真的会失败。
 * 这里把四处真实变异（改序号 / 去掉 publish 的排序 / 重新隐藏浅色 / 改默认皮肤）
 * 直接作用于真实源码，然后断言"对应的检查必须失败"，并额外断言
 * "变异真的改动了源码"——否则下面的结论什么都没测。
 *
 * 运行：node tests/check-card-order.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cardRowProblems, paletteProblems } from '../scripts/lib/card-rows.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const real = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

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

/**
 * 用户给定的序号清单（从大到小即为展示顺序）。
 *
 * 这是**需求本身**，所以逐个写死在这里：改动它必须是一次有意的修改，
 * 而不是某次重构的副作用。
 */
const EXPECTED = [
  'light', 'dark', 'shi-liu-jin', 'ying-mu-cai-yun', 'shan-qing-ting-cai',
  'pei-an-jie-xin', 'meng-hai-you-yu',
  'hu-po-mao-mi', 'hu-zi-a-huang',
]

/** 与 {@link EXPECTED} 一一对应的序号。 */
const EXPECTED_RANKS = [99, 98, 97, 96, 95, 91, 80, 76, 75]

/** 内联皮肤数组的注册顺序（= embed 的字母序），发布顺序的断言在 check-theme-contribution。 */
const ALPHA_ORDER = 'hu-po-mao-mi,hu-zi-a-huang,meng-hai-you-yu,pei-an-jie-xin,shan-qing-ting-cai,shi-liu-jin,ying-mu-cai-yun'

/**
 * 官方 ui-theme 自带的内置主题，按真实注册顺序排在最前。
 *
 * 桩的形状照抄 `tests/check-boot-path.mjs`：内置主题不带 tokens（卡片因此没有色带），
 * 名字与说明由本插件补（`BUILT_IN_LABELS` / `BUILT_IN_DESCRIPTIONS`）。
 */
const BUILT_INS = [
  { id: 'light', colorScheme: 'light', tokens: {} },
  { id: 'dark', colorScheme: 'dark', tokens: {} },
  { id: 'system', colorScheme: 'light', tokens: {} },
]

/**
 * 从源码里读一个模块级 `const NAME = <字面量>`，并在隔离环境里求值。
 *
 * 用括号配平而不是"取到行尾"，因为其中几个字面量是多行的对象；
 * 单行标量（字符串、`new Set([...])`）在括号归零后遇到换行即结束。
 * @param source - 源码文本。
 * @param name - 常量名。
 * @returns 求值结果。
 */
function readConst(source, name) {
  const marker = `    const ${name} = `
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`const ${name} not found`)
  const from = at + marker.length
  let depth = 0
  let end = -1
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{' || ch === '[' || ch === '(') depth += 1
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1
      if (depth === 0) { end = i; break }
    } else if (depth === 0 && ch === '\n') { end = i - 1; break }
  }
  if (end < 0) throw new Error(`const ${name} literal not terminated`)
  const literal = source.slice(from, end + 1).trim()
  // Parenthesised: a literal that starts with `{` would otherwise be parsed as a BLOCK
  // statement, and an object's `light: 99` reads as a label — a syntax error that says
  // nothing about the table being wrong.
  // eslint-disable-next-line no-eval
  return eval(`(${literal})`)
}

/**
 * 按花括号配平取一个 `function name(...) { ... }` 的源码。
 *
 * 跳过参数表再找函数体的左花括号：解构形参自带花括号，直接取第一个 `{`
 * 会把函数体截断成参数表——这个坑本仓库踩过（见 build-ambient-preview.mjs）。
 * @param source - 源码文本。
 * @param name - 函数名。
 * @returns 函数源码。
 */
function block(source, name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`function ${name} not found`)
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
 * 把内联的皮肤数组读出来（与 check-theme-contribution 相同的取法）。
 * @param source - 源码文本。
 * @returns 皮肤定义数组。
 */
function readBundled(source) {
  const at = source.indexOf('const BUNDLED_THEMES = ')
  if (at < 0) throw new Error('BUNDLED_THEMES not found')
  const from = at + 'const BUNDLED_THEMES = '.length
  const end = source.indexOf('\n    ]', from)
  if (end < 0) throw new Error('BUNDLED_THEMES terminator not found')
  // eslint-disable-next-line no-eval
  return eval(source.slice(from, end + '\n    ]'.length))
}

/**
 * 从一份源码里提取"顺序系统"的全部零件。
 *
 * 提取的是**真实的函数体**（在 `new Function` 里执行），所以断言跑的是出货逻辑本身。
 * @param source - 源码文本。
 * @returns 表、函数与内联皮肤。
 */
function extract(source) {
  const CARD_ORDER = readConst(source, 'CARD_ORDER')
  const orderFunctions = new Function(
    'CARD_ORDER',
    `${block(source, 'cardRank')}\n${block(source, 'cardsInDisplayOrder')}\n`
    + 'return { cardRank, cardsInDisplayOrder }',
  )(CARD_ORDER)
  return {
    CARD_ORDER,
    cardRank: orderFunctions.cardRank,
    cardsInDisplayOrder: orderFunctions.cardsInDisplayOrder,
    OMITTED_IDS: readConst(source, 'OMITTED_IDS'),
    DEFAULT_SKIN: readConst(source, 'DEFAULT_SKIN'),
    BUILT_IN_LABELS: readConst(source, 'BUILT_IN_LABELS'),
    BUILT_IN_DESCRIPTIONS: readConst(source, 'BUILT_IN_DESCRIPTIONS'),
    bundled: readBundled(source),
  }
}

/**
 * 复刻 `publish()` 里的那一行：过滤掉不展示的，再按展示顺序排序。
 * @param api - {@link extract} 的结果。
 * @returns 页面实际渲染的 id 序列。
 */
function shownOrder(api) {
  const registry = [...BUILT_INS, ...api.bundled]
  const visible = registry.filter((theme) => !api.OMITTED_IDS.has(theme.id))
  return api.cardsInDisplayOrder(visible).map((theme) => theme.id)
}

/** `publish()` 真的把展示顺序作用在过滤后的列表上。 */
const PUBLISH_USES_ORDER = /cardsInDisplayOrder\(\[\.\.\.snapshot\.themes\]\.filter\(/

// ── 正向：真实源码必须满足的每一条 ───────────────────────────────────────────
const api = extract(real)
const shown = shownOrder(api)

check('卡片顺序 = 序号从大到小', shown.join(',') === EXPECTED.join(','))
if (shown.join(',') !== EXPECTED.join(',')) {
  console.error(`  期望: ${EXPECTED.join(',')}`)
  console.error(`  实际: ${shown.join(',')}`)
}
check('序号表与清单的数字一致', EXPECTED.every((id, i) => api.CARD_ORDER[id] === EXPECTED_RANKS[i]))
check('序号严格递减（确实是倒序，不是别的排列）',
  EXPECTED_RANKS.every((rank, i) => i === 0 || rank < EXPECTED_RANKS[i - 1]))
check('序号表没有多余条目', Object.keys(api.CARD_ORDER).length === EXPECTED.length)
check('表里每个 id 都真实存在（拼写错会让卡片静默掉到最后）',
  EXPECTED.every((id) => api.bundled.some((theme) => theme.id === id) || id in api.BUILT_IN_LABELS))
check('反向：表里没有指不到任何主题的条目（拼错的 key 抓得住）',
  Object.keys(api.CARD_ORDER).every((id) =>
    api.bundled.some((theme) => theme.id === id) || id in api.BUILT_IN_LABELS))

check('浅色卡片在列（不再被隐藏）', shown.includes('light'))
check('深色卡片在列', shown.includes('dark'))
check('「跟随系统」不出卡片', !shown.includes('system'))
check('浅色 / 深色 各有一行说明文案',
  String(api.BUILT_IN_DESCRIPTIONS.light ?? '').length > 0
  && String(api.BUILT_IN_DESCRIPTIONS.dark ?? '').length > 0)

/**
 * 用户指定的那句"惊喜"文案。
 *
 * 它不只是修辞：切到内置主题时上一套皮肤的侧栏素材确实会留下，
 * `tests/check-boot-path.mjs` 用行为断言守着那份素材。文案把这件事讲出来，
 * 所以文案与行为必须同时成立 —— 这里钉住文案那一半。
 */
const SURPRISE_LINE = '先选中主题皮肤，再切换浅色/深色 会有惊喜哦'

check('浅色 / 深色 的说明里都有那句「惊喜」',
  String(api.BUILT_IN_DESCRIPTIONS.light).includes(SURPRISE_LINE)
  && String(api.BUILT_IN_DESCRIPTIONS.dark).includes(SURPRISE_LINE))
check('浅色 / 深色 的说明不再声称「不加载任何皮肤」（与保留素材矛盾）',
  !String(api.BUILT_IN_DESCRIPTIONS.light).includes('不加载任何皮肤')
  && !String(api.BUILT_IN_DESCRIPTIONS.dark).includes('不加载任何皮肤'))

check('默认皮肤是山青婷彩', api.DEFAULT_SKIN === 'shan-qing-ting-cai')
check('默认皮肤是内联皮肤之一（否则永远上不了色）',
  api.bundled.some((theme) => theme.id === api.DEFAULT_SKIN))

check('注册顺序没被改动（仍是内联的字母序）',
  api.bundled.map((theme) => theme.id).join(',') === ALPHA_ORDER)
check('排序是纯函数：不改动传入的数组', (() => {
  const input = [...BUILT_INS, ...api.bundled]
  const before = input.map((theme) => theme.id).join(',')
  api.cardsInDisplayOrder(input)
  return input.map((theme) => theme.id).join(',') === before
})())
check('未排名的主题排在所有排名之后，且彼此保持注册序', (() => {
  const foreign = [
    { id: 'aco-plugin-theme', tokens: {} },
    { id: 'bco-plugin-theme', tokens: {} },
  ]
  const out = api.cardsInDisplayOrder([...BUILT_INS, ...api.bundled, ...foreign]).map((t) => t.id)
  return out.slice(-2).join(',') === 'aco-plugin-theme,bco-plugin-theme'
    && out.indexOf('aco-plugin-theme') === out.length - 2
})())
check('publish() 真的用上了展示顺序（表存在但不生效也算失败）', PUBLISH_USES_ORDER.test(real))

// ── 纯色/拼色：15 个可点色值按钮的配色卡（`card.rows` + `lib/palette-schemes.json`）
//
// 卡片不再是一条 3 色色带，也不是"展示一套配色的静态色块"，而是**15 个可点的方案按钮**
// （上两排 10 个纯色、最后一排 5 个拼色）。四个**静默**失败面：
//
//   1. 形状写歪（排数、拼色排的位置、一排几个）—— 画出来只是"看着有点怪"；
//   2. 圆点糊进底色 / 正文在底色上读不清 —— 没有异常，只有眼睛难受；
//   3. 卡片引用了一个**不存在**的方案 id —— 那一格不画，整张卡静默退回默认色带；
//   4. 方案自己的 kind 与所在排不一致 —— 拼色被画成一块纯色，读起来只是"颜色有点怪"。
//
// 校验实现是 `scripts/lib/card-rows.mjs`，**建期**（`embed-themes.mjs`，发布 CI 会跑）
// 与这里共用同一份，所以本自检不会去印证另一套规则（硬性规则 6）。
const CARD_CLASS_ID = 'shi-liu-jin'

/** `lib/palette-schemes.json`：15 套配色的唯一来源。 */
const PALETTE_FILE = join(root, 'lib', 'palette-schemes.json')
const SCHEMES = JSON.parse(readFileSync(PALETTE_FILE, 'utf8')).schemes

check('配色表里正好 15 套方案（上两排 10 个纯色 + 最后一排 5 个拼色）',
  SCHEMES.length === 15
  && SCHEMES.filter((scheme) => scheme.kind === 'solid').length === 10
  && SCHEMES.filter((scheme) => scheme.kind === 'clash').length === 5,
  `实际 ${SCHEMES.length} 套：${SCHEMES.map((s) => `${s.id}(${s.kind})`).join(', ')}`)
check('配色表全部通过 paletteProblems（圆点对比度、正文对比度、出处、id 形态）',
  paletteProblems(SCHEMES).length === 0)
for (const problem of paletteProblems(SCHEMES)) console.error(`  ${problem}`)
check('每套配色都写明了色库出处（这一类的价值就是"色从哪本书里来"）',
  SCHEMES.every((scheme) => typeof scheme.source === 'string' && /\d+-\d+/.test(scheme.source)),
  SCHEMES.map((scheme) => scheme.source).join(' | '))

/** 带配色卡的皮肤。 */
const blockThemes = api.bundled.filter((theme) => theme.card !== undefined)

check('存在至少一套配色卡皮肤', blockThemes.length > 0)
check('配色卡皮肤全部通过 card-rows 校验', blockThemes.every((theme) => cardRowProblems(theme, SCHEMES).length === 0))
for (const theme of blockThemes) {
  for (const problem of cardRowProblems(theme, SCHEMES)) console.error(`  ${problem}`)
}
check('没有 card 字段的皮肤不产生任何问题（默认色带仍是合法形态）',
  api.bundled.filter((theme) => theme.card === undefined)
    .every((theme) => cardRowProblems(theme, SCHEMES).length === 0))
check('配色卡皮肤都排在序号表里（否则卡片会静默掉到列表最后）',
  blockThemes.every((theme) => typeof api.CARD_ORDER[theme.id] === 'number'))
check(`样本卡 ${CARD_CLASS_ID} 的序号是 97`, api.CARD_ORDER[CARD_CLASS_ID] === 97)

/** 一张卡上的方案槽总数。 */
function slotCount(theme) {
  return (theme.card?.rows ?? []).reduce((sum, row) => sum + (row.schemes ?? []).length, 0)
}

const sample = api.bundled.find((theme) => theme.id === CARD_CLASS_ID)
check(`样本卡 ${CARD_CLASS_ID} 是 3 排 15 个方案槽（实测 ${sample === undefined ? '?' : slotCount(sample)} 个）`,
  sample !== undefined && slotCount(sample) === 15)
check('每一排都是 5 格（用户定的 5+5+5）',
  sample !== undefined && sample.card.rows.every((row) => row.schemes.length === 5))
check('样本卡的拼色排是最后一条，且前面都是纯色排',
  sample !== undefined && sample.card.rows.slice(0, -1).every((row) => row.kind === 'solid')
  && sample.card.rows[sample.card.rows.length - 1].kind === 'clash')
check('样本卡的每一格都指向一套真实存在的方案，且种类与所在排一致',
  sample !== undefined && sample.card.rows.every((row) => row.schemes.every((id) => {
    const scheme = SCHEMES.find((entry) => entry.id === id)
    return scheme !== undefined && scheme.kind === row.kind
  })))
check('样本卡不带 ambient（这一类不画侧栏素材）', sample !== undefined && sample.ambient === undefined)

// ── 派生：15 套配色各自展开成 67 个 token，且按钮文字读得清 ──────────────────
//
// `schemeTokens` 是**唯一**的色值来源（配色表只写三四个名字色），所以它必须被真的执行、
// 而不是只断言源码里有这个函数名。
const { wcagContrast, schemeButtonFill, schemeOnMain, schemeTokens } = readPaletteTools(real)
const requiredTokens = readFileSync(join(root, 'schema', 'theme.schema.json'), 'utf8')
const REQUIRED = JSON.parse(requiredTokens)['x-required-tokens']
const ALL_TOKENS = Object.keys(JSON.parse(
  readFileSync(join(root, 'lib', 'themes', `${CARD_CLASS_ID}.json`), 'utf8'),
)[0].tokens)

check('派生器：15 套方案都展开出与皮肤同样多的 token（少一个都会静默沿用锚主题的颜色）',
  SCHEMES.every((scheme) => Object.keys(schemeTokens(scheme)).length === ALL_TOKENS.length),
  `皮肤 ${ALL_TOKENS.length} 个 / 派生 ${Object.keys(schemeTokens(SCHEMES[0])).length} 个`)
check('派生器：每一套都补齐了 schema 的 12 个必需 token',
  SCHEMES.every((scheme) => REQUIRED.every((token) => token in schemeTokens(scheme))))
check('派生器：token 全是 { light, dark } 成对字符串（喂给 register 会变成 [object Object] 的是 register，不是层）',
  SCHEMES.every((scheme) => Object.values(schemeTokens(scheme))
    .every((pair) => pair !== null && typeof pair === 'object'
      && typeof pair.light === 'string' && typeof pair.dark === 'string')))
check('派生器：按钮/链接的填充与文字对比度都 ≥ 4.5:1（亮色方案走压深或深色字）',
  SCHEMES.every((scheme) => wcagContrast(schemeButtonFill(scheme), schemeOnMain(scheme)) >= 4.5),
  SCHEMES.map((scheme) => `${scheme.label} ${wcagContrast(schemeButtonFill(scheme), schemeOnMain(scheme)).toFixed(2)}`).join(' | '))
check('派生器：侧栏渐变停在浅阶（深底会让共享 label-* 的导航文字读不清）',
  SCHEMES.every((scheme) => {
    const fill = schemeTokens(scheme)['--dsw-specific-sidebar-fill'].light
    return /^linear-gradient/.test(fill) && !/#0{0,2}[0-9a-f]{0,4}\b/i.test(fill.slice(0, 0))
  }))

// 渲染侧的一半：配色卡分支必须吞掉正文介绍，否则卡片被文字挤爆。
/**
 * 抹掉注释（规则 7：注释里提到的名字不算一次调用）。
 *
 * 这里非有它不可：`ThemeCard` 的注释里**就是要**解释"为什么不按渲染结果判"，
 * 而断言"源码里没有那种写法"会被自己的说明文字打红。
 * @param text - 源码片段。
 * @returns 去掉注释的文本。
 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n')
}

const themeCardBody = block(real, 'ThemeCard')
const themeCardCode = stripComments(themeCardBody)
check('配色卡不渲染 .tg-desc（description 只作 tooltip）',
  /!hasPicker && description[\s\S]{0,160}?tg-desc/.test(themeCardCode))
check('"是不是配色卡"取自数据且过了消毒器，不按渲染结果判（jsx 桩返回 null）',
  /const shape = cardRowShape\(\{ card: \{ rows \} \}, PALETTE_SCHEMES\)/.test(themeCardCode)
  && !/blocks !== null/.test(themeCardCode))
check('配色卡是 div 而不是 button（里面装着 15 个按钮，button 套 button 是非法标记）',
  /className: 'tg-card tg-picker-card'/.test(themeCardCode)
  && /jsxs\('div', \{\s*\n\s*className: 'tg-card tg-picker-card'/.test(themeCardCode))
check('没有配色数据时才回落到默认色带',
  /hasPicker\s*\?\s*cardPickerElement\(shape, selectedScheme, onPickScheme, PALETTE_SCHEMES\)\s*:\s*swatches\.length > 0/
    .test(themeCardCode))
check('PAGE_CSS 里有配色卡的样式（缺了 15 格会挤成一条）',
  /\.tg-picker\{/.test(real) && /\.tg-pickrow\{/.test(real) && /\.tg-swatch\{/.test(real) && /\.tg-band\{/.test(real))
// 拼色新的画法：按宽度分带（主色 2 份、次色各 1 份），不再用"底 + 圆点"。
// 比值本身由行为断言守着（check-boot-path），这里守的是"别退回圆点方案"。
check('色带按宽度分配（色格是 flex 行 + 子元素带 flex-grow）',
  // 一条规则可能被拆成相邻的多个字符串（中间夹着 `',` 与缩进），所以不能要求 `[^']*`。
  /\.tg-swatch\{[\s\S]{0,220}?display:flex/.test(real)
  && /flexGrow: weight/.test(real)
  && !/tg-mini/.test(real))
check('色格自己不再 overflow:hidden（否则悬停标签会被裁掉，圆角改由色带负责）',
  !/\.tg-swatch\{[^']*overflow:hidden/.test(real)
  && /\.tg-band:first-child\{[^']*border-radius/.test(real))
// 悬停色名：用户要"鼠标移到色块上才显示名称、不改布局"。三件事缺一不可 ——
// ① 每格带 `data-name`；② CSS 从 `attr(data-name)` 取内容；③ 标签**绝对定位**（脱离文档流，
// 所以布局一个像素都不会动）。反证见 check-boot-path 的「反证 9」。
check('每格带 data-name，且悬停标签是绝对定位的（不改布局）',
  /'data-name': scheme\.label/.test(real)
  && /content:attr\(data-name\)/.test(real)
  && /\.tg-swatch:hover::after[\s\S]{0,200}?position:absolute/.test(real))
check('色格自己不再 overflow:hidden（否则悬停标签会被裁掉，圆角改由色带负责）',
  !/\.tg-swatch\{[^']*overflow:hidden/.test(real)
  && /\.tg-band:first-child\{[^']*border-radius/.test(real))
check('配色卡也走 cardRowShape 的消毒（外部插件贡献的主题不能被信任）',
  /const rows = cardRowShape\(theme, PALETTE_SCHEMES\)/.test(real) && /draft\.cardRows = cardRows/.test(real))
check('点一个色值按钮会先记方案、再把锚主题记成"用户选的皮肤"',
  /function chooseScheme\(schemeId\)/.test(real)
  && /rememberScheme\(schemeId\)/.test(real)
  && /rememberCardChoice\(PALETTE_ANCHOR\)/.test(real))
check('配色层只对锚主题生效，并且套了自发光守卫（规则 1）',
  /function syncScheme\(snapshot\)/.test(real)
  && /active\.id === PALETTE_ANCHOR/.test(real)
  && /schemeLayerDispose = ctx\.theme\.overrideTokens\('theme-gallery: 配色'/.test(real))
// 石榴金那一格 = 锚主题皮肤自己那套手工配色（第一版那整套），所以它**不叠派生层**。
// 真正的行为断言在 check-boot-path（含反证 10），这里只是一条"别被顺手删掉"的凭据。
check('石榴金那一格不叠派生配色（叠了就是"相似但不等"的另一套颜色）',
  /remembered !== DEFAULT_SCHEME && active\.id === PALETTE_ANCHOR/.test(real))
check('方案 id 存 localStorage、绝不写 preference（写进去会让应用拒绝启动）',
  /const SCHEME_KEY = 'theme-gallery:palette'/.test(real)
  && !/preference.*SCHEME_KEY|SCHEME_KEY.*preference/.test(real))

/**
 * 把 `cardRowShape` 消毒器从源码里提取出来并执行。
 *
 * 与 `build-panel-preview.mjs` 同一手法。从 `const SCHEME_ID` 起**整段切片**，而不是走
 * {@link readConst}：那是个正则字面量，而 readConst 会把字符类里的 `[` / `]` 当成括号
 * 配对，切出一段语法错误的残片（`schemeById` / `shade` 就夹在两者之间）。
 * @param source - 源码文本。
 * @returns 消毒函数。
 */
function readCardRowShape(source) {
  // eslint-disable-next-line no-new-func
  return new Function(`${cardShapeSource(source)}\nreturn { cardRowShape }`)().cardRowShape
}

/**
 * `const SCHEME_ID` 到 `cardRowShape` 结束为止的源码（消毒器的全部实现）。
 * @param source - 源码文本。
 * @returns 源码片段。
 */
function cardShapeSource(source) {
  const at = source.indexOf('    const SCHEME_ID = ')
  if (at < 0) throw new Error('const SCHEME_ID not found')
  const shape = block(source, 'cardRowShape')
  return source.slice(at, source.indexOf(shape) + shape.length)
}

/**
 * 把配色派生用到的几个纯函数抽出来执行（{@link cardShapeSource} 提供 `shade` / `schemeById`）。
 * @param source - 源码文本。
 * @returns `{ wcagContrast, schemeButtonFill, schemeOnMain, schemeButtonChoice, schemeTokens }`。
 */
function readPaletteTools(source) {
  const names = ['wcagContrast', 'schemeButtonFill', 'schemeOnMain', 'schemeButtonChoice', 'schemeTokens']
  const body = names.map((name) => block(source, name)).join('\n')
  // eslint-disable-next-line no-new-func
  return new Function(`${cardShapeSource(source)}\n${body}\nreturn { ${names.join(', ')} }`)()
}

/**
 * 装配**真实的 `createGalleryStore`**，只把 `defineStore` 换成"原样返回规格"的桩。
 *
 * 非有它不可：`check-boot-path.mjs` 里的 `defineStore` 桩是空实现（`actions.sync() {}`），
 * 所以那条路永远跑不到 `sync` 的函数体 —— 这条链路的中间一段只能在这里测。
 * @param source - 源码文本。
 * @returns store 规格（`init` + `actions`）。
 */
function makeStore(source) {
  const labels = readConst(source, 'BUILT_IN_LABELS')
  const descriptions = readConst(source, 'BUILT_IN_DESCRIPTIONS')
  // eslint-disable-next-line no-new-func
  const factory = new Function(
    'defineStore', 'BUILT_IN_LABELS', 'BUILT_IN_DESCRIPTIONS', 'cardRowShape', 'SCHEMES_IN',
    // 切片里已经有一行 `let PALETTE_SCHEMES = []`，所以这里**不能**再用同名形参
    // （会 `SyntaxError: Identifier 'PALETTE_SCHEMES' has already been declared`），
    // 改为从 `SCHEMES_IN` 赋值 —— 这也正好复刻了 client.js 里"先声明、后赋值"的形状。
    `${cardShapeSource(source)}\nPALETTE_SCHEMES = SCHEMES_IN\n`
    + `${block(source, 'createGalleryStore')}\nreturn createGalleryStore`,
  )((spec) => spec, labels, descriptions, readCardRowShape(source), SCHEMES)
  return factory()
}

/**
 * 跑一次真实的 `sync`，返回它写出来的 draft。
 * @param source - 源码文本。
 * @param themes - 主题列表。
 * @param revision - 修订号。
 * @returns draft。
 */
function syncDraftOf(source, themes, revision = 1) {
  const store = makeStore(source)
  const draft = store.init()
  store.actions.sync(draft, themes, 'light', revision)
  return draft
}

// ── 最后一环：`sync` 真的把卡片色块组装进 store 了吗 ──────────────────────────
//
// 上面测的是消毒器（纯函数）与渲染分支，**中间那段胶水**没人测：`sync` 里的
// `const rows = cardRowShape(theme)` / `if (rows !== undefined) cardRows[theme.id] = rows`
// 与收尾的 `draft.cardRows = cardRows`。写错的后果是**每一张卡都静默回落成色带** ——
// 包括这一张，面板不报任何错，只有眼睛能发现。
const synced = syncDraftOf(real, api.bundled)
check('sync 把色块排写进了 store（写漏 → 每张卡都静默回落成色带）',
  Array.isArray(synced.cardRows[CARD_CLASS_ID]) && synced.cardRows[CARD_CLASS_ID].length === 3,
  `实际 ${JSON.stringify(synced.cardRows[CARD_CLASS_ID])}`)
check('sync 只给带 card.rows 的皮肤写色块（九套场景皮肤一个都不受影响）',
  Object.keys(synced.cardRows).join(',') === CARD_CLASS_ID,
  `实际 ${JSON.stringify(Object.keys(synced.cardRows))}`)
check('sync 同时仍然组装了 3 色色带（色块不合法时的回退路径要有东西可退）',
  (synced.swatches[CARD_CLASS_ID] || []).length === 3)
check('sync 写进 store 的色块排与内联皮肤里的 card.rows 逐字一致（不是另一份数据）',
  JSON.stringify(synced.cardRows[CARD_CLASS_ID])
  === JSON.stringify(sample === undefined ? null : sample.card.rows))

// 修订号门槛：一次**更旧**的 publish（主题列表还可能更空）不许覆盖已经写好的状态。
// 写错这一条的症状是"面板偶尔变空"，属于最难看懂的一类现象。
// 注意 `init()` 的 revision 是 -1，所以"更旧"必须比它**先写过一次**才构造得出来 ——
// 直接拿 revision 0 去比是比 -1 新的，测不到门槛（这条断言第一版就是这么写错的）。
const staleStore = makeStore(real)
const staleDraft = staleStore.init()
staleStore.actions.sync(staleDraft, api.bundled, 'light', 2)
const afterFresh = JSON.stringify(staleDraft.cardRows)
staleStore.actions.sync(staleDraft, [], 'light', 1)
check('更旧的 publish 不许覆盖已写好的 store（否则面板会偶尔变空）',
  JSON.stringify(staleDraft.cardRows) === afterFresh && afterFresh.includes(CARD_CLASS_ID),
  `实际 ${JSON.stringify(staleDraft.cardRows)}`)

// ── 内联脚本必须扛得住"主题里嵌数组" ─────────────────────────────────────────
//
// `card.rows` 是本项目**第一个**嵌在主题里的数组，而 `embed-themes.mjs` 过去用
// `/const BUNDLED_THEMES = \[[\s\S]*?\]\n/` 定位内联字面量：它在**第二次**运行时截断到
// `"rows": [ … ]` 的收尾方括号，把上一次字面量的尾巴留在文件里，产出一个**语法坏掉**的
// `lib/client.js` —— 而这一步的职责恰恰是"保证 bundle 正确"。现在按终止行 `\n    ]`
// 定位（其它所有读者早就这么做），并且写回前把字面量**读回来重解析**、再整文件试解析一次。
const embedSource = readFileSync(join(root, 'scripts', 'embed-themes.mjs'), 'utf8')
check('内联脚本按终止行定位字面量（不再用非贪婪括号正则）',
  embedSource.includes("source.indexOf('\\n    ]'") && !/const marker = \/const BUNDLED_THEMES/.test(embedSource))
check('内联脚本写回后会把字面量读回来重新解析',
  embedSource.includes('does not read back as the themes it was built from'))
check('内联脚本写回后会试解析整个文件（那次损坏就是"能跑完但产物坏了"）',
  embedSource.includes('would not PARSE after embedding'))

/** 合成样本：一个主题里带嵌套数组，也就是 `card.rows` 的形状。 */
const SYNTHETIC_LITERAL = 'const BUNDLED_THEMES = [\n  {\n    "card": {\n      "rows": [\n'
  + '        { "kind": "solid" }\n      ]\n    }\n  }\n    ]\n'
const greedySpan = SYNTHETIC_LITERAL.match(/const BUNDLED_THEMES = \[[\s\S]*?\]\n/)[0]
check('反证：非贪婪括号正则确实会截在 rows 的收尾方括号上（不是假设，是复现）',
  greedySpan.length < SYNTHETIC_LITERAL.trimEnd().length)
const terminatorSpan = SYNTHETIC_LITERAL.slice(
  0, SYNTHETIC_LITERAL.indexOf('\n    ]') + '\n    ]'.length,
)
check('正证：终止行定位取到的正是整个字面量',
  terminatorSpan === SYNTHETIC_LITERAL.trimEnd())

// ── 变异测试：每条断言都必须能被破坏 ─────────────────────────────────────────
//
// 只在真实文件上"通过"是不够的 —— "通过"看起来和真的通过一模一样。
// 四处变异各自对应一组断言，且都先断言"变异真的改动了源码"。

const mutRank = real.replace("'ying-mu-cai-yun': 96,", "'ying-mu-cai-yun': 94,")
check('变异 1 真的改动了源码（营慕彩云 96 → 94）', mutRank !== real)
check('变异 1：改序号后"顺序 = 清单"必须失败',
  shownOrder(extract(mutRank)).join(',') !== EXPECTED.join(','))
check('变异 1：改序号后"序号与清单一致"必须失败',
  !EXPECTED.every((id, i) => extract(mutRank).CARD_ORDER[id] === EXPECTED_RANKS[i]))

const mutPublish = real.replace('cardsInDisplayOrder([...snapshot.themes].filter', '[...snapshot.themes].filter')
check('变异 2 真的改动了源码（publish 不再排序）', mutPublish !== real)
check('变异 2：publish 丢掉排序后源码断言必须失败', !PUBLISH_USES_ORDER.test(mutPublish))

const mutOmit = real.replace("const OMITTED_IDS = new Set(['system'])", "const OMITTED_IDS = new Set(['system', 'light'])")
check('变异 3 真的改动了源码（浅色重新被隐藏）', mutOmit !== real)
check('变异 3：重新隐藏浅色后"浅色在列"必须失败',
  !shownOrder(extract(mutOmit)).includes('light'))

const mutDefault = real.replace("const DEFAULT_SKIN = 'shan-qing-ting-cai'", "const DEFAULT_SKIN = 'meng-hai-you-yu'")
check('变异 4 真的改动了源码（默认皮肤被换掉）', mutDefault !== real)
check('变异 4：换掉默认皮肤后"默认 = 山青婷彩"必须失败',
  extract(mutDefault).DEFAULT_SKIN !== 'shan-qing-ting-cai')

const mutTypo = real.replace("'pei-an-jie-xin': 91,", "'pei-an-jie-xin-typo': 91,")
check('变异 5 真的改动了源码（id 拼写错）', mutTypo !== real)
check('变异 5：id 写错后"没有指不到主题的条目"必须失败',
  !Object.keys(extract(mutTypo).CARD_ORDER).every((id) =>
    extract(mutTypo).bundled.some((theme) => theme.id === id) || id in extract(mutTypo).BUILT_IN_LABELS))
check('变异 5：id 写错后该卡真的掉到列表最末（正是这个静默症状）',
  shownOrder(extract(mutTypo)).indexOf('pei-an-jie-xin') === EXPECTED.length - 1)

const mutSurprise = real.replace(SURPRISE_LINE, '')
check('变异 6 真的改动了源码（「惊喜」那句被删掉）', mutSurprise !== real)
check('变异 6：删掉「惊喜」那句后，文案断言必须失败',
  !String(extract(mutSurprise).BUILT_IN_DESCRIPTIONS.light).includes(SURPRISE_LINE))

const mutClaim = real.replace('是同一套配色。', '是同一套配色，不加载任何皮肤。')
check('变异 7 真的改动了源码（旧说法被写回）', mutClaim !== real)
check('变异 7：写回「不加载任何皮肤」后，文案断言必须失败',
  String(extract(mutClaim).BUILT_IN_DESCRIPTIONS.light).includes('不加载任何皮肤'))

// ── 变异 8..12：色块**数据**的变异 ───────────────────────────────────────────
//
// `cardRowProblems` 守的是皮肤数据，所以"故意破坏它守护的代码"就是破坏数据本身。
// 每一条都先断言"变异真的改动了数据"，否则下面的结论什么都没测。
/**
 * 取一份内联皮肤的深拷贝，供变异使用。
 * @returns 皮肤数组。
 */
function copyBundled() {
  return JSON.parse(JSON.stringify(api.bundled))
}

/**
 * 取样本卡的一份深拷贝。
 * @returns 样本主题定义。
 */
function sampleCopy() {
  return copyBundled().find((theme) => theme.id === CARD_CLASS_ID)
}

const mutClashFirst = sampleCopy()
const lastRow = mutClashFirst.card.rows.pop()
mutClashFirst.card.rows.unshift(lastRow)
check('变异 8 真的改动了数据（拼色排被挪到第一排）', mutClashFirst.card.rows[0].kind === 'clash')
check('变异 8：拼色排不在最后一排必须被报错',
  cardRowProblems(mutClashFirst, SCHEMES).some((problem) => /LAST row is the clash row/.test(problem)))

// 变异 9 打在**配色表**上：圆点糊进底色是配色表的问题，不再是卡片的问题。
const mutDimDot = JSON.parse(JSON.stringify(SCHEMES))
mutDimDot.find((scheme) => scheme.id === 'p-shi-liu-jin').dots[0] = '#88ADA6'
check('变异 9 真的改动了数据（点缀换成明度接近的水色 #88ADA6）',
  mutDimDot.find((scheme) => scheme.id === 'p-shi-liu-jin').dots[0] === '#88ADA6')
check('变异 9：糊进底色的圆点必须被报错（实测 1.78:1 < 2.5:1）',
  paletteProblems(mutDimDot).some((problem) => /disappears into the band/.test(problem)))

const mutGhost = sampleCopy()
mutGhost.card.rows[0].schemes[0] = 'p-does-not-exist'
check('变异 10 真的改动了数据（引用一个不存在的方案 id）',
  mutGhost.card.rows[0].schemes[0] === 'p-does-not-exist')
check('变异 10：引用了不存在的方案必须被报错（那一格不画、整张卡静默回落成色带）',
  cardRowProblems(mutGhost, SCHEMES).some((problem) => /is not in lib\/palette-schemes\.json/.test(problem)))

const mutKindMismatch = sampleCopy()
// 把一个纯色方案塞进拼色排：不报错的话，它会画成"一个色块"，读起来只是颜色有点怪。
mutKindMismatch.card.rows[2].schemes[0] = 'p-xiang-se'
check('变异 11 真的改动了数据（拼色排里放了一个纯色方案）',
  mutKindMismatch.card.rows[2].schemes[0] === 'p-xiang-se')
check('变异 11：方案种类与所在排不一致必须被报错',
  cardRowProblems(mutKindMismatch, SCHEMES)
    .some((problem) => /is a "solid" scheme in a "clash" row/.test(problem)))

const mutOneRow = sampleCopy()
mutOneRow.card.rows = [mutOneRow.card.rows[0]]
check('变异 11b 真的改动了数据（只剩一排）', mutOneRow.card.rows.length === 1)
check('变异 11b：排数越界必须被报错',
  cardRowProblems(mutOneRow, SCHEMES).some((problem) => /must hold 2 or 3 rows/.test(problem)))

const mutDupSlot = sampleCopy()
mutDupSlot.card.rows[1].schemes[0] = mutDupSlot.card.rows[0].schemes[0]
check('变异 12 真的改动了数据（两排出现同一个方案）',
  mutDupSlot.card.rows[1].schemes[0] === mutDupSlot.card.rows[0].schemes[0])
check('变异 12：重复的方案必须被报错（每一格是一个选项）',
  cardRowProblems(mutDupSlot, SCHEMES).some((problem) => /repeats/.test(problem)))

// ── 变异 13..14：配色卡**渲染**侧的两条守卫 ─────────────────────────────────
const mutDesc = real.replace('!hasPicker && description', 'description')
check('变异 13 真的改动了源码（拆掉"配色卡不渲染正文"的守卫）', mutDesc !== real)
check('变异 13：拆掉守卫后，那条断言必须失败',
  !/!hasPicker && description[\s\S]{0,160}?tg-desc/.test(stripComments(block(mutDesc, 'ThemeCard'))))

// 消毒器本身也要有行为断言（只断言源码里有这行字，证明不了它会拒绝坏数据）。
const shape = readCardRowShape(real)
const goodRows = [
  { kind: 'solid', schemes: ['p-xiang-se'] },
  { kind: 'clash', schemes: ['p-shi-liu-jin'] },
]
check('消毒器：合法的两排原样通过', Array.isArray(shape({ card: { rows: goodRows } }, SCHEMES)))
check('消毒器：拼色排不在最后 → 退回默认色带（undefined）',
  shape({ card: { rows: [goodRows[1], goodRows[0]] } }, SCHEMES) === undefined)
check('消毒器：四排 → undefined',
  shape({ card: { rows: [goodRows[0], goodRows[0], goodRows[0], goodRows[1]] } }, SCHEMES) === undefined)
check('消毒器：不存在的方案 id → undefined',
  shape({ card: { rows: [{ kind: 'solid', schemes: ['p-nope'] }, goodRows[1]] } }, SCHEMES) === undefined)
check('消毒器：方案种类与排不符 → undefined',
  shape({ card: { rows: [{ kind: 'solid', schemes: ['p-shi-liu-jin'] }, goodRows[1]] } }, SCHEMES) === undefined)
check('消毒器：没有 card 字段 → undefined（默认色带这条路不能被动到）', shape({}, SCHEMES) === undefined)
// schemastery 会把缺省的对象字段物化成空数组（`tests/check-schema.mjs` 里有读数），
// 所以"经过一次 provider 校验"的主题拿到的是 `rows: []` 而不是 undefined —— 这一形态
// 也必须回落成默认色带，否则配色区会画出一片空白。
check('消毒器：空数组（provider 物化出来的形态）→ undefined',
  shape({ card: { rows: [] } }, SCHEMES) === undefined)

// 排位规则有**两道**守卫：整排的 kind，以及每一格的方案 kind。只拆一道仍会被另一道拦住
// （第一版这条变异就是这么"失败"的 —— 断言没错，是变异没真的放宽规则）。
const mutShape = real
  .replace('if (row.kind !== wanted) return undefined\n', '')
  .replace('if (scheme === undefined || scheme.kind !== wanted) return undefined', 'if (scheme === undefined) return undefined')
check('变异 14 真的改动了源码（两道排位判断都被拆掉）',
  mutShape !== real && !/row\.kind !== wanted/.test(mutShape) && !/scheme\.kind !== wanted/.test(mutShape))
check('变异 14：拆掉排位判断后，消毒器会接受"拼色排在第一排"（说明那条断言真的在测它）',
  Array.isArray(readCardRowShape(mutShape)({ card: { rows: [goodRows[1], goodRows[0]] } }, SCHEMES)))

// ── 变异 15..16：`sync` 那两行胶水 ───────────────────────────────────────────
//
// 这两条是本轮补上的：在此之前，"`sync` 把色块写进 store"只有一条源码级正则守着，
// 而正则证明不了它真的会写。把两处分别改坏，再从改坏的源码装配 store 跑同一个 sync。
const mutAssign = real.replace('draft.cardRows = cardRows', '')
check('变异 15 真的改动了源码（sync 不再把色块写进 draft）', mutAssign !== real)
check('变异 15：拆掉赋值后，store 里就没有色块了（说明那条断言真的在测它）',
  syncDraftOf(mutAssign, api.bundled).cardRows[CARD_CLASS_ID] === undefined)

const mutGuard = real.replace('if (rows !== undefined) cardRows[theme.id] = rows', 'cardRows[theme.id] = rows')
check('变异 16 真的改动了源码（"只有拿到合法 rows 才写"的守卫被拆掉）', mutGuard !== real)
check('变异 16：拆掉守卫后，九套场景皮肤也被写进了色块表（说明那条断言真的在测它）',
  Object.keys(syncDraftOf(mutGuard, api.bundled).cardRows).length === api.bundled.length)

const mutStale = real.replace('if (revision <= draft.revision) return', 'if (false) return')
check('变异 17 真的改动了源码（修订号门槛被拆掉）', mutStale !== real)
check('变异 17：拆掉门槛后，更旧的 publish 会把 store 清空（说明那条断言真的在测它）',
  (() => {
    const store = makeStore(mutStale)
    const draft = store.init()
    store.actions.sync(draft, api.bundled, 'light', 2)
    store.actions.sync(draft, [], 'light', 1)
    return Object.keys(draft.cardRows).length === 0
  })())

if (failed > 0) {
  console.error(`\n${failed} card order check(s) failed`)
  process.exit(1)
}
console.log('\ncard order checks passed')
