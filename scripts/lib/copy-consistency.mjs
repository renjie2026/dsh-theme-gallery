/**
 * 介绍文字与皮肤清单的一致性检查。
 *
 * ── 为什么单独成模块 ─────────────────────────────────────────────────────────
 *
 * 让**发布自检**（`scripts/publish-check.mjs`）与**它的自检**
 * （`tests/check-copy-consistency-logic.mjs`）跑**同一份实现**。否则自检只是"另一套写法
 * 在印证自己"，而本仓库已经有过"审计连错三次、每次都说通过"的记录（规则 6）。
 *
 * 本模块只做纯计算：给它 README / package.json / `lib/client.js` 的文本与 `lib/themes`
 * 里的 id，它返回每一条检查的结论。它不读文件、不打印、不退出。
 *
 * ── 它守的是什么 ─────────────────────────────────────────────────────────────
 *
 * 本项目的介绍文字**长期落后于实际**：README 写过"内置四个皮肤"，安装说明写过
 * "当前三个主题：山青婷彩 / 梦海游鱼 / 深色"，入口位置写成"左侧栏底部"。这类错误
 * **没有任何运行期信号** —— 包能装、皮肤能上色、测试全绿，只有人去读才发现。
 *
 * 三条规则，正反两个方向都覆盖：
 *
 *   1. README 的"已发布"表格里每个 id 都必须真实存在（不许宣传不存在的皮肤）；
 *   2. `lib/themes` 里每一套皮肤都必须被 README 提到（已发布进表格，未发布进"尚未发布"那句）
 *      —— 新加的皮肤不会被漏写；
 *   3. 声明的**数量**、**版本**、**入口位置**、**面板文案里的计数口径**、
 *      以及 **README 里写的校验组数**，都必须与当前事实一致。
 *
 * 工作区里"有皮肤未发布"是预期状态，所以规则 2 认那一段"尚未发布"的说明，
 * 而不是要求表格覆盖全部文件。
 */

/**
 * README 顶部"已发布"表格里的皮肤 id。
 *
 * 表格行形如 `` | `shan-qing-ting-cai` | **山青婷彩** | … | ``，所以只认
 * "整行以反引号里的 id 开头"的行 —— 其它表格（渠道、兼容性、入口）首列不是 id。
 * @param readme - README 全文。
 * @returns id 数组，按出现顺序。
 */
export function declaredSkinIds(readme) {
  return [...readme.matchAll(/^\|\s*`([a-z0-9][a-z0-9-]*)`\s*\|/gm)].map((m) => m[1])
}

/**
 * README 里"尚未发布"那段提到的 id。
 *
 * 取该行及其后 4 行，再从反引号里抽 id。未发布的皮肤也必须被点名：既不进表格、
 * 也不在任何说明里，等于从文档里悄悄消失。
 * @param readme - README 全文。
 * @returns id 数组。
 */
export function pendingSkinIds(readme) {
  const lines = readme.split('\n')
  const at = lines.findIndex((line) => /尚未发布|未发布/.test(line))
  if (at < 0) return []
  const block = lines.slice(at, at + 4).join('\n')
  return [...block.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)].map((m) => m[1])
}

/**
 * `npm test` 实际跑了几组。
 *
 * 链里写的是 `npm run test:x`，所以要展开一层再数 `node <文件>`：一个脚本可以跑两个文件
 * （如 `test:tdz`、`test:emitguard`），那算两组。
 * @param scripts - package.json 的 `scripts`。
 * @returns 校验文件路径数组（一个元素 = 一组）。
 */
export function testGroups(scripts) {
  const groups = []
  for (const part of String(scripts?.test ?? '').split('&&')) {
    const ref = /npm run ([\w:-]+)/.exec(part.trim())
    if (ref === null) continue
    const body = String(scripts?.[ref[1]] ?? '')
    groups.push(...[...body.matchAll(/node\s+(\S+\.mjs)/g)].map((m) => m[1]))
  }
  return groups
}

/**
 * 跑完全部一致性检查。
 * @param input - 输入。
 * @param input.readme - README 全文。
 * @param input.pkg - 已解析的 package.json。
 * @param input.clientSource - `lib/client.js` 全文。
 * @param input.previewSource - `scripts/build-panel-preview.mjs` 全文。
 * @param input.fileIds - `lib/themes/*.json` 里的皮肤 id。
 * @returns `{label, ok, detail}[]`，`detail` 只在失败时有意义。
 */
