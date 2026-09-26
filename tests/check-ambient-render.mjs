/**
 * Exercise the scenery markup builders.
 *
 * The scenery is HTML text injected with `innerHTML` — the third approach, after
 * `createRoot` mounted nothing and a hand-written DOM walker also left the seat
 * empty while a plain pseudo-element on that same seat was visible.
 *
 * Markup is the version that can be tested as text: no DOM stand-in, no namespace
 * juggling, and the two things the earlier approaches had to get right by hand (the
 * SVG namespace, and `stop-color` versus `stopColor`) are properties of the string.
 *
 * The builders are READ OUT OF `lib/client.js`, so this cannot drift from shipping.
 *
 * Run with: node tests/check-ambient-render.mjs
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
 * Grab `function name(...) { ... }` by brace matching.
 *
 * The PARAMETER LIST is skipped before looking for the body's brace. A destructured
 * parameter (`function page({ t, ... }) {`) carries braces of its own, and taking the
 * first `{` after the name ended the "body" at the parameter list — a 69-character
 * fragment that made every assertion about that function read nothing while still being
 * able to pass. That is the same silent-truncation class this file exists to catch, so
 * the extractor has an assertion of its own (see the panel section below).
 * @param name - the function to extract.
 * @returns the function's source text.
 */
function block(name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`lib/client.js: function ${name} not found`)
  // Balanced-paren scan to the end of the signature, then the body's opening brace.
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

const builderSource = [
  "const SVG_TAGS = new Set(['svg', 'defs', 'linearGradient', 'stop', 'path', 'ellipse', 'g', 'circle'])",
  block('attr'),
  block('open'),
  block('rippleMarkup'),
  block('dragonflyBlock'),
  block('bladeMarkup'),
  block('shanAmbientScene'),
  block('dragonflyMarkup'),
  block('fishMarkup'),
  block('dreamAmbientScene'),
  block('seaweedMarkup'),
  block('ymSeaSvg'),
  block('ymBalloonMarkup'),
  block('caiyunAmbientScene'),
  block('jpBoatMarkup'),
  block('dongyunAmbientScene'),
  block('xsPineMarkup'),
  block('junyueAmbientScene'),
  block('jiexinAmbientScene'),
  block('gcFeatherMarkup'),
  block('fengchenAmbientScene'),
].join('\n\n')

// eslint-disable-next-line no-new-func
const api = new Function(`${builderSource}\nreturn { shanAmbientScene, dragonflyMarkup, dreamAmbientScene, seaweedMarkup, rippleMarkup, dragonflyBlock, bladeMarkup, fishMarkup, ymSeaSvg, ymBalloonMarkup, caiyunAmbientScene, jpBoatMarkup, dongyunAmbientScene, xsPineMarkup, junyueAmbientScene, jiexinAmbientScene, gcFeatherMarkup, fengchenAmbientScene, open }`)()

// ── 山青婷彩 ─────────────────────────────────────────────────────────────────

const shan = api.shanAmbientScene(6)
check('shan has a scene root', shan.startsWith('<div class="sta"'))
// Positioning is inlined so a stylesheet that never applies cannot collapse the scene
// silently — the layer's own computed values could not reveal that, because they were
// reading the layer's inline styles.
check('the scene root carries its own positioning',
  /class="sta" style="[^"]*position:absolute/.test(shan))
check('the mountain band carries its own positioning',
  /class="sta-mountains" style="[^"]*position:absolute/.test(shan))
check('shan carries both mountain ridges', (shan.match(/<path /g) ?? []).length >= 2)
check('shan paints the far ridge with a gradient reference', shan.includes('fill="url(#dsh-sta-back)"'))
check('shan paints the near ridge with a gradient reference', shan.includes('fill="url(#dsh-sta-front)"'))
check('shan defines both gradients',
  shan.includes('id="dsh-sta-back"') && shan.includes('id="dsh-sta-front"'))
// The attribute the React-element version had to translate by hand, and got wrong
// once: `stopColor` written literally is inert.
check('stop colours are spelled `stop-color`, not `stopColor`',
  shan.includes('stop-color=') && !shan.includes('stopColor'))
