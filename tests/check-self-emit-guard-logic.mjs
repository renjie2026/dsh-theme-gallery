/**
 * 自发光守卫审计的**自检**。
 *
 * ── 为什么必须有 ─────────────────────────────────────────────────────────────
 *
 * 本项目已经有过"审计连错三次、每次都报告通过"的记录（见 check-scope-reach-logic.mjs）。
 * 这一份同样必须同时覆盖两个方向：
 *
 *   • **该抓的抓住** —— 未套 `emitting(...)` 的写入必须被点出来；
 *   • **不该报的不报** —— 注释/字符串里提到的调用、允许清单里的外部入口、
 *     单表达式与多语句两种守卫写法，都不许报警。
 *
 * 最后一段是**变异测试**：直接拿真实的 `lib/client.js`，把守卫拆掉一处再跑审计，
 * 必须失败。只在合成样本上通过，证明不了它在真实文件上还会工作 ——
 * 而"通过"看起来和真的通过一模一样。
 *
 * 运行：node tests/check-self-emit-guard-logic.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALLOWED_UNGUARDED,
  allowlistUsage,
  echoGuardShape,
  emittingSpans,
  findThemeWrites,
  findUnguardedWrites,
  writeForLayer,
} from './lib/self-emit-guard.mjs'

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

// ── 该抓的 ───────────────────────────────────────────────────────────────────
check('未守卫的 overrideTokens 会被发现', findUnguardedWrites(src([
  'function syncAccent(accent) {',
  "  accentLayerDispose = ctx.theme.overrideTokens('theme-gallery: accent', {",
  "    '--a': { light: accent, dark: accent },",
  '  })',
  '}',
])).violations.length === 1)

check('未守卫的 setTheme 会被发现', findUnguardedWrites(src([
  'function requestTheme(id) {',
  '  ctx.theme.setTheme(id)',
  '}',
])).violations.length === 1)

check('未守卫的 disposer 调用会被发现（disposer 也会发事件）', findUnguardedWrites(src([
  'function syncAccent() {',
  '  accentLayerDispose()',
  '  accentLayerDispose = undefined',
  '}',
])).violations.length === 1)

// ── 不该报的 ─────────────────────────────────────────────────────────────────
check('单表达式守卫写法算已守卫', findUnguardedWrites(src([
  'function requestTheme(id) {',
  '  emitting(() => ctx.theme.setTheme(id))',
  '}',
])).violations.length === 0)

check('多语句守卫写法算已守卫（含 disposer）', findUnguardedWrites(src([
  'function syncAccent(accent) {',
  '  emitting(() => {',
  '    if (accentLayerDispose !== undefined) {',
  '      accentLayerDispose()',
  '      accentLayerDispose = undefined',
  '    }',
  "    accentLayerDispose = ctx.theme.overrideTokens('theme-gallery: accent', {})",
  '  })',
  '}',
])).violations.length === 0)

check('守卫范围按括号配对结束，其后的写入仍然算未守卫', findUnguardedWrites(src([
  'function syncAccent(accent) {',
  '  emitting(() => ctx.theme.setTheme(accent))',
  "  other = ctx.theme.overrideTokens('theme-gallery: accent', {})",
  '}',
])).violations.length === 1)

check('行注释里的调用不算数', findUnguardedWrites(src([
  'function f() {',
  '  // ctx.theme.setTheme(id) 以前写在这里',
  '}',
])).violations.length === 0)

check('块注释里的调用不算数', findUnguardedWrites(src([
  'function f() {',
  '  /*',
  '   * ctx.theme.overrideTokens(x) 曾经在这里',
  '   */',
  '}',
])).violations.length === 0)

check('字符串里的调用不算数', findUnguardedWrites(src([
  "const hint = 'ctx.theme.setTheme(id)'",
])).violations.length === 0)

check('注释里的括号不会让守卫范围提前结束', findUnguardedWrites(src([
  'function f() {',
  '  emitting(() => {',
  '    // 这里的 ) 和 ( 只是散文',
  "    ctx.theme.overrideTokens('theme-gallery: accent', {})",
  '  })',
  '}',
])).violations.length === 0)

check('允许清单里的槽位动作桥不算违规', findUnguardedWrites(src([
  'return { setTheme: (id) => { ctx.theme.setTheme(id) } }',
])).violations.length === 0)

check('同一个名字出现在允许清单之外的写法仍然算违规', findUnguardedWrites(src([
  'const bridge = (id) => { ctx.theme.setTheme(id) }',
])).violations.length === 1)

// ── 按层名点名 ───────────────────────────────────────────────────────────────
check('writeForLayer 按"写入点之后的层名"匹配', (() => {
  const write = writeForLayer(src([
    'function a() {',
    '  emitting(() => {',
    "    x = ctx.theme.overrideTokens('theme-gallery: palette', {})",
    '  })',
    '}',
    'function b() {',
    "  y = ctx.theme.overrideTokens('theme-gallery: accent', {})",
    '}',
  ]), 'palette')
  return write !== undefined && write.guarded && write.line === 3
})())

check('writeForLayer 对不存在的层名返回 undefined', writeForLayer('const x = 1', 'accent') === undefined)

// ── 允许清单与回声守卫 ───────────────────────────────────────────────────────
check('allowlistUsage 数出 0 次（悬空条目可被发现）', allowlistUsage(src([
  'const x = 1',
])).every((usage) => usage.count === 0))

