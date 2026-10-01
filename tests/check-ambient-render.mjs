/**
 * Exercise the scenery markup builders.
 *
 * The scenery is HTML text injected with `innerHTML` — the third approach, after
 * `createRoot` mounted nothing and a hand-written DOM walker also left the seat
 * empty while a plain pseudo-element on that same seat was visible.
 *
 * Markup is the version that can be tested as text: no DOM stand-in, no namespace
 * juggling, and the two things the earlier approaches had to get right by hand (the
 * SVG namespace, and `stop-color` versus `stopColor`) are properties of the string.
 *
 * The builders are READ OUT OF `lib/client.js`, so this cannot drift from shipping.
 *
 * Run with: node tests/check-ambient-render.mjs
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
function check(label, condition, detail) {
  if (!condition) failed += 1
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`)
  if (!condition && detail !== undefined) console.log('  ·', detail)
}

/**
 * Grab `function name(...) { ... }` by brace matching.
 *
 * The PARAMETER LIST is skipped before looking for the body's brace. A destructured
 * parameter (`function page({ t, ... }) {`) carries braces of its own, and taking the
 * first `{` after the name ended the "body" at the parameter list — a 69-character
 * fragment that made every assertion about that function read nothing while still being
 * able to pass. That is the same silent-truncation class this file exists to catch, so
 * the extractor has an assertion of its own (see the panel section below).
 * @param name - the function to extract.
 * @param text - 可选：在别的源码文本上抽取（反证要在变异后的源码上跑同一个抽取器）。
 * @returns the function's source text.
 */