check('shan draws the mist band', (shan.match(/class="sta-mist/g) ?? []).length === 2)
check('shan draws the water and its ripple rings',
  shan.includes('class="sta-pond"') && (shan.match(/class="sta-ripple"/g) ?? []).length === 2)
check('shan flies two dragonflies', (shan.match(/class="sta-dfly /g) ?? []).length === 2)
check('shan seeds the requested petal count', (shan.match(/class="sta-petal"/g) ?? []).length === 6)
check('shan seeds a different count on request',
  (api.shanAmbientScene(3).match(/class="sta-petal"/g) ?? []).length === 3)
check('petal count is clamped to the schema maximum',
  (api.shanAmbientScene(99).match(/class="sta-petal"/g) ?? []).length === 20)
check('petals carry per-petal inline geometry', /class="sta-petal" style="[^"]*left:\d+%/.test(shan))

// The two dragonflies animate independently, so their gradient ids must not collide.
const ids = shan.match(/id="dsh-sta-dfly-body-\w"/g) ?? []
check('each dragonfly carries its own gradient id', ids.length === 2 && new Set(ids).size === 2)
check('dragonfly artwork includes wings and eyes',
  api.dragonflyMarkup('1').includes('<ellipse') && api.dragonflyMarkup('1').includes('<circle'))

// ── 梦海游鱼 ─────────────────────────────────────────────────────────────────

const dream = api.dreamAmbientScene(9, 5, 3)
check('dream has a scene root', dream.startsWith('<div class="dof"'))
check('dream draws the corner glow and two washes',
  dream.includes('class="dof-corner"') && (dream.match(/class="dof-wash /g) ?? []).length === 2)
check('dream seeds the requested bubble count', (dream.match(/class="dof-bubble"/g) ?? []).length === 9)
check('bubble count is clamped',
  (api.dreamAmbientScene(99).match(/class="dof-bubble"/g) ?? []).length === 24)
check('dream draws five seaweed blades',
  (dream.match(/class="dof-blade dof-blade-\d"/g) ?? []).length === 5)
check('seaweed rests on three stones', (api.seaweedMarkup().match(/<ellipse /g) ?? []).length === 3)
check('seaweed gradients use stop-color', api.seaweedMarkup().includes('stop-color='))

// ── 营慕彩云 ─────────────────────────────────────────────────────────────────

const caiyun = api.caiyunAmbientScene(12)
check('caiyun has a scene root carrying its own positioning',
  caiyun.startsWith('<div class="ym"') && /class="ym" style="[^"]*position:absolute/.test(caiyun))
check('caiyun seeds the requested star count', (caiyun.match(/class="ym-star"/g) ?? []).length === 12)
check('star count is clamped', (api.caiyunAmbientScene(99).match(/class="ym-star"/g) ?? []).length === 30)
check('stars carry per-star inline geometry', /class="ym-star" style="[^"]*left:\d+%/.test(caiyun))
check('caiyun draws the dusk glow', caiyun.includes('class="ym-glow"'))
check('caiyun drifts three blurred clouds', (caiyun.match(/class="ym-drift ym-drift-\d"/g) ?? []).length === 3)
check('caiyun draws two marquee cloud-seas',
  caiyun.includes('class="ym-sea ym-sea-back"') && caiyun.includes('class="ym-sea ym-sea-front"'))
check('each cloud-sea track runs the marquee keyframe',
  (caiyun.match(/animation:dsh-amb-ym-sea \d+s/g) ?? []).length === 2)
check('each cloud-sea carries two svg copies so the loop is seamless',
  (caiyun.match(/class="ym-sea-track"/g) ?? []).length === 2
  && (caiyun.match(/<svg /g) ?? []).length >= 4)
check('the sea gradient ids stay unique across copies',
  new Set(caiyun.match(/id="dsh-ym-sea-[a-z]+-[ab]"/g) ?? []).size === 4)
check('caiyun flies two balloons', (caiyun.match(/class="ym-balloon ym-balloon-[a-z]+"/g) ?? []).length === 2)
check('both balloons bob on the ym keyframe',
  (caiyun.match(/animation:dsh-amb-ym-bob /g) ?? []).length === 2)
// The balloons legitimately float over the sidebar's lower rows. Their WANDER is what
// keeps that from being a permanent block: the two travel distinct, wide round trips so
// they cover and expose the text in turn. The size of that path is the whole point, so
// it is pinned — a balloon that only bobs is the defect this guards.
check('each balloon carries its own wide wander path',
  (caiyun.match(/animation:dsh-amb-ym-wander \d+s/g) ?? []).length === 1
  && (caiyun.match(/animation:dsh-amb-ym-wander-2 \d+s/g) ?? []).length === 1)
// The main balloon's wander is a CLOSED LOOP, so it is checked stop by stop rather than
// by one literal. Bounded spans, not `[^}]*`: a keyframe's body is full of nested braces.
// The `em` unit is OPTIONAL in the pattern on purpose: CSS allows a bare `0`, and an
// earlier version of this regex required the unit on the first value — which silently
// skipped every `translate(0, …)` stop and left the assertions reading the apex only.
const mainWanderStops = [
  ...(source.match(/@keyframes dsh-amb-ym-wander\{([\s\S]{0,240}?)\}\}',/)?.[1] ?? '')
    .matchAll(/translate\((-?[\d.]+)(?:em)?,(-?[\d.]+)(?:em)?\)/g),
].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
check('the main wander is a closed three-stop loop',
  mainWanderStops.length === 3)
check('the main balloon keeps a wide horizontal path',
  mainWanderStops.length >= 3 && Math.max(...mainWanderStops.map((stop) => stop.x)) >= 6)
// The scene box clips at its OWN top edge (`overflow:hidden`) and the balloon sits high in
// the band, so ANY stop above the resting baseline would slice the envelope's crown off at
// the apex — the hard crop the user reported. Every vertical term must therefore be >= 0.
check('no stop of the main wander rises above the resting baseline (else the crown is cropped)',
  mainWanderStops.length >= 3 && mainWanderStops.every((stop) => stop.y >= 0))
// The apex height was accepted as-is, so it is pinned: raising or lowering it is a change
// the user did not ask for, and raising it re-introduces the crop.
const mainApex = mainWanderStops.reduce((best, stop) => (stop.x > best.x ? stop : best), { x: -1, y: -1 })
check('the rightmost apex keeps the exact position it was accepted at (7em, 0.5em)',
  mainApex.x === 7 && mainApex.y === 0.5)
// The loop's rise and fall comes from the START/END sitting lower than the apex, not from
// the apex moving up. Both ends must be lowered by the same amount and return to x = 0.
check('the start and end sit lower than the apex, giving the loop its rise and fall',
  mainWanderStops.length === 3
  && mainWanderStops[0].x === 0 && mainWanderStops[0].y > mainApex.y
  && mainWanderStops[2].x === 0 && mainWanderStops[2].y === mainWanderStops[0].y)
check('the mini balloon keeps its own wide, downward path',
  /@keyframes dsh-amb-ym-wander-2\{[\s\S]{0,160}?translate\(-5em,1\.6em\)/.test(source))
check('the balloons carry envelope, ropes and basket artwork',
  api.ymBalloonMarkup('main').includes('<rect') && api.ymBalloonMarkup('mini').includes('<rect'))

// ── 江畔冬云 ─────────────────────────────────────────────────────────────────

const dongyun = api.dongyunAmbientScene(8)
check('dongyun has a scene root carrying its own positioning',
  dongyun.startsWith('<div class="jp"') && /class="jp" style="[^"]*position:absolute/.test(dongyun))
check('dongyun hangs a haloed winter moon', /class="jp-moon" style="[^"]*box-shadow/.test(dongyun))
check('dongyun drifts three clouds', (dongyun.match(/class="jp-cloud jp-cloud-\d"/g) ?? []).length === 3)
check('dongyun seeds the requested snow count', (dongyun.match(/class="jp-snowflake"/g) ?? []).length === 8)
check('snow count is clamped', (api.dongyunAmbientScene(99).match(/class="jp-snowflake"/g) ?? []).length === 30)
check('dongyun draws the river with waterline and moonlight column',
  dongyun.includes('class="jp-river"') && dongyun.includes('class="jp-waterline"')
  && dongyun.includes('class="jp-moonlight"'))
check('dongyun draws three ripples and five glints',
  (dongyun.match(/class="jp-ripple jp-ripple-\d"/g) ?? []).length === 3
  && (dongyun.match(/class="jp-glint"/g) ?? []).length === 5)
const boat = api.jpBoatMarkup()
check('the boat carries hull, awning and lantern artwork',
  boat.includes('M 6 24 Q 60 36 114 22') && boat.includes('M 38 24 C 44 10, 78 10, 88 23')
  && boat.includes('r="2.6"'))
check('the boat reflection is a flipped reuse of the same art',
  boat.includes('transform="translate(0,90) scale(1,-1)"'))
check('the boat drifts and bobs',
  dongyun.includes('animation:dsh-amb-jp-boat 46s') && dongyun.includes('animation:dsh-amb-jp-bob 5.2s'))
check('dongyun plants four swaying reeds and three bank lines',
  (dongyun.match(/class="jp-reed jp-reed-\d"/g) ?? []).length === 4
  && (dongyun.match(/M \d+ 120 C/g) ?? []).length >= 3)

// ── 徐山军月 ─────────────────────────────────────────────────────────────────

const junyue = api.junyueAmbientScene(12)
check('junyue has a scene root carrying its own positioning',
  junyue.startsWith('<div class="xs"') && /class="xs" style="[^"]*position:absolute/.test(junyue))
check('junyue seeds the requested star count', (junyue.match(/class="xs-star"/g) ?? []).length === 12)
check('junyue star count is clamped', (api.junyueAmbientScene(99).match(/class="xs-star"/g) ?? []).length === 30)
check('junyue hangs the full moon with a halo', /class="xs-moon" style="[^"]*box-shadow/.test(junyue))
check('junyue veils the moon with two night clouds',
  (junyue.match(/class="xs-cloud xs-cloud-\d"/g) ?? []).length === 2)
check('the meteor carries a glowing head',
  junyue.includes('class="xs-meteor"') && junyue.includes('box-shadow:0 0 8px 2px rgba(255,251,234,.9)'))
check('junyue draws both mountain ridges with their gradients',
  junyue.includes('fill="url(#dsh-xsj-ridge-back)"') && junyue.includes('fill="url(#dsh-xsj-ridge-front)"'))
check('junyue stands five pines from one shared art def',
  (junyue.match(/<use href="#dsh-xsj-pine-art"/g) ?? []).length === 5
  && api.xsPineMarkup().includes('M 12 120 L 12 112'))

// ── 佩安杰心 ─────────────────────────────────────────────────────────────────

const jiexin = api.jiexinAmbientScene(4)
check('jiexin has a scene root carrying its own positioning',
  jiexin.startsWith('<div class="pj"') && /class="pj" style="[^"]*position:absolute/.test(jiexin))
check('jiexin backs the scene with two misty hills',
  jiexin.includes('M 0 60 Q 34 22 70 46') && jiexin.includes('M 0 72 Q 40 42 82 60'))
check('jiexin draws the enso circle with its inner arc',
  jiexin.includes('stroke-dasharray="316 36"') && jiexin.includes('stroke-dasharray="255 92"'))
check('jiexin seats the meditator with head, body and cushion',
  jiexin.includes('M 64 52 C 60 68, 62 80, 67 93') && jiexin.includes('cx="80" cy="119" rx="47"'))
check('jiexin burns incense with two smoke threads on the dashoffset keyframe',
  (jiexin.match(/class="pj-smoke pj-smoke-\d"/g) ?? []).length === 2
  && (jiexin.match(/animation:dsh-amb-pj-smoke 7s/g) ?? []).length === 2)
check('jiexin seeds the requested dust count', (jiexin.match(/class="pj-dust"/g) ?? []).length === 4)
check('jiexin dust count is clamped', (api.jiexinAmbientScene(99).match(/class="pj-dust"/g) ?? []).length === 20)
check('jiexin closes with the theme words in a kai face',
  jiexin.includes('自在') && jiexin.includes('安顿') && jiexin.includes('KaiTi'))

// ── 光彩凤晨 ─────────────────────────────────────────────────────────────────

const fengchen = api.fengchenAmbientScene(6, 10)
check('fengchen has a scene root carrying its own positioning',
  fengchen.startsWith('<div class="gc"') && /class="gc" style="[^"]*position:absolute/.test(fengchen))
check('fengchen fans five dawn rays at inline rotations',
  (fengchen.match(/class="gc-ray gc-ray-\d" style="[^"]*rotate\(-?\d+deg\)/g) ?? []).length === 5)
check('fengchen seeds the requested feather count', (fengchen.match(/class="gc-feather"/g) ?? []).length === 6)
check('fengchen feather count is clamped',
  (api.fengchenAmbientScene(99, 0).match(/class="gc-feather"/g) ?? []).length === 16)
check('each feather carries its own gradient id',
  new Set(fengchen.match(/id="dsh-gc-feather-\d+"/g) ?? []).size === 6
  && (fengchen.match(/id="dsh-gc-feather-\d+"/g) ?? []).length === 6)
check('fengchen seeds the requested dew count', (fengchen.match(/class="gc-dew"/g) ?? []).length === 10)
check('fengchen dew count is clamped',
  (api.fengchenAmbientScene(0, 99).match(/class="gc-dew"/g) ?? []).length === 30)
check('the phoenix strokes share one gradient under a glow filter',
  fengchen.includes('id="dsh-gc-phoenix-stroke"') && fengchen.includes('filter="url(#dsh-gc-glow)"')
  && (fengchen.match(/stroke="url\(#dsh-gc-phoenix-stroke\)"/g) ?? []).length >= 11)
check('the phoenix keeps the source stroke-only look (its fill gradient was never defined)',
  /d="M 380 50 C 360 40 350 60 360 90[^"]*" fill="none"/.test(fengchen))
check('the phoenix neck keeps its emphasised stroke width',
  /class="gc-neck"[^>]*stroke-width="7"/.test(fengchen))
check('the phoenix wings flap on the gc keyframe',
  (fengchen.match(/animation:dsh-amb-gc-wing 3.4s/g) ?? []).length === 2)
check('the phoenix eye is the theme gold', fengchen.includes('r="2.5"'))

// ── every new scene's motion lives in the stylesheet ─────────────────────────
//
// Keyframes are the one construct that cannot be inlined: an element can carry its
// animation shorthand inline, but the keyframes it names must exist in AMBIENT_CSS
// or the animation silently does nothing.

const NEW_KEYFRAMES = [
  'dsh-amb-ym-star', 'dsh-amb-ym-drift', 'dsh-amb-ym-sea', 'dsh-amb-ym-bob',
  'dsh-amb-ym-wander', 'dsh-amb-ym-wander-2',
  'dsh-amb-jp-cloud', 'dsh-amb-jp-snow', 'dsh-amb-jp-ripple', 'dsh-amb-jp-glint',
  'dsh-amb-jp-boat', 'dsh-amb-jp-bob', 'dsh-amb-jp-sway',
  'dsh-amb-xs-star', 'dsh-amb-xs-night', 'dsh-amb-xs-meteor',
  'dsh-amb-pj-smoke', 'dsh-amb-pj-dust',
  'dsh-amb-gc-ray', 'dsh-amb-gc-feather', 'dsh-amb-gc-fly', 'dsh-amb-gc-bob',
  'dsh-amb-gc-wing', 'dsh-amb-gc-dew',
]
const missingKeyframes = NEW_KEYFRAMES.filter((name) => !new RegExp(`@keyframes ${name}`).test(source))
check('all 24 new-scene keyframes are defined in AMBIENT_CSS', missingKeyframes.length === 0)
if (missingKeyframes.length > 0) console.error(`  missing: ${missingKeyframes.join(', ')}`)

// A @keyframes name defined TWICE is a silent override: the later block wins for every
// element, so a corrected amplitude in the earlier one never runs. This exact trap is
// recorded in AGENTS.md for the shan hover keyframes (dsh-amb-hover1/2, pending the
// user's decision, which is why only the NEW families are asserted here) — and it was
// walked into again while adding the balloon wander, minutes after reading that note.
// Hence the machine check instead of a resolution to be careful.
const newKeyframeDefs = [...source.matchAll(/@keyframes\s+(dsh-amb-(?:ym|jp|xs|pj|gc)-[A-Za-z0-9-]+)\s*\{/g)]
  .map((match) => match[1])
const duplicatedKeyframes = [...new Set(newKeyframeDefs.filter((name, i) => newKeyframeDefs.indexOf(name) !== i))]
check('every new-scene keyframe is defined exactly once (a duplicate silently wins)',
  duplicatedKeyframes.length === 0)
if (duplicatedKeyframes.length > 0) console.error(`  duplicated: ${duplicatedKeyframes.join(', ')}`)

const sceneMarkupBlock = block('sceneMarkup')
check('sceneMarkup dispatches every ported kind',
  ['shan', 'dream', 'caiyun', 'dongyun', 'junyue', 'jiexin', 'fengchen']
    .every((kind) => sceneMarkupBlock.includes(`'${kind}'`)))

// ── escaping and the script guard ────────────────────────────────────────────

check('attribute values are quote-escaped', api.open('div', { title: 'a"b' }).includes('&quot;'))
check('nullish attributes are dropped', api.open('div', { title: null }) === '<div>')

// The real guard lives in `sceneMarkup`, which the bundle keeps in one piece.
const sceneMarkupSource = block('sceneMarkup')
check('sceneMarkup refuses script-bearing markup', /<script/.test(sceneMarkupSource))
check('sceneMarkup refuses inline event handlers', /on\[a-z\]\+/.test(sceneMarkupSource)
  || /on\[a-z\]/.test(sceneMarkupSource))
check('sceneMarkup rejects unknown kinds by yielding empty markup',
  sceneMarkupSource.includes(": ''"))

// ── the seat must never exist without its stylesheet ─────────────────────────
//
// Regression guard for a real defect: `syncAmbient` runs on every shell mutation, so
// it could create the seat before `AMBIENT_CSS` was installed. An unstyled seat is
// not merely invisible — as a plain block it joins the sidebar's layout and spilled
// over the main column, covering conversation text, while every later reading still
// looked healthy because the element did exist.

const guardSource = [
  // The real sheet text comes from the bundle; the guard only needs the binding.
  "const AMBIENT_CSS = '/* current build */'",
  block('ambientStylesheetReady'),
  block('ensureAmbientStylesheet'),
  block('sidebarColumn'),
].join('\n\n')
// eslint-disable-next-line no-new-func
const guard = new Function('document', `${guardSource}\nreturn { ambientStylesheetReady, ensureAmbientStylesheet, sidebarColumn }`)

/**
 * A fake document whose head either contains the ambient sheet or does not.
 * @param withSheet - whether the stylesheet starts present.
 * @param sheetText - the sheet's text content; a value other than the current build's
 *   makes it STALE, which must be replaced rather than reused.
 * @returns the fake document plus a log of appended and removed nodes.
 */
function fakeDocument(withSheet, sheetText = '') {
  const appended = []
  const removed = []
  const style = {
    tagName: 'style',
    dataset: { pluginCss: 'theme-gallery/ambient' },
    textContent: sheetText,
    remove: () => removed.push(style),
  }
  const column = { tagName: 'div', className: 'ZTP-Xa_sidebarCol' }
  let sheetPresent = withSheet
  return {
    appended,
    removed,
    head: { tagName: 'head', append: (node) => appended.push(node) },
    documentElement: { tagName: 'html', append: (node) => appended.push(node) },
    createElement: () => {
      // Creating it is what makes it findable on the next probe.
      sheetPresent = true
      return style
    },
    querySelector: (selector) => {
      if (selector.includes('data-plugin-css')) return sheetPresent ? style : null
      if (selector.includes('sidebarCol') || selector.includes('sidebar')) return column
      return null
    },
  }
}

check('the stylesheet probe reports absence when the sheet is missing',
  guard(fakeDocument(false)).ambientStylesheetReady() === false)
check('the stylesheet probe reports presence when the sheet is present',
  guard(fakeDocument(true, '/* current build */')).ambientStylesheetReady() === true)

// A sheet left behind by a previous build is present but STALE. The shell keeps its DOM
// across a plugin reload, so a check that only asks "is a sheet there?" reuses rules that
// no longer match the markup — which is exactly how the layer ended up with no styling
// while the report insisted the sheet existed.
const staleDoc = fakeDocument(true, '/* previous build */')
guard(staleDoc).ensureAmbientStylesheet()
check('a stale stylesheet is replaced rather than reused', staleDoc.removed.length === 1)
check('replacing a stale sheet installs the current one', staleDoc.appended.length === 1)

// Self-healing. A one-shot install was assumed to survive and did not; because
// `syncAmbient` bails out while the sheet is absent, that single failure silently
// disabled the scenery permanently — the guard was right and the sheet was simply
// never there.
const healDoc = fakeDocument(false)
const healed = guard(healDoc).ensureAmbientStylesheet()
check('ensureAmbientStylesheet creates the sheet when it is missing', healed !== null)
check('the created sheet is appended to the document', healDoc.appended.length === 1)
check('ensureAmbientStylesheet reuses an existing sheet rather than duplicating it',
  guard(fakeDocument(true)).ensureAmbientStylesheet() === null
  || guard(fakeDocument(true)).appended === undefined
  || fakeDocument(true).appended.length === 0)

// The behaviour the guard exists to cause: bail out before any layer can be created.
//
// The scene is drawn by `drawScene`, which runs AFTER the guard. Nothing in `syncAmbient` may
// create DOM before the stylesheet check, because an unstyled full-viewport layer is not merely
// invisible — it joins the layout and covers the main column.
const syncSource = block('syncAmbient')
const bailIndex = syncSource.indexOf('ambientStylesheetReady()')
const drawIndex = syncSource.indexOf('drawScene(')
check('syncAmbient checks the stylesheet before it can create a layer',
  bailIndex > 0 && drawIndex > bailIndex)
check('syncAmbient clears ambient nodes while the stylesheet is absent',
  /removeAllAmbientSeats\(\)/.test(syncSource))
check('syncAmbient repairs the stylesheet before probing it',
  syncSource.indexOf('ensureAmbientStylesheet()') < bailIndex)
check('syncAmbient sweeps debris an earlier build left behind',
  syncSource.includes('removeStrayAmbientSeats()'))
// The layer is a full-viewport fixed element appended to the BODY, styled by a CLASS at z-index
// 60 — the arrangement copied from the working `dsh-theme-firefly` plugin. Every other
// arrangement failed to paint here (precise inline geometry, maximum z-index, `documentElement`
// as the parent), so this one is kept exactly.
//
// There is now exactly ONE layer. The scene used to be drawn twice — into a `#dsh-theme-ambient`
// seat AND into this control layer — and the duplicate DOM meant two of every animated element,
// which is what produced the duplicated dragonflies.
const drawSource = block('drawScene')
check('the layer is appended to the document body',
  /document\.body\.appendChild\(wrap\)/.test(drawSource))
check('the layer takes its arrangement from a class rule',
  /\.dsh-amb-control\{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden\}/
    .test(source))
// The scene is positioned INSIDE the full-viewport layer rather than being the layer.
check('the scenery lives in its own positioned box', /dsh-amb-control-scene/.test(source))
check('there is only ONE render path',
  (source.match(/\.innerHTML = String\(markup\)/g) ?? []).length === 1)

// ── band placement ───────────────────────────────────────────────────────────
//
// The band must land in the sidebar's bottom THIRD. An earlier revision capped it at
// 420px, which on a 780px column started it at 55% — the middle of the sidebar, so the
// scenery and the probe both sat too high, and no offset could satisfy the request to
// move them into the blank area.

// The band is placed by `bandBox`, which asks `footerHeight` how much of the column's
// bottom to leave alone. Both are extracted together so the stubs stay self-contained.
const bandSource = [block('footerHeight'), block('viewportBottomOf'), block('bandBox')].join('\n\n')
// eslint-disable-next-line no-new-func
const bandOf = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: 900 })

