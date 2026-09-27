/**
 * Render a self-contained preview of the PET FAMILY (宠物家族 × 7).
 *
 * Same philosophy as build-panel-preview.mjs: the page is built from the SHIPPING
 * sources, so it cannot drift from what runs in the app.
 *
 *   · `PET_CSS`   — the widget's stylesheet, read out of `lib/client.js`;
 *   · `PET_KINDS` — the pet registry (art/params/lines), evaluated verbatim with the
 *     art constants injected as scope (an explicit name list — a missing constant
 *     throws rather than silently dropping a pet);
 *   · each pet renders THREE cells (idle with the hover tag, its own gait,
 *     poke-react front pose with its two lines) plus a summary strip of trails
 *     and portrait faces, all generated from the registry — no per-pet numbers
 *     are hard-coded here.
 *
 * Run with: node scripts/build-pet-preview.mjs
 * Output:   tools/theme-bench/pet-preview.html
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/**
 * Read a `const NAME = <literal>` and evaluate it. Bracket/quote aware, so the
 * multi-line array literal of PET_CSS works; comments are skipped the same way
 * build-panel-preview's reader does (a pair of backticks in prose must not end the scan).
 * Some literals interpolate other consts (`#${PET_STAGE_ID}`), so callers can pass a
 * scope map that becomes the eval's parameter list.
 * @param {string} name - the constant's name.
 * @param {Record<string, unknown>} [scope] - names the literal may interpolate.
 * @returns {unknown} the evaluated literal.
 */
function readLiteral(name, scope = {}) {
  const marker = `    const ${name} = `
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`lib/client.js: const ${name} not found`)
  const from = at + marker.length
  let depth = 0
  let quote = null
  let end = -1
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i]
    if (quote !== null) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && source[i + 1] === '/') {
      const lineEnd = source.indexOf('\n', i)
      if (lineEnd < 0) break
      i = lineEnd
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      const blockEnd = source.indexOf('*/', i + 2)
      if (blockEnd < 0) break
      i = blockEnd + 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1
      if (depth === 0) { end = i; break }
    } else if (ch === '\n' && depth === 0) { end = i - 1; break }
  }
  if (end < 0) throw new Error(`lib/client.js: const ${name} literal not terminated`)
  const keys = Object.keys(scope)
  // eslint-disable-next-line no-new-func
  return new Function(...keys, `return (${source.slice(from, end + 1).trim()})`)(...keys.map((k) => scope[k]))
}

/**
 * Read a multi-line string-CONCATENATION const (`'…' +\n '…'`) by slicing from its
 * declaration to the next same-indent `const`, then evaluating the expression.
 * @param {string} name - the constant's name.
 * @returns {string} the concatenated string.
 */
function readConcat(name) {
  const marker = `    const ${name} = `
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`lib/client.js: const ${name} not found`)
  // The constant ends at the next same-indent declaration; take whichever comes first.
  const stops = ['\n    const ', '\n    function ', '\n    /**']
    .map((stop) => source.indexOf(stop, at + marker.length))
    .filter((at2) => at2 >= 0)
  const next = Math.min(...stops)
  if (!Number.isFinite(next)) throw new Error(`lib/client.js: the end of const ${name} was not found`)
  // eslint-disable-next-line no-eval
  return eval(source.slice(at + marker.length, next))
}

const PET_STAGE_ID = readLiteral('PET_STAGE_ID')
const PET_CSS = readLiteral('PET_CSS', { PET_STAGE_ID }).join('\n')
// 显示缩放读自出货源码（与 petDisplaySize 同一份真值，预览 = 实机观感）。
const PET_SCALE = readLiteral('PET_SCALE')

// The registry references every art constant by name. Read them ALL — an explicit
// list, because a pet silently missing from the preview is exactly the drift this
// page exists to catch.
const ART_NAMES = [
  'PET_BAN_SIDE', 'PET_BAN_FRONT', 'PET_BAN_PROP', 'PET_BAN_FACE', 'PET_BAN_TRAIL',
  'PET_JU_SIDE', 'PET_JU_FRONT', 'PET_JU_PROP', 'PET_JU_FACE', 'PET_JU_TRAIL',
  'PET_TU_SIDE', 'PET_TU_FRONT', 'PET_TU_PROP', 'PET_TU_FACE', 'PET_TU_TRAIL',
  'PET_KE_SIDE', 'PET_KE_FRONT', 'PET_KE_PROP', 'PET_KE_FACE', 'PET_KE_TRAIL',
  'PET_SHU_SIDE', 'PET_SHU_FRONT', 'PET_SHU_PROP', 'PET_SHU_FACE', 'PET_SHU_TRAIL',
  'PET_HU_SIDE', 'PET_HU_FRONT', 'PET_HU_PROP', 'PET_HU_FACE', 'PET_HU_TRAIL',
  'PET_XIONG_SIDE', 'PET_XIONG_FRONT', 'PET_XIONG_PROP', 'PET_XIONG_FACE', 'PET_XIONG_TRAIL',
]
const artScope = {}
for (const name of ART_NAMES) artScope[name] = readConcat(name)
const PET_KINDS = readLiteral('PET_KINDS', artScope)

