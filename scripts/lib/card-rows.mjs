/**
 * 配色表（`lib/palette-schemes.json`）与卡片引用（主题 JSON 的 `card.rows`）的校验。
 *
 * ── 为什么单独成模块 ─────────────────────────────────────────────────────────
 *
 * 和 `copy-consistency.mjs` 同一个理由：让**建期校验**（`scripts/embed-themes.mjs`，
 * 发布 CI 与 `npm run check` 都会跑）与**它的自检**（`tests/check-card-order.mjs`，
 * 含变异反证）跑**同一份实现**。写成两份的话，自检只是"另一套写法在印证自己"——
 * 本仓库有过"审计连错三次、每次都报告通过"的记录（硬性规则 6）。
 *
 * 本模块只做纯计算：给它配色表 / 一个主题定义，返回问题清单。不读文件、不打印、不退出。
 *
 * ── 它守的四种静默失败 ───────────────────────────────────────────────────────
 *
 *   1. **撞色排的圆点糊进底色。** 圆点只有 10px，两色明度接近时它整块消失在底色里，
 *      无异常、无日志。实测反例：`碧色 #1BD1A5` 上的红点只有 1.14:1、
 *      `海棠红 #DB5A6B` 上的竹青只有 1.07:1。
 *   2. **正文在底色上读不清。** 配色表只写三四个色，其余由代码派生；底色与深色文字的
 *      对比度是整个方案的阅读下限，必须在这里拦住。
 *   3. **卡片引用了一个不存在的方案**（拼错 id、改名）—— 那一格画不出来，而整张卡会
 *      静默退回默认色带，看起来只是"样式不一样"。
 *   4. **把撞色画成一块纯色**：方案自己的 `kind` 与所在排不一致时会这样，读起来只是
 *      "这一格颜色怪怪的"。
 */

/** 6 位十六进制字面量。 */
const HEX = /^#[0-9a-fA-F]{6}$/

/** 方案 id 的形态（`p-` 前缀，避免与主题 id 混淆）。 */
const SCHEME_ID = /^p-[a-z0-9-]+$/

/** 小圆点相对底色必须达到的对比度。2.5:1 不是审美阈值，是"还看得见"的下限。 */
export const MIN_DOT_CONTRAST = 2.5

/** 深色正文压在方案底色上的下限。低于它整屏文字都吃力。 */
export const MIN_LABEL_CONTRAST = 7

/** 一排最多几个色值按钮：卡片最小内宽 176px，第 6 个只剩约 28px，会读成条纹。 */
export const MAX_ROW_SLOTS = 5

/** 方案自己必须是这两种之一。 */
export const SCHEME_KINDS = ['solid', 'clash']

/**
 * sRGB 相对亮度（WCAG 2.x 的定义）。
 * @param hex - `#rrggbb`。
 * @returns 0..1 的相对亮度；非法输入返回 null。
 */
