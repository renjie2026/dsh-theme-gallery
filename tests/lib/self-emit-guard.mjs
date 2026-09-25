/**
 * 找出「主题服务写入没有跑在自发光守卫里」的调用点。
 *
 * 单独成模块，是为了让**正检**（tests/check-self-emit-guard.mjs）与它自己的**自检**
 * （tests/check-self-emit-guard-logic.mjs）跑同一份实现 —— 否则自检只是"另一套写法在印证自己"。
 *
 * ── 这个检查守的是什么 ───────────────────────────────────────────────────────
 *
 * `ctx.theme.overrideTokens()` / `ctx.theme.setTheme()` 会**同步**发出 `theme/change`；
 * 本插件订阅了该事件，并在事件里调用 `publish()` → `syncSkin()` → 又写主题服务。
 * 这是一条**不经过事件循环**的环，所以它不是"慢循环"而是**自旋**。
 *
 * 断环的唯一可靠手段是 `emitting(...)`：它在执行写入期间抬高 `selfEmitDepth`，
 * 订阅者看到深度大于 0 就知道"这是我自己的写入回来了"，直接返回。
 *
 * 因此不变式是：
 *
 *     任何会发出 `theme/change` 的调用，都必须处在某个 `emitting(...)` 的实参范围内，
 *     除非它是一个显式列出的**外部入口**（用户点击皮肤时必须真写进去，
 *     而且那一次写入正是订阅者赖以反应的信号）。
 *
 * ── 已经用这条规则抓到的真实缺陷 ─────────────────────────────────────────────
 *
 * ・`syncAccent`：`overrideTokens('theme-gallery: accent')` 与它的 disposer 都没有守卫，
 *   于是 `publish → syncSkin → syncAccent → overrideTokens → theme/change → publish → …`
 *   无限加深调用栈，最终 `RangeError: Maximum call stack size exceeded`；
 *   因为每一层都有自己的 `try/catch`，控制台刷出的是**几百行一模一样的**
 *   "could not stack the accent layer"，而不是一条错误。
 * ・`syncReadingLayer`：同样缺守卫，而它的触发源是 `document.body` 上的 `MutationObserver`
 *   —— 写入 → 事件 → 重绘 → DOM 变动 → 再写入，是一条**微任务队列**上的环。
 *
 * 这两个都是"静默失败/跑飞"家族，而不是会自己报错的错误，所以必须静态守住。
 */

import { blankNonCode } from './scope-reach.mjs'

/**
 * 会发出 `theme/change` 的调用点形状。
 *
 * 三类：
 *  - `ctx.theme.overrideTokens(` / `ctx.theme.setTheme(` —— 服务本身；
 *  - 以 `Dispose` 结尾的调用 —— 叠加层返回的 disposer **也会**发出 `theme/change`
 *    （`stackSkinTokens` 的注释里写明了这一点），漏掉它们就等于漏掉一半写入。
 *
 * 只认 `ctx.theme.…` 的**字面**形状：本仓库里所有写入都是这一个写法，
 * 而"随便猜哪个调用会发事件"会让审计变成猜测。
 */