if (!Array.isArray(PET_KINDS) || PET_KINDS.length === 0) {
  throw new Error('PET_KINDS evaluated to nothing — the preview refuses to render an empty family')
}

/** 地面线在预览舞台上的 y（与 mock-composer 的下缘一致）。 */
const GROUND_Y = 170

/** 显示尺寸（与 lib/client.js 的 petDisplaySize / petPropDisplaySize 同式）。 */
function petDisplayOf(kind) {
  return { w: kind.size.w * PET_SCALE, h: kind.size.h * PET_SCALE }
}
function propDisplayOf(kind) {
  return { w: kind.propSize.w * PET_SCALE, h: kind.propSize.h * PET_SCALE }
}

/** 舞台内锚定的摆放：宠物右缘贴 x=516，道具在它左侧 36px —— 与运行时缺省同构。 */
function layoutOf(kind) {
  const display = petDisplayOf(kind)
  const propDisplay = propDisplayOf(kind)
  const petX = 516 - display.w
  const petY = GROUND_Y - display.h
  const propX = petX - 36 - propDisplay.w
  const propY = GROUND_Y - propDisplay.h
  return { petX, petY, propX, propY }
}

function petSvgOf(kind, pose, cls) {
  return `<svg class="${cls}" viewBox="${kind.viewBox}" aria-hidden="true">${kind.art[pose]}</svg>`
}

function propSvgOf(kind) {
  return `<svg viewBox="${kind.propViewBox}" aria-hidden="true">${kind.propArt}</svg>`
}

function trailSvgOf(kind) {
  return `<svg viewBox="0 0 ${kind.trail.w} ${kind.trail.h}" width="${kind.trail.w}" height="${kind.trail.h}" aria-hidden="true">${kind.trail.art}</svg>`
}

/**
 * One showcase cell: a mock composer (the pale box) with its ground line, the pet's
 * prop on the left and the pet itself facing it (mirrored via the flip layer, same
 * as the runtime default).
 * @param {object} kind - one PET_KINDS entry.
 * @param {string} title - the caption.
 * @param {string} actorExtra - extra classes on the actor node (gait / react).
 * @param {string} extras - additional absolutely-positioned nodes (bubbles).
 * @param {boolean} withTag - force-show the hover tag (headless browsers have no hover).
 * @param {string} figureStyle - inline style on the figure layer (hop mid-air pose).
 * @returns {string} the cell's HTML.
 */
function cell(kind, title, actorExtra, extras, withTag, figureStyle = 'transform:none') {
  const { petX, petY, propX, propY } = layoutOf(kind)
  const display = petDisplayOf(kind)
  const propDisplay = propDisplayOf(kind)
  return `
    <figure class="cell">
      <div class="stage">
        <div class="mock-composer"><span>给 AI 发消息…</span></div>
        <div class="ground"></div>
        <div class="${PET_STAGE_ID}-demo">
          <div class="dsh-pet-prop" style="width:${propDisplay.w}px;height:${propDisplay.h}px;transform:translate(${propX}px,${propY}px)">${propSvgOf(kind)}</div>
          <div class="dsh-pet-actor ${actorExtra}" style="width:${display.w}px;height:${display.h}px;transform:translate(${petX}px,${petY}px)">
            <span class="dsh-pet-tag${withTag ? ' dsh-pet-force' : ''}">
              <span class="dsh-pet-name">${kind.home}</span>
              <span class="dsh-pet-actions">
                <button type="button" class="dsh-pet-rename">改名</button>
                <button type="button" class="dsh-pet-poke">戳一下</button>
              </span>
            </span>
            <span class="dsh-pet-flip" style="transform:scaleX(-1)">
              <span class="dsh-pet-figure" style="${figureStyle}">${petSvgOf(kind, 'side', 'dsh-pet-side')}${petSvgOf(kind, 'front', 'dsh-pet-front')}</span>
            </span>
          </div>
          ${extras}
        </div>
      </div>
      <figcaption>${title}</figcaption>
    </figure>`
}

