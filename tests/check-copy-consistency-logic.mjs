/**
 * 「介绍文字与皮肤清单一致」检查的**自检**（含变异反证）。
 *
 * ── 为什么必须有 ─────────────────────────────────────────────────────────────
 *
 * 这条检查的全部价值在于"文案落后时它会失败"。而"通过"看起来和真的通过一模一样：
 * 若它的正则写错了、字段取空了、或者把比较写反了，它在**真实文件上照样打印通过**，
 * 于是它守的正是它自己宣称守住的那件事 —— 却什么都没守。
 *
 * 所以这里两个方向都覆盖（规则 6），并且每一步都先确认"变异真的改动了输入"：
 *
 *   • **该抓的抓住**：删表格行 / 加不存在的 id / 改数量 / 改版本 / 写回旧说法 /
 *     面板计数改回卡片数 / 新皮肤没写进 README / 校验组数不符 —— 每条都必须失败；
 *   • **不该报的不报**：真实文件必须全过；把一套皮肤**正式发布**（补进表格 + 同步数字）
 *     之后也必须全过 —— 否则这条检查就退化成"任何改动都报错"。
 *
 * 运行：node tests/check-copy-consistency-logic.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyConsistencyChecks, declaredSkinIds, pendingSkinIds, testGroups } from '../scripts/lib/copy-consistency.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let failed = 0

/**
 * 断言一条。
 * @param label - 检查项。
 * @param condition - 结果。
 */
function check(label, condition) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
}

const readme = readFileSync(join(root, 'README.md'), 'utf8')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const clientSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const previewSource = readFileSync(join(root, 'scripts', 'build-panel-preview.mjs'), 'utf8')
const themesDir = join(root, 'lib', 'themes')
const fileIds = readdirSync(themesDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const raw = JSON.parse(readFileSync(join(themesDir, name), 'utf8'))
    return (Array.isArray(raw) ? raw[0] : raw).id
  })

/** 真实输入。 */
const base = { readme, pkg, clientSource, previewSource, fileIds }

/**
 * 某个输入下是否有某条检查失败。
 * @param input - {@link copyConsistencyChecks} 的输入。
 * @param needle - 检查项标签里的片段。
 * @returns 是否存在失败的该条。
 */
function failsWith(input, needle) {
  return copyConsistencyChecks(input).some((item) => !item.ok && item.label.includes(needle))
}

// ── 不该报的不报 ─────────────────────────────────────────────────────────────
const real = copyConsistencyChecks(base)
check(`真实文件上 ${real.length} 条检查全部通过`, real.every((item) => item.ok))
for (const item of real.filter((entry) => !entry.ok)) {
  console.error(`  FAIL ${item.label}`)
  if (item.detail !== undefined) console.error(`       ${item.detail}`)
}

// 解析器本身的形状：抽到的 id 必须是"磁盘上的那批"的子集 + 未发布那批
check(`表格解析出已发布 id（${declaredSkinIds(readme).length} 个）`, declaredSkinIds(readme).length > 0)
check('表格解析出的 id 全部真实存在（解析器没抽到别的表）',
  declaredSkinIds(readme).every((id) => fileIds.includes(id)))
check('未发布那句解析出了 id（解析器没把散文当表格）',
  pendingSkinIds(readme).length === 0
  || pendingSkinIds(readme).every((id) => !declaredSkinIds(readme).includes(id)))
check(`test 链解析出 ${testGroups(pkg.scripts).length} 组校验`, testGroups(pkg.scripts).length > 5)

// ── 该抓的抓住（变异）──────────────────────────────────────────────────────
/**
 * 跑一次变异：先确认它真的改了输入，再断言对应检查失败。
 * @param label - 变异名。
 * @param next - 变异后的输入。
 * @param needle - 期望失败的那条检查的标签片段。
 */
function mutation(label, next, needle) {
  const changed = JSON.stringify(next) !== JSON.stringify(base)
  check(`变异「${label}」真的改动了输入`, changed)
  check(`变异「${label}」必须让检查失败`, changed && failsWith(next, needle))
}

// 1) 从表格里删掉一行：磁盘上的皮肤在文档里消失了。
mutation('README 表格少一套皮肤',
  { ...base, readme: readme.replace(/^\| `meng-hai-you-yu`[^\n]*\n/m, '') },
  '每一套皮肤都被 README 提到')

// 2) 表格里写了一个不存在的皮肤：宣传了包里没有的东西。
mutation('README 表格多一个不存在的 id',
  { ...base, readme: readme.replace(/^(\| `shan-qing-ting-cai`[^\n]*\n)/m, '$1| `ghost-skin` | **幽灵** | `#000000` | `#111111` |\n') },
  '每个 id 都真实存在')