export function copyConsistencyChecks({ readme, pkg, clientSource, previewSource, fileIds }) {
  const declared = declaredSkinIds(readme)
  const pending = pendingSkinIds(readme)
  const groups = testGroups(pkg?.scripts ?? {})
  const results = []
  /**
   * 记一条结论。
   * @param label - 检查项。
   * @param ok - 是否通过。
   * @param detail - 失败时的补充信息（含怎么修）。
   */
  const add = (label, ok, detail) => { results.push({ label, ok, detail }) }

  add('README 有"已发布"皮肤表格', declared.length > 0,
    'README 顶部必须有一张"已发布"表格，发布自检靠它核对清单')

  const missing = declared.filter((id) => !fileIds.includes(id))
  add('README 的已发布清单里每个 id 都真实存在于 lib/themes', missing.length === 0,
    `README ${JSON.stringify(declared)} 里有 lib/themes 中不存在的 id：${JSON.stringify(missing)}\n`
    + '     → 删掉它，或把对应皮肤 JSON 补进 lib/themes')

  const undocumented = fileIds.filter((id) => !declared.includes(id) && !pending.includes(id))
  add('lib/themes 里每一套皮肤都被 README 提到（已发布进表格，未发布进"尚未发布"那句）',
    undocumented.length === 0,
    `lib/themes ${JSON.stringify(fileIds)}\n`
    + `     README 已发布 ${JSON.stringify(declared)} / 未发布 ${JSON.stringify(pending)}\n`
    + `     → 没被提到的：${JSON.stringify(undocumented)}`)

  const statedCount = /发布\s*\*\*(\d+)\s*套\*\*/.exec(readme)
  add('README 写明了已发布的皮肤数量（形如「发布 **6 套**皮肤）', statedCount !== null,
    '数量必须写在 README 顶部，才会与本检查、与 npm description 一起被维护')
  add(`README 声明的数量与表格行数一致（声明 ${statedCount?.[1] ?? '?'} / 表格 ${declared.length}）`,
    statedCount !== null && Number(statedCount[1]) === declared.length,
    '改了清单就改那个数字 —— 两者在同一行')

  const statedVersion = /已随\s*\*\*([0-9]+\.[0-9]+\.[0-9]+)\*\*\s*发布/.exec(readme)
  add(`README 声明的版本与 package.json 一致（${statedVersion?.[1] ?? '?'} vs ${pkg?.version ?? '?'}）`,
    statedVersion !== null && statedVersion[1] === pkg?.version,
    '升版本号时必须同时改 README 顶部那句 —— 它就在"发布 N 套"的同一行')

  add('README 不再使用「左侧栏底部」这类旧入口说法',
    !/左侧栏底部|侧栏底部出现/.test(readme),
    '入口在**左侧菜单区【插件】图标的下方**，不是"左侧栏底部"，也不在「设置 → 通用 → 外观」里')

  add('README 说明了内置浅色/深色卡不计入皮肤数量',
    /浅色/.test(readme) && /深色/.test(readme) && /不计入|不计算/.test(readme),
    '面板里另有内置浅色/深色两张卡；它们不是皮肤，数量里不能算它们')

  add('面板的数量取自皮肤数而不是卡片数（内置卡不算进数字）',
    /count: skinCount/.test(clientSource)
    && /const skinCount = ids\.length - builtInCards/.test(clientSource),
    "lib/client.js 里 `t('count', { count: … })` 必须传 skinCount（= 卡片数 − 内置卡数）")

  add('预览页的数量也取自皮肤数而不是卡片数',
    /String\(skinCount\)/.test(previewSource)
    && /const skinCount = shown\.length - builtInCardCount/.test(previewSource),
    'scripts/build-panel-preview.mjs 的标题也必须用 skinCount —— 它是 README 里给出的那页预览，'
    + '把内置卡算进皮肤数就会印出一个与 README 不一致的数字')

  const statedGroups = /npm test`?\s*的\s*\*\*(\d+)\s*组\*\*/.exec(readme)
  add(`README 声明的校验组数与 test 链一致（声明 ${statedGroups?.[1] ?? '?'} / 实际 ${groups.length}）`,
    statedGroups !== null && Number(statedGroups[1]) === groups.length,
    `加了校验就要改 README 里那句「npm test 的 N 组」；当前链上 ${groups.length} 组：${groups.join(', ')}`)

  return results
}
