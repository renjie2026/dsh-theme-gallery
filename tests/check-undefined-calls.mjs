/**
 * Catch calls to helpers that were never defined.
 *
 * This exists because it happened: two functions were called from `syncAmbient`
 * while the edit that was supposed to define them had failed. Every check passed —
 * syntax is valid, markup tests are green, the host smoke test only loads the other
 * half — and the failure would only appear at runtime as a `ReferenceError`, i.e. as
 * "the plugin did nothing again" after a full reinstall-and-restart cycle.
 *
 * The bundle cannot be imported (it is a browser lazy-CJS factory), so this reads the
 * source and checks that every bare `name(...)` call resolves to a `function name(`
 * declaration, an assignment, or a known global.
 *
 * Run with: node tests/check-undefined-calls.mjs
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

/** Everything defined anywhere in the file: functions, consts, lets, params. */
const defined = new Set()
for (const match of source.matchAll(/(?:function\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/g)) {
  defined.add(match[1])
}
// Destructured bindings and class names too.
for (const match of source.matchAll(/(?:const|let)\s*\{([^}]+)\}/g)) {
  for (const part of match[1].split(',')) {
    const name = part.split(':').pop().trim().split('=')[0].trim()
    if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name)
  }
}
for (const match of source.matchAll(/(?:const|let)\s*\[([^\]]+)\]/g)) {
  for (const part of match[1].split(',')) {
    const name = part.trim().split('=')[0].trim()
    if (/^[A-Za-z_$][\w$]*$/.test(name)) defined.add(name)
  }
}
// Destructured PARAMETERS, e.g. `function Page({ useStore, usePanelInfo })`. These are
// plain functions in the component's scope, so the scan sees a bare call and needs
// them treated as defined.
for (const match of source.matchAll(/function\s+[A-Za-z_$][\w$]*\s*\(([^)]*)\)/g)) {
  for (const name of match[1].matchAll(/[A-Za-z_$][\w$]*/g)) defined.add(name[0])
}

check('found definitions to compare against', defined.size > 40)

/**
 * Names that are legitimately not defined in this file.
 *
 * Deliberately narrow: every entry is a language or platform global, so adding one
 * to silence a finding is a visible decision rather than a reflex.
 */
const GLOBALS = new Set([
  'require', 'window', 'document', 'console', 'Object', 'Array', 'Set', 'Map', 'Math',
  'JSON', 'String', 'Number', 'Boolean', 'Promise', 'Error', 'TypeError', 'Symbol',
  'RegExp', 'Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  // 派生色值用到的两个标准全局函数。它们和 `Math` 一样是运行环境提供的，不是本包的
  // 名字 —— 列进来是为了让"未定义调用"这条断言继续只盯**本包自己的**名字。
  'parseInt', 'parseFloat',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'getComputedStyle',
  // `stop` is a method on the handle `repeatUntilStable` returns; the scan cannot tell a
  // method call from a bare one, so it is listed rather than special-cased.
  'requestAnimationFrame', 'cancelAnimationFrame', 'stop', 'if', 'for', 'while',
  'switch', 'catch', 'return', 'typeof', 'function', 'new', 'await', 'import', 'super',
])

/**
 * Blank out string literals, template literals and comments.
 *
 * Without this the scan reports every CSS function inside the stylesheet text —
 * `rgba(...)`, `translate(...)`, `var(...)` — as an undefined call, which buries the
 * one finding that matters.
 * @param text - the bundle source.
 * @returns the same length of text with those regions replaced by spaces.
 */
function blankNonCode(text) {
  let out = ''
  let mode = 'code'
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]
    if (mode === 'code') {
      if (ch === '/' && next === '/') { mode = 'line'; out += '  '; i += 1; continue }
      if (ch === '/' && next === '*') { mode = 'block'; out += '  '; i += 1; continue }
      if (ch === "'" || ch === '"' || ch === '`') { mode = ch; out += ' '; continue }
      out += ch
      continue
    }
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; out += '\n'; continue }
      out += ' '
      continue
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; out += '  '; i += 1; continue }
      out += ch === '\n' ? '\n' : ' '
      continue
    }
    // Inside a string or template literal.
    if (ch === '\\') { out += '  '; i += 1; continue }
    if (ch === mode) { mode = 'code'; out += ' '; continue }
    out += ch === '\n' ? '\n' : ' '
  }
  return out
}

const code = blankNonCode(source)

/** Calls that would throw at runtime if the name is genuinely absent. */
const findings = []
// A bare call: not preceded by `.` (a method), not a keyword, not `new X(`.
for (const match of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
  const name = match[2]
  if (GLOBALS.has(name)) continue
  if (defined.has(name)) continue
  findings.push(`${name}() — first seen near line ${code.slice(0, match.index).split('\n').length}`)
}

const unique = [...new Set(findings)]
check('no bare call targets an undefined name', unique.length === 0)
if (unique.length > 0) {
  for (const finding of unique) console.error(`  ${finding}`)
}

// A narrower, high-signal version of the same check: every helper this plugin calls
// by name must exist. These are the names the scenery path depends on.
//
// `placeAmbient` / `paintAmbient` / `ensureControl` / `wrapControl` were removed on purpose:
// the scene used to be drawn TWICE (into a `#dsh-theme-ambient` seat and into the
// `.dsh-amb-control` layer), and the duplicate DOM meant two of every animated element — which
// showed up as duplicated dragonflies. `drawScene` is now the single render path.
const REQUIRED = [
  'ensureAmbientStylesheet', 'removeStrayAmbientSeats', 'ambientStylesheetReady',
  'sceneMarkup', 'drawScene', 'applySceneBox', 'describeAmbient', 'hitTestAmbient',
  'sidebarColumn', 'syncAmbient', 'syncAccent', 'syncSkin', 'bundledTheme',
  'shanAmbientScene', 'dreamAmbientScene', 'dragonflyMarkup', 'seaweedMarkup',
  'attr', 'open', 'lighten', 'createGalleryStore', 'flatten',
]
for (const name of REQUIRED) {
  const isDefined = defined.has(name)
  if (!isDefined) failed += 1
  console.log(`${isDefined ? 'ok  ' : 'FAIL'} ${name} is defined`)
}

if (failed > 0) {
  console.error(`\n${failed} undefined-call check(s) failed`)
  process.exit(1)
}
console.log('\nundefined-call checks passed')