check('allowlistUsage 数出 2 次（重复出现可被发现 —— 条目必须精确命中 1 处）', allowlistUsage(src([
  'return { setTheme: (id) => { ctx.theme.setTheme(id) } }',
  'return { setTheme: (id) => { ctx.theme.setTheme(id) } }',
])).every((usage) => usage.count === 2))

check('回声守卫缺失时能被发现', echoGuardShape('const x = 1').found === false)

// 这个用例来自真实文件：`ctx.on('theme/change', …)` 也出现在散文里，直接 indexOf 会读到注释，
// 于是"找到守卫"是假的 —— 这份自检第一次跑就踩到了它。
check('定位跳过注释里提到的 ctx.on(\'theme/change\')', (() => {
  const shape = echoGuardShape(src([
    ' * 说明：在 ctx.on(\'theme/change\', …) 之前注册都是无效的，所以顺序很重要；',
    "const disposeChange = ctx.on('theme/change', (snapshot) => {",
    '  if (selfEmitDepth > 0) {',
    '    return',
    '  }',
    '  publish(snapshot)',
    '})',
  ]))
  return shape.found && shape.line === 2 && shape.returnsBeforePublish
})())

check('散文里的 return / publish( 不算数', (() => {
  const shape = echoGuardShape(src([
    "const disposeChange = ctx.on('theme/change', (snapshot) => {",
    '  if (selfEmitDepth > 0) {',
    '    // 这里应当 return，不能走到 publish( 去',
    '  }',
    '  publish(snapshot)',
    '})',
  ]))
  return shape.found && !shape.returnsBeforePublish
})())

check('回声守卫在 publish 之前 return 才通过', (() => {
  const shape = echoGuardShape(src([
    "const disposeChange = ctx.on('theme/change', (snapshot) => {",
    '  if (selfEmitDepth > 0) {',
    '    return',
    '  }',
    '  contribute(snapshot)',
    '  publish(snapshot)',
    '})',
  ]))
  return shape.found && shape.returnsBeforePublish
})())

check('守卫顺序颠倒（先 publish 再判断深度）会被发现', (() => {
  const shape = echoGuardShape(src([
    "const disposeChange = ctx.on('theme/change', (snapshot) => {",
    '  publish(snapshot)',
    '  if (selfEmitDepth > 0) {',
    '    return',
    '  }',
    '})',
  ]))
  return shape.found && !shape.returnsBeforePublish
})())

// ── 真实文件的变异测试 ───────────────────────────────────────────────────────
//
// 合成样本只能证明"这份实现能处理这些样本"。真实文件上有两件事合成样本证明不了：
// 解析器在 4000+ 行的真实文本上是否还活着，以及断言是否真的会失败。
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const real = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

const realWrites = findThemeWrites(real).writes
check(`真实文件上解析到写入点（${realWrites.length} 处）`, realWrites.length >= 6)
check(`真实文件上解析到 emitting 守卫（${findThemeWrites(real).spans.length} 处）`,
  findThemeWrites(real).spans.length >= 3)
check('真实文件当前没有未守卫的写入点', findUnguardedWrites(real).violations.length === 0)

// 变异 1：把 accent 层的守卫拆掉 —— 这正是 0.1.4 里的真实缺陷。
const mutAccent = real
  .replace(
    '      if (wanted === stackedAccent) return\n      emitting(() => {',
    '      if (wanted === stackedAccent) return\n      {',
  )
  .replace('        stackedAccent = wanted\n      })', '        stackedAccent = wanted\n      }')
check('变异 1 真的改动了源码（否则下面的断言什么都没测）', mutAccent !== real)
check('变异 1：拆掉 accent 层守卫后审计必须失败',
  writeForLayer(mutAccent, 'accent')?.guarded === false
  && findUnguardedWrites(mutAccent).violations.length >= 1)
check('变异 1：只影响 accent 层，palette / reading 仍被判为已守卫',
  writeForLayer(mutAccent, 'palette')?.guarded === true
  && writeForLayer(mutAccent, 'reading')?.guarded === true)

// 变异 2：把回声守卫的判断删掉 —— 那样所有 emitting 都成了装饰。
const mutEcho = real.replace('if (selfEmitDepth > 0) {\n            // Our own write coming back. Applying our own change would re-enter the write.\n            return\n          }', '')
check('变异 2 真的改动了源码', mutEcho !== real)
check('变异 2：删掉回声守卫判断后审计必须失败', echoGuardShape(mutEcho).returnsBeforePublish === false)

// 变异 3：让允许清单条目失效（槽位动作桥改名）—— 未守卫的写入点必须立刻被点出来。
const mutBridge = real.replace('setTheme: (id) => { ctx.theme.setTheme(id) }', 'setTheme: (id) => void ctx.theme.setTheme(id)')
check('变异 3：槽位动作桥不再匹配允许清单时必须被点出来',
  mutBridge !== real && findUnguardedWrites(mutBridge).violations.length === 1)

// ── 允许清单本身的形状 ───────────────────────────────────────────────────────
check(`允许清单非空且每条都写了理由（${ALLOWED_UNGUARDED.length} 条）`,
  ALLOWED_UNGUARDED.length > 0 && ALLOWED_UNGUARDED.every((entry) => entry.why.length > 20))
check('允许清单在真实文件里各精确命中 1 处',
  allowlistUsage(real).every((usage) => usage.count === 1))

if (failed > 0) {
  console.error(`\n${failed} self-emit guard logic check(s) failed`)
  process.exit(1)
}
console.log('\nself-emit guard logic checks passed')
