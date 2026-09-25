/**
 * 时序死区（TDZ）审计 —— 检查闭包内 `const`/`let` 是否被"先用后声明"。
 *
 * 为什么需要这个
 * --------------
 * 这个插件已经因此栽过三次，而且每次的表现都不同、都**不报错**：
 *
 *   1. `storeActions`  —— 主题注册表挂载时抛错
 *   2. `contributed`   —— 同上
 *   3. `paintAttempts` —— **最隐蔽的一次**：它被声明在使用它的函数之后，
 *      而调用链恰好整段包在 `try` 里，ReferenceError 被静默吞掉，
 *      于是 `bootSettled` 永远没被置位、皮肤颜色永远不应用。
 *      用户侧看到的是"重启后没有主题色，点一下设置菜单就好了"——
 *      因为点击发生在挂载执行完之后，那时 `const` 才初始化。
 *
 * `tests/check-declaration-order.mjs` 只查顶层声明相对 `ctx.effect` 同步入口的顺序，
 * 覆盖不到函数体内部的闭包变量 —— 这次的 bug 正好落在那个盲区里。
 *
 * 实现放在 `tests/lib/tdz-audit.mjs`，与自检 `tests/check-tdz-logic.mjs` 共用，
 * 避免"两套实现互相印证"。
 *
 * 运行：node tests/check-tdz-order.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findTdzViolations } from './lib/tdz-audit.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

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

const violations = findTdzViolations(source)
check('没有闭包变量在自身声明之前被引用', violations.length === 0)
for (const v of violations) {
  console.error(`  ${v.fn}(): L${v.useAt} 使用了 "${v.name}"，但它声明在 L${v.declAt}`)
  console.error(`      ${v.line.slice(0, 110)}`)
}

// 记下那次事故的两个名字，防止它们再次以同样的方式出现。
// 这两个变量必须存在：前者是重试预算，后者是"外壳已就绪"的门闩。
for (const name of ['paintAttempts', 'bootSettled']) {
  const declared = source.split('\n')
    .some((line) => new RegExp(`^\\s*(?:const|let)\\s+${name}\\b`).test(line))
  check(`"${name}" 仍然有声明行`, declared)
}

if (failed > 0) {
  console.error(`\n${failed} TDZ order check(s) failed`)
  process.exit(1)
}
console.log('\nTDZ order checks passed')
