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

/** Grab `function name(...) { ... }` by brace matching. */
function block(name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`lib/client.js: function ${name} not found`)
  const open = source.indexOf('{', start)
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
].join('\n\n')

// eslint-disable-next-line no-new-func
const api = new Function(`${builderSource}\nreturn { shanAmbientScene, dragonflyMarkup, dreamAmbientScene, seaweedMarkup, rippleMarkup, dragonflyBlock, bladeMarkup, fishMarkup, open }`)()

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

if (failed > 0) {
  console.error(`\n${failed} ambient markup check(s) failed`)
  process.exit(1)
}
console.log('\nambient markup checks passed')