/**
 * A sidebar column stand-in built like the real one: a full-height wrapper flush with the
 * bottom (which a naive "nearest descendant" measurement mistakes for the footer), a 64px
 * account row also flush with the bottom, and a conversation row above it.
 * @param top - viewport top.
 * @param height - column height.
 * @returns the fake column.
 */
function fakeColumn(top, height) {
  const kids = [
    { top: 0, bottom: height },
    { top: height - 64, bottom: height },
    { top: Math.max(0, height - 140), bottom: Math.max(0, height - 80) },
  ]
  return {
    getBoundingClientRect: () => ({
      left: 0, top, right: 280, bottom: top + height, width: 280, height,
    }),
    querySelectorAll: () => kids.map((k) => ({
      closest: () => null,
      getBoundingClientRect: () => ({
        left: 0, top: top + k.top, bottom: top + k.bottom, width: 280, height: k.bottom - k.top,
      }),
    })),
  }
}

const column = fakeColumn(40, 780)
const reserve = bandOf.footerHeight(column)
const band = bandOf.bandBox(column)
check('a strip is reserved for the account row', reserve >= 56)
// A full-height wrapper is flush with the bottom too; it must not be mistaken for the footer.
check('a full-height wrapper does not count as the footer', reserve <= 195)
check('the reserved strip covers the account row', reserve >= 64)
// The reservation only has to clear the row, and the row is a fixed-height control rather
// than something that grows with the window. A proportional reserve left a widening empty
// band on a tall window, which read as "too much space reserved".
check('the reserved strip stays small on a normal window', reserve <= 80)
check('the band stops above the reserved strip', band.top + band.height <= 820 - reserve + 1)
check('the band still has usable height', band.height >= 140)
check('the band spans the column width', band.width === 280 && band.left === 0)
// A very short column is clamped to a minimum footprint rather than collapsing.
check('a short column still gets a usable band', bandOf.bandBox(fakeColumn(0, 200)).height >= 100)
// A column whose bottom is off-screen must not push the band out of view.
const offscreen = bandOf.bandBox(fakeColumn(0, 2000))
check('the band stays within the viewport when the column bottom is off-screen',
  offscreen.top + offscreen.height <= 900)

