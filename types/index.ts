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

/** 侧栏氛围装饰：主题可选请求的场景（只有插件实际带素材的几种可寻址）。 */
export const AmbientSchema = z.object({
  kind: z.union(['shan', 'dream']).required(),
  petals: z.number().min(0).max(20),
  bubbles: z.number().min(0).max(24),
  // 淡蓝荧光光点：与气泡是不同的特效，两者同时绘制，故各自独立计数。
  motes: z.number().min(0).max(24),
  // 游动的蓝色卡通小鱼：第三种独立特效（源自原系统的 FishAnimation 组件）。
  fish: z.number().min(0).max(6),
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
