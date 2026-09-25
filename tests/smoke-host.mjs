/**
 * Smoke-test the real host module, and guard the two manifest facts that each once cost a
 * boot.
 *
 * FIRST: the plugin's client half declares service requirements, and Cordis' ARRAY-form
 * `inject` makes every entry REQUIRED. An entry that never becomes available parks the fiber
 * in `pending` forever, and the shell — which waits for every plugin before it leaves
 * "Loading plugins..." — never finishes starting:
 *
 *   web boot: 1 entry did not activate
 *   dsh-theme-gallery: pending (waiting for service: settingsScope)
 *
 * SECOND, and worse because it was silent: the HOST half used to request the `settings`
 * service from inside a deferred callback, hoping to reserve a settings section. `settingsScope`
 * is provided by the CLIENT half, so that callback could never run — and because nothing threw,
 * the app simply hung with no crash entry pointing at a cause. That section was never read by
 * anything either, so the call was pure risk and has been removed: `apply` is now inert and
 * synchronous.
 *
 * Both regressions are asserted below, because nothing else in this repository would catch
 * them.
 *
 * Run with: node tests/smoke-host.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apply, name, ThemeGallerySchema } from '../lib/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

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
 * Read the client half's declared service requirements out of lib/client.js.
 *
 * Parsed rather than imported: lib/client.js is a browser lazy-CJS bundle that
 * calls `window.__ModuleLoader__.load` at evaluation time, so importing it under
 * Node throws before any assertion could run.
 * @returns the service names, or null when the declaration is not found.
 */
function readClientInject() {
  const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
  const match = /exports\.inject\s*=\s*\[([^\]]*)\]/.exec(source)
  if (match === null) return null
  return match[1].split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
}

check('module exports a name', typeof name === 'string' && name.length > 0)
check('module exports apply', typeof apply === 'function')
// schemastery's Schema is a callable function-object: instances expose type/meta/toJSON.
check('ThemeGallerySchema is a schema instance', ThemeGallerySchema != null && typeof ThemeGallerySchema.type === 'string' && typeof ThemeGallerySchema.toJSON === 'function')

/* ---------- the host half must not wait on any service ---------- */

// `apply` is called by the loader on the host fiber. Anything it defers onto a service that
// this half cannot reach leaves that fiber pending and the application stuck on its loading
// screen, so the only acceptable body is one that touches no service at all.
const hostSource = readFileSync(join(root, 'lib', 'index.js'), 'utf8')
const hostCode = hostSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n')

let hostThrew = null
try {
  apply({})
} catch (error) {
  hostThrew = error
}
check('apply runs on a bare context without throwing', hostThrew === null)

let hostReachedOut = false
try {
  apply({
    inject: () => { hostReachedOut = true },
    settings: { register: () => { hostReachedOut = true } },
  })
} catch {
  // Reaching out is the failure this guards; a throw is reported by the check below.
}
check('apply does not reach for the settings service', hostReachedOut === false)
check('the host body contains no service request',
  !/ctx\.inject\s*\(/.test(hostCode) && !/\.register\s*\(/.test(hostCode))

/* ---------- manifest guards ---------- */

const clientSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const clientInject = readClientInject()
check('client half declares an inject list', Array.isArray(clientInject) && clientInject.length > 0)

// The regression guard. Cordis' ARRAY-form inject makes every entry required: an
// unavailable service parks the fiber in `pending` forever, and an unactivated
// entry fails the whole web boot —
//
//   web boot: 1 entry did not activate
//   dsh-theme-gallery: pending (waiting for service: settingsScope)
//
// `theme` is required again, and that is deliberate. The plan was to avoid the hazard entirely
// by taking it softly, but a context carrying an EMPTY inject list cannot read a service at all:
// the plugin showed "服务不可用" and never mounted. So the safety has to come from the two fixes
// that actually address the hangs — no `modifies` against the providing row, and the providing
// module declared in `dsh.client.inject` — not from weakening this list.
//
// That is also what the working plugins do: `dsh-theme-firefly` declares exactly `['theme']` in
// its client inject AND `@deepseek-ai/dsh-client-ui-theme` in its manifest.
const requiredServices = ['slots', 'locale', 'theme']
const forbiddenRequiredServices = [
  'settingsScope', 'remote', 'settings', 'remote.settings',
]
for (const required of requiredServices) {
  if ((clientInject ?? []).includes(required)) {
    console.log(`ok   client half requires the always-present service "${required}"`)
  } else {
    failed += 1
    console.log(`FAIL client half should require "${required}" — found ${JSON.stringify(clientInject)}`)
  }
}
for (const forbidden of forbiddenRequiredServices) {
  check(`client half does not hard-require "${forbidden}"`, !(clientInject ?? []).includes(forbidden))
}
// A "soft" attempt must not come back: it cannot work, and it fails silently from the user's
// point of view (no panel, plus a banner blaming a service).
// Comments describe the history; only real code counts for these two.
const clientCode = clientSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n')
check('no soft-inject machinery is present', !/withService\(/.test(clientCode))
check('the plugin never tells the user a service is missing', !/服务不可用/.test(clientCode))
// Nothing may re-introduce a settings-domain read: the picker's data source is
// the official theme registry, and ui-theme persists the choice itself.
check(
  'client half has no settings-domain dependency at all',
  !/settingsScope/.test(clientSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
)

// The picker lives in the left sidebar and the main column, not in Settings.
check('registers a sidebar panel entry', /name:\s*'sidebar\.panellist'/.test(clientSource))
check('registers the matching main-column page', /name:\s*'main'/.test(clientSource))
check('reads themes from the official registry', /ctx\.theme\.getTheme\(\)/.test(clientSource))
check('selects through the official theme service', /ctx\.theme\.setTheme\(/.test(clientSource))

// Every slot registration must WAIT for its target slot to be declared. The
// contract's own words: a callback effect belongs to the caller's fiber, and a
// registration into an undeclared slot creates a "pending wait" — the sidebar
// entry appeared and then vanished for exactly that reason. The official
// ui-plugin-manager wraps both of its registrations in ctx.slots.inject, and so
// must this plugin.
const registerCalls = (clientSource.match(/ctx\.slots\.register\(/g) ?? []).length
const injectCalls = (clientSource.match(/ctx\.slots\.inject\(/g) ?? []).length
check(
  `all ${registerCalls} slot registration(s) are gated by ctx.slots.inject (found ${injectCalls})`,
  injectCalls >= registerCalls && registerCalls >= 2,
)
check('gates the sidebar entry', /ctx\.slots\.inject\('sidebar\.panellist'/.test(clientSource))
check('gates the main page', /ctx\.slots\.inject\('main'/.test(clientSource))
check('contributes themes on the fiber that owns the theme service', /contribute\(ctx\.theme\.getTheme\(\)\)/.test(clientSource))

const clientDecl = manifest.dsh?.client
check('package.json declares dsh.client', clientDecl !== undefined && clientDecl !== null)
check('dsh.client.platform is web', clientDecl?.platform === 'web')
check('package.json declares dsh.bundle.patch', typeof manifest.dsh?.bundle?.patch === 'string')
// The bundle patch must NOT declare `modifies` against the row that provides `theme`:
// combined with `theme` in the client's inject it is a cycle, and both fibers hang.
check('the bundle patch declares no `modifies`',
  !/^\s*modifies:/m.test(readFileSync(join(root, 'cordis.patch.yml'), 'utf8')))

if (failed > 0) {
  console.error(`\n${failed} host smoke check(s) failed`)
  process.exit(1)
}
console.log('\nhost smoke checks passed')