// Adaptivity, measured by POSITION. Sizing the band as a share of the column kept the right
// footprint but slid its CENTRE: a 288px band on a 780px column spanned 472..760, putting its
// middle at y=616 — inside the sidebar's middle third rather than the bottom third. The
// sidebar reads as three stacked regions and the scenery belongs in the lowest one, so the
// constraint is on where the band sits, not on how tall it is.
const sizes = [780, 900, 1080, 1440]
const thirds = sizes.map((height) => {
  // The band's placement is bounded by the viewport, so the stub's `innerHeight` has to
  // match the column it is being asked about.
  // eslint-disable-next-line no-new-func
  const sized = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: height })
  const placed = sized.bandBox(fakeColumn(0, height))
  return (placed.top + placed.height / 2) / height
})
check('the band sits in the bottom third of the column at every window height',
  thirds.every((centre) => centre >= 2 / 3))
// The band must still be bigger on a tall window. The stub's `innerHeight` has to match the
// column, because the band is capped by the visible bottom: with a fixed 900px viewport a
// 1440px column would be capped and the comparison would measure the cap, not the growth.
// eslint-disable-next-line no-new-func
const tallApi = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: 1440 })
// eslint-disable-next-line no-new-func
const shortApi = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: 600 })
check('the band grows with the window',
  tallApi.bandBox(fakeColumn(0, 1440)).height > shortApi.bandBox(fakeColumn(0, 600)).height)
