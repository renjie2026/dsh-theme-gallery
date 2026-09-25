/**
 * "先用后声明"（TDZ）审计的共用实现。
 *
 * 单独成模块，是为了让**正检**（tests/check-tdz-order.mjs）与**自检**
 * （tests/check-tdz-logic.mjs）跑同一份代码。若自检自己再实现一遍，
 * 就只是"两套有 bug 的实现互相印证"，给不出任何保证。
 *
 * 本文件已经被两次真实事故驱动着重写过：
 *
 *   事故一 `paintAttempts`：声明在**读取它的函数之后**，两者同属一个函数体。
 *   事故二 `accentLayerDispose`：声明在某个作用域里，而**读取它的函数排在同级更前面**。
 *          第一版审计只找"函数体内部的声明"，对这种形状完全失明。
 *
 * 两次都抛 ReferenceError，而调用链恰好包在 `try` 里 → 错误被吞 → 功能静默失效。
 * 所以这里的判断必须同时覆盖两种形状。
 */

/**
 * 抹掉一行里的字符串内容，仅用于"是否引用了某个名字"的判断。
 *
 * 大括号计数不能使用本函数的结果 —— 模板字符串里的 `{}` 会被抹掉。
 * @param line - 源码行。
 * @returns 抹掉字符串内容后的行。
 */
export function withoutStrings(line) {
  return line
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

/**
 * 计算每一行开始时的"大括号深度"，用于区分同级语句与嵌套块。
 * @param lines - 源码行数组。
 * @returns 与 `lines` 等长的深度数组。
 */
export function braceDepths(lines) {
  const depths = []
  let depth = 0
  for (const line of lines) {
    depths.push(depth)
    for (const ch of line) {
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
    }
  }
  return depths
}

/**
 * 找出所有具名函数体的行范围。
 * @param lines - 源码行数组。
 * @returns {Array<{name: string, start: number, end: number, depth: number}>} 行号从 1 开始。
 */
export function functionBodies(lines) {
  const bodies = []
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i])
    if (m === null) continue
    let j = i
    while (j < lines.length && !lines[j].includes('{')) j += 1
    if (j >= lines.length) continue
    let depth = 0
    let end = -1
    for (let k = j; k < lines.length; k += 1) {
      for (const ch of lines[k]) {
        if (ch === '{') depth += 1
        else if (ch === '}') {
          depth -= 1
          if (depth === 0) { end = k; break }
        }
      }
      if (end >= 0) break
    }
    if (end < 0) continue
    bodies.push({ name: m[1], start: i + 1, end: end + 1 })
  }
  return bodies
}

/**
 * 某个函数体的直接子级 `const`/`let` 声明。
 *
 * "直接子级"以**大括号深度**判断，而不是缩进：缩进不足以区分
 * `if (x) { const a = 1 }` 这类嵌套块里的声明。
 * @param lines - 源码行数组。
 * @param body - 函数体行范围。
 * @returns {Array<{name: string, at: number, depth: number}>} 行号从 1 开始。
 */
export function directDeclarations(lines, body) {
  const depths = braceDepths(lines)
  const declLine = lines[body.start - 1]
  const bodyDepth = declLine.includes('{') ? depths[body.start - 1] + 1 : depths[body.start]
  const decls = []
  for (let i = body.start; i < body.end - 1; i += 1) {
    if (depths[i] !== bodyDepth) continue
    const m = /^\s*(?:const|let)\s+([A-Za-z_$][\w$]*)/.exec(lines[i])
    if (m !== null) decls.push({ name: m[1], at: i + 1, depth: bodyDepth })
  }
  return decls
}

/**
 * 某个名字在给定行范围内是否有自己的 `const`/`let`/`var`/`function` 声明。
 *
 * 用于排除"内层作用域自己声明了同名变量"的情况 —— 那不是对外层的提前引用。
 * @param lines - 源码行数组。
 * @param name - 变量名。
 * @param from - 起始行号（1 基，含）。
 * @param to - 结束行号（1 基，含）。
 * @returns 是否存在本地声明。
 */
function declaresIn(lines, name, from, to) {
  const re = new RegExp(`(?:^|\\s)(?:const|let|var|function)\\s+${name}\\b`)
  for (let i = from - 1; i < to && i < lines.length; i += 1) {
    if (/^\s*(\/\/|\*|\/\*)/.test(lines[i])) continue
    if (re.test(withoutStrings(lines[i]))) return true
  }
  return false
}

