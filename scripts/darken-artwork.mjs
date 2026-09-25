/**
 * Darken the ported scenery so it reads against the sidebar it sits on.
 *
 * Why this exists: the artwork was ported colour-for-colour from the source admin
 * system, where it sat behind a NARROW 223px sidebar. This app's sidebar is wider
 * and its gradient runs through the same greens, so 山青婷彩's far ridge
 * (#BCDCC9) landed almost exactly on the sidebar's own value at that height — the
 * mountains rendered correctly and were invisible, and the red probe is what
 * proved the layer was being painted at all.
 *
 * Only the two skins this repository ships are affected, and ONLY their ambient
 * artwork: no palette token changes. Run once; the result is committed.
 *
 * Run with: node scripts/darken-artwork.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const clientPath = join(root, 'lib', 'client.js')

/** Source colour → darkened replacement, per element. */
const REPLACEMENTS = [
  // 山青婷彩 — two mountain ridges. The far ridge was the invisible one.
  ["stopColor: '#BCDCC9'", "stopColor: '#8FBFAA'"],
  ["stopColor: '#A7CDB8'", "stopColor: '#74AE96'"],
  ["stopColor: '#79B898'", "stopColor: '#3E8A66'"],
  ["stopColor: '#5FA886'", "stopColor: '#2B6E4F'"],
  // Dragonfly body and head, so the wings read as wings against them.
  ["stopColor: '#2E8C66'", "stopColor: '#1F6B4C'"],
  ["stopColor: '#3FAE82'", "stopColor: '#2E8C66'"],
  ["fill: '#2E8C66'", "fill: '#1F6B4C'"],
  ["fill: '#256B50'", "fill: '#17513C'"],
  // 梦海游鱼 — the seaweed bed.
  ["stopColor: '#2E8B74'", "stopColor: '#1F6B57'"],
  ["stopColor: '#52B49A'", "stopColor: '#3E9C82'"],
  ["stopColor: '#3E9BA8'", "stopColor: '#2B7C87'"],
  ["stopColor: '#66C2C9'", "stopColor: '#4FA9B1'"],
  ["stopColor: '#6C7FC4'", "stopColor: '#5568AC'"],
  ["stopColor: '#93A9DC'", "stopColor: '#7B92CA'"],
  // Water and ripples: a flat pale band reads as a rendering artefact.
  ['rgba(126,196,172,.55),rgba(96,172,146,.7)', 'rgba(104,178,150,.62),rgba(66,141,113,.78)'],
  ['border:1.4px solid rgba(60,142,112,.8)', 'border:1.6px solid rgba(31,107,76,.9)'],
  // Scale: 5em dragonflies were ~10px at this sidebar width.
  ['width:5em;will-change:transform', 'width:6.4em;will-change:transform'],
  ['width:3.5em;opacity:.92', 'width:4.4em;opacity:.95'],
]

const source = readFileSync(clientPath, 'utf8')
let next = source
const applied = []
for (const [from, to] of REPLACEMENTS) {
  if (!next.includes(from)) {
    applied.push(`SKIP (not found): ${from}`)
    continue
  }
  next = next.split(from).join(to)
  applied.push(`ok   ${from}  ->  ${to}`)
}

if (next === source) {
  console.error('darken-artwork: nothing changed — already applied?')
  process.exit(1)
}

writeFileSync(clientPath, next)
for (const line of applied) console.log(line)

// The preview builder MIRRORS the scene markup (it cannot import the browser
// bundle), so it carries its own copy of these same colours. Leaving it behind
// would make the preview advertise artwork the plugin no longer draws — which is
// exactly the drift the preview exists to rule out.
const previewPath = join(root, 'scripts', 'build-ambient-preview.mjs')
const preview = readFileSync(previewPath, 'utf8')
let nextPreview = preview
let previewTouched = 0
for (const [from, to] of REPLACEMENTS) {
  // Preview attributes use double quotes where the bundle uses single ones.
  const fromDouble = from.replace(/'/g, '"')
  const toDouble = to.replace(/'/g, '"')
  for (const [a, b] of [[from, to], [fromDouble, toDouble]]) {
    if (!nextPreview.includes(a)) continue
    nextPreview = nextPreview.split(a).join(b)
    previewTouched += 1
  }
}
if (nextPreview !== preview) writeFileSync(previewPath, nextPreview)
console.log(`darken-artwork: synced ${previewTouched} value(s) into the preview builder`)
console.log(`\ndarken-artwork: rewrote ${clientPath}`)