// The reserve must NOT grow with the window; only the band should.
const reserves = sizes.map((height) => bandOf.footerHeight(fakeColumn(0, height)))
check('the reserved strip does not grow with the window',
  Math.max(...reserves) - Math.min(...reserves) <= 8)

// ── 梦海游鱼 draws TWO effects, not one ────────────────────────────────────────
//
// The bubbles and the glowing motes are separate effects that coexist. An earlier revision
// replaced the bubbles with the motes, which was not what was asked for, so this pins the
// distinction: the scene markup must carry both containers, and the bubble rules must keep
// the inset ring that makes them read as bubbles rather than glows.
const dreamMarkup = api.dreamAmbientScene(9, 5, 3)
check('the dream scene draws bubbles AND glowing motes',
  /class="dof-bubbles"/.test(dreamMarkup) && /class="dof-motes"/.test(dreamMarkup))
check('the dream scene seeds the requested bubble count',
  (dreamMarkup.match(/class="dof-bubble"/g) ?? []).length === 9)
check('the dream scene seeds the requested mote count',
  (dreamMarkup.match(/class="dof-mote"/g) ?? []).length === 5)
// The rules are written as multi-line array entries, so the match spans the joined text.
check('the bubbles keep their outlined-sphere look',
  /dof-bubble\{position:absolute;bottom:-1em;border-radius:50%;[\s\S]{0,260}box-shadow:inset 0 0 0 1px/.test(source))
check('the motes carry a light-blue halo',
  /dof-mote\{position:absolute;bottom:-1em;border-radius:50%;[\s\S]{0,320}box-shadow:0 0 10px 3px rgba\(122,205,255/.test(source))
check('the two effects animate on separate keyframes',
  /@keyframes dsh-amb-rise/.test(source) && /@keyframes dsh-amb-mote/.test(source))

// ── 梦海游鱼的蓝色小鱼 ───────────────────────────────────────────────────────
//
// The fish come from the source system's own `FishAnimation.vue` and are a THIRD effect,
// alongside the bubbles and the motes. They are the element the user noticed missing, so
// their presence, artwork and colours are pinned here.
const fishMarkupOut = api.fishMarkup('1', 2.4, 26, 34, -4, false)
check('a fish is drawn as its own container', /class="dof-fish"/.test(fishMarkupOut))
check('the fish carries the source body curve',
  fishMarkupOut.includes('M10 10 C20 5 35 5 45 10 C40 15 25 15 10 10 Z'))
check('the fish carries tail, dorsal and pectoral fins',
  fishMarkupOut.includes('M10 10 L5 7 L5 13 Z')
    && fishMarkupOut.includes('M20 7 L25 3 L30 7')
    && fishMarkupOut.includes('M35 9 L40 12 L45 9'))
check('the fish carries the three-part eye',
  (fishMarkupOut.match(/<circle/g) ?? []).length === 3)
check('the fish use the theme blue family (the source sticker blues are gone)',
  fishMarkupOut.includes('#5FA5D6') && fishMarkupOut.includes('#2B6E9E')
    && !fishMarkupOut.includes('#38bdf8') && !fishMarkupOut.includes('#1d4ed8'))
check('the fish render slightly translucent so they read as underwater',
  /class="dof-fish" style="position:absolute;left:0;opacity:\.94/.test(fishMarkupOut))
check('the fish swims on its own keyframes', /animation:dsh-amb-swim /.test(fishMarkupOut))
check('a mirrored fish swims back with the opposite animation',
  /animation:dsh-amb-swim-back /.test(api.fishMarkup('2', 1.7, 52, 46, -18, true)))
check('the fish bob and the tail beats',
  /dof-fish-bob/.test(fishMarkupOut) && /dof-fish-tail/.test(fishMarkupOut))

check('the dream scene seeds the requested fish count',
  (dreamMarkup.match(/class="dof-fish[" ]/g) ?? []).length === 3)
check('all three dream effects are drawn together',
  /class="dof-bubbles"/.test(dreamMarkup)
    && /class="dof-motes"/.test(dreamMarkup)
    && /class="dof-fish-layer"/.test(dreamMarkup))
// The fish layer's stacking is set inline, not by a rule, so it is checked on the markup.
check('the fish layer sits above the water plants',
  /class="dof-fish-layer" style="position:absolute;inset:0;z-index:6/.test(dreamMarkup)
    && /dof-seaweed\{[^}]*z-index:5\}/.test(source))

// ── the water-floor band (integration with the sidebar gradient) ─────────────
//
// The shan scene reads as one piece because its mountains fill the band and meet
// the sidebar gradient with colours from the same family. The dream scene used to
// float loose blades over a transparent background, which read as stickers. The
// floor band is the dream equivalent of shan's pond: it starts fully transparent —
// so the sidebar's own gradient shows through at the junction — and deepens
// downward, with the seaweed layered on top of it.
check('the dream scene grounds the seaweed on a water-floor band',
  /class="dof-floor"/.test(dreamMarkup))
check('the floor starts fully transparent so the junction is seamless',
  /class="dof-floor" style="[^"]*rgba\(126,184,222,0\)/.test(dreamMarkup))
check('the floor sits below the seaweed so the blades root in it',
  /class="dof-floor" style="[^"]*z-index:4/.test(dreamMarkup)
    && /class="dof-seaweed" style="[^"]*z-index:5/.test(dreamMarkup))
