/**
 * 发布前自检：一个命令回答"这个包能不能安全发布"。
 *
 * ── 为什么需要它 ─────────────────────────────────────────────────────────────
 *
 * 发布过一次就无法收回（npm 只允许在 72 小时内 unpublish，且已下载的副本留在别人机器上）。
 * 而本项目有几类错误**只会在发布之后才暴露**：
 *
 *   • 皮肤 JSON 改了但忘了 `embed-themes` —— 用户装到的皮肤被内联进 `lib/client.js`，
 *     所以**发出去的是旧皮肤**，而仓库里看起来是新的；
 *   • README / npm description / 面板文案里的**皮肤数量、清单与入口位置落后于实际** ——
 *     这类错误没有运行期信号，包能装、颜色能上，只有人去读才发现（本项目的复发最多次的一类）；
 *   • README 里留着本机绝对路径 —— 对外第一印象，且暴露开发机目录结构；
 *   • `files` 白名单漏了目录 —— 用户装到的包缺文件，加载失败；
 *   • `preference` 示例写成皮肤 id —— 照抄的用户**应用起不来**。
 *
 * 这些都是"静态可查"的，所以做成一次检查，而不是靠记性。
 *
 * 运行：node scripts/publish-check.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyConsistencyChecks } from './lib/copy-consistency.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0
let warned = 0
let todos = 0

/**
 * 断言一条。
 *
 * 三个级别，区别很重要：
 *  - `fail` —— 机制性错误，发出去一定是坏的（缺入口、内联不同步）；
 *  - `todo` —— **需要作者决定**的事（填仓库地址），不是我的 bug，但发布前必须做，
 *    而且要给出**具体怎么修**；
 *  - `warn` —— 环境限制或建议，不阻塞。
 * @param label - 检查项。
 * @param condition - 结果。
 * @param detail - 失败时的补充信息。
 * @param level - 'fail' | 'todo' | 'warn'。
 */
function check(label, condition, detail, level = 'fail') {
  if (condition) {
    console.log(`ok   ${label}`)
    return
  }
  if (level === 'warn') {
    warned += 1
    console.log(`warn ${label}`)
  } else if (level === 'todo') {
    todos += 1
    console.log(`TODO ${label}`)
  } else {
    failed += 1
    console.log(`FAIL ${label}`)
  }
  if (detail !== undefined) console.log(`     ${detail}`)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

// ── 1. 官方要求的清单字段 ────────────────────────────────────────────────────
console.log('── 清单字段 ──')
check('dsh.bundle.patch 存在（决定能否被安装激活）',
  typeof pkg.dsh?.bundle?.patch === 'string', `实际 ${JSON.stringify(pkg.dsh?.bundle)}`)
check('exports["./client"] 存在（浏览器半侧入口）',
  typeof pkg.exports?.['./client']?.default === 'string')
check('dsh.client.platform 是 web', pkg.dsh?.client?.platform === 'web')
check('main 指向宿主半侧', typeof pkg.main === 'string')
check('dsh.client.inject 声明了提供主题服务的模块',
  (pkg.dsh?.client?.inject ?? []).some((id) => String(id).includes('ui-theme')),
  '漏掉它时启动失败**不产生任何日志**，是最难查的一种')
check('private 未设置（private:true 会拒绝发布）', pkg.private !== true)
check('license 已声明', typeof pkg.license === 'string')
check('keywords 含 dsh-plugin（社区市场靠它检索）',
  (pkg.keywords ?? []).includes('dsh-plugin'))

// ── 2. repository：npm 页面会显示源码链接，也是信任来源 ──────────────────────
console.log('\n── 源码链接 ──')
const repoUrl = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
//
// `todo`, not `fail`, and deliberately NOT pre-filled with a guess.
//
// Inventing an owner (`github.com/your-name/…`) is worse than leaving it empty: npm would
// advertise that URL, and if the guessed account exists and is somebody else's, the page would
// point at a repository the author does not control — a supply-chain concern, not a cosmetic one.
// So the field stays absent until it can be filled with a real, verified URL.
check('repository 已填写', typeof repoUrl === 'string' && repoUrl !== '',
  '填 package.json 的 repository（npm 页面会显示源码链接，也是被信任与被发现的一部分）：\n'
  + '     "repository": { "type": "git", "url": "https://github.com/<你的用户名>/dsh-theme-gallery.git" }\n'
  + '     同时建议补 homepage（README 页面）与 bugs（issues 页）',
  'todo')
if (typeof repoUrl === 'string' && repoUrl !== '') {
  check('repository 是真实 URL 形态（不是占位符）',
    /^https?:\/\/|^git\+https?:\/\/|^github:/.test(repoUrl), `实际 ${repoUrl}`)
  check('repository 不含明显的占位符',
    !/<你的|your-name|yourname|REPLACE|CHANGEME|example\.com|TODO>/i.test(repoUrl),
    `实际 ${repoUrl}\n`
    + '     → 这是**必须替换**的占位符。填错仓库地址比留空更糟：npm 页面会指向一个\n'
    + '       你不控制的仓库，若该账号存在，等于把源码链接挂到别人名下。')
}
check('homepage 已填写（npm 页面的"主页"链接）',
  typeof pkg.homepage === 'string' && pkg.homepage !== '',
  '可与 repository 指向同一仓库', 'todo')

// ── 3. 内联皮肤是否与 lib/themes 同步（发错皮肤是静默的）──────────────────────
console.log('\n── 皮肤内联 ──')
const themesDir = join(root, 'lib', 'themes')
const themeFiles = existsSync(themesDir)
  ? readdirSync(themesDir).filter((n) => n.endsWith('.json')).sort()
  : []
check('lib/themes 里有皮肤 JSON', themeFiles.length > 0)

const clientSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
// Slice on the TERMINATOR LINE (`\n    ]`), not on a non-greedy bracket regex: the
// inlined literal now contains nested arrays (`card.rows`), and `\[[\s\S]*?\]\n`
// stops at the first of those, silently reading only part of the id list. Every
// other reader in this repository already used the terminator convention; this one
// and `embed-themes.mjs` were the two that did not.
const bundledAt = clientSource.indexOf('const BUNDLED_THEMES = ')
const bundledEnd = bundledAt < 0 ? -1 : clientSource.indexOf('\n    ]', bundledAt)
check('lib/client.js 里有 BUNDLED_THEMES 声明', bundledAt >= 0 && bundledEnd > bundledAt)
const bundledIds = bundledAt < 0 || bundledEnd < 0
  ? []
  : [...clientSource.slice(bundledAt, bundledEnd).matchAll(/"id": "([^"]+)"/g)].map((m) => m[1])

const fileIds = themeFiles.map((name) => {
  const raw = JSON.parse(readFileSync(join(themesDir, name), 'utf8'))
  const def = Array.isArray(raw) ? raw[0] : raw
  return def.id
})
check(`内联的皮肤与 lib/themes 一致（${fileIds.length} 个）`,
  JSON.stringify([...fileIds].sort()) === JSON.stringify([...bundledIds].sort()),
  `文件 ${JSON.stringify(fileIds.sort())} vs 内联 ${JSON.stringify(bundledIds.sort())}\n`
  + '     → 跑 node scripts/embed-themes.mjs 重新内联')

// The panel prints the version it was built from, so a stale inlined value is a UI
// that lies about itself — and "which version am I running" is exactly the question
// a user asks when deciding whether to update.
const inlinedVersion = /const BUNDLED_VERSION = '([^']*)'/.exec(clientSource)
check('面板显示的版本与 package.json 一致',
  inlinedVersion !== null && inlinedVersion[1] === pkg.version,
  `package.json ${pkg.version} vs lib/client.js ${inlinedVersion === null ? '(未声明)' : inlinedVersion[1]}\n`
  + '     → 跑 node scripts/embed-themes.mjs 同步')

