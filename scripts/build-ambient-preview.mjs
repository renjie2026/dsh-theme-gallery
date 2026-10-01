/**
 * Render a self-contained preview of the sidebar scenery.
 *
 * The stylesheet AND the scene markup are READ OUT OF `lib/client.js` rather than
 * copied, so this preview cannot drift from what ships. (The markup used to be a
 * hand-mirrored copy of two scenes, which already meant the preview could lie the
 * moment a scene changed or a new one was added; the builders are extracted the
 * same way `tests/check-ambient-render.mjs` extracts them and are therefore the
 * same code that ships.)
 *
 * Every bundled theme gets a pane at the sidebar's real width range, judged against
 * the sidebar fill that theme actually ships.
 *
 * Run with: node scripts/build-ambient-preview.mjs
 * Output:   tools/theme-bench/ambient-preview.html
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

/**
 * 抓一个 `const NAME = …` 的**完整**声明（多行的数组 / 对象 / 函数调用都要整块带上）。
 *
 * 逐行找 `^    const NAME = ` 再取那一行，只对单行常量成立；`CARD_ORDER` / `PET_WIDGET`
 * 这类多行字面量会被截成半句，拼进 eval 就是 `SyntaxError: Unexpected identifier`
 * —— 而那个报错的样子像"样式表里有语法错误"，排查方向会被带偏。所以这里按括号深度
 * 一直吃到配平（或分号）为止。
 * @param name - 常量名。
 * @returns 声明的源码文本。
 */
function constDeclarationOf(name) {
  const at = source.search(new RegExp(`^    const ${name} = `, 'm'))
  if (at < 0) throw new Error(`lib/client.js: const ${name} not found`)
  let depth = 0
  let quote = ''
  for (let i = at; i < source.length; i += 1) {
    const ch = source[i]
    if (quote !== '') {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1
    else if (depth === 0 && (ch === ';' || ch === '\n')) return source.slice(at, i).trim()
  }
  throw new Error(`lib/client.js: const ${name} never terminates`)
}

/**
 * 一个表达式**用到**的工厂级常量，连同它们之间的传递依赖（按源码顺序）。
 *
 * 只看"这个表达式里出现了哪些全大写标识符、而源码里恰好有同名 `const`"，所以既不漏
 * 也不多（多注入一个用不到的常量只会拖慢，缺注入才是 `ReferenceError`）。
 * @param text - 要被求值的表达式文本。
 * @param skip - 已经在这个环境里声明过的名字（重复注入是 SyntaxError）。
 * @returns 常量声明行数组。
 */
function constantClosureFor(text, skip = []) {
  const wanted = new Set()
  const queue = [text]
  while (queue.length > 0) {
    const chunk = queue.pop()
    for (const hit of chunk.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      const name = hit[1]
      if (wanted.has(name) || skip.includes(name)) continue
      const at = source.search(new RegExp(`^    const ${name} = `, 'm'))
      if (at < 0) continue
      wanted.add(name)
      queue.push(constDeclarationOf(name))
    }
  }
  const ordered = [...wanted].sort((a, b) => source.indexOf(`    const ${a} = `) - source.indexOf(`    const ${b} = `))
  return ordered.map((name) => constDeclarationOf(name))
}

/**
 * Pull the ambient stylesheet out of the client bundle.
 *
 * The stylesheet lives in a `const AMBIENT_CSS = [ ... ].join('\n')` array whose
 * entries are single-quoted string literals, so it is evaluated in isolation rather
 * than re-typed here.
 * @returns the CSS text.
 */
function readAmbientCss() {
  const at = source.indexOf('const AMBIENT_CSS = [')
  if (at < 0) throw new Error('lib/client.js: AMBIENT_CSS not found')
  const from = at + 'const AMBIENT_CSS = '.length
  const end = source.indexOf("].join('\\n')", from)
  if (end < 0) throw new Error('lib/client.js: AMBIENT_CSS terminator not found')
  const literal = source.slice(from, end + 1)
  // The array spreads `...fanhuaSwallowKeyframes()`, whose 15 swallow
  // keyframes are generated from the flight table — so those two functions
  // must be in scope when the literal is evaluated (this is the third place
  // that knows the ambient builder set, besides check-ambient-render and
  // check-boot-timing's bandBox extractions).
  //
  // ⚠️ 同一类坑的第五次复发（2026-09-30）：大鲸鱼娘的壁纸淡出规则把工厂级常量
  // `READING_ATTRIBUTE` 写进了 AMBIENT_CSS，于是 eval 里少了这个绑定就是
  // `ReferenceError`。**从源码现算它的值**再注入，比在这里抄一个字面量安全 ——
  // 常量改名时这里会当场抛错，而不是悄悄和真机不一致。
  const readingAttr = /const READING_ATTRIBUTE = '([^']+)'/.exec(source)?.[1]
  if (readingAttr === undefined) throw new Error('lib/client.js: READING_ATTRIBUTE not found')
  // ⚠️ 同一类坑的第六次复发（2026-09-30）：大鲸鱼娘的入场时长与落地水花时刻也写进了
  // 样式表（`animation:dsh-amb-jyb-enter ${WHALE_ENTER_MS/1000}s …`），随后青冥飞剑把它的
  // 三个时刻也抽成了常量（`FEIJIAN_ARRIVE_DELAY_MS` …）。**点名一个个注入是跟不上**
  // 的：每次有人抽常量，这里就变成 `ReferenceError`。
  // 改成"**这个字面量用到哪些工厂级常量就注入哪些**"（按需闭包，含常量之间互相引用的
  // 传递依赖）。不扫全部工厂级常量：那份清单里有多行对象/数组，逐行截取会拼出语法碎片
  // （症状是 `SyntaxError: Unexpected identifier`，看着像样式表坏了）。
  const timingConstants = constantClosureFor(literal).join('\n')
  // 生成函数（`...fanhuaSwallowKeyframes()`、`...feijianFlightKeyframes()` …）**扫出来**，
  // 不逐个点名：青冥飞剑 2026-09-30 刚被改成同款"生成函数"形态，这里点名一次就要跟着改一次
  // （漏改的表现是 `ReferenceError`，整个预览构建当场红 —— 那还算响亮；真正危险的是
  //  有人在别处抄了份写死的列表，从此悄悄和出货版本漂移）。
  const generators = [...new Set([...literal.matchAll(/\.\.\.(\w+)\(\)/g)].map((m) => m[1]))]
    .map((name) => block(name)).join('\n\n')
  const parts = eval(`const READING_ATTRIBUTE = ${JSON.stringify(readingAttr)}\n${timingConstants}\n\n${generators}\n\n${block('fanhuaSwallowFlights')}\n\n${block('fanhuaSwallowKeyframes')}\n\n${literal}`)
  return parts.join('\n')
}

