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
  // eslint-disable-next-line no-eval
  const parts = eval(literal)
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
  block('jpBoatMarkup'),
  block('dongyunAmbientScene'),
  block('xsPineMarkup'),
  block('junyueAmbientScene'),
  block('jiexinAmbientScene'),
  block('gcFeatherMarkup'),
  block('fengchenAmbientScene'),
  block('petHazeMarkup'),
  block('humaoAmbientScene'),
  block('ahuangAmbientScene'),
].join('\n\n')

// eslint-disable-next-line no-new-func
const builders = new Function(`${builderSource}\nreturn { shanAmbientScene, dreamAmbientScene, caiyunAmbientScene, dongyunAmbientScene, junyueAmbientScene, jiexinAmbientScene, fengchenAmbientScene, humaoAmbientScene, ahuangAmbientScene }`)()

/**
 * Build one theme's scene from its bundled `ambient` config through the real
 * builders. An unknown kind throws — the preview must never quietly show nothing.
 * @param theme - a bundled theme definition.
 * @returns the scene markup.
 */
function sceneFor(theme) {
  const a = theme.ambient ?? {}
  switch (a.kind) {
    case 'shan': return builders.shanAmbientScene(a.petals)
    case 'dream': return builders.dreamAmbientScene(a.bubbles, a.motes, a.fish)
    case 'caiyun': return builders.caiyunAmbientScene(a.stars)
    case 'dongyun': return builders.dongyunAmbientScene(a.snow)
    case 'junyue': return builders.junyueAmbientScene(a.stars)
    case 'jiexin': return builders.jiexinAmbientScene(a.dust)
    case 'fengchen': return builders.fengchenAmbientScene(a.feathers, a.dew)
    case 'humao': return builders.humaoAmbientScene(a.dust)
    case 'ahuang': return builders.ahuangAmbientScene(a.dust)
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
  note: KIND_NOTES[theme.ambient?.kind] ?? '',
  fill: theme.tokens['--dsw-specific-sidebar-fill']?.light ?? '#EEEEEE',
  scene: sceneFor(theme),
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
    </div>
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
${overlapMarkup}
</body>
</html>
`

const out = join(root, 'tools', 'theme-bench', 'ambient-preview.html')
writeFileSync(out, html)
console.log(`wrote ${out} (${html.length} bytes, ${css.split('\n').length} CSS rules, ${panes.length} theme panes from lib/client.js)`)
