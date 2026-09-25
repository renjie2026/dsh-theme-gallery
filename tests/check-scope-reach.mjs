/**
 * 作用域可达性审计的**正检**。
 *
 * 这个文件本身的正确性由 tests/check-scope-reach-logic.mjs 保证 ——
 * 一份错的审计比没有审计更糟，因为它给的是虚假的保证。
 *
 * 运行：node tests/check-scope-reach.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findUnreachableCalls } from './lib/scope-reach.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

let failed = 0

const violations = findUnreachableCalls(source)

if (violations.length === 0) {
  console.log('ok   工厂级函数没有引用更深作用域里的函数')
} else {
  failed += 1
  console.log('FAIL 工厂级函数没有引用更深作用域里的函数')
  for (const v of violations) {
    console.log(`     ${v.caller}() 调用了 ${v.name}()，但 ${v.name} 只声明在深度 ${v.depth}（L${v.declaredAt}）`)
  }
}

// 两个"如果这条消失了，说明审计的解析坏了"的哨兵。
//
// 它们必须是**结构上就该在深度 2** 的函数：`syncAmbient` 与 `emitting` 都只依赖模块级的
// `ctx`，被工厂级与挂载体两边调用，所以它们必须提到工厂级 —— 一旦它们又滑回
// `mountGallery` 内部，那个不可达错误就会重现。找不到就说明结构解析出了问题，
// 而不是代码变干净了 —— 那种情况下这个审计会静默地什么都不检查。
//
// 不要用 `stackSkinTokens` / `syncSkin` 做哨兵：它们**合理地**住在 `mountGallery` 里。
for (const sentinel of ['syncAmbient', 'emitting', 'ambientEnabled', 'requestTheme']) {
  const found = new RegExp(`^\\s{4}function ${sentinel}\\(`, 'm').test(source)
  if (found) console.log(`ok   ${sentinel} 仍然是浅层函数（结构解析可信）`)
  else {
    failed += 1
    console.log(`FAIL ${sentinel} 不再位于工厂级 —— 不可达错误可能已重现`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} scope reach check(s) failed`)
  process.exit(1)
}
console.log('\nscope reach checks passed')
