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
 *   4. every required token from schema/theme.schema.json is present.
 *
 * Run after editing any file in lib/themes/:
 *   node scripts/embed-themes.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const AMBIENT_KINDS = ['shan', 'dream']

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
      if (a.petals !== undefined && (!Number.isInteger(a.petals) || a.petals < 0 || a.petals > 20)) {
        fail(where, 'ambient.petals must be an integer in 0..20')
      }
      if (a.bubbles !== undefined && (!Number.isInteger(a.bubbles) || a.bubbles < 0 || a.bubbles > 24)) {
        fail(where, 'ambient.bubbles must be an integer in 0..24')
      }
    }
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

const source = readFileSync(clientPath, 'utf8')
// Match the untouched placeholder AND an already-embedded array, so re-running
// this script is idempotent instead of throwing on the second run.
const marker = /const BUNDLED_THEMES = (?:\/\* BUNDLED_THEMES \*\/ )?\[[\s\S]*?\](?=\n)/
if (!marker.test(source)) {
  throw new Error('lib/client.js: could not find the BUNDLED_THEMES declaration to replace')
}

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

writeFileSync(
  clientPath,
  source
    .replace(marker, `const BUNDLED_THEMES = ${literal}`)
    .replace(versionMarker, `const BUNDLED_VERSION = '${pkg.version}'`),
)
console.log(`embedded ${themes.length} theme(s) from ${files.length} file(s): ${[...seen.keys()].join(', ')}`)
console.log(`inlined version ${pkg.version}`)