/**
 * Grab `function name(...) { ... }` from the bundle by brace matching — the same
 * extraction `tests/check-ambient-render.mjs` uses, so the preview renders the
 * shipping builders rather than a mirror of them.
 * @param name - the function to extract.
 * @returns the function's source text.
 */
function block(name) {
  const start = source.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`lib/client.js: function ${name} not found`)
  // Skip the PARAMETER LIST before looking for the body's brace: a destructured parameter
  // (`function page({ t, ... }) {`) has braces of its own, and taking the first `{` after
  // the name ends the "function" at the parameter list — a silently truncated body that
  // would render a preview from nothing. `tests/check-ambient-render.mjs` carries the same
  // fix plus an assertion that fails if this ever truncates again.
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

const builderSource = [
  "const SVG_TAGS = new Set(['svg', 'defs', 'linearGradient', 'stop', 'path', 'ellipse', 'g', 'circle'])",
  block('attr'),
  block('open'),
  block('rippleMarkup'),
  block('dragonflyBlock'),
  block('bladeMarkup'),
  block('shanAmbientScene'),
  block('dragonflyMarkup'),
  block('fishMarkup'),
  block('dreamAmbientScene'),
  block('seaweedMarkup'),
  block('ymSeaSvg'),
  block('ymBalloonMarkup'),
  block('caiyunAmbientScene'),
  block('jpMoonMarkup'),
  block('jpBoatMarkup'),
  block('dongyunAmbientScene'),
  block('xsPineMarkup'),
  block('junyueAmbientScene'),
  block('liuxingAmbientScene'),
  block('fanhuaSwallowFlights'),
  block('fanhuaSwallowKeyframes'),
  block('fanhuaSwallowNodes'),
  block('fanhuaAmbientScene'),
  block('fjSwordSvg'),
  block('feijianCardMarkup'),
  block('feijianFlightKeyframes'),
  block('feijianWallMarkup'),
  block('feijianAmbientScene'),
  block('feijianOverlayMarkup'),
  block('longyanMoteNodes'),
  block('longyanSwordNodes'),
  block('longyanAmbientScene'),
  block('longyanOverlayMarkup'),
  block('longyan2OverlayMarkup'),
  block('jiexinAmbientScene'),
  block('gcFeatherMarkup'),
  block('fengchenAmbientScene'),
  block('petHazeMarkup'),
  block('humaoAmbientScene'),
  block('ahuangAmbientScene'),
  block('jingyuAmbientScene'),
  block('jingyuWallScene'),
  block('wallMarkup'),
  block('hasWall'),
  // 背景层那份标记（`<div class="jyb-veil"></div>` + 同一份人物标记）：它是"3 秒后
  // 转背景壁纸"的第二块画布，必须在这里有肉眼验收入口 —— 抽出来却不渲染就是死代码。
  block('backdropWallMarkup'),
  block('guardSceneryMarkup'),
].join('\n\n')