function luminance(hex) {
  if (typeof hex !== 'string' || !HEX.test(hex)) return null
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  const linear = channels.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/**
 * WCAG 对比度（1..21）。
 * @param a - `#rrggbb`。
 * @param b - `#rrggbb`。
 * @returns 对比度；任一输入非法时返回 null。
 */
export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * 校验配色表本身。
 * @param schemes - `lib/palette-schemes.json` 里的 `schemes` 数组。
 * @returns 问题描述数组；空数组表示通过。
 */
export function paletteProblems(schemes) {
  const problems = []
  if (!Array.isArray(schemes) || schemes.length === 0) {
    return ['palette-schemes: schemes must be a non-empty array']
  }
  const seen = new Set()
  schemes.forEach((scheme, index) => {
    const at = `schemes[${index}]${scheme && scheme.id ? ` (${scheme.id})` : ''}`
    if (scheme === null || typeof scheme !== 'object' || Array.isArray(scheme)) {
      problems.push(`${at}: must be an object`)
      return
    }
    if (typeof scheme.id !== 'string' || !SCHEME_ID.test(scheme.id)) {
      problems.push(`${at}: id must look like "p-xiang-se" (lowercase, digits and dashes, p- prefix)`)
    } else if (seen.has(scheme.id)) {
      problems.push(`${at}: duplicate scheme id`)
    } else {
      seen.add(scheme.id)
    }
    if (!SCHEME_KINDS.includes(scheme.kind)) {
      problems.push(`${at}: kind must be one of ${SCHEME_KINDS.join(', ')}`)
    }
    if (typeof scheme.label !== 'string' || scheme.label === '') problems.push(`${at}: label must be non-empty`)
    if (typeof scheme.source !== 'string' || scheme.source === '') {
      // 出处不是装饰：这一类的全部价值就是"色从哪本书里来"，缺了就没人能复核。
      problems.push(`${at}: source must name the colour-library entry it came from`)
    }
    for (const field of ['main', 'ground', 'ink']) {
      if (typeof scheme[field] !== 'string' || !HEX.test(scheme[field])) {
        problems.push(`${at}: ${field} must be a 6-digit hex colour`)
      }
    }
    if (scheme.fill !== undefined && (typeof scheme.fill !== 'string' || !HEX.test(scheme.fill))) {
      problems.push(`${at}: fill, when present, must be a 6-digit hex colour`)
    }
    if (scheme.kind === 'clash') {
      const dots = scheme.dots
      if (!Array.isArray(dots) || dots.length < 1 || dots.length > 4) {
        problems.push(`${at}: a clash scheme needs 1..4 dots`)
      } else {
        dots.forEach((dot, i) => {
          if (typeof dot !== 'string' || !HEX.test(dot)) {
            problems.push(`${at}: dots[${i}] must be a 6-digit hex colour`)
            return
          }
          const ratio = contrastRatio(dot, scheme.main)
          if (ratio !== null && ratio < MIN_DOT_CONTRAST) {
            problems.push(`${at}: dots[${i}] ${dot} is only ${ratio.toFixed(2)}:1 against main `
              + `${scheme.main} — under ${MIN_DOT_CONTRAST}:1 the dot disappears into the band`)
          }
        })
      }
    } else if (scheme.dots !== undefined) {
      problems.push(`${at}: only a clash scheme carries dots`)
    }
    const read = contrastRatio(scheme.ink, scheme.ground)
    if (read !== null && read < MIN_LABEL_CONTRAST) {
      problems.push(`${at}: ink ${scheme.ink} on ground ${scheme.ground} is only ${read.toFixed(2)}:1 `
        + `— under ${MIN_LABEL_CONTRAST}:1 every screen of text is a strain`)
    }
  })
  return problems
}

/**
 * 收集一张卡片的 `card.rows` 的全部问题。
 *
 * `card` 缺失时返回空数组 —— 默认的单排色带仍然是合法形态（九套场景皮肤都走它）。
 * @param theme - 主题定义（皮肤 JSON 里的一个对象）。
 * @param schemes - 配色表，用于核对卡片引用的方案真的存在。
 * @returns 问题描述数组；空数组表示通过。
 */
export function cardRowProblems(theme, schemes) {
  const problems = []
  const card = theme?.card
  if (card === undefined) return problems
  const where = String(theme?.id ?? '(no id)')
  if (card === null || typeof card !== 'object' || Array.isArray(card)) {
    return [`${where}: card must be an object`]
  }
  for (const key of Object.keys(card)) {
    if (key !== 'rows') problems.push(`${where}: card.${key} is not a known field (only "rows")`)
  }
  const rows = card.rows
  if (!Array.isArray(rows)) return [...problems, `${where}: card.rows must be an array`]
  if (rows.length < 2 || rows.length > 3) {
    problems.push(`${where}: card.rows must hold 2 or 3 rows, found ${rows.length}`)
  }

  const used = []
  rows.forEach((row, index) => {
    const at = `card.rows[${index}]`
    if (row === null || typeof row !== 'object' || Array.isArray(row)) {
      problems.push(`${where}: ${at} must be an object`)
      return
    }
    for (const key of Object.keys(row)) {
      if (key !== 'kind' && key !== 'schemes') problems.push(`${where}: ${at}.${key} is not a known field`)
    }
    const isLast = index === rows.length - 1
    const wanted = isLast ? 'clash' : 'solid'
    if (row.kind !== wanted) {
      problems.push(`${where}: ${at}.kind must be "${wanted}"`
        + (isLast ? ' — the LAST row is the clash row' : ' — only the last row may be the clash row'))
    }
    if (!Array.isArray(row.schemes) || row.schemes.length < 1 || row.schemes.length > MAX_ROW_SLOTS) {
      problems.push(`${where}: ${at}.schemes must hold 1..${MAX_ROW_SLOTS} scheme ids`)
      return
    }
    row.schemes.forEach((id, slot) => {
      const slotAt = `${where}: ${at}.schemes[${slot}]`
      if (typeof id !== 'string' || !SCHEME_ID.test(id)) {
        problems.push(`${slotAt} must be a scheme id like "p-xiang-se"`)
        return
      }
      const scheme = (Array.isArray(schemes) ? schemes : []).find((entry) => entry?.id === id)
      if (scheme === undefined) {
        problems.push(`${slotAt} ${id} is not in lib/palette-schemes.json`
          + ' — the slot would not draw, and the whole card silently falls back to the default strip')
        return
      }
      if (scheme.kind !== row.kind) {
        problems.push(`${slotAt} ${id} is a "${scheme.kind}" scheme in a "${row.kind}" row`
          + ' — a clash scheme drawn as one flat block reads as a colour that is merely off')
      }
      used.push(id)
    })
  })

  const repeated = used.filter((id, i) => used.indexOf(id) < i)
  if (repeated.length > 0) {
    problems.push(`${where}: card.rows repeats ${[...new Set(repeated)].join(', ')}`
      + ' — each button is one option, so a repeat is a copy-paste slip, not a design')
  }
  return problems
}
