/**
 * Render a self-contained preview of the sidebar scenery.
 *
 * The artwork and every rule are READ OUT OF `lib/client.js` rather than copied,
 * so this preview cannot drift from what ships. Its only purpose is the one thing
 * automated checks cannot do here: let a person look at the scenery before
 * installing it into the app.
 *
 * The `.ZTP-Xa_sidebarCol` wrapper is reproduced with the shell's real width range
 * so the scene can be judged at the width it will actually be drawn at.
 *
 * Run with: node scripts/build-ambient-preview.mjs
 * Output:   tools/theme-bench/ambient-preview.html
 */
import { readFileSync, writeFileSync } from 'node:fs'
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

const css = readAmbientCss()

/**
 * The 山青婷彩 scene, mirroring `shanAmbientScene()` in the bundle.
 *
 * Markup is repeated rather than imported because the bundle is a browser
 * lazy-CJS factory that cannot be loaded under Node. The preview is therefore a
 * MIRROR: if the two diverge, the preview lies. Keep them in step — the petal
 * formula below is copied verbatim from `shanAmbientScene`.
 * @param petals - how many petals to seed.
 * @returns the scene markup.
 */
function shanScene(petals) {
  let petalMarkup = ''
  for (let n = 1; n <= petals; n += 1) {
    petalMarkup += `<div class="sta-petal" style="left:${((n * 17) % 80) + 8}%;`
      + `width:${6 + ((n * 3) % 3)}px;height:${5 + ((n * 3) % 3)}px;`
      + `animation-duration:${11 + ((n * 5) % 4)}s;animation-delay:${-(n * 1.3)}s"></div>`
  }
  const dragonfly = (suffix) => `
    <svg viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="dsh-sta-dfly-body-${suffix}" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stop-color="#1F6B4C"/><stop offset="1" stop-color="#2E8C66"/>
      </linearGradient></defs>
      <ellipse cx="36" cy="15" rx="17" ry="4.4" fill="rgba(150,200,222,0.5)" transform="rotate(-40 36 15)"/>
      <ellipse cx="38" cy="24" rx="15" ry="4" fill="rgba(150,200,222,0.42)" transform="rotate(-14 38 24)"/>
      <ellipse cx="31" cy="11" rx="19" ry="5" fill="rgba(214,242,248,0.7)" transform="rotate(-30 31 11)" stroke="rgba(255,255,255,0.55)" stroke-width="0.6"/>
      <ellipse cx="34" cy="22" rx="16" ry="4.6" fill="rgba(240,214,242,0.62)" transform="rotate(-6 34 22)" stroke="rgba(255,255,255,0.55)" stroke-width="0.6"/>
      <path d="M 27 32 C 42 39, 60 46, 84 55" stroke="url(#dsh-sta-dfly-body-${suffix})" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="84" cy="55" r="1.4" fill="#17513C"/>
      <ellipse cx="27" cy="30" rx="6.5" ry="5" fill="#1F6B4C"/>
      <circle cx="18.5" cy="27.5" r="4.2" fill="#17513C"/>
      <circle cx="16.2" cy="25.8" r="1.9" fill="#0F3D2E"/>
      <circle cx="20.6" cy="25.4" r="1.9" fill="#0F3D2E"/>
      <circle cx="15.6" cy="25.2" r="0.6" fill="#DFF3EC"/>
      <circle cx="20" cy="24.8" r="0.6" fill="#DFF3EC"/>
    </svg>`

  return `<div class="sta">
    <div class="sta-mountains">
      <svg viewBox="0 0 223 190" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dsh-sta-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#8FBFAA"/><stop offset="1" stop-color="#74AE96"/>
          </linearGradient>
          <linearGradient id="dsh-sta-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3E8A66"/><stop offset="1" stop-color="#2B6E4F"/>
          </linearGradient>
        </defs>
        <path d="M 0 78 Q 30 48 62 66 Q 96 34 128 60 Q 160 40 190 62 Q 208 50 223 58 L 223 190 L 0 190 Z" fill="url(#dsh-sta-back)"/>
        <path d="M 0 122 Q 36 92 70 110 Q 104 84 140 108 Q 176 90 223 116 L 223 190 L 0 190 Z" fill="url(#dsh-sta-front)"/>
      </svg>
    </div>
    <div class="sta-mist sta-mist-1"></div>
    <div class="sta-mist sta-mist-2"></div>
    <div class="sta-pond"><div class="sta-pond-line"></div></div>
    <div class="sta-ripple" style="left:38%;bottom:5.2%"><span></span><span></span></div>
    <div class="sta-ripple" style="left:62%;bottom:3.4%"><span></span><span></span></div>
    <div class="sta-dfly sta-dfly-1"><div class="sta-bob">${dragonfly('1')}</div></div>
    <div class="sta-dfly sta-dfly-2"><div class="sta-bob">${dragonfly('2')}</div></div>
    <div class="sta-petals">${petalMarkup}</div>
  </div>`
}