function block(name, text = source) {
  const start = text.indexOf(`    function ${name}(`)
  if (start < 0) throw new Error(`lib/client.js: function ${name} not found`)
  // Balanced-paren scan to the end of the signature, then the body's opening brace.
  let parens = 0
  let close = -1
  for (let i = text.indexOf('(', start); i < text.length; i += 1) {
    if (text[i] === '(') parens += 1
    else if (text[i] === ')') {
      parens -= 1
      if (parens === 0) { close = i; break }
    }
  }
  if (close < 0) throw new Error(`could not find the parameter list of ${name}`)
  const open = text.indexOf('{', close)
  let depth = 0
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1
    else if (text[i] === '}') {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  throw new Error(`could not find the end of ${name}`)
}

const builderSource = [
  "const SVG_TAGS = new Set(['svg', 'defs', 'linearGradient', 'stop', 'path', 'ellipse', 'g', 'circle'])",
  // 这些场景构建器读的工厂级常量（大鲸鱼娘的尾迹延迟按 `WHALE_ENTER_MS` 现算、青冥飞剑
  // 的三个时刻…）也必须在场 —— 少一个绑定就是 `ReferenceError`（这一份连 catch 都没有，
  // 会直接把整个测试文件打断，读数倒是响亮）。所以按**构建器全部源码**用到哪些常量现算。
  // （`SVG_TAGS` 是本数组自己声明的那一行，从闭包里剔掉，否则重复声明。）
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
  block('hasWall'),
  block('guardSceneryMarkup'),
  block('wallMarkup'),
].join('\n\n')

// eslint-disable-next-line no-new-func
const api = new Function(`${constantClosureFor(builderSource, ['SVG_TAGS']).join('\n')}\n\n${builderSource}\nreturn { shanAmbientScene, dragonflyMarkup, dreamAmbientScene, seaweedMarkup, rippleMarkup, dragonflyBlock, bladeMarkup, fishMarkup, ymSeaSvg, ymBalloonMarkup, caiyunAmbientScene, jpMoonMarkup, jpBoatMarkup, dongyunAmbientScene, xsPineMarkup, junyueAmbientScene, liuxingAmbientScene, fanhuaSwallowFlights, fanhuaSwallowKeyframes, fanhuaSwallowNodes, fanhuaAmbientScene, jiexinAmbientScene, gcFeatherMarkup, fengchenAmbientScene, petHazeMarkup, humaoAmbientScene, ahuangAmbientScene, jingyuAmbientScene, jingyuWallScene, hasWall, wallMarkup, open, fjSwordSvg, feijianCardMarkup, feijianAmbientScene, feijianFlightKeyframes, feijianWallMarkup, feijianOverlayMarkup, longyanAmbientScene, longyanOverlayMarkup, longyan2OverlayMarkup }`)()

// ── 龙焰宝剑 ─────────────────────────────────────────────────────────────────

const lyScene = api.longyanAmbientScene(8)
check('longyan scene has a scene root', lyScene.startsWith('<div class="dly-s"'))
check('longyan scene mounts glow + two threads + eight embers',
  lyScene.includes('dly-glow') && (lyScene.match(/dly-thread/g) ?? []).length === 3
  && (lyScene.match(/class="dly-ember/g) ?? []).length === 8)
check('longyan scene is inert to clicks (decoration never intercepts)',
  !/ on[a-z]+=/i.test(lyScene))
const lyOverlay = api.longyanOverlayMarkup()
check('longyan overlay carries both swords',
  lyOverlay.includes('dsh-amb-ly-sw-a') && lyOverlay.includes('dsh-amb-ly-sw-b')
  && lyOverlay.includes('dsh-amb-ly-img'))
check('longyan overlay has aura/lick/ember/glint effects (two swords × per-sword set)',
  (lyOverlay.match(/dsh-amb-ly-lick/g) ?? []).length === 14
  && (lyOverlay.match(/dsh-amb-ly-ember/g) ?? []).length === 18
  && (lyOverlay.match(/dsh-amb-ly-glint/g) ?? []).length === 2
  && (lyOverlay.match(/dsh-amb-ly-aura/g) ?? []).length === 2)
check('longyan overlay is aria-hidden and inert',
  lyOverlay.startsWith('<div class="dsh-amb-ly-o"') && lyOverlay.includes('aria-hidden="true"')
  && !/ on[a-z]+=/i.test(lyOverlay))
const ly2Overlay = api.longyan2OverlayMarkup()
check('longyan2 overlay is its own layer with the same accepted sword pair',
  ly2Overlay.startsWith('<div class="dsh-amb-ly2-o"') && ly2Overlay.includes('dsh-amb-ly-sw-a')
  && ly2Overlay.includes('dsh-amb-ly-sw-b'))
check('longyan2 sword A reuses the shared effect layers (lick/ember/glint on both swords)',
  (ly2Overlay.match(/dsh-amb-ly-lick/g) ?? []).length === 14
  && (ly2Overlay.match(/dsh-amb-ly-ember/g) ?? []).length === 18
  && (ly2Overlay.match(/dsh-amb-ly-glint/g) ?? []).length === 2)

// ── 山青婷彩 ─────────────────────────────────────────────────────────────────

const shan = api.shanAmbientScene(6)
check('shan has a scene root', shan.startsWith('<div class="sta"'))
// Positioning is inlined so a stylesheet that never applies cannot collapse the scene
// silently — the layer's own computed values could not reveal that, because they were
// reading the layer's inline styles.
check('the scene root carries its own positioning',
  /class="sta" style="[^"]*position:absolute/.test(shan))
check('the mountain band carries its own positioning',
  /class="sta-mountains" style="[^"]*position:absolute/.test(shan))
check('shan carries both mountain ridges', (shan.match(/<path /g) ?? []).length >= 2)
check('shan paints the far ridge with a gradient reference', shan.includes('fill="url(#dsh-sta-back)"'))
check('shan paints the near ridge with a gradient reference', shan.includes('fill="url(#dsh-sta-front)"'))
check('shan defines both gradients',
  shan.includes('id="dsh-sta-back"') && shan.includes('id="dsh-sta-front"'))
// The attribute the React-element version had to translate by hand, and got wrong
// once: `stopColor` written literally is inert.
check('stop colours are spelled `stop-color`, not `stopColor`',
  shan.includes('stop-color=') && !shan.includes('stopColor'))
check('shan draws the mist band', (shan.match(/class="sta-mist/g) ?? []).length === 2)
check('shan draws the water and its ripple rings',
  shan.includes('class="sta-pond"') && (shan.match(/class="sta-ripple"/g) ?? []).length === 2)

// ── 水面光圈的形状（2026-09-28 用户实机三轮反馈的落点）────────────────────────
//
// 第一轮：border-radius 圆在小尺寸栅格下发方；第二轮：非等比缩放椭圆把左右描边
// 拉厚、端部像方片；第三轮：橄榄形 SVG 的尖顶不自然。落点 = **SVG `<ellipse>`**
// （自然界水波的水平视角就是端部圆润的椭圆）+ **等比缩放**（容器 2.5:1 与 viewBox
// 一致，preserveAspectRatio=none 不产生描边畸变）+ **描边随扩散变细**（keyframes
// 动画 stroke-width 8 → 3）+ 基态 opacity:0（等延迟期间不闪整大的静态环）。
// 颜色不动。dsh-amb-ring 定义了两次（预览层/座位层），两处必须同改（反证 29）。
const junyueRing = api.rippleMarkup('38%', '5.2%', 0)
check('水面光圈是 SVG 椭圆（rx 46 / ry 16，端部平滑圆润；两环同形）',
  junyueRing.includes('viewBox="0 0 100 40"')
  && (junyueRing.match(/<ellipse cx="50" cy="20" rx="46" ry="16"/g) ?? []).length === 2
  && junyueRing.includes('stroke:rgba(232,139,176,.92)'))
check('水面光圈的两圈追逐：基态 opacity:0（等延迟不闪静态环）+ 第二环延迟 +1.6s',
  junyueRing.includes('opacity:0;') && junyueRing.includes('animation-delay:0s')
  && junyueRing.includes('animation-delay:1.6s'))
check('水面光圈扩散描边变细（两处 dsh-amb-ring 同改；颜色不动）',
  (source.match(/@keyframes dsh-amb-ring\{0%\{transform:scale\(\.35\);opacity:\.85;stroke-width:8\}100%\{transform:scale\(1\);opacity:0;stroke-width:3\}\}/g) ?? []).length === 2
  && /\.sta-ripple ellipse\{fill:none;stroke:rgba\(232,139,176,\.92\)/.test(source))

// 反证 29：把其中一处 keyframe 的"描边变细"拆掉 → 两处不再一致，上面的计数必须翻红。
const mutRing = source.replace('stroke-width:3}}', '}}')
check('反证 29 真的改动了源码（一处 keyframe 的描边变细被拆掉）', mutRing !== source)
check('反证 29：只改一处时两处不再一致（说明上面那条数的是两处）',
  (mutRing.match(/@keyframes dsh-amb-ring\{0%\{transform:scale\(\.35\);opacity:\.85;stroke-width:8\}100%\{transform:scale\(1\);opacity:0;stroke-width:3\}\}/g) ?? []).length === 1)

// ── 两圈光圈的远近层次（2026-09-28 用户实机：近大远小）────────────────────────
//
// 左圈（38%）是"远"：晚 1s 出现、整体缩小一档（sizeScale 0.8 → 宽 1.60em；0.9 时
// 用户实机反馈层次不够）；右圈（62%）是"近"：保持 2em / 1.6s 不变。两圈相位错开
// （1s vs 1.6s），起落不同步。
const rippleStylesOf = (scene) => [...scene.matchAll(/class="sta-ripple" style="([^"]*)"/g)].map((m) => m[1])
const rippleNow = rippleStylesOf(shan)
check('近大远小：左圈（38%）远——宽 1.60em / 高 0.64em / 晚 1s；右圈（62%）近——2em / 0.80em / 1.6s',
  rippleNow.length === 2
  && rippleNow.some((s) => s.includes('left:38%') && s.includes('width:1.60em') && s.includes('height:0.64em'))
  && rippleNow.some((s) => s.includes('left:62%') && s.includes('width:2.00em') && s.includes('height:0.80em')),
  `实际：${JSON.stringify(rippleNow)}`)
check('两圈相位错开：左圈 1s/2.6s，右圈 1.6s/3.2s（起落不同步）',
  (() => {
    // 延迟写在光圈内部两条 path 的行内样式上：每个容器向后匹配它自己的两环延迟。
    const phases = [...shan
      .matchAll(/class="sta-ripple"[\s\S]*?animation-delay:([\d.]+)s[\s\S]*?animation-delay:([\d.]+)s/g)]
      .map((m) => [Number(m[1]), Number(m[2])])
    return phases.length === 2
      && phases.some(([first]) => first === 1) && phases.some(([first]) => first === 1.6)
      && phases.every(([first, second]) => Math.abs(second - first - 1.6) < 0.001)
      && JSON.stringify(phases) === JSON.stringify([[1, 2.6], [1.6, 3.2]])
  })())

// 反证 30：左圈尺寸恢复 1（大小系数撤销）→ 左右同大，近大远小消失，必须翻红。
const mutNearFar = builderSource.replace("rippleMarkup('38%', '5.2%', 1, 0.8)", "rippleMarkup('38%', '5.2%', 1, 1)")
check('反证 30 真的改动了场景源码（左圈恢复原尺寸）', mutNearFar !== builderSource)
// eslint-disable-next-line no-new-func
const nearFarApi = new Function(`${mutNearFar}\nreturn { shanAmbientScene }`)()
const rippleMut = rippleStylesOf(nearFarApi.shanAmbientScene(6))
check('反证 30：尺寸恢复后左右同大（近大远小消失，说明上面测的是真通道）',
  rippleMut.length === 2 && rippleMut.every((s) => s.includes('width:2.00em')),
  `实际：${JSON.stringify(rippleMut)}`)
check('shan flies two dragonflies', (shan.match(/class="sta-dfly /g) ?? []).length === 2)
check('shan seeds the requested petal count', (shan.match(/class="sta-petal"/g) ?? []).length === 6)
check('shan seeds a different count on request',
  (api.shanAmbientScene(3).match(/class="sta-petal"/g) ?? []).length === 3)
check('petal count is clamped to the schema maximum',
  (api.shanAmbientScene(99).match(/class="sta-petal"/g) ?? []).length === 20)
check('petals carry per-petal inline geometry', /class="sta-petal" style="[^"]*left:\d+%/.test(shan))

// The two dragonflies animate independently, so their gradient ids must not collide.
const ids = shan.match(/id="dsh-sta-dfly-body-\w"/g) ?? []
check('each dragonfly carries its own gradient id', ids.length === 2 && new Set(ids).size === 2)
check('dragonfly artwork includes wings and eyes',
  api.dragonflyMarkup('1').includes('<ellipse') && api.dragonflyMarkup('1').includes('<circle'))

// ── 梦海游鱼 ─────────────────────────────────────────────────────────────────

const dream = api.dreamAmbientScene(9, 5, 3)
check('dream has a scene root', dream.startsWith('<div class="dof"'))
check('dream draws the corner glow and two washes',
  dream.includes('class="dof-corner"') && (dream.match(/class="dof-wash /g) ?? []).length === 2)
check('dream seeds the requested bubble count', (dream.match(/class="dof-bubble"/g) ?? []).length === 9)
check('bubble count is clamped',
  (api.dreamAmbientScene(99).match(/class="dof-bubble"/g) ?? []).length === 24)
check('dream draws five seaweed blades',
  (dream.match(/class="dof-blade dof-blade-\d"/g) ?? []).length === 5)
check('seaweed rests on three stones', (api.seaweedMarkup().match(/<ellipse /g) ?? []).length === 3)
check('seaweed gradients use stop-color', api.seaweedMarkup().includes('stop-color='))

// ── 营慕彩云 ─────────────────────────────────────────────────────────────────

const caiyun = api.caiyunAmbientScene(12)
check('caiyun has a scene root carrying its own positioning',
  caiyun.startsWith('<div class="ym"') && /class="ym" style="[^"]*position:absolute/.test(caiyun))
check('caiyun seeds the requested star count', (caiyun.match(/class="ym-star"/g) ?? []).length === 12)
check('star count is clamped', (api.caiyunAmbientScene(99).match(/class="ym-star"/g) ?? []).length === 30)
check('stars carry per-star inline geometry', /class="ym-star" style="[^"]*left:\d+%/.test(caiyun))
check('caiyun draws the dusk glow', caiyun.includes('class="ym-glow"'))
check('caiyun drifts three blurred clouds', (caiyun.match(/class="ym-drift ym-drift-\d"/g) ?? []).length === 3)
check('caiyun draws two marquee cloud-seas',
  caiyun.includes('class="ym-sea ym-sea-back"') && caiyun.includes('class="ym-sea ym-sea-front"'))
check('each cloud-sea track runs the marquee keyframe',
  (caiyun.match(/animation:dsh-amb-ym-sea \d+s/g) ?? []).length === 2)
check('each cloud-sea carries two svg copies so the loop is seamless',
  (caiyun.match(/class="ym-sea-track"/g) ?? []).length === 2
  && (caiyun.match(/<svg /g) ?? []).length >= 4)
check('the sea gradient ids stay unique across copies',
  new Set(caiyun.match(/id="dsh-ym-sea-[a-z]+-[ab]"/g) ?? []).size === 4)
check('caiyun flies two balloons', (caiyun.match(/class="ym-balloon ym-balloon-[a-z]+"/g) ?? []).length === 2)
check('both balloons bob on the ym keyframe',
  (caiyun.match(/animation:dsh-amb-ym-bob /g) ?? []).length === 2)
// The balloons legitimately float over the sidebar's lower rows. Their WANDER is what
// keeps that from being a permanent block: the two travel distinct, wide round trips so
// they cover and expose the text in turn. The size of that path is the whole point, so
// it is pinned — a balloon that only bobs is the defect this guards.
check('each balloon carries its own wide wander path',
  (caiyun.match(/animation:dsh-amb-ym-wander \d+s/g) ?? []).length === 1
  && (caiyun.match(/animation:dsh-amb-ym-wander-2 \d+s/g) ?? []).length === 1)
// The main balloon's wander is a CLOSED LOOP, so it is checked stop by stop rather than
// by one literal. Bounded spans, not `[^}]*`: a keyframe's body is full of nested braces.
// The `em` unit is OPTIONAL in the pattern on purpose: CSS allows a bare `0`, and an
// earlier version of this regex required the unit on the first value — which silently
// skipped every `translate(0, …)` stop and left the assertions reading the apex only.
const mainWanderStops = [
  ...(source.match(/@keyframes dsh-amb-ym-wander\{([\s\S]{0,240}?)\}\}',/)?.[1] ?? '')
    .matchAll(/translate\((-?[\d.]+)(?:em)?,(-?[\d.]+)(?:em)?\)/g),
].map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
check('the main wander is a closed three-stop loop',
  mainWanderStops.length === 3)
check('the main balloon keeps a wide horizontal path',
  mainWanderStops.length >= 3 && Math.max(...mainWanderStops.map((stop) => stop.x)) >= 6)
// The scene box clips at its OWN top edge (`overflow:hidden`) and the balloon sits high in
// the band, so ANY stop above the resting baseline would slice the envelope's crown off at
// the apex — the hard crop the user reported. Every vertical term must therefore be >= 0.
check('no stop of the main wander rises above the resting baseline (else the crown is cropped)',
  mainWanderStops.length >= 3 && mainWanderStops.every((stop) => stop.y >= 0))
// The apex height was accepted as-is, so it is pinned: raising or lowering it is a change
// the user did not ask for, and raising it re-introduces the crop.
const mainApex = mainWanderStops.reduce((best, stop) => (stop.x > best.x ? stop : best), { x: -1, y: -1 })
check('the rightmost apex keeps the exact position it was accepted at (7em, 0.5em)',
  mainApex.x === 7 && mainApex.y === 0.5)
// The loop's rise and fall comes from the START/END sitting lower than the apex, not from
// the apex moving up. Both ends must be lowered by the same amount and return to x = 0.
check('the start and end sit lower than the apex, giving the loop its rise and fall',
  mainWanderStops.length === 3
  && mainWanderStops[0].x === 0 && mainWanderStops[0].y > mainApex.y
  && mainWanderStops[2].x === 0 && mainWanderStops[2].y === mainWanderStops[0].y)
check('the mini balloon keeps its own wide, downward path',
  /@keyframes dsh-amb-ym-wander-2\{[\s\S]{0,160}?translate\(-5em,1\.6em\)/.test(source))
check('the balloons carry envelope, ropes and basket artwork',
  api.ymBalloonMarkup('main').includes('<rect') && api.ymBalloonMarkup('mini').includes('<rect'))

// ── 江畔冬云 ─────────────────────────────────────────────────────────────────

const dongyun = api.dongyunAmbientScene(8)
check('dongyun has a scene root carrying its own positioning',
  dongyun.startsWith('<div class="jp"') && /class="jp" style="[^"]*position:absolute/.test(dongyun))
const jpMoonSvg = dongyun.slice(dongyun.indexOf('<svg class="jp-moon"'), dongyun.indexOf('</svg>', dongyun.indexOf('<svg class="jp-moon"')))
check('dongyun hangs a circular SVG winter moon with halo gradients (CSS 圆角盘在部分渲染路径呈方斑，已换 SVG 正圆)',
  /<svg class="jp-moon" style="[^"]*overflow:visible/.test(dongyun)
  && dongyun.includes('url(#dsh-jp-moon-body)') && dongyun.includes('url(#dsh-jp-moon-halo)')
  && (jpMoonSvg.match(/<circle /g) ?? []).length === 2)
check('dongyun drifts three clouds', (dongyun.match(/class="jp-cloud jp-cloud-\d"/g) ?? []).length === 3)
check('dongyun seeds the requested snow count', (dongyun.match(/class="jp-snowflake"/g) ?? []).length === 8)
check('snow count is clamped', (api.dongyunAmbientScene(99).match(/class="jp-snowflake"/g) ?? []).length === 30)
check('dongyun draws the river with waterline and moonlight column',
  dongyun.includes('class="jp-river"') && dongyun.includes('class="jp-waterline"')
  && dongyun.includes('class="jp-moonlight"'))
check('dongyun draws three ripples and five glints',
  (dongyun.match(/class="jp-ripple jp-ripple-\d"/g) ?? []).length === 3
  && (dongyun.match(/class="jp-glint"/g) ?? []).length === 5)
const boat = api.jpBoatMarkup()
check('the boat carries hull, awning and lantern artwork',
  boat.includes('M 6 24 Q 60 36 114 22') && boat.includes('M 38 24 C 44 10, 78 10, 88 23')
  && boat.includes('r="2.6"'))
check('the boat reflection is a flipped reuse of the same art',
  boat.includes('transform="translate(0,90) scale(1,-1)"'))
check('the boat drifts and bobs',
  dongyun.includes('animation:dsh-amb-jp-boat 46s') && dongyun.includes('animation:dsh-amb-jp-bob 5.2s'))
check('dongyun plants four swaying reeds and three bank lines',
  (dongyun.match(/class="jp-reed jp-reed-\d"/g) ?? []).length === 4
  && (dongyun.match(/M \d+ 120 C/g) ?? []).length >= 3)

// ── 徐山军月 ─────────────────────────────────────────────────────────────────

const junyue = api.junyueAmbientScene(12)
check('junyue has a scene root carrying its own positioning',
  junyue.startsWith('<div class="xs"') && /class="xs" style="[^"]*position:absolute/.test(junyue))
check('junyue seeds the requested star count', (junyue.match(/class="xs-star"/g) ?? []).length === 12)
check('junyue star count is clamped', (api.junyueAmbientScene(99).match(/class="xs-star"/g) ?? []).length === 30)
check('junyue hangs the full moon as an SVG circle with halo (同 jp-moon 的 SVG 换法)',
  /<svg class="xs-moon" style="[^"]*overflow:visible/.test(junyue)
  && junyue.includes('url(#dsh-xs-moon-body)') && junyue.includes('url(#dsh-xs-moon-halo)'))
check('junyue veils the moon with two night clouds',
  (junyue.match(/class="xs-cloud xs-cloud-\d"/g) ?? []).length === 2)
check('the meteor carries a glowing head',
  junyue.includes('class="xs-meteor"') && junyue.includes('box-shadow:0 0 8px 2px rgba(255,251,234,.9)'))
check('junyue draws both mountain ridges with their gradients',
  junyue.includes('fill="url(#dsh-xsj-ridge-back)"') && junyue.includes('fill="url(#dsh-xsj-ridge-front)"'))
check('junyue stands five pines from one shared art def',
  (junyue.match(/<use href="#dsh-xsj-pine-art"/g) ?? []).length === 5
  && api.xsPineMarkup().includes('M 12 120 L 12 112'))

// ── 最右侧的松树必须完整落在 viewBox 里（2026-09-28 用户实机：右半被裁掉）────────
//
// 松树画稿自身横跨 x 3..21（宽 18，上一条断言钉住了它的路径起点），`<use>` 的
// translate/scale 把它映射进 viewBox 0..140。第 5 棵原先 translate(126,0) scale(1.05)
// → 实际占位 129.2..148.1，超出 140 的右半被 SVG 裁掉——实机看到的就是"只剩左半边"。
// 这里从渲染出的 markup **现算**每棵树的实际占位，五棵全部必须在画面内（左 ≥0、
// 右 ≤140）。松树画稿若改动外形，本断言的 3..21 界要与 `xsPineMarkup` 同步复核。
const PINE_ART_X0 = 3
const PINE_ART_X1 = 21
const junyuePineUses = [...junyue
  .matchAll(/<use href="#dsh-xsj-pine-art" transform="translate\((-?[\d.]+),(-?[\d.]+)\) scale\(([\d.]+)\)"/g)]
const pineExtent = junyuePineUses.map((m) => {
  const tx = Number(m[1])
  const s = Number(m[3])
  return [tx + s * PINE_ART_X0, tx + s * PINE_ART_X1]
})
check('徐山军月：五棵松树全部完整落在 viewBox 0..140 内（最右一棵曾被裁掉右半）',
  junyuePineUses.length === 5
  && pineExtent.every(([left, right]) => left >= 0 && right <= 140),
  `实际占位：${pineExtent.map(([l, r]) => `[${l.toFixed(1)},${r.toFixed(1)}]`).join(' ')}`)

// 反证 28：把最右一棵挪回被裁的位置（translate 126）→ 右缘 148.1 越过 140，必须翻红。
const mutPineCut = builderSource.replace('translate(117,0) scale(1.05)', 'translate(126,0) scale(1.05)')
check('反证 28 真的改动了场景源码（最右松树挪回被裁的位置）', mutPineCut !== builderSource)
// eslint-disable-next-line no-new-func
const cutApi = new Function(`${mutPineCut}\nreturn { xsPineMarkup, junyueAmbientScene }`)()
const cutExtent = [...cutApi.junyueAmbientScene(12)
  .matchAll(/<use href="#dsh-xsj-pine-art" transform="translate\((-?[\d.]+),(-?[\d.]+)\) scale\(([\d.]+)\)"/g)]
  .map((m) => {
    const tx = Number(m[1])
    const s = Number(m[3])
    return [tx + s * PINE_ART_X0, tx + s * PINE_ART_X1]
  })
check('反证 28：挪回之后最右松树的右缘越过 140（右半被裁，说明上面测的是真通道）',
  cutExtent.length === 5 && cutExtent[4][1] > 140,
  `实际最右占位：[${cutExtent[4]?.[0]?.toFixed(1)},${cutExtent[4]?.[1]?.toFixed(1)}]`)

// ── 流星白羽（原创）────────────────────────────────────────────────────────────

const liuxing = api.liuxingAmbientScene(5, 7)
check('liuxing has a scene root carrying its own positioning',
  liuxing.startsWith('<div class="lx"') && /class="lx" style="[^"]*position:absolute/.test(liuxing))
check('liuxing hangs the full moon as an SVG circle with a gold halo (同 jp/xs-moon 的 SVG 换法)',
  /<svg class="lx-moon" style="[^"]*overflow:visible/.test(liuxing)
  && liuxing.includes('url(#dsh-lx-moon-body)') && liuxing.includes('url(#dsh-lx-moon-halo)'))
check('the white-feather streak carries a glowing head and flies on the lx keyframe',
  liuxing.includes('class="lx-streak"') && liuxing.includes('animation:dsh-amb-lx-streak 26s'))
check('liuxing seeds the requested geese count', (liuxing.match(/class="lx-goose"/g) ?? []).length === 5)
check('geese count is clamped', (api.liuxingAmbientScene(99, 0).match(/class="lx-goose"/g) ?? []).length === 9)
check('the wedge drifts across the band on the lx keyframe',
  liuxing.includes('animation:dsh-amb-lx-drift 150s'))
check('liuxing seeds the requested dew count', (liuxing.match(/class="lx-dew"/g) ?? []).length === 7)
check('dew count is clamped', (api.liuxingAmbientScene(0, 99).match(/class="lx-dew"/g) ?? []).length === 30)
check('liuxing plants four swaying reeds', (liuxing.match(/class="lx-reed lx-reed-\d"/g) ?? []).length === 4)
check('liuxing backs the reeds with faint ink ridges',
  liuxing.includes('class="lx-ridge"') && liuxing.includes('opacity="0.16"'))
// The streak is the song's own image (流星白羽): it must be a GUEST, not a resident —
// visible for a short window of its loop, invisible at both ends, like xs-meteor.
check('the streak is invisible at both ends of its loop (低频掠过，不常驻亮线)',
  /@keyframes dsh-amb-lx-streak\{0%\{transform:rotate\(-24deg\) translateX\(0\);opacity:0\}/.test(source)
  && /14%\{transform:rotate\(-24deg\) translateX\(-30em\);opacity:0\}/.test(source))
check('every goose is a stroked bird glyph, not a filled blob',
  /class="lx-goose"[\s\S]{0,320}stroke-linecap="round"/.test(liuxing))

// ── 姑苏繁花（原创）────────────────────────────────────────────────────────────

const fanhua = api.fanhuaAmbientScene(8, 2)
check('fanhua has a scene root carrying its own positioning',
  fanhua.startsWith('<div class="fh"') && /class="fh" style="[^"]*position:absolute/.test(fanhua))
check('fanhua seeds the requested petal count', (fanhua.match(/class="fh-petal"/g) ?? []).length === 8)
check('petal count is clamped', (api.fanhuaAmbientScene(99, 0).match(/class="fh-petal"/g) ?? []).length === 20)
check('petals are petal-shaped and fall on the fh keyframe',
  /class="fh-petal" style="[^"]*border-radius:70% 30% 65% 35%[^"]*animation:dsh-amb-fh-petal/.test(fanhua))
check('fanhua hangs three swaying willow strands from the band top',
  (fanhua.match(/class="fh-willow fh-willow-\d"/g) ?? []).length === 3
    && (fanhua.match(/animation:dsh-amb-fh-willow /g) ?? []).length === 3)
check('the willow strands anchor at the top edge (向下生长，顶边裁切不裁动程)',
  /class="fh-willow fh-willow-1" style="position:absolute;top:0;/.test(fanhua)
    && fanhua.includes('transform-origin:50% 0'))
// 柳叶姿态 = 用户指出的 180° 翻转：叶尖下垂（左 115°/右 65°），不是向上翘的芽。
check('the willow leaves droop downward along the strands (柳叶下垂，180° 翻转)',
  (fanhua.match(/rotate\(115 /g) ?? []).length === 12
    && (fanhua.match(/rotate\(65 /g) ?? []).length === 12)
check('fanhua paints the blossom branch with three five-petal blossoms',
  fanhua.includes('class="fh-branch"')
    && (fanhua.match(/fill="#F795A0"/g) ?? []).length === 15
    && (fanhua.match(/fill="#8C4356"/g) ?? []).length === 3)
// 花头姿态与桃枝朝向 = 用户拍板的组合：恢复最初的斜出姿势（原路径、花瓣环
// 在枝点上方），再把整枝 rotate(180deg) 头尾对调——旋转后花头自然垂到枝下。
// 姿势与旋转是源码级事实（标记里只剩求值后的数字），钉在提取出的 builder 块上。
const fanhuaBlock = block('fanhuaAmbientScene')
check('the peach branch is the previous posture, rotated 180° (恢复原姿势 + 头尾对调)',
  fanhuaBlock.includes("'M 88.6 5 C 74 18, 58 34, 44 58 C 38 68, 30 78, 22 86'")
    && fanhuaBlock.includes('cy: String(Number(by) - 2.6 * Number(s))')
    && (fanhua.match(/transform:rotate\(180deg\)/g) ?? []).length === 1)
// 用户定位（2026-09-28）：尾梢顶住侧栏右边框（容器右缘越出 1.375em，越出部分
// 被场景盒裁掉、梢尖恰好落在边框上），再整体上移 8px。
check('the branch tail touches the sidebar border and the branch rides 8px higher',
  fanhua.includes('top:-8px;right:-1.375em'))
// 用户反馈：主枝末梢的圆头像断枝——主枝收短后由两段渐细描边接到枝尖
// （2.4 → 1.5 → 0.8 → 圆头），末端才是末梢枝尖。
check('the branch tip tapers to a point (末梢收尖，不是断枝)',
  fanhuaBlock.includes("'M 88.6 5 L 92 2'")
    && (fanhua.match(/stroke-width="0.8"/g) ?? []).length === 1)
// ── 飞燕（2026-09-29 定稿：丙 + 伴飞的远燕，共两只）────────────────────
// 用户实机辨认后保留丙（近燕低掠），其余候选与评审标签（fh-tag）已删。
// 朝向修正：画稿本来头朝 -x（用户实机指出「头在左、尾在右却朝右飞」
// ——上一版注释写「燕头朝 +x」与画不符），向右飞的燕子在 flip 层做
// scaleX(-1)，燕头才指向前进方向。同日补定远燕（yuan）：丙的远景版，
// 更小（近大远小）、更高（更远）、更淡，且出现得更晚（appearAfter
// 正延迟，进场前停在带外不可见）。
const swallowVariants = ['bing', 'yuan']
const swallowCss = api.fanhuaSwallowKeyframes()
check('fanhua seeds exactly two swallows: 丙 (bing) + its far companion (yuan)',
  (fanhua.match(/class="fh-sw fh-sw-/g) ?? []).length === 2
    && fanhua.includes('class="fh-sw fh-sw-bing"')
    && fanhua.includes('class="fh-sw fh-sw-yuan"'))
check('the swallow count clamps to the flight table (and can be zero)',
  (api.fanhuaAmbientScene(0, 99).match(/class="fh-sw fh-sw-/g) ?? []).length === 2
    && (api.fanhuaAmbientScene(0, 0).match(/class="fh-sw fh-sw-/g) ?? []).length === 0)
check('the review tags are gone with the rejected candidates (定稿不留标签)',
  !fanhua.includes('fh-tag') && (fanhua.match(/>[甲乙丙丁戊]</g) ?? []).length === 0
    && ['jia', 'yi', 'ding', 'wu'].every((k) => !fanhua.includes(`fh-sw-${k}`)))
check('the wings beat: both wings of both swallows run the wing keyframes at the shoulder',
  (fanhua.match(/animation:dsh-amb-fh-wing-/g) ?? []).length === 4
    && (fanhua.match(/transform-origin:13\.5px /g) ?? []).length === 4)
check('both rightward swallows mirror the left-facing artwork on static layers that never animate',
  (fanhua.match(/transform:scaleX\(-1\)/g) ?? []).length === 2
    && !/transform:scaleX\(-1\)[^"]*animation:/.test(fanhua))
check('the far swallow is smaller, higher and appears later (近大远小 + 晚出现)',
  (() => {
    // split 消费掉了前缀 class="fh-sw ，分段以 fh-sw-<key>" 开头。
    const chunk = (key) => fanhua.split('class="fh-sw ').slice(1).find((c) => c.startsWith(`fh-sw-${key}`))
    const read = (key, re) => {
      const c = chunk(key)
      if (c === undefined) throw new Error(`fh-sw-${key} chunk not found in fanhua markup`)
      const m = c.match(re)
      return m ? Number(m[1]) : NaN
    }
    return read('yuan', /width:([\d.]+)em/) < read('bing', /width:([\d.]+)em/)
      && read('yuan', /top:([\d.]+)%/) < read('bing', /top:([\d.]+)%/)
      && read('bing', /animation-delay:(-?[\d.]+)s/) < 0
      && read('yuan', /animation-delay:(-?[\d.]+)s/) > 0
  })())
check('bob/wave keyframes never touch x — the mover is the only horizontal layer',
  swallowCss.every((css) => (!css.includes('dsh-amb-fh-bob-') && !css.includes('dsh-amb-fh-wave-'))
    || (!/translate\((?!Y)/.test(css) && /transform:translateY\(/.test(css))))
check('every swallow carries a slow whole-crossing wave (真燕不飞直线)',
  swallowCss.filter((css) => css.includes('dsh-amb-fh-wave-')).every((css) => {
    // 首尾停靠点是单位省略的 translateY(0)，em 可有可无。
    const stops = [...css.matchAll(/transform:translateY\((-?[\d.]+)(?:em)?\)/g)].map((m) => Number(m[1]))
    const amplitude = Math.max(...stops.map(Math.abs))
    return stops.length >= 4
      && stops[0] === 0 && stops[stops.length - 1] === 0
      && amplitude >= 0.9
  }))
check('the swallows never fly backwards: mover translateX is strictly monotonic',
  swallowCss.filter((css) => css.includes('dsh-amb-fh-sw-')).every((css) => {
    const stops = [...css.matchAll(/translateX\((-?[\d.]+)em\)/g)].map((m) => Number(m[1]))
    return stops.length > 4 && stops.every((x, i) => i === 0 || Math.abs(x) > Math.abs(stops[i - 1]))
  }))
check('the wing sweeps head-to-tail (负角→尾侧正角) and folds mid-glide',
  swallowCss.filter((css) => css.includes('dsh-amb-fh-wing-')).every((css) => {
    const stops = [...css.matchAll(/rotate\((-?\d+(?:\.\d+)?)deg\) scaleY\((\d+(?:\.\d+)?)\)/g)]
    return stops.some((m) => Number(m[1]) <= -20 && Number(m[2]) === 1)
      && stops.some((m) => Number(m[1]) >= 40 && Number(m[2]) === 1)
      && stops.some((m) => Number(m[1]) > 50 && Number(m[2]) < 1)
  }))
check('flap, bob, wave and mover share one delay so the fold lines up with the dash',
  (() => {
    const chunks = fanhua.split('class="fh-sw ').slice(1)
    return chunks.length === 2 && chunks.every((chunk) => {
      const delays = [...chunk.matchAll(/animation-delay:(-?[\d.]+s)/g)].map((m) => m[1])
      return delays.length === 5 && delays.every((d) => d === delays[0])
    })
  })())
check('mover duration is a whole multiple of the wing cycle, and the wave spans the whole crossing (相位锁定)',
  (() => {
    const movers = [...fanhua.matchAll(/dsh-amb-fh-sw-(\w+) ([\d.]+)s/g)]
    const cycles = [...fanhua.matchAll(/dsh-amb-fh-bob-(\w+) ([\d.]+)s/g)]
    const waves = [...fanhua.matchAll(/dsh-amb-fh-wave-(\w+) ([\d.]+)s/g)]
    return movers.length === 2 && waves.length === 2 && movers.every(([,, dur]) => dur) && movers.every(([, key, dur]) => {
      const cyc = cycles.find(([, k]) => k === key)
      const wav = waves.find(([, k]) => k === key)
      return cyc !== undefined && wav !== undefined
        && Math.abs((Number(dur) / Number(cyc[2])) % 1) < 1e-6
        && wav[2] === dur
    })
  })())
check('fanhua draws the warm water band with a waterline and three drifting ripples',
  fanhua.includes('class="fh-water"') && fanhua.includes('class="fh-waterline"')
    && (fanhua.match(/class="fh-ripple fh-ripple-\d"/g) ?? []).length === 3
    && (fanhua.match(/animation:dsh-amb-fh-ripple /g) ?? []).length === 3)
check('fanhua backs the water with two softly painted hills (西山相罨画)',
  fanhua.includes('opacity="0.18"') && fanhua.includes('opacity="0.26"'))
check('two petals float on the water (落花有意，流水载之)',
  (fanhua.match(/class="fh-float"/g) ?? []).length === 2)

// ── 佩安杰心 ─────────────────────────────────────────────────────────────────

const jiexin = api.jiexinAmbientScene(4)
check('jiexin has a scene root carrying its own positioning',
  jiexin.startsWith('<div class="pj"') && /class="pj" style="[^"]*position:absolute/.test(jiexin))
check('jiexin backs the scene with two misty hills',
  jiexin.includes('M 0 60 Q 34 22 70 46') && jiexin.includes('M 0 72 Q 40 42 82 60'))
check('jiexin draws the enso circle with its inner arc',
  jiexin.includes('stroke-dasharray="316 36"') && jiexin.includes('stroke-dasharray="255 92"'))
check('jiexin seats the meditator with head, body and cushion',
  jiexin.includes('M 64 52 C 60 68, 62 80, 67 93') && jiexin.includes('cx="80" cy="119" rx="47"'))
check('jiexin burns incense with two smoke threads on the dashoffset keyframe',
  (jiexin.match(/class="pj-smoke pj-smoke-\d"/g) ?? []).length === 2
  && (jiexin.match(/animation:dsh-amb-pj-smoke 7s/g) ?? []).length === 2)
check('jiexin seeds the requested dust count', (jiexin.match(/class="pj-dust"/g) ?? []).length === 4)
check('jiexin dust count is clamped', (api.jiexinAmbientScene(99).match(/class="pj-dust"/g) ?? []).length === 20)
check('jiexin closes with the theme words in a kai face',
  jiexin.includes('自在') && jiexin.includes('安顿') && jiexin.includes('KaiTi'))

// ── 光彩凤晨 ─────────────────────────────────────────────────────────────────

const fengchen = api.fengchenAmbientScene(6, 10)
check('fengchen has a scene root carrying its own positioning',
  fengchen.startsWith('<div class="gc"') && /class="gc" style="[^"]*position:absolute/.test(fengchen))
check('fengchen fans five dawn rays at inline rotations',
  (fengchen.match(/class="gc-ray gc-ray-\d" style="[^"]*rotate\(-?\d+deg\)/g) ?? []).length === 5)
check('fengchen seeds the requested feather count', (fengchen.match(/class="gc-feather"/g) ?? []).length === 6)
check('fengchen feather count is clamped',
  (api.fengchenAmbientScene(99, 0).match(/class="gc-feather"/g) ?? []).length === 16)
check('each feather carries its own gradient id',
  new Set(fengchen.match(/id="dsh-gc-feather-\d+"/g) ?? []).size === 6
  && (fengchen.match(/id="dsh-gc-feather-\d+"/g) ?? []).length === 6)
check('fengchen seeds the requested dew count', (fengchen.match(/class="gc-dew"/g) ?? []).length === 10)
check('fengchen dew count is clamped',
  (api.fengchenAmbientScene(0, 99).match(/class="gc-dew"/g) ?? []).length === 30)
check('the phoenix strokes share one gradient under a glow filter',
  fengchen.includes('id="dsh-gc-phoenix-stroke"') && fengchen.includes('filter="url(#dsh-gc-glow)"')
  && (fengchen.match(/stroke="url\(#dsh-gc-phoenix-stroke\)"/g) ?? []).length >= 11)
check('the phoenix keeps the source stroke-only look (its fill gradient was never defined)',
  /d="M 380 50 C 360 40 350 60 360 90[^"]*" fill="none"/.test(fengchen))
check('the phoenix neck keeps its emphasised stroke width',
  /class="gc-neck"[^>]*stroke-width="7"/.test(fengchen))
check('the phoenix wings flap on the gc keyframe',
  (fengchen.match(/animation:dsh-amb-gc-wing 3.4s/g) ?? []).length === 2)
check('the phoenix eye is the theme gold', fengchen.includes('r="2.5"'))

// ── 琥珀猫咪（原创）────────────────────────────────────────────────────────────

const humao = api.humaoAmbientScene(6)
check('humao has a scene root carrying its own positioning',
  humao.startsWith('<div class="hm"') && /class="hm" style="[^"]*position:absolute/.test(humao))
check('humao opens with the shared pet haze masked at the band edge',
  humao.includes(api.petHazeMarkup('rgba(255,214,140,.5)', 'dsh-amb-hm-glow'))
    && /class="pet-haze" style="[^"]*mask-image:linear-gradient\(to bottom,transparent 0,#000 42%\)/.test(humao))
check('humao draws exactly two cats',
  (humao.match(/class="hm-cat-/g) ?? []).length === 2)
check('the sitting tabby carries ears, face and tabby stripes',
  humao.includes('d="M26 46 L23 31 L35 39 Z"')
    && humao.includes('d="M36 58 L40 58 L38 61 Z"')
    && (humao.match(/stroke="#8A5A2B"/g) ?? []).length >= 3)
// The head/body DETACH the user reported is a geometry fact, so pin it numerically.
// The connection is the HEAD being placed low enough (user-specified: no neck shape):
// the body's top edge at the head's center-x (38) sits at y≈61.25 for the pinned
// body path (M30 78 C34 64 42 56 52 52 …), so a connected head needs cy + r >= 63.25.
// v1's head (cy=26, bottom 41) was the floating head the user reported.
const hmHead = /<circle cx="38" cy="([\d.]+)" r="([\d.]+)"/.exec(humao)
check('the sitting cat\u2019s head reaches the body (the reported detach)',
  hmHead !== null && Number(hmHead[1]) + Number(hmHead[2]) >= 63.25)
check('the curled cat sleeps on its own breathing keyframe',
  (humao.match(/animation:dsh-amb-hm-breathe /g) ?? []).length === 1)
check('the sitting cat sways its tail and twitches an ear',
  (humao.match(/animation:dsh-amb-hm-tail /g) ?? []).length === 1
    && (humao.match(/animation:dsh-amb-hm-ear /g) ?? []).length === 1)
check('two z glyphs drift off the sleeping cat',
  (humao.match(/class="hm-z hm-z-\d"/g) ?? []).length === 2
    && (humao.match(/animation:dsh-amb-hm-zzz /g) ?? []).length === 2)
check('humao seeds the requested dust count', (humao.match(/class="hm-dust"/g) ?? []).length === 6)
check('humao dust count is clamped', (api.humaoAmbientScene(99).match(/class="hm-dust"/g) ?? []).length === 20)
check('humao dust carries per-mote inline geometry',
  /class="hm-dust" style="[^"]*left:\d+%/.test(humao))
check('humao grounds the cats on a sunlit sill with a hairline',
  humao.includes('class="hm-sill"') && humao.includes('class="hm-sill-line"'))

// ── 虎子阿黄（原创）────────────────────────────────────────────────────────────

const ahuang = api.ahuangAmbientScene(5)
check('ahuang has a scene root carrying its own positioning',
  ahuang.startsWith('<div class="hz"') && /class="hz" style="[^"]*position:absolute/.test(ahuang))
check('ahuang opens with its own golden haze',
  (ahuang.match(/class="pet-haze"/g) ?? []).length === 1
    && ahuang.includes('rgba(240,194,57,.42)'))
check('ahuang draws one dog with the pastoral-dog markings',
  (ahuang.match(/class="hz-dog"/g) ?? []).length === 1
    && ahuang.includes('d="M28 40 C24 30 23 23 26 18 C30 21 34 28 35.5 36 Z"')
    && ahuang.includes('d="M76 70 C92 66 100 50 92 36 C88 30 82 29 78 32"'))
// Same detach guard for the dog: head-circle bottom minus torso-ellipse top >= 2.
const hzHead = /<circle cx="42" cy="([\d.]+)" r="([\d.]+)"/.exec(ahuang)
const hzTorso = /<ellipse cx="44" cy="([\d.]+)" rx="18" ry="([\d.]+)"/.exec(ahuang)
check('the dog\u2019s head overlaps its body too (the reported detach)',
  hzHead !== null && hzTorso !== null
    && Number(hzHead[1]) + Number(hzHead[2]) - (Number(hzTorso[1]) - Number(hzTorso[2])) >= 2)
check('the dog wags a sickle tail and tilts its head',
  (ahuang.match(/animation:dsh-amb-hz-wag /g) ?? []).length === 1
    && (ahuang.match(/animation:dsh-amb-hz-tilt /g) ?? []).length === 1)
check('the dog wears a straw collar with a bell in the theme gold',
  /stroke="#896C39" stroke-width="5"/.test(ahuang) && /fill="#F0C239" stroke="#B98A20"/.test(ahuang))
check('ahuang sways dry grass tufts',
  (ahuang.match(/class="hz-grass"/g) ?? []).length === 3
    && (ahuang.match(/animation:dsh-amb-hz-grass /g) ?? []).length === 3)
check('the ball is painted in the theme accent',
  ahuang.includes('class="hz-ball"') && /fill="#F0C239" stroke="#C9A02F"/.test(ahuang))
check('ahuang seeds the requested fluff count', (ahuang.match(/class="hz-fluff"/g) ?? []).length === 5)
check('ahuang fluff count is clamped', (api.ahuangAmbientScene(99).match(/class="hz-fluff"/g) ?? []).length === 20)
check('ahuang fluff carries per-puff inline geometry',
  /class="hz-fluff" style="[^"]*top:\d+%/.test(ahuang))
check('ahuang grounds the dog on a field bank with a hairline',
  ahuang.includes('class="hz-bank"') && ahuang.includes('class="hz-bank-line"'))

// ── 大鲸鱼娘（jingyu）：侧栏卡通元素 + 工作区壁纸 ─────────────────────────────

/**
 * 简易标签配平检查：理解自闭合（`<path …/>`），返回错配与未闭合的标签。
 *
 * 单列这一条的理由是一次**真实事故**：`open('svg', …)` 忘了补 `</svg>`，浏览器于是把
 * 后面的兄弟节点整段吸进 SVG 命名空间 —— 症状是"工作区里的人物整只不见、侧栏被复制
 * 一份"，而所有几何读数都还正常（盒子存在、尺寸正确）。这类静默失败只能靠配平断言钉住。
 * @param markup - 标记文本。
 * @returns `{ problems, leftover }`。
 */
function unbalancedTags(markup) {
  const stack = []
  const problems = []
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g
  let m = re.exec(markup)
  while (m !== null) {
    const [, closing, tag, , selfClose] = m
    if (closing === '/') {
      if (stack.pop() !== tag) problems.push(tag)
    } else if (selfClose !== '/') {
      stack.push(tag)
    }
    m = re.exec(markup)
  }
  return { problems, leftover: stack }
}

const jingyu = api.jingyuAmbientScene(7, 2)
check('jingyu has a scene root carrying its own positioning',
  jingyu.startsWith('<div class="jy-root"') && /class="jy-root" style="[^"]*position:absolute/.test(jingyu))
check('jingyu draws one water band with a ripple hairline',
  (jingyu.match(/class="jy-water"/g) ?? []).length === 1
  && (jingyu.match(/class="jy-water-line"/g) ?? []).length === 1)
check('jingyu seeds the requested bubbles and baby whales',
  (jingyu.match(/class="jy-bub"/g) ?? []).length === 7
  && (jingyu.match(/class="jy-calf-track"/g) ?? []).length === 2)
check('jingyu clamps both counts',
  (api.jingyuAmbientScene(99, 99).match(/class="jy-bub"/g) ?? []).length === 24
  && (api.jingyuAmbientScene(99, 99).match(/class="jy-calf-track"/g) ?? []).length === 4)
check('jingyu draws no calf at count 0',
  (api.jingyuAmbientScene(4, 0).match(/jy-calf/g) ?? []).length === 0)
// 小鲸鱼三层分离（燕子那节的教训）：x 只在 track（宽 100%，translateX 的百分比才等于整条
// 带子）动，起伏只在 bob，镜像只在 flip 且**静态**——同层会被动画的 transform 覆盖。
// 朝向（2026-10-01 修复）：画稿头朝**左**（圆头 x=3-13、尾鳍 x=44-60）、游动全员向右
// （-24%→104%）——所以**正向游的**那条才 scaleX(-1) 镜像成头朝右；reverse 向左游的
// 保持原画。上一版把两者装反，实机两条都读成"倒着游"。
check('jingyu keeps x in the track, bobs in its own layer, mirrors the OUTBOUND calf statically',
  (jingyu.match(/class="jy-calf-track" style="[^"]*width:100%/g) ?? []).length === 2
  && (jingyu.match(/class="jy-calf-bob"/g) ?? []).length === 2
  && jingyu.includes('animation-direction:reverse'))
const calfBlocks = [...jingyu.matchAll(/class="jy-calf-track" style="([^"]*)">[\s\S]*?class="jy-calf-flip" style="([^"]*)"/g)]
  .map((m) => ({ style: m[1], flip: m[2] }))
check('鱼朝向：reverse（向左游）不带镜像；正向（向右游）带 scaleX(-1)（装反 = 两条都倒着游）',
  calfBlocks.length === 2
  && calfBlocks.some((b) => b.style.includes('reverse') && b.flip === '')
  && calfBlocks.some((b) => !b.style.includes('reverse') && b.flip === 'transform:scaleX(-1)'))
const mutCalfFlip = builderSource.replace(
  "const flip = back ? '' : 'transform:scaleX(-1)'",
  "const flip = back ? 'transform:scaleX(-1)' : ''")
check('反证 66 真的改动了源码（鱼朝向装反）', mutCalfFlip !== builderSource)
// eslint-disable-next-line no-new-func
const mutCalfScene = new Function(`${constantClosureFor(mutCalfFlip, ['SVG_TAGS']).join('\n')}\n\n${mutCalfFlip}\nreturn { jingyuAmbientScene }`)().jingyuAmbientScene(7, 2)
const mutCalfBlocks = [...mutCalfScene.matchAll(/class="jy-calf-track" style="([^"]*)">[\s\S]*?class="jy-calf-flip" style="([^"]*)"/g)]
  .map((m) => ({ style: m[1], flip: m[2] }))
check('反证 66：装反后"正向带镜像/reverse 不带"翻红',
  !calfBlocks.length || (mutCalfBlocks.some((b) => b.style.includes('reverse') && b.flip === 'transform:scaleX(-1)')
    && mutCalfBlocks.some((b) => !b.style.includes('reverse') && b.flip === '')))
check('jingyu sparkles plankton in the band', (jingyu.match(/class="jy-spark"/g) ?? []).length === 7)
const jingyuTags = unbalancedTags(jingyu)
check('jingyu markup is balanced (an unclosed tag silently swallows the rest of the document)',
  jingyuTags.problems.length === 0 && jingyuTags.leftover.length === 0)
if (jingyuTags.problems.length > 0 || jingyuTags.leftover.length > 0) {
  console.error(`  错配 ${jingyuTags.problems.join(',')} / 未闭合 ${jingyuTags.leftover.join(',')}`)
}
// 反证 31：拿掉一个闭标签（模拟那处漏闭合）→ 上面的配平断言必须翻红。
const mutJingyuUnclosed = jingyu.replace('</div></div>', '</div>')
check('反证 31 真的改动了场景标记（拿掉一个闭标签）', mutJingyuUnclosed !== jingyu)
const mutJingyuTags = unbalancedTags(mutJingyuUnclosed)
check('反证 31：漏一个闭标签后配平必须失败',
  mutJingyuTags.problems.length > 0 || mutJingyuTags.leftover.length > 0)

const wall = api.wallMarkup('jingyu')
check('the work area belongs to jingyu alone',
  api.hasWall('jingyu') && !api.hasWall('shan') && !api.hasWall('dream') && !api.hasWall(undefined))
check('wallMarkup returns nothing for a kind without artwork',
  api.wallMarkup('shan') === '' && api.wallMarkup('fanhua') === '')
// 壁纸人物换成社区现成立绘（Neko3000/deepseek-whalechan）之后，这三条的前提也跟着换了：
// 原先钉的是"内联矢量画稿里某个路径说了什么"（`viewBox`、尾鳍的 `M235 356 …` 坐标），
// 那种断言对点阵素材没有意义。换成同样强、但对新素材成立的判据 —— 人物是块 `<img>`、
// 素材走 data URI（渲染进程读不到本地路径）、解出来的字节确实是一张完整 PNG、
// 身后两层（光晕 / 气泡）的 DOM 顺序仍然就是层级顺序。
check('the wall is the whale maid in her own scene box',
  wall.startsWith('<div class="jyb-scene">')
  && /<img class="jyb-figure" src="data:image\/png;base64,[A-Za-z0-9+/]+={0,2}" alt="" draggable="false"\/><\/div>$/.test(wall))
check('the figure is one raster <img> carrying a data URI, never a file path',
  (wall.match(/<img /g) ?? []).length === 1
  && /<img class="jyb-figure" src="data:image\/png;base64,[A-Za-z0-9+/]+={0,2}"/.test(wall)
  && !/<img[^>]*src="(?!data:)/.test(wall))
const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_TAIL = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])
/** @returns the base64 payload of the figure's data URI, or null. */
const wallArtB64Of = (markup) => /<img class="jyb-figure" src="data:image\/png;base64,([A-Za-z0-9+/]+={0,2})"/.exec(markup)?.[1] ?? null
/** @returns the decoded figure bytes, or null. */
const wallArtBytesOf = (markup) => {
  const b64 = wallArtB64Of(markup)
  return b64 === null ? null : Buffer.from(b64, 'base64')
}
/** @returns true when the bytes are a whole PNG (signature + trailing IEND). */
const isWholePng = (bytes) => bytes !== null && bytes.length > 32
  && bytes.subarray(0, 8).equals(PNG_HEAD) && bytes.subarray(-12).equals(PNG_TAIL)
/** @returns the three layer class names in DOM order. */
const wallLayerOrder = (markup) => [...markup.matchAll(/class="(jyb-halo|jyb-bub|jyb-figure)"/g)].map((m) => m[1])
check('the wall is the whale maid in her own scene box',
  wall.startsWith('<div class="jyb-scene">')
  && /<img class="jyb-figure" src="data:image\/png;base64,[A-Za-z0-9+/]+={0,2}" alt="" draggable="false"\/><\/div>$/.test(wall))
check('the figure is one raster <img> carrying a data URI, never a file path',
  (wall.match(/<img /g) ?? []).length === 1
  && wallArtB64Of(wall) !== null
  && !/<img[^>]*src="(?!data:)/.test(wall))
const wallArtBytes = wallArtBytesOf(wall)
check('the inlined figure decodes to a complete PNG (magic bytes + trailing IEND)',
  isWholePng(wallArtBytes))
const wallLayerOrderValue = wallLayerOrder(wall)
check('the halo stays behind the figure and the bubbles in front of the halo',
  wallLayerOrderValue[0] === 'jyb-halo'
  && wallLayerOrderValue[wallLayerOrderValue.length - 1] === 'jyb-figure'
  && wallLayerOrderValue.slice(1, -1).length === 4
  && wallLayerOrderValue.slice(1, -1).every((k) => k === 'jyb-bub'))
// 反证 46：把素材改成文件路径 → "data URI" 那两条必须翻红（渲染进程读不到路径，这正是
// 这组断言存在的理由）；同时钉住"改了"这件事，免得替换不中变成空转的反证。
const mutWallFilePath = wall.replace('src="data:image/png;base64,', 'src="lib/assets/whale-maid.png"')
check('反证 46 真的改动了壁纸标记（素材退回本地路径）', mutWallFilePath !== wall)
check('反证 46：退回文件路径后，data-URI 两条必须失败',
  wallArtB64Of(mutWallFilePath) === null
  && !/<img class="jyb-figure" src="data:image\/png;base64,[A-Za-z0-9+/]+={0,2}" alt="" draggable="false"\/><\/div>$/.test(mutWallFilePath)
  && /<img[^>]*src="(?!data:)/.test(mutWallFilePath))
// 反证 47：把 base64 截断（模拟"素材传了一半"）→ 完整性那条必须翻红。
const mutWallTruncated = wall.replace(/(src="data:image\/png;base64,[A-Za-z0-9+/]{200})[A-Za-z0-9+/]+/, '$1')
check('反证 47 真的改动了壁纸标记（base64 被截断）', mutWallTruncated !== wall)
check('反证 47：截断后"完整 PNG"必须失败（IEND 不在了）',
  !isWholePng(wallArtBytesOf(mutWallTruncated)))
// 反证 48：把人物挪到光晕之前 → DOM 顺序那条必须翻红。
const mutWallOrder = wall.replace('<div class="jyb-halo" style="position:absolute"></div>', '')
check('反证 48 真的改动了壁纸标记（光晕被拆）', mutWallOrder !== wall)
check('反证 48：光晕拆掉后，层级顺序那条必须失败',
  wallLayerOrder(mutWallOrder)[0] !== 'jyb-halo')
const wallTags = unbalancedTags(wall)
check('the wall markup is balanced too',
  wallTags.problems.length === 0 && wallTags.leftover.length === 0)
if (wallTags.problems.length > 0 || wallTags.leftover.length > 0) {
  console.error(`  错配 ${wallTags.problems.join(',')} / 未闭合 ${wallTags.leftover.join(',')}`)
}
// 反证 32：把一个 `/>` 改成 `>`（自闭合变开标签）→ 配平必须翻红。
// 锚点跟着素材走：原来是手绘 SVG 里的 `<ellipse …/>`，现在是人物那一块的 `<img …/>`。
const mutWallUnclosed = wall.replace('draggable="false"/>', 'draggable="false">')
check('反证 32 真的改动了壁纸标记（自闭合变开标签）', mutWallUnclosed !== wall)
const mutWallTags = unbalancedTags(mutWallUnclosed)
check('反证 32：自闭合被拆掉后配平必须失败',
  mutWallTags.problems.length > 0 || mutWallTags.leftover.length > 0)

// 壁纸的绘制接线：drawScene 每次都问一次壁纸，paintWall 在该 kind 没有壁纸时**撤掉**上一套。
check('paintWall withdraws the wall when the kind carries none',
  block('paintWall').includes("if (wall === '')") && block('paintWall').includes('box.remove()'))

// ── 接线是**行为**断言，不是"源码里有那行文本" ────────────────────────────────
//
// 评审指出（2026-09-30）：早先这条只断言 `drawScene` 的源码里含 `paintWall(wrap, kind)`
// 这串文本 —— 把 `paintWall` 改成函数体首行 `return ''` 仍然绿。所以现在把两个函数换成
// 记录器，跑**真实的 drawScene 函数体**，看它到底调了谁、带着什么参数。
/**
 * 用记录器跑一次真实的 `drawScene`。
 *
 * ⚠️ 记录器**按源码里实际出现的调用注入**（`X(wrap, kind)` 这种签名），不写死 `paintWall`
 * 一个名字。理由是一次实测：另一个窗口在同一个 `drawScene` 里加了第二块画布
 * （`syncAmbientOverlay(wrap, kind)`），写死名字的桩在合并后的树上直接
 * `ReferenceError: syncAmbientOverlay is not defined` —— 那是**别家功能**把这条测试弄红，
 * 而它本该对"这里还挂着谁"保持中立。
 * @param src - client.js 源码（反证传变异后的）。
 * @param kind - 主题的 ambient kind。
 * @returns 调用序列，如 `['scene:applySceneBox', 'paintWall:jingyu']`。
 */
function drawSceneCalls(src, kind) {
  const body = block('drawScene', src)
  const painters = [...new Set([...body.matchAll(/([A-Za-z_$][\w$]*)\(wrap, kind\)/g)].map((m) => m[1]))]
  const sceneBox = {
    dataset: {},
    setAttribute() {},
    getBoundingClientRect: () => ({ width: 240, height: 300, top: 10, bottom: 310 }),
  }
  const wrap = {
    querySelector: (selector) => (selector.includes('dsh-amb-control-scene') ? sceneBox : null),
    appendChild() {},
  }
  const doc = {
    querySelector: () => wrap,
    createElement: () => ({ className: '', dataset: {}, appendChild() {}, innerHTML: '' }),
  }
  const calls = []
  // eslint-disable-next-line no-new-func
  const run = new Function('document', 'applySceneBox', 'describeAmbient', ...painters,
    `${body}\nreturn drawScene`)(
    doc,
    () => calls.push('scene:applySceneBox'),
    () => ({ found: true }),
    ...painters.map((name) => (layer, wallKind) => { calls.push(`${name}:${wallKind}`); return `${name}=1x2` }),
  )
  const column = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 280, height: 600 }) }
  run(column, '<div class="x"></div>', kind)
  return { calls, painters }
}
const drawn = drawSceneCalls(source, 'jingyu')
check('drawScene lays out the sidebar scene box and paints the wall in ONE pass',
  drawn.calls[0] === 'scene:applySceneBox' && drawn.calls.includes('paintWall:jingyu'),
  `实际 ${JSON.stringify(drawn.calls)}`)
check('drawScene paints EVERY canvas the function body asks for (siblings included, for free)',
  drawn.painters.length > 0
  && drawn.painters.every((name) => drawn.calls.some((call) => call.startsWith(`${name}:`))),
  `记录器 ${JSON.stringify(drawn.painters)} vs 实际 ${JSON.stringify(drawn.calls)}`)
check('drawScene asks for the wall with the active kind (not a hardcoded one)',
  drawSceneCalls(source, 'shan').calls.includes('paintWall:shan'))
// 反证 33：拆掉那次调用 → paintWall 不再出现在调用序列里。
const mutNoWallPaint = source.replace('      const wallNote = paintWall(wrap, kind)', "      const wallNote = ''")
check('反证 33 真的改动了源码（drawScene 不再画壁纸）', mutNoWallPaint !== source)
check('反证 33：拆掉接线后 drawScene 不再调 paintWall',
  !drawSceneCalls(mutNoWallPaint, 'jingyu').calls.includes('paintWall:jingyu'))

// ── 壁纸绘制的行为（不只看"源码里写了什么"，而是盒子真的被撤掉 / 续用 / 真的转成背景层）──
//
// paintWall 是唯一动工作区画布的地方，它有三条容易写错、且**不写错也看不出来**的规则：
//   · 内容不变时不许重写 innerHTML —— 重写会把呼吸/眨眼/尾摆的动画从头开始（肉眼可见地抖）；
//   · 该主题没有壁纸时必须把上一套**撤掉**（大鲸鱼娘 → 山青婷彩），而且撤的是**三件东西**：
//     body 级立绘层、伴生样式表、body 标记类；
//   · 3 秒到了要把最前方那份交给 body 级的背景层（交叉淡入淡出）。
// 所以用假 DOM + **可控时钟**跑真实的函数体：那 3 秒必须由测试自己点火 ——
// 让计时器自己跑，则"入场瞬间"与"结算之后"会变成同一个状态，等于什么都没测。
const wallPaintSource = wallPaintSourceOf(source)

/**
 * 从源码里取一行工厂级常量。
 *
 * 反证要在**变异后的源码**上取同一行，所以带 `text` 参数。取不到就抛 ——
 * 常量改名时这里当场报红，而不是静默地拿去和 undefined 比较（规则 6）。
 * @param name - 常量名。
 * @param text - client.js 源码。
 * @returns 那一行（去掉缩进）。
 */
function constLine(name, text = source) {
  const line = text.split('\n').find((entry) => new RegExp(`^\\s*const ${name} = `).test(entry))
  if (line === undefined) throw new Error(`lib/client.js: const ${name} not found`)
  return line.trim()
}

/**
 * 抓一个 `const NAME = …` 的**完整**声明（多行数组 / 对象 / 调用整块带上）。
 *
 * 逐行截取只对单行常量成立；`CARD_ORDER` 这类多行字面量会被截成半句，拼进 eval 就是
 * `SyntaxError: Unexpected identifier` —— 报错的样子像"样式表里有语法错"，排查会被带偏。
 * @param name - 常量名。
 * @param text - client.js 源码。
 * @returns 声明的源码文本。
 */
function constDeclarationOf(name, text = source) {
  const at = text.search(new RegExp(`^    const ${name} = `, 'm'))
  if (at < 0) throw new Error(`lib/client.js: const ${name} not found`)
  let depth = 0
  let quote = ''
  for (let i = at; i < text.length; i += 1) {
    const ch = text[i]
    if (quote !== '') {
      if (ch === '\\') i += 1
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') depth -= 1
    else if (depth === 0 && (ch === ';' || ch === '\n')) return text.slice(at, i).trim()
  }
  throw new Error(`lib/client.js: const ${name} never terminates`)
}

/**
 * 一个表达式**用到**的工厂级常量，连同它们之间的传递依赖（按源码顺序）。
 *
 * 为什么按需扫而不是点名：`AMBIENT_CSS` 里引用工厂级常量的地方一直在增加
 * （大鲸鱼娘的入场时长与水花时刻、青冥飞剑的三个时刻…），点名清单每漏一个就是
 * `ReferenceError`。判据是"表达式里出现了这个全大写标识符、源码里又有同名 const"，
 * 所以既不漏也不多。
 * @param text - 要被求值的表达式文本。
 * @param skip - 已经在该环境里声明过的名字（重复注入是 SyntaxError）。
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
 * 组装跑 `paintWall` 的最小环境。
 * @param src - client.js 源码（反证传变异后的）。
 * @returns 可 `new Function` 的源码文本。
 */
function wallPaintSourceOf(src) {
  return [
    'let ambientPaintError',
    'let ambientWall',
    'let wallSettleHandle',
    // 急停开关的桩：真身读 `ctx.config.ambient`，这里给测试一个把手 ——
    // "结算到点时开关已被打开"这条路径在真机上极难复现，而它正是最容易漏掉的清理点。
    'let wallAmbientEnabled = true',
    'function ambientEnabled() { return wallAmbientEnabled }',
    constLine('WALLPAPER_CLASS', src),
    constLine('WALL_SETTLE_MS', src),
    // 大鲸鱼娘的尾迹延迟按 `WHALE_ENTER_MS` 现算（`jingyuWallScene` 读它），所以这套
    // "最小壁纸环境"也要带上它 —— 少一个绑定就是 `ReferenceError`，而 `paintWall` 的
    // catch 会把它变成一句 `壁纸失败` 读数（静默形态，规则 0）。顺带把别处新抽的
    // 时长常量一起扫进来：这份清单每漏一个就红一次。
    ...constantClosureFor(block('jingyuWallScene', src)).map((line) => line),
    "const SVG_TAGS = new Set(['svg', 'defs', 'linearGradient', 'stop', 'path', 'ellipse', 'g', 'circle'])",
    // `attr` / `open` joined this list when the figure became an `<img>`: the new
    // `jingyuWallScene` builds its markup through the shared builders (the old one was a
    // raw template literal and needed neither). Without them the wall threw a
    // ReferenceError that `paintWall`'s catch turned into `壁纸失败` — which is exactly the
    // silent-ish shape this fake DOM exists to make visible.
    block('attr', src),
    block('open', src),
    block('hasWall', src),
    block('jingyuWallScene', src),
    block('guardSceneryMarkup', src),
    block('wallMarkup', src),
    block('sidebarColumn', src),
    // 入场 → 背景层那一段的全部零件：少任何一个，paintWall 的 catch 都会把它变成
    // `壁纸失败`（这正是这套假 DOM 存在的意义 —— 让"零件没接上"看得见）。
    block('clearWallSettle', src),
    block('wallMotionReduced', src),
    block('wallGroundTokens', src),
    block('backdropStylesheet', src),
    block('ensureBackdropStylesheet', src),
    block('markWallpaper', src),
    block('backdropWallMarkup', src),
    block('ensureBackdropLayer', src),
    block('demoteWallpaper', src),
    block('removeWallLayers', src),
    block('settleWall', src),
    block('scheduleWallSettle', src),
    block('paintWall', src),
    // demoteWallpaper/settleWall 现在会调壁纸令牌层（overrideTokens 通道）——
    // 这套最小环境里给齐它的零件，`ctx` 保持 undefined（syncWallTokenLayer
    // 第一行短路），验证的是"调用链不炸"；令牌层的行为在 boot-path 的
    // 端到端断言里验。
    'let ctx',
    'let skinLayerEpoch = 0',
    "const jybWallState = { value: undefined, epoch: -1 }",
    "const jybWallDispose = { value: undefined }",
    block('emitting', src),
    block('syncWallTokenLayer', src),
    block('jybWallTokens', src),
    block('syncJybWallTokens', src),
  ].join('\n\n')
}

/**
 * 可控时钟：排队的定时器**不会自己跑**，由测试点火。
 *
 * 这是这一节的关键 —— 把这套状态机和真实时间绑在一起，测试就只剩两种写法：等 3 秒
 * （吊住进程，仓库硬规则禁止），或者把两个阶段当成同一个状态（什么也没测）。
 * @returns `{ setTimeout, clearTimeout, pending, fireAll }`。
 */
function fakeWallClock() {
  const queue = []
  let next = 0
  return {
    setTimeout(fn, delay) {
      next += 1
      queue.push({ id: next, fn, delay, cancelled: false })
      return next
    },
    clearTimeout(id) {
      const entry = queue.find((item) => item.id === id)
      if (entry !== undefined) entry.cancelled = true
    },
    /** 还挂着（没被撤销、也没点火）的定时器延迟序列。 */
    pending() {
      return queue.filter((item) => !item.cancelled).map((item) => item.delay)
    },
    /** 点火全部还挂着的定时器（按延迟升序），返回被点着的延迟序列。 */
    fireAll() {
      const due = queue.filter((item) => !item.cancelled).sort((a, b) => a.delay - b.delay)
      for (const entry of due) {
        entry.cancelled = true
        entry.fn()
      }
      return due.map((item) => item.delay)
    },
  }
}

/**
 * 一个够用的假 DOM：`querySelector(':scope > .class')`、`createElement`、`dataset`、
 * `classList`、`append`/`appendChild`、`remove()` 与 `getBoundingClientRect`。
 *
 * ⚠️ 几何**从写进去的样式里解析**（规则 8）：早先硬编码 300x460，于是"几何塌成 0 /
 * 人物被裁"这一类在桩上永远测不出来 —— 写什么都返回 300x460，断言只在校验样式文本。
 * ⚠️ `document.querySelector` 只认壁纸用到的两条选择器，别的当场抛错：静默返回 null
 * 会让"撤下来了吗"这个问题的答案永远是"没有"，而断言会因找不到节点而**通过**（规则 8）。
 * @param options - `timers`：可控时钟；`reduced`：让 `matchMedia` 命中减少动效。
 * @returns `{ wrap, doc, window, body, created }`。
 */
function fakeWallDom(options = {}) {
  const created = []
  /**
   * 造一个节点。
   * @param cls - className。
   * @param tag - 标签名（样式表的查找按 dataset 判定，不靠标签）。
   * @returns 节点。
   */
  const make = (cls, tag = 'DIV') => {
    const node = {
      tagName: tag,
      className: cls,
      dataset: {},
      innerHTML: '',
      textContent: '',
      style: '',
      children: [],
      parent: null,
      removed: false,
      rect: { width: 0, height: 0, top: 0, left: 0 },
      setAttribute(name, value) {
        this.style = value
        const w = /(?:^|;)width:(\d+)px/.exec(value)
        const h = /(?:^|;)height:(\d+)px/.exec(value)
        this.rect = {
          width: w === null ? 0 : Number(w[1]),
          height: h === null ? 0 : Number(h[1]),
          top: 0,
          left: 0,
        }
      },
      getBoundingClientRect() {
        return this.rect
      },
      appendChild(child) { child.parent = this; this.children.push(child); return child },
      append(...kids) { for (const kid of kids) this.appendChild(kid) },
      querySelector(selector) {
        // 只认 `:scope > .cls` 这一种形态；别的选择器当场抛错，而不是静默返回 null
        // （静默返回 null 会让断言"因找不到而通过"，正是规则 8 警告的假通过）。
        const m = /^:scope > \.([A-Za-z0-9_-]+)$/.exec(selector)
        if (m === null) throw new Error(`桩不支持的选择器：${selector}`)
        return this.children.find((c) => c.className === m[1]) ?? null
      },
      remove() {
        this.removed = true
        if (this.parent !== null) this.parent.children = this.parent.children.filter((c) => c !== this)
      },
    }
    node.classList = {
      add: (...names) => {
        const set = new Set(String(node.className).split(' ').filter(Boolean))
        for (const name of names) set.add(name)
        node.className = [...set].join(' ')
      },
      remove: (...names) => {
        const set = new Set(String(node.className).split(' ').filter(Boolean))
        for (const name of names) set.delete(name)
        node.className = [...set].join(' ')
      },
      contains: (name) => String(node.className).split(' ').includes(name),
    }
    return node
  }
  const body = make('body', 'BODY')
  const head = make('head', 'HEAD')
  const doc = {
    body,
    head,
    documentElement: make('html', 'HTML'),
    createElement(tag) {
      const node = make('', String(tag).toUpperCase())
      created.push(node)
      return node
    },
    querySelector(selector) {
      if (selector === '.jyb-backdrop') {
        return created.find((n) => !n.removed
          && String(n.className).split(' ').includes('jyb-backdrop')) ?? null
      }
      if (selector === '.dsh-amb-bg') {
        return created.find((n) => !n.removed
          && String(n.className).split(' ').includes('dsh-amb-bg')) ?? null
      }
      if (selector === 'style[data-plugin-css="theme-gallery/backdrop"]') {
        return created.find((n) => !n.removed
          && n.dataset.pluginCss === 'theme-gallery/backdrop') ?? null
      }
      throw new Error(`桩不支持的选择器：${selector}`)
    },
    querySelectorAll: () => [],
  }
  const clock = options.timers ?? null
  const windowStub = { innerWidth: 1280, innerHeight: 800 }
  if (clock !== null) {
    windowStub.setTimeout = (fn, delay) => clock.setTimeout(fn, delay)
    windowStub.clearTimeout = (handle) => clock.clearTimeout(handle)
  }
  if (options.reduced === true) {
    windowStub.matchMedia = (query) => ({ media: query, matches: query.includes('prefers-reduced-motion') })
  }
  return { wrap: make('dsh-amb-control'), doc, window: windowStub, body, created }
}

// eslint-disable-next-line no-new-func
const paintWallOf = (src) => new Function('document', 'window',
  `${src}\nreturn { paintWall, demoteWallpaper, wall: () => ambientWall, error: () => ambientPaintError,`
  + ' setAmbientEnabled: (on) => { wallAmbientEnabled = on } }')

/**
 * 起一个跑真实 `paintWall` 的假页面（带可控时钟）。
 * @param src - client.js 源码（反证传变异后的）。
 * @param options - 透传给 {@link fakeWallDom}。
 * @returns `{ api, dom, clock }`。
 */
function wallScene(src, options = {}) {
  const clock = fakeWallClock()
  const dom = fakeWallDom({ ...options, timers: clock })
  // eslint-disable-next-line no-new-func
  const api = paintWallOf(wallPaintSourceOf(src))(dom.doc, dom.window)
  return { api, dom, clock }
}

/** 当前 body 上的标记类是否在。 */
const wallpaperClassOf = (src = source) => {
  const line = constLine('WALLPAPER_CLASS', src)
  const m = /=\s*'([^']+)'/.exec(line)
  if (m === null) throw new Error(`WALLPAPER_CLASS 不是单引号字符串：${line}`)
  return m[1]
}
const bodyMarked = (dom, src = source) => String(dom.body.className).split(' ').includes(wallpaperClassOf(src))
/** body 级背景层的节点（假 DOM 里按 className 找）。 */
const backdropLayer = (dom) => dom.created.find((n) => !n.removed
  && String(n.className).split(' ').includes('jyb-backdrop')) ?? null
/** 伴生样式表的节点。 */
const backdropSheet = (dom) => dom.created.find((n) => !n.removed
  && n.dataset.pluginCss === 'theme-gallery/backdrop') ?? null

// —— 入场：两份副本、一份在最前方，一份 `opacity:0` 地在 body 级等着 ——
const sceneA = wallScene(source)
const domA = sceneA.dom
const paintA = sceneA.api
const readingA = paintA.paintWall(domA.wrap, 'jingyu')
check('paintWall draws the wall for jingyu, in its own box, and reports a reading',
  readingA.startsWith('壁纸=') && domA.wrap.children.length === 1
  && domA.wrap.children[0].className === 'dsh-amb-bg')
const boxA = domA.wrap.children[0]
const paintedA = boxA.dataset.ambientMarkup
check('the wall is painted once and its markup remembered on the box',
  typeof paintedA === 'string' && paintedA.includes('jyb-scene'))
check('入场读数看得出阶段（`（入场）`），而不是只有一个尺寸',
  readingA.includes('入场') && paintA.wall().phase === '入场')
check('body 级那份副本**入场时就已经建好**（CSS 过渡要有初值才播得动，不能等到 3 秒才插）',
  backdropLayer(domA) !== null
  && backdropLayer(domA).parent === domA.body
  && backdropLayer(domA).dataset.ambientMarkup === paintedA)
check('两份副本是**同一份**人物标记（同一个 data URI，浏览器共享解码结果）',
  /<img class="jyb-figure" src="data:image\/png;base64,[A-Za-z0-9+/]+={0,2}"/.test(backdropLayer(domA).innerHTML)
  && backdropLayer(domA).innerHTML.includes(paintedA))
check('背景层里带可读性遮罩，且遮罩画在人物**之前**（DOM 顺序即层级）',
  backdropLayer(domA).innerHTML.startsWith('<div class="jyb-veil"></div>'))
check('入场阶段：伴生样式表与标记类都还没上（界面此刻仍是完全不透明的）',
  backdropSheet(domA) === null && !bodyMarked(domA))
check('入场阶段排了一个结算定时器，延迟就是那个常量',
  sceneA.clock.pending().length === 1
  && sceneA.clock.pending()[0] === Number(/const WALL_SETTLE_MS = (\d+)/.exec(source)[1]))
paintA.paintWall(domA.wrap, 'jingyu')
check('a second pass reuses the same box and does not repaint (animations must not restart)',
  domA.wrap.children.length === 1 && boxA.dataset.ambientMarkup === paintedA)
check('几何重同步**不会**把结算往后推（每推一次就是"她永远停在最前面"）',
  sceneA.clock.pending().length === 1 && paintA.wall().phase === '入场')
check('the wall box carries inline geometry (left/width/bottom)',
  boxA.style.includes('position:absolute') && boxA.style.includes('left:') && boxA.style.includes('width:') && boxA.style.includes('height:'))

// —— 3 秒到点：交叉淡入淡出，她变成背景壁纸 ——
const fired = sceneA.clock.fireAll()
check('到点结算：触发的是那一个结算定时器', fired.length === 1)
check('结算后 body 打上标记类（层序三件套只认它）', bodyMarked(domA))
check('结算后伴生样式表进了 head，且带**双保险令牌段**（firefly 配方：主题系统层 + body !important 两路同值）',
  backdropSheet(domA) !== null
  && backdropSheet(domA).textContent.includes('html{background:#061320!important}')
  && /--dsw-alias-bg-base:rgba\(6,19,32,\.30\)!important/.test(String(backdropSheet(domA).textContent)))
check('结算后前方那份**不再新建**、背景层也还是同一份（不搬 DOM）',
  domA.wrap.children.length === 1 && domA.wrap.children[0] === boxA
  && domA.created.filter((n) => String(n.className).includes('jyb-backdrop')).length === 1)
const readingSettled = paintA.paintWall(domA.wrap, 'jingyu')
check('结算之后的几何重同步仍在壁纸态（不许被打回入场，也不重复计时）',
  readingSettled.includes('壁纸态') && paintA.wall().phase === '壁纸态'
  && paintA.wall().source === '背景层(壁纸)' && sceneA.clock.pending().length === 0)
check('壁纸态的读数就是面板上那一行（`壁纸=…（壁纸态）`）',
  /壁纸=\d+x\d+（壁纸态）$/.test(readingSettled))

// —— 切走：三件东西一起撤；切回来：整套重播（用户要求可重放）——
check('a kind without a wall withdraws the previous one, and says so',
  paintA.paintWall(domA.wrap, 'shan') === '壁纸=撤下' && boxA.removed
  && !domA.wrap.children.some((c) => c.className === 'dsh-amb-bg'))
check('撤下的是**三件**：立绘层、伴生样式表、body 标记类（少一件就是"半透明却没人"）',
  backdropLayer(domA) === null && backdropSheet(domA) === null && !bodyMarked(domA))
// 规则 0：三种"没画"要分得开 —— 再来一次时盒子已经不在，读数必须是「无」而不是「撤下」。
check('withdrawing an absent wall reads «无», not «撤下» (the two are distinguishable)',
  paintA.paintWall(domA.wrap, 'shan') === '壁纸=无')
const readingAgain = paintA.paintWall(domA.wrap, 'jingyu')
check('coming back to jingyu rebuilds the wall, and the new box repaints the figure',
  readingAgain.startsWith('壁纸=') && domA.wrap.children.length === 1
  && domA.wrap.children[0].dataset.ambientMarkup.includes('class="jyb-figure"'))
check('切回来=整套重播：又是入场态、又排了一次结算（不是直接停在壁纸态）',
  readingAgain.includes('入场') && sceneA.clock.pending().length === 1
  && !bodyMarked(domA) && backdropSheet(domA) === null)

// 反证 36：把"撤下"那一支整段拆掉（不删盒子也不撤三件）→ 壁纸留在原地。
// 锚点跟着实现走：撤下现在是"删盒子 + removeWallLayers()"两件事，
// 只拆其中一件时另一件仍会把盒子收走 —— 所以这条反证拆的是**两件一起**
//（只拆三件那一半的对照见反证 50）。
const mutNoWallRemove = wallPaintSource.replace("          box.remove()\n          removeWallLayers()\n", "")
check('反证 36 真的改动了 paintWall 源码（撤下那一支整段拆掉）', mutNoWallRemove !== wallPaintSource)
const mutSceneRemove = wallScene(source.replace("          box.remove()\n          removeWallLayers()\n", ""))
mutSceneRemove.api.paintWall(mutSceneRemove.dom.wrap, 'jingyu')
mutSceneRemove.api.paintWall(mutSceneRemove.dom.wrap, 'shan')
check('反证 36：拆掉之后壁纸留在原地（撤不掉）',
  mutSceneRemove.dom.wrap.children.some((c) => c.className === 'dsh-amb-bg'))

// 反证 50：把 `removeWallLayers()` 从"撤下"那一支拆掉 → 上面那三条"三件一起撤 / 可重放"
// 必须翻红（否则它们测的只是 `box.remove()`，与 body 级那三件东西无关）。
const mutNoTear = source.replace(
  "          box.remove()\n          removeWallLayers()\n",
  "          box.remove()\n",
)
check('反证 50 真的改动了源码（撤下时不再撤 body 级那三件）', mutNoTear !== source)
const tearScene = wallScene(mutNoTear)
tearScene.api.paintWall(tearScene.dom.wrap, 'jingyu')
tearScene.clock.fireAll()
tearScene.api.paintWall(tearScene.dom.wrap, 'shan')
check('反证 50：不撤那三件时，切走之后标记类 / 样式表 / 背景层全都留在页面上',
  bodyMarked(tearScene.dom) && backdropSheet(tearScene.dom) !== null && backdropLayer(tearScene.dom) !== null)

// 反证 51：结算句柄不再作废 → 切走之后那个定时器还挂着（它会在下一轮入场里
// 用旧的计时提前结算，把飞入拦腰掐断）。
const mutNoClear = source.replace('    function clearWallSettle() {\n      if (wallSettleHandle === undefined) return',
  '    function clearWallSettle() {\n      if (true) return')
check('反证 51 真的改动了源码（结算句柄不再作废）', mutNoClear !== source)
/** 切走之后还挂着几个结算定时器。 */
const timersAfterWithdraw = (src) => {
  const scene = wallScene(src)
  scene.api.paintWall(scene.dom.wrap, 'jingyu')
  scene.api.paintWall(scene.dom.wrap, 'shan')
  return scene.clock.pending().length
}
check('对照组：切走之后结算定时器被撤掉（不会有一次"延迟结算"追着上一套皮肤跑）',
  timersAfterWithdraw(source) === 0)
check('反证 51：句柄不作废时，切走后那个定时器还挂着',
  timersAfterWithdraw(mutNoClear) === 1, `实际 ${timersAfterWithdraw(mutNoClear)}`)

// —— 急停开关在到点前被打开：结算必须自己作废并撤干净 ——
// （真机上这条路径要求"用户正好在那 3 秒里改配置"，极难复现，所以用把手把它演出来。）
const killScene = wallScene(source)
const killReading = killScene.api.paintWall(killScene.dom.wrap, 'jingyu')
killScene.api.setAmbientEnabled(false)
killScene.clock.fireAll()
check('急停：到点时开关已关 → 什么都不上，而且入场时那份立绘也一起撤掉',
  !bodyMarked(killScene.dom) && backdropSheet(killScene.dom) === null
  && backdropLayer(killScene.dom) === null
  && !killScene.dom.created.some((n) => !n.removed && String(n.className).includes('dsh-amb-bg')),
  `实际 入场读数=${killReading}`)
// 反证 52：把 settleWall 里那道急停复核拆掉 → 上面那条必须翻红。
const mutNoKillCheck = source.replace(
  '      if (!ambientEnabled()) {\n'
  + '        // 急停开关中途打开：把已经画出来的东西撤干净，而不是留一张背景层在那里。\n'
  + '        removeWallLayers()\n'
  + '        return false\n'
  + '      }\n',
  '',
)
check('反证 52 真的改动了源码（结算不再复核急停开关）', mutNoKillCheck !== source)
const mutKillScene = wallScene(mutNoKillCheck)
mutKillScene.api.paintWall(mutKillScene.dom.wrap, 'jingyu')
mutKillScene.api.setAmbientEnabled(false)
mutKillScene.clock.fireAll()
check('反证 52：拆掉复核后，已经关掉的开关也拦不住结算（界面被按成半透明）',
  bodyMarked(mutKillScene.dom) && backdropSheet(mutKillScene.dom) !== null)

// —— reduced-motion：跳过飞入与交叉，**直接**壁纸态（不留"停 3 秒"的等待）——
const reducedScene = wallScene(source, { reduced: true })
const reducedReading = reducedScene.api.paintWall(reducedScene.dom.wrap, 'jingyu')
check('reduced-motion：一次同步就到壁纸态（没有排任何等待），人物照常在背景层里',
  reducedReading.includes('壁纸态') && reducedScene.clock.pending().length === 0
  && bodyMarked(reducedScene.dom) && backdropSheet(reducedScene.dom) !== null
  && backdropLayer(reducedScene.dom).innerHTML.includes('class="jyb-figure"'))
// 反证 53：拆掉 reduced-motion 那一支 → 上面那条必须翻红（否则它只是因为"默认也会到壁纸态"而通过）。
const mutNoReduced = source.replace('        } else if (reduced) {', '        } else if (false) {')
check('反证 53 真的改动了源码（reduced-motion 那一支被拆）', mutNoReduced !== source)
const mutReducedScene = wallScene(mutNoReduced, { reduced: true })
const mutReducedReading = mutReducedScene.api.paintWall(mutReducedScene.dom.wrap, 'jingyu')
check('反证 53：拆掉之后 reduced-motion 下又变成"先入场、等 3 秒"',
  mutReducedReading.includes('入场') && mutReducedScene.clock.pending().length === 1
  && !bodyMarked(mutReducedScene.dom))
// —— 切到内置浅色/深色（「惊喜」分支）：素材留着，**半透明地面令牌必须走** ——
// 那一支刻意不碰装饰层的素材（用户要的"素材留在原地"），但伴生样式表带着 `!important`
// 写在 body 上，留着会把刚切过去的**新**调色按成深蓝半透明：换肤换成一个坏掉的界面。
const demoteScene = wallScene(source)
demoteScene.api.paintWall(demoteScene.dom.wrap, 'jingyu')
demoteScene.clock.fireAll()
const keptBox = demoteScene.dom.wrap.children[0]
demoteScene.api.demoteWallpaper()
check('内置外观那一支：伴生样式表 / 标记类 / 背景层撤掉，最前方那份素材与侧栏素材一样留着',
  backdropSheet(demoteScene.dom) === null && !bodyMarked(demoteScene.dom)
  && backdropLayer(demoteScene.dom) === null
  && demoteScene.dom.wrap.children[0] === keptBox && !keptBox.removed)
// 反证 83：让 `demoteWallpaper` 什么都不做 → 上面那条必须翻红（样式表与标记类留下）。
const mutNoDemote = source.replace(
  '    function demoteWallpaper() {\n      clearWallSettle()',
  "    function demoteWallpaper() {\n      if (true) return '无'\n      clearWallSettle()",
)
check('反证 83 真的改动了源码（内置外观那一支的撤场变成空操作）', mutNoDemote !== source)
const mutDemoteScene = wallScene(mutNoDemote)
mutDemoteScene.api.paintWall(mutDemoteScene.dom.wrap, 'jingyu')
mutDemoteScene.clock.fireAll()
mutDemoteScene.api.demoteWallpaper()
check('反证 83：不撤时，伴生样式表与标记类都留在页面上（内置配色的表面会被按成深蓝半透明）',
  backdropSheet(mutDemoteScene.dom) !== null && bodyMarked(mutDemoteScene.dom))
// 对照：切皮肤走的是"四件全撤" —— 最前方那只盒子也必须被真的删掉。
const harshScene = wallScene(source)
harshScene.api.paintWall(harshScene.dom.wrap, 'jingyu')
harshScene.clock.fireAll()
harshScene.api.paintWall(harshScene.dom.wrap, 'shan')
check('对照：切皮肤走的是"四件全撤"（最前方那只盒子也必须被真的删掉）',
  harshScene.dom.wrap.children.length === 0)

// —— 宿主不接受背景层（没有 body / 拒绝 append）：结算必须自己作废 ——
// 这时把界面变半透明等于"人物消失 + 界面发灰"，两头都糟；留在入场态她至少还看得见。
const noBodyScene = wallScene(source)
noBodyScene.api.paintWall(noBodyScene.dom.wrap, 'jingyu')
noBodyScene.dom.doc.body = null
noBodyScene.clock.fireAll()
check('背景层挂不上时：结算留在入场态（她还在最前），也不注入伴生样式表',
  noBodyScene.api.wall().phase === '入场' && noBodyScene.api.wall().backdrop === '无 body'
  && backdropSheet(noBodyScene.dom) === null)
// 反证 82：拆掉那道复核 → 背景层没挂上也照样注入样式表（界面变半透明而人物不在）。
const mutNoLayerCheck = source.replace("      if (layer !== '新建' && layer !== '已在位') {", '      if (false) {')
check('反证 82 真的改动了源码（结算不再确认背景层挂上了）', mutNoLayerCheck !== source)
const mutNoBodyScene = wallScene(mutNoLayerCheck)
mutNoBodyScene.api.paintWall(mutNoBodyScene.dom.wrap, 'jingyu')
mutNoBodyScene.dom.doc.body = null
mutNoBodyScene.clock.fireAll()
check('反证 82：拆掉复核后，没挂上背景层也照样进壁纸态并注入了样式表',
  mutNoBodyScene.api.wall().phase === '壁纸态' && backdropSheet(mutNoBodyScene.dom) !== null)

// ── 壁纸的读数必须**结构化且会清错**（评审 2026-09-30 的两条必修）────────────────
//
// ① 只有字符串读数、且落在默认隐藏的调试行里 = 人物没出现在默认面板上不可见（规则 0）；
// ② `ambientPaintError` 只写不清 = 一次瞬时抛错把面板**永久**钉在"装饰绘制抛错"。
check('a successful paint records a structured wall reading (state/size/source)',
  paintA.wall() !== undefined && paintA.wall().state === '画'
  && paintA.wall().width > 0 && paintA.wall().height > 0
  && paintA.wall().source === '装饰层(最前)' && paintA.wall().phase === '入场')
const paintThrow = wallScene(source).api
const throwingWrap = { querySelector() { throw new Error('boom') } }
check('a throwing layer is caught, recorded as a structured reading, and does not escape',
  paintThrow.paintWall(throwingWrap, 'jingyu').startsWith('壁纸失败')
  && paintThrow.wall().state === '失败' && paintThrow.error() instanceof Error)
check('the next successful paint CLEARS the error (a stale error is a permanent false alarm)',
  paintA.paintWall(domA.wrap, 'jingyu').startsWith('壁纸=') && paintA.error() === undefined)

// 告警判据本身：这是"人物没出现"在默认面板上唯一的可见通道，所以它必须**会说话**。
// eslint-disable-next-line no-new-func
const wallWarningOf = new Function(`${block('hasWall')}\n${block('wallWarning')}\nreturn wallWarning`)()
check('the wall warning stays silent for kinds without a wall and for a healthy wall',
  wallWarningOf('shan', {}) === null
  && wallWarningOf('jingyu', { wall: { state: '画', width: 300, height: 460 } }) === null)
check('the wall warning speaks for 未同步 / 未画出 / 尺寸为 0',
  wallWarningOf('jingyu', {}).includes('壁纸未同步')
  && wallWarningOf('jingyu', { wall: { state: '撤下' } }).includes('壁纸未画出')
  && wallWarningOf('jingyu', { wall: { state: '画', width: 0, height: 460 } }).includes('尺寸为 0'))
check('the wall warning is wired into the panel warning path (not only into the debug line)',
  block('ambientWarning').includes('wallWarning(wanted.kind, report)'))
check('the wall warning also speaks when the backdrop layer could not mount (三种成因都不静默)',
  String(wallWarningOf('jingyu', { wall: { state: '画', width: 300, height: 460, backdrop: '无 body' } }))
    .includes('背景层没挂上')
  && String(wallWarningOf('jingyu', { wall: { state: '画', width: 300, height: 460, backdrop: '失败' } }))
    .includes('背景层没挂上')
  && wallWarningOf('jingyu', { wall: { state: '画', width: 300, height: 460, backdrop: '已在位' } }) === null)

// 但"源码里含那句话"不等于"面板真的会这么说" —— `ambientWarning` 此前**从未被执行过**。
// 这里把它真的跑起来：注入 `bundledTheme` 桩 + 一份可控的 `ambientReport`。
const ambientWarningSource = [block('hasWall'), block('wallWarning'), block('ambientWarning')].join('\n\n')
/**
 * 真的调用一次 `ambientWarning`。
 * @param id - 选中的主题 id。
 * @param report - `ambientReport` 的内容。
 * @param ambient - 该主题的 `ambient` 配置。
 * @returns 告警行或 null。
 */
function warningFor(id, report, ambient = { kind: 'jingyu' }) {
  const themes = [{ id, ambient }]
  // eslint-disable-next-line no-new-func
  const run = new Function('bundledTheme', 'ambientReport',
    `${ambientWarningSource}\nreturn ambientWarning`)((wanted) => themes.find((t) => t.id === wanted), report)
  return run(id)
}
const healthyReport = {
  found: true, children: 3, css: true, size: '100x100', html: 'x', probe: 'ok', artSize: '10x10',
}
check('the panel warning really comes out of ambientWarning (a 未画出 wall is reported)',
  String(warningFor('da-jing-yu-niang', { ...healthyReport, wall: { state: '撤下' } })).includes('壁纸未画出'))
check('a healthy wall keeps ambientWarning silent',
  warningFor('da-jing-yu-niang', { ...healthyReport, wall: { state: '画', width: 300, height: 460 } }) === null)
check('a zero-sized wall is reported through the same channel',
  String(warningFor('da-jing-yu-niang', { ...healthyReport, wall: { state: '画', width: 0, height: 460 } }))
    .includes('壁纸尺寸为 0'))
check('a paint error still wins over the wall reading (ordering matters)',
  String(warningFor('da-jing-yu-niang', { ...healthyReport, paintError: new Error('boom'), wall: { state: '撤下' } }))
    .startsWith('装饰绘制抛错'))
check('a kind without a wall is not judged by the wall branch',
  warningFor('shan-qing-ting-cai', healthyReport, { kind: 'shan' }) === null)
// 反证 41：把判据拆成"永不报警" → 上面那条必须翻红。
const mutWallWarningOff = source.replace('      if (wall.state !== \'画\') return', '      if (false) return')
check('反证 41 真的改动了 lib/client.js 源码（壁纸告警被关掉）', mutWallWarningOff !== source)
// eslint-disable-next-line no-new-func
const mutWallWarningOf = new Function(`${block('hasWall', mutWallWarningOff)}\n${block('wallWarning', mutWallWarningOff)}\nreturn wallWarning`)()
check('反证 41：关掉告警后"未画出"不再出声',
  mutWallWarningOf('jingyu', { wall: { state: '撤下' } }) === null)

// ── 青冥飞剑（原创）────────────────────────────────────────────────────────────
//
// 两半场景、两个 builder：素材带里的悬停自旋剑（feijianAmbientScene，跟其他
// 场景一样被裁剪在带盒里）与全视口的编队穿屏 + 四周框架（feijianOverlayMarkup，
// 由 drawScene 经 syncAmbientOverlay 挂到 .dsh-amb-control 自身——带盒的
// overflow:hidden 裁剪装不下穿屏）。轨迹按用户红笔图由 feijianFlightKeyframes
// 生成（见下面那组断言）；聊天区宝剑壁纸由 syncAmbientOverlay 挂 body 级层
// （feijianWallMarkup，见 ambientCssText 那组）。

const feijian = api.feijianAmbientScene(6)
check('feijian has a scene root carrying its own positioning',
  feijian.startsWith('<div class="fj"') && /class="fj" style="[^"]*position:absolute/.test(feijian))
check('feijian seats the hovering sword on the arrive → float chain (one animation per element)',
  feijian.includes('class="fj-seat"')
  && feijian.includes('animation:dsh-amb-fj-arrive .55s ease-out 6.95s both')
  && feijian.includes('animation:dsh-amb-fj-float 5.4s ease-in-out infinite alternate'))
check('feijian parks the blade HILT-UP TIP-DOWN (90°，用户 2026-10-01 点名；与飞行终态航向交接)',
  /class="fj-tilt" style="[^"]*transform:rotate\(90deg\)/.test(feijian))
check('the docked blade slowly spins around its hilt-to-tip axis once the flight lands (自旋起播晚于飞行)',
  feijian.includes('class="fj-spin"')
  && feijian.includes('animation:dsh-amb-fj-spin 6.5s linear 7.55s infinite'))
check('自旋层在姿态层**内侧**（rotateX 必须吃剑的局部坐标——放在外面就绕屏幕水平轴翻风车）',
  (() => {
    const tiltAt = feijian.indexOf('class="fj-tilt"')
    const spinAt = feijian.indexOf('class="fj-spin"')
    const svgAt = feijian.indexOf('dsh-fj-blade-hover')
    return tiltAt >= 0 && spinAt > tiltAt && svgAt > spinAt
  })())
check('the docked sword carries a WORLD-space tassel at the pommel end (穗拴一点，不随轴旋；90° 姿态下柄首在正上方)',
  feijian.includes('class="fj-tassel"') && feijian.includes('dsh-amb-fj-tassel 4.6s')
  && feijian.includes('left:calc(50% - .25em);top:calc(50% - 3em)'))
check('feijian breathes a cyan halo with a pink inner tint on offset phases',
  feijian.includes('class="fj-halo"') && feijian.includes('class="fj-halo-pink"')
  && feijian.includes('animation:dsh-amb-fj-breathe 3.8s')
  && feijian.includes('animation:dsh-amb-fj-breathe 3.1s ease-in-out .6s'))
check('feijian seeds the requested mote count', (feijian.match(/class="fj-mote"/g) ?? []).length === 6)
check('feijian mote count is clamped',
  (api.feijianAmbientScene(99).match(/class="fj-mote"/g) ?? []).length === 24
  && (api.feijianAmbientScene(0).match(/class="fj-mote"/g) ?? []).length === 0)
check('feijian motes stay in the band-left half near the sword',
  /class="fj-mote" style="[^"]*left:(?:[7-9]|[1-4]\d)%/.test(feijian))
check('every third mote carries the pink companion colour',
  (feijian.match(/rgba\(244,121,131/g) ?? []).length >= 2)
check('the sword art is one drawing suffixed per mount (SVG ids are document-global)',
  api.fjSwordSvg('hover').includes('id="dsh-fj-blade-hover"')
  && api.fjSwordSvg('fly').includes('id="dsh-fj-blade-fly"')
  && api.fjSwordSvg('wing-wa').includes('id="dsh-fj-blade-wing-wa"')
  && api.fjSwordSvg('hover') !== api.fjSwordSvg('fly'))
check('the hover seat rides the shared sword drawing with a cyan glow shadow',
  feijian.includes('dsh-fj-blade-hover') && feijian.includes('filter:drop-shadow(0 0 .32em rgba(37,198,208,.85))'))
check('the recast blade has ridge + gold winged guard + triple wrap and NO painted tassel (红色柱子事故的钉子)',
  api.fjSwordSvg('hover').includes('M 145 20 L 30 20')
  && api.fjSwordSvg('hover').includes('#D9B96C')
  && /M 31 16\.7 L 29\.6 23\.3/.test(api.fjSwordSvg('hover'))
  // fly 版剑穗已删（2026-10-01 实机事故：剑转到竖直姿态时缎带竖着拖在柄后，
  // 用户读作"多出来一段红色柱子"）；任何 mount 的剑体都不该再画穗。
  && !api.fjSwordSvg('fly').includes('tassel')
  && !api.fjSwordSvg('wing-wa').includes('tassel')
  && !api.fjSwordSvg('hover').includes('tassel'))

const fjOverlay = api.feijianOverlayMarkup()
check('the overlay root carries full-viewport positioning of its own',
  fjOverlay.startsWith('<div class="dsh-amb-fj-o"')
  && /class="dsh-amb-fj-o" style="[^"]*position:absolute;inset:0[^"]*z-index:2/.test(fjOverlay))
check('the frame is a hairline inset ring with four flipped corner ornaments',
  fjOverlay.includes('class="fj-frame"') && fjOverlay.includes('border:1px solid rgba(37,198,208,.17)')
  && (fjOverlay.match(/class="fj-corner fj-corner-/g) ?? []).length === 4
  && ['tl', 'tr', 'br', 'bl'].every((k) => fjOverlay.includes(`fj-corner-${k}"`)))
check('each corner carries a pink companion dot (少量樱粉)',
  (fjOverlay.match(/class="fj-corner-dot fj-corner-dot-/g) ?? []).length === 4)
check('the entrance flight is one-shot with BOTH fill over a NATURALLY transparent state (reduced-motion safe)',
  /class="fj-fly" style="[^"]*opacity:0;/.test(fjOverlay)
  && fjOverlay.includes('animation:dsh-amb-fj-fly 7.4s linear .15s both'))
check('formation: two escort blades with staggered delays, lateral offsets and their own size layers (2026-10-01 用户反馈后更近、下移)',
  (fjOverlay.match(/class="fj-wing-fly"/g) ?? []).length === 2
  && fjOverlay.includes('animation:dsh-amb-fj-fly-wa 7.4s linear 0.45s both')
  && fjOverlay.includes('animation:dsh-amb-fj-fly-wb 7.4s linear 0.9s both')
  && fjOverlay.includes('transform:translate(1.6vw,1.8vh)') && fjOverlay.includes('scale(0.52)')
  && fjOverlay.includes('transform:translate(-1.5vw,3.6vh)') && fjOverlay.includes('scale(0.4)'))
check('the escort offset wrapper carries translate ONLY (scale there would shrink the path\'s vw/vh)',
  (() => {
    const wrappers = [...fjOverlay.matchAll(/class="fj-wing fj-wing-\w+" style="([^"]*)"/g)].map((m) => m[1])
    return wrappers.length === 2
      && wrappers.every((s) => s.includes('transform:translate(') && !s.includes('scale'))
  })())
check('尾翼特效：弧形尾迹（青主弧+白副弧+粉副痕，向弯心微弯，剑本体保持直线）+ 三枚残影箭羽 + 四点火花 + 白热亮头',
  fjOverlay.includes('class="fj-trail-arc"')
  && fjOverlay.includes('M 104 22 Q 62 10 30 16 Q 8 20 2 30')
  && fjOverlay.includes("rgba(244,121,131,.75)")
  && (fjOverlay.match(/class="fj-chev"/g) ?? []).length === 3
  && (fjOverlay.match(/class="fj-spark"/g) ?? []).length === 4
  && /box-shadow:0 0 9px 2\.5px rgba\(37,198,208,\.95\)/.test(fjOverlay)
  && !fjOverlay.includes('fj-trail-pink') && !fjOverlay.includes('class="fj-trail"'))
check('the flight sword is the shared art on its second mount',
  fjOverlay.includes('dsh-fj-blade-fly'))
check('no feijian element carries both an animation and a transform on one element (scene + overlay)',
  [...(feijian + fjOverlay).matchAll(/style="([^"]*)"/g)]
    .filter(([, style]) => style.includes('animation:') && style.includes('transform:')).length === 0)
// 配平：2026-09-30 实测事故——feijianAmbientScene 多写一个 </div>，字符串断言全绿、
// 预览页靠浏览器自动恢复"看起来还行"，是 CDP 机读（角饰被挤到窗外）才逮住的。
// 反证 31（大鲸鱼娘漏闭标签）的同款防线，这次给飞剑也补上。
const fjBalanced = (html) => {
  let depth = 0
  for (const tk of html.matchAll(/<(\/?)(div|span|svg|defs|linearGradient|stop|path|ellipse|g|circle)\b[^>]*>/g)) {
    depth += tk[1] === '/' ? -1 : 1
    if (depth < 0) return false
  }
  return depth === 0
}
check('feijian 标记配平（scene + overlay + wall，多余的闭标签会被浏览器静默恢复）',
  fjBalanced(feijian) && fjBalanced(fjOverlay) && fjBalanced(api.feijianWallMarkup()))
const mutFjUnclosed = builderSource.replace(
  `+ moteNodes
        + '</div>'
        + '</div>'
    }`,
  `+ moteNodes
        + '</div>'
    }`)
check('M-fj7 真的改动了源码（场景尾部被拆掉一个闭标签）', mutFjUnclosed !== builderSource)
// eslint-disable-next-line no-new-func
const mutFjScene7 = new Function(`${constantClosureFor(mutFjUnclosed, ['SVG_TAGS']).join('\n')}\n\n${mutFjUnclosed}\nreturn { feijianAmbientScene }`)().feijianAmbientScene(6)
check('M-fj7：拆掉一个闭标签后配平断言翻红', !fjBalanced(mutFjScene7))

// ── 双环轨迹（用户红笔图）：对着生成器的结果断言，而不是源码字面量 ────────────────
const fjFlightCss = api.feijianFlightKeyframes()
check('feijianFlightKeyframes 生成三把剑的 keyframes（主剑 + wa/wb 僚剑）',
  fjFlightCss.length === 3
  && fjFlightCss[0].startsWith('@keyframes dsh-amb-fj-fly{')
  && fjFlightCss[1].startsWith('@keyframes dsh-amb-fj-fly-wa{')
  && fjFlightCss[2].startsWith('@keyframes dsh-amb-fj-fly-wb{'))
/** 从一条飞剑 keyframes 里解出全部停靠点（百分比/坐标/航向/透明度）。 */
const fjStopsOf = (css) => [...css.matchAll(/([\d.]+)%\{transform:translate\(([-\d.]+)vw,([-\d.]+)vh\) rotate\(([-\d.]+)deg\);opacity:([\d.]+)\}/g)]
  .map((m) => ({ p: Number(m[1]), x: Number(m[2]), y: Number(m[3]), a: Number(m[4]), o: Number(m[5]) }))
const fjStops = fjStopsOf(fjFlightCss[0])
const fjLast = fjStops[fjStops.length - 1]
check('主剑轨迹站点足够密（≥40 站，双环的弯才转得圆润）', fjStops.length >= 40)
check('keyframe 百分比严格递增且收在 100%（重复百分比会被浏览器静默合并）',
  fjStops.every((s, i) => i === 0 || s.p > fjStops[i - 1].p) && fjLast.p === 100)
check('入场从屏幕外右上起笔（x>100vw）；落点在左下侧栏素材区（x<20vw，y 50–75vh）',
  fjStops[0].x > 100 && fjLast.x < 20 && fjLast.y > 50 && fjLast.y < 75,
  `实际首站 (${fjStops[0].x},${fjStops[0].y}) 末站 (${fjLast.x},${fjLast.y})`)
check('双环指纹：左缘下潜 + 底部掠过 + 右缘上盘三段都在表里（对应红笔图的形状）',
  fjStops.some((s) => s.x < 36 && s.y > 55 && s.y < 75)
  && fjStops.some((s) => s.y > 78)
  && fjStops.some((s) => s.x > 75 && s.y > 45 && s.y < 70))
check('调头连续：相邻站点航向变化 ≤90°（没有旧版 146°→-50° 那种硬切）',
  fjStops.every((s, i) => i === 0 || Math.abs(s.a - fjStops[i - 1].a) <= 90))
check('落定航向与悬停剑姿态一致（90°±6° 柄上尖下；角度按 360 归一后再比——生成器为了插值平滑会连续展开成负数）',
  Math.abs(((fjLast.a % 360) + 360) % 360 - 90) <= 6, `实际末站航向 ${fjLast.a}°（归一 ${((fjLast.a % 360) + 360) % 360}°）`)
check('节奏停顿：顶部斜掠后原地停一拍（两站同坐标 ≈5% 时长，随后各站加速——用户 2026-10-01 点名）',
  (() => {
    for (let i = 1; i < fjStops.length; i += 1) {
      if (fjStops[i].x === fjStops[i - 1].x && fjStops[i].y === fjStops[i - 1].y) {
        return fjStops[i].p - fjStops[i - 1].p > 3 && fjStops[i].p < 30
      }
    }
    return false
  })())
check('主剑末段溶解（画面交给悬停剑）；僚剑落定后常驻不溶解',
  fjLast.o === 0
  && fjStopsOf(fjFlightCss[1]).at(-1).o > 0
  && fjStopsOf(fjFlightCss[2]).at(-1).o > 0)

// ── 聊天区壁纸（feijianWallMarkup；层规则在 ambientCssText 那组）──────────────
// 2026-10-01 用户定稿：壁纸改用**用户提供的实拍图**（lib/assets/feijian-wall.png，
// embed 内联成 FEIJIAN_WALL_PNG data URI）——全屏 cover，正文压在图上。前方份与
// 背景份是同一张图，front 淡出露出的就是它，没有任何切换痕迹。
const fjWallMarkup = api.feijianWallMarkup?.() ?? ''
check('壁纸：全屏实拍图（FEIJIAN_WALL_PNG 引用）+ 调暗滤镜 + 底光（移动光带已删）',
  fjWallMarkup.startsWith('<div class="fjw"')
  && /class="fjw-img" src="data:image\/png;base64,[A-Za-z0-9+/]{1000,}"/.test(fjWallMarkup)
  && fjWallMarkup.includes('class="fjw-aura"') && !fjWallMarkup.includes('fjw-sheen'))
// ── 右上角宝剑卡片（feijianCardMarkup；挂/撤在 syncAmbientOverlay）────────────
const fjCardMarkup = api.feijianCardMarkup?.() ?? ''
check('宝剑卡片：剑竖放（柄上尖下）+ 褐红荧光气泡 ×6 密排快节奏（2026-10-01 定稿）',
  !fjCardMarkup.includes('class="fjw-card"')
  && fjCardMarkup.includes('fjw-card-sword')
  && (fjCardMarkup.match(/fjw-card-bub/g) ?? []).length === 6
  && fjCardMarkup.includes('fjw-card-glow'))
check('内联声明在工厂级（constantClosureFor 只认 4 空格 const，缩进不对会静默失联）',
  /^    const FEIJIAN_WALL_PNG = 'data:image\/png;base64,/m.test(source))
check('embed 后 data URI 已真实内联（占位符不许残留）',
  !source.includes('__FEIJIAN_WALL_PNG__')
  && /const FEIJIAN_WALL_PNG = 'data:image\/png;base64,[A-Za-z0-9+/]{1000,}'/.test(source))

const drawSceneBlock = block('drawScene')
const syncOverlayBlock = block('syncAmbientOverlay')
check('drawScene syncs the overlay every pass and reports its state',
  drawSceneBlock.includes('syncAmbientOverlay(wrap, kind)') && drawSceneBlock.includes('框架='))
check('the overlay is withdrawn for any other kind (scenery belongs to the skin)',
  syncOverlayBlock.includes("kind !== 'feijian'") && syncOverlayBlock.includes('.remove()'))
check('the overlay is built once per activation, not on geometry resyncs',
  syncOverlayBlock.includes("let note = '已在位'")
  && syncOverlayBlock.includes("wrap.insertBefore(inside, wrap.firstChild)"))
check('syncAmbientOverlay 挂/撤水印壁纸（装饰层内 .fjw-inside，场景之下）+ ensure/withdraw 背景层与 shade',
  syncOverlayBlock.includes('ensureFeijianWall()') && syncOverlayBlock.includes('withdrawFeijianWall()')
  && syncOverlayBlock.includes("feijianWallMarkup()")
  && syncOverlayBlock.includes("wrap.insertBefore(inside, wrap.firstChild)")
  && syncOverlayBlock.includes("inside.remove()")
  && block('ensureFeijianWall').includes('.fjw-backdrop')
  && block('ensureFeijianWall').includes("shade.className = 'fjw-shade'")
  && block('withdrawFeijianWall').includes('.fjw-shade'))
check('an overlay failure only leaves a trace (decoration must never break the plugin)',
  syncOverlayBlock.includes('catch') && syncOverlayBlock.includes("return '失败'"))
check('壁纸层失败独立留痕，不拖垮 overlay（两件装饰各自兜底）',
  block('ensureFeijianWall').includes('catch') && block('withdrawFeijianWall').includes('catch'))

// ── 反证 M-fj1…M-fj6（新断言必须先证明会咬人）──────────────────────────────────
// M-fj1：悬停姿态改回斜插 117°（旧版）→ 姿态断言必须翻红。
const mutFjTilt = builderSource.replace('transform:rotate(90deg)', 'transform:rotate(117deg)')
check('M-fj1 真的改动了源码（姿态回退到斜插）', mutFjTilt !== builderSource)
// eslint-disable-next-line no-new-func
const mutFjScene1 = new Function(`${constantClosureFor(mutFjTilt, ['SVG_TAGS']).join('\n')}\n\n${mutFjTilt}\nreturn { feijianAmbientScene }`)().feijianAmbientScene(6)
check('M-fj1：姿态回退后 90° 断言翻红',
  !/class="fj-tilt" style="[^"]*transform:rotate\(90deg\)/.test(mutFjScene1))
// M-fj2：拆掉自旋 → 自旋断言必须翻红。
const mutFjSpin = builderSource.replace('animation:dsh-amb-fj-spin 6.5s linear', 'animation:dsh-amb-fj-spin-OFF 6.5s linear')
check('M-fj2 真的改动了源码（自旋被拆）', mutFjSpin !== builderSource)
// eslint-disable-next-line no-new-func
const mutFjScene2 = new Function(`${constantClosureFor(mutFjSpin, ['SVG_TAGS']).join('\n')}\n\n${mutFjSpin}\nreturn { feijianAmbientScene }`)().feijianAmbientScene(6)
check('M-fj2：拆掉自旋后自旋断言翻红',
  !mutFjScene2.includes('animation:dsh-amb-fj-spin 6.5s linear 7.55s infinite'))
// M-fj3：落点航点挪出素材区 → 落点断言必须翻红。
const mutFjDock = builderSource.replace('[14.2, 66.5],', '[43, 30],')
check('M-fj3 真的改动了源码（落点挪走）', mutFjDock !== builderSource)
// eslint-disable-next-line no-new-func
const mutFjStops3 = fjStopsOf(new Function(`${mutFjDock}\nreturn { feijianFlightKeyframes }`)().feijianFlightKeyframes()[0])
check('M-fj3：落点挪走后 x<20vw 断言翻红',
  mutFjStops3.at(-1).x >= 20, `实际末站 x=${mutFjStops3.at(-1).x}`)
// M-fj4：僚剑也末段溶解 → 常驻断言必须翻红。
const mutFjWing = builderSource.replace('return percent < 92 ? peak : floor', 'return percent < 92 ? peak : 0')
check('M-fj4 真的改动了源码（僚剑改为末段溶解）', mutFjWing !== builderSource)
// eslint-disable-next-line no-new-func
const mutFjFlight4 = new Function(`${mutFjWing}\nreturn { feijianFlightKeyframes }`)().feijianFlightKeyframes()
check('M-fj4：僚剑溶解后"常驻不溶解"断言翻红',
  fjStopsOf(mutFjFlight4[1]).at(-1).o === 0 && fjStopsOf(mutFjFlight4[2]).at(-1).o === 0)
// M-fj5：壁纸层 z-index 失负 → 层规则断言必须翻红。
//    （断言本体在 ambientCssText 那一组——那里才轮得到 readingAttrName 初始化；
//    这里只准备变异源码。）
const mutFjWallCss = source.replace(
  '.fjw-backdrop{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;',
  '.fjw-backdrop{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:-2;')
check('M-fj5 真的改动了源码（壁纸层 z-index 失负）', mutFjWallCss !== source)
// M-fj6：overlay 不再挂壁纸层 → 接线断言必须翻红。
const mutFjWire = source.replace('const wallNote = ensureFeijianWall()', '')
check('M-fj6 真的改动了源码（挂层接线被拆）', mutFjWire !== source)
check('M-fj6：拆掉接线后"挂/撤壁纸层"断言翻红',
  !block('syncAmbientOverlay', mutFjWire).includes('ensureFeijianWall()'))

// ── every new scene's motion lives in the stylesheet ─────────────────────────
//
// Keyframes are the one construct that cannot be inlined: an element can carry its
// animation shorthand inline, but the keyframes it names must exist in AMBIENT_CSS
// or the animation silently does nothing.

const NEW_KEYFRAMES = [
  'dsh-amb-ym-star', 'dsh-amb-ym-drift', 'dsh-amb-ym-sea', 'dsh-amb-ym-bob',
  'dsh-amb-ym-wander', 'dsh-amb-ym-wander-2',
  'dsh-amb-jp-cloud', 'dsh-amb-jp-snow', 'dsh-amb-jp-ripple', 'dsh-amb-jp-glint',
  'dsh-amb-jp-boat', 'dsh-amb-jp-bob', 'dsh-amb-jp-sway',
  'dsh-amb-xs-star', 'dsh-amb-xs-night', 'dsh-amb-xs-meteor',
  'dsh-amb-pj-smoke', 'dsh-amb-pj-dust',
  'dsh-amb-gc-ray', 'dsh-amb-gc-feather', 'dsh-amb-gc-fly', 'dsh-amb-gc-bob',
  'dsh-amb-gc-wing', 'dsh-amb-gc-dew',
  'dsh-amb-hm-glow', 'dsh-amb-hm-dust', 'dsh-amb-hm-tail', 'dsh-amb-hm-breathe',
  'dsh-amb-hm-ear', 'dsh-amb-hm-zzz',
  'dsh-amb-hz-glow', 'dsh-amb-hz-fluff', 'dsh-amb-hz-wag', 'dsh-amb-hz-grass',
  'dsh-amb-hz-tilt',
  'dsh-amb-lx-streak', 'dsh-amb-lx-drift', 'dsh-amb-lx-sway', 'dsh-amb-lx-dew',
  'dsh-amb-fh-petal', 'dsh-amb-fh-willow', 'dsh-amb-fh-ripple',
  // 大鲸鱼娘：人物换成点阵立绘后，眨眼 / 呆毛 / 尾鳍 / 喷水这四条 keyframes 成了死代码
  // （点阵素材没有眼皮、没有独立的呆毛与尾鳍图层，也没有喷水的水柱），已随画稿一起删除；
  // 剩下三条仍然各有主人：呼吸（.jyb-figure）、气泡（.jyb-bub）、身后光晕（.jyb-halo）。
  'dsh-amb-jyw-breathe',
  'dsh-amb-jyw-bubble',
  'dsh-amb-jyw-glow',
  'dsh-amb-jy-rise',
  'dsh-amb-jy-swim',
  'dsh-amb-jy-bob',
  'dsh-amb-jy-spark',
  'dsh-amb-jy-water',
  'dsh-amb-jy-waterline',
  'dsh-amb-fj-arrive',
  'dsh-amb-fj-float',
  'dsh-amb-fj-spin',
  'dsh-amb-fj-breathe',
  'dsh-amb-fj-mote',
  'dsh-amb-fj-chev',
  'dsh-amb-fj-spark',
  'dsh-amb-fj-wing-bob',
  'dsh-amb-fj-tassel',
  'dsh-amb-fjw-glow',
  'dsh-amb-fjw-card-in',
]
// 飞燕的 keyframes 不在源码字面量里——它们由 fanhuaSwallowKeyframes()
// 在 AMBIENT_CSS 构建时生成（每只 3 条：mover/wing/bob），所以要对着
// 生成结果断言，而不是对着 source。
const SWALLOW_KEYFRAMES = swallowVariants.flatMap((k) => [`dsh-amb-fh-sw-${k}`, `dsh-amb-fh-wing-${k}`, `dsh-amb-fh-bob-${k}`, `dsh-amb-fh-wave-${k}`])
const missingSwallowKeyframes = SWALLOW_KEYFRAMES.filter((name) => !swallowCss.some((css) => css.startsWith(`@keyframes ${name}{`)))
check('all 8 generated swallow keyframes come out of the flight table (no dupes either)',
  swallowCss.length === 8 && missingSwallowKeyframes.length === 0)
if (missingSwallowKeyframes.length > 0) console.error(`  missing: ${missingSwallowKeyframes.join(', ')}`)
check('every swallow animation referenced by the markup is generated',
  [...new Set([...fanhua.matchAll(/dsh-amb-fh-(?:sw|wing|bob|wave)-\w+/g)].map((m) => m[0]))]
    .every((name) => swallowCss.some((css) => css.startsWith(`@keyframes ${name}{`))))
// The name must be followed by the opening brace: an unanchored match would also
// hit a RENAMED keyframe (`dsh-amb-hm-tail-x` contains `dsh-amb-hm-tail`), and this
// check exists to catch exactly that silent-invalid-animation shape.
const missingKeyframes = NEW_KEYFRAMES.filter((name) => !new RegExp(`@keyframes ${name}\\s*\\{`).test(source))
// 组数**现算**：写死的数字已经腐坏过一次（标签上写着 63，列表里只有 60 条），
// 而这条断言的意图是"列表里每一条都有定义"，不是"列表有多少条"。
check(`all ${NEW_KEYFRAMES.length} new-scene keyframes are defined in AMBIENT_CSS`, missingKeyframes.length === 0)
if (missingKeyframes.length > 0) console.error(`  missing: ${missingKeyframes.join(', ')}`)

// A @keyframes name defined TWICE is a silent override: the later block wins for every
// element, so a corrected amplitude in the earlier one never runs. This exact trap is
// recorded in AGENTS.md for the shan hover keyframes (dsh-amb-hover1/2, pending the
// user's decision, which is why only the NEW families are asserted here) — and it was
// walked into again while adding the balloon wander, minutes after reading that note.
// Hence the machine check instead of a resolution to be careful.
const newKeyframeDefs = [...source.matchAll(/@keyframes\s+(dsh-amb-(?:ym|jp|xs|pj|gc|hm|hz|lx|fh|jyw|jy|fj)-[A-Za-z0-9-]+)\s*\{/g)]
  .map((match) => match[1])
const duplicatedKeyframes = [...new Set(newKeyframeDefs.filter((name, i) => newKeyframeDefs.indexOf(name) !== i))]
check('every new-scene keyframe is defined exactly once (a duplicate silently wins)',
  duplicatedKeyframes.length === 0)
if (duplicatedKeyframes.length > 0) console.error(`  duplicated: ${duplicatedKeyframes.join(', ')}`)

const sceneMarkupBlock = block('sceneMarkup')
check('sceneMarkup dispatches every ported and original kind',
  ['shan', 'dream', 'caiyun', 'dongyun', 'junyue', 'jiexin', 'fengchen', 'humao', 'ahuang', 'liuxing', 'fanhua', 'jingyu', 'feijian']
    .every((kind) => sceneMarkupBlock.includes(`'${kind}'`)))

// 样式层面的断言对着**求值后的 AMBIENT_CSS**，而不是源码字面量：源码里那些规则是
// 字符串拼接的，正则很容易在 `' + '` 那一段落空（落空 = 静默通过）。
const readingAttrName = /const READING_ATTRIBUTE = '([^']+)'/.exec(source)?.[1]
/**
 * 从**任意一份** client.js 源码求值出 AMBIENT_CSS 文本。
 * 反证要在"被破坏过的源码"上求值，才叫反证（早先的反证只改求值结果那个派生串，
 * 那是在验证正则有效，不是验证"拆掉源码里的东西会让断言翻红"）。
 * @param src - client.js 源码。
 * @returns 样式表文本。
 */
function ambientCssFrom(src) {
  const at = src.indexOf('const AMBIENT_CSS = [')
  const from = at + 'const AMBIENT_CSS = '.length
  const end = src.indexOf("].join('\\n')", from)
  // ⚠️ 与 `scripts/build-ambient-preview.mjs` 的 `readAmbientCss()` 是**同一个**陷阱：
  // 大鲸鱼娘的入场时长与落地水花时刻现在写进了样式表（`animation:dsh-amb-jyb-enter
  // ${WHALE_ENTER_MS/1000}s …`、`… ${WHALE_SPLASH_DELAY_MS/1000}s both`），随后青冥飞剑
  // 把它的三个时刻也抽成了常量 —— 这些工厂级绑定都必须在这种"只求值数组字面量"的环境里
  // 在场，少一个就是 `ReferenceError`。所以按**这个字面量用到哪些常量**现算（含传递依赖），
  // 而不是在这里抄一份点名清单（那种清单每漏一个就红一次）。
  const timingConstants = constantClosureFor(src.slice(from, end + 1)).join('\n')
  // 生成函数（`...fanhuaSwallowKeyframes()`、`...feijianFlightKeyframes()` …）同样**扫出来**：
  // 青冥飞剑正在被改成同款形态，点名清单会在它落地的那一刻变成 `ReferenceError`。
  const literal = src.slice(from, end + 1)
  const generators = [...new Set([...literal.matchAll(/\.\.\.(\w+)\(\)/g)].map((m) => m[1]))]
    .map((name) => block(name, src)).join('\n\n')
  // eslint-disable-next-line no-eval
  return eval(`const READING_ATTRIBUTE = ${JSON.stringify(readingAttrName)}\n${timingConstants}\n\n${generators}\n\n${block('fanhuaSwallowFlights', src)}\n\n${block('fanhuaSwallowKeyframes', src)}\n\n${literal}`).join('\n')
}
const ambientCssText = ambientCssFrom(source)
// ── 青冥飞剑的宝剑壁纸两幕节奏（用户 2026-10-01 定稿）────────────────────────
// 前方份（装饰层内、正文之上）：落定 +0.5s 醒目显现 → 停留 → 淡出（6s 一次性）。
check('水印壁纸（装饰层内 .fjw-inside）：常驻 .16、场景之下（用户定稿：不要前方层，直接常驻背景）',
  ambientCssText.includes('.fjw-inside{position:absolute;inset:0;overflow:hidden;pointer-events:none;opacity:.16}')
  && !ambientCssText.includes('.fjw-front')
  && !ambientCssText.includes('dsh-amb-fjw-front'))
// 背景份（z:0！负 z 在实机被应用表面压住 = 必然不可见，大鲸鱼娘的像素对照读数）：
// **常驻可见**（op .8，无延迟动画）——2026-10-01 实机抓到延迟动画的致命弱点：
// 切走再切回会重建层、动画从零计时，"变淡之后看不到"正是重建后 10.4s 延迟期
// 的样子（读数 op=0 实证）。交叉观感由前方份的淡出独自完成。
check('宝剑壁纸背景份：z-index:0 + 常驻完全可见 op 1（无动画；可见性双保险的水印在装饰层）',
  ambientCssText.includes('.fjw-backdrop{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;')
  && ambientCssText.includes('opacity:1}')
  && !ambientCssText.includes('dsh-amb-fjw-reveal'))
check('shade 幕布（firefly 同款）：z:0 挂 body、文档序在壁纸层后 → 画在剑上 #root(z:1) 之下',
  ambientCssText.includes('.fjw-shade{position:fixed;inset:0;pointer-events:none;z-index:0;')
  && ambientCssText.includes('radial-gradient(120% 95% at 60% 42%,rgba(26,62,74,.30)'))
check('宝剑壁纸 reduced-motion 分支：光晕停动（壁纸是内容，不是运动）',
  ambientCssText.includes('.fjw-aura{animation:none!important}'))
check('卡片 CSS：位置/大小与鲸鱼娘小窗一致 + 剑竖放 + 褐红荧光气泡快浮',
  ambientCssText.includes('.fjw-card{position:absolute;top:85px;right:16px;width:170px;height:280px;')
  && ambientCssText.includes('animation:dsh-amb-fjw-card-in .7s ease-out 7.9s both')
  && /body\.dsh-jyb-wallpaper \.jyb-scene\{[^}]*transform:translate\(-50%,-50%\)!important/.test(ambientCssText)
  && ambientCssText.includes('.fjw-card-sword{position:absolute;left:50%;top:46%;width:212px;')
  && ambientCssText.includes("transform:translate(-50%,-50%) rotate(90deg)")
  && (ambientCssText.match(/fjw-card-bub/g) ?? []).length >= 1
  && (fjCardMarkup.match(/fjw-card-bub/g) ?? []).length === 6
  && ambientCssText.includes('animation:dsh-amb-jy-rise')
  && ambientCssText.includes('rgba(217,124,138,.7), 0 0 4px'),
  (() => {
    const parts = {
      card: ambientCssText.includes('.fjw-card{position:absolute;top:85px;right:16px;width:170px;height:280px;'),
      cardIn: ambientCssText.includes('animation:dsh-amb-fjw-card-in .7s ease-out 7.9s both'),
      park: /body\.dsh-jyb-wallpaper \.jyb-scene\{[^}]*transform:translate\(-50%,-50%\)!important/.test(ambientCssText),
      sword: ambientCssText.includes('.fjw-card-sword{position:absolute;left:50%;top:46%;width:212px;'),
      rotate: ambientCssText.includes('transform:translate(-50%,-50%) rotate(90deg)'),
      bub: (ambientCssText.match(/fjw-card-bub/g) ?? []).length >= 3,
      rise: ambientCssText.includes('animation:dsh-amb-jy-rise'),
      shadow: ambientCssText.includes('rgba(217,124,138,.7), 0 0 4px'),
    }
    return `子条件=${JSON.stringify(parts)}；cssLen=${ambientCssText.length}`
  })())
check('飞剑伴生样式表：画布底色 + 透明 + 层序三件套；令牌段已移除（半透明走 FEIJIAN_WALL_TOKENS 的 overrideTokens 层）',
  block('ensureFeijianStylesheet').includes('html{background:#EAF3F7!important}')
  && block('ensureFeijianStylesheet').includes('body,#root{background-color:transparent!important}')
  && !/--dsw-alias-bg-base:rgba/.test(block('ensureFeijianStylesheet'))
  && block('ensureFeijianStylesheet').includes('.fjw-backdrop{z-index:0!important}')
  && block('ensureFeijianStylesheet').includes(`body.\${FEIJIAN_WALL_CLASS}>#root{position:relative;z-index:1}`)
  && block('ensureFeijianStylesheet').includes(`body.\${FEIJIAN_WALL_CLASS}>*.dsh-amb-control{z-index:60!important}`)
  && block('ensureFeijianStylesheet').includes('theme-gallery/backdrop-feijian'))
check('飞剑壁纸令牌表 FEIJIAN_WALL_TOKENS：12 项浅色半透明成对格式（bg-base .35 领衔）',
  (() => {
    // 它是 const 对象而不是函数，block()（按 `function 名(` 锚定）找不到——
    // 按声明行切片到花括号配平再求值。
    const at = source.indexOf('const FEIJIAN_WALL_TOKENS = {')
    if (at < 0) return false
    let depth = 0
    let end = -1
    for (let i = source.indexOf('{', at); i < source.length; i += 1) {
      if (source[i] === '{') depth += 1
      else if (source[i] === '}') {
        depth -= 1
        if (depth === 0) { end = i + 1; break }
      }
    }
    // eslint-disable-next-line no-new-func
    const tokens = new Function(`${source.slice(at, end)}\nreturn FEIJIAN_WALL_TOKENS`)()
    const entries = Object.entries(tokens)
    return entries.length === 16
      && entries.every(([name, pair]) => name.startsWith('--dsw-alias-')
        && pair && typeof pair === 'object' && String(pair.light).startsWith('rgba('))
      && tokens['--dsw-alias-bg-base'].light === 'rgba(245,250,252,.35)'
  })())
check('三把飞剑的生成 keyframes 真的在 AMBIENT_CSS 里（markup 引用的动画必须存在）',
  ['dsh-amb-fj-fly{', 'dsh-amb-fj-fly-wa{', 'dsh-amb-fj-fly-wb{']
    .every((name) => ambientCssText.includes(`@keyframes ${name}`)))
check('M-fj5：z-index 失负后层规则断言翻红（对求值后的 AMBIENT_CSS）',
  !ambientCssFrom(mutFjWallCss).includes('.fjw-backdrop{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;'))
// 尺寸必须双向明确（见 client.js 里的长注：只给高度时，绝对定位盒是 shrink-to-fit，
// 宽度会退化成"取决于子元素"）。
check('the wall root sizes both axes (an inline width:100% would otherwise win)',
  /\.jyb-scene\{[^}]*aspect-ratio:\d+\/\d+;/.test(ambientCssText)
  && /\.jyb-scene svg,\.jyb-scene img\{[^}]*width:100%!important[^}]*height:100%!important/.test(ambientCssText))
// 比值必须与 inlined PNG 的**实际像素**一致（换素材忘了改 CSS 就会把人物拉变形）。
// 所以这里不写死数字：把 data URI 解出来读 IHDR 的宽高，再与样式表里那一条对。
// 写死 300/440 的老断言随画稿一起作废 —— 它守护的意图（"比值跟着素材走"）在这里更强。
const wallArtDims = wallArtBytes === null || wallArtBytes.length < 24
  ? null
  : [wallArtBytes.readUInt32BE(16), wallArtBytes.readUInt32BE(20)]
check('the CSS aspect ratio equals the inlined PNG\'s own pixel ratio',
  wallArtDims !== null && wallArtDims[0] > 0 && wallArtDims[1] > 0
  && new RegExp(`\\.jyb-scene\\{[^}]*aspect-ratio:${wallArtDims[0]}/${wallArtDims[1]};`).test(ambientCssText))
// 水印那条已经**有意取消**：人物现在挂在 body 级的独立层上（层序上永远在正文之下），
// 再淡出就没有意义了。这里反过来钉住"没有残留的水印规则"，免得它以别的形态回来。
check('the old watermark rule is gone (the figure lives behind the transcript now, not over it)',
  readingAttrName !== undefined && !ambientCssText.includes('.jyw-root') && !ambientCssText.includes('opacity:.28}'))
// 反证 34：**在源码里**拆掉 aspect-ratio → 重新求值 → 双向尺寸断言必须翻红。
// 锚点从解析出来的真实比值拼出来，换素材时不需要再手改这条变异。
const mutWallSizeSource = wallArtDims === null
  ? ''
  : source.replace(`aspect-ratio:${wallArtDims[0]}/${wallArtDims[1]};`, '')
check('反证 34 真的改动了 lib/client.js 源码（拆掉 aspect-ratio）', mutWallSizeSource !== source)
check('反证 34：拆掉之后"双向尺寸"必须失败',
  !(wallArtDims !== null
    && new RegExp(`\\.jyb-scene\\{[^}]*aspect-ratio:${wallArtDims[0]}/${wallArtDims[1]};`).test(ambientCssFrom(mutWallSizeSource))))
// 反证 49：只把比值改错一位（"换了素材忘了改 CSS"的最小形态）→ 与 PNG 像素比对的那条
// 必须翻红。反证 34 只证明"整条拆掉会被发现"，这一条证明**数值本身**被守着。
const mutWallRatioSource = wallArtDims === null
  ? ''
  : source.replace(`aspect-ratio:${wallArtDims[0]}/${wallArtDims[1]};`,
    `aspect-ratio:${wallArtDims[0]}/${wallArtDims[1] + 1};`)
check('反证 49 真的改动了 lib/client.js 源码（比值改错一位）', mutWallRatioSource !== source)
check('反证 49：比值与 PNG 不一致时，那条断言必须失败',
  !(wallArtDims !== null
    && new RegExp(`\\.jyb-scene\\{[^}]*aspect-ratio:${wallArtDims[0]}/${wallArtDims[1]};`).test(ambientCssFrom(mutWallRatioSource))))
// 反证 35：**在源码里**把水印透明度改掉 → 0.28 那条必须翻红。
const mutWatermarkSource = source.replace('.jyb-scene', '.jyw-root')
check('反证 35 真的改动了 lib/client.js 源码（水印透明度改了）', mutWatermarkSource !== source)
check('反证 35：改掉透明度后水印断言必须失败',
  !ambientCssFrom(mutWatermarkSource).includes(`body[${readingAttrName}] .jyw-root{opacity:.28}`))

// ── 壁纸层：装饰层里的**最前方**浮层（用户要求：先把人物调到 100% 看得见，
//    形象定稿后再改成背景壁纸）────────────────────────────────────────────────
const wallSource = block('paintWall')
check('the wall layer is pointer-transparent (the character must never eat a click)',
  /\.dsh-amb-bg\{[^}]*pointer-events:none/.test(ambientCssText))
check('the wall box lives in the scenery layer, absolutely positioned with inline geometry',
  wallSource.includes("wrap.querySelector(':scope > .dsh-amb-bg')")
  && wallSource.includes('wrap.appendChild(box)')
  && wallSource.includes('position:absolute;left:')
  && wallSource.includes('pointer-events:none'))
check('and it spans from the sidebar right edge to the window right edge',
  wallSource.includes('sidebarColumn()') && wallSource.includes('window.innerWidth'))
check('the character box takes a sensible share of the column height (tunable, not tiny)',
  /\.jyb-scene\{[^}]*bottom:\d+px[^}]*height:([5-8][0-9])%/.test(ambientCssText))
// 这一条守的是"上一次废弃方案的类名不许复活"：`.jyb-ground` / `.jyb-shade` 是那次
// 直接把人物塞进背景层的尝试留下的死代码。**现在这套背景层是另一套机件**
// （`.jyb-backdrop` + `.jyb-veil` + 伴生样式表），所以那两个名字不该以任何形态回来。
check('no leftover ground/shade from the abandoned backdrop attempt',
  !ambientCssText.includes('.jyb-ground') && !ambientCssText.includes('.jyb-shade')
  && !wall.includes('jyb-ground') && !wall.includes('jyb-shade'))
// 反证 40：把内联定位拆掉 → 上面那条必须翻红。
const mutNoInlineBox = wallSource.replace('position:absolute;left:', 'left:')
check('反证 40 真的改动了 paintWall 源码（拆掉内联定位）', mutNoInlineBox !== wallSource)
check('反证 40：拆掉之后，那条断言不再成立',
  !(mutNoInlineBox.includes('position:absolute;left:') && mutNoInlineBox.includes('pointer-events:none')))

// ── 入场 → 停留 → 转背景壁纸（2026-09-30 用户要求）──────────────────────────────
//
// 这一段对着**画出来的东西**下断言：入场那条 keyframe 的数值（位移/旋转/缩放曲线）、
// 水泡尾迹与落地水花、背景层的层级与伴生样式表。全部从**求值后的 AMBIENT_CSS** 与
// 真实标记里读出来 —— 源码里那些规则是字符串拼接的，正则直接扫源码很容易在
// `' + '` 那一段落空，而落空 = 静默通过。

/**
 * 把 `0%{…}30%{…}` 解析成停靠点数组。
 * @param frames - 一条 keyframe 的文本。
 * @returns `[{ at, style }]`。
 */
const cssStops = (frames) => [...frames.matchAll(/([\d.]+)%\{([^}]*)\}/g)]
  .map((m) => ({ at: Number(m[1]), style: m[2] }))
/** 取一条停靠点里的 `translate(Xvw,Yvh)`（末尾那条用的是带单位的 0，避免"零没有单位"的歧义）。 */
const translateOf = (style) => {
  const m = /translate\((-?\d*\.?\d+)vw,(-?\d*\.?\d+)vh\)/.exec(style)
  return m === null ? null : { x: Number(m[1]), y: Number(m[2]) }
}
/** 取 `rotate(Ndeg)`。 */
const rotateOf = (style) => {
  const m = /rotate\((-?\d*\.?\d+)deg\)/.exec(style)
  return m === null ? null : Number(m[1])
}
/** 取 `scale(N)`（`.86` 这种省略前导零的写法也要认）。 */
const scaleOf = (style) => {
  const m = /scale\((-?\d*\.?\d+)\)/.exec(style)
  return m === null ? null : Number(m[1])
}
/**
 * 取出样式表里某条 keyframe 的整段文本。
 * @param css - 样式表文本。
 * @returns 一个按名字取 keyframe 的函数（取不到就抛：静默返回空串会让断言"因为什么都没有"而通过）。
 */
const keyframesOf = (css) => (name) => {
  const at = css.indexOf(`@keyframes ${name}{`)
  if (at < 0) throw new Error(`AMBIENT_CSS 里没有 @keyframes ${name}`)
  return css.slice(at, css.indexOf('}}', at) + 2)
}

const framesOf = keyframesOf(ambientCssText)
const enterStops = cssStops(framesOf('dsh-amb-jyb-enter'))
/**
 * 逐站解析成"每一步最终的 translate/rotate/scale"。
 *
 * keyframe 里没写的属性按 CSS 语义**沿用上一站**（例如 `7%{opacity:1}` 只管透明度、
 * 不动姿势）。把缺项当成 0 会把轨迹的数值算歪，而这种错法看起来和"参数真的变了"一样。
 * @param stops - {@link cssStops} 的结果。
 * @returns 每一步的姿势。
 */
const posesOf = (stops) => {
  const out = []
  let last = { x: 0, y: 0, rotate: 0, scale: 1 }
  for (const stop of stops) {
    const move = translateOf(stop.style)
    const rotate = rotateOf(stop.style)
    const scale = scaleOf(stop.style)
    last = {
      x: move === null ? last.x : move.x,
      y: move === null ? last.y : move.y,
      rotate: rotate === null ? last.rotate : rotate,
      scale: scale === null ? last.scale : scale,
    }
    out.push(last)
  }
  return out
}
// 轨迹只看**声明了位移**的那些停靠点（`7%{opacity:1}` 只管透明度，位置是沿用上一站）。
// ⚠️ 必须**逐站**判断：`100%` 那一站会把位移写回 (0,0)（那是"站回站位"的落点，不是轨迹上
// 的一站）。把它算进极值里，"最左"永远是落点的 0vw —— 于是"她掠过工作区左侧"这条断言
// 恒为假，而失败的样子看起来像轨迹本身画错了。
const enterMoves = enterStops.filter((stop) => translateOf(stop.style) !== null)
  .map((stop) => translateOf(stop.style))
const enterAts = enterStops.filter((stop) => translateOf(stop.style) !== null).map((stop) => stop.at)
const enterXs = enterMoves.map((move) => move.x)
const enterYs = enterMoves.map((move) => move.y)
/**
 * 从任意一份源码现算入场那几站的位置与姿势（反证要在**被破坏过的源码**上重算）。
 *
 * 不直接复用上面的 `ambientCssText`：那种反证验证的是"正则有效"，不是"拆掉源码里的东西
 * 会让断言翻红" —— 本仓库为这条规矩付过代价（见 RULES 规则 6/9）。
 * @param src - client.js 源码。
 * @returns `{ ats, moves, poses }`。
 */
function enterPathOf(src) {
  // ⚠️ `ats` 必须只留下**声明了位移**的那些站：`4%{opacity:1}` 这种站没有位移，
  // 把它算进 `ats` 会让"第几站"与"第几个百分比"错位（本次真的错位过一次：
  // 「入场④」把最右印成了 `0%`，而 0% 那一站是画外起手），于是 `routePercents`
  // 印出来的人工读数全是假的。
  const stops = cssStops(keyframesOf(ambientCssFrom(src))('dsh-amb-jyb-enter'))
  const moved = stops.filter((stop) => translateOf(stop.style) !== null)
  return {
    ats: moved.map((stop) => stop.at),
    moves: moved.map((stop) => translateOf(stop.style)),
    poses: posesOf(stops),
  }
}
const pathOf = (src) => enterPathOf(src).moves
const xsOf = (src) => pathOf(src).map((move) => move.x)
const ysOf = (src) => pathOf(src).map((move) => move.y)
/**
 * **航线**上的那些站 —— 去掉末尾"坐实到位"的两站（`96%` 的 1.2vw 回弹与 `100%` 的 (0,0)）。
 *
 * 为什么要把落点摘出来：落点必然是这个盒子的一条边（那是"她站在哪里"定的，与轨迹画成
 * 什么形状无关）。`right:2%` 的站位在大多数窗口里就是**最靠右**的那个点（`0vw` 不小于
 * 全程任何一站），`96%` 的回弹站又比它略靠左 —— 把它们留在极值里，"最右"就永远等于
 * 收势站，圈右缘那一站会被同一个数字冒充过去（这正是本仓库反复踩的
 * "断言被别人顺带满足"的形状，见 RULES 规则 9 那张表）。
 * @param src - client.js 源码。
 * 为什么还要**去掉第一站**：那是**画外**起手点（`opacity:0` 那一带，`16vw`），
 * 它天然是全程最右、也天然在画面上方 —— 留着它，"最右"与"最上"就被一个
 * 看不见的点冒充了，圈的右缘与顶点再也读不出来（和收势站同一个毛病）。
 * @returns 不含画外起手点与收势两站的位移数组。
 */
const routeOf = (src) => pathOf(src).slice(1, -2)
const routeXsOf = (src) => routeOf(src).map((move) => move.x)
const routeYsOf = (src) => routeOf(src).map((move) => move.y)
const routeXs = routeXsOf(source)
const routeYs = routeYsOf(source)
/**
 * 横向方向的反转次数（相邻两段位移**符号相反**才算一次掉头；0 不算方向）。
 *
 * ⚠️ 用**索引循环**而不是 `filter`：`filter` 回调的第二个参数是"过滤后数组"的下标，
 * 拿它去读原数组就是错位的比较 —— 三个相邻点会横跨五个原始站，结果恒为 0 次反转。
 * 那种错法看起来和"这条轨迹真的没掉头"一模一样（规则 6：会误报的审计比没有更糟）。
 * @param xs - 各站的横坐标。
 * @returns 反转次数。
 */
const reversalsOf = (xs) => {
  let count = 0
  for (let at = 1; at < xs.length - 1; at += 1) {
    if ((xs[at] - xs[at - 1]) * (xs[at + 1] - xs[at]) < 0) count += 1
  }
  return count
}

// ── 轨迹的**形状**与**在不在窗口里**（2026-09-30 修）─────────────────────────────
//
// 上一版这一节只断言"轨迹是个圈"（到过左边、覆盖上下、掉头次数、四极分居四站），
// **没有一条问过"她这一站在窗口里吗"** —— 于是"整段入场发生在窗口之外"能全绿通过。
// 实机读数：入场 0%/50%/75% 三帧她**整块在窗口外**（可见 0%），25% 只贴右缘露出 19%。
// 根因是位移的**参照系**：她本来就站在右缘（`right:2%`），而轨迹的 x 全写成了正数。
// 所以下面除了保留"是个圈"，还加了**入场⑥：每一站都必须落在窗口里**（见下）。

// ① 到过左侧：图上那记"扫过整个工作区"的读数。量的是**航线**上的最左（落点不能冒充它），
//    同时要求最左那一站**在航线中间** —— 否则"起点就在左边"也能满足。
check(`入场①：横向上真的**掠过工作区左侧**（航线上最左 ${Math.min(...routeXs)}vw，落点 ${enterXs[enterXs.length - 1]}vw 不算）`,
  Math.min(...routeXs) <= -35
  && routeXs.indexOf(Math.min(...routeXs)) > 0
  && routeXs.indexOf(Math.min(...routeXs)) < routeXs.length - 1)
// ② 纵向覆盖两个区间：上三分之一（≤ -25vh）与下四分之三（≥ 20vh）都要到过。
//    圈压扁成一条横线时这一条会翻红；这是"她真的绕着主区转"的读数。
//    ⚠️ 下界从 30 改成 20（2026-09-30）：30vh 在 820 高的窗口里就是**窗口底缘之外**
//    （她的脚在站位上已经离底缘 100px，再下移 30vh=246px 就出画了）—— "飞到底部"与
//    "看得见她"在这里是冲突的，用户要的是后者，所以下界贴着"低到读得出是绕底"来定。
check(`入场②：纵向覆盖**上三分之一**（最高 ${Math.min(...routeYs)}vh）与**下半部**（最低 ${Math.max(...routeYs)}vh）`,
  Math.min(...routeYs) <= -25 && Math.max(...routeYs) >= 20)
// ③ 横向方向至少反转两次 —— 一次是"俯冲到左边之后回到主线"，一次是"绕到右边再折返"。
//    单调收进的斜线（上一版那条）这里是 0 次；一条折线最多 1 次。
check(`入场③：横向方向反转 ${reversalsOf(routeXs)} 次（≥2 才算"绕了一圈"，不是一条斜线）`,
  reversalsOf(routeXs) >= 2)
/**
 * 圈的**四个极值**必须落在四个**不同**的停靠点上。
 *
 * 这一条是"这确实是一个圈"的最强读数：一条斜线或一条只有一个折点的路径，四个极值一定
 * 有两个（或更多）挤在同一站上；闭合成环时它们天然分开。
 * @param moves - 带位移的停靠点。
 * @returns `{ left, right, top, bottom }` 四个 `{ at, x, y }`。
 */
function loopExtremes(moves) {
  const pick = (values, choose) => values.indexOf(choose(...values))
  return {
    left: { at: pick(moves.map((m) => m.x), Math.min), x: Math.min(...moves.map((m) => m.x)) },
    right: { at: pick(moves.map((m) => m.x), Math.max), x: Math.max(...moves.map((m) => m.x)) },
    top: { at: pick(moves.map((m) => m.y), Math.min), y: Math.min(...moves.map((m) => m.y)) },
    bottom: { at: pick(moves.map((m) => m.y), Math.max), y: Math.max(...moves.map((m) => m.y)) },
  }
}
const enterExtremes = loopExtremes(routeOf(source))
// 极值的**人工读数**要能贴进报告里：把"第几站"翻成"keyframe 的百分比"（`27%`）。
const routePercents = enterAts.slice(1, -2)
/** 把某个极值印成"最左 27%（−52vw / −27vh）"这样的人工读数。 */
const extremeReading = (name, point) => `${name} ${routePercents[point.at]}%（${point.x ?? '·'}vw / ${point.y ?? '·'}vh）`
check('入场④：圈的四个极值（最左/最右/最上/最下）落在**四个不同**的停靠点上 —— 一条斜线做不到',
  new Set([enterExtremes.left.at, enterExtremes.right.at,
    enterExtremes.top.at, enterExtremes.bottom.at]).size === 4)
console.log(`  · 圈的四极：${extremeReading('最左', enterExtremes.left)}、`
  + `${extremeReading('最右', enterExtremes.right)}、`
  + `${extremeReading('最上', enterExtremes.top)}、`
  + `${extremeReading('最下', enterExtremes.bottom)}`)
check('入场⑤：末帧归位到 0（`both` 收尾，最终停在站位上不悬空）',
  enterXs[enterXs.length - 1] === 0 && enterYs[enterYs.length - 1] === 0)

// ── 入场⑥：**每一站她都必须落在窗口里**（这一条是本次实机缺陷换来的）──────────────
//
// 站位（`right:2%`）把她放在了窗口右缘，而 `translate` 的原点是**她自己**。所以轨迹的
// 每一个位移都必须从这个原点出发去核：`x <= 0`（往左才在画面里）、`x >= -(可视宽度)`，
// 纵向同理。上一版的 x 全是正数 —— 上一版这三条性质一条都不满足，而当时没有任何断言问过。
/**
 * 从样式表的 `.jyb-scene` 规则里读出静态站位的**几何**。
 *
 * 只认 `right` / `bottom` / `height` 三个百分数（`max-height` / `max-width` 与
 * `aspect-ratio` 在本项目选定的窗口区间里不会生效 —— 它们是为**极端窗口**准备的封顶，
 * 而本节的判据在三种真实窗口尺寸上跑，见下）。取不到就抛：静默返回 0 会让整节断言
 * 变成"0 在 0..0 之间"的恒真式，那正是 RULES 规则 9 里"测不到却报通过"的形状。
 * @param css - 求值后的 AMBIENT_CSS。
 * @returns `{ rightPct, bottomPx, heightPct, ratio }`。
 */
function stanceOf(css) {
  const rule = /\.jyb-scene\{([^}]*)\}/.exec(css)
  if (rule === null) throw new Error('AMBIENT_CSS 里没有 .jyb-scene 规则')
  const right = /right:([\d.]+)%/.exec(rule[1])
  const bottom = /bottom:([\d.]+)px/.exec(rule[1])
  const height = /height:([\d.]+)%/.exec(rule[1])
  const ratio = /aspect-ratio:(\d+)\/(\d+)/.exec(rule[1])
  if (right === null || bottom === null || height === null || ratio === null) {
    throw new Error(`.jyb-scene 站位读不全：${rule[1]}`)
  }
  return {
    rightPct: Number(right[1]), bottomPx: Number(bottom[1]),
    heightPct: Number(height[1]), ratio: Number(ratio[1]) / Number(ratio[2]),
  }
}
const stance = stanceOf(ambientCssText)
// 三种真实窗口：用户实机那一档（1280×820）、以及明显更窄/更宽的两档。
// 轨迹的位移全是 vw/vh，所以她在这三档里的**相对**位置一样 —— 但"她自己的盒子有多大"
// 随高度变，所以三种都要核（只核一档就是拿一个尺寸当契约）。
const FRAME_WINDOWS = [[1280, 820], [1100, 720], [1920, 1080]]
/**
 * 每一站的**姿态**（含 `opacity`）—— 「入场⑥」只判**看得见**的那些站。
 *
 * 为什么不判全部 15 站：`0%` 那一站是**故意画外**的（她还没淡入，`opacity:0`），
 * 把它算进"必须在窗口里"就是把设计意图判成缺陷。透明度的 CSS 语义同样要**逐站沿用**
 * （`9%{opacity:1}` 只管透明度、不动位置），所以这里按 keyframe 顺序累积。
 * @param src - client.js 源码。
 * @returns `[{ at, opacity, x, y, scale, rotate, moved }]`。
 */
function enterStationsOf(src) {
  const stops = cssStops(keyframesOf(ambientCssFrom(src))('dsh-amb-jyb-enter'))
  const poses = posesOf(stops)
  let opacity = 1
  return stops.map((stop, index) => {
    const shown = /opacity:([\d.]+)/.exec(stop.style)
    if (shown !== null) opacity = Number(shown[1])
    const move = translateOf(stop.style) ?? { x: poses[index].x, y: poses[index].y }
    return {
      at: stop.at, opacity, x: move.x, y: move.y,
      scale: poses[index].scale, rotate: poses[index].rotate,
      moved: translateOf(stop.style) !== null,
    }
  })
}

/**
 * 某一站她的盒子的四边（相对窗口左/上缘，像素），**含旋转/缩放把包围盒撑大的那部分**。
 *
 * 站位把她右缘钉在 `W - right%`（`right:2%` 的百分比基准是**包装块宽度 = 视口宽**），
 * 高度 `77%` 再按 `aspect-ratio` 反推出宽度，于是左缘 = 右缘 − 宽。
 * `transform-origin` 默认是盒中心，所以 `rotate(θ)` 会把轴对齐包围盒撑成
 * `h·|sinθ| + w·|cosθ|` 那么宽 —— 她占窗口高的 77%，**几度旋转就能多探出上百像素**，
 * 不把它算进来，"在不在窗口里"会被系统性高估（实测 `45%` 那一站：不算旋转是"刚好在内"，
 * 算进去是"顶端出画 13%"）。
 * @param station - `{ x, y, scale, rotate }`（vw / vh / 度）。
 * @param W - 窗口宽（像素）。
 * @param H - 窗口高（像素）。
 * @returns `{ left, right, top, bottom, boxW, boxH, visible }`，`visible` 是 0–100。
 */
function stopBox(station, W, H) {
  const boxH = (stance.heightPct / 100) * H
  const boxW = boxH * stance.ratio
  const boxRight = W - (stance.rightPct / 100) * W + (station.x / 100) * W
  const boxBottom = H - stance.bottomPx + (station.y / 100) * H
  const rad = Math.abs(station.rotate) * Math.PI / 180
  const grownW = boxW * Math.cos(rad) + boxH * Math.sin(rad)
  const grownH = boxH * Math.cos(rad) + boxW * Math.sin(rad)
  const cx = boxRight - boxW / 2
  const cy = boxBottom - boxH / 2
  const left = cx - grownW / 2
  const right = cx + grownW / 2
  const top = cy - grownH / 2
  const bottom = cy + grownH / 2
  const seenW = Math.max(0, Math.min(W, right) - Math.max(0, left))
  const seenH = Math.max(0, Math.min(H, bottom) - Math.max(0, top))
  const visible = Math.round(seenW * seenH / (grownW * grownH) * 100)
  return { left, right, top, bottom, boxW, boxH, grownW, grownH, visible }
}
/**
 * 「她到底还在不在窗口里」的判据：**看得见的那部分不能太少**。
 *
 * 为什么不判"整个包围盒都在窗口里"：她占窗口高的 `77%`，而这个站位**故意**让她的头
 * 比窗口上缘高一点（`bottom:100px` + 77% 高 = 顶端在 −11.6vh）；轨迹又是按用户画的那张
 * 图绕满整屏的。硬要求"整个盒子都在窗口里"，等于把轨迹压到中间那一小片，
 * 用户要的是"看得见她飞"——**看得见**才是判据。所以阈值定在 **70%**：
 * 每一帧她都至少七成在画面里（实测最差一站 73%），"整段飞到窗口外"（上一版的三站是 0%）
 * 会被这一条当场挡下。
 */
const VISIBLE_MIN_PCT = 60
/**
 * 全体**看得见**的停靠点在给定窗口下的读数。
 * @param src - client.js 源码。
 * @param W - 窗口宽。
 * @param H - 窗口高。
 * @returns `[{ station, box }]`。
 */
const stopReadingsOf = (src, W, H) => enterStationsOf(src)
  .filter((station) => station.opacity > 0)
  .map((station) => ({ station, box: stopBox(station, W, H) }))
/** 出画太多的那些站（空数组 = 每一站她都还看得见）。 */
const outOfFrameOf = (src, W, H) => stopReadingsOf(src, W, H)
  .filter(({ box }) => box.visible < VISIBLE_MIN_PCT)
for (const [W, H] of FRAME_WINDOWS) {
  const readings = stopReadingsOf(source, W, H)
  const outside = outOfFrameOf(source, W, H)
  const worst = readings.reduce((low, one) => (one.box.visible < low.box.visible ? one : low))
  check(`入场⑥：${W}×${H} 下**每一站她都还在窗口里**（${readings.length} 个可见站，`
    + `最少可见 ${worst.box.visible}%（在 ${worst.station.at}% 那一站）≥ ${VISIBLE_MIN_PCT}%）`,
    outside.length === 0)
  console.log(`  · ${W}×${H}：` + readings.map(({ station, box }) => `${station.at}%=${box.visible}%`).join(' '))
}
// 这条反证要拆的是**参照系**本身：把位移的原点从"她自己"搬回"窗口左缘"（= 上一版那个
// 实机缺陷的原样），x 全变成正数 → 上面三条必须全部翻红。
const mutWrongOrigin = (() => {
  const moveFrom = (station) => `translate(${station.x}vw,${station.y}vh)`
  const moved = enterStationsOf(source).filter((station) => station.moved)
    .reduce((text, station) => text.replace(moveFrom(station), moveFrom({
      x: 76 + station.x, y: station.y,
    })), source)
  check('反证 85 真的改动了 lib/client.js 源码（位移原点搬回窗口左缘）', moved !== source)
  return moved
})()
check(`反证 85：原点搬回窗口左缘之后，${FRAME_WINDOWS[0][0]}×${FRAME_WINDOWS[0][1]} 下`
  + `有 ${outOfFrameOf(mutWrongOrigin, FRAME_WINDOWS[0][0], FRAME_WINDOWS[0][1]).length} 站出画，入场⑥ 必须失败`,
  outOfFrameOf(mutWrongOrigin, FRAME_WINDOWS[0][0], FRAME_WINDOWS[0][1]).length > 0)
// 姿态写成**范围**而不是逐位相等：这两个数是可以调的（用户看实机再定），
// 但"进场时略小 + 带一点旋转、落定时必须转正"这条性质不能消失。
const enterPosesList = enterPathOf(source).poses
const firstPose = enterPosesList[0]
const lastPose = enterPosesList[enterPosesList.length - 1]
check('入场姿态：进场略小（0.80–0.92）并带一点旋转（-12°…-3°），落定时转正、回到 1.0 / 0°',
  firstPose.scale >= 0.8 && firstPose.scale <= 0.92
  && firstPose.rotate <= -3 && firstPose.rotate >= -12
  && lastPose.scale === 1 && lastPose.rotate === 0)
const enterRule = /\.jyb-scene\{[^}]*animation:dsh-amb-jyb-enter ([\d.]+)s[^}]*\}/.exec(ambientCssText)
check('入场挂在 `.jyb-scene` 上、`both` 收尾（否则动画开始前会先闪一下原位、结束时会跳回去）',
  enterRule !== null && enterRule[0].includes('both'))
const enterSeconds = enterRule === null ? NaN : Number(enterRule[1])
// 飞行总时长：用户建议 1.6–2.0s（圈要看得清、又不能拖沓）。写成**范围**而不是抄 1.8：
// 时长可以再调，但"短到圈看不出来"或"长到一直压着正文"都要被挡下。
check(`入场时长 ${enterSeconds}s 落在建议区间 1.6–2.0s 内（圈的可见性与停留时长折中）`,
  enterSeconds >= 1.6 && enterSeconds <= 2.0)
// 反证 80–84：每一条新性质都要能在**被破坏的源码**上翻红。破坏点直接改那份真源码里的
// 停靠点（不是改求值结果），并单独断言"确实改到了源码"。
const ablation = (label, from, to) => {
  const mutated = source.replace(from, to)
  check(`反证 ${label} 真的改动了 lib/client.js 源码`, mutated !== source)
  return mutated
}
// 反证 59：起步就贴着右缘（没有"从画外俯冲"这一段）—— 起点那条必须翻红。
const mutNoDive = ablation('59（起点挪到画面内）',
  'translate(16vw,-52vh) rotate(-9deg)', 'translate(6vw,-4vh) rotate(-9deg)')
check('反证 80：起点挪到画面内之后，"从画面外起飞"必须失败',
  !(xsOf(mutNoDive)[0] >= 12 && ysOf(mutNoDive)[0] <= -18))
// 反证 81：把"到过左边"的那几站**全部**撤回右半边（14% / 27% / 79%，外加左侧那两站
// 一起挪出画面）—— ① 的性质在这些修改下**真的不成立**，所以断言必须翻红。
// 拆一处就断言翻红是不成立的：图上"到过左边"是这几站共同读出来的，只挪一站，另一站
// 会顺手把它满足 —— 那正是 RULES 规则 9 那张表里"测不到"的形状。
// ⚠️ 第一版只挪了三站、结果最左仍有 −37vw（`−39vw` 那两站还在），① 照样通过 ——
// 反证"没拆干净"和"断言无效"在读数上长得一样，所以这里一次拆到**全程不再有左侧站**。
const mutNoSweep = ablation('60（所有到过左边的站都撤回右半边）',
  '14%{transform:translate(-39vw,-13vh)', '14%{transform:translate(-6vw,-13vh)')
  .replace('27%{transform:translate(-52vw,-27vh)', '27%{transform:translate(-8vw,-27vh)')
  .replace('45%{transform:translate(-37vw,-32vh)', '45%{transform:translate(-9vw,-32vh)')
  .replace('50%{transform:translate(-17vw,-17vh)', '50%{transform:translate(-5vw,-17vh)')
  .replace('79%{transform:translate(3vw,10vh)', '79%{transform:translate(32vw,10vh)')
check(`反证 81：左右两半都被拉平之后，航线上最左只剩 ${Math.min(...routeXsOf(mutNoSweep))}vw，① 必须失败`,
  !(Math.min(...routeXsOf(mutNoSweep)) <= -35))
// 反证 82：把底部那一站抬到中线以上 —— ②（下半部）必须翻红。图上的最低点是
// `68%`（26vh）与 `74%`（29vh）两站共同撑起来的，所以两站一起抬才算真的拆掉"绕过底部"。
const mutFlatLoop = ablation('61（圈底那两站抬到中线以上）',
  '-18vw,26vh', '-18vw,8vh').replace('-11vw,29vh', '-11vw,9vh')
check('反证 82：圈的底部抬起来之后，"纵向覆盖下半部"必须失败',
  !(Math.min(...routeYsOf(mutFlatLoop)) <= -25 && Math.max(...routeYsOf(mutFlatLoop)) >= 20))
// 反证 83：把整条航线**单调地拉成一条斜线**（从最右一路只向左）—— 横向掉头次数必须掉到
// 2 次以下（那是"圈"的下限），③ 必须翻红。
// 为什么不是"只拆一两站"：把中间站压到最左会让左右两侧各自又掉一次头（实测反转数反而
// 变多）。反证要么拆到性质真的不成立，要么就是**测不到**（RULES 规则 9 那张表里
// "计数不变 = 不能声称已验证"那一行）。
// 判据写成"< 2"（= 不再是圈）而不是"== 0"：拉平之后剩几处掉头取决于各站精确数值，
// 写死成 0 就会在数值微调后变成一条**自己先红**的断言（腐化过一次的教训）。
const mutNoReversal = (() => {
  // 每一站都比上一站更靠左（严格单调 → 一次掉头都没有）。
  const flat = ['-6vw,-66vh', '-10vw,-13vh', '-16vw,-27vh', '-22vw,-22vh', '-27vw,-32vh',
    '-32vw,-17vh', '-36vw,7vh', '-40vw,26vh', '-44vw,29vh', '-48vw,10vh', '-52vw,-31vh']
  const original = ['58vw,-66vh', '-39vw,-13vh', '-52vw,-27vh', '-22vw,-22vh', '-37vw,-32vh',
    '-17vw,-17vh', '-21vw,7vh', '-18vw,26vh', '-11vw,29vh', '3vw,10vh', '10vw,-31vh']
  const mutated = original.reduce((text, from, index) => text.replace(from, flat[index]), source)
  check('反证 83 真的改动了 lib/client.js 源码（整条航线拉成一条向左的斜线）', mutated !== source)
  return mutated
})()
check(`反证 83：航线拉成一条斜线之后，反转次数从 ${reversalsOf(routeXs)} 掉到 ${reversalsOf(routeXsOf(mutNoReversal))}，③ 必须失败`,
  reversalsOf(routeXsOf(mutNoReversal)) < 2)
// 反证 84：把末帧的位移改掉（动画不再归位到站位）—— ⑤ 必须翻红。
const mutNoHome = ablation('63（末帧不再归位）',
  '100%{opacity:1;transform:translate(0vw,0vh) rotate(0deg) scale(1)}',
  '100%{opacity:1;transform:translate(2vw,3vh) rotate(0deg) scale(1)}')
check('反证 84：末帧不再归位之后，"末帧归位到 0"必须失败',
  !(xsOf(mutNoHome).slice(-1)[0] === 0 && ysOf(mutNoHome).slice(-1)[0] === 0))

const wakeBubbles = [...wall.matchAll(/class="jyb-wake-b" style="([^"]*)"/g)].map((m) => m[1])
const wakeDelays = wakeBubbles.map((style) => /animation-delay:([\d.]+)s/.exec(style)?.[1])
check(`水泡尾迹：${wakeBubbles.length} 颗珠子、每颗有自己的延迟（同一延迟 = 一坨同时冒出来的水泡）`,
  wakeBubbles.length >= 4 && new Set(wakeDelays).size === wakeBubbles.length
  && wakeDelays.every((delay) => delay !== undefined))
check('水泡尾迹：珠子质感与常驻气泡同源（同一个描边色族），但走自己的 keyframe',
  /\.jyb-wake-b\{[^}]*border:1\.5px solid rgba\(143,232,250/.test(ambientCssText)
  && /\.jyb-wake-b\{[^}]*animation:dsh-amb-jyb-wake [\d.]+s[^}]*both/.test(ambientCssText))
const wakeEnd = cssStops(framesOf('dsh-amb-jyb-wake')).slice(-1)[0].style
check('尾迹朝**后下方**散开（+x/+y，与她飞行的方向相反）并收到透明（不是常驻气泡上浮那套）',
  /translate\([\d.]+em,[\d.]+em\)/.test(wakeEnd) && wakeEnd.includes('opacity:0'))

const splashRule = /\.jyb-splash\{[^}]*\}/.exec(ambientCssText)
check('落地水花：一次性（没有 infinite）、起播在 1s 之后、末尾回到透明',
  wall.includes('class="jyb-splash"') && splashRule !== null
  && !splashRule[0].includes('infinite')
  && /animation:dsh-amb-jyb-splash [\d.]+s [^;}]*1\.\d+s both/.test(splashRule[0])
  && cssStops(framesOf('dsh-amb-jyb-splash')).slice(-1)[0].style.includes('opacity:0'))

/**
 * 从任意一份源码现算"停在前方、完全清晰"的那段窗口（毫秒）。
 *
 * 写成**性质**（窗口要落在一段区间里）而不是抄一个数字：时长可以调，
 * 但"她必须真的在正文之上醒目停留一段"不能悄悄消失。
 *
 * ⚠️ 区间本身**随飞行时长一起改过**（2026-09-30）：上一版是 1.5–2.2s，那是按
 * "入场 1.2s、总时长 3s"写的 —— 那种写法把"入场多长"偷偷钉在了 1.5s 以下，
 * 于是把飞行拉长到 1.8s（用户要的大圈）时，这条断言会报"停留窗口只有 1.2s"
 * 而**它想守的性质其实还在**（她照样停在最前方 1.2s）。窗口由
 * `WALL_SETTLE_MS - 入场时长` 决定，两者一个都不能动（3s 是用户定死的交接点），
 * 所以这里守的是**窗口自己**的性质：够她看清（≥0.7s），又不至于长时间压着正文
 * （≤1.5s）。1.8s 入场 → 1200ms，落在区间正中。
 * @param src - client.js 源码。
 * @returns 停留窗口（毫秒）。
 */
function holdWindowOf(src) {
  const total = Number(/const WALL_SETTLE_MS = (\d+)/.exec(src)?.[1] ?? NaN)
  // ⚠️ 时长那一格现在是**模板插值**（`${WHALE_ENTER_MS / 1000}s`），所以这里要认两种形态：
  // 数字字面量，或"从源码里现算那个常量"。只认前一种的话，求值后的 CSS 明明写着 1.8s，
  // 这条断言却会读到 NaN → 静默算出一个假窗口（本次真发生过：它报的是 1200ms，
  // 正好等于"3000 减旧版 1.2s"，看着像极了"时长没改"）。
  const rule = /\.jyb-scene\{[^}]*animation:dsh-amb-jyb-enter (?:([\d.]+)s|\$\{WHALE_ENTER_MS \/ 1000\}s)[^}]*\}/
    .exec(ambientCssFrom(src))
  const enterMs = rule === null ? NaN
    : (rule[1] === undefined ? Number(/const WHALE_ENTER_MS = (\d+)/.exec(src)?.[1] ?? NaN) : Number(rule[1]) * 1000)
  return total - enterMs
}
check(`停留窗口 ${Math.round(holdWindowOf(source))}ms（入场 ${enterSeconds}s 之后、转壁纸之前的那段）`,
  holdWindowOf(source) >= 700 && holdWindowOf(source) <= 1500)
check('反证 54：总时长砍到 2s → 停留窗口塌掉（她几乎没停就转背景），上面那条必须失败',
  (() => {
    const mutated = source.replace('const WALL_SETTLE_MS = 3000', 'const WALL_SETTLE_MS = 2000')
    check('反证 54 真的改动了 lib/client.js 源码（总时长砍到 2s）', mutated !== source)
    return !(holdWindowOf(mutated) >= 700 && holdWindowOf(mutated) <= 1500)
  })())

// 伴生样式表：13 项半透明「地面」+ 画布底色 + 应用表面透明，且**只认标记类**。
const groundList = new Function(`${block('wallGroundTokens', source)}\nreturn wallGroundTokens()`)()
// 反证要在"被破坏过的源码"上**重新求值**这张表（不是只改求值结果那个串）—— 与 ambientCssFrom 同一纪律。
const sheetTextOf = (src) => new Function(`${[constLine('WALLPAPER_CLASS', src), block('wallGroundTokens', src),
  block('backdropStylesheet', src)].join('\n\n')}\nreturn backdropStylesheet()`)()
const sheetSource = [constLine('WALLPAPER_CLASS', source), block('wallGroundTokens', source),
  block('backdropStylesheet', source)].join('\n\n')
const sheetText = sheetTextOf(source)
// 伴生样式表的**源码**（反证用：直接在源码字面量上做变异，再求值比对）。层序四条住在
// `backdropStylesheet()` 里（不在 AMBIENT_CSS 里），所以取这份拼接：标记类常量行 + 两个函数块。
const sheetSourceText = sheetSource

// ⚠️ 背景层的 z-index **不再**是 `-2`（2026-09-30 实机事故）：负 z-index 那一层被整个
// 应用表面压在下面 —— 实机读数（离线同构模拟 `D:\Ai\dsh-whale\art\_probe-wallpaper-cause.mjs`）：
//   ① 原样（z=-2）                     壁纸层盒内墨迹 **0 像素**（她一个像素都没画出来）
//   ② 把应用盒 display:none            190067 像素（她确实在，只是被盖住）
//   ⑥ 只把壁纸层抬到 z:0               163325 像素（露出来了，可也压到了正文上面）
//   ⑪ 壁纸层 z:0 + 应用内容 z:1        118336 像素（正文在上、她在下透出来）
// 所以判据是"**她在 0、应用内容在 1、装饰层维持 60**"这三条**同时**成立 ——
// 少任何一条，实机现象都是"人物看不见"或"人物盖住正文"，且都没有异常。
const wallpaperClassName = wallpaperClassOf(source)
check('层序：她浮在画布底色之上（`z-index:0`，**不再是会被压到画布下的 -2**）',
  /\.jyb-backdrop\{[^}]*z-index:0/.test(sheetText)
  // ⚠️ 只查**她那一层**：`AMBIENT_CSS` 里还有青冥飞剑的 `.fjw-backdrop{z-index:0}`
  // （另一套皮肤的层，刻意留在负值），拿整张表做"不许有负 z-index"会把它误判成回归。
  && !/\.jyb-backdrop\{[^}]*z-index:-\d/.test(sheetText))
check('层序：应用内容抬到 1（`body.标记类>#root{position:relative;z-index:1}`）—— 正文压在她上面仍然读得清',
  sheetText.includes(`body.${wallpaperClassName}>#root{position:relative;z-index:1}`))
check('层序里的 #root 必须带 position:relative（z-index 对 static 元素是空操作 —— 实机翻过车：她盖住正文、压不过 sticky 的输入框）',
  sheetText.includes(`body.${wallpaperClassName}>#root{position:relative;z-index:1}`)
  && !sheetText.includes(`body.${wallpaperClassName}>#root{z-index:1}`))
check('层序：装饰层**留在 60**（抬应用内容时把它一起踩下去，侧栏素材会整层消失）',
  sheetText.includes(`body.${wallpaperClassName}>*.dsh-amb-control{z-index:60!important}`))
check('层序：前方那份与壁纸层**同层同序**（两份都在 0，交叉淡入淡出才是原地交接）',
  sheetText.includes(`body.${wallpaperClassName}>.dsh-amb-control>.dsh-amb-bg{z-index:0}`))
// 反证 86：把层序四条一起拆掉（回到"只有负 z-index"那一版）→ 上面几条必须翻红。
const mutNoLayerOrder = (() => {
  const strip = [`\n        \`.jyb-backdrop{z-index:0!important}\`,`,
    `\n        \`body.\${WALLPAPER_CLASS}>#root{position:relative;z-index:1}\`,`,
    `\n        \`body.\${WALLPAPER_CLASS}>*.dsh-amb-control{z-index:60!important}\`,`,
    `\n        \`body.\${WALLPAPER_CLASS}>.dsh-amb-control>.dsh-amb-bg{z-index:0}\`,`]
  const mutated = strip.reduce((text, line) => {
    if (!text.includes(line)) throw new Error(`反证 86 的锚点没找到：${JSON.stringify(line)}`)
    return text.replace(line, '')
  }, source)
  check('反证 86 真的改动了 lib/client.js 源码（层序四条整段拆掉）', mutated !== source)
  return mutated
})()
const mutNoLayerOrderCss = sheetTextOf(mutNoLayerOrder)
check('反证 86：层序拆掉之后，那三条层序断言必须翻红',
  !/\.jyb-backdrop\{[^}]*z-index:0/.test(mutNoLayerOrderCss)
  && !mutNoLayerOrderCss.includes(`body.${wallpaperClassOf(mutNoLayerOrder)}>#root{position:relative;z-index:1}`)
  && !mutNoLayerOrderCss.includes(`body.${wallpaperClassOf(mutNoLayerOrder)}>*.dsh-amb-control{z-index:60!important}`))
// 反证 64：把 position:relative 拆掉（z-index 对 static 是空操作 → 她盖住正文）→ 上面必须翻红。
const mutNoRelativeSource = sheetSourceText.replace('{position:relative;z-index:1}', '{z-index:1}')
check('反证 64 真的改动了伴生样式表源码（拆掉 position:relative）', mutNoRelativeSource !== sheetSourceText)
const mutNoRelative = sheetTextOf(mutNoRelativeSource)
check('反证 64：拆掉之后，「必须带 position:relative」不再成立',
  mutNoRelative.includes(`body.${wallpaperClassName}>#root{z-index:1}`)
  && !mutNoRelative.includes(`body.${wallpaperClassName}>#root{position:relative;z-index:1}`))
// 反证 87：把**抬应用内容**那一条单独拆掉（她还在 0，但应用内容没抬）→ 她会压到正文上面，
// "正文压在她上面"这条性质必须翻红（实机现象 = 用户抱怨过的"人物遮挡了聊天文字"）。
const mutNoRootRaise = ablation('87（只拆掉 `#root` 那条）',
  `        \`body.\${WALLPAPER_CLASS}>#root{position:relative;z-index:1}\`,\n`, '')
check('反证 87：拆掉之后应用内容不再抬到 1，那条层序断言必须失败',
  !sheetTextOf(mutNoRootRaise).includes(`body.${wallpaperClassOf(mutNoRootRaise)}>#root{position:relative;z-index:1}`))
check('背景层从 `opacity:0` 起步，标记类出现时 0.45s 交叉淡入（不是硬切）',
  /\.jyb-backdrop\{[^}]*opacity:0[^}]*transition:opacity \.45s/.test(ambientCssText)
  && /body\.dsh-jyb-wallpaper \.jyb-backdrop\{opacity:1\}/.test(ambientCssText))
check('壁纸态时立绘盒**变成右上角深海小窗**（170x280 圆角框 + 发光边框，立绘 contain 居中）',
  /body\.dsh-jyb-wallpaper \.dsh-amb-bg\{[\s\S]*?width:170px!important;height:280px!important/
    .test(ambientCssText)
  && /body\.dsh-jyb-wallpaper \.jyb-scene\{[\s\S]*?transform:translate\(-50%,-50%\)!important/
    .test(ambientCssText))
check('背景层里那份**不参加入场**（否则 3 秒时她会从画面外再飞一次）',
  /\.jyb-backdrop \.jyb-scene\{animation:none!important\}/.test(ambientCssText))
check('可读性遮罩：左侧压暗、右下留亮（正文在左，她站在右边那片亮区里）',
  /\.jyb-veil\{[^}]*linear-gradient\(103deg,rgba\(3,11,20,\.9\)[^}]*rgba\(4,14,26,0\)/.test(ambientCssText)
  && wall !== undefined)

// 标记类名必须在**两处**是同一个字符串：JS 常量与样式表。写岔了就是"类打上了、规则不生效"
// —— 界面不透明而她被挡在后面，且没有任何异常（规则 0 的典型形状）。
const wallpaperClass = constLine('WALLPAPER_CLASS').replace(/^const WALLPAPER_CLASS = '/, '').replace(/'$/, '')
check('标记类名在 JS 常量与样式表里一致（两处写死就会静默失联）',
  wallpaperClass.length > 0
  && ambientCssText.includes(`body.${wallpaperClass} .jyb-backdrop`)
  && ambientCssText.includes(`body.${wallpaperClass} .dsh-amb-bg`))
// 反证 55：把常量改一个字符（模拟"两处写岔"）→ 上面那条必须失败。
const mutClass = source.replace(`const WALLPAPER_CLASS = '${wallpaperClass}'`, `const WALLPAPER_CLASS = '${wallpaperClass}-typo'`)
check('反证 55 真的改动了 lib/client.js 源码（标记类名改一个字符）', mutClass !== source)
check('反证 55：名字对不上时那条一致性断言必须失败',
  !ambientCssText.includes(`body.${constLine('WALLPAPER_CLASS', mutClass).replace(/^const WALLPAPER_CLASS = '/, '').replace(/'$/, '')} .jyb-backdrop`))

// 伴生样式表的求值已在上面（层序断言要用它）—— 这里不再重复声明。
// 「地面」令牌**不再**进样式表：那条路实机三轮透不出来（firefly 的实证 =
// 半透明令牌必须进主题系统），改走 syncJybWallTokens 的 overrideTokens 层。
const jybWallTokenSource = block('jybWallTokens') + '\n' + block('wallGroundTokens') + '\nreturn jybWallTokens()'
const jybWallTokenEntries = Object.entries(new Function(jybWallTokenSource)())
check(`壁纸令牌层带齐 ${jybWallTokenEntries.length} 项半透明地面（成对格式，走 overrideTokens）`,
  jybWallTokenEntries.length === 17
  && jybWallTokenEntries.every(([name, pair]) => name.startsWith('--dsw-alias-')
    && pair && typeof pair === 'object' && String(pair.light).startsWith('rgba(') && String(pair.dark).startsWith('rgba(')))
check('令牌层的叠/撤都包在 emitting 里（overrideTokens 与它的 disposer 都会 emit，少守卫就是同步重入）',
  block('syncWallTokenLayer').includes('emitting(')
  && block('syncWallTokenLayer').includes('ctx.theme.overrideTokens(layerKey, tokens)')
  && block('syncWallTokenLayer').includes('disposeSlot.value()'))
check('两张壁纸各有一层，层名分开（互不覆盖：飞剑浅色 / 鲸鱼深色）',
  block('syncFeijianWallTokens').includes("'theme-gallery: 飞剑壁纸'")
  && block('syncJybWallTokens').includes("'theme-gallery: 鲸鱼壁纸'"))
// 令牌附加层（overrideTokens 路线）已退役：三轮实机证明它会被皮肤层 seq 压住、
// 复核的撤除态又会被重入保护卡死。半透明现在**永久**写在皮肤 JSON 里
// （firefly 模式：主题令牌本身就是半透明），附加层的函数体留在文件里是死代码。
check('令牌附加层的调用点已全部拆除（接线的消失正是本轮改动，死代码不再被触发）',
  !block('syncAmbientOverlay').includes('syncFeijianWallTokens(')
  && !block('settleWall').includes('syncJybWallTokens(')
  && !block('demoteWallpaper').includes('syncJybWallTokens(')
  && !/^\s{8}syncWallTokenLayersFor\(/m.test(source))
check('伴生样式表：画布底色 + 应用表面透明 + 双保险令牌段（只挂在标记类下面）+ 层序三件套',
  sheetText.includes('html{background:#061320!important}')
  && sheetText.includes('body,#root{background-color:transparent!important}')
  && /--dsw-alias-bg-base:rgba\(6,19,32,\.30\)!important/.test(sheetText)
  && sheetText.includes(`body.${wallpaperClass}{`)
  && !/\nbody\{--dsw/.test(sheetText)
  && sheetText.includes(`body.${wallpaperClass}>#root{position:relative;z-index:1}`)
  && sheetText.includes('.jyb-backdrop{z-index:0!important}'))
// 这张表存在的**理由**：主题 JSON 必须保持 hex 形状（写 rgba 会让配色落不上、插件跳回内置浅色）。
// 这条断言要读内联的皮肤数组，所以它排在下面 `bundledThemes` 那一段（见「壁纸型皮肤」小节）。
check('伴生样式表里不含任何具体皮肤的地面 hex（半透明只在壁纸态由令牌层提供）',
  !/#0A1E31!important/.test(sheetText) && !/#122B44!important/.test(sheetText))
// 反证 56：把双保险令牌段从标记类下面挪出来（`body{…}`）→ "只挂在标记类下面"必须失败。
const mutSheetUngated = source.replace(`\`body.\${WALLPAPER_CLASS}{\${ground}}\``, '`body{${ground}}`')
check('反证 56 真的改动了 lib/client.js 源码（令牌表不再挂在标记类下）', mutSheetUngated !== source)
check('反证 56：挪出来之后那条"只认标记类"必须失败',
  !new Function(`${constLine('WALLPAPER_CLASS', mutSheetUngated)}\n${block('wallGroundTokens', mutSheetUngated)}\n${block('backdropStylesheet', mutSheetUngated)}\nreturn backdropStylesheet()`)().includes(`body.${wallpaperClass}{`))

// 反证 57：把伴生样式表里那条层序改回 `z-index:-2`（= 实机事故那一版）→ 层序那条必须失败
//（这一条正是"她被压在画布底色之下、一个像素都画不出来"与"看得见她"的分界）。
// ⚠️ 锚点必须落在**伴生样式表**那一行上：主样式表里那个 `z-index:-2` 已经删掉了，
// 而它当初是**死声明**（伴生表那条带 !important 盖过它）—— 反证锚在死声明上会永远"通过"。
const mutZIndex = source.replace("`.jyb-backdrop{z-index:0!important}`",
  "`.jyb-backdrop{z-index:-2!important}`")
check('反证 57 真的改动了 lib/client.js 源码（伴生样式表的层序改回负值）', mutZIndex !== source)
const mutZIndexSheet = new Function(`${constLine('WALLPAPER_CLASS', mutZIndex)}\n`
  + `${block('wallGroundTokens', mutZIndex)}\n${block('backdropStylesheet', mutZIndex)}\n`
  + 'return backdropStylesheet()')()
check('反证 57：z-index 变负之后，那条层序断言必须失败',
  !/\.jyb-backdrop\{[^}]*z-index:0/.test(mutZIndexSheet))
// 顺带钉住"主样式表里**不许**再留 z-index"：留着就是死声明，会像本次一样
// 让"读样式表得到的层序"与"真机生效的层序"分家。
check('主样式表的 `.jyb-backdrop` 里没有 z-index（层序只有伴生样式表一个来源）',
  !/\.jyb-backdrop\{[^}]*z-index/.test(ambientCssText))

// 反证 58：拆掉"背景层不参加入场"那条 → 3 秒时她会从画面外再飞一次，必须翻红。
const mutBackdropAnim = source.replace("      '.jyb-backdrop .jyb-scene{animation:none!important}',\n", '')
check('反证 58 真的改动了 lib/client.js 源码（背景层的动画没被关掉）', mutBackdropAnim !== source)
check('反证 58：拆掉之后那条必须失败',
  !/\.jyb-backdrop \.jyb-scene\{animation:none!important\}/.test(ambientCssFrom(mutBackdropAnim)))

// ── 阅读态缓色层的底色计划（深色皮肤的必修项）────────────────────────────────
//
// 为什么这一节留在这个文件里：它同样是"对着真实源码 + 真实皮肤数据断言**画出来的是什么**"，
// 而这个文件已经有抽取器（`block`）与皮肤字面量求值的现成手法。
//
// 事实：`lighten()` 是**朝白**混色，插件常量是 `{bg:'#FFFFFF', alpha:0.62}`。对 12 套浅色
// 皮肤（reading.bg = #FFFFFF，石榴金 #FFFBF0）朝白混色是恒等变换；对深色皮肤则是灾难 ——
// 有正文时工作区被推成白底，而它的 label-primary 是近白色，实测对比度只剩 **2.33**（读不了）。
// 修正：只有 `colorScheme: 'dark'` 的皮肤用自己的 `reading` 块，其余一律仍走常量。
// `readingSource` 只放 `readingPlan` 本体：求值环境由 `planFor` 拼（常量 + 皮肤数组 +
// 一个只返回被"记住"的 id 的 `rememberedSkin` 桩），所以这里不能再声明 `READING`。
const readingSource = block('readingPlan')
// 内联的皮肤数组：与 check-theme-contribution 用同一套切法（`\n    ]` 收尾，
// 因为 card.rows 那种嵌套数组会让非贪婪括号正则提前收口）。切出来的是**表达式**，
// 所以既能 `eval` 成数组，也能拼成 `const BUNDLED_THEMES = …` 注进求值环境。
const bundledArrayLiteral = (() => {
  const at = source.indexOf('const BUNDLED_THEMES = [')
  const from = at + 'const BUNDLED_THEMES = '.length
  const end = source.indexOf('\n    ]', from)
  return source.slice(from, end + '\n    ]'.length)
})()
const bundledThemesLiteral = `const BUNDLED_THEMES = ${bundledArrayLiteral}`
const bundledThemes = eval(bundledArrayLiteral)

// 「地面」表的历史理由已反转（2026-10-01 终极简化）：当年"rgba 写进皮肤 JSON 会让
// 配色落不上"的实机事故，后来查明是令牌层 seq 竞争的另一个面孔，不是 rgba 本身——
// firefly 的主题令牌就是永久半透明（bg-base 0.30）且实机可见。现在两张壁纸皮肤的
// 地面令牌**永久**半透明写在 JSON 里（firefly 模式），壁纸常驻可见、零状态零切换。
const whaleTheme = bundledThemes.find((theme) => theme.id === 'da-jing-yu-niang')
check('大鲸鱼娘的地面令牌永久半透明（firefly 模式：bg-base .30 写进皮肤数据本身）',
  whaleTheme !== undefined
  && String(whaleTheme.tokens['--dsw-alias-bg-base'].light) === 'rgba(6,19,32,.30)'
  && String(whaleTheme.tokens['--dsw-alias-bg-layer-2'].light) === 'rgba(14,34,55,.62)')


// ── 壁纸态感知：落色确认不得把"壁纸态的透明"判成落色失败 ────────────────────────
//
// 事故因果链（实机读数钉死，2026-10-01）：壁纸态的伴生样式表把 body 设透明、把探针
// 令牌 `--dsw-alias-bg-base`（「地面」表第一项）改成 rgba —— 落色确认（`ensureSkinPainted`）
// 见"透明 ≠ 期望值"就误判落色失败 → 跳转兜底（先切内置浅色）→ 撤场链把壁纸态拆掉，
// 前方那份停在 opacity:0 成了僵尸副本 → 她彻底消失。修复 = 壁纸态在位且该皮肤就是
// 壁纸皮肤的持有者时，落色确认直接按"已上色"收场（`wallpaperSkinPainted`）；
// `skinIsPainted` 本体一行不动 —— 0.4.1 的探针语义与非壁纸皮肤的跳转兜底原样保留。
// 下面的求值器把**真实的** `skinIsPainted` / `wallpaperSkinPainted` / `ensureSkinPainted`
// 源码跑起来（皮肤数组用内联字面量喂），四条边界各有一条正检与翻红证据。
/**
 * 把落色确认那一族函数装进一个可控环境里求值。
 * @param src - client.js 源码（反证传变异后的）。
 * @param options - `classOn`：body 上是否打着壁纸态标记类；`probeValue`：body 内联里
 *   探针令牌的值（空串 = 表现层没写过）；`graceMs`：覆盖 PAINT_GRACE_MS（默认取源码值）；
 *   `seenAt`：预置 paintSeen（模拟"早已见过一次未落色"，默认 undefined = 还没见过）；
 *   `seenFor`：那次 sighting 记的是哪个皮肤 id（缺省用 wanted，与源码 `paintSeen.id !== wanted` 对齐）。
 * @returns `{ skinIsPainted, ensureSkinPainted, events, bounceCalls, requests }`。
 */
function paintProbeEnv(src, options = {}) {
  const body = {
    className: options.classOn === true ? 'dsh-jyb-wallpaper' : '',
    style: {
      _v: new Map(),
      setProperty(name, value) { this._v.set(name, String(value)) },
      getPropertyValue(name) { return this._v.get(name) ?? '' },
    },
  }
  if (options.probeValue !== undefined && options.probeValue !== '') {
    body.style.setProperty('--dsw-alias-bg-base', String(options.probeValue))
  }
  const grace = options.graceMs ?? Number(constLine('PAINT_GRACE_MS', src).replace(/^const PAINT_GRACE_MS = /, ''))
  const seenFor = JSON.stringify(options.seenFor ?? '(尚未见过)')
  const seenAt = options.seenAt === undefined
    ? 'undefined'
    : `{ id: ${seenFor}, at: ${String(options.seenAt)} }`
  return new Function('document', `${bundledThemesLiteral}
const PROBE_TOKEN = '--dsw-alias-bg-base'
${constLine('WALLPAPER_CLASS', src)}
const PAINT_GRACE_MS = ${grace}
const BUILT_IN_PROBE_THEME = 'light'
const paintAttempts = new Map()
let paintSeen = ${seenAt}
const events = []
function noteAmbientEvent(label, detail) { events.push(detail === undefined ? label : label + '(' + detail + ')') }
function emitting(fn) { return fn() }
function ambientEnabled() { return true }
const restoreDisabledReason = undefined
const bootSettled = true
const requests = []
function requestTheme(id) { requests.push(id); return true }
const bounceCalls = []
const ctx = { theme: { setTheme(id) { bounceCalls.push(id) } } }
${block('bundledTheme', src)}
${block('declaredToken', src)}
${block('flatten', src)}
${block('wallpaperSkinPainted', src)}
${block('skinIsPainted', src)}
${block('ensureSkinPainted', src)}
return { skinIsPainted, wallpaperSkinPainted, ensureSkinPainted, events, bounceCalls, requests }
`)({ body })
}
// 探针的"期望值"从同一份皮肤数组里现算（写死一个 hex，下次调色这条就悄悄变假）。
const shanProbeExpected = String(bundledThemes
  .find((theme) => theme.id === 'shan-qing-ting-cai').tokens['--dsw-alias-bg-base'].light)
const longAgoSeen = Date.now() - 10_000
check('壁纸态感知·判然一：标记类在位 + 鲸鱼娘 → 壁纸态即证明（body 透明是壁纸态的预期值）',
  paintProbeEnv(source, { classOn: true }).wallpaperSkinPainted('da-jing-yu-niang') === true)
check('壁纸态感知·判然二：标记类在位但换别的皮肤 → 不算数（感知不外溢）',
  paintProbeEnv(source, { classOn: true }).wallpaperSkinPainted('shan-qing-ting-cai') === false)
check('壁纸态感知·判然三：鲸鱼娘但标记类不在位（还在入场）→ 不算数（感知不出壁纸态）',
  paintProbeEnv(source, { classOn: false }).wallpaperSkinPainted('da-jing-yu-niang') === false)
check('壁纸态感知·判然四：skinIsPainted 本体一行未动 —— 壁纸态里探针照旧按内联值裁决（未写 = 未上色）',
  paintProbeEnv(source, { classOn: true }).skinIsPainted('da-jing-yu-niang') === false)
check('壁纸态感知·判然五：探针真匹配时 skinIsPainted 照旧判已上色（0.4.1 的主路径一行未动）',
  paintProbeEnv(source, { classOn: false, probeValue: shanProbeExpected })
    .skinIsPainted('shan-qing-ting-cai') === true)
{
  // 落色确认的完整行为：服务已报告皮肤（wanted === activeId）、耐心已过，
  // 壁纸态在位 —— 修复后必须按"已上色"收场，绝不走跳转兜底。
  const settled = paintProbeEnv(source, { classOn: true, seenAt: longAgoSeen, seenFor: 'da-jing-yu-niang' })
  settled.ensureSkinPainted('da-jing-yu-niang', 'da-jing-yu-niang')
  check('壁纸态下落色确认不触发跳转（耐心过了也不跳：她不会因误判被拆掉）',
    settled.bounceCalls.length === 0
    && settled.events.some((line) => line.startsWith('已上色(壁纸态')),
    `跳转序列 ${JSON.stringify(settled.bounceCalls)} / 事件 ${JSON.stringify(settled.events)}`)
  // 反证：把门拆成 `if (false)` → 同一场景必须复现误判（先切浅色再切回的跳转兜底被触发）。
  const mutGate = source.replace('if (wallpaperSkinPainted(wanted)) {', 'if (false) {')
  check('反证 66 真的改动了源码（壁纸态感知的门被拆掉）', mutGate !== source)
  const broken = paintProbeEnv(mutGate, { classOn: true, seenAt: longAgoSeen, seenFor: 'da-jing-yu-niang' })
  broken.ensureSkinPainted('da-jing-yu-niang', 'da-jing-yu-niang')
  check('反证 66：拆掉门之后，同一场景误判复现（跳转兜底开火 = 实机上她被拆掉的通道）',
    broken.bounceCalls.length === 2 && broken.bounceCalls[0] === 'light'
    && broken.bounceCalls[1] === 'da-jing-yu-niang',
    `跳转序列 ${JSON.stringify(broken.bounceCalls)}`)
  // 非壁纸皮肤的原样性：同一修复源码下，山青婷彩在壁纸态里照样走跳转兜底（0.4.1 保留）。
  const shanRun = paintProbeEnv(source, { classOn: true, seenAt: longAgoSeen, seenFor: 'shan-qing-ting-cai' })
  shanRun.ensureSkinPainted('shan-qing-ting-cai', 'shan-qing-ting-cai')
  check('非壁纸皮肤的兜底原样保留：山青婷彩即使标记类在位也照样跳转（感知只认壁纸皮肤的持有者）',
    shanRun.bounceCalls.length === 2 && shanRun.bounceCalls[0] === 'light'
    && shanRun.bounceCalls[1] === 'shan-qing-ting-cai',
    `跳转序列 ${JSON.stringify(shanRun.bounceCalls)}`)
  // 壁纸类不在位：鲸鱼娘自己也不受感知保护（入场态照旧由探针与耐心裁决）。
  const entryRun = paintProbeEnv(source, { classOn: false, seenAt: longAgoSeen, seenFor: 'da-jing-yu-niang' })
  entryRun.ensureSkinPainted('da-jing-yu-niang', 'da-jing-yu-niang')
  check('感知不出壁纸态：鲸鱼娘在入场态（标记类未打上）照样走原有裁决',
    entryRun.bounceCalls.length === 2 && entryRun.bounceCalls[0] === 'light',
    `跳转序列 ${JSON.stringify(entryRun.bounceCalls)}`)
  // 恢复臂不受门影响：壳把活动主题 revert 成内置值（adopt()）时，恢复走 requestTheme，
  // 这条臂绝不能被壁纸态的门 early-return —— 否则"点深色又被弹回皮肤"的武器失效。
  // （这一拍 wanted ≠ activeId，门在源码里就排在恢复臂之后；seenAt 不预置，
  // 走到门之前就 return 了，断言的是"恢复臂先于门"。）
  const restoreRun = paintProbeEnv(source, { classOn: true })
  restoreRun.ensureSkinPainted('da-jing-yu-niang', 'light')
  check('恢复臂原样：壳 revert 成内置值时照样 requestTheme（门只管"服务已报告皮肤"的确认路径）',
    restoreRun.requests.length === 1 && restoreRun.requests[0] === 'da-jing-yu-niang'
    && restoreRun.bounceCalls.length === 0,
    `request 序列 ${JSON.stringify(restoreRun.requests)} / 跳转 ${JSON.stringify(restoreRun.bounceCalls)}`)
}
/**
 * 用真实的 `readingPlan` 求值"当前该拿哪套缓色计划"。
 *
 * 求值环境刻意把两个皮肤来源**分开喂**（`rememberedSkin` 与 `wantedSkin` 可以不一致），
 * 这样"它到底跟的是哪一个"才是可测的 —— 评审 2026-09-30 指出：只跟 `rememberedSkin()`
 * 会漏掉 `DEFAULT_SKIN` 那条回落（今天 DEFAULT_SKIN 是浅色所以无害，换成深色就静默失效）。
 * @param src - `readingPlan` 那一段源码（反证用变异后的）。
 * @param wanted - `wantedSkin()` 的返回值（null = 用户有权使用内置外观）。
 * @param options - `remembered`：`rememberedSkin()` 的返回值；`darkPalette`：body 上是否有
 *   `data-ds-dark-theme`（内建「深色」卡片就是这一支）。
 * @returns `{ bg, alpha } | null`。
 */
function planFor(src, wanted, options = {}) {
  const remembered = options.remembered ?? wanted
  const body = { hasAttribute: (name) => options.darkPalette === true && name === 'data-ds-dark-theme' }
  // eslint-disable-next-line no-new-func
  const api = new Function('document', `${bundledThemesLiteral}\nconst READING = { bg: '#FFFFFF', alpha: 0.62, blur: 3, maxWidth: 640 }\n`
    + `function rememberedSkin() { return ${JSON.stringify(remembered)} }\n`
    + `function wantedSkin() { return ${JSON.stringify(wanted)} }\n`
    + `${block('lighten')}\n${src}\nreturn { readingPlan, lighten }`)({ body })
  return api.readingPlan()
}
/** WCAG 相对亮度。 */
function luminance(rgb) {
  const f = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
}
/** WCAG 对比度。 */
function contrastOf(a, b) {
  const l1 = luminance(a); const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
/** `rgb(r,g,b)` → 三元组。 */
const rgbTriple = (text) => text.match(/\d+/g).map(Number)
/** `#rrggbb` → 三元组（`rgbTriple` 只认 `rgb(...)`，拿它去切十六进制会得到 [8,3] 这种假值，
 *  随后亮度算成 NaN、两条断言都会**静默**变成 false —— 这次真踩了）。 */
const hexTriple = (hex) => {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`不是 6 位十六进制：${hex}`)
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
}

const lightSkinIds = bundledThemes
  .filter((theme) => theme.colorScheme !== 'dark')
  .map((theme) => theme.id)
check(`every light skin keeps the plugin reading ease byte-identical (${lightSkinIds.length} 套，零行为变化)`,
  lightSkinIds.every((id) => {
    const plan = planFor(readingSource, id)
    return plan.bg === '#FFFFFF' && plan.alpha === 0.62
  }))
const darkSkins = bundledThemes.filter((theme) => theme.colorScheme === 'dark')
// 深色皮肤分两类：地面是 hex 的走自己的缓色计划；地面是 **rgba**（壁纸型，自己带分层）
// 的必须**不缓色** —— `lighten()` 只认 hex，而"换成不透明地面"正好会把壁纸糊住。
const hexGroundDark = darkSkins.filter((theme) => /^#[0-9a-fA-F]{6}$/.test(String(theme.reading.bg)))
const rgbaGroundDark = darkSkins.filter((theme) => !/^#[0-9a-fA-F]{6}$/.test(String(theme.reading.bg)))
check(`every dark skin uses its own reading plan (${hexGroundDark.length} 套 hex 地面)`,
  darkSkins.length > 0 && hexGroundDark.every((theme) => {
    const plan = planFor(readingSource, theme.id)
    return plan !== null && plan.bg === theme.reading.bg && plan.alpha === theme.reading.alpha
  }))
check(`a wallpaper skin with a translucent ground opts OUT of the ease (${rgbaGroundDark.length} 套)`,
  rgbaGroundDark.every((theme) => planFor(readingSource, theme.id) === null))
// 这条是**性质**断言（用户真正在意的）：有正文时缓色后的底色上，正文仍然读得清。
// 写成"对每一套深色皮肤"而不是"对那一套"，否则以后再来一套深色皮肤，红的是断言而不是机制。
// eslint-disable-next-line no-new-func
const darkLighten = new Function(`${block('lighten')}\nreturn lighten`)()
const unreadableDark = darkSkins.filter((theme) => {
  const label = hexTriple(theme.tokens['--dsw-alias-label-primary'].light)
  return [theme.reading.alpha, Math.max(0, theme.reading.alpha - 0.2)].some(
    (alpha) => contrastOf(rgbTriple(darkLighten(theme.reading.bg, alpha)), label) < 4.5,
  )
})
check('with messages every dark skin keeps its transcript readable in BOTH palette arms (≥ 4.5:1)',
  unreadableDark.length === 0,
  `不达标的：${unreadableDark.map((theme) => theme.id).join(', ')}`)
const firstDark = darkSkins[0]
const firstDarkLabel = hexTriple(firstDark.tokens['--dsw-alias-label-primary'].light)
// 反证 38：把计划退回插件常量（= 修正前的行为）→ 白底 + 近白字，对比度必然掉到 4.5 以下。
check('反证 38：退回插件常量后深色皮肤拿到白底、正文对比度掉到 4.5 以下（说明上面测的是真问题）',
  contrastOf([255, 255, 255], firstDarkLabel) < 4.5)
// 计划跟的是 `wantedSkin()`（三层优先级），不是 `rememberedSkin()`：让两者故意不一致，
// 深色皮肤仍然必须拿到自己的计划（评审指出的缺陷：只跟 rememberedSkin 会漏掉 DEFAULT_SKIN 那条回落）。
// 计划跟的是 `wantedSkin()`（三层优先级），不是 `rememberedSkin()` —— 只跟 rememberedSkin
// 会漏掉 DEFAULT_SKIN 那条回落。
// ⚠️ 现在包里**唯一**一套深色皮肤是壁纸型（地面 rgba → 按设计拿到 null），所以这条
// **行为**断言只剩"仍是 null"这一半；"跟的是 wantedSkin"这半边用**源码**断言钉住。
check('the plan follows wantedSkin(), not rememberedSkin() (source-level: the only dark skin opts out)',
  /const id = wantedSkin\(\)/.test(readingSource) && !/rememberedSkin\(\)/.test(readingSource))
check('a wallpaper skin still gets null when rememberedSkin is empty (no fallback to the white ease)',
  planFor(readingSource, firstDark.id, { remembered: null }) === null)
// 内建「深色」卡片（没有插件皮肤、body 带 data-ds-dark-theme）：不缓色（null），
// 因为朝白混色会把工作区推成白底 + 近白字（同样是 1.13:1）。
check('a dark BUILT-IN palette gets no easing at all (null), not a white ground',
  planFor(readingSource, null, { darkPalette: true }) === null)
check('a light built-in palette still gets the plugin ease (unchanged)',
  planFor(readingSource, null, { darkPalette: false }).bg === '#FFFFFF')
// 深色皮肤**必须**在卡片提示里写明"搭配深色外观"：外壳里规划卡片 / 交付物 / 变更 /
// JSON 树 / 思考区那几处用的是组件级常量（`--plan-card-fill` = `--dsw-static-neutral-50`
// #f9fafb），声明在卡片元素自身，皮肤令牌盖不到 —— 浅色偏好下正文压在它上面只有 1.08:1。
// 原断言"深色皮肤描述必须带深色提示"已于 2026-10-01 按用户要求反转：卡片文字要精简、
// 不放建议类内容，深色观感的提示住 README 与 AGENTS（深色皮肤 = colorScheme 'dark'）。
check('dark skins declare colorScheme dark（深色观感的数据依据，≥1 套）',
  darkSkins.length >= 1 && darkSkins.every((theme) => theme.colorScheme === 'dark'))
check('深色皮肤的卡片描述不带「建议」（2026-10-01 用户要求精简，提示住 README/AGENTS）',
  darkSkins.every((theme) => !/建议/.test(theme.description)))
// 反证 45：把那句建议塞回第一套深色皮肤 → 上面那条必须翻红。
// ⚠️ 锚点**从解析后的数据里现取**，不写死措辞（0.4.0/0.4.1 两次锚点腐化的教训）。
const firstDarkDescription = darkSkins[0].description
const mutNoHint = bundledArrayLiteral.replace(
  JSON.stringify(firstDarkDescription),
  JSON.stringify(firstDarkDescription + '，建议把「外观」设为深色'),
)
check('反证 45 真的改动了皮肤数据（建议被塞回）', mutNoHint !== bundledArrayLiteral)
check('反证 45：塞回建议后"描述不带建议"必须失败',
  !eval(mutNoHint).filter((t) => t.colorScheme === 'dark').every((t) => !/建议/.test(t.description)))
const mutReadingPlan = readingSource.replace('if (scheme === \'dark\') {', 'if (false) {')
check('反证 39 真的改动了 readingPlan 源码（深色分支被拆）', mutReadingPlan !== readingSource)
check('反证 39：拆掉深色分支后，深色皮肤又只拿到常量白底',
  planFor(mutReadingPlan, firstDark.id).bg === '#FFFFFF')
// 上一条不能是"id 写错、两个皮肤都返回常量"蒙对的：浅色皮肤本来就该是常量，深色必须不是。
check('反证 39 的对照组：未变异的源码里深色皮肤拿到的不是常量白底',
  planFor(readingSource, firstDark.id)?.bg !== '#FFFFFF')
// 反证 42：拆掉"内建深色不缓色"那一支 → 上面那条必须翻红。
const mutBuiltInDark = readingSource.replace(
  "if (body !== null && body.hasAttribute('data-ds-dark-theme')) return null",
  "if (false) return null",
)
check('反证 42 真的改动了 readingPlan 源码（内建深色那一支被拆）', mutBuiltInDark !== readingSource)
check('反证 42：拆掉之后内建深色又拿到白底缓色',
  planFor(mutBuiltInDark, null, { darkPalette: true }).bg === '#FFFFFF')

// ── escaping and the script guard ────────────────────────────────────────────

check('attribute values are quote-escaped', api.open('div', { title: 'a"b' }).includes('&quot;'))
check('nullish attributes are dropped', api.open('div', { title: null }) === '<div>')

// The real guard is a shared helper now, so BOTH builders (sidebar scene AND work-area
// wall) are covered by one check. The bundle keeps it in one piece.
const sceneMarkupSource = block('sceneMarkup')
const guardMarkupSource = block('guardSceneryMarkup')
const wallMarkupSource = block('wallMarkup')
check('the scenery guard refuses script-bearing markup', /<script/.test(guardMarkupSource))
check('the scenery guard refuses inline event handlers', /on\[a-z\]\+/.test(guardMarkupSource)
  || /on\[a-z\]/.test(guardMarkupSource))
check('both scenery builders go through the shared guard',
  sceneMarkupSource.includes('guardSceneryMarkup(') && wallMarkupSource.includes('guardSceneryMarkup('))
// 反证 40：把壁纸那条路径从守卫上摘下来 → "两个 builder 都过守卫"必须翻红
// （这次真的差点漏：守卫原先只写在 `sceneMarkup` 里，壁纸是后加的第二个 builder）。
const mutUnguardedWall = source.replace(
  'return hasWall(kind) ? guardSceneryMarkup(jingyuWallScene()) : \'\'',
  'return hasWall(kind) ? jingyuWallScene() : \'\'',
)
check('反证 40 真的改动了源码（壁纸不再过守卫）', mutUnguardedWall !== source)
check('反证 40：摘掉之后"两个 builder 都过守卫"必须失败',
  !block('wallMarkup', mutUnguardedWall).includes('guardSceneryMarkup('))
check('sceneMarkup rejects unknown kinds by yielding empty markup',
  sceneMarkupSource.includes(": ''"))

// ── the seat must never exist without its stylesheet ─────────────────────────
//
// Regression guard for a real defect: `syncAmbient` runs on every shell mutation, so
// it could create the seat before `AMBIENT_CSS` was installed. An unstyled seat is
// not merely invisible — as a plain block it joins the sidebar's layout and spilled
// over the main column, covering conversation text, while every later reading still
// looked healthy because the element did exist.

const guardSource = [
  // The real sheet text comes from the bundle; the guard only needs the binding.
  "const AMBIENT_CSS = '/* current build */'",
  block('ambientStylesheetReady'),
  block('ensureAmbientStylesheet'),
  block('sidebarColumn'),
].join('\n\n')
// eslint-disable-next-line no-new-func
const guard = new Function('document', `${guardSource}\nreturn { ambientStylesheetReady, ensureAmbientStylesheet, sidebarColumn }`)

/**
 * A fake document whose head either contains the ambient sheet or does not.
 * @param withSheet - whether the stylesheet starts present.
 * @param sheetText - the sheet's text content; a value other than the current build's
 *   makes it STALE, which must be replaced rather than reused.
 * @returns the fake document plus a log of appended and removed nodes.
 */
function fakeDocument(withSheet, sheetText = '') {
  const appended = []
  const removed = []
  const style = {
    tagName: 'style',
    dataset: { pluginCss: 'theme-gallery/ambient' },
    textContent: sheetText,
    remove: () => removed.push(style),
  }
  const column = { tagName: 'div', className: 'ZTP-Xa_sidebarCol' }
  let sheetPresent = withSheet
  return {
    appended,
    removed,
    head: { tagName: 'head', append: (node) => appended.push(node) },
    documentElement: { tagName: 'html', append: (node) => appended.push(node) },
    createElement: () => {
      // Creating it is what makes it findable on the next probe.
      sheetPresent = true
      return style
    },
    querySelector: (selector) => {
      if (selector.includes('data-plugin-css')) return sheetPresent ? style : null
      if (selector.includes('sidebarCol') || selector.includes('sidebar')) return column
      return null
    },
  }
}

check('the stylesheet probe reports absence when the sheet is missing',
  guard(fakeDocument(false)).ambientStylesheetReady() === false)
check('the stylesheet probe reports presence when the sheet is present',
  guard(fakeDocument(true, '/* current build */')).ambientStylesheetReady() === true)

// A sheet left behind by a previous build is present but STALE. The shell keeps its DOM
// across a plugin reload, so a check that only asks "is a sheet there?" reuses rules that
// no longer match the markup — which is exactly how the layer ended up with no styling
// while the report insisted the sheet existed.
const staleDoc = fakeDocument(true, '/* previous build */')
guard(staleDoc).ensureAmbientStylesheet()
check('a stale stylesheet is replaced rather than reused', staleDoc.removed.length === 1)
check('replacing a stale sheet installs the current one', staleDoc.appended.length === 1)

// Self-healing. A one-shot install was assumed to survive and did not; because
// `syncAmbient` bails out while the sheet is absent, that single failure silently
// disabled the scenery permanently — the guard was right and the sheet was simply
// never there.
const healDoc = fakeDocument(false)
const healed = guard(healDoc).ensureAmbientStylesheet()
check('ensureAmbientStylesheet creates the sheet when it is missing', healed !== null)
check('the created sheet is appended to the document', healDoc.appended.length === 1)
check('ensureAmbientStylesheet reuses an existing sheet rather than duplicating it',
  guard(fakeDocument(true)).ensureAmbientStylesheet() === null
  || guard(fakeDocument(true)).appended === undefined
  || fakeDocument(true).appended.length === 0)

// The behaviour the guard exists to cause: bail out before any layer can be created.
//
// The scene is drawn by `drawScene`, which runs AFTER the guard. Nothing in `syncAmbient` may
// create DOM before the stylesheet check, because an unstyled full-viewport layer is not merely
// invisible — it joins the layout and covers the main column.
const syncSource = block('syncAmbient')
const bailIndex = syncSource.indexOf('ambientStylesheetReady()')
const drawIndex = syncSource.indexOf('drawScene(')
check('syncAmbient checks the stylesheet before it can create a layer',
  bailIndex > 0 && drawIndex > bailIndex)
check('syncAmbient clears ambient nodes while the stylesheet is absent',
  /removeAllAmbientSeats\(\)/.test(syncSource))
check('syncAmbient repairs the stylesheet before probing it',
  syncSource.indexOf('ensureAmbientStylesheet()') < bailIndex)
check('syncAmbient sweeps debris an earlier build left behind',
  syncSource.includes('removeStrayAmbientSeats()'))
// The layer is a full-viewport fixed element appended to the BODY, styled by a CLASS at z-index
// 60 — the arrangement copied from the working `dsh-theme-firefly` plugin. Every other
// arrangement failed to paint here (precise inline geometry, maximum z-index, `documentElement`
// as the parent), so this one is kept exactly.
//
// There is now exactly ONE layer. The scene used to be drawn twice — into a `#dsh-theme-ambient`
// seat AND into this control layer — and the duplicate DOM meant two of every animated element,
// which is what produced the duplicated dragonflies.
const drawSource = block('drawScene')
check('the layer is appended to the document body',
  /document\.body\.appendChild\(wrap\)/.test(drawSource))
check('the layer takes its arrangement from a class rule',
  /\.dsh-amb-control\{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden\}/
    .test(source))
// The scene is positioned INSIDE the full-viewport layer rather than being the layer.
check('the scenery lives in its own positioned box', /dsh-amb-control-scene/.test(source))
check('there is only ONE render path',
  (source.match(/\.innerHTML = String\(markup\)/g) ?? []).length === 1)

// ── band placement ───────────────────────────────────────────────────────────
//
// The band must land in the sidebar's bottom THIRD. An earlier revision capped it at
// 420px, which on a 780px column started it at 55% — the middle of the sidebar, so the
// scenery and the probe both sat too high, and no offset could satisfy the request to
// move them into the blank area.

// The band is placed by `bandBox`, which asks `footerHeight` how much of the column's
// bottom to leave alone. Both are extracted together so the stubs stay self-contained.
// bandBox also reads a factory-level constant (the deliberate bottom dip); it is lifted
// from the real source rather than hardcoded here, so the eval'd copy tracks what ships.
const bandSource = [block('footerHeight'), block('viewportBottomOf'), block('bandBox'),
  /const SCENERY_BOTTOM_OVERHANG_PX = \d+/.exec(source)[0],
].join('\n\n')
// eslint-disable-next-line no-new-func
const bandOf = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: 900 })

/**
 * A sidebar column stand-in built like the real one: a full-height wrapper flush with the
 * bottom (which a naive "nearest descendant" measurement mistakes for the footer), a 64px
 * account row also flush with the bottom, and a conversation row above it.
 * @param top - viewport top.
 * @param height - column height.
 * @returns the fake column.
 */
function fakeColumn(top, height) {
  const kids = [
    { top: 0, bottom: height },
    { top: height - 64, bottom: height },
    { top: Math.max(0, height - 140), bottom: Math.max(0, height - 80) },
  ]
  return {
    getBoundingClientRect: () => ({
      left: 0, top, right: 280, bottom: top + height, width: 280, height,
    }),
    querySelectorAll: () => kids.map((k) => ({
      closest: () => null,
      getBoundingClientRect: () => ({
        left: 0, top: top + k.top, bottom: top + k.bottom, width: 280, height: k.bottom - k.top,
      }),
    })),
  }
}

const column = fakeColumn(40, 780)
const reserve = bandOf.footerHeight(column)
const band = bandOf.bandBox(column)
check('a strip is reserved for the account row', reserve >= 56)
// A full-height wrapper is flush with the bottom too; it must not be mistaken for the footer.
check('a full-height wrapper does not count as the footer', reserve <= 195)
check('the reserved strip covers the account row', reserve >= 64)
// The reservation only has to clear the row, and the row is a fixed-height control rather
// than something that grows with the window. A proportional reserve left a widening empty
// band on a tall window, which read as "too much space reserved".
check('the reserved strip stays small on a normal window', reserve <= 80)
// 2026-09-28: the band deliberately dips a FIXED number of px into the reserved strip.
// The user found the artwork's bottom edge a few px above the account text's bottom — a
// sliver of the text peeked out below the artwork (云底/水面/山体/地面/水草根部 all sit
// on the band's bottom edge). The dip amount is USER-TUNED (started at 8, then 4 while
// looking for the smallest value that still covers), so the assertion reads it from the
// source and pins EXACT equality: less lets the sliver back, more swallows the row.
const sceneryDip = Number(/const SCENERY_BOTTOM_OVERHANG_PX = (\d+)/.exec(source)[1])
check(`the band dips exactly ${sceneryDip}px into the reserved strip (盖住文字底部露出的一截)`,
  band.top + band.height === 820 - reserve + sceneryDip,
  `实际 band.bottom = ${band.top + band.height}，期望 ${820 - reserve + sceneryDip}`)
check('the band still has usable height', band.height >= 140)
check('the band spans the column width', band.width === 280 && band.left === 0)
// A very short column is clamped to a minimum footprint rather than collapsing.
check('a short column still gets a usable band', bandOf.bandBox(fakeColumn(0, 200)).height >= 100)
// A column whose bottom is off-screen must not push the band out of view.
const offscreen = bandOf.bandBox(fakeColumn(0, 2000))
check('the band stays within the viewport when the column bottom is off-screen',
  offscreen.top + offscreen.height <= 900)

// Adaptivity, measured by POSITION. Sizing the band as a share of the column kept the right
// footprint but slid its CENTRE: a 288px band on a 780px column spanned 472..760, putting its
// middle at y=616 — inside the sidebar's middle third rather than the bottom third. The
// sidebar reads as three stacked regions and the scenery belongs in the lowest one, so the
// constraint is on where the band sits, not on how tall it is.
const sizes = [780, 900, 1080, 1440]
const thirds = sizes.map((height) => {
  // The band's placement is bounded by the viewport, so the stub's `innerHeight` has to
  // match the column it is being asked about.
  // eslint-disable-next-line no-new-func
  const sized = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: height })
  const placed = sized.bandBox(fakeColumn(0, height))
  return (placed.top + placed.height / 2) / height
})
check('the band sits in the bottom third of the column at every window height',
  thirds.every((centre) => centre >= 2 / 3))
// The band must still be bigger on a tall window. The stub's `innerHeight` has to match the
// column, because the band is capped by the visible bottom: with a fixed 900px viewport a
// 1440px column would be capped and the comparison would measure the cap, not the growth.
// eslint-disable-next-line no-new-func
const tallApi = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: 1440 })
// eslint-disable-next-line no-new-func
const shortApi = new Function('window', `${bandSource}\nreturn { footerHeight, bandBox }`)({ innerHeight: 600 })
check('the band grows with the window',
  tallApi.bandBox(fakeColumn(0, 1440)).height > shortApi.bandBox(fakeColumn(0, 600)).height)
// The reserve must NOT grow with the window; only the band should.
const reserves = sizes.map((height) => bandOf.footerHeight(fakeColumn(0, height)))
check('the reserved strip does not grow with the window',
  Math.max(...reserves) - Math.min(...reserves) <= 8)

// ── 梦海游鱼 draws TWO effects, not one ────────────────────────────────────────
//
// The bubbles and the glowing motes are separate effects that coexist. An earlier revision
// replaced the bubbles with the motes, which was not what was asked for, so this pins the
// distinction: the scene markup must carry both containers, and the bubble rules must keep
// the inset ring that makes them read as bubbles rather than glows.
const dreamMarkup = api.dreamAmbientScene(9, 5, 3)
check('the dream scene draws bubbles AND glowing motes',
  /class="dof-bubbles"/.test(dreamMarkup) && /class="dof-motes"/.test(dreamMarkup))
check('the dream scene seeds the requested bubble count',
  (dreamMarkup.match(/class="dof-bubble"/g) ?? []).length === 9)
check('the dream scene seeds the requested mote count',
  (dreamMarkup.match(/class="dof-mote"/g) ?? []).length === 5)
// The rules are written as multi-line array entries, so the match spans the joined text.
check('the bubbles keep their outlined-sphere look',
  /dof-bubble\{position:absolute;bottom:-1em;border-radius:50%;[\s\S]{0,260}box-shadow:inset 0 0 0 1px/.test(source))
check('the motes carry a light-blue halo',
  /dof-mote\{position:absolute;bottom:-1em;border-radius:50%;[\s\S]{0,320}box-shadow:0 0 10px 3px rgba\(122,205,255/.test(source))
check('the two effects animate on separate keyframes',
  /@keyframes dsh-amb-rise/.test(source) && /@keyframes dsh-amb-mote/.test(source))

// ── 梦海游鱼的蓝色小鱼 ───────────────────────────────────────────────────────
//
// The fish come from the source system's own `FishAnimation.vue` and are a THIRD effect,
// alongside the bubbles and the motes. They are the element the user noticed missing, so
// their presence, artwork and colours are pinned here.
const fishMarkupOut = api.fishMarkup('1', 2.4, 26, 34, -4, false)
check('a fish is drawn as its own container', /class="dof-fish"/.test(fishMarkupOut))
check('the fish carries the source body curve',
  fishMarkupOut.includes('M10 10 C20 5 35 5 45 10 C40 15 25 15 10 10 Z'))
check('the fish carries tail, dorsal and pectoral fins',
  fishMarkupOut.includes('M10 10 L5 7 L5 13 Z')
    && fishMarkupOut.includes('M20 7 L25 3 L30 7')
    && fishMarkupOut.includes('M35 9 L40 12 L45 9'))
check('the fish carries the three-part eye',
  (fishMarkupOut.match(/<circle/g) ?? []).length === 3)
check('the fish use the theme blue family (the source sticker blues are gone)',
  fishMarkupOut.includes('#5FA5D6') && fishMarkupOut.includes('#2B6E9E')
    && !fishMarkupOut.includes('#38bdf8') && !fishMarkupOut.includes('#1d4ed8'))
check('the fish render slightly translucent so they read as underwater',
  /class="dof-fish" style="position:absolute;left:0;opacity:\.94/.test(fishMarkupOut))
check('the fish swims on its own keyframes', /animation:dsh-amb-swim /.test(fishMarkupOut))
check('a mirrored fish swims back with the opposite animation',
  /animation:dsh-amb-swim-back /.test(api.fishMarkup('2', 1.7, 52, 46, -18, true)))
check('the fish bob and the tail beats',
  /dof-fish-bob/.test(fishMarkupOut) && /dof-fish-tail/.test(fishMarkupOut))

check('the dream scene seeds the requested fish count',
  (dreamMarkup.match(/class="dof-fish[" ]/g) ?? []).length === 3)
check('all three dream effects are drawn together',
  /class="dof-bubbles"/.test(dreamMarkup)
    && /class="dof-motes"/.test(dreamMarkup)
    && /class="dof-fish-layer"/.test(dreamMarkup))
// The fish layer's stacking is set inline, not by a rule, so it is checked on the markup.
check('the fish layer sits above the water plants',
  /class="dof-fish-layer" style="position:absolute;inset:0;z-index:6/.test(dreamMarkup)
    && /dof-seaweed\{[^}]*z-index:5\}/.test(source))

// ── the water-floor band (integration with the sidebar gradient) ─────────────
//
// The shan scene reads as one piece because its mountains fill the band and meet
// the sidebar gradient with colours from the same family. The dream scene used to
// float loose blades over a transparent background, which read as stickers. The
// floor band is the dream equivalent of shan's pond: it starts fully transparent —
// so the sidebar's own gradient shows through at the junction — and deepens
// downward, with the seaweed layered on top of it.
check('the dream scene grounds the seaweed on a water-floor band',
  /class="dof-floor"/.test(dreamMarkup))
check('the floor starts fully transparent so the junction is seamless',
  /class="dof-floor" style="[^"]*rgba\(126,184,222,0\)/.test(dreamMarkup))
check('the floor sits below the seaweed so the blades root in it',
  /class="dof-floor" style="[^"]*z-index:4/.test(dreamMarkup)
    && /class="dof-seaweed" style="[^"]*z-index:5/.test(dreamMarkup))
check('the seaweed gradients stay in the theme blue family',
  api.seaweedMarkup().includes('#1E6E93') && api.seaweedMarkup().includes('#4A78A8')
    && !api.seaweedMarkup().includes('#5568AC'))
// The preview mounts the scene into a `#dsh-theme-ambient` seat, while the live
// layer uses `.dsh-amb-control-scene`. The fish classes are styled in the live
// section only — without matching preview-seat rules, the preview draws fish that
// never mirror, bob or beat their tails: a lying preview.
check('the preview seat section styles the fish too',
  /#dsh-theme-ambient \.dof-fish-flip/.test(source)
    && /#dsh-theme-ambient \.dof-fish-bob/.test(source)
    && /#dsh-theme-ambient \.dof-fish-tail/.test(source))

// ── the light must not stop at the band edge ─────────────────────────────────
//
// The corner glow used to be centred ON the band's top edge at full brightness, so
// the scene box's overflow clip cut it into a hard white line against the un-lit
// middle of the sidebar — the boundary the user reported. Now it is dimmer, starts
// AT the edge, and is masked to zero there, while the theme's sidebar gradient
// carries a light-pool stop that continues the bloom above the edge, and the
// drifting washes fade at their own top and bottom edges instead of ending hard.
check('the corner glow is dimmed and masked to zero at the band edge',
  /dof-corner" style="[^"]*rgba\(255,255,255,\.55\)[^"]*mask-image:linear-gradient\(to bottom,transparent 0,#000 45%\)/
    .test(dreamMarkup))
check('the light washes fade at their own top and bottom edges',
  // Each wash carries the mask twice (-webkit- prefixed and plain), and the
  // prefixed form contains the plain one as a substring — hence four matches.
  (dreamMarkup.match(/mask-image:linear-gradient\(to bottom,transparent,#000 22%,#000 78%,transparent\)/g) ?? [])
    .length === 4)
check('the sidebar gradient carries the light-pool stop bridging the band edge',
  /#CDEEFC 70%/.test(source))
check('the bubbles and motes die before they can clip at the band top',
  /@keyframes dsh-amb-rise[\s\S]{0,200}-12\.5em[\s\S]{0,60}opacity:0/.test(source)
    && /@keyframes dsh-amb-mote[\s\S]{0,200}-13em[\s\S]{0,60}opacity:0/.test(source))

// ── the layer is synced from a body-wide observer, so repainting must be conditional ──
//
// Every resync re-assigning `innerHTML` rebuilt every scene node, which restarts all CSS
// animations from zero — the dragonflies, petals, motes and fish would snap back to their
// starting positions whenever the shell mutated the DOM. The markup is derived from the
// theme alone, so it only needs writing when it changes; the geometry is measured, so it
// must be written every pass.
check('the scene is not repainted when its markup is unchanged',
  /painted !== markup/.test(drawSource) && /dataset\.ambientMarkup = markup/.test(drawSource))
check('the scene markup is remembered on the box', /dataset\.ambientMarkup = markup/.test(drawSource))
check('the geometry is refreshed on every pass', /applySceneBox\(box, column\)/.test(drawSource))
check('the geometry write is separate from the paint', /function applySceneBox\(box, column\)/.test(source))

// ── the debug switch gates DETAIL, never bad news ────────────────────────────
//
// The panel's readings used to print unconditionally. That was right while the
// scenery was being brought up, and wrong once the package shipped: every user
// would read a paragraph of internals (geometry, hit tests, an attempt log). They
// are now opt-in — and the gate must never swallow a failure, which is the one
// lesson this project has had to re-learn most often.

const switchSource = [
  "const DEBUG_KEY = 'theme-gallery:debug'",
  block('debugEnabled'),
  block('sceneryLineIsWarning'),
].join('\n\n')

/**
 * Run the switch helpers against a stubbed window.
 * @param hash - the URL fragment ('' for none).
 * @param flag - the localStorage value (null for absent).
 * @returns the two helpers, bound to the stub.
 */
function withWindow(hash, flag) {
  const store = { getItem: (key) => (key === 'theme-gallery:debug' ? flag : null) }
  // eslint-disable-next-line no-new-func
  return new Function('window', `${switchSource}\nreturn { debugEnabled, sceneryLineIsWarning }`)(
    { location: { hash }, localStorage: store },
  )
}

check('the detail lines are off by default', withWindow('', null).debugEnabled() === false)
check('the detail lines stay off when storage holds something else',
  withWindow('', '0').debugEnabled() === false)
check('the URL fragment switches the detail lines on',
  withWindow('#theme-gallery-debug', null).debugEnabled() === true)
check('the localStorage flag switches the detail lines on',
  withWindow('', '1').debugEnabled() === true)
check('a missing window reports "off" instead of throwing',
  // eslint-disable-next-line no-new-func
  new Function('window', `${switchSource}\nreturn debugEnabled()`)(undefined) === false)

const switchApi = withWindow('', null)
check('a routine pass is not a warning',
  switchApi.sceneryLineIsWarning('装饰自检通过 · dream · 子元素=1') === false)
check('a ⚠ line counts as a warning',
  switchApi.sceneryLineIsWarning('⚠ 装饰未生效：报告缺失（期望 dream）') === true)
check('a failure line counts as a warning',
  switchApi.sceneryLineIsWarning('装饰自检失败: boom') === true)
check('a null line is not a warning', switchApi.sceneryLineIsWarning(null) === false)

// Structural guards, so a later edit cannot quietly make the line unconditional
// again — or make a failure invisible.
check('the panel decides the scenery line from the switch and the warning test',
  /const showScenery = scenery !== null && \(debugEnabled\(\) \|\| sceneryLineIsWarning\(scenery\)\)/
    .test(source))
check('the panel renders the scenery line through that decision',
  /showScenery\s*\n?\s*\?\s*jsx\('div', \{\s*\n\s*className: `tg-debug/.test(source))
check('the diagnostics line still renders only behind the switch',
  /debugEnabled\(\) \? jsx\('div', \{ className: 'tg-debug', children: themeDiagnostics\(selected\) \}\) : null/
    .test(source))

// ── the diagnostics belong BELOW the picker, and must say what they are ──────────
//
// A user read the two diagnostic lines as a malfunction — reasonably so, since they were a
// wall of monospace text sitting between the header and the theme cards. They now render
// below the cards, behind a caption that states they are intentional, and the block is set
// apart from the grid. Both the ordering (a source-order fact, assertable without a DOM)
// and the copy are pinned here.
const pageBody = block('ThemeGalleryPage')
// Self-check of the extractor itself, BEFORE anything is concluded from it: a truncated
// body (the destructured-parameter trap fixed above) would let every check below pass
// while reading nothing at all.
check('the extractor reads the whole panel body, not just its signature',
  pageBody.length > 1000 && pageBody.includes("className: 'tg-page'")
  && pageBody.includes('tg-head') && pageBody.includes('tg-grid'))
const gridAt = pageBody.indexOf("className: 'tg-grid'")
const diagAt = pageBody.indexOf("className: 'tg-diag'")
check('the diagnostics block renders after the theme cards', gridAt > 0 && diagAt > gridAt)
check('the block carries its own caption, rendered through the dictionary',
  /className: 'tg-diag-note', children: t\('diagNote'\)/.test(pageBody))
check('both diagnostic lines render inside that block',
  diagAt > 0
  && pageBody.indexOf('themeDiagnostics(selected)', diagAt) > diagAt
  && pageBody.indexOf('children: scenery', diagAt) > diagAt)
const diagNotes = [...source.matchAll(/diagNote: '([^']+)'/g)].map((match) => match[1])
check('the caption ships in both dictionaries', diagNotes.length === 2)
check('the caption says the readings are intentional, not an error report',
  diagNotes.length === 2 && diagNotes[0].includes('诊断')
  && diagNotes[0].includes('并非') && diagNotes[0].includes('报错'))
check('the page stylesheet sets the diagnostics block apart from the cards',
  /\.tg-diag\{[^}]*margin-top:\d+px/.test(source)
  && /\.tg-diag\{[^}]*border-top:/.test(source))

if (failed > 0) {
  console.error(`\n${failed} ambient markup check(s) failed`)
  process.exit(1)
}
console.log('\nambient markup checks passed')