// eslint-disable-next-line no-new-func
const builders = new Function(`${constantClosureFor(builderSource, ['SVG_TAGS']).join('\n')}\n\n${builderSource}\nreturn { shanAmbientScene, dreamAmbientScene, caiyunAmbientScene, jpMoonMarkup, dongyunAmbientScene, junyueAmbientScene, liuxingAmbientScene, fanhuaAmbientScene, jiexinAmbientScene, fengchenAmbientScene, humaoAmbientScene, ahuangAmbientScene, jingyuAmbientScene, jingyuWallScene, wallMarkup, backdropWallMarkup, fjSwordSvg, feijianCardMarkup, feijianWallMarkup, feijianAmbientScene, feijianOverlayMarkup, longyanAmbientScene, longyanOverlayMarkup, longyan2OverlayMarkup }`)()

/**
 * Build one theme's scene from its bundled `ambient` config through the real
 * builders.
 *
 * Two different "no scene" cases, and they must not be conflated:
 *   · **No `ambient` field at all** is legitimate — the 纯色/拼色 class declares none
 *     on purpose (its card is a palette, not a scene), so it gets an empty pane.
 *   · **An `ambient.kind` with no builder** is a typo in a skin that DID ask for
 *     scenery. That throws: the preview must never quietly show nothing for it.
 * @param theme - a bundled theme definition.
 * @returns the scene markup, or '' when the theme asks for no scenery.
 */
function sceneFor(theme) {
  const a = theme.ambient
  if (a === undefined) return ''
  switch (a.kind) {
    case 'shan': return builders.shanAmbientScene(a.petals)
    case 'dream': return builders.dreamAmbientScene(a.bubbles, a.motes, a.fish)
    case 'caiyun': return builders.caiyunAmbientScene(a.stars)
    case 'dongyun': return builders.dongyunAmbientScene(a.snow)
    case 'junyue': return builders.junyueAmbientScene(a.stars)
    case 'liuxing': return builders.liuxingAmbientScene(a.geese, a.dew)
    case 'fanhua': return builders.fanhuaAmbientScene(a.petals, a.swallows)
    case 'feijian': return builders.feijianAmbientScene(a.motes)
    case 'longyan': return builders.longyanAmbientScene(a.motes)
    case 'longyan2': return builders.longyanAmbientScene(a.motes)
    case 'jiexin': return builders.jiexinAmbientScene(a.dust)
    case 'fengchen': return builders.fengchenAmbientScene(a.feathers, a.dew)
    case 'humao': return builders.humaoAmbientScene(a.dust)
    case 'ahuang': return builders.ahuangAmbientScene(a.dust)
    case 'jingyu': return builders.jingyuAmbientScene(a.bubbles, a.calves)
    default: throw new Error(`theme ${theme.id}: ambient.kind "${a.kind}" has no builder`)
  }
}

const css = readAmbientCss()

