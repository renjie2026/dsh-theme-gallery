/**
 * Bounded-work checks for the ambient layer.
 *
 * WHY THIS EXISTS
 * ---------------
 * The plugin hung the application a second way, after the boot deadlock was fixed: the UI froze
 * while the machine stayed responsive, and the renderer process grew without limit. Measured on
 * the real app over 305 s of wall clock:
 *
 *   renderer RSS   11,231 MB   (main / Host / GPU / network were all normal at 57–244 MB)
 *   renderer CPU   ~820 s      ≈ 2.7 cores saturated
 *
 * CPU far exceeding wall clock means work was happening every frame rather than blocking, and
 * RSS climbing linearly means every tick allocated nodes and objects that were never released.
 * The ambient layer was the only part of this plugin doing per-frame DOM work, so the rule this
 * file enforces is simple:
 *
 *   NOTHING IN THE AMBIENT PATH MAY RUN UNBOUNDED, AND NOTHING MAY BE DRIVEN BY ITS OWN WRITES.
 *
 * Each assertion below pins one part of that. They are static, because the failure mode is a
 * feedback loop between a `MutationObserver` and the code it observes — which cannot be
 * reproduced faithfully without the real shell's mutation volume.
 *
 * Run with: node tests/check-bounded-work.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from './lib/scope-reach.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/**
 * 结构视图：注释与字符串内容抹成空格，**长度与换行保持不变**。
 *
 * 断言正文必须跑在这份文本上，而不是原文上。理由是真实发生过的：本文件的
 * "the sync 只有一次渲染调用" 这一条，被 `syncAmbient` 里一句**注释**（提到了
 * `drawScene()`）数成了两次 —— 规则 7 记过同一个坑两次，这是第三次。
 * 因为 `blankNonCode` 保持长度，下方的下标与花括号配对仍然有效。
 */
const structural = blankNonCode(source)

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

/** Strip comments, so prose about a construct is never mistaken for the construct. */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n')

/**
 * The body of a top-level function, by brace matching.
 * @param name - the function name.
 * @returns the body text.
 */
function block(name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`function ${name} not found`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') { depth -= 1; if (depth === 0) return source.slice(start, i + 1) }
  }
  throw new Error(`could not find the end of ${name}`)
}

// ── 1. the sync must not be driven by its own writes ─────────────────────────
//
// The observer watches the whole body, and the sync writes to the same body. Feeding one into
// the other is precisely the runaway that produced 11 GB.
const observerLine = code.match(/ambientObserver = new MutationObserver\(([^)]*)\)/)
check('the body observer exists', observerLine !== null)
check('the observer is wired to the coalescing entry point, not straight to the sync',
  observerLine !== null && !/\bresync\b/.test(observerLine[1]) && /requestSync/.test(observerLine[1]))

