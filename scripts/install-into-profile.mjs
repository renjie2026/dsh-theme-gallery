#!/usr/bin/env node
/**
 * Install this bundle into a dsh profile by editing the profile's own manifest.
 *
 * Why this exists: the desktop profile is guarded —
 *
 *   $ dsh plugin --profile desktop add <spec>
 *   error: profile "desktop" is managed exclusively by the Electron application
 *
 * — and the desktop build ships no plugin-manager UI, so there is no supported
 * command path. The profile manifest is still the documented mechanism (a bundle
 * is a package declaring `dsh.bundle.patch`, selected through
 * `dsh.profile.bundles`), so this script performs the two steps that mechanism
 * needs:
 *
 *   1. add the linked dependency to the profile's package.json;
 *   2. append this package to `dsh.profile.bundles`.
 *
 * It then runs `pnpm install` in the profile directory to create the link.
 * Nothing else in the profile is touched, a backup of every edited file is
 * written first, and the script is idempotent (re-running changes nothing).
 *
 * Run with: node scripts/install-into-profile.mjs [profileName]
 *   profileName defaults to `desktop`.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const packageName = pkg.name

const profileName = process.argv[2] ?? 'desktop'
const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const profileDir = join(dshHome, 'profiles', profileName)
const manifestPath = join(profileDir, 'package.json')

if (!existsSync(manifestPath)) {
  console.error(`no profile manifest at ${manifestPath}`)
  console.error('pass the profile name as the first argument, e.g. `node scripts/install-into-profile.mjs web`')
  process.exit(1)
}

// 1. Back up every file this script may edit.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupDir = join(root, `.profile-backup-${profileName}-${stamp}`)
mkdirSync(backupDir, { recursive: true })
cpSync(manifestPath, join(backupDir, 'package.json'))
for (const name of ['cordis.patch.yml', 'pnpm-workspace.yaml']) {
  const file = join(profileDir, name)
  if (existsSync(file)) cpSync(file, join(backupDir, name))
}
console.log(`backup: ${backupDir}`)

// 2. Declare the link and select the bundle.
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.dependencies = manifest.dependencies ?? {}
manifest.dsh = manifest.dsh ?? {}
manifest.dsh.profile = manifest.dsh.profile ?? {}
const bundles = manifest.dsh.profile.bundles ?? (manifest.dsh.profile.bundles = [])

const linkSpec = `link:${root.replace(/\\/g, '/')}`
const alreadyLinked = manifest.dependencies[packageName] === linkSpec
const alreadySelected = bundles.includes(packageName)

manifest.dependencies[packageName] = linkSpec
if (!alreadySelected) bundles.push(packageName)

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`${alreadyLinked ? 'unchanged' : 'linked'} dependency ${packageName} -> ${linkSpec}`)
console.log(`${alreadySelected ? 'unchanged' : 'appended'} bundle ${packageName} (bundles: ${bundles.join(', ')})`)

// 3. Create the link. A failure here leaves the manifest edited, so say so.
//
// pnpm is located proactively because there is no single correct answer: the dsh
// runtime ships a `pnpm.mjs` under $DSH_HOME/dsh-runtimes, a system install
// exposes a `pnpm` shim on PATH (a .ps1/.cmd on Windows, so it is not directly
// spawnable without a shell), and corepack can always fetch it.
const runtimeRoots = [
  process.env.DSH_RUNTIME_ROOT,
  join(dshHome, 'dsh-runtimes'),
].filter(Boolean)

/**
 * Find pnpm entry points shipped inside the dsh runtime directories.
 * @returns absolute module paths that exist.
 */
function runtimePnpmCandidates() {
  const found = []
  for (const runtimeRoot of runtimeRoots) {
    if (!existsSync(runtimeRoot)) continue
    for (const runtime of readdirSync(runtimeRoot)) {
      for (const rel of [
        ['dependencies', 'pnpm', 'bin', 'pnpm.mjs'],
        ['dependencies', 'pnpm', 'bin', 'pnpm.cjs'],
      ]) {
        const candidate = join(runtimeRoot, runtime, ...rel)
        if (existsSync(candidate)) found.push(candidate)
      }
    }
  }
  return found
}

const candidates = [
  process.env.DSH_PNPM,
  process.env.PNPM,
  ...runtimePnpmCandidates(),
].filter((candidate) => candidate && existsSync(candidate))

/**
 * Run pnpm install in the profile directory, trying each located entry point.
 * @returns the label of whichever invocation succeeded.
 */
function runInstall() {
  const attempts = []
  for (const script of candidates) attempts.push({ label: script, file: process.execPath, args: [script] })
  attempts.push({ label: 'pnpm (via shell)', file: 'pnpm', args: [], shell: true })
  attempts.push({ label: 'corepack pnpm', file: 'corepack', args: ['pnpm'], shell: true })

  const failures = []
  for (const attempt of attempts) {
    try {
      execFileSync(attempt.file, [...attempt.args, 'install', '--no-frozen-lockfile'], {
        cwd: profileDir,
        stdio: 'inherit',
        shell: attempt.shell === true,
      })
      return attempt.label
    } catch (error) {
      failures.push(`${attempt.label}: ${error.code ?? error.message}`)
    }
  }
  console.error('\ncould not run pnpm install. Tried:')
  for (const failure of failures) console.error(`  - ${failure}`)
  console.error('\nThe manifest is already edited, so finish the job with an explicit run:')
  console.error(`  cd "${profileDir}" && pnpm install --no-frozen-lockfile`)
  process.exit(1)
}

const usedPnpm = runInstall()

const linked = join(profileDir, 'node_modules', packageName)
console.log(`\npnpm: ${usedPnpm}`)
console.log(`link present: ${existsSync(linked)} (${linked})`)
console.log('\nnext: restart the application, then open Settings → General to pick a skin.')
console.log('before the first restart keep the ui-theme preference on a built-in value')
console.log('(light/dark/system): a preference naming a theme that is not registered yet')
console.log('makes ui-theme\'s buildSnapshot throw "theme registry lost".')