/** One-line description of each scene's elements, for the pane captions. */
const KIND_NOTES = {
  shan: '青山两层 + 云雾 + 水面涟漪 + 两只蜻蜓 + 花瓣飘落',
  dream: '柔光辉 + 光洗 + 气泡 + 光点 + 蓝色小鱼 + 水草，水底渐变承接',
  caiyun: '暮色暖光 + 星光 + 漂移彩云 + 双层云海 + 两只热气球',
  dongyun: '冬月 + 缓移冬云 + 细雪 + 江面（月光/波纹/波光）+ 乌篷船 + 芦苇',
  junyue: '星空 + 明月 + 夜云 + 流星 + 山峦剪影 + 松树',
  jiexin: '雾山 + 禅意圆相与坐禅人影 + 香炉青烟 + 浮尘 + 禅语',
  fengchen: '晨光扇面 + 凤羽飘落 + 笔触凤凰往返飞行 + 晨露',
  humao: '暖阳光晕 + 晒暖窗台 + 坐姿虎斑猫（摆尾/抖耳）+ 蜷卧酣睡猫（呼吸 + 小 z）+ 阳光浮尘（原创）',
  ahuang: '金色光晕 + 田埂 + 中黄田园犬（镰刀尾摇摆/歪头/铃铛项圈）+ 干草丛 + 缃色皮球 + 蒲公英绒毛（原创）',
  liuxing: '弦月金辉 + 白羽流星 + 雁阵缓渡 + 蒹葭白露 + 远山淡影（原创，取意歌曲《白羽行》）',
  fanhua: '垂柳丝绦 + 桃花枝 + 落英缤纷 + 春水涟漪 + 飞燕 + 罨画远山（原创，取意歌曲《白羽行》暖忆半阕）',
  jingyu: '上浮气泡 + 两只小鲸鱼缓渡 + 水光带（波纹/浮游微光）+ **工作区右侧的人物壁纸**'
    + '（同一 kind 的第二块画布）：她会从窗口右上**画面之外**俯冲进来、横扫过整个工作区，'
    + '在主区绕一个**完整的大圈**，再落到站位上（1.8s，带水泡尾迹与一次落地水花），'
    + '停在最前方约 1.2s，约 3s 时交叉淡入淡出**转成背景壁纸**'
    + '（body 级 z-index:-2 的独立层 + 可读性遮罩，正文压在她上面）—— 见每格下方的三条主列演示',
  feijian: '悬停剑落定后绕剑柄—剑尖轴缓缓自旋（带世界坐标剑穗与呼吸荧光晕、荧光微尘）；另有全屏部分——**三剑编队**沿用户红笔图的双环轨迹入场（主剑 + 两把伴飞小剑，7.4s，尾翼=青白主痕/樱粉副痕/残影箭羽/迸散火花）+ 四周剑光角饰框 + 聊天区**宝剑壁纸**（见下方演示）',
  longyan: '素材带：青焰鎏金辉光 + 两条能量丝 + 火屑升腾；另有全屏部分——**双剑悬空**（青玉凤纹 + 银鎏金流光，呼吸辉光 + 剑刃焰舌 + 火屑 + 扫刃辉光，见下方演示）',
  longyan2: '龙焰宝剑：与青玉凤剑同一套双剑素材、气焰与入场（独立主题位，独立 overlay 层）',
}

/** The bundled themes, in embed order (alphabetical by file). */
const themesDir = join(root, 'lib', 'themes')
const themes = []
for (const file of readdirSync(themesDir).filter((name) => name.endsWith('.json')).sort()) {
  themes.push(...JSON.parse(readFileSync(join(themesDir, file), 'utf8')))
}

/**
 * The colour a deliberately OPAQUE navigation surface is painted in.
 *
 * Used only by the stacking comparison below: the shell's real row surfaces are
 * translucent, but its scroll or panel container may not be, and the failing case is
 * indistinguishable from "nothing was drawn" once one opaque layer sits in between.
 */
const NAV_SURFACE = 'rgba(255,255,255,.72)'

