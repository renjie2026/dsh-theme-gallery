/**
 * 审计逻辑自检：证明 `tests/lib/tdz-audit.mjs` 真的能发现"先用后声明"。
 *
 * 一个**永远不会失败**的检查比没有检查更糟 —— 它给出虚假的安全感。
 * 本文件导入与正检**同一份实现**，喂给它四个样例：
 * 违规、合规、注释里提到、嵌套作用域同名。前者的行为必须是被抓住。
 *
 * 运行：node tests/check-tdz-logic.mjs
 */
import { findTdzViolations } from './lib/tdz-audit.mjs'

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

/**
 * 把若干行拼成源码。
 * @param lines - 源码行。
 * @returns 源码文本。
 */
function src(lines) {
  return `${lines.join('\n')}\n`
}

// ── 样例 1：违规 —— 函数体在使用点之后才声明 ─────────────────────────────────
const badViolations = findTdzViolations(src([
  'function outer(ctx) {',
  '  function readsIt() {',
  '    return laterThing',
  '  }',
  '  readsIt()',
  '  const laterThing = 1',
  '}',
]))
check('先用后声明会被发现', badViolations.length === 1)
check('报告里指名了函数与变量',
  badViolations[0]?.fn === 'outer' && badViolations[0]?.name === 'laterThing')
check('报告里给出了使用行与声明行',
  badViolations[0]?.useAt === 3 && badViolations[0]?.declAt === 6)

// ── 样例 2：合规 —— 声明在使用之前 ──────────────────────────────────────────
check('先声明后使用不会被误报', findTdzViolations(src([
  'function outer(ctx) {',
  '  const earlierThing = 1',
  '  function readsIt() {',
  '    return earlierThing',
  '  }',
  '  readsIt()',
  '}',
])).length === 0)

// 这正是本次事故的形状：调用发生在 body 顶层，被调函数读一个更晚声明的变量。
check('事故的真实形状会被发现', findTdzViolations(src([
  'function mount() {',
  '  function markReady() {',
  '    if (flag) return',
  '    flag = true',
  '  }',
  '  markReady()',
  '  let flag = false',
  '}',
])).length === 1)

// 第二种事故形状（`accentLayerDispose`）：读它的函数排在声明之前。
// 第一版审计对这种形状完全失明，因为它只找"函数体内部的声明"。
check('函数排在声明之前、函数体里读它 —— 会被发现', findTdzViolations(src([
  'function outer(ctx) {',
  '  function reads() {',
  '    return value',
  '  }',
  '  reads()',
  '  let value = 1',
  '}',
])).length >= 1)

// ── 样例 3：注释里的名字不算引用 ─────────────────────────────────────────────
check('注释里的名字不算引用', findTdzViolations(src([
  'function outer(ctx) {',
  '  // this mentions laterThing in prose',
  '  const laterThing = 1',
  '}',
])).length === 0)

// ── 样例 4：嵌套作用域里的同名声明不算 ────────────────────────────────────────
check('嵌套作用域不会被误报', findTdzViolations(src([
  'function outer(ctx) {',
  '  function inner() {',
  '    const scoped = 1',
  '    return scoped',
  '  }',
  '  const scoped = 2',
  '  return inner()',
  '}',
])).length === 0)

if (failed > 0) {
  console.error(`\n${failed} TDZ logic check(s) failed`)
  process.exit(1)
}
console.log('\nTDZ logic checks passed')
