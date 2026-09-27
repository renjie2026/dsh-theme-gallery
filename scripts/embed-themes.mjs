#!/usr/bin/env node
/**
 * Validate the bundled theme files and inline them into lib/client.js.
 *
 * The browser half cannot read `lib/themes/*.json` at runtime: a settings scope
 * returns the *user document* section, and the bundled list is a fallback below
 * it, so an untouched install resolves to no section at all. The host half does
 * not read them either — themes become real only in the browser. So the files
 * are validated here, at build time, and baked into the client bundle.
 *
 * Checks, in order:
 *   1. every file is a JSON array of themes;
 *   2. ids are unique across all files;
 *   3. shape, id pattern, colorScheme and per-token { light, dark } pairs are valid;
 *   4. every required token from schema/theme.schema.json is present;
 *   5. `card.rows` (the colour-block card layout), when a theme declares one.
 *
 * Run after editing any file in lib/themes/:
 *   node scripts/embed-themes.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cardRowProblems, paletteProblems } from './lib/card-rows.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const themesDir = join(root, 'lib', 'themes')
const clientPath = join(root, 'lib', 'client.js')
const schemaPath = join(root, 'schema', 'theme.schema.json')

/**
 * Token prefixes an override key may carry.
 *
 * `--dsw-alias-*` is the semantic alias layer. `--dsw-specific-*` is the
 * companion layer the shell reads for surfaces the alias layer cannot express —
 * notably `--dsw-specific-sidebar-fill`, which paints the sidebar column and the
 * Windows caption row, and is therefore how a theme covers the screen with a
 * gradient instead of a flat colour.
 */
const TOKEN_PREFIXES = ['--dsw-alias-', '--dsw-specific-']
const problems = []

/**
 * Scenery the plugin ships artwork for.
 *
 * The value is a data key, not a file: `lib/client.js` renders each kind from
 * inline SVG ported from the source admin system, so a theme can only ask for a
 * scene that exists. Keeping the list here means a typo fails the build instead of
 * silently drawing nothing at runtime.
 */
const AMBIENT_KINDS = ['shan', 'dream', 'caiyun', 'dongyun', 'junyue', 'jiexin', 'fengchen', 'humao', 'ahuang']

/**
 * Validated ranges for each scene's seed-count option.
 *
 * Each kind names its own count knob (petals for shan, stars for caiyun and
 * junyue, …); a count outside its range fails the build instead of silently
 * seeding nothing or flooding the band at runtime.
 */
const AMBIENT_COUNTS = {
  petals: [0, 20],
  bubbles: [0, 24],
  motes: [0, 24],
  fish: [0, 6],
  stars: [0, 30],
  snow: [0, 30],
  dust: [0, 20],
  feathers: [0, 16],
  dew: [0, 30],
}

/**
 * Record one validation failure.
 * @param where - file (and theme id) the failure came from.
 * @param message - what is wrong.
 */
function fail(where, message) {
  problems.push(`${where}: ${message}`)
}

/**
 * Validate one theme definition.
 * @param theme - parsed candidate.
 * @param where - diagnostic prefix.
 * @param required - required token names from the JSON Schema.
 */
