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
  'light', 'dark', 'ying-mu-cai-yun', 'shan-qing-ting-cai',
  'pei-an-jie-xin', 'meng-hai-you-yu', 'hu-po-mao-mi', 'hu-zi-a-huang',
]

/** 与 {@link EXPECTED} 一一对应的序号。 */
const EXPECTED_RANKS = [99, 98, 96, 95, 91, 80, 76, 75]

/** 内联皮肤数组的注册顺序（= embed 的字母序），发布顺序的断言在 check-theme-contribution。 */
const ALPHA_ORDER = 'hu-po-mao-mi,hu-zi-a-huang,meng-hai-you-yu,'
  + 'pei-an-jie-xin,shan-qing-ting-cai,ying-mu-cai-yun'

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

if (failed > 0) {
  console.error(`\n${failed} card order check(s) failed`)
  process.exit(1)
}
console.log('\ncard order checks passed')
