/**
 * Host half of the theme pack.
 *
 * This half registers the `theme-gallery` settings namespace — **a reserved
 * extension point that nothing reads today.** It is kept, and kept honest:
 *
 * - The desktop profile composes its settings provider as `path: ':memory:'`, so
 *   a hand-written `$DSH_HOME/settings.yaml` is archived as `settings.yaml.imported`
 *   and never consulted. A person who follows an older revision of this README and
 *   writes themes into that file will see nothing happen.
 * - The browser half no longer reads this section either: themes are registered
 *   with `ctx.theme.register`, and the bundled `lib/themes/*.json` list is the
 *   only source. Selection is persisted by the theme service itself.
 *
 * What remains is the landing place for a **file-backed** settings provider: the
 * schema below is what such a provider would validate, so the shape is pinned and
 * tested even though no runner consumes it yet.
 *
 * Registered with no schema `default`, deliberately: a fresh settings document then
 * stays free of the section rather than being pre-populated with the bundled list.
 *
 * The bundled files are validated at build time (`npm run check`), not here — the
 * browser half is the side that turns them into real themes, and it ships them
 * inlined.
 */
import z from '@deepseek-ai/schemastery'

/** Settings namespace owning the theme definitions. */
export const THEME_GALLERY_NAMESPACE = 'theme-gallery'

/** Color schemes accepted as a theme's base palette. */
export const COLOR_SCHEMES = ['light', 'dark']

/**
 * One token override: both schemes are mandatory because the same definition is
 * reused when the user flips the color scheme, and a single value would then go
 * illegible. The theme service throws a TypeError on a bare string.
 *
 * `required()` is explicit: schemastery treats object members as optional by
 * default, so an omitted `dark` would otherwise sail through the settings
 * boundary and only fail later, in the browser, as a registration error.
 */
export const TokenModesSchema = z.object({
  light: z.string().required().description('Value applied while the light base palette is active.'),
  dark: z.string().required().description('Value applied while the dark base palette is active.'),
})

/**
 * The reading state: what a theme looks like once a conversation has messages.
 *
 * The whole point of a skin is that it covers the screen — which is also what
 * makes a long conversation tiring to read. So a theme may declare how it
 * recedes: the card the transcript sits on, and how strongly it reads over the
 * theme fill. `bg` is lightened toward white while light, so a gradient or
 * tinted fill still shows around the card instead of being painted over.
 */
export const ReadingSchema = z.object({
  colorScheme: z.union([...COLOR_SCHEMES]).required()
    .description('Color scheme the transcript card is rendered in.'),
  bg: z.string().required()
    .description('Card base color; lightened toward white at `alpha`.'),
  alpha: z.number().required().min(0).max(1)
    .description('How opaque the card is over the theme fill. Higher reads better; lower keeps the skin visible.'),
  blur: z.number().required().min(0).max(40)
    .description('Backdrop blur in px behind the card.'),
  maxWidth: z.number().required().min(320).max(1600)
    .description('Transcript column width in px while reading.'),
})

/**
 * Sidebar scenery a theme may ask for.
 *
 * The value is a data key rather than an asset path: the browser half renders each
 * kind from inline SVG ported from the source admin system, so only the scenes it
 * actually carries are addressable. A theme without this field draws nothing —
 * the scenery belongs to the skin, not to the app.
 */
export const AmbientSchema = z.object({
  kind: z.union(['shan', 'dream', 'caiyun', 'dongyun', 'junyue', 'jiexin', 'fengchen', 'humao', 'ahuang']).required()
    .description('Which scene to draw. shan=山青婷彩, dream=梦海游鱼, caiyun=营慕彩云, dongyun=江畔冬云, junyue=徐山军月, jiexin=佩安杰心, fengchen=光彩凤晨, humao=琥珀猫咪（原创）, ahuang=虎子阿黄（原创）.'),
  petals: z.number().min(0).max(20)
    .description('"shan" only: how many falling petals to seed.'),
  bubbles: z.number().min(0).max(24)
    .description('"dream" only: how many pale outlined bubbles to seed.'),
  // The motes and the fish are SEPARATE effects from the bubbles, drawn at the same time, so
  // each gets its own count rather than sharing one.
  motes: z.number().min(0).max(24)
    .description('"dream" only: how many light-blue glowing motes to seed.'),
  fish: z.number().min(0).max(6)
    .description('"dream" only: how many cartoon fish to swim across the water.'),
  stars: z.number().min(0).max(30)
    .description('"caiyun" / "junyue" only: how many stars to seed.'),
  snow: z.number().min(0).max(30)
    .description('"dongyun" only: how many snowflakes to seed.'),
  dust: z.number().min(0).max(20)
    .description('"jiexin" / "humao" / "ahuang" only: how many drifting motes to seed — incense dust, amber sun motes, or dandelion fluff.'),
  feathers: z.number().min(0).max(16)
    .description('"fengchen" only: how many falling phoenix feathers to seed.'),
  dew: z.number().min(0).max(30)
    .description('"fengchen" only: how many twinkling dew drops to seed.'),
})

