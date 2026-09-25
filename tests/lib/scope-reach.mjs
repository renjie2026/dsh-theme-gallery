/**
 * 找出一段源码里「作用域不可达」的调用：浅层函数引用了只存在于更深层的函数。
 *
 * 单独成模块，是为了让**正检**（tests/check-scope-reach.mjs）与它自己的**自检**
 * 跑同一份实现 —— 否则自检只是"另一套写法在印证自己"。
 *
 * ── 为什么需要这个检查 ───────────────────────────────────────────────────────
 *
 * 这一轮连续撞了四次同一类错误，全部表现为"功能静默失效"（调用方包着 try）：
 *
 *   • `ctx is not defined`            —— 工厂级函数引用了挂载体内才有的 `ctx`
 *   • `accentLayerDispose is not …`   —— 声明与读取者在同一作用域但顺序错（TDZ 类）
 *   • `ambientEnabled is not defined`  —— syncAmbient 调用了 mountGallery 内的函数
 *   • `emitting is not defined`        —— requestTheme 调用了 mountGallery 内的函数
 *
 * 后两个是**作用域不可达**：名字在词法上根本没被引用到，所以 TDZ 审计看不见。
 * 只有真跑起来才暴露 —— 而它们又比 TDZ 更容易在机械搬移代码时引入。
 */

/**
 * 把非代码内容抹成空格，保持长度与换行。
 *
 * **注释必须先行处理，且整行注释直接抹掉**，而不是逐字符找配对的引号：
 * 散文里的撇号（`the presenter's tokens`）看起来像字符串开头，
 * 会一路吞到下一个撇号 —— 于是整段函数声明从"结构视图"里消失。
 * 这个错误曾让审计在缺陷仍在时报告通过。
 *
 * `${…}` 内部保留：那里的花括号是真代码，里面的名字可以引用外层。
 * @param text - 源码文本。
 * @returns 结构版本。
 */
export function blankNonCode(text) {
  const out = []
  for (const line of text.split('\n')) {
    out.push(/^\s*(\/\/|\*|\/\*)/.test(line)
      ? line.replace(/[^\n]/g, ' ')
      : blankLine(line))
  }
  return out.join('\n')
}

/**
 * 抹掉单行里的字符串与模板内容。
 * @param line - 一行源码（已知不是纯注释行）。
 * @returns 抹掉字面量内容后的行。
 */
