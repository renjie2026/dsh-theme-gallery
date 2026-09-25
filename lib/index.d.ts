/**
 * Type surface of the theme pack's host half.
 */
import type { Context } from '@deepseek-ai/cordis'

/** Display name used in loader diagnostics. */
export declare const name: string

/**
 * Host plugin body: intentionally empty — the pack contributes browser-side
 * themes only.
 * @param ctx - host context.
 */
export declare function apply(ctx: Context): void