/**
 * One selectable theme.
 *
 * Every member is explicitly required — schemastery's default is optional, and a
 * theme missing `label` or `tokens` must be refused at the settings boundary, not
 * discovered later as a blank button or a crash in the browser.
 *
 * `label`, `description`, `reading`, `accent` and `ambient` are extensions beyond
 * the official `ThemeDefinition` (which carries only id/colorScheme/tokens): the
 * official Appearance row localizes its three hard-coded cubes and never reads a
 * theme name, so a third-party picker has to carry its own. The theme service
 * validates only `tokens`, so the extra fields are inert at runtime.
 */
export const ThemeDefinitionSchema = z.object({
  id: z.string()
    .required()
    .pattern(/^[a-z0-9][a-z0-9-]*$/)
    .description('Stable theme id, also the string passed to ctx.theme.setTheme. "system" is reserved.'),
  label: z.string().required().description('Name shown on the theme button in Settings.'),
  description: z.string().required().description('One-line description shown as the button tooltip.'),
  colorScheme: z.union([...COLOR_SCHEMES]).required().description('Base palette the overrides sit on top of.'),
  tokens: z.dict(TokenModesSchema)
    .required()
    .description('Alias-token overrides keyed by --dsw-alias-* variable name.'),
  reading: ReadingSchema
    .description('Optional reading-state treatment; a theme without one never lightens.'),
  accent: z.string()
    .pattern(/^#[0-9a-fA-F]{6}$/)
    .description('Marker colour for the active workspace / conversation states. Composed with an alpha suffix, so a 6-digit hex literal is required.'),
  ambient: AmbientSchema
    .description('Optional sidebar scenery; a theme without one draws nothing.'),
})

/**
 * Durable theme-gallery section: the user's own themes, absent until they add one.
 * A user theme reusing a bundled id replaces that bundled theme.
 */
export const ThemeGallerySchema = z.object({
  themes: z.array(ThemeDefinitionSchema)
    .description('Themes to register on top of the bundled defaults.'),
})

/** Display name used in loader diagnostics. */
export const name = 'theme-gallery'

/**
 * The host half is deliberately INERT.
 *
 * ── WHY THERE IS NO `apply` THAT RESERVES A SETTINGS SECTION ─────────────────
 *
 * This module used to do:
 *
 *     ctx.inject(['settings'], (settingsCtx) => {
 *       settingsCtx.settings.register(THEME_GALLERY_NAMESPACE, ThemeGallerySchema)
 *     })
 *
 * That single call twice stopped the desktop application from starting, and both times it
 * reported as `dsh-theme-gallery: pending (waiting for service: settingsScope)` in the crash
 * log — a boot hang with no exception, which reads like a model or network fault.
 *
 * `settingsScope` is a service the CLIENT half provides: the official
 * `@deepseek-ai/dsh-client-ui-theme` lists it in its own `inject` and calls
 * `ctx.settingsScope.bind({ namespace: 'ui-theme' })`. A host-side module cannot reach it by
 * name, so the deferred callback never ran and its fiber never settled — and the shell waits
 * for every fiber before it leaves "Loading plugins...".
 *
 * The section was also pointless: nothing has ever read it. Themes are registered through
 * `ctx.theme.register` in the browser half, and selection is persisted by the theme service
 * itself under its own namespace. So this half now contributes nothing to the running app,
 * and the schemas below are exported only as the validated contract for the bundled
 * `lib/themes/*.json` files (see `npm run check`).
 *
 * ── DO NOT ADD A SERVICE WAIT HERE ───────────────────────────────────────────
 *
 * Anything added to this module must be SYNCHRONOUS and must not wait on a service. If a
 * host-side service is genuinely needed later, it has to be declared in the package's own
 * composition so it is provided before this row activates — never requested from inside a
 * deferred callback that can leave the fiber pending. See tests/check-boot-safety.mjs, which
 * fails if this half starts depending on `settings`, `settingsScope`, `configForms` or
 * `remote`.
 *
 * @param ctx - host context; unused, and deliberately so.
 */
export function apply(ctx) {
  void ctx
}
