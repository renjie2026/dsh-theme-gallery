/**
 * Type surface of the theme pack's browser half.
 *
 * The runtime entry is `lib/client.js` — a lazy-CJS factory the client module
 * system loads. This file describes what that factory exports; the registration
 * contract itself is verified in `types/client.ts`.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ThemeDefinition, ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'

/** One theme contributed by this pack. */
export interface PackTheme {
  /** Theme id passed to `ctx.theme.setTheme`. */
  id: string
  /** Base palette the overrides sit on top of. */
  base: ThemeDefinition['colorScheme']
  /** Alias-token overrides, each with one value per color scheme. */
  tokens: ThemeTokenOverrides
}

/** Display name used in client diagnostics. */
export declare const name: string

/**
 * Client plugin body: register every theme in this pack and mount the settings
 * row into `settings.general.item`.
 * @param ctx - client context carrying the theme and slots services.
 */
export declare function apply(ctx: Context): void