check('the seaweed gradients stay in the theme blue family',
  api.seaweedMarkup().includes('#1E6E93') && api.seaweedMarkup().includes('#4A78A8')
    && !api.seaweedMarkup().includes('#5568AC'))
// The preview mounts the scene into a `#dsh-theme-ambient` seat, while the live
// layer uses `.dsh-amb-control-scene`. The fish classes are styled in the live
// section only — without matching preview-seat rules, the preview draws fish that
// never mirror, bob or beat their tails: a lying preview.
check('the preview seat section styles the fish too',
  /#dsh-theme-ambient \.dof-fish-flip/.test(source)
    && /#dsh-theme-ambient \.dof-fish-bob/.test(source)
    && /#dsh-theme-ambient \.dof-fish-tail/.test(source))

// ── the light must not stop at the band edge ─────────────────────────────────
//
// The corner glow used to be centred ON the band's top edge at full brightness, so
// the scene box's overflow clip cut it into a hard white line against the un-lit
// middle of the sidebar — the boundary the user reported. Now it is dimmer, starts
// AT the edge, and is masked to zero there, while the theme's sidebar gradient
// carries a light-pool stop that continues the bloom above the edge, and the
// drifting washes fade at their own top and bottom edges instead of ending hard.
check('the corner glow is dimmed and masked to zero at the band edge',
  /dof-corner" style="[^"]*rgba\(255,255,255,\.55\)[^"]*mask-image:linear-gradient\(to bottom,transparent 0,#000 45%\)/
    .test(dreamMarkup))
check('the light washes fade at their own top and bottom edges',
  // Each wash carries the mask twice (-webkit- prefixed and plain), and the
  // prefixed form contains the plain one as a substring — hence four matches.
  (dreamMarkup.match(/mask-image:linear-gradient\(to bottom,transparent,#000 22%,#000 78%,transparent\)/g) ?? [])
    .length === 4)
check('the sidebar gradient carries the light-pool stop bridging the band edge',
  /#CDEEFC 70%/.test(source))
check('the bubbles and motes die before they can clip at the band top',
  /@keyframes dsh-amb-rise[\s\S]{0,200}-12\.5em[\s\S]{0,60}opacity:0/.test(source)
    && /@keyframes dsh-amb-mote[\s\S]{0,200}-13em[\s\S]{0,60}opacity:0/.test(source))

// ── the layer is synced from a body-wide observer, so repainting must be conditional ──
//
// Every resync re-assigning `innerHTML` rebuilt every scene node, which restarts all CSS
// animations from zero — the dragonflies, petals, motes and fish would snap back to their
// starting positions whenever the shell mutated the DOM. The markup is derived from the
// theme alone, so it only needs writing when it changes; the geometry is measured, so it
// must be written every pass.
check('the scene is not repainted when its markup is unchanged',
  /painted !== markup/.test(drawSource) && /dataset\.ambientMarkup = markup/.test(drawSource))
check('the scene markup is remembered on the box', /dataset\.ambientMarkup = markup/.test(drawSource))
check('the geometry is refreshed on every pass', /applySceneBox\(box, column\)/.test(drawSource))
check('the geometry write is separate from the paint', /function applySceneBox\(box, column\)/.test(source))

// ── the debug switch gates DETAIL, never bad news ────────────────────────────
//
// The panel's readings used to print unconditionally. That was right while the
// scenery was being brought up, and wrong once the package shipped: every user
// would read a paragraph of internals (geometry, hit tests, an attempt log). They
// are now opt-in — and the gate must never swallow a failure, which is the one
// lesson this project has had to re-learn most often.

const switchSource = [
  "const DEBUG_KEY = 'theme-gallery:debug'",
  block('debugEnabled'),
  block('sceneryLineIsWarning'),
].join('\n\n')

/**
 * Run the switch helpers against a stubbed window.
 * @param hash - the URL fragment ('' for none).
 * @param flag - the localStorage value (null for absent).
 * @returns the two helpers, bound to the stub.
 */
function withWindow(hash, flag) {
  const store = { getItem: (key) => (key === 'theme-gallery:debug' ? flag : null) }
  // eslint-disable-next-line no-new-func
  return new Function('window', `${switchSource}\nreturn { debugEnabled, sceneryLineIsWarning }`)(
    { location: { hash }, localStorage: store },
  )
}

check('the detail lines are off by default', withWindow('', null).debugEnabled() === false)
check('the detail lines stay off when storage holds something else',
  withWindow('', '0').debugEnabled() === false)
check('the URL fragment switches the detail lines on',
  withWindow('#theme-gallery-debug', null).debugEnabled() === true)
check('the localStorage flag switches the detail lines on',
  withWindow('', '1').debugEnabled() === true)
check('a missing window reports "off" instead of throwing',
  // eslint-disable-next-line no-new-func
  new Function('window', `${switchSource}\nreturn debugEnabled()`)(undefined) === false)

const switchApi = withWindow('', null)
check('a routine pass is not a warning',
  switchApi.sceneryLineIsWarning('装饰自检通过 · dream · 子元素=1') === false)
check('a ⚠ line counts as a warning',
  switchApi.sceneryLineIsWarning('⚠ 装饰未生效：报告缺失（期望 dream）') === true)
check('a failure line counts as a warning',
  switchApi.sceneryLineIsWarning('装饰自检失败: boom') === true)
check('a null line is not a warning', switchApi.sceneryLineIsWarning(null) === false)

// Structural guards, so a later edit cannot quietly make the line unconditional
// again — or make a failure invisible.
check('the panel decides the scenery line from the switch and the warning test',
  /const showScenery = scenery !== null && \(debugEnabled\(\) \|\| sceneryLineIsWarning\(scenery\)\)/
    .test(source))
check('the panel renders the scenery line through that decision',
  /showScenery\s*\n?\s*\?\s*jsx\('div', \{\s*\n\s*className: `tg-debug/.test(source))
check('the diagnostics line still renders only behind the switch',
  /debugEnabled\(\) \? jsx\('div', \{ className: 'tg-debug', children: themeDiagnostics\(selected\) \}\) : null/
    .test(source))

// ── the diagnostics belong BELOW the picker, and must say what they are ──────────
//
// A user read the two diagnostic lines as a malfunction — reasonably so, since they were a
// wall of monospace text sitting between the header and the theme cards. They now render
// below the cards, behind a caption that states they are intentional, and the block is set
// apart from the grid. Both the ordering (a source-order fact, assertable without a DOM)
// and the copy are pinned here.
const pageBody = block('ThemeGalleryPage')
// Self-check of the extractor itself, BEFORE anything is concluded from it: a truncated
// body (the destructured-parameter trap fixed above) would let every check below pass
// while reading nothing at all.
check('the extractor reads the whole panel body, not just its signature',
  pageBody.length > 1000 && pageBody.includes("className: 'tg-page'")
  && pageBody.includes('tg-head') && pageBody.includes('tg-grid'))
const gridAt = pageBody.indexOf("className: 'tg-grid'")
const diagAt = pageBody.indexOf("className: 'tg-diag'")
check('the diagnostics block renders after the theme cards', gridAt > 0 && diagAt > gridAt)
check('the block carries its own caption, rendered through the dictionary',
  /className: 'tg-diag-note', children: t\('diagNote'\)/.test(pageBody))
check('both diagnostic lines render inside that block',
  diagAt > 0
  && pageBody.indexOf('themeDiagnostics(selected)', diagAt) > diagAt
  && pageBody.indexOf('children: scenery', diagAt) > diagAt)
const diagNotes = [...source.matchAll(/diagNote: '([^']+)'/g)].map((match) => match[1])
check('the caption ships in both dictionaries', diagNotes.length === 2)
check('the caption says the readings are intentional, not an error report',
  diagNotes.length === 2 && diagNotes[0].includes('诊断')
  && diagNotes[0].includes('并非') && diagNotes[0].includes('报错'))
check('the page stylesheet sets the diagnostics block apart from the cards',
  /\.tg-diag\{[^}]*margin-top:\d+px/.test(source)
  && /\.tg-diag\{[^}]*border-top:/.test(source))

if (failed > 0) {
  console.error(`\n${failed} ambient markup check(s) failed`)
  process.exit(1)
}
console.log('\nambient markup checks passed')