/** One pane per bundled theme: its own sidebar fill, its own scene. */
const panes = themes.map((theme) => ({
  title: `${theme.label} · ${theme.ambient?.kind ?? '（无装饰）'}`,
  note: theme.ambient === undefined
    ? '有意不配素材：这一类卡片的身份在卡面的 15 个色块上，侧栏只有它自己的渐变'
    : (KIND_NOTES[theme.ambient.kind] ?? ''),
  fill: theme.tokens['--dsw-specific-sidebar-fill']?.light ?? '#EEEEEE',
  scene: sceneFor(theme),
  // 工作区壁纸：同一个 kind 的第二块画布。它是本插件最大的一块美术，所以**必须**在这里
  // 有肉眼验收入口 —— 否则 `wallMarkup` / `jingyuWallScene` 抽出来也是死代码
  // （评审 2026-09-30 指出的漏登记）。真机上这块盒子的几何由视口现算，
  // 这里给一个主列尺寸的静态盒子，尺寸规则（77% 高 / 最宽 45%）走的还是出货样式表。
  // 青冥飞剑的宝剑壁纸**不走**这条管线（hasWall 只认 jingyu）：它是 body 级
  // 独立层，由 syncAmbientOverlay 挂/撤，这里直接展示它的标记。
  wall: theme.ambient === undefined
    ? ''
    : (theme.ambient.kind === 'feijian'
      ? builders.feijianWallMarkup('wall', 'deep')
      : builders.wallMarkup(theme.ambient.kind)),
  wallKind: theme.ambient?.kind ?? '',
  // 背景层那份（`.jyb-veil` + 同一份立绘）：`backdropWallMarkup` 的**真实输出**，
  // 用来肉眼确认"壁纸态"长什么样（真机上它由 body 标记类淡入）。
  backdrop: theme.ambient === undefined
    ? ''
    : builders.backdropWallMarkup(builders.wallMarkup(theme.ambient.kind)),
  base: theme.tokens['--dsw-alias-bg-base']?.light ?? '#FFFFFF',
}))

const paneMarkup = panes.map((pane) => `
  <figure class="pane">
    <figcaption>
      <strong>${pane.title}</strong>
      <span>${pane.note}</span>
    </figcaption>
    <div class="colwrap">
      <div class="ZTP-Xa_sidebarCol" style="background:${pane.fill}">
        <div id="dsh-theme-ambient">${pane.scene}</div>
        <nav class="mocknav">
          <div class="mockrow">＋ 新对话</div>
          <div class="mockrow">搜索会话…</div>
          <div class="mockrow is-active">主题皮肤视觉验收</div>
          <div class="mockrow">侧栏装饰层级</div>
          <div class="mockrow">dsh-theme-gallery 插件架构</div>
          <div class="mockrow">阅读态削弱方案</div>
          <div class="mockrow">设置行插槽注册</div>
          <div class="mockrow">token 清单核对</div>
          <div class="mockrow">电商后台主题映射</div>
          <div class="mockrow">发布到 npm 的流程</div>
          <div class="mockrow">版本锁定陷阱</div>
          <div class="mockrow">CSS 注入的生命周期</div>
          <div class="mockrow mockfoot">⚙ 设置</div>
        </nav>
      </div>
      <!-- A second width, because the sidebar is draggable and the scene is
           percentage-based: this is where a fixed-pixel port would break. -->
      <div class="ZTP-Xa_sidebarCol is-narrow" style="background:${pane.fill}">
        <div id="dsh-theme-ambient">${pane.scene}</div>
        <nav class="mocknav">
          <div class="mockrow">＋ 新对话</div>
          <div class="mockrow is-active">主题皮肤视觉验收</div>
          <div class="mockrow">设置</div>
        </nav>
      </div>
    </div>${pane.wall === '' ? '' : pane.wallKind === 'feijian' ? `
    <div class="workwrap walldemo" style="background:${pane.base}">
      <div class="workwrap-label">宝剑壁纸：横放古剑透出纸面、正文压在剑上（真机上挂 body 级 z-index:-2 独立层，飞剑落定 +0.5s 淡入）</div>
      ${pane.wall}
    </div>` : `
    <div class="workwrap" style="background:${pane.base}">
      <div class="workwrap-label">最前方（入场会播一遍：从窗口右上画外俯冲 → 绕一个大圈 1.8s → 停留 → 3s 转壁纸）</div>
      <div class="dsh-amb-wall" id="jyb-wall-front" style="position:absolute;left:0;top:0;width:100%;height:100%">${pane.wall}</div>
    </div>
    <div class="wallrow">
      <div class="workwrap workwrap-half" style="background:${pane.base}">
        <div class="workwrap-label">入场定格（约 0.62s：从右上画外俯冲下来、横扫工作区，身后一串水泡尾迹）</div>
        <div class="dsh-amb-wall jyb-still-mid" id="jyb-wall-mid" style="position:absolute;left:0;top:0;width:100%;height:100%"></div>
      </div>
      <div class="workwrap workwrap-half walldemo" style="background:${pane.base}">
        <div class="workwrap-label">壁纸态：正文压在她上面（背景层 + 可读性遮罩；真机上界面变半透明）</div>
        ${pane.backdrop}
      </div>
    </div>`}
  </figure>`).join('\n')