const requestSyncBody = block('applyGallery').includes('const requestSync')
check('the coalescing entry point is defined', requestSyncBody || /const requestSync = \(\) => \{/.test(code))
check('a sync refuses to re-enter itself', /if \(syncInFlight\) \{/.test(code))
check('re-entry is refused specifically for our own writes', /our own write/i.test(source))
check('the in-flight flag is always cleared',
  /try \{\s*\n\s*resync\(\)\s*\n\s*\} finally \{\s*\n\s*syncInFlight = false/.test(code))

// ── 2. the resize path must coalesce too ─────────────────────────────────────
//
// A resize burst fires many events; each one used to run a full sidebar measurement.
check('resize events go through the coalescing entry point',
  /ambientResizeHandler = \(\) => \{\s*\n\s*bindResize\(\)\s*\n\s*requestSync\(\)/.test(code))
check('the resize observer is wired to the coalescing entry point',
  /new ResizeObserver\(requestSync\)/.test(code))

// ── 3. the idempotence test must be CHEAP and must come FIRST ────────────────
//
// `footerHeight` walks every descendant of the sidebar. If the fingerprint were computed from
// that geometry, the guard would cost as much as the work it avoids.
const syncStart = structural.indexOf('    function syncAmbient(')
// Take the FUNCTION BODY by brace matching, not a fixed-size slice: a fixed window ran past the
// closing brace and swallowed the next function's definition, which made a "how many calls are
// there" count meaningless. Matched on the STRUCTURAL text, so a brace inside prose cannot move
// the body's end either.
const syncBody = (() => {
  const open = structural.indexOf('{', syncStart)
  let depth = 0
  for (let i = open; i < structural.length; i += 1) {
    if (structural[i] === '{') depth += 1
    else if (structural[i] === '}') { depth -= 1; if (depth === 0) return structural.slice(syncStart, i + 1) }
  }
  throw new Error('syncAmbient body not found')
})()
const fpAt = syncBody.indexOf('const fingerprint =')
const guardAt = syncBody.indexOf('lastAmbientFingerprint && ambientReport !== undefined')
const bandAt = syncBody.indexOf('bandBox(')
// The single render path. There used to be two (`paintAmbient` plus `ensureControl`), which
// duplicated every animated element on screen.
const paintAt = syncBody.indexOf('drawScene(')
check('the sync computes a fingerprint', fpAt >= 0)
check('the fingerprint is compared before any DOM write',
  guardAt >= 0 && paintAt >= 0 && guardAt < paintAt)
check('there is exactly one render call in the sync',
  (syncBody.match(/drawScene\(/g) ?? []).length === 1)
check('the fingerprint itself does not call the expensive geometry',
  fpAt >= 0 && !/const fingerprint =[\s\S]{0,700}?bandBox\(/.test(syncBody))
// The one geometry call it may make is a single bounding-box read, which is cheap.
check('the fingerprint reads only bounding boxes',
  /const columnRect = column\.getBoundingClientRect\(\)/.test(syncBody))
check('an unchanged fingerprint returns before touching the tree',
  /if \(fingerprint === lastAmbientFingerprint[\s\S]{0,200}?return/.test(syncBody))
check('the expensive geometry is only reached past the guard',
  bandAt < 0 || guardAt < bandAt)

// ── 4. every loop in the ambient path has a hard bound ───────────────────────
const loopStart = source.indexOf('    function repeatUntilStable(')
const loopBody = source.slice(loopStart, loopStart + 4000)
check('the settling loop has a deadline', /maxMs/.test(loopBody) && /now\(\) - startedAt > maxMs/.test(loopBody))
check('the settling loop has a stability requirement', /stableTicks/.test(loopBody))
check('the settling loop returns instead of rescheduling when done',
  /if \(settled \|\| now\(\) - startedAt > maxMs\) return/.test(loopBody))
check('the settling loop can be stopped from outside', /stop\(\) \{/.test(loopBody))
check('the settling loop is stopped when the effect is disposed', /settling\.stop\(\)/.test(code))
check('the settling deadline is a plain finite number',
  /maxMs: \d+,/.test(code) && !/maxMs: Infinity/.test(code))

// ── 5. no unbounded frame loop anywhere ──────────────────────────────────────
//
// A self-perpetuating `requestAnimationFrame` chain is the classic shape of this bug, and one
// existed in an earlier revision.
check('no requestAnimationFrame chain re-schedules itself unconditionally',
  !/requestAnimationFrame\(\s*settle\s*\)/.test(code))
const rafCalls = (code.match(/requestAnimationFrame\(/g) ?? []).length
check(`requestAnimationFrame is used at most twice (found ${rafCalls})`, rafCalls <= 2)
check('the frame helper schedules a one-shot callback', /function step\(callback\) \{/.test(code))

// ── 6. the ambient effect cleans up everything it installs ───────────────────
const effectStart = source.indexOf("}, 'theme-gallery: scenery follows the sidebar')")
const effectBody = source.slice(Math.max(0, effectStart - 6000), effectStart)
for (const [label, pattern] of [
  ['the mutation observer', /ambientObserver\.disconnect\(\)/],
  ['the resize observer', /ambientResizeObserver\.disconnect\(\)/],
  ['the window resize listener', /removeEventListener\('resize', ambientResizeHandler\)/],
  ['the visibility listener', /removeEventListener\('visibilitychange', visibilityHandler\)/],
  ['the settling loop', /settling\.stop\(\)/],
  ['the paint watcher', /paintWatch\.stop\(\)/],
]) {
  check(`the effect tears down ${label}`, pattern.test(effectBody))
}

// ── 7. the scene is not rebuilt on every pass ────────────────────────────────
//
// Re-assigning `innerHTML` rebuilt every scene node, which restarts all CSS animations from
// zero — visible as the artwork snapping back to its starting position several times a second.
check('the scene markup is only written when it changes',
  /painted !== markup/.test(code) && /dataset\.ambientMarkup = markup/.test(code))
check('the geometry is refreshed without repainting', /applySceneBox\(box, column\)/.test(code))
// One DOM copy, not two. Two copies meant two of every animated element on screen.
check('the scene is written to exactly one container',
  (code.match(/\.innerHTML = String\(markup\)/g) ?? []).length === 1)

// ── 8. 计数断言的自检：两个方向都要成立（规则 6 / 规则 7）─────────────────────
//
// "该抓的抓住"：真的多一条渲染调用必须被数出来；
// "不该报的不报"：注释里提到 `drawScene()` 不算一次调用 —— 这个坑本仓库已经是第三次，
// 所以把自检写进文件里，而不是只修好这一次。
/**
 * 在给定文本上数 `syncAmbient` 函数体里的渲染调用。
 * @param text - 已经抹掉注释/字符串的结构文本。
 * @returns 调用次数。
 */
function countRenders(text) {
  const start = text.indexOf('    function syncAmbient(')
  if (start < 0) throw new Error('syncAmbient not found')
  const open = text.indexOf('{', start)
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return (text.slice(start, i + 1).match(/drawScene\(/g) ?? []).length
    }
  }
  throw new Error('syncAmbient body not found')
}

check('自检：真实源码里，注释提到的 drawScene() 不算一次渲染调用',
  countRenders(structural) === 1)

const mutSecondRender = source.replace(
  'const placement = drawScene(column, markup, kind)',
  'const placement = drawScene(column, markup, kind)\n      const second = drawScene(column, markup, kind)',
)
check('自检：注入第二条渲染调用的变异真的改动了源码', mutSecondRender !== source)
check('自检：注入第二条渲染调用后必须数出 2 条（否则这条断言什么都没测）',
  countRenders(blankNonCode(mutSecondRender)) === 2)

if (failed > 0) {
  console.error(`\n${failed} bounded-work check(s) failed`)
  process.exit(1)
}
console.log('\nbounded-work checks passed')
