/**
 * 宠物注册表（PET_KINDS）的数据与结构断言。
 *
 * 为什么需要
 * ----------
 * 二期把"每只宠物长什么样、多快、说什么"全部收进 PET_KINDS 数据表 —— 框架零硬编码。
 * 数据表没有运行时校验（坏数据只会静默画出奇怪的东西），所以它需要自己的静态守卫：
 *
 *   1. 七只齐全、顺序正确、id 唯一（顺序 = 面板头像行顺序 = 预览页顺序）；
 *   2. 每只四件套（side/front/prop/face）+ trail 齐全且是 markup 字符串；
 *   3. 动画锚点完备（眨眼 / 待机 / 步态类）且 PET_CSS 里真的有对应规则；
 *   4. 台词数量与长度合理（气泡宽度约束）；
 *   5. 斑斑是一期资产：关键指纹（尾巴路径 + 六个色值）不许被"顺手美化"改掉；
 *   6. 预览页由注册表生成：七只都必须出现在产物里。
 *
 * 与 check-boot-path（行为）/ check-card-order（面板卡）互补；本文件只看**数据**。
 * 反证按规则 9：变异后断言必须翻转（M1..M4）。
 *
 * 运行：node tests/check-pet-registry.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

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

/** 读取器基于传入源码工作（反证要用改坏的源码重建注册表）。 */
function readLiteral(src, name, scope = {}) {
  const marker = `    const ${name} = `
  const at = src.indexOf(marker)
  if (at < 0) throw new Error(`const ${name} not found`)
  const from = at + marker.length
  let depth = 0
  let quote = null
  let end = -1
  for (let i = from; i < src.length; i += 1) {
    const ch = src[i]
    if (quote !== null) {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); if (e < 0) break; i = e; continue }
    if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) break; i = e + 1; continue }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '{' || ch === '[' || ch === '(') depth += 1
    else if (ch === '}' || ch === ']' || ch === ')') { depth -= 1; if (depth === 0) { end = i; break } }
    else if (ch === '\n' && depth === 0) { end = i - 1; break }
  }
  if (end < 0) throw new Error(`const ${name} literal not terminated`)
  const keys = Object.keys(scope)
  // eslint-disable-next-line no-new-func
  return new Function(...keys, `return (${src.slice(from, end + 1).trim()})`)(...keys.map((k) => scope[k]))
}

function readConcat(src, name) {
  const marker = `    const ${name} = `
  const at = src.indexOf(marker)
  if (at < 0) throw new Error(`const ${name} not found`)
  const stops = ['\n    const ', '\n    function ', '\n    /**'].map((s) => src.indexOf(s, at + marker.length)).filter((x) => x >= 0)
  const next = Math.min(...stops)
  if (!Number.isFinite(next)) throw new Error(`const ${name} end not found`)
  // eslint-disable-next-line no-eval
  return eval(src.slice(at + marker.length, next))
}

/** 美术常量名单 —— 与 scripts/build-pet-preview.mjs 的名单保持一致（少一个就读不出来）。 */
const ART_NAMES = [
  'PET_BAN_SIDE', 'PET_BAN_FRONT', 'PET_BAN_PROP', 'PET_BAN_FACE', 'PET_BAN_TRAIL',
  'PET_JU_SIDE', 'PET_JU_FRONT', 'PET_JU_PROP', 'PET_JU_FACE', 'PET_JU_TRAIL',
  'PET_TU_SIDE', 'PET_TU_FRONT', 'PET_TU_PROP', 'PET_TU_FACE', 'PET_TU_TRAIL',
  'PET_KE_SIDE', 'PET_KE_FRONT', 'PET_KE_PROP', 'PET_KE_FACE', 'PET_KE_TRAIL',
  'PET_SHU_SIDE', 'PET_SHU_FRONT', 'PET_SHU_PROP', 'PET_SHU_FACE', 'PET_SHU_TRAIL',
  'PET_HU_SIDE', 'PET_HU_FRONT', 'PET_HU_PROP', 'PET_HU_FACE', 'PET_HU_TRAIL',
  'PET_XIONG_SIDE', 'PET_XIONG_FRONT', 'PET_XIONG_PROP', 'PET_XIONG_FACE', 'PET_XIONG_TRAIL',
]

/**
 * 从一份源码重建宠物注册表读数（正检用真源码；反证用改坏的源码）。
 * @param {string} src - client.js 源码文本。
 * @returns `{ kinds, css, widget, cardOrder }`。
 */