// ── 4. README 不得含本机痕迹（对外第一印象）─────────────────────────────────
console.log('\n── README 卫生 ──')
const readmeRaw = existsSync(join(root, 'README.md'))
  ? readFileSync(join(root, 'README.md'), 'utf8')
  : ''
// 只查正文，跳过代码围栏里的示例路径（那里出现 <DSH_HOME> 之类的占位符是正常的）
const readmeProse = readmeRaw.split('\n').filter((l) => !/^\s*(```|\||>|#)/.test(l)).join('\n')
check('README 无本机绝对路径（Windows 用户目录）',
  !/[A-Za-z]:\\\\?Users\\\\?Administrator/.test(readmeRaw),
  '暴露开发机目录结构，且用户照抄必然失败')
check('README 无项目工作区路径', !/D:\\\\?Ai\\\\?dsh/.test(readmeRaw))
check('README 写了安装方式', /添加插件|Add plugin|dsh plugin/.test(readmeRaw))
check('README 写了卸载/回滚方式',
  /卸载|回滚|uninstall|rollback/i.test(readmeRaw),
  '主题插件最坏情况是应用起不来，用户必须知道怎么退')
check('README 警告了 preference 不能写皮肤 id',
  /preference/.test(readmeRaw) && /light|dark|system/.test(readmeRaw))
void readmeProse

// ── 4b. 介绍文字必须与皮肤清单一致（长效机制的落点）─────────────────────────
//
// 规则与理由写在 `scripts/lib/copy-consistency.mjs` 里，**单独成模块**是为了让这里与
// `tests/check-copy-consistency-logic.mjs`（含变异反证）跑同一份实现 —— 只在真实文件上
// "通过"证明不了"文案落后时它会失败"。
console.log('\n── 介绍文字与皮肤清单 ──')
const previewSource = readFileSync(join(root, 'scripts', 'build-panel-preview.mjs'), 'utf8')
for (const item of copyConsistencyChecks({
  readme: readmeRaw, pkg, clientSource, previewSource, fileIds,
})) {
  check(item.label, item.ok, item.detail)
}

// ── 5. files 白名单必须覆盖所有运行期需要的东西 ──────────────────────────────
console.log('\n── 打包内容 ──')
const files = pkg.files ?? []
for (const need of ['lib', 'cordis.patch.yml']) {
  check(`files 覆盖 ${need}`, files.includes(need), `实际 ${JSON.stringify(files)}`)
}
check('files 不包含 tests（不把测试发给用户）', !files.includes('tests'))

// 用真实打包结果核对，而不是只看白名单。
//
// `execFileSync` THROWS when the binary is missing, so a nested try/catch inside the outer one
// does not help — the outer catch never sees it if the inner one only wraps the parse. Wrapping
// each spawn separately is what actually makes "npm is not on PATH" survivable.
let packed = ''
const candidates = [
  [process.execPath, [join(root, 'node_modules', 'npm', 'bin', 'npm-cli.js'), 'pack', '--dry-run', '--json']],
  // On Windows `npm` is a `.cmd` shim, which `execFileSync` cannot launch directly — it has to
  // go through the shell. Listing it explicitly avoids relying on PATH resolution order.
  [process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm pack --dry-run --json']],
  ['npm', ['pack', '--dry-run', '--json']],
]
for (const [cmd, args] of candidates) {
  try {
    // `stdio` is pinned to pipes so a missing-binary error does not print a Node stack trace
    // into this check's output — the check reports the situation itself, in one line.
    packed = execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    break
  } catch {
    // Try the next candidate.
  }
}
if (packed !== '') {
  // `prepack` runs before packing and prints its own summary, so stdout is not pure JSON:
  //
  //     embedded 2 theme(s) from 2 file(s): …
  //     [ { "id": "dsh-theme-gallery@0.1.0", … } ]
  //
  // The JSON always begins at the first `[` — take from there rather than assuming the whole
  // stream parses. (This is the check's own cleanup step failing, not the package's.)
  const jsonAt = packed.indexOf('[')
  const jsonText = jsonAt < 0 ? packed : packed.slice(jsonAt)
  try {
    const meta = JSON.parse(jsonText)
    const names = (meta[0]?.files ?? []).map((f) => f.path)
    check('打包结果含浏览器半侧', names.some((n) => n === 'lib/client.js'), names.join(', '))
    check('打包结果含宿主半侧', names.some((n) => n === 'lib/index.js'))
    check('打包结果含配置层', names.includes('cordis.patch.yml'))
    check('打包结果含全部皮肤 JSON',
      fileIds.every((id) => names.includes(`lib/themes/${id}.json`)))
    check('打包结果不含 package.json 之外的本机文件',
      !names.some((n) => /^(_profile-backup|_before-uninstall|dsh-client-ui-cat-patched)/.test(n)),
      names.join(', '))
    check('打包体积合理（< 1 MB）', (meta[0]?.size ?? 0) < 1_000_000,
      `实际 ${meta[0]?.size} B`)
    console.log(`     → ${names.length} 个文件，${meta[0]?.size} B（解包 ${meta[0]?.unpackedSize} B）`)
  } catch (error) {
    console.log(`warn 无法解析 npm pack --dry-run --json 输出：${String(error.message ?? error)}`)
    warned += 1
  }
} else {
  console.log('warn 环境里没有 npm，跳过"打包内容"实测（仍检查了 files 白名单）')
  warned += 1
}

// ── 6. 协作约定：skill 不在本包内 ────────────────────────────────────────────
//
// 本仓库位于一个**共用工作区根**之下（`D:\Ai\dsh\`），那里还有 `skills/`、`docs/` 等
// 与本包无关的东西；而 `package.json` 的 `files` 白名单按**包根**过滤，所以它们天然
// 不会被打进包。这一条把"天然"变成"被检查"。
console.log('\n── 作用域 ──')
check('本包根目录就是插件目录（files 相对于它过滤）',
  existsSync(join(root, 'lib', 'client.js')) && existsSync(join(root, 'cordis.patch.yml')))
const skillsOutside = !existsSync(join(root, 'skills'))
check('skills/ 不在包根内（不会被误打进包）', skillsOutside,
  'skill 是给 AI 的指令文件，与插件分发渠道不同，应单独发布')

// ── 汇总 ────────────────────────────────────────────────────────────────────
console.log('')
const trailer = [
  failed > 0 ? `${failed} 项失败` : '',
  todos > 0 ? `${todos} 项待你决定` : '',
  warned > 0 ? `${warned} 项警告` : '',
].filter(Boolean).join('，')

if (failed > 0) {
  console.error(`${trailer} —— 机制性问题，先修再发布`)
  process.exit(1)
}
if (todos > 0) {
  console.log(`${trailer}（见上）`)
  console.log('机制上已就绪：可以打包与分发；填完上面的 TODO 后再发到 npm。')
  process.exit(0)
}
console.log(`发布前自检全部通过${warned > 0 ? `（${warned} 项警告，见上）` : ''}`)