/**
 * The 梦海游鱼 scene, mirroring `dreamAmbientScene()` in the bundle: glow, washes,
 * bubbles, glowing motes, cartoon fish and seaweed, grounded on the water-floor
 * band, with the theme-blue recolour. Markup is repeated rather than imported —
 * keep it in step with the bundle, or the preview lies.
 * @param bubbles - how many bubbles to seed.
 * @returns the scene markup.
 */
function dreamScene(bubbles) {
  let bubbleMarkup = ''
  for (let n = 1; n <= bubbles; n += 1) {
    const size = 3 + ((n * 4) % 4)
    bubbleMarkup += `<div class="dof-bubble" style="left:${((n * 23) % 86) + 6}%;`
      + `width:${size}px;height:${size}px;`
      + `animation-duration:${8 + ((n * 7) % 8)}s;animation-delay:${-(n * 1.7)}s"></div>`
  }
  // The glowing motes, mirrored from `dreamAmbientScene` (five seeded).
  let moteMarkup = ''
  for (let n = 1; n <= 5; n += 1) {
    const size = 5 + ((n * 3) % 4)
    moteMarkup += `<div class="dof-mote" style="left:${((n * 31) % 84) + 8}%;`
      + `width:${size}px;height:${size}px;`
      + `animation-duration:${9 + ((n * 5) % 7)}s;animation-delay:${-(n * 2.1)}s"></div>`
  }
  const blade = (key, d, gradient, width, opacity) => `<g class="dof-blade dof-blade-${key}">`
    + `<path d="${d}" fill="url(#${gradient})" stroke="url(#${gradient})" stroke-width="${width}" opacity="${opacity}"/></g>`
  // The cartoon fish, mirrored from `fishMarkup` with the theme-blue recolour.
  const fish = (size, top, duration, delay, flip) => {
    const anim = flip ? 'dsh-amb-swim-back' : 'dsh-amb-swim'
    return `<div class="dof-fish${flip ? ' dof-fish-flip' : ''}" style="position:absolute;left:0;opacity:.94;`
      + `top:${top}%;width:${size}em;animation:${anim} ${duration}s linear infinite;animation-delay:${delay}s">`
      + `<div class="dof-fish-bob" style="animation-duration:${(duration / 8).toFixed(2)}s">`
      + `<svg viewBox="0 0 50 18" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;overflow:visible">`
      + `<path d="M10 10 C20 5 35 5 45 10 C40 15 25 15 10 10 Z" fill="#5FA5D6" stroke="#2B6E9E" stroke-width="1"/>`
      + `<path d="M10 10 L5 7 L5 13 Z" fill="#2B6E9E" stroke="#2B6E9E" stroke-width="1" class="dof-fish-tail"/>`
      + `<path d="M20 7 L25 3 L30 7" fill="#2B6E9E" stroke="#2B6E9E" stroke-width="1"/>`
      + `<path d="M35 9 L40 12 L45 9" fill="#5FA5D6" stroke="#2B6E9E" stroke-width="1"/>`
      + `<circle cx="40" cy="8" r="2" fill="#FFFFFF"/><circle cx="41" cy="8" r="1" fill="#16384F"/>`
      + `<circle cx="40.5" cy="7.5" r="0.5" fill="#FFFFFF"/>`
      + `</svg></div></div>`
  }
  // Three depths, sizes and speeds, mirroring `FISH_PLAN` with `fish: 3`.
  const FISH_PLAN = [[2.4, 26, 34, -4, false], [1.7, 52, 46, -18, true], [1.3, 71, 40, -29, false]]
  const fishMarkup = FISH_PLAN.map((p) => fish(...p)).join('')

  return `<div class="dof">
    <div class="dof-glow">
      <div class="dof-corner"></div>
      <div class="dof-wash dof-wash-1"></div>
      <div class="dof-wash dof-wash-2"></div>
    </div>
    <div class="dof-bubbles">${bubbleMarkup}</div>
    <div class="dof-fish-layer">${fishMarkup}</div>
    <div class="dof-motes">${moteMarkup}</div>
    <div class="dof-floor" style="position:absolute;left:0;right:0;bottom:0;height:20%;z-index:4;background:linear-gradient(to bottom,rgba(126,184,222,0) 0%,rgba(126,184,222,.4) 46%,rgba(84,152,199,.62) 100%)"></div>
    <div class="dof-seaweed">
      <svg viewBox="0 0 140 120" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dsh-dof-weed-a" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#1E6E93"/><stop offset="0.55" stop-color="#3E93BC"/><stop offset="1" stop-color="#A5DEF0" stop-opacity="0.85"/>
          </linearGradient>
          <linearGradient id="dsh-dof-weed-b" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#2B7FA6"/><stop offset="0.6" stop-color="#4FA3C6"/><stop offset="1" stop-color="#B8E2F2" stop-opacity="0.85"/>
          </linearGradient>
          <linearGradient id="dsh-dof-weed-c" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#4A78A8"/><stop offset="0.6" stop-color="#7FA9CE"/><stop offset="1" stop-color="#CBE2F4" stop-opacity="0.8"/>
          </linearGradient>
        </defs>
        ${blade('1', 'M 22 120 C 12 96, 26 74, 18 48 C 15 38, 18 28, 24 20 C 20 34, 24 44, 30 60 C 36 80, 30 100, 32 120 Z', 'dsh-dof-weed-a', '2.2', '0.95')}
        ${blade('2', 'M 48 120 C 40 98, 54 80, 46 56 C 42 44, 48 34, 56 24 C 50 40, 56 52, 60 68 C 64 88, 56 104, 58 120 Z', 'dsh-dof-weed-b', '2', '0.92')}
        ${blade('3', 'M 74 120 C 68 102, 78 88, 72 68 C 69 58, 72 48, 78 40 C 74 52, 78 62, 82 76 C 86 94, 80 108, 82 120 Z', 'dsh-dof-weed-c', '1.8', '0.88')}
        ${blade('4', 'M 96 120 C 92 104, 102 90, 96 72 C 93 62, 96 54, 102 46 C 98 58, 102 68, 106 82 C 110 98, 102 110, 104 120 Z', 'dsh-dof-weed-a', '1.6', '0.85')}
        ${blade('5', 'M 118 120 C 114 108, 122 96, 117 82 C 115 74, 117 68, 121 62 C 118 72, 121 80, 124 92 C 127 104, 121 112, 123 120 Z', 'dsh-dof-weed-b', '1.4', '0.8')}
        <ellipse cx="30" cy="119" rx="14" ry="4" fill="#7FAFC6" opacity="0.55"/>
        <ellipse cx="72" cy="120" rx="10" ry="3.4" fill="#8FB9CE" opacity="0.5"/>
        <ellipse cx="108" cy="119.5" rx="12" ry="3.6" fill="#7FAFC6" opacity="0.45"/>
      </svg>
    </div>
  </div>`
}