function blankLine(line) {
  let out = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      out += ch
      i += 1
      while (i < line.length) {
        if (line[i] === '\\') { out += '  '; i += 2; continue }
        if (line[i] === quote) { out += quote; i += 1; break }
        if (quote === '`' && line[i] === '$' && line[i + 1] === '{') {
          out += '${'
          i += 2
          let depth = 1
          while (i < line.length && depth > 0) {
            if (line[i] === '{') depth += 1
            else if (line[i] === '}') depth -= 1
            out += line[i]
            i += 1
          }
          continue
        }
        out += ' '
        i += 1
      }
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/**
 * 找出所有具名函数体（用真实花括号配对）。
 * @param structuralLines - 结构版本的行。
 * @returns `{name, start, end}`，行号从 1 开始，按出现顺序。
 */
export function functionRanges(structuralLines) {
  const ranges = []
  const stack = []
  for (let i = 0; i < structuralLines.length; i += 1) {
    const m = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(structuralLines[i])
    stack.push({ name: m === null ? null : m[1], line: i + 1 })
    for (const ch of structuralLines[i]) {
      if (ch === '{') {
        // The `{` that opens this function's body was already pushed with the declaration.
        continue
      }
      if (ch === '}') {
        const top = stack.pop()
        if (top !== undefined && top.name !== null) {
          ranges.push({ name: top.name, start: top.line, end: i + 1 })
        }
      }
    }
    // Pair the declaration's own opening brace by scanning instead (handled below).
  }
  return ranges
}

/**
 * 每个名字的（深度, 行号）列表。
 * @param structuralLines - 结构版本的行。
 * @returns Map<name, Array<{depth, at}>>。
 */
export function findBindings(structuralLines) {
  const depths = []
  {
    let depth = 0
    for (const line of structuralLines) {
      depths.push(depth)
      for (const ch of line) {
        if (ch === '{') depth += 1
        else if (ch === '}') depth -= 1
      }
    }
  }
  const bindings = new Map()
  const add = (name, at, depth) => {
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) return
    const list = bindings.get(name) ?? []
    list.push({ depth, at })
    bindings.set(name, list)
  }
  for (let i = 0; i < structuralLines.length; i += 1) {
    const line = structuralLines[i]
    const fn = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(line)
    if (fn !== null) {
      add(fn[1], i + 1, depths[i])
      // Its parameters bind inside it, so they belong to the next depth down. Recording them at
      // the function's own depth made a parameter (`function shallow(deep)`) look like a
      // shallow binding of `deep`, which hid a real unreachable call.
      for (const name of parameterNames(line)) add(name, i + 1, depths[i] + 1)
    }
    const decl = /^\s*(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/.exec(line)
    if (decl !== null) add(decl[1], i + 1, depths[i])
    // A destructuring ASSIGNMENT (`const { now } = options`) does introduce a real binding here.
    for (const name of destructuredNames(line)) add(name, i + 1, depths[i])
  }
  return { bindings, depths }
}

/**
 * 一行里被 `{ … }` 解构绑定的名字，支持跨行。
 *
 * `repeatUntilStable` 的时钟就是这样传进来的：
 *
 *     const {
 *       sample, apply, setTimer, clearTimer, now,
 *     } = options
 * @param line - 结构版本的一行。
 * @returns 名字数组。
 */
function destructuredNames(line) {
  const names = []
  for (const m of line.matchAll(/\{([^{}]*)\}\s*=/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop().replace(/=.*$/s, '').trim()
      names.push(name)
    }
  }
  // 跨行解构：单独一行只有名字列表，且上一行以 `{` 结尾。
  if (/^\s*[A-Za-z_$][\w$]*\s*(,|$)/.test(line) && !/[(){}]/.test(line)) {
    for (const part of line.split(',')) {
      const name = part.split(':').pop().replace(/=.*$/s, '').trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.push(name)
    }
  }
  return names
}

/**
 * 一行里作为形参出现的名字。
 * @param line - 结构版本的一行。
 * @returns 名字数组。
 */
function parameterNames(line) {
  const open = line.indexOf('(')
  if (open < 0 || !/function\s|=>/.test(line)) return []
  let depth = 1
  let close = -1
  for (let i = open + 1; i < line.length; i += 1) {
    if (line[i] === '(') depth += 1
    else if (line[i] === ')') { depth -= 1; if (depth === 0) { close = i; break } }
  }
  if (close < 0) return []
  return line.slice(open + 1, close)
    .split(',')
    .map((p) => p.split(':').pop().replace(/=.*$/s, '').replace(/\.\.\./g, '').trim())
    .filter((p) => /^[A-Za-z_$][\w$]*$/.test(p))
}

/**
 * 找出违规：某函数引用了只在此它更深层绑定的函数名。
 * @param source - 源码文本。
 * @returns `{caller, name, declaredAt, depth}` 数组。
 */
export function findUnreachableCalls(source) {
  const structural = blankNonCode(source)
  const structuralLines = structural.split('\n')
  const { bindings, depths } = findBindings(structuralLines)

  // 函数体范围：用花括号配对自己算，避免依赖上面的 functionRanges 的配对细节。
  const ranges = []
  for (let i = 0; i < structuralLines.length; i += 1) {
    const m = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(structuralLines[i])
    if (m === null) continue
    let depth = 0
    let started = false
    let end = i + 1
    for (let k = i; k < structuralLines.length; k += 1) {
      for (const ch of structuralLines[k]) {
        if (ch === '{') { depth += 1; started = true }
        else if (ch === '}') depth -= 1
      }
      if (started && depth === 0) { end = k + 1; break }
    }
    ranges.push({ name: m[1], start: i + 1, end, depth: depths[i] })
  }

  const violations = []
  const seen = new Set()
  for (const fn of ranges) {
    // 只关心"浅层函数"，即深度 2 的工厂级辅助函数 —— 它们最容易被误放进 mountGallery。
    if (fn.depth !== 2) continue
    const local = new Set()
    for (let i = fn.start - 1; i < fn.end; i += 1) {
      const line = structuralLines[i]
      const decl = /^\s*(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/.exec(line)
      if (decl !== null) local.add(decl[1])
      for (const n of destructuredNames(line)) local.add(n)
      for (const n of parameterNames(line)) local.add(n)
    }
    const body = structuralLines.slice(fn.start - 1, fn.end).join('\n')
    for (const [name, sites] of bindings) {
      if (local.has(name)) continue
      const shallowest = Math.min(...sites.map((s) => s.depth))
      if (shallowest <= fn.depth) continue
      if (!new RegExp(`(^|[^\\w$.])${name}\\s*\\(`).test(body)) continue
      const key = `${fn.name}:${name}`
      if (seen.has(key)) continue
      seen.add(key)
      violations.push({ caller: fn.name, name, declaredAt: sites[0].at, depth: shallowest })
    }
  }
  return violations
}
