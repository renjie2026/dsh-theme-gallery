/**
 * Exercise the theme-contribution logic against a stand-in for the official
 * theme service.
 *
 * The page reports "正在读取官方主题注册表…" — the empty state — with no status
 * line. That combination means `publish()` ran with `bound` set and an empty
 * registry, and `contribute()` neither registered anything nor threw. Two
 * possibilities remain, and they are indistinguishable from the outside:
 *
 *   a) `contribute()` never ran;
 *   b) it ran but `ctx.theme.getTheme()` does not return what this code assumes.
 *
 * (b) is testable here. This mirrors the contribution loop and the idempotency
 * guard exactly, against a fake service that behaves the way the official one
 * documents, so a wrong assumption about the snapshot shape fails loudly.
 *
 * Run with: node tests/check-theme-contribution.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

let failed = 0

/**
 * Assert one condition.
 * @param label - what is being checked.
 * @param condition - the result.
 */
function check(label, condition) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
}

/**
 * Read the inlined theme array out of the bundle.
 *
 * The bundle itself cannot be imported (it calls `window.__ModuleLoader__.load`
 * at evaluation time), so its literal is evaluated in isolation.
 * @returns the bundled theme definitions.
 */
function readBundledThemes() {
  const at = source.indexOf('const BUNDLED_THEMES = ')
  if (at < 0) return null
  const from = at + 'const BUNDLED_THEMES = '.length
  // The literal is a JSON array; take it up to the line that closes it at indent 4.
  const end = source.indexOf('\n    ]', from)
  const literal = source.slice(from, end + '\n    ]'.length)
  // eslint-disable-next-line no-eval
  return eval(literal)
}

const bundled = readBundledThemes()
check('the bundle carries an inlined theme array', Array.isArray(bundled))
check('the bundle carries exactly the six published project themes', Array.isArray(bundled) && bundled.length === 6)
if (Array.isArray(bundled)) {
  check('every bundled theme has an id', bundled.every((theme) => typeof theme.id === 'string' && theme.id !== ''))
  check('every bundled theme has tokens', bundled.every((theme) => theme.tokens !== undefined && Object.keys(theme.tokens).length > 0))
}

/**
 * A stand-in for the official theme service, mirroring the documented contract:
 * `getTheme()` returns a frozen snapshot carrying `themes`, and `register()`
 * throws on a duplicate id.
 * @param seed - themes already in the registry.
 * @returns the fake service plus its register log.
 */
function fakeThemeService(seed = []) {
  const themes = [...seed]
  const registered = []
  return {
    registered,
    get themes() { return themes },
    getTheme() {
      return { preference: 'system', themes: Object.freeze([...themes]), active: themes[0], revision: 0 }
    },
    register(definition) {
      if (themes.some((theme) => theme.id === definition.id)) {
        throw new Error(`theme "${definition.id}" is already registered`)
      }
      themes.push(definition)
      registered.push(definition.id)
      return () => {
        const at = themes.findIndex((theme) => theme.id === definition.id)
        if (at >= 0) themes.splice(at, 1)
      }
    },
  }
}

/**
 * Resolve a bundled theme into the shape `register` consumes.
 *
 * `register()` stores a definition BY REFERENCE and `composeActive()` passes it
 * through untouched when no override layer is stacked, so the `{ light, dark }`
 * pair format belongs to `overrideTokens` layers only. Feeding pairs to
 * `register` writes the literal `[object Object]` into the CSS variables — a
 * theme that selects, reports the right id and token count, and paints nothing.
 * @param definition - a bundled theme with `{ light, dark }` token pairs.
 * @returns the registrable definition, with string token values.
 */
function flatten(definition) {
  const tokens = {}
  for (const [name, value] of Object.entries(definition.tokens ?? {})) {
    tokens[name] = typeof value === 'string' ? value : value[definition.colorScheme]
  }
  return { ...definition, tokens }
}

/**
 * The contribution loop exactly as lib/client.js writes it, flattening included.
 * @param theme - the theme service stand-in.
 * @param contributed - the idempotency set.
 * @returns how many registrations this call performed.
 */
function contribute(theme, contributed) {
  const known = new Set(theme.getTheme().themes.map((entry) => entry.id))
  let added = 0
  for (const definition of bundled) {
    if (contributed.has(definition.id)) continue
    contributed.add(definition.id)
    if (known.has(definition.id)) continue
    theme.register(flatten(definition))
    added += 1
  }
  return added
}

const service = fakeThemeService()
const contributed = new Set()

check('first contribution registers all six themes', contribute(service, contributed) === 6)
check('the registry now lists all six', service.getTheme().themes.length === 6)
check('the ids are the project themes',
  service.registered.join(',') === 'hu-po-mao-mi,hu-zi-a-huang,meng-hai-you-yu,'
    + 'pei-an-jie-xin,shan-qing-ting-cai,ying-mu-cai-yun')
check('a second contribution is a no-op (no duplicate throw)', contribute(service, contributed) === 0)
check('the registry is unchanged after the second pass', service.getTheme().themes.length === 6)

// The regression this test now exists for: every registered token must be a
// STRING. Object values reach CSS as "[object Object]", which paints nothing
// while every other signal (id, token count, selection) still looks correct.
const objectTokens = []
for (const theme of service.getTheme().themes) {
  for (const [name, value] of Object.entries(theme.tokens ?? {})) {
    if (typeof value !== 'string') objectTokens.push(`${theme.id}:${name}=${typeof value}`)
  }
}
check(
  'every registered token value is a string (else it reaches CSS as [object Object])',
  objectTokens.length === 0,
)
if (objectTokens.length > 0) console.error(`  non-string tokens: ${objectTokens.slice(0, 5).join(', ')}`)

// The authoring format stays pairs; flatten() is what converts them at the
// registration boundary.
check(
  'the bundled authoring format is { light, dark } pairs',
  bundled.every((theme) => Object.values(theme.tokens ?? {}).every((value) =>
    typeof value === 'string'
    || (value !== null && typeof value === 'object' && 'light' in value && 'dark' in value))),
)
check(
  'flattening picks the value for the theme colorScheme',
  flatten({ colorScheme: 'dark', tokens: { '--x': { light: 'L', dark: 'D' } } }).tokens['--x'] === 'D',
)

// A registry seeded by another provider keeps its entry and skips ours.
const seeded = fakeThemeService([{ id: 'shan-qing-ting-cai', colorScheme: 'light', tokens: {} }])
const contributed2 = new Set()
contribute(seeded, contributed2)
check('an id another provider already owns is not re-registered',
  seeded.registered.join(',') === 'hu-po-mao-mi,hu-zi-a-huang,meng-hai-you-yu,'
    + 'pei-an-jie-xin,ying-mu-cai-yun')
check('the foreign theme stays in the registry', seeded.getTheme().themes.some((theme) => theme.id === 'shan-qing-ting-cai'))

if (failed > 0) {
  console.error(`\n${failed} theme contribution check(s) failed`)
  process.exit(1)
}
console.log('\ntheme contribution checks passed')
