/**
 * 自发光守卫（echo guard）审计的**正检**。
 *
 * 这个文件本身的正确性由 tests/check-self-emit-guard-logic.mjs 保证 ——
 * 一份错的审计比没有审计更糟，因为它给的是虚假的保证。
 *
 * 它守护的缺陷形状见 tests/lib/self-emit-guard.mjs 的头注释：主题服务的写入
 * 会同步发出 `theme/change`，而本插件订阅了该事件并回头再写 —— 不套 `emitting(...)`
 * 就是一条不经过事件循环的环（`RangeError: Maximum call stack size exceeded`），
 * 或者一条经微任务队列的环（持续烧 CPU）。
 *
 * 运行：node tests/check-self-emit-guard.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ALLOWED_UNGUARDED,
  allowlistUsage,
  echoGuardShape,
  findThemeWrites,
  findUnguardedWrites,
  writeForLayer,
} from './lib/self-emit-guard.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

let failed = 0

/**
 * 断言一条条件。
 * @param label - 在检查什么。
 * @param condition - 结果。
 */
function check(label, condition) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
}

// ── 哨兵：先证明这个审计真的看到了东西 ───────────────────────────────────────
//
// 下面每一条"通过"都建立在"解析出的是真代码"之上。如果 `blankNonCode` 或正则坏掉，
// 写入点会变成 0 个，然后所有断言都会**安静地通过** —— 这正是本项目审计曾经连错三次的形状。
const { writes, spans } = findThemeWrites(source)
check(`解析到至少 6 处主题服务写入（实际 ${writes.length} 处）`, writes.length >= 6)
check(`解析到至少 3 处 emitting(...) 守卫（实际 ${spans.length} 处）`, spans.length >= 3)

// ── 1. 不得有未守卫的写入点（允许清单除外） ──────────────────────────────────
const { violations } = findUnguardedWrites(source)
if (violations.length === 0) {
  console.log('ok   所有主题服务写入都在 emitting(...) 守卫内（或已列入允许清单）')
} else {
  failed += 1
  console.log('FAIL 所有主题服务写入都在 emitting(...) 守卫内（或已列入允许清单）')
  for (const v of violations) {
    console.log(`     L${v.line} ${v.callee}( … 未套 emitting(...) —— 它会发出 theme/change 并被订阅者回声回来`)
  }
}

// ── 2. 按内容点名：三个叠加层的写入都必须在守卫里 ────────────────────────────
//
// 用层名而不是行号：行号会随任何编辑漂移，断言就会在代码没坏时失败。
for (const layer of ['accent', 'palette', 'reading']) {
  const write = writeForLayer(source, layer)
  check(`'theme-gallery: ${layer}' 的写入点存在且带守卫`,
    write !== undefined && write.guarded)
}

// ── 3. 允许清单必须仍然指向真实存在的代码 ────────────────────────────────────
//
// 一条悬空的允许清单条目会永久地放宽审计，却看不出任何异常 —— 静默失效。
for (const usage of allowlistUsage(source)) {
  check(`允许清单条目仍精确命中 1 处（实际 ${usage.count}）：${usage.snippet.slice(0, 42)}…`,
    usage.count === 1)
}
check(`允许清单只有 ${ALLOWED_UNGUARDED.length} 条，且每条都写了理由`,
  ALLOWED_UNGUARDED.length > 0 && ALLOWED_UNGUARDED.every((entry) => entry.why.length > 20))

// ── 4. 回声守卫本身还在，且返回在 publish 之前 ───────────────────────────────
//
// 没有这一段，上面所有 `emitting` 都只是记录了一个没人读的深度。
const guard = echoGuardShape(source)
check('订阅者仍然存在', guard.found)
check('订阅者在 selfEmitDepth > 0 时先 return，再调用 publish()', guard.returnsBeforePublish)

if (failed > 0) {
  console.error(`\n${failed} self-emit guard check(s) failed`)
  process.exit(1)
}
console.log('\nself-emit guard checks passed')
