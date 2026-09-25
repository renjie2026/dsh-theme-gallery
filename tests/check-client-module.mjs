/**
 * Offline preflight for the client bundle's module shape.
 *
 * WHY THIS EXISTS
 * ---------------
 * The crash log recorded a web-boot failure two different ways — `pending (waiting for
 * service: settingsScope)` and plain `failed`. The second one means the browser-side entry
 * never activated at all, and the cheapest causes of that are mechanical: a syntax error, a
 * throw during module evaluation, or an `inject` list the framework refuses.
 *
 * The bundle cannot simply be imported under Node — it calls `window.__ModuleLoader__.load`
 * at evaluation time and expects a browser. But it CAN be evaluated against a minimal stub of
 * that loader, which is enough to prove:
 *
 *   - the file parses;
 *   - registration happens synchronously, with the expected id;
 *   - the factory can be invoked and returns an `apply` without throwing;
 *   - `inject` is a list of plain strings.
 *
 * Anything this catches is a boot hang that would otherwise cost a restart to discover.
 *
 * Run with: node tests/check-client-module.mjs
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

// ── parse the bundle ─────────────────────────────────────────────────────────
//
// A syntax error anywhere in a 3400-line file is a boot hang with no useful message. `new
// Function` compiles without running, which is exactly the check needed.
let parseError = null
try {
  // eslint-disable-next-line no-new-func
  new Function(source)
} catch (error) {
  parseError = error
}
check('the client bundle parses', parseError === null)
if (parseError !== null) console.error(`   ${parseError.message}`)

// ── evaluate it against a minimal module loader ──────────────────────────────
const registrations = []
const fakeWindow = {
  __ModuleLoader__: {
    load(spec) {
      registrations.push(spec)
    },
  },
  localStorage: {
    store: new Map(),
    getItem(key) { return this.store.has(key) ? this.store.get(key) : null },
    setItem(key, value) { this.store.set(key, String(value)) },
  },
}

/**
 * The seed modules the factory is allowed to require.
 *
 * The factory pulls its runtime from the loader's `require`, so the preflight has to answer
 * those requests or every `apply` call fails for a reason that has nothing to do with the
 * plugin. Only the shapes needed to reach the end of `apply` are supplied — this is a
 * loading check, not a behavioural one.
 * @param id - the module id requested.
 * @returns a minimal stand-in.
 */
function seedModule(id) {
  if (id === '@deepseek-ai/dsh-client-store') {
    return {
      defineStore: () => ({
        getState: () => ({ themes: [], selected: undefined, note: undefined, revision: 0 }),
        setState: () => {},
        subscribe: () => () => {},
      }),
    }
  }
  if (id === 'react') return { createElement: () => null, useState: () => [undefined, () => {}] }
  if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: null }
  if (id === '@deepseek-ai/cordis') return {}
  // Anything else is unexpected; returning an empty object keeps the check focused on
  // whether the MODULE shape is sound rather than on which helper is missing.
  return {}
}

let evalError = null
try {
  // eslint-disable-next-line no-new-func
  new Function('window', 'document', 'require', source)(
    fakeWindow,
    undefined,
    seedModule,
  )
} catch (error) {
  evalError = error
}
check('the bundle evaluates without throwing', evalError === null)
if (evalError !== null) console.error(`   ${evalError.message}`)

check('it registers exactly one module', registrations.length === 1)

const spec = registrations[0]
check('the module is registered under the package id', spec?.id === 'dsh-theme-gallery')
check('the module exposes a factory', typeof spec?.factory === 'function')

// ── invoke the factory ───────────────────────────────────────────────────────
let exports_ = null
let factoryError = null
try {
  exports_ = spec.factory(fakeWindow.__ModuleLoader__.require ?? (() => ({})))
} catch (error) {
  factoryError = error
}
check('the factory returns without throwing', factoryError === null)
if (factoryError !== null) console.error(`   ${factoryError.message}`)

check('the module flags itself as a plugin', exports_?.isPlugin === true)
check('the module exports an apply', typeof exports_?.apply === 'function')

// ── the inject list the framework will act on ────────────────────────────────
const inject = exports_?.inject
check('inject is an array', Array.isArray(inject))
// Cordis accepts an object form too; the array form makes every entry REQUIRED, so this
// plugin's whole boot-safety argument depends on it staying an array of plain strings.
check('every inject entry is a plain string',
  Array.isArray(inject) && inject.every((entry) => typeof entry === 'string'))

// ── apply must survive a hostile context ─────────────────────────────────────
//
// The framework calls `apply(ctx)` on mount. If it throws, the fiber never settles and the
// shell waits on "Loading plugins..." forever. The stub below provides nothing at all, which
// is the worst case: every optional lookup inside must degrade rather than throw.
let applyError = null
try {
  exports_.apply({})
} catch (error) {
  applyError = error
}
check('apply survives a context with no services', applyError === null)
if (applyError !== null) console.error(`   ${applyError.message}`)

// A context that records what the plugin asks for, so a new hard dependency is visible, and
// that carries the services the inject list promises.
const asked = []
let mountFailureNote = null
const stubDocument = {
  head: { append: () => {} },
  body: { append: () => {}, querySelector: () => null, addEventListener: () => {} },
  documentElement: { append: () => {} },
  createElement: () => ({
    dataset: {}, style: { setProperty: () => {} }, setAttribute: () => {},
    append: () => {}, appendChild: () => {}, remove: () => {},
  }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: 'visible',
}
const recording = {
  document: stubDocument,
  inject(services) { asked.push(...(Array.isArray(services) ? services : [services])) },
  effect(callback) {
    try { callback() } catch (error) { mountFailureNote = error }
    return () => {}
  },
  on() { return () => {} },
  slots: { inject() {}, register() { return () => {} } },
  locale: { register() {} },
  theme: {
    getTheme: () => ({
      active: { id: 'light', tokens: {} }, themes: [], preference: 'light', fontSize: 14, revision: 1,
    }),
    register() {},
    setTheme() {},
    overrideTokens: () => () => {},
  },
}
let richApplyError = null
try {
  exports_.apply(recording)
} catch (error) {
  richApplyError = error
}
check('apply survives a context with the injected services', richApplyError === null)
if (richApplyError !== null) console.error(`   ${richApplyError.message}`)
check('apply asks for nothing beyond the declared inject list',
  asked.every((name) => (inject ?? []).includes(name)))
check('the plugin marks itself as a plugin, not a plain service module',
  exports_?.isPlugin === true)

if (failed > 0) {
  console.error(`\n${failed} client module check(s) failed`)
  process.exit(1)
}
console.log('\nclient module checks passed')