function checkTheme(theme, where, required) {
  if (typeof theme !== 'object' || theme === null) return fail(where, 'entry is not an object')
  if (typeof theme.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(theme.id)) {
    return fail(where, 'id must be lowercase letters, digits and dashes')
  }
  if (theme.id === 'system') fail(where, 'id "system" is reserved for the preference')
  if (typeof theme.label !== 'string' || theme.label === '') fail(where, 'label must be a non-empty string')
  if (theme.colorScheme !== 'light' && theme.colorScheme !== 'dark') {
    fail(where, 'colorScheme must be "light" or "dark"')
  }
  if (typeof theme.tokens !== 'object' || theme.tokens === null) return fail(where, 'tokens must be an object')
  for (const [token, mode] of Object.entries(theme.tokens)) {
    if (!TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))) {
      fail(where, `token "${token}" must start with ${TOKEN_PREFIXES.join(' or ')}`)
    }
    if (typeof mode !== 'object' || mode === null || typeof mode.light !== 'string' || typeof mode.dark !== 'string') {
      fail(where, `token "${token}" must be a { light, dark } pair of strings`)
    }
  }
  if (theme.reading !== undefined) {
    const r = theme.reading
    if (typeof r !== 'object' || r === null) fail(where, 'reading must be an object')
    else {
      if (r.colorScheme !== 'light' && r.colorScheme !== 'dark') fail(where, 'reading.colorScheme must be "light" or "dark"')
      if (typeof r.bg !== 'string') fail(where, 'reading.bg must be a string')
      if (typeof r.alpha !== 'number' || r.alpha < 0 || r.alpha > 1) fail(where, 'reading.alpha must be a number in 0..1')
      if (typeof r.blur !== 'number' || r.blur < 0) fail(where, 'reading.blur must be a non-negative number')
      if (typeof r.maxWidth !== 'number' || r.maxWidth < 320) fail(where, 'reading.maxWidth must be a number >= 320')
    }
  }
  if (theme.accent !== undefined) {
    // A marker colour is composed with an alpha suffix ("#E88BB029"), so it must
    // be a hex literal — an rgba() or var() would produce invalid CSS once
    // concatenated.
    if (typeof theme.accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(theme.accent)) {
      fail(where, 'accent must be a 6-digit hex colour (it is composed with an alpha suffix)')
    }
  }
  if (theme.ambient !== undefined) {
    const a = theme.ambient
    if (typeof a !== 'object' || a === null) fail(where, 'ambient must be an object')
    else {
      if (!AMBIENT_KINDS.includes(a.kind)) {
        fail(where, `ambient.kind must be one of ${AMBIENT_KINDS.join(', ')} (only these have ported artwork)`)
      }
      for (const [field, [min, max]] of Object.entries(AMBIENT_COUNTS)) {
        if (a[field] !== undefined && (!Number.isInteger(a[field]) || a[field] < min || a[field] > max)) {
          fail(where, `ambient.${field} must be an integer in ${min}..${max}`)
        }
      }
    }
  }
  if (theme.card !== undefined) {
    // The colour-block card layout. The rules (and why each one is a silent
    // failure if unchecked) live in `scripts/lib/card-rows.mjs`, which
    // `tests/check-card-order.mjs` also drives — one implementation, so the
    // self-test cannot end up validating a different rule set than the build.
    for (const problem of cardRowProblems(theme, schemes)) problems.push(problem)
  }
  const missing = required.filter((token) => !(token in theme.tokens))
  if (missing.length > 0) {
    fail(where, `missing ${missing.length} required token(s): ${missing.join(', ')}`)
  }
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const required = schema['x-required-tokens']
if (!Array.isArray(required) || required.length === 0) {
  throw new Error(`${schemaPath}: x-required-tokens is missing or empty`)
}

// ── 15 套「纯色/拼色」配色（不是主题）─────────────────────────────────────────
//
// 它们不注册进主题服务，但卡片上的 15 个按钮就指着它们 —— 所以这里先校验、再内联。
// 校验与前一条同源：`card-rows.mjs` 里的 `paletteProblems`。
const palettePath = join(root, 'lib', 'palette-schemes.json')
const paletteRaw = JSON.parse(readFileSync(palettePath, 'utf8'))
const schemes = paletteRaw?.schemes
for (const problem of paletteProblems(schemes)) problems.push(`lib/palette-schemes.json: ${problem}`)

const files = readdirSync(themesDir).filter((name) => name.endsWith('.json')).sort()
const themes = []
const seen = new Map()
for (const file of files) {
  const parsed = JSON.parse(readFileSync(join(themesDir, file), 'utf8'))
  if (!Array.isArray(parsed)) {
    fail(file, 'expected a top-level array of themes')
    continue
  }
  for (const theme of parsed) {
    const where = `${file}${theme && theme.id ? `#${theme.id}` : ''}`
    checkTheme(theme, where, required)
    if (theme && typeof theme.id === 'string') {
      if (seen.has(theme.id)) fail(where, `duplicate theme id, already defined in ${seen.get(theme.id)}`)
      else seen.set(theme.id, file)
    }
    themes.push(theme)
  }
}