/**
 * The failure this feature actually hit, reproduced on purpose.
 *
 * The shell's navigation sits in the column at z-index 1. A seat at z-index 0 is
 * therefore *behind* it, so if anything in that navigation paints an opaque surface
 * the scenery vanishes while every other signal — seat present, right size, right
 * parent, stylesheet loaded — stays healthy. That is exactly the report the app
 * produced while the user saw nothing.
 *
 * Left column: the seat forced back to z-index 0. Right: the shipped value. If the
 * fix ever regresses, these two stop looking different.
 */
const overlapMarkup = `
  <figure class="pane">
    <figcaption>
      <strong>层级对照测试</strong>
      <span>导航使用不透明表面时：左＝座位 z-index 0（旧），右＝出货值（新）</span>
    </figcaption>
    <div class="colwrap">
      <div class="ZTP-Xa_sidebarCol" style="background:${panes[0].fill}">
        <div id="dsh-theme-ambient" class="is-behind">${panes[0].scene}</div>
        <nav class="mocknav is-opaque"></nav>
      </div>
      <div class="ZTP-Xa_sidebarCol" style="background:${panes[0].fill}">
        <div id="dsh-theme-ambient">${panes[0].scene}</div>
        <nav class="mocknav is-opaque"></nav>
      </div>
    </div>
  </figure>`

/**
 * 青冥飞剑的全屏部分单独成窗：框架贴整个工作区四边、入场穿屏按 vw/vh 走，
 * 侧栏列里画不出来。飞行定格在屏幕中段（fj-still 关掉一次性动画、给一个
 * 静态姿势），供截图自查；真实 app 里它由 drawScene 挂在 .dsh-amb-control
 * 全视口层上，动画 2.6 秒后常驻只剩框架与悬停剑。
 */
const feijianTheme = themes.find((theme) => theme.ambient?.kind === 'feijian')
const feijianOverlayPane = feijianTheme === undefined ? '' : `
  <figure class="pane">
    <figcaption>
      <strong>${feijianTheme.label} · 全屏部分（双环轨迹编队定格在第二环 + 四周框架）</strong>
      <span>悬停剑在左下素材带里直接显形（跳过等穿屏的一次性淡入）；飞行剑为截图定格姿势，非真实轨迹</span>
    </figcaption>
    <div class="fj-window fj-still">
      <div class="ZTP-Xa_sidebarCol fj-demo-col" style="background:${feijianTheme.tokens['--dsw-specific-sidebar-fill']?.light ?? '#EEEEEE'}">
        <div id="dsh-theme-ambient">${sceneFor(feijianTheme)}</div>
      </div>
      ${builders.feijianOverlayMarkup()}
    </div>
  </figure>`

// 龙焰宝剑的全屏双剑也单独成窗：剑图本体是全视口 vw 摆位，侧栏列里画不出来。
const longyanTheme = themes.find((theme) => theme.ambient?.kind === 'longyan')
const longyanOverlayPane = longyanTheme === undefined ? '' : `
  <figure class="pane">
    <figcaption>
      <strong>${longyanTheme.label} · 全屏部分（双剑悬空 + 气焰）</strong>
      <span>焰舌/火屑/辉光/扫刃为动画运行帧；真实 app 里由 drawScene 挂在 .dsh-amb-control 全视口层</span>
    </figcaption>
    <div class="fj-window">
      <div class="ZTP-Xa_sidebarCol fj-demo-col" style="background:${longyanTheme.tokens['--dsw-specific-sidebar-fill']?.light ?? '#EEEEEE'}">
        <div id="dsh-theme-ambient">${sceneFor(longyanTheme)}</div>
      </div>
      ${builders.longyanOverlayMarkup()}
    </div>
  </figure>`

