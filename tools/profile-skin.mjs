/**
 * Safe on/off control for dsh-theme-gallery in the desktop profile.
 *
 * WHY THIS EXISTS
 * ---------------
 * A skin plugin can stop the desktop application from starting: if its fiber never settles,
 * the shell waits forever on "Loading plugins..." and writes nothing to the crash log. The
 * recovery is to unregister the plugin and put the theme preference back to a built-in value,
 * which is fiddly to do by hand under pressure and easy to get half-right.
 *
 * This script makes that operation one command, and makes the DANGEROUS direction guarded:
 * `enable` refuses to run unless the preference is already a built-in value, so a stale
 * `preference: shan-qing-ting-cai` can never be sitting in the profile when the plugin comes
 * back. It backs up both files before touching them and can roll back.
 *
 * Usage (from the plugin directory):
 *   node tools/profile-skin.mjs status     show the current state and any hazard
 *   node tools/profile-skin.mjs disable    remove the plugin row, force a built-in preference
 *   node tools/profile-skin.mjs enable     restore the plugin row (refuses if unsafe)
 *   node tools/profile-skin.mjs rollback   restore the newest .bak pair
 *
 * NOTE: the desktop profile is owned by the Electron app for normal use, but these are plain
 * files on disk and the app only reads them at start — so editing them while it is closed is
 * exactly what the app itself does when you toggle a plugin in its UI.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PROFILE = process.env.DSH_DESKTOP_PROFILE
  ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh', 'profiles', 'desktop')

const PKG = join(PROFILE, 'package.json')
const PATCH = join(PROFILE, 'cordis.patch.yml')
const PLUGIN = 'dsh-theme-gallery'
const BUILT_IN_PREFERENCES = ['light', 'dark', 'system']

/**
 * Fail loudly: every path here edits the configuration the app boots from.
 * @param message - the reason.
 */
function die(message) {
  console.error(`x ${message}`)
  process.exit(1)
}

if (!existsSync(PKG)) die(`找不到 profile 的 package.json：${PKG}`)

/**
 * Read the profile package.json.
 * @returns the parsed document, its text, and its indentation.
 */
function readProfile() {
  const text = readFileSync(PKG, 'utf8')
  // Detected rather than assumed: rewriting with the wrong indent produces a diff that
  // buries the one line that actually changed.
  const indentMatch = text.match(/\n(\s+)"/)
  return { json: JSON.parse(text), text, indent: indentMatch ? indentMatch[1] : '  ' }
}

/**
 * Read the patch file.
 * @returns its text, or an empty string when absent.
 */
function readPatch() {
  return existsSync(PATCH) ? readFileSync(PATCH, 'utf8') : ''
}

/**
 * The preference the theme service will adopt at boot.
 * @param patch - the patch file text.
 * @returns the value, or null when the patch does not set one.
 */
function patchedPreference(patch) {
  const match = patch.match(/^\s*preference:\s*(\S+)\s*$/m)
  return match ? match[1].replace(/^['"]|['"]$/g, '') : null
}

/**
 * Whether the plugin is currently in the profile's bundle list.
 * @param json - the profile document.
 * @returns whether it is enabled.
 */
function pluginEnabled(json) {
  return (json.dsh?.profile?.bundles ?? []).includes(PLUGIN)
}

/**
 * Report the current state, and flag the combination that bricks the boot.
 */
function status() {
  const { json } = readProfile()
  const patch = readPatch()
  const preference = patchedPreference(patch)
  const enabled = pluginEnabled(json)

  console.log(`profile      : ${PROFILE}`)
  console.log(`plugin       : ${enabled ? '已启用' : '已停用'}`)
  console.log(`preference   : ${preference ?? '(补丁未设置，用内置默认)'}`)

  const unsafe = enabled && preference !== null && !BUILT_IN_PREFERENCES.includes(preference)
  if (unsafe) {
    console.log('')
    console.log('!! 危险组合：插件启用，但 preference 指向非内置主题。')
    console.log('!! 这正是会让桌面端停在「Loading plugins...」的配置。')
    console.log('!! 先执行：node tools/profile-skin.mjs disable')
  } else if (enabled) {
    console.log('')
    console.log('配置安全：preference 是内置值，插件即使挂载失败也不会阻止启动。')
  }
  process.exitCode = unsafe ? 2 : 0
}

/**
 * Write both profile files, backing up what was there.
 * @param json - the profile document to serialise.
 * @param indent - the indentation to preserve.
 * @param patch - the patch file text.
 */
function writeBoth(json, indent, patch) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  copyFileSync(PKG, `${PKG}.${stamp}.bak`)
  if (existsSync(PATCH)) copyFileSync(PATCH, `${PATCH}.${stamp}.bak`)
  writeFileSync(PKG, `${JSON.stringify(json, null, indent)}\n`)
  writeFileSync(PATCH, patch)
  console.log(`已备份：${stamp}.bak`)
}

/** Remove the plugin from the bundle list and force a built-in preference. */
function disable() {
  const { json, indent } = readProfile()
  const bundles = json.dsh?.profile?.bundles ?? []
  json.dsh.profile.bundles = bundles.filter((name) => name !== PLUGIN)

  let patch = readPatch()
  if (/^\s*preference:/m.test(patch)) {
    patch = patch.replace(/^(\s*preference:\s*)\S+\s*$/m, '$1system')
  } else {
    patch += `\n- id: ui-theme\n  name: "@deepseek-ai/dsh-client-ui-theme"\n  config:\n    preference: system\n`
  }

  writeBoth(json, indent, patch)
  console.log('已停用插件，preference 置为 system。')
}

/**
 * Put the plugin back, refusing while the profile is in the hazardous state.
 */
function enable() {
  const { json, indent } = readProfile()
  const patch = readPatch()
  const preference = patchedPreference(patch)

  if (preference !== null && !BUILT_IN_PREFERENCES.includes(preference)) {
    die(`preference 是 "${preference}"，不是内置主题。先执行 disable 把它改回 system。`)
  }

  const bundles = json.dsh?.profile?.bundles ?? []
  if (!bundles.includes(PLUGIN)) bundles.push(PLUGIN)
  json.dsh.profile.bundles = bundles

  writeBoth(json, indent, patch)
  console.log('已启用插件。重启 app 生效；若卡在 Loading，执行 rollback。')
}

/** Restore the newest backup pair. */
function rollback() {
  const pick = (base) => {
    const dir = dirname(base)
    const prefix = `${base.split(/[\\/]/).pop()}.`
    const cands = existsSync(dir)
      ? readdirSync(dir).filter((n) => n.startsWith(prefix) && n.endsWith('.bak')).sort()
      : []
    return cands.length === 0 ? null : join(dir, cands[cands.length - 1])
  }
  const pkgBak = pick(PKG)
  const patchBak = pick(PATCH)
  if (pkgBak === null) die('没有找到 package.json 的备份')
  copyFileSync(pkgBak, PKG)
  console.log(`已还原 ${PKG}  ←  ${pkgBak}`)
  if (patchBak !== null) {
    copyFileSync(patchBak, PATCH)
    console.log(`已还原 ${PATCH}  ←  ${patchBak}`)
  }
}

const command = process.argv[2] ?? 'status'
if (command === 'status') status()
else if (command === 'disable') disable()
else if (command === 'enable') enable()
else if (command === 'rollback') rollback()
else die(`未知命令 "${command}"，可用：status / disable / enable / rollback`)