if (problems.length > 0) {
  console.error(`theme pack: ${problems.length} problem(s) found`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const literal = JSON.stringify(themes, null, 2)
  // Keep the emitted literal indented to match the surrounding factory body.
  .split('\n')
  .map((line, index) => (index === 0 ? line : `    ${line}`))
  .join('\n')

// Same treatment for the 15 palette schemes. They are NOT registered as themes, so they
// travel in their own inlined constant — the browser half cannot read the JSON either.
const paletteLiteral = JSON.stringify(schemes, null, 2)
  .split('\n')
  .map((line, index) => (index === 0 ? line : `    ${line}`))
  .join('\n')

const source = readFileSync(clientPath, 'utf8')
//
// ── LOCATE THE ARRAY BY ITS TERMINATOR, NOT BY A NON-GREEDY BRACKET REGEX ─────
//
// This used to be `/const BUNDLED_THEMES = \[[\s\S]*?\]\n/`, which stops at the first
// `]` that ends a line. That was correct only for as long as NO theme carried a nested
// array — `card.rows` is the first one, and on the second run the pattern truncated the
// literal at the closing bracket of `"rows": [...]` and left the remainder of the
// PREVIOUS literal behind as garbage. The result was a `lib/client.js` that no longer
// parsed, produced by the very step whose job is to keep it correct.
//
// The emitted literal is `JSON.stringify(themes, null, 2)` with four spaces prefixed to
// every continuation line, so the array's own closing bracket is the only line in the
// file that is exactly `    ]`. `embed-themes` was the odd one out in not using that
// convention — every reader (tests, previews, publish-check) already slices on it.
const declAt = source.indexOf('const BUNDLED_THEMES = ')
const openAt = declAt < 0 ? -1 : source.indexOf('[', declAt)
const endAt = openAt < 0 ? -1 : source.indexOf('\n    ]', openAt)
if (declAt < 0 || openAt < 0 || endAt < 0) {
  throw new Error('lib/client.js: could not find the BUNDLED_THEMES declaration to replace')
}
const spanEnd = endAt + '\n    ]'.length

// The panel shows the version, and the browser half has no way to read its own
// manifest — so it is inlined here, from package.json, on every run. A stale value
// would be a UI that lies about itself, which is why publish-check compares the two
// and why the release workflow fails when this step changes a tracked file.
const versionMarker = /const BUNDLED_VERSION = '[^']*'/
if (!versionMarker.test(source)) {
  throw new Error('lib/client.js: could not find the BUNDLED_VERSION declaration to replace')
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (typeof pkg.version !== 'string' || pkg.version === '') {
  throw new Error('package.json: version is missing')
}

const next = source.slice(0, declAt)
  + `const BUNDLED_THEMES = ${literal}`
  + source.slice(spanEnd)

// ── the palette constant, located the same way (terminator line) ──────────────
const paletteAt = next.indexOf('const BUNDLED_PALETTES = ')
const paletteOpen = paletteAt < 0 ? -1 : next.indexOf('[', paletteAt)
const paletteEnd = paletteOpen < 0 ? -1 : next.indexOf('\n    ]', paletteOpen)
if (paletteAt < 0 || paletteOpen < 0 || paletteEnd < 0) {
  throw new Error('lib/client.js: could not find the BUNDLED_PALETTES declaration to replace')
}
const embedded = next.slice(0, paletteAt)
  + `const BUNDLED_PALETTES = ${paletteLiteral}`
  + next.slice(paletteEnd + '\n    ]'.length)

// ── the mood lines: validate the pack, then inline it the same way ────────────
//
// The greeting corpus is DATA the plugin ships (see docs/IMP-心情问候语-A), so it
// travels inlined too — and it is validated here, at build time, because a bad
// line must fail the BUILD (including the release CI's embed step) rather than
// surface at runtime as a garbled or inappropriate greeting. The red line is the
// user's: no negative, depressing, or sensitive wording may ship.
const MOOD_CATEGORIES = ['morning', 'day', 'night', 'general', 'holiday']
// Multi-character terms ONLY: single characters like 死 or 黑 would false-positive
// on kept lines (#24 熬过漫长黑夜, #30 追思故人 — both explicitly retained by the
// user). Every listed term was checked against the whole corpus: zero hits.
const MOOD_BLACKLIST = [
  '自杀', '轻生', '抑郁', '绝望', '厌世', '崩溃', '去死', '该死', '恨透', '仇视',
  '暴力', '色情', '赌博', '毒品', '废物', '孤独终老', '生无可恋', '活不下去', '没意思透了',
]
const moodPath = join(root, 'lib', 'mood-lines.json')
const moodPack = JSON.parse(readFileSync(moodPath, 'utf8'))
if (moodPack === null || typeof moodPack !== 'object' || !Array.isArray(moodPack.lines)) {
  throw new Error('lib/mood-lines.json: expected an object with a lines array')
}
{
  const seenMood = new Map()
  const countByCategory = new Map()
  for (const line of moodPack.lines) {
    const where = `mood ${typeof line?.id === 'string' ? line.id : '(no id)'}`
    if (typeof line.id !== 'string' || /^m\d{3}$/.test(line.id) === false) fail(where, 'id must match m\\d{3}')
    else if (seenMood.has(line.id)) fail(where, `duplicate id, already defined in ${seenMood.get(line.id)}`)
    else seenMood.set(line.id, where)
    if (typeof line.seq !== 'number' || !Number.isFinite(line.seq)) fail(where, 'seq must be a finite number')
    if (typeof line.text !== 'string' || line.text.length === 0) fail(where, 'text must be a non-empty string')
    else {
      if (line.text.length > 100) fail(where, `text is ${line.text.length} chars (max 100)`)
      for (const term of MOOD_BLACKLIST) {
        if (line.text.includes(term)) fail(where, `text hits the blacklist term "${term}" (red line: no negative/sensitive wording)`)
      }
    }
    if (!MOOD_CATEGORIES.includes(line.category)) fail(where, `category must be one of ${MOOD_CATEGORIES.join('/')}`)
    if (line.category === 'holiday') {
      const range = line.holiday
      const valid = (edge) => typeof edge === 'string' && /^\d{2}-\d{2}$/.test(edge)
        && Number(edge.slice(0, 2)) >= 1 && Number(edge.slice(0, 2)) <= 12
        && Number(edge.slice(3, 5)) >= 1 && Number(edge.slice(3, 5)) <= 31
      if (range === null || typeof range !== 'object' || !valid(range.from) || !valid(range.to)) {
        fail(where, 'holiday lines need holiday: { from: "MM-DD", to: "MM-DD" }')
      }
    } else if (line.holiday !== undefined) {
      fail(where, 'only holiday lines may carry a holiday range')
    }
    countByCategory.set(line.category, (countByCategory.get(line.category) ?? 0) + 1)
  }
  // An empty pool would leave the marquee with nothing to say at that hour — the
  // silent-failure shape this project keeps paying for. Every category must be
  // populated, and the 40 site-seeded lines must never be dropped.
  for (const category of MOOD_CATEGORIES) {
    if ((countByCategory.get(category) ?? 0) < 1) fail(`mood pool ${category}`, 'category pool is empty')
  }
  if (moodPack.lines.length < 40) fail('mood pack', `only ${moodPack.lines.length} lines (the 40 site seeds must stay)`)
}
if (problems.length > 0) {
  console.error(`theme pack: ${problems.length} problem(s) found`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
const moodLiteral = JSON.stringify(moodPack, null, 2)
  .split('\n')
  .map((line, index) => (index === 0 ? line : `    ${line}`))
  .join('\n')
// The pack is an OBJECT: its own closing brace is the only line that is exactly
// `    }` (inner line objects close eight spaces out) — same terminator logic as
// the two array constants above.
const moodAt = embedded.indexOf('const BUNDLED_MOOD_LINES = ')
let withMood
if (moodAt < 0) {
  // First run: insert the declaration right after the palette literal, so the
  // browser half reads it before the mood module (later in the factory body).
  // The palette literal is an ARRAY — its terminator line is `    ]`.
  const insertAt = embedded.indexOf('const BUNDLED_PALETTES = ')
  const insertEnd = embedded.indexOf('\n    ]', insertAt)
  if (insertAt < 0 || insertEnd < 0) {
    throw new Error('lib/client.js: could not find the BUNDLED_PALETTES declaration to insert the mood lines after')
  }
  const at = insertEnd + '\n    ]'.length
  withMood = embedded.slice(0, at) + `\n\n    const BUNDLED_MOOD_LINES = ${moodLiteral}` + embedded.slice(at)
} else {
  const moodOpen = embedded.indexOf('{', moodAt)
  const moodEnd = moodOpen < 0 ? -1 : embedded.indexOf('\n    }', moodOpen)
  if (moodOpen < 0 || moodEnd < 0) {
    throw new Error('lib/client.js: could not find the BUNDLED_MOOD_LINES declaration to replace')
  }
  withMood = embedded.slice(0, moodAt)
    + `const BUNDLED_MOOD_LINES = ${moodLiteral}`
    + embedded.slice(moodEnd + '\n    }'.length)
}

// ── READ THE LITERALS BACK OUT OF THE NEW TEXT, AND PARSE THE WHOLE FILE ──────
//
// Both assertions exist because of the truncation above: the file stayed syntactically
// plausible while carrying a broken literal, and nothing downstream looks at its raw
// shape. Reading them back makes "what I wrote is what a reader will find" a checked
// fact rather than an assumption.
const readAt = withMood.indexOf('const BUNDLED_THEMES = ')
const readEnd = withMood.indexOf('\n    ]', readAt) + '\n    ]'.length
const readBack = JSON.parse(withMood.slice(readAt + 'const BUNDLED_THEMES = '.length, readEnd))
if (readBack.length !== themes.length
  || readBack.map((theme) => theme.id).join(',') !== themes.map((theme) => theme.id).join(',')) {
  throw new Error('embed-themes: the inlined literal does not read back as the themes it was built from')
}
const paletteReadAt = withMood.indexOf('const BUNDLED_PALETTES = ')
const paletteReadEnd = withMood.indexOf('\n    ]', paletteReadAt) + '\n    ]'.length
const paletteReadBack = JSON.parse(withMood.slice(paletteReadAt + 'const BUNDLED_PALETTES = '.length, paletteReadEnd))
if (paletteReadBack.map((scheme) => scheme.id).join(',') !== schemes.map((scheme) => scheme.id).join(',')) {
  throw new Error('embed-themes: the inlined palette does not read back as the schemes it was built from')
}
// The mood pack reads back too — same checked fact, same reason.
const moodReadAt = withMood.indexOf('const BUNDLED_MOOD_LINES = ')
const moodReadOpen = withMood.indexOf('{', moodReadAt)
const moodReadEnd = withMood.indexOf('\n    }', moodReadOpen) + '\n    }'.length
const moodReadBack = JSON.parse(withMood.slice(moodReadOpen, moodReadEnd))
if (moodReadBack.lines.length !== moodPack.lines.length
  || moodReadBack.lines.map((line) => line.id).join(',') !== moodPack.lines.map((line) => line.id).join(',')) {
  throw new Error('embed-themes: the inlined mood pack does not read back as the lines it was built from')
}
try {
  // eslint-disable-next-line no-new-func
  new Function(withMood)
} catch (error) {
  throw new Error(`lib/client.js would not PARSE after embedding: ${String(error.message ?? error)}`)
}

writeFileSync(
  clientPath,
  withMood.replace(versionMarker, `const BUNDLED_VERSION = '${pkg.version}'`),
)
console.log(`embedded ${themes.length} theme(s) from ${files.length} file(s): ${[...seen.keys()].join(', ')}`)
console.log(`inlined ${schemes.length} palette scheme(s) and ${moodPack.lines.length} mood line(s), version ${pkg.version}`)
