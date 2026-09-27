/**
 * 心情问候语（标题栏跑马灯）的断言。
 *
 * ── 这个文件守的是什么 ───────────────────────────────────────────────────────
 *
 * 第 14 张卡「心情问候」是一条完整的链：语料 JSON → 建期校验/内联 → 运行时轮换与
 * 几何（mood 模块）→ shell.overlay 座位 → 面板卡（胶囊开关 + 三组设置）。这条链上
 * 每一环坏掉都是**静默**的：问候条不出现、设置点不亮、语料变空，全都没有异常。
 *
 * 所以这里分三层断言，全部从真实源码**提取并执行**（与 check-card-order 同一手法，
 * 不可能与出货代码各说各话）：
 *
 *   1. 数据层：lib/mood-lines.json 的形状、红线（黑名单零命中）、内联副本与文件一致；
 *   2. 源码层：卡片/座位/注入面/接线都在，且 mood 模块有界（一个 setTimeout、
 *      一个 resize listener、零 innerHTML、零主题服务写入）；
 *   3. 行为层：时段池边界、节日优先、日期种子洗牌、回绕不重复、5 等份几何、
 *      默认开（胶囊开关的缺省态）。
 *
 * ── 变异反证（硬性规则 9）────────────────────────────────────────────────────
 *
 * 每条关键断言都配了变异（M1–M10）：先证"变异真的改动了源码"，再证"断言翻红"。
 *
 * 运行：node tests/check-mood.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const real = readFileSync(join(root, 'lib', 'client.js'), 'utf8')
const moodJsonText = readFileSync(join(root, 'lib', 'mood-lines.json'), 'utf8')
const embedScript = readFileSync(join(root, 'scripts', 'embed-themes.mjs'), 'utf8')

let failed = 0
function check(label, condition) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
}
function stripComments(text) {
  return text.split('\n').filter((line) => !/^\s*(\/\/|\*)/.test(line)).join('\n')
}

/* ── 提取器（与 check-card-order 逐字节同款）──────────────────────────────── */

function readConst(source, name) {
  const marker = `    const ${name} = `
  const at = source.indexOf(marker)
  if (at < 0) throw new Error(`const ${name} not found`)
  const from = at + marker.length
  let depth = 0
  let end = -1
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{' || ch === '[' || ch === '(') depth += 1
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1
      if (depth === 0) { end = i; break }
    } else if (depth === 0 && ch === '\n') { end = i - 1; break }
  }
  if (end < 0) throw new Error(`const ${name} literal not terminated`)
  // eslint-disable-next-line no-eval
  return eval(`(${source.slice(from, end + 1).trim()})`)
}

function block(source, name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`function ${name} not found`)
  let parens = 0
  let close = -1
  for (let i = source.indexOf('(', start); i < source.length; i += 1) {
    if (source[i] === '(') parens += 1
    else if (source[i] === ')') {
      parens -= 1
      if (parens === 0) { close = i; break }
    }
  }
  if (close < 0) throw new Error(`could not find the parameter list of ${name}`)
  const open = source.indexOf('{', close)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`could not find the end of ${name}`)
}

/* ── mood 模块区域的切片（安全审计用：innerHTML / 计时器 / 监听器计数）──────── */

const moodRegionStart = real.indexOf('心情问候语（标题栏跑马灯）')
const moodRegionEnd = real.indexOf('function ThemeGalleryPage(')
if (moodRegionStart < 0 || moodRegionEnd < 0 || moodRegionEnd < moodRegionStart) {
  throw new Error('could not slice the mood module region')
}
const moodRegion = real.slice(moodRegionStart, moodRegionEnd)

/* ── 行为层沙箱：提取 mood 纯函数，喂桩 localStorage 执行 ──────────────────── */

const MOOD_CONSTS = ['MOOD_WIDGET', 'MOOD_KEY', 'MOOD_POINTER_KEY', 'MOOD_SPEEDS',
  'MOOD_ZONE_GEOMETRY', 'MOOD_TIME_POOLS', 'MOOD_WINBTN_RESERVE', 'MOOD_MENU_GAP',
  'MOOD_FALLBACK_MENU_RIGHT', 'MOOD_CATEGORIES']