function buildRegistry(src) {
  const scope = {}
  for (const name of ART_NAMES) scope[name] = readConcat(src, name)
  return {
    kinds: readLiteral(src, 'PET_KINDS', scope),
    css: readLiteral(src, 'PET_CSS', { PET_STAGE_ID: readLiteral(src, 'PET_STAGE_ID') }).join('\n'),
    widget: readLiteral(src, 'PET_WIDGET'),
    cardOrder: readLiteral(src, 'CARD_ORDER'),
  }
}

const registry = buildRegistry(source)
const kinds = registry.kinds

/** 家族的既定顺序（需求本身，改动必须是有意的）。 */
const EXPECTED_ORDER = ['ban-ban', 'da-ju', 'xue-qiu', 'bo-bo', 'nuo-mi', 'a-chi', 'tuan-tuan']

/** 这些动画锚点类一旦出现在 markup 里，PET_CSS 必须有同名选择器。 */
const ANCHORED_CLASSES = ['dsh-pet-eye', 'dsh-pet-tail', 'dsh-pet-ear', 'dsh-pet-wing',
  'dsh-pet-belly', 'dsh-pet-leg-a', 'dsh-pet-leg-b', 'dsh-pet-side', 'dsh-pet-front']

// ── 正检 ────────────────────────────────────────────────────────────────────

check('P1 七只齐全且顺序恰为 ban-ban → 团团（面板头像行顺序 = 预览页顺序）',
  Array.isArray(kinds) && kinds.length === 7
  && kinds.map((k) => k.id).join(',') === EXPECTED_ORDER.join(','),
  `实际 ${kinds.map((k) => k.id).join(',')}`)
check('P2 id 两两互异；第一只是缺省宠物 ban-ban；species/home 都是非空字符串',
  new Set(kinds.map((k) => k.id)).size === 7
  && kinds[0].id === 'ban-ban'
  && kinds.every((k) => typeof k.species === 'string' && k.species.length > 0
    && typeof k.home === 'string' && k.home.length > 0))
check('P3 尺寸在合理区间，viewBox 宽高与 size 数字一致（坐标系 = 像素 1:1）',
  kinds.every((k) => {
    const parts = String(k.viewBox).split(' ').map(Number)
    return parts.length === 4 && parts[0] === 0 && parts[1] === 0
      && parts[2] === k.size.w && parts[3] === k.size.h
      && k.size.w >= 40 && k.size.w <= 90 && k.size.h >= 34 && k.size.h <= 64
  }))
check('P4 每只 side/front/propArt/faceArt/trail.art 都是 markup 字符串（< 开头）',
  kinds.every((k) => ['side', 'front'].every((pose) => typeof k.art[pose] === 'string' && k.art[pose].startsWith('<'))
    && typeof k.propArt === 'string' && k.propArt.startsWith('<')
    && typeof k.faceArt === 'string' && k.faceArt.startsWith('<')
    && typeof k.trail.art === 'string' && k.trail.art.startsWith('<')))
check('P5 每只 side 与 front 都有眨眼锚点（class="dsh-pet-eye"）',
  kinds.every((k) => k.art.side.includes('dsh-pet-eye') && k.art.front.includes('dsh-pet-eye')))
check('P6 每只 side 恰有待机锚点（tail/ear/wing/belly 之一）且带内联 transform-origin',
  kinds.every((k) => ['.dsh-pet-tail', '.dsh-pet-ear', '.dsh-pet-wing', '.dsh-pet-belly']
    .some((cls) => k.art.side.includes(cls.slice(1)) && k.art.side.includes('transform-origin'))))
check('P7 motion ∈ {run,hop,waddle}；speed 40–200；trail.everyPx 10–40',
  kinds.every((k) => ['run', 'hop', 'waddle'].includes(k.motion)
    && typeof k.speed === 'number' && k.speed >= 40 && k.speed <= 200
    && k.trail.everyPx >= 10 && k.trail.everyPx <= 40))
check('P8 react 两声（≤12 字）、时长 1000–1800ms',
  kinds.every((k) => Array.isArray(k.react.lines) && k.react.lines.length === 2
    && k.react.lines.every((line) => typeof line === 'string' && line.length > 0 && line.length <= 12)
    && k.react.ms >= 1000 && k.react.ms <= 1800))
check('P9 chat ≥4 条且 4–26 字；cheer/done 各一条非空 ≤14 字',
  kinds.every((k) => Array.isArray(k.chat) && k.chat.length >= 4
    && k.chat.every((line) => typeof line === 'string' && line.length >= 4 && line.length <= 26)
    && typeof k.cheer === 'string' && k.cheer.length > 0 && k.cheer.length <= 14
    && typeof k.done === 'string' && k.done.length > 0 && k.done.length <= 14))
