/**
 * Resolve the bundled themes through the real schemastery schemas, then confirm
 * the schemas actually reject malformed input.
 *
 * The negative cases are the point of this file: a schema that accepts everything
 * passes a positive-only check, and an early version of this project shipped a
 * validator that silently accepted a theme with no `label` because schemastery
 * treats object members as optional unless `.required()` is explicit.
 *
 * Run with: node tests/check-schema.mjs
 */
import z from '@deepseek-ai/schemastery'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const themesDir = join(root, 'lib', 'themes')

const themes = []
for (const file of readdirSync(themesDir).filter((name) => name.endsWith('.json')).sort()) {
  themes.push(...JSON.parse(readFileSync(join(themesDir, file), 'utf8')))
}

const TokenModes = z.object({ light: z.string().required(), dark: z.string().required() })
const Reading = z.object({
  colorScheme: z.union(['light', 'dark']).required(),
  bg: z.string().required(),
  alpha: z.number().required().min(0).max(1),
  blur: z.number().required().min(0).max(40),
  maxWidth: z.number().required().min(320).max(1600),
})
/**
 * 卡片的配色选择器（纯色/拼色 一类），与 `types/index.ts` 的 `CardSchema` 同形。
 *
 * 跨字段规则（最后一排必须是拼色、一排几个、引用的方案必须存在、方案种类要与排一致、
 * 圆点相对底色的对比度、正文在底色上的对比度）**不在这里**：它们只有一份实现，在
 * `scripts/lib/card-rows.mjs`。这里只管"这个字段会不会在解析时消失"。
 */