/**
 * The colour a deliberately OPAQUE navigation surface is painted in.
 *
 * Used only by the stacking comparison below: the shell's real row surfaces are
 * translucent, but its scroll or panel container may not be, and the failing case is
 * indistinguishable from "nothing was drawn" once one opaque layer sits in between.
 */
const NAV_SURFACE = 'rgba(255,255,255,.72)'

/** The scene pane plus the sidebar fill each theme actually ships. */
const panes = [
  {
    title: '山青婷彩 · shan',
    note: '青山两层 + 云雾 + 水面涟漪 + 两只蜻蜓 + 花瓣飘落',
    fill: 'linear-gradient(to bottom,#EAF7F0 0%,#D8EFE4 20%,#C9E8DA 36%,#BFE2D2 50%,#B4DCCA 62%,#A8D2BE 74%,#9CC9B2 86%,#90C0A8 100%)',
    scene: shanScene(6),
  },
  {
    title: '梦海游鱼 · dream',
    note: '柔光辉 + 光洗 + 气泡 + 光点 + 蓝色小鱼 + 水草，水底渐变承接（配色已并入主题蓝系）',
    fill: 'linear-gradient(to bottom,#EAF5FF 0%,#DDF0FF 26%,#CDE9FB 52%,#BFE2F6 74%,#B0D9F0 100%)',
    scene: dreamScene(9),
  },
]

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
          <div class="mockrow is-active">山青婷彩主题复刻</div>
          <div class="mockrow">梦海游鱼配色提取</div>
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
          <div class="mockrow is-active">山青婷彩主题复刻</div>
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
  .mocknav{position:relative;z-index:1;display:flex;flex-direction:column;
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
  <h1>DSH 侧栏氛围装饰（复刻自电商新零售系统）</h1>
  <p class="lede">
    下面每一段 CSS 都<strong>直接读自 <code>lib/client.js</code></strong>，不是另抄一份；
    两种宽度都画出来，因为侧栏可拖拽、而装饰是按百分比自适应的。
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
console.log(`wrote ${out} (${html.length} bytes, ${css.split('\n').length} CSS rules from lib/client.js)`)