check('P10 markup 用到的每个动画锚点类，PET_CSS 里都有同名选择器（markup 与样式不许漂移）',
  (() => {
    const used = new Set()
    for (const k of kinds) {
      for (const pose of ['side', 'front']) {
        for (const m of k.art[pose].matchAll(/class="([^"]+)"/g)) {
          for (const token of m[1].split(/\s+/)) {
            if (ANCHORED_CLASSES.includes(token)) used.add(token)
          }
        }
      }
    }
    const missing = [...used].filter((cls) => !registry.css.includes(`.${cls}`))
    if (missing.length > 0) console.log(`      缺规则的锚点类: ${missing.join(', ')}`)
    return missing.length === 0
  })())
check('P11 PET_CSS 含全部关键机制：眨眼 / 摇摆步 / 戳反应 / 加油 / 精神一下',
  ['dsh-pet-blink', 'dsh-pet-waddle', 'dsh-pet-react', 'dsh-pet-cheer', 'dsh-pet-perk']
    .every((name) => registry.css.includes(name)))
check('P12 卡片 id 是 pet-family（序号 64；2026-10-01 用户序其后六卡各减 10）；旧键 pet-ban-ban 不在 CARD_ORDER',
  registry.widget.id === 'pet-family'
  && registry.cardOrder['pet-family'] === 64
  && registry.cardOrder['pet-ban-ban'] === undefined)
check('P13 斑斑是一期验收资产：尾巴路径、耳朵 rotate(-20 与六个一期色值逐个在册',
  (() => {
    const ban = kinds[0]
    const colors = ['#F5E7CE', '#C79A6B', '#A9744F', '#FBF3E4', '#4A372F', '#3B2B23']
    return ban.art.side.includes('M15 36 Q4 31 6.5 21')
      && ban.art.side.includes('rotate(-20 40 10.5)')
      && colors.every((hex) => ban.art.side.includes(hex))
  })())
check('P14 预览页由注册表生成：构建产物标明七只，且每只的名字与道具画都在',
  (() => {
    execFileSync(process.execPath, [join(root, 'scripts', 'build-pet-preview.mjs')], { stdio: 'pipe' })
    const html = readFileSync(join(root, 'tools', 'theme-bench', 'pet-preview.html'), 'utf8')
    return html.includes('宠物家族 × 7')
      && kinds.every((k) => html.includes(k.home) && html.includes(k.propArt.slice(0, 40)))
  })())

// ── 反证（规则 9：变异后上面的断言必须翻转）────────────────────────────────

const mutNoEye = source.replace('class="dsh-pet-eye"', 'class="dsh-pet-ey2"')
check('M1 真的改动了源码（斑斑的眼睛锚点被拆）', mutNoEye !== source)
const noEye = buildRegistry(mutNoEye)
check('M1 拆掉眼睛锚点后，P5 必须失败（说明那条断言真的在测 markup）',
  !(noEye.kinds[0].art.side.includes('dsh-pet-eye')))

const mutNoWaddle = source.replace("'.dsh-pet-waddle .dsh-pet-figure{animation:dsh-pet-rock .46s ease-in-out infinite}',\n", '')
check('M2 真的改动了源码（PET_CSS 的摇摆步规则被删）', mutNoWaddle !== source)
const noWaddle = buildRegistry(mutNoWaddle)
check('M2 删掉摇摆步规则后，P11 必须失败', !noWaddle.css.includes('dsh-pet-waddle'))

const mutFastPanda = source.replace("motion: 'waddle', speed: 95,", "motion: 'waddle', speed: 400,")
check('M3 真的改动了源码（熊猫的速度被改成 400）', mutFastPanda !== source)
const fastPanda = buildRegistry(mutFastPanda)
check('M3 速度越界后，P7 必须失败',
  (() => {
    const panda = fastPanda.kinds.find((k) => k.id === 'tuan-tuan')
    return !(panda.speed >= 40 && panda.speed <= 200)
  })())

const mutDropFox = source.replace("        id: 'a-chi', species: '小狐狸', home: '阿赤',", "        id: 'a-chi-x', species: '小狐狸', home: '阿赤',")
check('M4 真的改动了源码（狐狸的 id 被改掉，EXPECTED_ORDER 不再命中）', mutDropFox !== source)
const dropFox = buildRegistry(mutDropFox)
check('M4 改掉一个 id 后，P1 的顺序断言必须失败',
  dropFox.kinds.map((k) => k.id).join(',') !== EXPECTED_ORDER.join(','))

if (failed > 0) {
  console.error(`\n${failed} pet registry check(s) failed`)
  process.exit(1)
}
console.log('\npet registry checks passed')