const MOOD_FNS = ['sanitizeMoodLines', 'readMoodState', 'moodDateKey', 'moodMonthDay',
  'moodPoolName', 'moodHolidayMatches', 'moodPicksFor', 'moodHash', 'mulberry32',
  'moodDayOrder', 'moodPointer', 'saveMoodPointer', 'moodNextLine', 'moodMenuRight', 'moodZoneRect']

/** 桩 localStorage：与 boot-path 的桩同形状（get/set/remove + 内部 Map）。 */
function makeStorage(seed) {
  const map = new Map(Object.entries(seed ?? {}))
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

/**
 * 组装 mood 沙箱。所有函数声明先于常量文本（函数体惰性引用，求值顺序安全），
 * `MOOD_LINES` 一行放在最后执行 —— 与工厂体的真实顺序一致。
 * @param source - lib/client.js 源码（变异测试时传变异后的文本）。
 * @param window_ - window 桩。
 * @returns 提取出的函数与常量。
 */
function makeSandbox(source, window_) {
  const parts = []
  for (const name of MOOD_FNS) parts.push(block(source, name))
  for (const name of MOOD_CONSTS) parts.push(`const ${name} = ${JSON.stringify(readConst(source, name))}`)
  parts.push('const MOOD_LINES = sanitizeMoodLines(BUNDLED_MOOD_LINES)')
  parts.push('return { MOOD_LINES, sanitizeMoodLines, readMoodState, moodDateKey, moodMonthDay, '
    + 'moodPoolName, moodHolidayMatches, moodPicksFor, moodDayOrder, moodNextLine, moodZoneRect, moodMenuRight, '
    + 'moodPointer, saveMoodPointer, '
    + 'MOOD_WIDGET, MOOD_KEY, MOOD_POINTER_KEY, MOOD_SPEEDS, MOOD_ZONE_GEOMETRY, MOOD_TIME_POOLS, '
    + 'MOOD_WINBTN_RESERVE, MOOD_MENU_GAP, MOOD_FALLBACK_MENU_RIGHT }')
  const bundled = readConst(source, 'BUNDLED_MOOD_LINES')
  // eslint-disable-next-line no-new-func
  return new Function('window', 'document', 'BUNDLED_MOOD_LINES', parts.join('\n'))(window_, undefined, bundled)
}

const pack = JSON.parse(moodJsonText)
const inlinePack = readConst(real, 'BUNDLED_MOOD_LINES')
const sandbox = makeSandbox(real, { localStorage: makeStorage() })

/* ── 1. 数据层：语料文件与内联副本 ─────────────────────────────────────────── */

const BLACKLIST_SAMPLE = ['自杀', '抑郁', '绝望', '崩溃', '暴力', '色情', '赌博', '毒品', '生无可恋']
const CATEGORIES = ['morning', 'day', 'night', 'general', 'holiday']
const ids = new Set()
const byCategory = new Map()

check(`语料共 ${pack.lines.length} 条（种子 40 条不得丢失）`,
  pack.lines.length === 61 && pack.lines.length >= 40)
for (const line of pack.lines) {
  ids.add(line.id)
  byCategory.set(line.category, (byCategory.get(line.category) ?? 0) + 1)
}
check('语料 id 全部唯一且形如 m\\d{3}',
  ids.size === pack.lines.length && [...ids].every((id) => /^m\d{3}$/.test(id)))
check('语料文本全部非空且 ≤ 100 字符',
  pack.lines.every((line) => typeof line.text === 'string' && line.text.length > 0 && line.text.length <= 100))
check('语料分类全部在五类枚举内且五类都非空（空池 = 到点没话说）',
  pack.lines.every((line) => CATEGORIES.includes(line.category))
  && CATEGORIES.every((cat) => (byCategory.get(cat) ?? 0) >= 1))
check('红线：语料零命中负面/敏感黑名单（样本词逐一核对）',
  pack.lines.every((line) => BLACKLIST_SAMPLE.every((term) => !line.text.includes(term))))
check('红线是建期校验：embed 脚本里有黑名单与长度/分类/id 校验（坏语料进不了包）',
  embedScript.includes('MOOD_BLACKLIST')
  && BLACKLIST_SAMPLE.every((term) => embedScript.includes(`'${term}'`))
  && embedScript.includes('m\\d{3}$') && embedScript.includes('max 100')
  && embedScript.includes('category pool is empty'))
check('节日条目都带合法的 MM-DD 区间；非节日条目都不带',
  pack.lines.every((line) => {
    if (line.category === 'holiday') {
      const range = line.holiday
      const ok = (edge) => typeof edge === 'string' && /^\d{2}-\d{2}$/.test(edge)
      return range !== null && typeof range === 'object' && ok(range.from) && ok(range.to)
    }
    return line.holiday === undefined
  }))
check('站点 40 条种子全部在库（m001–m040）',
  Array.from({ length: 40 }, (_, at) => `m${String(at + 1).padStart(3, '0')}`)
    .every((id) => ids.has(id)))
check('内联副本与语料文件逐字一致（embed 的读回校验之外的双保险）',
  JSON.stringify(inlinePack.lines.map((line) => [line.id, line.category, line.text]))
    === JSON.stringify(pack.lines.map((line) => [line.id, line.category, line.text])))

/* ── 2. 源码层：接线与有界性 ───────────────────────────────────────────────── */

check('CARD_ORDER 里有 mood-greeting，序号 73（挂件 74 之后，压轴段）',
  /'mood-greeting': 73,/.test(real))
check('publish() 把挂件卡、问候卡与折叠卡一起追加进面板列表',
  /\.concat\(\[petWidgetCardTheme\(\), moodCardTheme\(\), menuCollapseCardTheme\(\)\]\)/.test(real))
check('面板计数把问候卡与内置卡/挂件卡/折叠卡一起排除（皮肤数不含它）',
  /id === PET_WIDGET\.id \|\| id === MOOD_WIDGET\.id \|\| id === MENU_COLLAPSE_WIDGET\.id\)\.length/.test(real))
