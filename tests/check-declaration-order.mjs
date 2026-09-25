/**
 * Catch temporal-dead-zone hazards in the client bundle's apply body.
 *
 * `ctx.effect(cb)` runs `cb` SYNCHRONOUSLY, so anything the callback reads must
 * already be initialised at that point. This bit twice while building the
 * plugin — first on `storeActions`, then on `contributed` — and both times the
 * only signal was a runtime message on the page ("Cannot access 'x' before
 * initialization"), which costs a full reinstall/restart cycle to see.
 *
 * This is a static check because the file is a browser lazy-CJS bundle that
 * cannot be imported under Node. It splits the apply body at each top-level
 * statement, tracks which `const`/`let`/`function` names are already declared,
 * and reports any `ctx.effect(...)`/`ctx.slots.inject(...)` call that reads a
 * name declared LATER in the same body.
 *
 * Run with: node tests/check-declaration-order.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

let failed = 0

/**
 * Assert one condition.
 * @param label - what is being checked.
 * @param condition - the result.
 */
function check(label, condition) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
}

/**
 * Find a top-level factory function's body by brace matching.
 *
 * The plugin body used to sit directly in `exports.apply`. It now lives in a named
 * `applyGallery` so that `apply` can wrap it in a guard — a synchronous throw while mounting
 * leaves the loader's fiber pending, and the shell then waits forever on "Loading plugins...".
 * That move does not change the temporal-dead-zone hazard at all, so the audit follows the
 * body to where it now is.
 * @param signature - the declaration to locate, e.g. `function applyGallery(ctx)`.
 * @returns the body text, or null when the declaration is absent.
 */
function bodyOf(signature) {
  const start = source.indexOf(signature)
  if (start < 0) return null
  const open = source.indexOf('{', source.indexOf(')', start))
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  return null
}

const body = bodyOf('function mountGallery(')
check('found the plugin body', typeof body === 'string' && body.length > 0)

if (typeof body === 'string') {
  // Parameter names are initialised BEFORE the body runs, so they can never sit in
  // a temporal dead zone — and a nested scope may legitimately shadow one (a local
  // `const ctx = window.__X__` inside a helper is not the apply parameter). Both
  // facts have to be excluded or the audit reports false positives, which is how it
  // first flagged these very callbacks.
  const params = new Set()
  const applyAt = source.indexOf('function mountGallery(')
  const signature = source.slice(applyAt, source.indexOf(')', applyAt) + 1)
  for (const match of signature.matchAll(/[A-Za-z_$][\w$]*/g)) params.add(match[0])

  // Declaration order: every `const`/`let`/`function` name with its offset.
  //
  // Only declarations at the DIRECT child level of the apply body count. A `const`
  // inside a nested function body has its own scope and cannot be read by an outer
  // callback, so tracking it produces false positives — which is exactly how this
  // flagged a helper's local `const theme` as an outer declaration.
  const declared = []
  const declRe = /(?:^|\n)(\s*)(?:const|let)\s+([A-Za-z_$][\w$]*)|(?:^|\n)(\s*)function\s+([A-Za-z_$][\w$]*)/g
  let m
  while ((m = declRe.exec(body)) !== null) {
    const indent = m[1] ?? m[3] ?? ''
    const name = m[2] ?? m[4]
    if (params.has(name)) continue
    // The apply body sits at 6 spaces; anything deeper is inside a nested function.
    if (indent.length > 6) continue
    declared.push({ name, at: m.index })
  }
  check('found declarations to track', declared.length > 5)
  check(`excluded ${params.size} parameter name(s) from tracking`, params.size > 0)
  check('every tracked declaration is a direct child of the apply body', declared.length > 0)

  // Deferred callbacks that run LATER (subscriptions, slot gates) are exempt:
  // only the synchronous entry points matter.
  const syncCalls = ['ctx.effect(', 'ctx.on(']
  let violations = 0

  for (const decl of declared) {
    // Find a synchronous call whose opening offset is BEFORE this declaration.
    for (const call of syncCalls) {
      let searchFrom = 0
      for (;;) {
        const callAt = body.indexOf(call, searchFrom)
        if (callAt < 0) break
        searchFrom = callAt + call.length
        if (callAt > decl.at) continue // call comes after the declaration: fine
        // Slice the call's argument list (up to the matching close paren).
        const open = body.indexOf('(', callAt + call.length - 1)
        let depth = 0
        let end = open
        for (let i = open; i < body.length; i += 1) {
          if (body[i] === '(' || body[i] === '{' || body[i] === '[') depth += 1
          else if (body[i] === ')' || body[i] === '}' || body[i] === ']') {
            depth -= 1
            if (depth === 0) { end = i; break }
          }
        }
        const arg = body.slice(callAt, end + 1)
        // A name the argument declares ITSELF is a local (the callback's own
        // `const tag = ...`), not a reference to the outer declaration. Skip it.
        const declaresLocally = new RegExp(`(?:const|let|var|function)\\s+${decl.name}\\b`).test(arg)
        if (declaresLocally) continue
        // Does the call read this identifier as a whole word?
        const uses = new RegExp(`(^|[^\\w$.])${decl.name}([^\\w$]|$)`)
        if (uses.test(arg)) {
          violations += 1
          const line = body.slice(0, callAt).split('\n').length
          console.error(`  ${call} at body line ~${line} reads "${decl.name}" declared later`)
        }
      }
    }
  }

  check('no synchronous entry point reads a later declaration', violations === 0)
}

if (failed > 0) {
  console.error(`\n${failed} declaration-order check(s) failed`)
  process.exit(1)
}
console.log('\ndeclaration-order checks passed')
