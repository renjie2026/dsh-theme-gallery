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
const Theme = z.object({
  id: z.string().required().pattern(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().required(),
  description: z.string().required(),
  colorScheme: z.union(['light', 'dark']).required(),
  tokens: z.dict(TokenModes).required(),
  reading: Reading,
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