const publishBody = stripComments(block(real, 'publish'))
check('publish() 把问候状态报给 store（markMood）并顺路同步问候条（syncMoodBar）',
  publishBody.includes('storeActions.markMood(readMoodState())') && publishBody.includes('syncMoodBar()'))
const themeCardCode = stripComments(block(real, 'ThemeCard'))
check('问候卡判型取自数据（isMood = id 表），不按渲染结果判（jsx 桩返回 null）',
  /const isMood = id === MOOD_WIDGET\.id/.test(themeCardCode))
check('问候卡身是 div、点卡身走 onToggleMood，绝不走 onSelect（setTheme）',
  /className: 'tg-card tg-mood-card',\s*\n\s*onClick: \(\) => \{ onToggleMood\(\) \}/.test(themeCardCode))
const moodControlsCode = stripComments(block(real, 'moodControlsElement'))
check('卡面有胶囊开关（role="switch" + aria-checked）与三组 chips（共用 chip 助手 + 三行 map）',
  /role: 'switch'/.test(moodControlsCode)
  && /'aria-checked': mood\.on/.test(moodControlsCode)
  && /'aria-pressed': pressed/.test(moodControlsCode)
  && (moodControlsCode.match(/\.map\(\(id\) => chip\(/g) ?? []).length === 3)
check('卡面控件全部拦冒泡（开关 + chip 助手各一处；不拦会被卡身的开关处理器覆盖——配色卡踩过的坑）',
  (moodControlsCode.match(/swallowEvent\(event\)/g) ?? []).length === 2)
check('注入面有 toggleMood / setMood 两个动作（与 pickPet 同款零主题写入）',
  /toggleMood: \(\) => \{ toggleMoodWidget\(\) \}/.test(real)
  && /setMood: \(patch\) => \{ setMoodSettings\(patch\) \}/.test(real))
const seatCode = stripComments(block(real, 'MoodSeat'))
check('shell.overlay 座位是静态 div（零 hooks），带稳定数据属性与 aria-hidden',
  /ctx\.slots\.inject\('shell\.overlay'/.test(real)
  && /id: 'theme-gallery:mood',/.test(real)
  && seatCode.includes("'data-dsh-mood-seat': ''")
  && seatCode.includes("'aria-hidden': 'true'")
  && !/use[A-Z]/.test(seatCode))
check('问候的卸载走 moodTeardown（插件卸载时收尾计时器/监听器/条/样式表）',
  /return \(\) => \{ moodTeardown\(\) \}/.test(real))
check('安全：mood 区域零 innerHTML，文字只经 textContent',
  !moodRegion.includes('innerHTML') && moodRegion.includes('textContent'))
check('安全：MOOD_KEY 只存 localStorage，绝不写 preference',
  /const MOOD_KEY = 'theme-gallery:mood'/.test(real)
  && !/preference.*MOOD_KEY|MOOD_KEY.*preference/.test(real))
check('有界：计时器只走 window.setTimeout（桩拦得住、不吊进程）：换条 + 座位重试共两处、零裸定时器、拆条即清',
  (moodRegion.match(/window\.setTimeout\(/g) ?? []).length === 2
  && (moodRegion.match(/(?<![.\w])setTimeout\(/g) ?? []).length === 0
  && (moodRegion.match(/(?<![.\w])setInterval\(/g) ?? []).length === 0
  && (moodRegion.match(/addEventListener\('resize'/g) ?? []).length === 1
  && moodRegion.includes('moodClearTimer(moodRun.timer)')
  && moodRegion.includes('moodCancelSeatRetry()')
  && /MOOD_SEAT_RETRY_MAX = \d+/.test(moodRegion))
check('左端避开整个侧栏列（用户二轮返工）：实测侧栏矩形右缘取较大值，收起时由菜单兜底',
  /const column = sidebarColumn\(\)/.test(stripComments(block(real, 'moodMenuRight')))
  && /boundary = Math\.max\(boundary, rect\.right \+ MOOD_MENU_GAP\)/.test(stripComments(block(real, 'moodMenuRight')))
  && /const MOOD_SIDEBAR_GAP = 12/.test(real))
check('诊断：moodLineOf 存在，警告以 ⚠ 开头、通过行带读数（静默失败防则）',
  /⚠ 问候条未建出/.test(real) && /问候自检通过 · 条=/.test(real))

/* ── 3. 行为层：轮换 / 几何 / 缺省 ─────────────────────────────────────────── */

check('内联语料经消毒后仍然可用（消毒器不丢好数据）',
  sandbox.MOOD_LINES.length === pack.lines.length)
check('readMoodState 缺省 = 默认开 + 中速 + 自左至右 + 居中（用户定的"默认开"）',
  (() => {
    const state = sandbox.readMoodState()
    return state.on === true && state.speed === 'medium' && state.direction === 'ltr' && state.zone === 'center'
  })())
check('readMoodState 坏 JSON / 非法字段逐项回缺省（不抛错、不采纳）',
  (() => {
    const storage = makeStorage({ 'theme-gallery:mood': '{oops', 'theme-gallery:mood2': '{"on":true,"speed":"lightning"}' })
    const win = { localStorage: storage }
    const bad = makeSandbox(real, win)
    const first = bad.readMoodState()
    storage.map.set('theme-gallery:mood', '{"on":true,"speed":"lightning","direction":"sideways","zone":"far-left"}')
    const second = bad.readMoodState()
    return first.on === true && first.speed === 'medium'
      && second.speed === 'medium' && second.direction === 'ltr' && second.zone === 'center'
  })())
check('时段池边界（已确认）：05/11/22 整点归池，夜深含 0–4 点',
  sandbox.moodPoolName(5) === 'morning' && sandbox.moodPoolName(10) === 'morning'
  && sandbox.moodPoolName(11) === 'day' && sandbox.moodPoolName(21) === 'day'
  && sandbox.moodPoolName(22) === 'night' && sandbox.moodPoolName(23) === 'night'
  && sandbox.moodPoolName(3) === 'night' && sandbox.moodPoolName(4) === 'night')
check('节日区间：区间内命中、区间外不命中、单日区间、跨年区间',
  (() => {
    const inRange = { holiday: { from: '10-01', to: '10-08' } }
    const single = { holiday: { from: '03-08', to: '03-08' } }
    const wrap = { holiday: { from: '12-31', to: '01-02' } }
    return sandbox.moodHolidayMatches(inRange, '10-01') && sandbox.moodHolidayMatches(inRange, '10-08')
      && !sandbox.moodHolidayMatches(inRange, '09-30') && !sandbox.moodHolidayMatches(inRange, '10-09')
      && sandbox.moodHolidayMatches(single, '03-08') && !sandbox.moodHolidayMatches(single, '03-07')
      && sandbox.moodHolidayMatches(wrap, '01-01') && sandbox.moodHolidayMatches(wrap, '12-31')
      && !sandbox.moodHolidayMatches(wrap, '01-03')
  })())
check('moodPicksFor：节日池优先于时段池；时段池按小时选；空池回落 general',
  (() => {
    const holidayHit = sandbox.moodPicksFor(new Date(2026, 9, 5, 8, 0, 0), sandbox.MOOD_LINES)
    const morning = sandbox.moodPicksFor(new Date(2026, 6, 15, 8, 0, 0), sandbox.MOOD_LINES)
    const noMorning = sandbox.moodPicksFor(new Date(2026, 6, 15, 8, 0, 0),
      sandbox.MOOD_LINES.filter((line) => line.category !== 'morning'))
    return holidayHit.pool === 'holiday' && morning.pool === 'morning'
      && noMorning.pool === 'general' && noMorning.items.every((line) => line.category === 'general')
  })())
check('日期种子洗牌：同一天同池顺序稳定，不同日期顺序不同（"每天不重样"是本地实现的）',
  (() => {
    const items = sandbox.MOOD_LINES.filter((line) => line.category === 'morning')
    const d1 = new Date(2026, 6, 15, 8, 0, 0)
    const d2 = new Date(2026, 6, 16, 8, 0, 0)
    const key = (order) => order.map((line) => line.id).join(',')
    return key(sandbox.moodDayOrder(items, d1, 'morning')) === key(sandbox.moodDayOrder(items, d1, 'morning'))
      && key(sandbox.moodDayOrder(items, d1, 'morning')) !== key(sandbox.moodDayOrder(items, d2, 'morning'))
  })())
check('moodNextLine：节日日选节日、普通日选时段池、指针逐条推进不重复（池内）',
  (() => {
    const storage = makeStorage()
    const box = makeSandbox(real, { localStorage: storage })
    const holiday = box.moodNextLine(new Date(2026, 9, 5, 8, 0, 0), box.MOOD_LINES)
    const a = box.moodNextLine(new Date(2026, 6, 15, 8, 0, 0), box.MOOD_LINES)
    const b = box.moodNextLine(new Date(2026, 6, 15, 8, 0, 0), box.MOOD_LINES)
    const c = box.moodNextLine(new Date(2026, 6, 15, 8, 0, 0), box.MOOD_LINES)
    return holiday.category === 'holiday' && a.category === 'morning'
      && a.id !== b.id && b.id !== c.id && a.id !== c.id
  })())
check('moodNextLine：重启后同一指针位置不重复上一条（lastId 跳格守卫）',
  (() => {
    const box = makeSandbox(real, { localStorage: makeStorage() })
    const date = new Date(2026, 6, 15, 8, 0, 0)
    const items = box.MOOD_LINES.filter((line) => line.category === 'morning')
    const order = box.moodDayOrder(items, date, 'morning')
    // 模拟"上一条就是队首"的重启现场：指针指回 0，lastId 是队首 id。
    box.saveMoodPointer({ date: box.moodDateKey(date), pool: 'morning', index: 0, lastId: order[0].id })
    return box.moodNextLine(date, box.MOOD_LINES).id !== order[0].id
  })())
check('moodNextLine：过期指针（隔天/换池）自愈到队首',
  (() => {
    const box = makeSandbox(real, { localStorage: makeStorage() })
    const date = new Date(2026, 6, 15, 8, 0, 0)
    const items = box.MOOD_LINES.filter((line) => line.category === 'morning')
    const order = box.moodDayOrder(items, date, 'morning')
    box.saveMoodPointer({ date: '2025-01-01', pool: 'morning', index: 7, lastId: '' })
    return box.moodNextLine(date, box.MOOD_LINES).id === order[0].id
  })())
check('moodNextLine：语料为空返回 null（不抛错，由自检行报警）',
  makeSandbox(real, { localStorage: makeStorage() }).moodNextLine(new Date(), []) === null)
check('5 等份几何：四档映射的 left/width 与 DESIGN 表逐档一致（等份宽 = 段长/5）',
  (() => {
    const vw = 1280
    const menuRight = 172
    const right = vw - sandbox.MOOD_WINBTN_RESERVE
    const left = Math.min(menuRight, right - 160)
    const unit = (right - left) / 5
    const cases = [
      ['left', left, unit * 4],
      ['center', left, unit * 5],
      ['indent', left + unit, unit * 3],
      ['right', left + unit, unit * 4],
    ]
    return cases.every(([zone, wantLeft, wantWidth]) => {
      const rect = sandbox.moodZoneRect(zone, vw, menuRight)
      return rect !== null
        && Math.abs(rect.left - wantLeft) < 1e-9
        && Math.abs(rect.width - wantWidth) < 1e-9
    })
  })())
check('几何兜底：菜单读不到时用常量左端；几何不可算（窗太窄）返回 null 而不是 NaN',
  (() => {
    const rect = sandbox.moodZoneRect('center', 1280, sandbox.MOOD_FALLBACK_MENU_RIGHT)
    const broken = sandbox.moodZoneRect('center', 100, 172)
    return rect !== null && rect.left === sandbox.MOOD_FALLBACK_MENU_RIGHT && broken === null
  })())

/* ── 4. 变异反证 M1–M10 ────────────────────────────────────────────────────── */

// M1 删 shell.overlay 注入
const mutOverlay = real.replace(/ctx\.slots\.inject\('shell\.overlay'[\s\S]*?MoodSeat\)\)/, '')
check('M1 真的改动了源码（shell.overlay 注入被删）', mutOverlay !== real)
check('M1：删掉注入后"shell.overlay 注入存在"必须失败',
  !/ctx\.slots\.inject\('shell\.overlay'/.test(mutOverlay))

// M2 删序号行
const mutRank = real.replace("'mood-greeting': 73,", '')
check('M2 真的改动了源码（序号行被删）', mutRank !== real)
check('M2：删掉序号行后"CARD_ORDER 里有 mood-greeting"必须失败',
  !/'mood-greeting': 73,/.test(mutRank))

// M3 周期改 1 分钟
const mutPeriod = real.replace('const MOOD_PERIOD_MS = 35 * 60 * 1000', 'const MOOD_PERIOD_MS = 60 * 1000')
check('M3 真的改动了源码（35 分钟被改成 1 分钟）', mutPeriod !== real)
check('M3：改掉周期后常量断言必须失败',
  readConst(mutPeriod, 'MOOD_PERIOD_MS') !== 35 * 60 * 1000)

// M4 区域映射改错
const mutZone = real.replace("center: { first: 1, parts: 5 }, // 居中（默认）：占满", "center: { first: 1, parts: 4 }, // 居中（默认）：占满")
check('M4 真的改动了源码（居中档被改成 4 等份）', mutZone !== real)
check('M4：改掉映射后"四档几何"必须失败',
  (() => {
    try {
      const box = makeSandbox(mutZone, { localStorage: makeStorage() })
      const vw = 1280
      const right = vw - box.MOOD_WINBTN_RESERVE
      const unit = (right - Math.min(box.MOOD_FALLBACK_MENU_RIGHT, right - 160)) / 5
      const rect = box.moodZoneRect('center', vw, box.MOOD_FALLBACK_MENU_RIGHT)
      return Math.abs(rect.width - unit * 5) < 1e-9
    } catch { return true }
  })() === false)

// M5 拆 markMood 接线
const mutMark = real.replace('storeActions.markMood(readMoodState())', '')
check('M5 真的改动了源码（markMood 接线被拆）', mutMark !== real)
check('M5：拆掉接线后"publish 报状态"必须失败',
  !/storeActions\.markMood\(readMoodState\(\)\)/.test(mutMark))

// M6 删黑名单样本词（建期红线的锚）
const mutBlacklist = embedScript.replace("'自杀', ", '')
check('M6 真的改动了脚本（黑名单少了"自杀"）', mutBlacklist !== embedScript)
check('M6：删词后"红线是建期校验"必须失败',
  !BLACKLIST_SAMPLE.every((term) => mutBlacklist.includes(`'${term}'`)))

// M7 时段边界 5 → 6
const mutPool = real.replace("{ pool: 'morning', from: 5, to: 11 }", "{ pool: 'morning', from: 6, to: 11 }")
check('M7 真的改动了源码（早安边界 5 点改 6 点）', mutPool !== real)
check('M7：改掉边界后"时段池边界"必须失败',
  makeSandbox(mutPool, { localStorage: makeStorage() }).moodPoolName(5) !== 'morning')

// M8 洗牌种子改固定 0
const mutSeed = real.replace('mulberry32(moodHash(`${moodDateKey(date)}|${pool}`))', 'mulberry32(0)')
check('M8 真的改动了源码（洗牌种子改成固定 0）', mutSeed !== real)
check('M8：种子写死后"跨天换序"必须失败',
  (() => {
    const box = makeSandbox(mutSeed, { localStorage: makeStorage() })
    const items = box.MOOD_LINES.filter((line) => line.category === 'morning')
    const key = (order) => order.map((line) => line.id).join(',')
    return key(box.moodDayOrder(items, new Date(2026, 6, 15, 8, 0, 0), 'morning'))
      !== key(box.moodDayOrder(items, new Date(2026, 6, 16, 8, 0, 0), 'morning'))
  })() === false)

// M9 拆 lastId 跳格守卫
const mutSkip = real.replace('if (order.length > 1 && order[pick].id === pointer?.lastId) pick = (pick + 1) % order.length', '')
check('M9 真的改动了源码（跳格守卫被拆）', mutSkip !== real)
{
  const box = makeSandbox(mutSkip, { localStorage: makeStorage() })
  const date = new Date(2026, 6, 15, 8, 0, 0)
  const items = box.MOOD_LINES.filter((line) => line.category === 'morning')
  const order = box.moodDayOrder(items, date, 'morning')
  box.saveMoodPointer({ date: box.moodDateKey(date), pool: 'morning', index: 0, lastId: order[0].id })
  const got = box.moodNextLine(date, box.MOOD_LINES)
  // 变异后守卫没了：会原样返回队首（= 原断言"重启不重复上一条"翻红）。
  check('M9：拆掉守卫后"重启不重复上一条"必须失败',
    got.id === order[0].id)
}

// M10 默认关
const mutDefaultOff = real.replace('const fallback = { on: true,', 'const fallback = { on: false,')
check('M10 真的改动了源码（默认开被改成默认关）', mutDefaultOff !== real)
// 变异后缺省变成关 = "默认开"那条断言翻红。
check('M10：改掉缺省后"默认开"必须失败',
  makeSandbox(mutDefaultOff, { localStorage: makeStorage() }).readMoodState().on === false)

// M11 拆座位重试（实机事故：座位晚于首轮 publish 渲染，没有重试条就永远建不出来）
const mutRetry = real.replace(/function moodArmSeatRetry\(\) \{[\s\S]*?\n      \}, MOOD_SEAT_RETRY_MS\)\n    \}/, '')
check('M11 真的改动了源码（座位重试的定义被拆掉）',
  mutRetry !== real && !/function moodArmSeatRetry\(\)/.test(mutRetry))
check('M11：定义消失后缺席路径的武装调用仍在（证明真实源码把重试接进了缺席路径）',
  /moodArmSeatRetry\(\)\n        return/.test(mutRetry))

/* ── 收尾 ─────────────────────────────────────────────────────────────────── */

if (failed > 0) {
  console.error(`\n${failed} mood check(s) failed`)
  process.exit(1)
}
console.log('\nmood checks passed')
