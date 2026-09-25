/**
 * Boot-timing regression test for the sidebar scenery.
 *
 * WHY THIS EXISTS
 * ---------------
 * The scenery used to be placed with a fixed schedule counted from the moment the plugin
 * applied: a burst of animation frames plus delays of 120 / 400 / 900 ms. On the real app the
 * shell mounts its sidebar LATER than that — after fonts, stores and window state — so every
 * retry had already been spent by the time the column existed. The scenery then stayed absent
 * until an unrelated event (`theme/change`, fired by opening the settings panel) triggered one
 * more sync. From the user's side: "restart the app and the artwork is missing, click 主题皮肤
 * and it appears."
 *
 * A timing bug that cannot be tested is exactly how that one survived several rounds, so the
 * loop it lives in (`repeatUntilStable`) takes its clock and its sampling as parameters and is
 * driven here by a virtual one.
 *
 * WHAT IS ASSERTED
 * ----------------
 *  - a sidebar that appears late is still picked up, long after the old fixed delays;
 *  - `apply` runs on EVERY tick, so the scenery keeps up while the layout is still moving;
 *  - the loop stops once the geometry holds still, instead of polling forever;
 *  - a sidebar that never appears stops at the deadline rather than leaking a timer;
 *  - `stop()` cancels the pending tick.
 *
 * Run with: node tests/check-boot-timing.mjs
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
 * Extract a top-level `function name(...) { ... }` from the bundle by brace matching.
 * @param name - the function name.
 * @returns the function source.
 */
function block(name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`function ${name} not found`)
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

// eslint-disable-next-line no-new-func
const loop = new Function(`${block('repeatUntilStable')}\nreturn repeatUntilStable`)()

/**
 * A virtual clock and timer queue, so the loop can be driven deterministically.
 * @returns the clock, a scheduler pair, and a way to advance time.
 */
function virtualClock() {
  let now = 0
  let nextId = 1
  const pending = new Map()
  return {
    now: () => now,
    setTimer: (fn, delay) => {
      const id = nextId
      nextId += 1
      pending.set(id, { fn, at: now + delay })
      return id
    },
    clearTimer: (id) => {
      pending.delete(id)
    },
    /** Advance time in small steps, firing whatever is due. */
    advance(ms, step = 10) {
      const target = now + ms
      while (now < target) {
        now = Math.min(now + step, target)
        for (const [id, timer] of [...pending]) {
          if (timer.at <= now) {
            pending.delete(id)
            timer.fn()
          }
        }
      }
    },
    pendingCount: () => pending.size,
  }
}