// 3) 数量与表格行数不一致（表格改了、数字没改）。
mutation('README 的数量与表格行数不一致',
  { ...base, readme: readme.replace('发布 **6 套**', '发布 **7 套**') },
  '声明的数量与表格行数一致')

// 4) 升了版本号但没改 README 那句。
mutation('README 的版本落后于 package.json',
  { ...base, readme: readme.replace('已随 **0.3.0** 发布', '已随 **0.2.0** 发布') },
  '声明的版本与 package.json 一致')

// 5) 旧说法被写回来（这正是本次要修的问题）。
mutation('README 写回「左侧栏底部」',
  { ...base, readme: readme + '\n左侧栏底部出现 主题皮肤 入口\n' },
  '左侧栏底部')

// 6) 面板计数改回卡片数（内置浅色/深色被算进皮肤数）。
mutation('面板把内置卡算进皮肤数',
  { ...base, clientSource: clientSource.replace('count: skinCount', 'count: ids.length') },
  '面板的数量取自皮肤数')

// 7) 新皮肤入库但 README 一个字没提。
mutation('lib/themes 多一套没写进 README 的皮肤',
  { ...base, fileIds: [...fileIds, 'brand-new-skin'] },
  '每一套皮肤都被 README 提到')

// 7b) 预览页把内置卡算进皮肤数（本页真的这么错过一次）。
mutation('预览页把内置卡算进皮肤数',
  { ...base, previewSource: previewSource.replace("String(skinCount)", 'String(shown.length)') },
  '预览页的数量也取自皮肤数')

// 8) README 里写的校验组数落后于 test 链。
mutation('README 的校验组数落后（数字写小）',
  { ...base, readme: readme.replace(/npm test`?\s*的\s*\*\*(\d+)\s*组\*\*/, 'npm test 的 **5 组**') },
  '声明的校验组数')

// 9) 反方向：README 数字没变、但 test 链少跑了一组 —— 只看 README 是发现不了的，
//    这条断言必须对**实际链条**敏感。
const trimmedScripts = { ...pkg.scripts }
trimmedScripts.test = String(pkg.scripts.test).replace('npm run test:cards && ', '')
mutation('test 链少跑一组校验',
  { ...base, pkg: { ...pkg, scripts: trimmedScripts } },
  '声明的校验组数')

// ── 不该报的不报（对照组）──────────────────────────────────────────────────
//
// 上面 10 个变异只能证明"改坏了会报错"；还得证明**一致的时候它不报错**，否则这条检查
// 退化成"任何改动都失败"，下次就会被人删掉。
//
// 用**合成输入**而不是"把某套皮肤正式发布"：合成输入与当前目录状态无关，所以在
// 发布副本（只含 6 套皮肤）里跑同一份断言也成立 —— 否则对照组会在那边失败，
// 逼着发布副本里改测试文件。
const synthetic = {
  readme: [
    '已随 **9.9.9** 发布 **2 套**皮肤：',
    '',
    '| id | 名称 |',
    '|---|---|',
    '| `alpha-skin` | **甲** |',
    '| `beta-skin` | **乙** |',
    '',
    '面板里另有内置**浅色** / **深色**卡，不计入皮肤数量。',
    '',
    '入口在左侧菜单区【插件】图标的下方。',
    '',
    'npm test 的 **20 组**',
    '',
  ].join('\n'),
  pkg: { version: '9.9.9', scripts: pkg.scripts },
  clientSource: "count: skinCount\nconst skinCount = ids.length - builtInCards",
  previewSource: 'String(skinCount)\nconst skinCount = shown.length - builtInCardCount',
  fileIds: ['alpha-skin', 'beta-skin'],
}
const syntheticResults = copyConsistencyChecks(synthetic)
check('对照组：完全一致的合成输入必须全过（防止这条检查退化成"改什么都报错"）',
  syntheticResults.every((item) => item.ok),
  syntheticResults.filter((item) => !item.ok).map((item) => item.label).join('；'))
// 合成输入还必须**真的能被解析**：否则"全过"只是因为它什么都没抽到。
check('对照组：合成输入被解析出 2 套皮肤 / 2 组校验',
  declaredSkinIds(synthetic.readme).length === 2 && testGroups(synthetic.pkg.scripts).length === 20)

if (failed > 0) {
  console.error(`\n${failed} copy consistency logic check(s) failed`)
  process.exit(1)
}
console.log('\ncopy consistency logic checks passed')