const CardRow = z.object({
  kind: z.union(['solid', 'clash']).required(),
  schemes: z.array(z.string()),
})
// `rows` **故意不写 `.required()`**：见下面那条"可选对象里的必填字段"的实测对照 ——
// 写了它，`card` 就从可选变成事实上的必填，九套没有 `card` 的皮肤会被一起拒绝。
const Card = z.object({ rows: z.array(CardRow) })
const Theme = z.object({
  id: z.string().required().pattern(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().required(),
  description: z.string().required(),
  colorScheme: z.union(['light', 'dark']).required(),
  tokens: z.dict(TokenModes).required(),
  reading: Reading,
  card: Card,
})
const Gallery = z.object({ themes: z.array(Theme) })

let failed = 0

/**
 * Resolve a value, reporting whether the schema rejected it.
 *
 * schemastery's `resolve` **throws** a ValidationError on invalid input; the
 * `[value, adaptedInput?]` second element is an adaptation hint, not a failure
 * flag. Callers that must not throw catch it.
 * @param value - candidate to validate.
 * @param schema - schema to validate against.
 * @returns true when the schema rejected the value.
 */
function rejects(value, schema) {
  try {
    z.resolve(value, schema, {}, true)
    return false
  } catch {
    return true
  }
}

/** A minimal theme that must be accepted; negative cases are mutations of it. */
const good = {
  id: 'demo',
  label: 'Demo',
  description: 'A demo theme',
  colorScheme: 'light',
  tokens: {
    '--dsw-alias-bg-base': { light: '#fff', dark: '#000' },
    '--dsw-specific-sidebar-fill': { light: 'linear-gradient(#fff,#eee)', dark: 'linear-gradient(#000,#111)' },
  },
  reading: { colorScheme: 'light', bg: '#ffffff', alpha: 0.62, blur: 3, maxWidth: 640 },
}

for (const theme of themes) {
  const rejected = rejects(theme, Theme)
  if (rejected) failed += 1
  console.log(`bundled ${theme.id}: ${rejected ? 'REJECTED — bundled file is invalid!' : 'OK'}`)
}

const sectionRejected = rejects({ themes }, Gallery)
console.log(`section with ${themes.length} themes: ${sectionRejected ? 'REJECTED' : 'OK'}`)
if (sectionRejected) failed += 1

console.log(`\ncontrol (${good.id}): ${rejects(good, Theme) ? 'REJECTED — schema too strict!' : 'accepted OK'}`)
if (rejects(good, Theme)) failed += 1

// ── card.rows 必须"活着穿过"解析 ─────────────────────────────────────────────
//
// 不是形式主义：schemastery 对**没在 schema 里声明**的键是直接**丢弃**（下面那条
// 合成对照就是实测），所以一个只写在皮肤 JSON 里、忘了写进 schema 的字段，经过一次
// provider 校验就会悄悄消失 —— 卡片回落成默认色带，没有报错，只是"样式不一样了"。
// 这正是本项目最贵的那类失败，所以两个方向都测：声明过的必须留下、说明白地丢弃别的。
const extraDropped = (() => {
  const [value] = z.resolve({ ...good, definitelyNotADeclaredField: 1 }, Theme, {}, true)
  return value !== undefined && !('definitelyNotADeclaredField' in value)
})()
console.log(`control: an UNDECLARED field is dropped by resolution: ${extraDropped ? 'yes (mechanism confirmed)' : 'NO'}`)
if (!extraDropped) failed += 1

// ── 同一个机制的另一面：可选对象里的 `.required()` 会让**外层**变成必填 ────────
//
// 这不是猜测，是本次实测出来的读数：`z.object({ ambient: z.object({ kind: X.required() }) })`
// 解析 `{}` 会**抛** `$.ambient.kind missing required value`；把内层改成非必填，同样的输入
// 得到 `{"ambient":{}}`。也就是说"外层可选 + 内层必填"在 schemastery 里**表达不出来**，
// 而它会静默地把一个合法主题判为非法 —— 本项目已经有过一次同族事故（缺 `label` 的主题
// 被接受），这里把它连同读数一起钉住。
const innerRequired = z.object({ outer: z.object({ inner: z.string().required() }) })
const innerOptional = z.object({ outer: z.object({ inner: z.string() }) })
const rejectsEmpty = rejects({}, innerRequired)
const acceptsEmpty = !rejects({}, innerOptional)
console.log(`control: required() INSIDE an optional object rejects {}: ${rejectsEmpty ? 'yes (outer becomes required)' : 'NO'}`)
console.log(`control: dropping that required() accepts {}: ${acceptsEmpty ? 'yes' : 'NO'}`)
if (!rejectsEmpty || !acceptsEmpty) failed += 1

const withCard = {
  ...good,
  card: {
    rows: [
      { kind: 'solid', schemes: ['p-xiang-se', 'p-ju-huang'] },
      { kind: 'clash', schemes: ['p-shi-liu-jin'] },
    ],
  },
}
const [resolvedCard] = z.resolve(withCard, Theme, {}, true)
const cardSurvives = resolvedCard?.card?.rows?.length === 2
console.log(`card.rows survives resolution: ${cardSurvives ? 'yes (2 rows kept)' : 'NO — declared but dropped!'}`)
if (!cardSurvives) failed += 1

// 注意：schemastery 会把**缺省的对象字段物化**出来 —— 实测 `{}` → `{"card":{"rows":[]}}`，
// 即没有 card 的主题解析后带的是一个**空数组**，而不是 undefined。所以判据是"没有可画的排"，
// 而客户端对空数组正是回落成默认色带（`cardRowShape` 要求 2–3 排），两种形态都安全。
// 这条回落由 `tests/check-card-order.mjs` 的消毒器行为断言真的跑一遍来确认。
const noCard = z.resolve({ ...good }, Theme, {}, true)[0]
const noCardRows = noCard?.card?.rows
const cardStaysOptional = noCard !== undefined && Array.isArray(noCardRows) && noCardRows.length === 0
console.log(`a theme without card.rows still resolves (materialised as [], which the client treats as "no blocks"): ${cardStaysOptional ? 'yes' : 'NO'}`)
if (!cardStaysOptional) failed += 1

// Negative controls: each of these must be rejected.
const badCases = [
  { why: 'id has uppercase', value: { ...good, id: 'Bad' } },
  { why: 'label missing', value: { ...good, label: undefined } },
  { why: 'description missing', value: { ...good, description: undefined } },
  { why: 'colorScheme invalid', value: { ...good, colorScheme: 'blue' } },
  { why: 'tokens missing', value: { ...good, tokens: undefined } },
  { why: 'token modes not a pair', value: { ...good, tokens: { '--dsw-alias-bg-base': '#fff' } } },
  { why: 'token mode missing dark', value: { ...good, tokens: { '--dsw-alias-bg-base': { light: '#fff' } } } },
  { why: 'reading.alpha out of range', value: { ...good, reading: { ...good.reading, alpha: 1.5 } } },
  { why: 'reading.maxWidth too small', value: { ...good, reading: { ...good.reading, maxWidth: 100 } } },
  { why: 'reading.colorScheme invalid', value: { ...good, reading: { ...good.reading, colorScheme: 'auto' } } },
  { why: 'card.rows is not an array', value: { ...good, card: { rows: 'two rows please' } } },
  { why: 'card.rows row kind is unknown', value: { ...good, card: { rows: [{ kind: 'gradient', schemes: ['p-xiang-se'] }] } } },
  { why: 'card.rows schemes is not an array', value: { ...good, card: { rows: [{ kind: 'solid', schemes: 'p-xiang-se' }] } } },
]
for (const { why, value } of badCases) {
  const rejected = rejects(value, Theme)
  if (!rejected) failed += 1
  console.log(`negative (${why}): ${rejected ? 'rejected OK' : 'ACCEPTED — schema too loose!'}`)
}

if (failed > 0) {
  console.error(`\n${failed} schema check(s) failed`)
  process.exit(1)
}
console.log('\nall schema checks passed')