/** 一只宠物的一行三格 + 一条脚印示意。 */
function sectionOf(kind) {
  const { petX, petY } = layoutOf(kind)
  const gait = kind.motion === 'run' ? 'dsh-pet-run'
    : kind.motion === 'waddle' ? 'dsh-pet-waddle' : ''
  const gaitTitle = kind.motion === 'run' ? '跑动（腿部摆动、身体起伏）'
    : kind.motion === 'waddle' ? '摇摆步（左右摇着走）'
      : '蹦跳（起伏由运行时驱动，此处摆空中姿态）'
  const gaitFigure = kind.motion === 'hop' ? 'transform:translateY(-9px)' : 'transform:none'
  const display = petDisplayOf(kind)
  const bubbles =
    `<span class="dsh-pet-bubble" style="transform:translate(${petX + display.w + 6}px,${petY - 34}px)">${kind.react.lines[0]}</span>` + '\n          '
    + `<span class="dsh-pet-bubble" style="transform:translate(${petX + 34}px,${petY - 62}px)">${kind.react.lines[1]}</span>`
  const trail =
    `<div class="dsh-pet-trailmark" style="transform:translate(${petX + 6}px,${GROUND_Y - kind.trail.h + 1}px)">${trailSvgOf(kind)}</div>`
  return `
  <section class="family">
    <h2>${kind.home} · ${kind.species}<span class="meta">步态 ${kind.motion} · ${kind.speed}px/s · 道具在左，面朝左</span></h2>
    <div class="row">
      ${cell(kind, '① 静止：待机微动画（悬停出名牌）', '', '', true)}
      ${cell(kind, `② ${gaitTitle}`, gait, kind.motion === 'hop' ? trail : '', false, gaitFigure)}
      ${cell(kind, '③ 戳一下：转身面对用户，说两句', 'dsh-pet-react', bubbles, false)}
    </div>
  </section>`
}

/** 汇总行：七枚脚印 + 七颗头像。 */
function summaryOf() {
  const trails = PET_KINDS.map((kind, i) =>
    `<figure class="chip"><div class="dsh-pet-trailmark" style="position:static;transform:none">${trailSvgOf(kind)}</div><figcaption>${kind.home}</figcaption></figure>`).join('')
  const faces = PET_KINDS.map((kind) =>
    `<figure class="chip"><svg viewBox="${kind.faceViewBox}" width="30" height="30" aria-hidden="true">${kind.faceArt}</svg><figcaption>${kind.home} · ${kind.species}</figcaption></figure>`).join('')
  return `
  <section class="family">
    <h2>脚印与头像（面板选择行用的就是这些脸）</h2>
    <div class="chips">${trails}</div>
    <div class="chips">${faces}</div>
  </section>`
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>DSH 宠物挂件 · 宠物家族 × ${PET_KINDS.length} 预览</title>
<style>
  body{margin:0;padding:24px;background:#F7F5F0;color:#2B2B2B;
    font:14px/1.7 system-ui,"Segoe UI","Microsoft YaHei",sans-serif}
  h1{font-size:16px;margin:0 0 4px}
  p.note{margin:0 0 18px;font-size:12.5px;color:#666}
  h2{font-size:14px;margin:26px 0 10px}
  h2 .meta{font-weight:400;font-size:12px;color:#888;margin-left:10px}
  .row{display:flex;flex-wrap:wrap;gap:22px}
  .cell{margin:0}
  .cell figcaption{margin-top:8px;font-size:12px;color:#555;text-align:center}
  /* 预览壳：模拟输入框与地面线。真实位置由运行时按 composer 计算，这里只摆造型。 */
  .stage{position:relative;width:560px;height:230px;background:#FBFAF7;
    border:.5px solid #DDD6C8;border-radius:12px;overflow:hidden}
  .mock-composer{position:absolute;left:44px;right:96px;top:96px;height:74px;
    background:#FFFFFF;border:1px solid #E2DCCC;border-radius:14px;
    display:flex;align-items:center;padding:0 16px;color:#B9B2A4;font-size:13px}
  .ground{position:absolute;left:0;right:0;top:${GROUND_Y}px;height:0;border-top:1px dashed #E4DECF}
  .${PET_STAGE_ID}-demo{position:absolute;left:0;top:0;width:560px;height:230px}
  .chips{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
  .chip{margin:0;text-align:center}
  .chip figcaption{font-size:11px;color:#666;margin-top:4px}
</style>
<style>
/* ── the widget's own stylesheet, verbatim from lib/client.js ──────────── */
${PET_CSS}
</style>
<style>
  /* 预览专用：不悬停也强制显示名牌（无头浏览器没有 hover）。名牌的显隐机制是
     opacity/visibility（透明桥 + 延迟隐藏），不是 display —— 强制类跟着同一机制。 */
  .dsh-pet-tag.dsh-pet-force{opacity:1;visibility:visible;transition:none}
</style>
</head>
<body>
  <h1>宠物挂件 · 宠物家族（预览页，由 scripts/build-pet-preview.mjs 从 lib/client.js 生成）</h1>
  <p class="note">美术、参数、台词全部读自出货源码的 PET_KINDS 注册表。每只三格：静止 / 各自步态 / 戳一下；
  末尾是七枚脚印与七颗头像。眨眼、尾巴、耳朵、翅膀、肚皮呼吸等待机动画在本页即为实际效果。</p>
  ${PET_KINDS.map(sectionOf).join('')}
  ${summaryOf()}
</body>
</html>
`

const out = join(root, 'tools', 'theme-bench', 'pet-preview.html')
writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes, ${PET_KINDS.length} pets)`)