const WRITE_PATTERN = /(?:^|[^\w$.])(ctx\.theme\.(?:setTheme|overrideTokens)|[A-Za-z_$][\w$]*Dispose)\s*\(/g

/**
 * 允许不带守卫的写入点，**每一条都必须写明理由**。
 *
 * 审计的强度来自这份清单很短：新增一个不守卫的写入点就会让它失败，
 * 而不是让它悄悄放宽。
 *
 * @type {ReadonlyArray<{snippet: string, why: string}>}
 */
export const ALLOWED_UNGUARDED = [
  {
    snippet: 'setTheme: (id) => { ctx.theme.setTheme(id) }',
    why: '这是交给外壳的槽位动作：用户点某个皮肤时由外壳调用。它必须真的写进主题服务 —— '
      + '那次 `theme/change` 正是本插件得知"用户换了皮肤"的唯一信号。若把它也包进 `emitting`，'
      + '订阅者会把自己的触发源当成回声丢掉，面板点了没反应（静默失效）。',
  },
]

/**
 * 括号配对：从 `open` 处的 `(` 找到与之匹配的 `)`。
 * @param text - 抹掉非代码后的文本。
 * @param open - `(` 的下标。
 * @returns 匹配的 `)` 下标，找不到时返回 -1。
 */
function matchParen(text, open) {
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * 每一处 `emitting(...)` 的实参范围。
 *
 * 用括号配对而不是"看到 emitting( 就往前找一行"，因为守卫既有单表达式写法
 * （`emitting(() => ctx.theme.setTheme(id))`）也有多语句块写法。
 * @param structural - 抹掉非代码后的文本。
 * @returns `{start, end}` 数组，下标为 `emitting(` 的实参左括号与右括号。
 */
export function emittingSpans(structural) {
  const spans = []
  const re = /(?:^|[^\w$.])emitting\s*\(/g
  let m
  while ((m = re.exec(structural)) !== null) {
    const open = m.index + m[0].length - 1
    const close = matchParen(structural, open)
    if (close > open) spans.push({ start: open, end: close })
  }
  return spans
}

/**
 * 找出所有会发出 `theme/change` 的写入点，并判断是否在守卫内。
 * @param source - 源码文本。
 * @returns `{writes, spans}`；每个 write 为 `{callee, at, line, guarded}`。
 */
export function findThemeWrites(source) {
  const structural = blankNonCode(source)
  const spans = emittingSpans(structural)
  const writes = []
  const re = new RegExp(WRITE_PATTERN.source, 'g')
  let m
  while ((m = re.exec(structural)) !== null) {
    // `m.index` 指向匹配开头的分隔符（可能是换行或空格），真正的调用名从组 1 开始。
    const at = m.index + m[0].indexOf(m[1])
    writes.push({
      callee: m[1],
      at,
      line: source.slice(0, at).split('\n').length,
      guarded: spans.some((span) => at > span.start && at < span.end),
    })
  }
  return { writes, spans }
}

/**
 * 一行里是否出现某段允许清单代码（按"空白折叠后包含"比较，免得被缩进改动误判）。
 * @param source - 源码文本。
 * @param snippet - 允许清单里的片段。
 * @returns 是否出现。
 */
function containsSnippet(source, snippet) {
  const squeeze = (text) => text.replace(/\s+/g, ' ')
  return squeeze(source).includes(squeeze(snippet))
}

/**
 * 违规的写入点：不在守卫内，也不在允许清单里。
 * @param source - 源码文本。
 * @param allowed - 允许清单，缺省用 {@link ALLOWED_UNGUARDED}。
 * @returns `{violations, writes, spans}`。
 */
export function findUnguardedWrites(source, allowed = ALLOWED_UNGUARDED) {
  const { writes, spans } = findThemeWrites(source)
  const violations = writes.filter((write) => {
    if (write.guarded) return false
    // 允许清单按"这一行里出现了清单里的片段"判定。整份源码里这个片段只出现一次，
    // 因为它是唯一的槽位动作桥；重复出现会在自检里被点出来。
    const lineText = source.split('\n')[write.line - 1] ?? ''
    return !allowed.some((entry) => containsSnippet(lineText, entry.snippet))
  })
  return { violations, writes, spans }
}

/**
 * 某个叠加层（`'theme-gallery: <name>'`）的写入点。
 *
 * 判据是"写入点之后 120 个字符内出现该层名字符串"，而不是"层名字符串之前最近的写入点"：
 * 后者会被**注释里提到的层名**骗到（注释在前，最近的真实写入点可能是另一个层），
 * 于是断言看错了对象却仍然通过。
 *
 * 按内容点名（而不是按行号）是有意的 —— 行号会随任何编辑漂移，
 * 断言就会在代码没坏的时候失败，最后被人删掉。
 * @param source - 源码文本。
 * @param layer - 层名，如 `accent`。
 * @returns 写入点，或 undefined（找不到该层的写入调用）。
 */
export function writeForLayer(source, layer) {
  const needle = `'theme-gallery: ${layer}'`
  const { writes } = findThemeWrites(source)
  return writes.find((write) => source.slice(write.at, write.at + 120).includes(needle))
}

/**
 * 允许清单里每一条在源码里出现多少次。
 * @param source - 源码文本。
 * @param allowed - 允许清单。
 * @returns `{snippet, count}[]`。
 */
export function allowlistUsage(source, allowed = ALLOWED_UNGUARDED) {
  const squeeze = (text) => text.replace(/\s+/g, ' ')
  const flat = squeeze(source)
  return allowed.map((entry) => {
    const needle = squeeze(entry.snippet)
    let count = 0
    let from = 0
    for (;;) {
      const at = flat.indexOf(needle, from)
      if (at < 0) break
      count += 1
      from = at + needle.length
    }
    return { snippet: entry.snippet, count }
  })
}

/**
 * 回声守卫本身是否还在：订阅者必须在 `selfEmitDepth > 0` 时**先返回**，
 * 而且要返回在调用 `publish(` 之前。
 *
 * `emitting` 只负责记录"这次事件是我造成的"；真正据此刹车的只有这一段。
 * 少了它，上面所有守卫都只是装饰。
 *
 * 两处细节都是被真实文件逼出来的：
 *
 *  • **定位必须跳过注释行** —— `ctx.on('theme/change', …)` 也出现在本文件的散文里，
 *    直接 `indexOf` 会读到一段注释，于是"找到了守卫"是假的（这个自检第一次就踩到了）；
 *  • **范围按括号配对取整个调用** —— 固定窗口会越过 handler，读到后面无关的 `publish(`，
 *    那样"先 return 再 publish"的顺序判断就失去意义。
 * @param source - 源码文本。
 * @returns `{found, returnsBeforePublish, at, line}`。
 */
export function echoGuardShape(source) {
  const lines = source.split('\n')
  let at = -1
  let line = -1
  let consumed = 0
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*(\/\/|\*|\/\*)/.test(lines[i])) {
      const col = lines[i].indexOf("ctx.on('theme/change'")
      if (col >= 0) {
        at = consumed + col
        line = i + 1
        break
      }
    }
    consumed += lines[i].length + 1
  }
  if (at < 0) return { found: false, returnsBeforePublish: false, at: -1, line: -1 }

  const structural = blankNonCode(source)
  const open = structural.indexOf('(', at)
  const close = matchParen(structural, open)
  const body = structural.slice(at, close > open ? close : at + 1200)
  // On the structural copy, so a `return` or `publish(` mentioned in PROSE between the two points
  // cannot satisfy either test.
  const depthAt = body.search(/if \(selfEmitDepth > 0\)/)
  const publishAt = body.indexOf('publish(')
  return {
    found: true,
    returnsBeforePublish: depthAt >= 0 && publishAt > depthAt && /\breturn\b/.test(body.slice(depthAt, publishAt)),
    at,
    line,
  }
}