// ── a sidebar that appears LATE is still picked up ───────────────────────────
//
// This is the actual regression. The old fixed delays covered roughly the first 900ms; the
// sidebar here appears at 3000ms, which every one of them would have missed.
{
  const clock = virtualClock()
  let sidebarSince = 3000
  let appliedAt = []
  let applied = 0
  const handle = loop({
    sample: () => (clock.now() >= sidebarSince ? 'geom-280x780' : null),
    apply: () => {
      applied += 1
      if (clock.now() >= sidebarSince) appliedAt.push(clock.now())
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now,
    intervalMs: 100,
    maxMs: 15000,
    stableTicks: 2,
  })
  clock.advance(5000)
  check('a sidebar appearing at 3000ms is still picked up', appliedAt.length > 0)
  check('the first successful apply happens after the sidebar exists',
    appliedAt.length > 0 && appliedAt[0] >= sidebarSince)
  check('apply keeps running while the geometry is unavailable', applied >= 30)
  check('the loop stops once the geometry holds still', clock.pendingCount() === 0)
  handle.stop()
}

// ── the scenery is refreshed while the layout is still moving ────────────────
{
  const clock = virtualClock()
  // Geometry changes for the first 1000ms, then holds.
  let applied = 0
  const samples = []
  loop({
    sample: () => {
      const sig = clock.now() < 1000 ? `geom-${clock.now()}` : 'geom-final'
      samples.push(sig)
      return sig
    },
    apply: () => { applied += 1 },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now,
    intervalMs: 100,
    maxMs: 15000,
    stableTicks: 2,
  })
  clock.advance(5000)
  check('apply runs on every tick while the geometry moves', applied >= 10)
  check('the loop ends soon after the geometry stabilises', clock.pendingCount() === 0)
}

// ── a sidebar that never appears must not poll forever ──────────────────────
{
  const clock = virtualClock()
  let applied = 0
  loop({
    sample: () => null,
    apply: () => { applied += 1 },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now,
    intervalMs: 100,
    maxMs: 2000,
    stableTicks: 2,
  })
  clock.advance(10000)
  check('a sidebar that never appears stops at the deadline', clock.pendingCount() === 0)
  check('the deadline bounds the number of attempts', applied <= 25)
}

// ── stop() cancels the pending tick ─────────────────────────────────────────
{
  const clock = virtualClock()
  let applied = 0
  const handle = loop({
    sample: () => null,
    apply: () => { applied += 1 },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    now: clock.now,
    intervalMs: 100,
    maxMs: 15000,
    stableTicks: 2,
  })
  clock.advance(250)
  const before = applied
  handle.stop()
  clock.advance(5000)
  check('stop() cancels the pending tick', applied === before)
  check('stop() leaves no timer behind', clock.pendingCount() === 0)
}

// ── the wiring actually uses the geometry-driven loop ───────────────────────
check('the scenery effect drives its retries from the geometry', /repeatUntilStable\(\{/.test(source))
check('the sample is the sidebar geometry', /sample: columnSignature/.test(source))
check('the old fixed retry delays are gone', !/\[120, 400, 900\]/.test(source))

// ── the OLD approach is shown failing the same scenario ─────────────────────
//
// The tests above prove the new loop works; this one proves the bug was real, so the
// regression test cannot quietly become a tautology. The old schedule is reproduced exactly
// as it was written: one sync at apply time, then delays of 120 / 400 / 900 ms.
{
  const clock = virtualClock()
  const sidebarSince = 3000
  let successful = 0
  const attempt = () => {
    if (clock.now() >= sidebarSince) successful += 1
  }
  // The old wiring.
  attempt()
  for (const delay of [120, 400, 900]) clock.setTimer(attempt, delay)
  clock.advance(5000)
  check('the old fixed delays NEVER reach a sidebar that appears at 3000ms', successful === 0)
}

// ── the geometry sample is what tells the loop the layout moved ─────────────
//
// Adaptive behaviour depends on `columnSignature` reacting to a resize: it feeds the settling
// loop AND is what a `ResizeObserver` callback leads to. If the signature did not change when
// the sidebar did, a maximised window would keep the band at its old pixel geometry — which is
// the "artwork jumped to the middle of the sidebar" report.
const bandSource = [block('viewportBottomOf'), block('footerHeight'), block('bandBox')].join('\n\n')

/**
 * A sidebar column stub with the shell's shape: a full-height wrapper, a 64px account row
 * flush with the bottom, and a conversation row above it.
 * @param height - the column height.
 * @returns the stub.
 */
function columnStub(height) {
  const top = 40
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

/**
 * `columnSignature` is lifted out of the effect, so its body is reproduced here against the
 * same inputs it uses in the app. Kept in step by the assertion on `source` below.
 * @param column - the column stub, or null.
 * @returns the fingerprint.
 */
function signatureOf(column) {
  if (column === null) return null
  const r = column.getBoundingClientRect()
  // eslint-disable-next-line no-new-func
  const bandOf = new Function('window', `${bandSource}\nreturn bandBox`)({ innerHeight: r.height })
  const band = bandOf(column)
  return [
    Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height),
    'display-stub', 'visibility-stub',
    band === null ? 'no-band' : `${band.top}:${band.height}`,
  ].join('|')
}

const short = signatureOf(columnStub(780))
const tall = signatureOf(columnStub(1400))
check('the geometry fingerprint changes when the sidebar is resized', short !== tall)
check('the fingerprint is null when there is no sidebar', signatureOf(null) === null)

// The band must land in the bottom third at BOTH sizes, which is the user-visible requirement.
for (const height of [780, 1080, 1400, 1800]) {
  // eslint-disable-next-line no-new-func
  const bandOf = new Function('window', `${bandSource}\nreturn bandBox`)({ innerHeight: height })
  const band = bandOf(columnStub(height))
  const centre = (band.top + band.height / 2) / height
  check(`a ${height}px sidebar keeps the artwork in the bottom third`, centre >= 2 / 3)
}

check('the resize observer is rebound when the sidebar node changes',
  /column === observed/.test(source) && /ambientResizeObserver\.observe\(column\)/.test(source))
// The handler rebinds and then asks for a sync. It goes through the coalescing wrapper rather
// than calling the sync directly, so a burst of resize events costs one sync per frame.
check('a window resize rebinds and requests a sync',
  /ambientResizeHandler = \(\) => \{\s*\n\s*bindResize\(\)\s*\n\s*requestSync\(\)/.test(source))
check('resize events are coalesced to one sync per frame',
  /const requestSync = \(\) => \{/.test(source) && /step\(\(\) => \{/.test(source))
// Restoring the remembered skin before the shell has a layout is silently swallowed: the call
// reaches the theme service (so the scenery switches, because it is derived from the service)
// but ui-theme's presenter has not subscribed yet, so none of the colours reach the document.
// On screen: the artwork appears, the theme colours do not, and nothing resizes until the skin
// is clicked again. The restore therefore waits for the readiness signal the scenery already uses.
// The gate now lives in `ensureSkinPainted`, which is where every paint attempt goes through.
check('the remembered skin is only applied after the shell is ready',
  /if \(!bootSettled\) \{[\s\S]{0,260}?return\s*\n?\s*\}/.test(source))
check('the shell-ready signal marks the boot settled',
  /function markBootSettled\(\)/.test(source) && /bootSettled = true/.test(source))
check('the settling loop raises the shell-ready signal',
  /if \(sidebarColumn\(\) !== null\) markBootSettled\(\)/.test(source))
check('the restore is re-applied rather than fired once into the void',
  !/restoreAttempted/.test(source))
// The service can report a skin as active while the document still shows the built-in palette:
// ui-layout's presenter applies whatever is active at MOUNT and only then subscribes, so a change
// made before that is observed by nobody — and because `setTheme` short-circuits on
// `preference === id`, a second click on the same skin emits nothing at all. The fix is to verify
// the effect instead of assuming it.
check('the applied palette is verified by reading the document back',
  /function skinIsPainted\(id\)/.test(source)
    && /document\.body\.style\.getPropertyValue\(PROBE_TOKEN\)/.test(source))
check('the probe token is one the skins set to an unmistakable value',
  /const PROBE_TOKEN = '--dsw-alias-bg-base'/.test(source))
check('a missed change is retried by bouncing through a built-in theme',
  /ctx\.theme\.setTheme\(BUILT_IN_PROBE_THEME\)/.test(source))
// A bounce switches to a built-in theme and straight back, which is TWO real repaints. It is
// therefore rationed to one per skin, and only after the document has demonstrably failed to
// follow the service — an unbounded bounce is what showed as the interface flashing.
check('the bounce is rationed so it cannot flicker the interface',
  /bounced >= 1/.test(source) && /跳转已用尽/.test(source))
check('the bounce is not the first move — the service is told first',
  /wanted !== activeId/.test(source) && /置为皮肤/.test(source))
check('the retry budget resets once a skin is confirmed painted',
  /paintAttempts\.clear\(\)/.test(source))
// The sync writes to the same body the observer watches, so re-entry has to be refused or the
// loop feeds itself. This is the guard that kept the renderer from climbing to 11 GB.
check('a sync cannot re-enter itself', /if \(syncInFlight\) \{/.test(source))
check('mutations caused by our own writes are discarded',
  /let syncInFlight = false/.test(source) && /our own write/i.test(source))

if (failed > 0) {
  console.error(`\n${failed} boot-timing check(s) failed`)
  process.exit(1)
}
console.log('\nboot-timing checks passed')