/**
 * 这一行是否只是引用该名字（排除声明行、参数位置、文档注释）。
 * @param raw - 源码行。
 * @param name - 变量名。
 * @returns 是否算作引用。
 */
function references(raw, name) {
  if (/^\s*(\/\/|\*|\/\*)/.test(raw)) return false
  const use = new RegExp(`(^|[^\\w$.])${name}([^\\w$]|$)`)
  if (!use.test(withoutStrings(raw))) return false
  if (new RegExp(`^\\s*(?:const|let|var|function)\\s+${name}\\b`).test(raw)) return false
  if (new RegExp(`^\\s*${name}\\s*[,)]`).test(raw)) return false
  if (new RegExp(`@param[^\\n]*\\b${name}\\b`).test(raw)) return false
  return true
}

/**
 * 找出一段源码里"闭包变量在自身声明之前被引用"的全部位置。
 * @param source - 源码文本。
 * @returns 每个违规点：`{ fn, name, useAt, declAt, line }`。
 */
export function findTdzViolations(source) {
  const lines = source.split('\n')
  const depths = braceDepths(lines)
  const bodies = functionBodies(lines)

  /**
   * 包含某行的最内层函数体。
   * @param lineNo - 行号（1 基）。
   * @returns 该函数，或 undefined。
   */
  const enclosingOf = (lineNo) => {
    let best
    for (const b of bodies) {
      if (lineNo >= b.start && lineNo <= b.end) {
        if (best === undefined || (b.end - b.start) < (best.end - best.start)) best = b
      }
    }
    return best
  }

  const violations = []

  /**
   * 在一个函数体内查找"读取了 scopeBody 的子级声明、但该声明排在读取之前"的位置。
   *
   * 三种形状共用这一条判断，区别只在于"读取者"和"声明所在作用域"是谁：
   *
   *  - 同体：读取者 = 声明所在作用域 = 同一个函数体
   *  - 父级：读取者 = 子函数，声明在父作用域里
   *  - 同级：读取者与声明都在同一个父作用域里，读取者的定义排在声明之前
   * @param reader - 读取者函数体。
   * @param scopeBody - 声明所在的作用域。
   */
  const scan = (reader, scopeBody) => {
    for (const decl of directDeclarations(lines, scopeBody)) {
      if (decl.at <= reader.start) continue
      const limit = Math.min(decl.at - 1, reader.end)
      for (let i = reader.start - 1; i < limit; i += 1) {
        const raw = lines[i]
        if (!references(raw, decl.name)) continue
        // The reader may have its OWN binding of the same name declared EARLIER in its body
        // (a local `const ctx = ...` shadowing an outer one). Then the reference resolves
        // locally and the outer declaration is irrelevant — reporting it would be a false
        // positive, which is exactly how `themeDiagnostics` got flagged, since its `ctx` is
        // its own local.
        if (declaresIn(lines, decl.name, reader.start, i)) continue
        // 更深的位置说明引用在嵌套函数里：只有该嵌套作用域**自己没有同名声明**时，
        // 它才是对外层的提前引用。
        if (depths[i] > decl.depth) {
          const inner = enclosingOf(i + 1)
          if (inner !== undefined && inner !== reader
            && declaresIn(lines, decl.name, inner.start, inner.end)) continue
        }
        violations.push({
          fn: reader.name, name: decl.name, useAt: i + 1, declAt: decl.at, line: raw.trim(),
        })
        break
      }
    }
  }

  for (const reader of bodies) {
    // 同体：读者自己的子级声明。
    scan(reader, reader)
    // 再沿**作用域链向上**逐级扫描。
    //
    // 只查直接父级是不够的：`syncAccent` 是工厂级函数，而 `accentLayerDispose` 声明在
    // 它下面、却位于**祖先**作用域 `mountGallery` 里。少走这一级就漏掉了真实事故。
    let scope = enclosingOf(reader.start)
    const guard = new Set()
    while (scope !== undefined && !guard.has(scope)) {
      guard.add(scope)
      scan(reader, scope)
      scope = enclosingOf(scope.start)
      if (scope === scope) break
    }
  }

  // 去重：同一声明可能被同一条路径命中多次。
  const unique = new Map()
  for (const v of violations) unique.set(`${v.fn}:${v.name}:${v.useAt}`, v)
  return [...unique.values()]
}