// 龙焰宝剑·全剑版同样单独成窗。
const longyan2Theme = themes.find((theme) => theme.ambient?.kind === 'longyan2')
const longyan2OverlayPane = longyan2Theme === undefined ? '' : `
  <figure class="pane">
    <figcaption>
      <strong>${longyan2Theme.label} · 全屏部分（与青玉凤剑同一套双剑与气焰）</strong>
      <span>独立主题位与独立 overlay 层（ly2-o）；入场/气焰与青玉凤剑同一套</span>
    </figcaption>
    <div class="fj-window">
      <div class="ZTP-Xa_sidebarCol fj-demo-col" style="background:${longyan2Theme.tokens['--dsw-specific-sidebar-fill']?.light ?? '#EEEEEE'}">
        <div id="dsh-theme-ambient">${sceneFor(longyan2Theme)}</div>
      </div>
      ${builders.longyan2OverlayMarkup()}
    </div>
  </figure>`

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>DSH 侧栏氛围装饰预览</title>
<style>
  /* Everything below the marker is the plugin's own stylesheet, verbatim. */
  ${css}

  /* ── preview chrome only ───────────────────────────────────────────── */
  /* The live app mounts the scene into the .dsh-amb-control full-viewport layer,
     with the scene box positioned inline over the sidebar's bottom third. This page
     mounts into the legacy #dsh-theme-ambient seat, whose stylesheet rule still
     carries the OLD fixed full-viewport arrangement — so the seat must supply the
     band geometry here, or every scene paints across the whole page. */
  #dsh-theme-ambient{position:absolute;inset:auto 0 0 0;height:34%;overflow:hidden;z-index:1}
  body{margin:0;padding:28px;background:#f6f7f9;color:#1f2430;
    font:14px/1.6 system-ui,"Segoe UI","Microsoft YaHei",sans-serif}
  h1{font-size:17px;margin:0 0 4px}
  .lede{margin:0 0 24px;color:#5b6472;font-size:13px}
  .pane{margin:0 0 28px}
  figcaption{margin-bottom:10px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
  figcaption span{color:#6b7280;font-size:12px}
  .colwrap{display:flex;gap:20px;align-items:flex-start}
  /* 工作区壁纸那一条：主列尺寸的静态盒子（真机上几何由视口现算）。 */
  .workwrap{position:relative;margin-top:12px;height:380px;border-radius:10px;overflow:hidden;
    box-shadow:0 6px 20px rgba(20,30,50,.14)}
  .workwrap-label{position:absolute;left:10px;top:8px;z-index:2;font-size:11px;letter-spacing:.08em;
    color:rgba(255,255,255,.72)}
  /* 入场 → 壁纸态那两格并排（宽高各减半，省得一个 pane 拉得太长）。 */
  .wallrow{display:flex;gap:20px;margin-top:12px}
  .workwrap-half{flex:1;height:340px;margin-top:0}
  /* 入场定格：负延迟把动画**定格**在 0.62s 处（静态截图里也看得见"俯冲横扫"那一段）。 */
  .jyb-still-mid .jyb-scene{animation-delay:-.62s!important;animation-play-state:paused!important}
  /* 壁纸态演示盒：真机上这个层是 position:fixed / z-index:-2，且由 body 标记类淡入；
     这里就地改成盒内绝对定位并强制可见，只为肉眼验收"遮罩 + 人物"的合成结果。 */
  .walldemo .jyb-backdrop{position:absolute;inset:0;z-index:0;opacity:1}
  /* The shell's own width range: default 280, draggable down. */
  .ZTP-Xa_sidebarCol{width:280px;height:620px;border-radius:10px;overflow:hidden;
    box-shadow:0 6px 20px rgba(20,30,50,.14);position:relative}
  .ZTP-Xa_sidebarCol.is-narrow{width:200px;height:420px}
  /* The menu paints ABOVE the scenery — the source system's layering rule
     (nav 200 > decoration 99) — so the preview judges readability honestly. */
  .mocknav{position:relative;z-index:2;display:flex;flex-direction:column;
    padding:12px 12px 0;gap:2px;font-size:12.5px;color:#2E5C4D}
  .mockrow{padding:7px 9px;border-radius:7px}
  .mockrow.is-active{background:rgba(232,139,176,.16);box-shadow:inset 0 0 0 1px #E88BB0;
    color:#1F4638;font-weight:600}
  .mockfoot{margin-top:auto}
  /* The opaque-nav variant used by the stacking comparison. */
  .mocknav.is-opaque{background:${NAV_SURFACE};flex:1}
  /* Forces the seat back to the pre-fix value. */
  #dsh-theme-ambient.is-behind{z-index:0 !important}
  /* 青冥飞剑全屏演示窗：一个 mock 工作区（约 900×560），侧栏列贴左，
     overlay 直接挂窗上（与 .dsh-amb-control 同构：position:relative +
     overflow:hidden）。fj-still 定格入场飞行、跳过悬停剑的延迟淡入。 */
  .fj-window{width:900px;height:560px;border-radius:10px;overflow:hidden;position:relative;
    background:linear-gradient(to bottom,#F5FAFC 0%,#EEF5F8 55%,#E6F0F4 100%);
    box-shadow:0 6px 20px rgba(20,30,50,.14)}
  .fj-demo-col{width:280px;height:100%;border-radius:0;box-shadow:none}
  /* 定格规则必须 !important：要压的是元素上的内联 animation 简写与
     opacity:0（内联优先级高于任何类规则——第一次截图就是在这里静默落空的）。
     定格点取双环轨迹的第二环右缘（约 83vw / 61vh，剑头朝上=转弯中），
     换算进 900×560 的演示窗；僚剑定格在主剑侧后（同一条轨迹的靠后一段）。 */
  .fj-still .fj-fly{animation:none !important;opacity:.95 !important;transform:translate(700px,315px) rotate(268deg)}
  .fj-still .fj-wing-bob{animation:none !important}
  .fj-still .fj-wing-fly{animation:none !important;opacity:.85 !important;transform:translate(560px,270px) rotate(250deg)}
  .fj-still .fj-chev,.fj-still .fj-spark{animation:none !important;opacity:0 !important}
  .fj-still .fj-arrive{animation:none !important}
  /* 侧栏窗格（无 .fj-still 祖先）里悬停剑也直接显形：真实 app 里它延迟
     到飞行收势前 0.45s 淡入，静态截图评审必须眼见为实。仅本页，不影响出货。 */
  #dsh-theme-ambient .fj-arrive{animation:none !important}
  code{background:#eceff3;padding:1px 5px;border-radius:4px;font-size:12px}
</style>
</head>
<body>
  <h1>DSH 侧栏氛围装饰预览</h1>
  <p class="lede">
    下面每一段 CSS 与每一段场景标记都<strong>直接读自 <code>lib/client.js</code></strong>
    （与 <code>tests/check-ambient-render.mjs</code> 同一提取机制），不是另抄一份；
    全部皮肤各画两栏，宽窄两种宽度都画出来，因为侧栏可拖拽、而装饰是按百分比自适应的。
    场景挂在 <code>#dsh-theme-ambient</code> 上，该元素 <code>pointer-events:none</code>
    且位于导航之下，不会遮挡任何菜单项。
  </p>
${paneMarkup}
${feijianOverlayPane}
${longyanOverlayPane}
${longyan2OverlayPane}
${overlapMarkup}
<script>
  // 预览页自己的粘贴脚本：把**同一份**真实标记克隆到"入场中段定格"那一格。
  // （前一份与背景那份各自都是真实 builder 的输出，这里只是复制前一份 ——
  //   同一张 760KB 的 data URI 在一页里出现三遍没有必要。）
  (() => {
    const front = document.getElementById('jyb-wall-front')
    const mid = document.getElementById('jyb-wall-mid')
    if (front === null || mid === null) return
    mid.innerHTML = front.innerHTML
  })()
</script>
</body>
</html>
`

const out = join(root, 'tools', 'theme-bench', 'ambient-preview.html')
writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes, ${css.split('\n').length} CSS rules, ${panes.length} theme panes from lib/client.js)`)
