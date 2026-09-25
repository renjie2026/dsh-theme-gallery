/**
 * 作用域可达性审计的**自检**。
 *
 * ── 为什么必须有 ─────────────────────────────────────────────────────────────
 *
 * 这份审计在开发过程中连续出错三次，而每次它都**报告通过**：
 *
 *   1. 花括号计数被 `${…}` 骗了 → 函数体范围算短 → 真实违规被漏掉；
 *   2. 注释里的撇号被当成字符串开头 → 整个函数声明从结构视图消失 → 真实违规被漏掉；
 *   3. 解构形参（`const { now } = options`）没被识别 → 报出一条**假**违规。
 *
 * 一份会误报或漏报的审计比没有审计更糟：它给出的是虚假的保证，
 * 而"通过"看起来和真的通过一模一样。所以用例必须同时覆盖两个方向：
 * **该抓的抓住**、**不该报的不报**。
 *
 * 运行：node tests/check-scope-reach-logic.mjs
 */
import { findUnreachableCalls } from './lib/scope-reach.mjs'

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

/** 把行数组拼成源码。 */
const src = (lines) => lines.join('\n')

// ── 该抓的：浅层函数调用只存在于更深层的函数 ────────────────────────────────
//
// 深度必须与真实文件一致：真正的工厂体是一层包裹，所以工厂级辅助函数在**深度 2**
// （`syncAmbient`、`emitting` 都是），而 `mountGallery` 内部的辅助函数在深度 3
// （`stackSkinTokens`、`syncSkin`）。用例用同样的层数，否则测的是另一种形状。
check('浅层（深度 2）函数调用深度 3 的嵌套函数 —— 会被发现', findUnreachableCalls(src([
  'function boot() {',
  '  function factory() {',
  '    function outer() {',
  '      function deep() {',
  '        return 1',
  '      }',
  '      const use = () => deep()',
  '    }',
  '    function shallow() {',
  '      return deep()',
  '    }',
  '  }',
  '}',
])).some((v) => v.caller === 'shallow' && v.name === 'deep'))

// ── 不该报的：各种正常的遮蔽 ─────────────────────────────────────────────────
check('同层函数互相调用不算违规', findUnreachableCalls(src([
  'function a() {',
  '  return b()',
  '}',
  'function b() {',
  '  return 1',
  '}',
])).length === 0)

check('局部声明遮蔽外层同名函数不算违规', findUnreachableCalls(src([
  'function deep() { return 1 }',
  'function shallow() {',
  '  const deep = () => 2',
  '  return deep()',
  '}',
])).length === 0)

check('解构形参（单行）不算违规', findUnreachableCalls(src([
  'function deep() { return 1 }',
  'function shallow() {',
  '  const { deep } = options',
  '  return deep()',
  '}',
])).length === 0)

check('解构形参（跨行）不算违规', findUnreachableCalls(src([
  'function deep() { return 1 }',
  'function shallow(options) {',
  '  const {',
  '    sample, apply, setTimer, clearTimer, now,',
  '  } = options',
  '  return now()',
  '}',
  'function now() { return 1 }',
])).length === 0)

check('SVG 模板串里的花括号不破坏函数体范围', findUnreachableCalls(src([
  'function deep() { return 1 }',
  'function shallow() {',
  '  const svg = `<path d="M0 0" />${deep()}`',
  '  const local = () => 2',
  '  return local()',
  '}',
])).length === 0)

// ── 防"静默失效"：注释与字符串不得让声明消失 ─────────────────────────────────
check('注释里的撇号不会吞掉后续函数声明', findUnreachableCalls(src([
  'function boot() {',
  '  function factory() {',
  '    function outer() {',
  '      // the presenter\'s tokens are written here',
  '      function deep() {',
  '        return 1',
  '      }',
  '      const use = () => deep()',
  '    }',
  '    function shallow() {',
  '      return deep()',
  '    }',
  '  }',
  '}',
])).some((v) => v.caller === 'shallow' && v.name === 'deep'))

check('注释里提到的名字不算"本地声明"', findUnreachableCalls(src([
  'function boot() {',
  '  function factory() {',
  '    function outer() {',
  '      function deep() { return 1 }',
  '      const use = () => deep()',
  '    }',
  '    function shallow() {',
  '      // deep() is called elsewhere in this body',
  '      return deep()',
  '    }',
  '  }',
  '}',
])).some((v) => v.caller === 'shallow'))

if (failed > 0) {
  console.error(`\n${failed} scope reach logic check(s) failed`)
  process.exit(1)
}
console.log('\nscope reach logic checks passed')
