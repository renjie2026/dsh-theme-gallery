/**
 * Boot-safety checks for the theme-gallery client plugin.
 *
 * WHY THIS EXISTS
 * ---------------
 * This plugin hung the whole desktop application twice. The shell waits for EVERY plugin's
 * fiber to settle before it leaves "Loading plugins...", and a fiber that never settles does
 * not merely log an error — it strands the UI. Three independent mistakes were found, and
 * they fail in two DIFFERENT ways, which is why the crash log is not always there to help:
 *
 *   1. `cordis.patch.yml` declared `modifies: [ui-theme]` while the client half also listed
 *      `theme` in its `inject`. That is a cycle: the loader was told to bring this row up
 *      before ui-theme AND after it, so both fibers waited on each other.
 *      Logged as: `dsh-theme-gallery: failed`.
 *   2. The HOST half asked for the `settings` service from a deferred callback. `settingsScope`
 *      is provided by the CLIENT half, so the callback could never run.
 *      Logged as: `dsh-theme-gallery: pending (waiting for service: settingsScope)`.
 *   3. The manifest declared no `dsh.client.inject`, so nothing guaranteed that the module
 *      providing the `theme` SERVICE was loaded before this plugin. The fiber then waits for
 *      a service that is never offered — and this case wrote NOTHING to the crash log, which
 *      made it look like a model or network fault.
 *
 * The lesson the third one teaches is the reason this file checks the manifest so carefully:
 * a missing module declaration is a silent hang, and silence is the hardest symptom to work
 * with. Everything below is static, because the client bundle is a browser lazy-CJS module
 * that cannot be imported under Node.
 *
 * Run with: node tests/check-boot-safety.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const client = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
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

// ── 1. no cycle with the theme service provider ──────────────────────────────
//
// `modifies` is an ORDERING declaration, not a description. Declaring it for the very row
// whose service this plugin injects tells the loader both "after ui-theme" (via inject) and
// "before ui-theme" (via modifies), which deadlocks both fibers.
check('the bundle patch no longer declares `modifies` on ui-theme',
  !/^\s*modifies:/m.test(patch))
check('the bundle patch still inserts the plugin row', /name:\s*dsh-theme-gallery/.test(patch))
check('the patch explains why `modifies` must not come back',
  /CYCLE/.test(patch) && /pending/.test(patch))

// ── 1b. the HOST half must not wait on any service either ────────────────────
//
// The host half shipped a deferred `ctx.inject(['settings'], ...)` that called
// `settings.register(...)`. `settingsScope` is provided by the CLIENT half, so a host-side
// module could never reach it: the callback never ran, the fiber never settled, and the app
// stopped at "Loading plugins...". The crash log from a real run reads
//
//     dsh-theme-gallery: pending (waiting for service: settingsScope)
//
// The section it reserved has never been read by anything, so the whole thing is gone. What
// matters for safety is the rule: nothing in this module may wait on a service.
const host = readFileSync(join(root, 'lib', 'index.js'), 'utf8')

// Comments describe the historical call; only real code counts.
const hostCode = host
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !/^\s*(\/\/|\*)/.test(line))
  .join('\n')

check('the host half does not call ctx.inject', !/ctx\.inject\s*\(/.test(hostCode))
check('the host half registers no settings section', !/\.register\s*\(/.test(hostCode))
check('the host half apply is synchronous and inert',
  /export function apply\(ctx\)\s*\{\s*\n\s*void ctx\s*\n\}/.test(hostCode))
check('no service name remains as a real dependency in the host half',
  !/\b(settingsScope|configForms|remote)\b/.test(hostCode))

// The host half's schemas are the validated contract for the bundled theme files, so they
// must stay in step with the client's scenes — they drifted once already, when `motes` and
// `fish` were added to the client only.
for (const field of ['petals', 'bubbles', 'motes', 'fish']) {
  check(`the host AmbientSchema still declares "${field}"`, new RegExp(`${field}:`).test(hostCode))
}

// ── 2. inject lists only services the official composition guarantees ─────────
//
// Two DIFFERENT lists are in play and both matter:
//
//   dsh.client.inject (package.json)  — MODULE ids the loader must load first
//   exports.inject    (lib/client.js) — SERVICE names the code reaches for at runtime
//
// The manifest list is the one that failed silently: with no module declared, nothing
// guarantees the `theme` service is ever provided, so the fiber waits for it forever and the
// crash log stays empty. Both working third-party plugins on this machine declare it —
// `dsh-theme-firefly` declares exactly `["@deepseek-ai/dsh-client-ui-theme"]`.
const clientInject = manifest.dsh?.client?.inject
check('the manifest declares dsh.client.inject', Array.isArray(clientInject))
check('the theme module is declared, so its service is provided before this plugin',
  Array.isArray(clientInject) && clientInject.includes('@deepseek-ai/dsh-client-ui-theme'))
check('the locale module is declared (the sidebar row label needs it)',
  Array.isArray(clientInject) && clientInject.includes('@deepseek-ai/dsh-client-locale'))
check('every declared client module is a full package id',
  Array.isArray(clientInject) && clientInject.every((id) => id.includes('/')))

const injectMatch = client.match(/exports\.inject\s*=\s*\[([^\]]*)\]/)
check('the plugin declares its inject list', injectMatch !== null)

const injected = injectMatch === null
  ? []
  : injectMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)

// The declared services. `slots` and `locale` come from the statically-composed UI packages;
// `theme` is provided by `@deepseek-ai/dsh-client-ui-theme`, whose MODULE is declared in
// `dsh.client.inject` above — that pair is what makes a hard dependency safe, and it is exactly
// the shape the working third-party client plugins on this machine use (`dsh-theme-firefly`
// declares `theme` and nothing else). The earlier hangs came from a `modifies` cycle and from
// the missing module declaration, NOT from `theme` being required.
const ALLOWED_INJECT = new Set(['slots', 'locale', 'theme'])
check('every injected service is one the official composition provides',
  injected.length > 0 && injected.every((name) => ALLOWED_INJECT.has(name)))
check('the inject list is exactly slots/locale/theme',
  injected.length === 3 && ['slots', 'locale', 'theme'].every((n) => injected.includes(n)))
// `theme` is used DIRECTLY. A context given an empty inject list cannot read the service at all,
// so a "soft" attempt is not a safer option here — it simply breaks the plugin, which is what
// showed up on the page as a "服务不可用" banner and no panel.
check('theme is used directly, with no soft-inject machinery',
  !/withService\(/.test(client) && /ctx\.theme\.register\(/.test(client))
// Comments describe the history; only real code counts.
const clientCode = client
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n')
check('the page never claims a service is missing', !/服务不可用/.test(clientCode))

// Services the hand-off explicitly warned about: they may never arrive, so listing them
// would turn a missing feature into a boot hang.
for (const risky of ['settings', 'configForms', 'remote', 'settingsScope']) {
  check(`"${risky}" is NOT a hard dependency`, !injected.includes(risky))
}

// ── 3. the apply body cannot throw out of the fiber ──────────────────────────
// The plugin flag is what makes this entry ACTIVATABLE at all. The web-boot log recorded
// `dsh-theme-gallery: failed` — distinct from `pending` — which is the shape a client module
// takes when it is evaluated but never activates as a plugin. Every working third-party
// client plugin on this machine declares it.
check('the client half marks itself as a plugin', /exports\.isPlugin\s*=\s*true/.test(client))
// The guard has to be the FIRST statement, so nothing runs outside it. The regex allows the
// explanatory comment block that sits between the signature and the `try`.
check('apply wraps its body in a guard',
  /exports\.apply\s*=\s*function apply\(ctx\)\s*\{[\s\S]{0,900}?\btry\s*\{\s*\n\s*applyGallery\(ctx\)/.test(client))
// The mount-body parameter is deliberately NOT named `ctx`: `applyGallery` publishes the context
// into a module-level binding that the factory-level helpers read, and a parameter of the same
// name would shadow that binding, making the assignment a silent no-op.
check('apply delegates to a named body', /function applyGallery\(pluginCtx\)/.test(client))
check('the plugin context is published for the factory-level helpers',
  /ctx = pluginCtx/.test(client) && /^\s*let ctx\b/m.test(client))
check('a mount failure is reported on the page, not swallowed',
  /reportMountFailure/.test(client) && /pluginError/.test(client))
check('the failure report cannot itself break the boot',
  /function reportMountFailure\(error\)\s*\{\s*\n\s*try \{/.test(client))

// ── 4. the persisted preference can only ever hold a built-in id ─────────────
//
// This is the fallback. Because a skin id is never written to `preference`, disabling or
// removing this plugin cannot make the app refuse to start: the next boot reads a built-in
// preference. The skin choice lives in localStorage, private to this plugin.
check('the skin id is remembered in localStorage, not in the preference',
  /localStorage\.setItem\(SKIN_KEY/.test(client))
check('the remembered skin is validated against the bundled set',
  /bundledTheme\(value\) !== undefined/.test(client))
check('the plugin never writes the settings preference field itself',
  !/host\.set\(\s*['"]preference['"]/.test(client))
check('the patch does not pin a skin id as the preference',
  !/preference:\s*(shan-qing-ting-cai|meng-hai-you-yu)/.test(patch))

// ── 5. the ambient layer is enhancement-only and cannot throw out ────────────
check('the scenery sync is called inside a guard', /function syncSkin\(snapshot\)/.test(client))
check('ambient failures are caught and logged, not rethrown',
  /could not render sidebar scenery/.test(client))
check('the scenery observer is torn down by its effect',
  /ambientObserver\.disconnect\(\)/.test(client))
check('the settling loop is cancelled when the effect is disposed',
  /settling\.stop\(\)/.test(client))

// ── 6. the two files that persist desktop config agree ──────────────────────
//
// The desktop profile's only durable plugin configuration is cordis.patch.yml; the 0.1.6-era
// settings.yaml is migrated to settings.yaml.imported and no longer read. Worth stating
// because editing the wrong file produces a change that appears to have no effect.
check('the patch is a YAML insert list', /^-\s*insert:/m.test(patch))
check('the patch row targets this package', /name:\s*dsh-theme-gallery\s*$/m.test(patch))

if (failed > 0) {
  console.error(`\n${failed} boot-safety check(s) failed`)
  process.exit(1)
}
console.log('\nboot-safety checks passed')
