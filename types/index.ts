/**
 * 宿主半侧的 TypeScript 源（编译期契约校验用，不参与运行）。
 *
 * 运行的是 lib/index.js。本文件用官方真实类型验证 schemastery 的
 * `z.array` / `z.object` / `z.dict` / `z.union` 组合、`required()` 的显式必填、
 * 静态 `z.resolve()` 的形状、以及 `ctx.inject(['settings'], ...)` +
 * `settings.register()` 的注册契约。
 */
import z from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
// 类型导入：拉入 ctx.settings 服务的声明合并（SettingsProvider）。
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'

/** 宿主上下文 + settings 服务（服务由 @deepseek-ai/dsh-settings 注入）。 */
type HostContext = Context & { settings: SettingsProvider }

/** 承载主题定义的 settings 命名空间。 */
export const THEME_GALLERY_NAMESPACE = 'theme-gallery'

/** 主题底板可选的配色方案。 */
export const COLOR_SCHEMES = ['light', 'dark'] as const

/**
 * 单个 token 覆写：两种配色都必须给值。
 *
 * `required()` 必须显式调用——schemastery 的对象字段**默认可选**，
 * 不写的话缺 `dark` 的对象会一路穿过 settings 边界，直到浏览器里才炸。
 */
export const TokenModesSchema = z.object({
  light: z.string().required(),
  dark: z.string().required(),
})

/** 阅读态声明：会话有消息后主题如何退后。 */
export const ReadingSchema = z.object({
  colorScheme: z.union([...COLOR_SCHEMES]).required(),
  bg: z.string().required(),
  alpha: z.number().required().min(0).max(1),
  blur: z.number().required().min(0).max(40),
  maxWidth: z.number().required().min(320).max(1600),
})

/**
 * 侧栏氛围装饰：主题可选请求的场景（只有插件实际带素材的几种可寻址）。
 *
 * ⚠️ `kind` **故意不写 `.required()`**：`ambient` 本身是可选字段，而上面那条实测过的
 * 机制会让"可选对象里的必填字段"把**外层**变成事实上的必填 —— 于是**有意不配素材**的
 * 那一类皮肤（纯色/拼色）会被这道校验判为非法。而"有 `ambient` 就必须有合法 `kind`"
 * 这条真正的约束由 `scripts/embed-themes.mjs` 的 `AMBIENT_KINDS` 在**建期**强制，
 * 它比这里严格（未知 kind 直接失败），并且发布 CI 一定会跑。
 */
export const AmbientSchema = z.object({
  kind: z.union(['shan', 'dream', 'caiyun', 'dongyun', 'junyue', 'jiexin', 'fengchen', 'humao', 'ahuang']),
  petals: z.number().min(0).max(20),
  bubbles: z.number().min(0).max(24),
  // 淡蓝荧光光点：与气泡是不同的特效，两者同时绘制，故各自独立计数。
  motes: z.number().min(0).max(24),
  // 游动的蓝色卡通小鱼：第三种独立特效（源自原系统的 FishAnimation 组件）。
  fish: z.number().min(0).max(6),
  // 营慕彩云 / 徐山军月的星光。
  stars: z.number().min(0).max(30),
  // 江畔冬云的细雪。
  snow: z.number().min(0).max(30),
  // 佩安杰心的浮尘光点；琥珀猫咪的阳光浮尘；虎子阿黄的蒲公英绒毛（同一计数旋钮）。
  dust: z.number().min(0).max(20),
  // 光彩凤晨的凤羽与晨露：两种独立特效，各自计数。
  feathers: z.number().min(0).max(16),
  dew: z.number().min(0).max(30),
})

/**
 * 配色选择器的一排：等宽的可点色值按钮。
 *
 * 形状由 schemastery 表达（`kind` 两态 + `schemes` 字符串数组），**跨字段规则**——最后一排
 * 必须是拼色、一排几个、引用的方案必须存在、方案种类要与排一致、圆点与正文的对比度——
 * 都只写在 `scripts/lib/card-rows.mjs` 一处，由建期（`embed-themes`）与测试
 * （`check-card-order`）共用。在类型层重复一遍规则，只会多出第二份会漂移的实现。
 *
 * ⚠️ 除 `kind` 外**不要加 `.required()`**：schemastery 里"可选对象内的必填字段"会让
 * **外层对象**变成事实上的必填。实测读数（`tests/check-schema.mjs` 里同一条）：
 *
 *     z.object({ outer: z.object({ inner: z.string().required() }) })  解析 {} → 抛
 *                                                                     $.outer.inner missing required value
 *     z.object({ outer: z.object({ inner: z.string() }) })             解析 {} → {"outer":{}}
 *
 * 也就是说"外层可选、内层必填"在这个库里表达不出来；照直写会**静默地把合法主题判为非法**。
 * 这个文件必须在这里声明 `card`，哪怕当前的 settings provider 没有人读取：schemastery 对
 * 未知键是**直接丢弃**（实测），所以走文件型 provider 校验过的主题会**悄悄丢掉配色选择器**、
 * 回落成默认色带 —— 而"看起来只是样式不一样"正是本项目最贵的那类失败。
 */
export const CardRowSchema = z.object({
  kind: z.union(['solid', 'clash']).required(),
  /** 一排 1–5 个方案 id（`p-…`）。颜色与点击目标都从 `lib/palette-schemes.json` 来。 */
  schemes: z.array(z.string()),
})

/** 卡片上的配色选择器（纯色/拼色 一类；不写就是默认的单条 3 色色带）。 */
export const CardSchema = z.object({
  rows: z.array(CardRowSchema),
})

/** 一个可选主题。 */
export const ThemeDefinitionSchema = z.object({
  id: z.string().required().pattern(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().required(),
  description: z.string().required(),
  colorScheme: z.union([...COLOR_SCHEMES]).required(),
  tokens: z.dict(TokenModesSchema).required(),
  reading: ReadingSchema,
  // 激活态强调色：与 alpha 后缀拼接使用，故必须是 6 位十六进制字面量。
  accent: z.string().pattern(/^#[0-9a-fA-F]{6}$/),
  ambient: AmbientSchema,
  card: CardSchema,
})

/** 持久化的 theme-gallery 段。 */
export const ThemeGallerySchema = z.object({
  themes: z.array(ThemeDefinitionSchema),
})

/**
 * 注册持久化的 theme-gallery 段。
 * @param ctx - 宿主上下文；composed 了 settings 服务时才会挂载。
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    // z.resolve 是**静态**方法（签名 resolve(data, schema, options, strict?)），
    // 不是实例方法：schema.resolve(...) 不存在。返回 [输出值, 适配后的输入?]；
    // 非法值时它**抛 ValidationError**，第二个元素只是适配提示，不是错误标志。
    const [value] = z.resolve({
      id: 'demo',
      label: 'Demo',
      description: 'A demo theme',
      colorScheme: 'light',
      tokens: { '--dsw-alias-bg-base': { light: '#fff', dark: '#000' } },
      reading: { colorScheme: 'light', bg: '#fff', alpha: 0.62, blur: 3, maxWidth: 640 },
    }, ThemeDefinitionSchema, {}, true)
    if (value === undefined) throw new Error('schema resolved to undefined')
    const host = settingsCtx as HostContext
    host.settings.register(THEME_GALLERY_NAMESPACE, ThemeGallerySchema)
  })
}
