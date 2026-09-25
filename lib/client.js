/**
 * Browser half of the theme gallery.
 *
 * ## What changed, and why it matters
 *
 * An earlier revision sourced the theme list from the `theme-gallery` settings
 * namespace and declared `settingsScope` as a **hard** dependency. That service
 * is provided by `@deepseek-ai/dsh-client-ui-settings`, which itself waits on
 * `remote.settings` — so under the desktop composition it never arrived, the
 * fiber stayed `pending` forever, and the boot-complete check refused to start
 * the app:
 *
 *   web boot: 1 entry did not activate
 *   dsh-theme-gallery: pending (waiting for service: settingsScope)
 *
 * Cordis' array-form `inject` makes every entry required, so a service you do
 * not control is a service that can brick the app. This revision needs no
 * settings domain at all:
 *
 *   - the theme list is `ctx.theme.getTheme().themes` — the official registry;
 *   - selecting is `ctx.theme.setTheme(id)`, and ui-theme persists that
 *     preference itself, in the `ui-theme` namespace it owns;
 *   - the picker lives in the left sidebar, not in Settings.
 *
 * The only hard requirements are `slots` and `locale`, both shipped by
 * statically-composed UI packages (`dsh-client-ui-layout` consumes them, so they
 * exist in every web composition).
 *
 * ## Where the picker lives
 *
 * `sidebar.panellist` (a list slot: one icon per panel) plus `main` (a **keyed**
 * slot addressed by the same id). That pairing is this app's plugin mechanism —
 * one plugin is one sidebar entrance plus one main-column page — so it has room
 * for previews, descriptions and whatever this gallery grows into.
 *
 * ## Two conversational states
 *
 * A skin covers the screen; a screen covered by a gradient is what makes a long
 * conversation tiring to read. So once the transcript has messages, the centre
 * column gets a lightened card. Detection is DOM-derived because DSH exposes no
 * public "does this session have messages" API; if it stops matching, the plugin
 * degrades to the idle look and never breaks the UI.
 *
 * ## Why the skin itself needs no injected stylesheet
 *
 * The official frame already paints the sidebar column AND the Windows caption
 * row with `var(--dsw-specific-sidebar-fill)`, and the centre with
 * `var(--dsw-alias-bg-base)`. Themes set that token to a gradient, so the screen
 * is covered by tokens alone. Only the reading card needs one injected rule,
 * scoped to the official `[data-windows-titlebar] .centerCol` anchor.
 *
 * This file is a lazy-CJS factory, the bundle format the client module system
 * loads (`window.__ModuleLoader__.load({ id, factory })`); the module body lives
 * inside the factory closure so it runs at materialization, not at script load.
 * The registration contract was type-checked against the real official packages
 * — see ../types/client-panel.ts.
 */
window.__ModuleLoader__.load({
  id: 'dsh-theme-gallery',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // Value requires only. Like the official ui-theme bundle, these are NOT
    // listed in `dsh.client.inject`: they resolve from the client's platform
    // module seed (`dsh-client-store`) or the shell (`react/jsx-runtime`).
    const { defineStore } = require('@deepseek-ai/dsh-client-store')
    const { jsx, jsxs } = require('react/jsx-runtime')

    /** Panel id shared by the sidebar icon and the main-column page. */
    const PANEL_ID = 'theme-gallery'

    /** Locale namespace this plugin owns its copy in. */
    const NS = 'theme-gallery'

    /**
     * Display names for the themes the theme plugin ships with itself.
     *
     * They carry no `label` — the official Appearance row localizes them from its
     * own dictionaries — so the gallery names them here instead of showing a bare
     * `light` / `dark` id on a card.
     */
    const BUILT_IN_LABELS = { light: '浅色', dark: '深色', system: '跟随系统' }

    /**
     * Built-in ids the gallery leaves to the official Appearance row.
     *
     * `light` is exactly what "follow the system" resolves to on a light desktop,
     * so offering it beside that row is duplicate UI. `dark` stays because it is a
     * distinct choice a user may want without a full skin.
     */
    const OMITTED_IDS = new Set(['light'])

    /** Body attribute publishing the reading state; the injected rule reads it. */
    const READING_ATTRIBUTE = 'data-dsh-theme-reading'

    /**
     * Reading-state defaults, tuned in `tools/theme-bench`.
     *
     * One shared setting rather than one per theme: the gallery does not own the
     * theme definitions (the official registry does), so per-theme reading values
     * would need a side table keyed by theme id. These values were chosen against
     * both bundled skins and are the ones the bench exports as its defaults.
     */
    const READING = { bg: '#FFFFFF', alpha: 0.62, blur: 3, maxWidth: 640 }

    /**
     * The package version this bundle was built from.
     *
     * Written by `scripts/embed-themes.mjs` from package.json, because the browser
     * half cannot read its own manifest: the client module system resolves `require`
     * against the platform seed table and other plugins' boot-graph rows, not
     * against this package's files. The panel shows it so a reader can compare what
     * they have with what npm publishes.
     *
     * Kept honest by two checks: `scripts/publish-check.mjs` compares it with
     * package.json, and the release workflow fails when re-running the embed step
     * changes a tracked file.
     */
    const BUNDLED_VERSION = '0.1.4'

    /**
     * Themes this package contributes, inlined from lib/themes/*.json.
     *
     * Someone has to put them into the registry, and on this side that is this
     * plugin: the browser half is where `ctx.theme` lives. The picker then lists
     * whatever the registry holds, so themes contributed by other plugins appear
     * beside these without either plugin knowing about the other.
     *
     * Regenerate after editing those files: `node scripts/embed-themes.mjs`.
     */
    const BUNDLED_THEMES = [
      {
        "id": "meng-hai-you-yu",
        "label": "梦海游鱼",
        "description": "梦幻海洋，游鱼作伴 —— 复刻自电商新零售系统管理后台的默认主题",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#F7FBFF 0%,#EDF5FD 55%,#E2EEFA 100%)",
            "dark": "linear-gradient(to bottom,#F7FBFF 0%,#EDF5FD 55%,#E2EEFA 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FBFDFF",
            "dark": "#FBFDFF"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#E1EFFB",
            "dark": "#E1EFFB"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#177CB014",
            "dark": "#177CB014"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-border-l1": {
            "light": "#177CB00F",
            "dark": "#177CB00F"
          },
          "--dsw-alias-border-l2": {
            "light": "#177CB021",
            "dark": "#177CB021"
          },
          "--dsw-alias-border-l3": {
            "light": "#177CB02E",
            "dark": "#177CB02E"
          },
          "--dsw-alias-border-l4": {
            "light": "#177CB03D",
            "dark": "#177CB03D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-label-primary": {
            "light": "#16384F",
            "dark": "#16384F"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#16384F",
            "dark": "#16384F"
          },
          "--dsw-alias-label-secondary": {
            "light": "#2E4A63",
            "dark": "#2E4A63"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#5A7B96",
            "dark": "#5A7B96"
          },
          "--dsw-alias-label-caption": {
            "light": "#5A7B96",
            "dark": "#5A7B96"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#8FAAC0",
            "dark": "#8FAAC0"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#2E4A63",
            "dark": "#2E4A63"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#B8860B",
            "dark": "#B8860B"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#2B74B512",
            "dark": "#2B74B512"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#2B74B529",
            "dark": "#2B74B529"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#06527929",
            "dark": "#06527929"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#2B74B5",
            "dark": "#2B74B5"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#177CB047",
            "dark": "#177CB047"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#2B74B524",
            "dark": "#2B74B524"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#2B74B5",
            "dark": "#2B74B5"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#2B74B53D",
            "dark": "#2B74B53D"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#4C8DAE",
            "dark": "#4C8DAE"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#F5FAFF",
            "dark": "#F5FAFF"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#16384F",
            "dark": "#16384F"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#EAF5FF",
            "dark": "#EAF5FF"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#D6E9F8",
            "dark": "#D6E9F8"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#E0EFFB",
            "dark": "#E0EFFB"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#D6E9F8",
            "dark": "#D6E9F8"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#2B74B524",
            "dark": "#2B74B524"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#EAF5FF",
            "dark": "#EAF5FF"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#2B74B529",
            "dark": "#2B74B529"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#2B74B538",
            "dark": "#2B74B538"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#2B74B552",
            "dark": "#2B74B552"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#2B74B566",
            "dark": "#2B74B566"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#065279",
            "dark": "#065279"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C0566A",
            "dark": "#C0566A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#9CC3E4",
            "dark": "#9CC3E4"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#CA6924",
            "dark": "#CA6924"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#E09A4E",
            "dark": "#E09A4E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#F3E3CB",
            "dark": "#F3E3CB"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A4A12",
            "dark": "#8A4A12"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#177CB0",
            "dark": "#177CB0"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#4C8DAE",
            "dark": "#4C8DAE"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#EAF5FF 0%,#DDF0FF 26%,#CDE9FB 52%,#C7E7FA 62%,#CDEEFC 70%,#C4E7FA 80%,#B9DCF3 90%,#B0D9F0 100%)",
            "dark": "linear-gradient(to bottom,#EAF5FF 0%,#DDF0FF 26%,#CDE9FB 52%,#C7E7FA 62%,#CDEEFC 70%,#C4E7FA 80%,#B9DCF3 90%,#B0D9F0 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#FFD166",
        "ambient": {
          "kind": "dream",
          "bubbles": 9,
          "motes": 5,
          "fish": 3
        }
      },
      {
        "id": "shan-qing-ting-cai",
        "label": "山青婷彩",
        "description": "青山叠翠，蜓舞生姿 —— 复刻自电商新零售系统管理后台同名主题",
        "colorScheme": "light",
        "tokens": {
          "--dsw-alias-bg-base": {
            "light": "linear-gradient(to bottom,#F7FCF9 0%,#EDF7F1 55%,#E4F2EA 100%)",
            "dark": "linear-gradient(to bottom,#F7FCF9 0%,#EDF7F1 55%,#E4F2EA 100%)"
          },
          "--dsw-alias-bg-layer-1": {
            "light": "#FBFEFC",
            "dark": "#FBFEFC"
          },
          "--dsw-alias-bg-layer-2": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-layer-3": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-bg-overlay": {
            "light": "#E3F1E8",
            "dark": "#E3F1E8"
          },
          "--dsw-alias-bg-skeleton": {
            "light": "#2F7D5E14",
            "dark": "#2F7D5E14"
          },
          "--dsw-alias-bg-module-platform": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-bg-multi-select": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-border-l1": {
            "light": "#2F7D5E0F",
            "dark": "#2F7D5E0F"
          },
          "--dsw-alias-border-l2": {
            "light": "#2F7D5E21",
            "dark": "#2F7D5E21"
          },
          "--dsw-alias-border-l3": {
            "light": "#2F7D5E2E",
            "dark": "#2F7D5E2E"
          },
          "--dsw-alias-border-l4": {
            "light": "#2F7D5E3D",
            "dark": "#2F7D5E3D"
          },
          "--dsw-alias-brand-primary": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-brand-primary-invert": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-brand-text": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-label-primary": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-label-primary-bluish": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-label-secondary": {
            "light": "#3C6B57",
            "dark": "#3C6B57"
          },
          "--dsw-alias-label-tertiary": {
            "light": "#5C8474",
            "dark": "#5C8474"
          },
          "--dsw-alias-label-caption": {
            "light": "#5C8474",
            "dark": "#5C8474"
          },
          "--dsw-alias-label-dimmed": {
            "light": "#8AA79B",
            "dark": "#8AA79B"
          },
          "--dsw-alias-label-primary-dimmed": {
            "light": "#3C6B57",
            "dark": "#3C6B57"
          },
          "--dsw-alias-label-primary-foreground": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-label-primary-inverted": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-link": {
            "light": "#D97BA4",
            "dark": "#D97BA4"
          },
          "--dsw-alias-interactive-bg-hover": {
            "light": "#3E9B7A14",
            "dark": "#3E9B7A14"
          },
          "--dsw-alias-interactive-bg-active": {
            "light": "#E88BB02E",
            "dark": "#E88BB02E"
          },
          "--dsw-alias-interactive-bg-hover-solid": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-interactive-bg-hover-accent": {
            "light": "#E88BB03D",
            "dark": "#E88BB03D"
          },
          "--dsw-alias-button-primary-fill": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-button-primary-hover": {
            "light": "#3E9B7A",
            "dark": "#3E9B7A"
          },
          "--dsw-alias-button-primary-dimmed": {
            "light": "#2F7D5E47",
            "dark": "#2F7D5E47"
          },
          "--dsw-alias-button-ghost-active-fill": {
            "light": "#E88BB029",
            "dark": "#E88BB029"
          },
          "--dsw-alias-button-ghost-active-border": {
            "light": "#E88BB0",
            "dark": "#E88BB0"
          },
          "--dsw-alias-button-ghost-active-hover": {
            "light": "#E88BB047",
            "dark": "#E88BB047"
          },
          "--dsw-alias-button-info-fill": {
            "light": "#4C9B78",
            "dark": "#4C9B78"
          },
          "--dsw-alias-button-info-hover": {
            "light": "#3E9B7A",
            "dark": "#3E9B7A"
          },
          "--dsw-alias-button-elevated-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-fill": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-button-floating-hover": {
            "light": "#F4FBF7",
            "dark": "#F4FBF7"
          },
          "--dsw-alias-button-contrast-fill": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-markdown-code-block": {
            "light": "#EAF7F0",
            "dark": "#EAF7F0"
          },
          "--dsw-alias-markdown-code-block-banner": {
            "light": "#DCEEE2",
            "dark": "#DCEEE2"
          },
          "--dsw-alias-markdown-inline-code": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-markdown-citation": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-markdown-tag": {
            "light": "#E4F3EA",
            "dark": "#E4F3EA"
          },
          "--dsw-alias-markdown-placeholder": {
            "light": "#DCEEE2",
            "dark": "#DCEEE2"
          },
          "--dsw-alias-markdown-code-segment-selected": {
            "light": "#E88BB029",
            "dark": "#E88BB029"
          },
          "--dsw-alias-markdown-code-segment-unselected": {
            "light": "#EAF7F0",
            "dark": "#EAF7F0"
          },
          "--dsw-alias-scrollbar-bg-l1": {
            "light": "#2F7D5E29",
            "dark": "#2F7D5E29"
          },
          "--dsw-alias-scrollbar-bg-l2": {
            "light": "#2F7D5E38",
            "dark": "#2F7D5E38"
          },
          "--dsw-alias-scrollbar-hover-l1": {
            "light": "#2F7D5E52",
            "dark": "#2F7D5E52"
          },
          "--dsw-alias-scrollbar-hover-l2": {
            "light": "#2F7D5E66",
            "dark": "#2F7D5E66"
          },
          "--dsw-alias-tooltip-bg": {
            "light": "#1F4638",
            "dark": "#1F4638"
          },
          "--dsw-alias-toast-bg": {
            "light": "#FFFFFF",
            "dark": "#FFFFFF"
          },
          "--dsw-alias-state-error-primary": {
            "light": "#C65B6A",
            "dark": "#C65B6A"
          },
          "--dsw-alias-state-error-secondary": {
            "light": "#DB5A6B",
            "dark": "#DB5A6B"
          },
          "--dsw-alias-state-success-primary": {
            "light": "#21A675",
            "dark": "#21A675"
          },
          "--dsw-alias-state-success-secondary": {
            "light": "#2F7D5E",
            "dark": "#2F7D5E"
          },
          "--dsw-alias-state-success-tertiary": {
            "light": "#9DCDBA",
            "dark": "#9DCDBA"
          },
          "--dsw-alias-state-warn-primary": {
            "light": "#B97F3A",
            "dark": "#B97F3A"
          },
          "--dsw-alias-state-warn-secondary": {
            "light": "#D9A45E",
            "dark": "#D9A45E"
          },
          "--dsw-alias-state-warn-tertiary": {
            "light": "#EFDCC0",
            "dark": "#EFDCC0"
          },
          "--dsw-alias-state-warn-label": {
            "light": "#8A5A22",
            "dark": "#8A5A22"
          },
          "--dsw-alias-state-business-primary": {
            "light": "#E88BB0",
            "dark": "#E88BB0"
          },
          "--dsw-alias-state-business-tertiary": {
            "light": "#F8A8C2",
            "dark": "#F8A8C2"
          },
          "--dsw-specific-sidebar-fill": {
            "light": "linear-gradient(to bottom,#EAF7F0 0%,#D8EFE4 20%,#C9E8DA 36%,#BFE2D2 50%,#B4DCCA 62%,#A8D2BE 74%,#9CC9B2 86%,#90C0A8 100%)",
            "dark": "linear-gradient(to bottom,#EAF7F0 0%,#D8EFE4 20%,#C9E8DA 36%,#BFE2D2 50%,#B4DCCA 62%,#A8D2BE 74%,#9CC9B2 86%,#90C0A8 100%)"
          }
        },
        "reading": {
          "colorScheme": "light",
          "bg": "#FFFFFF",
          "alpha": 0.62,
          "blur": 3,
          "maxWidth": 640
        },
        "accent": "#E88BB0",
        "ambient": {
          "kind": "shan",
          "petals": 7
        }
      }
    ]

    /**
     * Marks the ambient nodes this run created.
     *
     * The layer lives on the document body, so parentage can no longer identify
     * ownership. Anything found without this stamp is debris from an earlier build —
     * and because the shell keeps its DOM across a plugin reload, such nodes outlive
     * the code that made them.
     */
    const AMBIENT_OWNER = 'theme-gallery'

    /**
     * Ambient scenery drawn inside the sidebar column.
     *
     * Ported from the source admin system, where each theme carried its own
     * animation component mounted into a `left-sidebar-theme-container`. The
     * artwork is reproduced here (mountains, mist, water, dragonflies, falling
     * petals for 山青婷彩; corner glow, rising bubbles, swaying seaweed for
     * 梦海游鱼) with two deliberate changes:
     *
     *  - sizes are expressed in **percentages and em**, not the source system's
     *    fixed 223 px sidebar width, so the scene scales to whatever width the
     *    user drags the sidebar to;
     *  - nothing here carries colour of its own beyond the ported artwork, and the
     *    layer is `pointer-events:none` / `z-index:0`, so it can never intercept a
     *    click or cover a menu item. The source system has the same rule, and a
     *    bug note there records opaque mountains hiding the bottom menu rows.
     *
     * `#dsh-theme-ambient` is a seat this plugin injects into the sidebar column;
     * `syncAmbient()` fills it, and each theme chooses its scene by `ambient.kind`.
     */
    const AMBIENT_CSS = [
      /* The layer, arranged exactly like the working `dsh-theme-firefly` ambient layer:
         a full-viewport fixed element styled by a CLASS, appended to `document.body`, at
         `z-index: 60`.
         Every other arrangement of this layer failed to paint on this machine — precise
         inline geometry, maximum z-index, `documentElement` as the parent, inline styles
         per element. The firefly plugin uses this one and renders, so this is now the
         layer's arrangement. The scenery is placed INSIDE it (`.dsh-ambient-scene`). */
      '#dsh-theme-ambient{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:60}',
      '.dsh-ambient-scene{overflow:hidden}',
      /* The scene roots carry their own positioning inline too; the selectors below are
         kept only where a rule cannot be inlined (`@keyframes`) or where they must reach
         a shell element. */
      '.ZTP-Xa_sidebarCol{position:relative}',

      /* BRING-UP PROBE — remove with the rest of the diagnostics.
         The control layer, copied rule-for-rule from the working `dsh-theme-firefly`
         plugin: geometry and stacking from a class, motion from `@keyframes`, and only
         the per-element random values inline. */
      '.dsh-amb-control{position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden}',
      /* BRING-UP PROBE — the scene box inside the proven layer. No `pointer-events` here on
         purpose: the layer above already disables it, and this box is the thing being
         tested rather than a decoration that must stay click-through. */
      '.dsh-amb-control-scene{overflow:hidden}',

      /* The scenery's own geometry. These live here rather than inline because the scene
         markup is built as a string, and they must reach it wherever it is mounted — which
         is now inside the proven layer rather than a layer of its own. */
      '.dsh-amb-control-scene .sta-mountains{position:absolute;left:0;right:0;bottom:0;height:46%;z-index:3}',
      '.dsh-amb-control-scene .sta-mountains svg{display:block;width:100%;height:100%}',
      '.dsh-amb-control-scene .sta-mist{position:absolute;height:1.6em;border-radius:1000px;z-index:4;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);',
      'filter:blur(5px);opacity:.85;animation:dsh-amb-mist 26s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .sta-mist-1{width:62%;top:56%;left:12%}',
      '.dsh-amb-control-scene .sta-mist-2{width:44%;top:61%;left:38%;opacity:.6;',
      'animation-duration:32s;animation-delay:-9s}',
      '.dsh-amb-control-scene .sta-pond{position:absolute;left:0;right:0;bottom:0;height:13%;z-index:5;',
      'background:linear-gradient(to bottom,rgba(104,178,150,.62),rgba(66,141,113,.78))}',
      '.dsh-amb-control-scene .sta-pond-line{position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.6;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent)}',
      '.dsh-amb-control-scene .sta-ripple{position:absolute;z-index:6;width:.55em;height:.55em}',
      '.dsh-amb-control-scene .sta-ripple span{position:absolute;inset:0;',
      'border:1.6px solid rgba(217,123,164,.9);border-radius:50%;',
      'animation:dsh-amb-ring 3.2s ease-out infinite}',
      '.dsh-amb-control-scene .sta-ripple span:nth-child(2){animation-delay:1.6s}',
      '@keyframes dsh-amb-ring{0%{transform:scale(.4);opacity:.8}100%{transform:scale(4.2);opacity:0}}',
      '.dsh-amb-control-scene .sta-dfly{position:absolute;z-index:8;will-change:transform}',
      '.dsh-amb-control-scene .sta-dfly svg{display:block;width:100%;height:auto}',
      '.dsh-amb-control-scene .sta-bob{animation:dsh-amb-bob .9s ease-in-out infinite}',
      '.dsh-amb-control-scene .sta-dfly-2 .sta-bob{animation-duration:1.1s;animation-delay:-.4s}',
      /* The flight paths are bounded INSIDE the sidebar. The previous ones swept up to
         5.4em to the right, which carried the dragonfly out of the 280px column and under
         the main column, where it was hidden — the drift is now horizontal-left-biased and
         half the amplitude. */
      '@keyframes dsh-amb-hover1{0%{transform:translate(0,0)}18%{transform:translate(1.4em,.7em)}',
      '38%{transform:translate(2.4em,-.5em)}55%{transform:translate(1.2em,.5em)}',
      '70%{transform:translate(-.5em,-.9em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-hover2{0%{transform:translate(0,0)}25%{transform:translate(-1.5em,-1.2em)}',
      '50%{transform:translate(-2.4em,.5em)}75%{transform:translate(-.7em,1.2em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2.5px) rotate(-2deg)}}',
      '.dsh-amb-control-scene .sta-petals{position:absolute;inset:0;z-index:2;pointer-events:none}',
      '.dsh-amb-control-scene .sta-petal{position:absolute;top:-1em;',
      'border-radius:60% 40% 55% 45%/60% 55% 45% 40%;opacity:1;animation:dsh-amb-fall linear infinite;',
      'box-shadow:0 0 3px rgba(217,123,164,.45)}',
      '@keyframes dsh-amb-fall{0%{transform:translate(0,-1em) rotate(0);opacity:0}8%{opacity:.9}',
      '35%{transform:translate(-1.2em,5em) rotate(140deg)}70%{transform:translate(.9em,10em) rotate(280deg)}',
      '100%{transform:translate(-.5em,15em) rotate(380deg);opacity:0}}',
      '@keyframes dsh-amb-mist{from{transform:translateX(0)}to{transform:translateX(11%)}}',
      /* 梦海游鱼 */
      '.dsh-amb-control-scene .dof-glow{position:absolute;inset:0;z-index:2}',
      '.dsh-amb-control-scene .dof-corner{position:absolute;top:0;left:-30%;width:150%;height:40%;',
      'background:radial-gradient(ellipse at 32% 50%,rgba(255,255,255,.55),rgba(255,255,255,0) 62%);',
      'filter:blur(12px);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'animation:dsh-amb-wash 18s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .dof-wash{position:absolute;left:-20%;width:140%;height:30%;filter:blur(12px);',
      'opacity:.5;background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);',
      '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'animation:dsh-amb-wash 24s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .dof-wash-1{top:14%}',
      '.dsh-amb-control-scene .dof-wash-2{top:34%;opacity:.34;animation-duration:31s;animation-delay:-8s}',
      '@keyframes dsh-amb-wash{from{transform:translateX(0)}to{transform:translateX(9%)}}',
      '.dsh-amb-control-scene .dof-bubbles{position:absolute;inset:0;z-index:6;pointer-events:none}',
      // The ORIGINAL rising bubbles, restored exactly as they were: pale spheres with a white
      // inset ring. An earlier revision replaced them with glowing motes, which was wrong —
      // the motes are a SECOND effect, not a new look for these.
      '.dsh-amb-control-scene .dof-bubble{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95),rgba(190,232,246,.55));',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);animation:dsh-amb-rise linear infinite}',
      '@keyframes dsh-amb-rise{0%{transform:translate(0,0) scale(.6);opacity:0}12%{opacity:.85}',
      '55%{transform:translate(1em,-7em) scale(1)}100%{transform:translate(-.6em,-12.5em) scale(.8);opacity:0}}',
      // The glowing motes, added alongside the bubbles.
      //
      // This is the effect the firefly control layer had: a soft light-blue core with a halo,
      // drifting upward. Both layers are drawn at once, so the scene shows outlined bubbles
      // AND glowing motes — two separate effects, as requested.
      '.dsh-amb-control-scene .dof-motes{position:absolute;inset:0;z-index:7;pointer-events:none}',
      '.dsh-amb-control-scene .dof-mote{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 34% 30%,#FFFFFF 0%,#D6F1FF 40%,rgba(122,205,255,.5) 72%,rgba(122,205,255,0) 100%);',
      'box-shadow:0 0 10px 3px rgba(122,205,255,.55),0 0 22px 6px rgba(122,205,255,.22);',
      'animation:dsh-amb-mote linear infinite}',
      // A straighter, quicker climb than the bubbles, so the two read as distinct effects
      // rather than one doubled-up stream.
      '@keyframes dsh-amb-mote{0%{transform:translate(0,0) scale(.5);opacity:0}10%{opacity:.95}',
      '50%{transform:translate(-.8em,-8em) scale(1)}100%{transform:translate(.5em,-13em) scale(.85);opacity:0}}',
      // Swimming fish, ported from the source system's separate `FishAnimation.vue`.
      // The component drove them through entering / bubbling / leaving phases in JavaScript;
      // a static bundle has nowhere to run that, so the same artwork crosses the water
      // continuously instead, on CSS animations.
      '.dsh-amb-control-scene .dof-fish{position:absolute;left:0;z-index:6;pointer-events:none;',
      'will-change:transform}',
      '.dsh-amb-control-scene .dof-fish svg{display:block;width:100%;height:auto}',
      // Right-to-left fish are mirrored, so the nose leads in both directions.
      '.dsh-amb-control-scene .dof-fish-flip svg{transform:scaleX(-1)}',
      '.dsh-amb-control-scene .dof-fish-bob{animation:dsh-amb-fish-bob 2.4s ease-in-out infinite}',
      '.dsh-amb-control-scene .dof-fish-tail{transform-origin:10px 10px;',
      'animation:dsh-amb-fish-tail .9s ease-in-out infinite alternate}',
      // Crossings start well off one edge and finish well off the other, so a fish enters and
      // leaves instead of appearing and vanishing mid-water.
      '@keyframes dsh-amb-swim{0%{transform:translateX(-6em)}100%{transform:translateX(24em)}}',
      '@keyframes dsh-amb-swim-back{0%{transform:translateX(24em)}100%{transform:translateX(-6em)}}',
      '@keyframes dsh-amb-fish-bob{0%,100%{transform:translateY(0) rotate(0)}',
      '50%{transform:translateY(-3px) rotate(-1.6deg)}}',
      '@keyframes dsh-amb-fish-tail{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}',
      '.dsh-amb-control-scene .dof-seaweed{position:absolute;left:0;right:0;bottom:0;height:34%;z-index:5}',
      '.dsh-amb-control-scene .dof-seaweed svg{display:block;width:100%;height:100%}',
      '.dsh-amb-control-scene .dof-blade{transform-origin:50% 100%;',
      'animation:dsh-amb-sway 6s ease-in-out infinite alternate}',
      '.dsh-amb-control-scene .dof-blade-2{animation-duration:7.4s;animation-delay:-1.6s}',
      '.dsh-amb-control-scene .dof-blade-3{animation-duration:5.2s;animation-delay:-2.8s}',
      '.dsh-amb-control-scene .dof-blade-4{animation-duration:8.1s;animation-delay:-.9s}',
      '.dsh-amb-control-scene .dof-blade-5{animation-duration:6.6s;animation-delay:-3.4s}',
      '@keyframes dsh-amb-sway{from{transform:rotate(-3.5deg)}to{transform:rotate(3.5deg)}}',
      '@media (prefers-reduced-motion:reduce){.dsh-amb-control-scene *{animation:none!important}}',


      /* ── 山青婷彩 ─────────────────────────────────────────────────────── */
      '#dsh-theme-ambient .sta-mountains{position:absolute;left:0;right:0;bottom:0;height:46%;z-index:3}',
      '#dsh-theme-ambient .sta-mountains svg{display:block;width:100%;height:100%}',
      '#dsh-theme-ambient .sta-mist{position:absolute;height:1.6em;border-radius:1000px;z-index:4;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);',
      'filter:blur(5px);opacity:.85;animation:dsh-amb-mist 26s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .sta-mist-1{width:66%;top:58.5%;left:13%}',
      '#dsh-theme-ambient .sta-mist-2{width:48%;top:63%;left:40%;opacity:.6;animation-duration:32s;animation-delay:-9s}',
      '@keyframes dsh-amb-mist{from{transform:translateX(0)}to{transform:translateX(11%)}}',

      '#dsh-theme-ambient .sta-pond{position:absolute;left:0;right:0;bottom:0;height:14%;z-index:5;',
      'background:linear-gradient(to bottom,rgba(104,178,150,.62),rgba(66,141,113,.78))}',
      '#dsh-theme-ambient .sta-pond-line{position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.6;',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent)}',

      '#dsh-theme-ambient .sta-ripple{position:absolute;z-index:6;width:.55em;height:.55em}',
      '#dsh-theme-ambient .sta-ripple span{position:absolute;inset:0;border:1.6px solid rgba(232,139,176,.92);',
      'border-radius:50%;animation:dsh-amb-ring 3.2s ease-out infinite}',
      '#dsh-theme-ambient .sta-ripple span:nth-child(2){animation-delay:1.6s}',
      '@keyframes dsh-amb-ring{0%{transform:scale(.4);opacity:.8}100%{transform:scale(4.2);opacity:0}}',

      '#dsh-theme-ambient .sta-dfly{position:absolute;z-index:8;width:6.4em;will-change:transform}',
      '#dsh-theme-ambient .sta-dfly svg{display:block;width:100%;height:auto}',
      '#dsh-theme-ambient .sta-dfly-1{top:30%;left:16%;animation:dsh-amb-hover1 11s ease-in-out infinite}',
      '#dsh-theme-ambient .sta-dfly-2{top:52%;left:48%;width:4.4em;opacity:.95;',
      'animation:dsh-amb-hover2 13s ease-in-out infinite;animation-delay:-5s}',
      '#dsh-theme-ambient .sta-bob{animation:dsh-amb-bob .9s ease-in-out infinite}',
      '#dsh-theme-ambient .sta-dfly-2 .sta-bob{animation-duration:1.1s;animation-delay:-.4s}',
      '@keyframes dsh-amb-hover1{0%{transform:translate(0,0)}18%{transform:translate(2.4em,.9em)}',
      '38%{transform:translate(5.4em,-.6em)}55%{transform:translate(2.8em,.6em)}',
      '70%{transform:translate(-1.1em,-1.3em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-hover2{0%{transform:translate(0,0)}25%{transform:translate(-2.8em,-1.7em)}',
      '50%{transform:translate(-4.8em,.7em)}75%{transform:translate(-1.9em,1.7em)}100%{transform:translate(0,0)}}',
      '@keyframes dsh-amb-bob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-2.5px) rotate(-2deg)}}',

      '#dsh-theme-ambient .sta-petals{position:absolute;inset:0;z-index:7;pointer-events:none}',
      '#dsh-theme-ambient .sta-petal{position:absolute;top:-1em;border-radius:60% 40% 55% 45%/60% 55% 45% 40%;',
      'background:linear-gradient(135deg,#F9A8C8 0%,#E88BB0 55%,#CF6B96 100%);opacity:.9;animation:dsh-amb-fall linear infinite}',
      /* Distances are measured against the BAND the seat occupies, not the viewport.
         `vh` units were fine when the seat filled the column; in a band they carried
         petals and bubbles straight past its bottom edge, where `overflow:hidden`
         removed them mid-flight. The band is roughly a third of the viewport, so
         these values cover it with a little margin. */
      '@keyframes dsh-amb-fall{0%{transform:translate(0,-1em) rotate(0);opacity:0}8%{opacity:.9}',
      '35%{transform:translate(-1.5em,10em) rotate(140deg)}70%{transform:translate(1.1em,20em) rotate(280deg)}',
      '100%{transform:translate(-.6em,30em) rotate(380deg);opacity:0}}',

      /* ── 梦海游鱼 ─────────────────────────────────────────────────────── */
      '#dsh-theme-ambient .dof-glow{position:absolute;inset:0;z-index:2}',
      '#dsh-theme-ambient .dof-corner{position:absolute;top:0;left:-30%;width:150%;height:40%;',
      'background:radial-gradient(ellipse at 32% 50%,rgba(255,255,255,.55),rgba(255,255,255,0) 62%);',
      'filter:blur(12px);-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'mask-image:linear-gradient(to bottom,transparent 0,#000 45%);',
      'animation:dsh-amb-wash 18s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-wash{position:absolute;left:-20%;width:140%;height:30%;filter:blur(12px);opacity:.5;',
      'background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);',
      '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);',
      'animation:dsh-amb-wash 24s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-wash-1{top:14%}',
      '#dsh-theme-ambient .dof-wash-2{top:34%;opacity:.34;animation-duration:31s;animation-delay:-8s}',
      '@keyframes dsh-amb-wash{from{transform:translateX(0)}to{transform:translateX(9%)}}',

      '#dsh-theme-ambient .dof-bubbles{position:absolute;inset:0;z-index:6;pointer-events:none}',
      '#dsh-theme-ambient .dof-bubble{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95),rgba(190,232,246,.55));',
      'box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);animation:dsh-amb-rise linear infinite}',
      '@keyframes dsh-amb-rise{0%{transform:translate(0,0) scale(.6);opacity:0}12%{opacity:.85}',
      '55%{transform:translate(1em,-7em) scale(1)}100%{transform:translate(-.6em,-12.5em) scale(.8);opacity:0}}',

      '#dsh-theme-ambient .dof-seaweed{position:absolute;left:0;right:0;bottom:0;height:38%;z-index:5}',
      '#dsh-theme-ambient .dof-seaweed svg{display:block;width:100%;height:100%}',
      '#dsh-theme-ambient .dof-blade{transform-origin:50% 100%;animation:dsh-amb-sway 6s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-blade-2{animation-duration:7.4s;animation-delay:-1.6s}',
      '#dsh-theme-ambient .dof-blade-3{animation-duration:5.2s;animation-delay:-2.8s}',
      '#dsh-theme-ambient .dof-blade-4{animation-duration:8.1s;animation-delay:-.9s}',
      '#dsh-theme-ambient .dof-blade-5{animation-duration:6.6s;animation-delay:-3.4s}',
      '@keyframes dsh-amb-sway{from{transform:rotate(-3.5deg)}to{transform:rotate(3.5deg)}}',
      /* Fish rules for the PREVIEW page, which mounts the scene into a
         `#dsh-theme-ambient` seat rather than the live `.dsh-amb-control-scene`
         box. The live layer styles these classes in its own section above; the
         preview would otherwise draw fish that never mirror, bob or beat their
         tails — a lying preview. */
      '#dsh-theme-ambient .dof-fish{position:absolute;left:0;z-index:6;pointer-events:none;',
      'will-change:transform}',
      '#dsh-theme-ambient .dof-fish svg{display:block;width:100%;height:auto}',
      '#dsh-theme-ambient .dof-fish-flip svg{transform:scaleX(-1)}',
      '#dsh-theme-ambient .dof-fish-bob{animation:dsh-amb-fish-bob 2.4s ease-in-out infinite}',
      '#dsh-theme-ambient .dof-fish-tail{transform-origin:10px 10px;',
      'animation:dsh-amb-fish-tail .9s ease-in-out infinite alternate}',
      '#dsh-theme-ambient .dof-mote{position:absolute;bottom:-1em;border-radius:50%;',
      'background:radial-gradient(circle at 34% 30%,#FFFFFF 0%,#D6F1FF 40%,rgba(122,205,255,.5) 72%,rgba(122,205,255,0) 100%);',
      'box-shadow:0 0 10px 3px rgba(122,205,255,.55),0 0 22px 6px rgba(122,205,255,.22);',
      'animation:dsh-amb-mote linear infinite}',

      /* Respect a user who has asked the system for less motion: the scenery
         stays, the movement does not. */
      '@media (prefers-reduced-motion:reduce){#dsh-theme-ambient *{animation:none!important}}',
    ].join('\n')

    /** Gallery page copy. */
    const zh = {
      title: '主题皮肤',
      hint: '点一下即切换，选中会记入设置',
      count: '{count} 个可选主题',
      current: '当前',
      applied: '已应用',
      empty: '正在读取官方主题注册表…',
    }
    const en = {
      title: 'Theme skins',
      hint: 'Click to switch; the choice is remembered',
      count: '{count} themes available',
      current: 'Current',
      applied: 'Applied',
      empty: 'Reading the theme registry…',
    }

    /**
     * Lighten a colour toward white by an alpha.
     *
     * Done in JS rather than CSS `color-mix` so the value needs no support check
     * and the same string is available without reading computed styles.
     * @param hex - `#rrggbb` or `#rgb`.
     * @param alpha - 0..1: how much of the original colour survives over white.
     * @returns an `rgb()` string, or the input when it is not a hex colour.
     */
    function lighten(hex, alpha) {
      const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim())
      if (m === null) return String(hex)
      let h = m[1]
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
      const mix = (c) => Math.round(255 - (255 - c) * alpha)
      return `rgb(${mix(parseInt(h.slice(0, 2), 16))},${mix(parseInt(h.slice(2, 4), 16))},${mix(parseInt(h.slice(4, 6), 16))})`
    }

    /** The gallery page's stylesheet, installed once and owned by this plugin. */
    const PAGE_CSS = [
      '.tg-page{padding:20px 24px;display:flex;flex-direction:column;gap:16px;height:100%;overflow:auto}',
      '.tg-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
      '.tg-title{font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.tg-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.tg-debug{font:11px/1.6 ui-monospace,Consolas,monospace;color:var(--dsw-alias-label-tertiary);',
      'background:var(--dsw-alias-bg-layer-3);border:.5px solid var(--dsw-alias-border-l3);',
      'border-radius:8px;padding:8px 10px;word-break:break-all}',
      '.tg-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}',
      '.tg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}',
      '.tg-card{display:flex;flex-direction:column;gap:8px;padding:12px;text-align:left;cursor:pointer;',
      'background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);',
      'border:.5px solid var(--dsw-alias-border-l3);border-radius:10px;font:inherit;transition:border-color .15s,background .15s}',
      '.tg-card:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.tg-card[aria-pressed="true"]{border-color:var(--dsw-alias-brand-primary);',
      'box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}',
      '.tg-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.tg-name{font-size:13.5px;font-weight:600}',
      '.tg-badge{font-size:11px;padding:1px 7px;border-radius:999px;',
      'background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground)}',
      '.tg-desc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5}',
      '.tg-strip{display:flex;height:6px;border-radius:999px;overflow:hidden;border:.5px solid var(--dsw-alias-border-l3)}',
      '.tg-strip span{flex:1}',
    ].join('')

    /**
     * Mirror the registry into the page's store.
     *
     * Same shape as the official settings-store.ts, including why it passes no
     * explicit type arguments: the generics settle from `init` plus the untyped
     * draft parameter in one inference round.
     * @returns store handle used as the page registration's `store` seat.
     */
    function createGalleryStore() {
      return defineStore({
        init: () => ({ ids: [], labels: {}, descriptions: {}, swatches: {}, selected: 'system', status: '', revision: -1 }),
        actions: {
          sync: (draft, themes, selected, revision) => {
            if (revision <= draft.revision) return
            const labels = {}
            const descriptions = {}
            const swatches = {}
            for (const theme of themes) {
              // Built-in themes carry no label — the official Appearance row
              // localizes them from its own dictionaries — so name them here
              // rather than showing a bare `light` / `dark` id.
              labels[theme.id] = theme.label || BUILT_IN_LABELS[theme.id] || theme.id
              // A built-in theme derives its colours from the base palette rather
              // than declaring tokens, so its card gets a plain line.
              descriptions[theme.id] = theme.description
                || (theme.id in BUILT_IN_LABELS ? '' : '')
              // A card's colour strip comes from the theme's own tokens, so a
              // theme authored anywhere shows its identity without extra metadata.
              const tokens = theme.tokens || {}
              const pick = (name) => {
                const value = tokens[name]
                if (value === undefined || value === null) return undefined
                return typeof value === 'string' ? value : value[theme.colorScheme]
              }
              swatches[theme.id] = [
                pick('--dsw-alias-brand-primary'),
                pick('--dsw-alias-label-secondary'),
                pick('--dsw-alias-state-business-primary'),
              ].filter((value) => typeof value === 'string' && value !== '')
            }
            draft.ids = themes.map((theme) => theme.id)
            draft.labels = labels
            draft.descriptions = descriptions
            draft.swatches = swatches
            draft.selected = selected
            draft.revision = revision
          },
          /**
           * Record why the page has nothing to show.
           *
           * An empty picker is indistinguishable from a broken picker without
           * this, and the boot screen only ever says "failed" — never why.
           * @param draft - store draft.
           * @param status - one line describing the state.
           */
          note: (draft, status) => { draft.status = status },
        },
      })
    }

    /**
     * Render one selectable theme card.
     * @param props - id, label, description, swatches, selected, onSelect.
     * @returns the card element.
     */
    function ThemeCard(props) {
      const { id, label, description, swatches, selected, applied, onSelect, t } = props
      return jsxs('button', {
        type: 'button',
        className: 'tg-card',
        'aria-pressed': selected,
        onClick: () => { onSelect(id) },
        title: description || label,
        children: [
          jsxs('div', {
            className: 'tg-card-top',
            children: [
              jsx('span', { className: 'tg-name', children: label || id }),
              selected ? jsx('span', { className: 'tg-badge', children: applied }) : null,
            ],
          }),
          swatches.length > 0
            ? jsx('span', {
              className: 'tg-strip',
              children: swatches.map((colour, index) => jsx('span', { style: { background: colour } }, index)),
            })
            : null,
          description ? jsx('span', { className: 'tg-desc', children: description }) : null,
        ],
      })
    }

    /**
     * Where the debug switch is remembered.
     *
     * A localStorage flag in addition to the URL fragment, because this plugin
     * ships as a package inside the desktop app: there is no address bar to add
     * `#theme-gallery-debug` to, so DevTools is the way in.
     */
    const DEBUG_KEY = 'theme-gallery:debug'

    /**
     * Whether the gallery shows its diagnostic detail lines.
     *
     * The raw readings — token counts, geometry, hit tests, the attempt log — are
     * for whoever is debugging, not for whoever is picking a skin, and this is a
     * shipped package. So they are opt-in, through either switch:
     *
     *   DevTools console:  localStorage.setItem('theme-gallery:debug', '1')
     *   …or a URL with      #theme-gallery-debug
     *   turn it off:       localStorage.removeItem('theme-gallery:debug')
     *
     * The switch gates DETAIL, never bad news: a line that reports a problem prints
     * whether or not it is on (see `sceneryLineIsWarning`), because "没有报错" and
     * "没有观测到报错" have been confused in this project before.
     * @returns true when the detail lines should render.
     */
    function debugEnabled() {
      try {
        if (typeof window !== 'undefined'
          && typeof window.location?.hash === 'string'
          && window.location.hash.includes('theme-gallery-debug')) return true
        return typeof window !== 'undefined' && window.localStorage?.getItem(DEBUG_KEY) === '1'
      } catch {
        return false
      }
    }

    /**
     * Read the theme state straight out of the document.
     *
     * It reads the live DOM rather than the theme service so a divergence between
     * the two becomes visible instead of being assumed away — that divergence is
     * exactly what a broken token or a stylesheet painting over the skin looks
     * like.
     * @param selected - the preference the page is showing as selected.
     * @returns one line describing the chain.
     */
    function themeDiagnostics(selected) {
      try {
        if (typeof document === 'undefined') return 'no document'
        const ctx = window.__DSH_THEME_DEBUG__ ?? {}
        const active = ctx.activeId === undefined ? '?' : String(ctx.activeId)
        const tokens = ctx.activeTokens === undefined ? '?' : String(ctx.activeTokens)
        const body = document.body
        const scheme = body === null ? '?' : (body.hasAttribute('data-ds-dark-theme') ? 'dark' : 'light')
        const background = body === null ? '?' : getComputedStyle(body).backgroundColor
        const brand = body === null
              ? '?'
              : getComputedStyle(body).getPropertyValue('--dsw-alias-brand-primary').trim() || '(unset)'
        const sidebar = body === null
              ? '?'
              : getComputedStyle(body).getPropertyValue('--dsw-specific-sidebar-fill').trim() || '(unset)'
        return `诊断 · 选中=${selected} · 服务内活动主题=${active} · 该主题 token=${tokens}`
              + ` · 配色=${scheme} · body 背景=${background}`
              + ` · brand=${brand} · sidebar-fill=${sidebar}`
              + ` · ${describeAccentLayer()}`
              + ` · 装饰=${describeAmbientReport()}`
      } catch (error) {
        return `诊断失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * Whether the scenery the active theme asks for actually reached the document.
     *
     * The plugin cannot see the app's console, and "the scenery did not appear" has
     * several indistinguishable causes. So the panel checks the one thing it can:
     * the active theme declares `ambient`, and the layer is missing, empty, or
     * unstyled. When that happens the reader is owed the reason on screen rather
     * than in a log they would have to know to open.
     * @param selected - the preference the page is showing as selected.
     * @returns a warning line, or null when nothing is wrong.
     */
    function ambientWarning(selected) {
      try {
        const wanted = bundledTheme(selected)?.ambient
        if (wanted === undefined) return null
        const report = ambientReport
        if (report === undefined) return `装饰未同步：syncSkin 尚未运行（期望 ${wanted.kind}）`
        if (report.found === false) return `装饰未生效：${report.note}（期望 ${wanted.kind}）`
        if (report.paintError !== undefined) return `装饰绘制抛错：${report.paintError}`
        if (report.children === 0) return `装饰层已插入但为空（期望 ${wanted.kind}）：未能构建任何节点`
        // The layer deliberately lives on the document body now, so "inside the sidebar
        // column" is no longer a requirement — checking it produced a permanent false
        // alarm and hid the readings that mattered.
        if (report.css !== true) return '样式表未生效：AMBIENT_CSS 不在 document 中'
        if (report.size === '0x0') return `装饰层尺寸为 0：display=${report.display} position=${report.position}`
        if (report.html === '(空)') return '装饰层里没有内容：innerHTML 未被写入'
        if (report.probe === '未建出') return '探针未建出：说明绘制在探针之前就中断了'
        if (report.artSize === '0x0') return '素材高度塌缩为 0：百分比的参照物没有高度'
        return null
      } catch (error) {
        return `装饰自检失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * The one-line scenery status shown on the panel.
     *
     * Deliberately dumb: it prints the report whatever it says. An earlier
     * revision only spoke when a self-check considered something wrong, so a check
     * that PASSED while the scenery was still invisible produced **silence** — the
     * worst possible output for a diagnostic. Keeping the numbers means the reader
     * sees the geometry even when the code's opinion of it is wrong.
     *
     * It was unconditional while the scenery was being brought up; now that the
     * package is public the RENDER SITE decides: routine reports wait for
     * `debugEnabled()`, while warnings and errors always print.
     * @param selected - the preference the page is showing as selected.
     * @returns the line, or null when the active theme asks for no scenery.
     */
    function sceneryLine(selected) {
      try {
        if (bundledTheme(selected)?.ambient === undefined) return null
        const warning = ambientWarning(selected)
        const prefix = warning === null ? '装饰自检通过' : `⚠ ${warning}`
        return `${prefix} · ${describeAmbientReport()}`
      } catch (error) {
        return `装饰自检失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * Whether the scenery line reports a problem rather than a routine pass.
     *
     * The line has three shapes: `装饰自检通过 · …` (routine), `⚠ <warning> · …`,
     * and `装饰自检失败: …`. Only the first may hide behind the debug switch — a
     * failure has to reach the person looking at the panel without them knowing
     * that a switch exists.
     * @param line - the scenery line.
     * @returns true when the line carries a warning or an error.
     */
    function sceneryLineIsWarning(line) {
      return typeof line === 'string' && (line.startsWith('⚠') || line.includes('失败'))
    }

    /**
     * Render the scenery report as one line.
     * @returns the report text.
     */
    function describeAmbientReport() {
      const report = ambientReport
      // The attempt log comes FIRST, because it answers the question the final state cannot:
      // whether the scenery was ever placed while the sidebar existed. Boot-time silence
      // leaves a perfectly healthy final report — the successful run happens later — so the
      // sequence is the only thing that shows the failure.
      const tried = `同步记录[${describeAmbientLog()}]`
      if (report === undefined) return `尚未同步（syncSkin 未运行） · ${tried}`
      if (report.found === false) return `未生效：${report.note} · ${tried}`
      if (report.note !== undefined) return `${report.kind} · ${report.note} · ${tried}`
      return `${report.kind} · 子元素=${report.children} · 座位=${report.size}`
        + ` · 挂载于=${report.parent}`
        + ` · 定位=${report.placement}`
        + ` · 内容=${report.html}`
        + ` · 子链=${report.kids}`
        + ` · 场景=${report.sceneSize} · 素材=${report.artSize}`
        + ` · 命中测试[${report.hitTest}]`
        + ` · 列几何[${report.columns}]`
        + ` · display=${report.display} · position=${report.position} · z-index=${report.zIndex}`
        + ` · ${tried}`
    }

    /**
     * The 山青婷彩 scene: two mountain ridges with a mist band, water at the foot
     * with expanding ripples, two hovering dragonflies, and falling petals.
     *
     * Ported from the source system's `ShanQingTingCaiAnimation.vue` one-to-one —
     * same paths, same gradients, same hues — so the port is recognisably the same
     * artwork rather than an approximation. Gradient ids are prefixed `dsh-` so
     * two themes can never collide through a shared `<defs>` id.
     * @param petals - how many petals to seed.
     * @returns the scene element.
     */
    /* ---------------- scenery markup ----------------
     *
     * The scenes are HTML STRINGS, injected with `innerHTML`, rather than React
     * elements mounted into a root owned by this plugin.
     *
     * Two earlier attempts failed silently and cost real debugging time:
     * `createRoot` mounted nothing at all in the shipped app, and a hand-written
     * walker that created nodes itself also produced an empty seat — while a plain
     * pseudo-element on the same seat was visible, which proved the seat paints and
     * put the fault squarely in how the children were constructed.
     *
     * Markup removes the two things those approaches had to get right by hand:
     * the HTML parser switches to the SVG namespace on its own inside `<svg>`, and
     * attribute names are written as the SVG actually spells them (`stop-color`)
     * instead of being translated from JSX casing. Everything here is also plain
     * text, so it can be asserted without a DOM.
     *
     * Only attributes and hex/CSS values reach this builder — no text content, no
     * user input — and `sceneMarkup` refuses anything script-bearing regardless.
     */
    const SVG_TAGS = new Set(['svg', 'defs', 'linearGradient', 'stop', 'path', 'ellipse', 'g', 'circle'])

    /**
     * Serialise one attribute.
     * @param name - the attribute name, already in its markup spelling.
     * @param value - its value.
     * @returns the attribute, or an empty string when it carries no value.
     */
    function attr(name, value) {
      const text = String(value)
      const safe = SVG_TAGS.has('svg') && (name.startsWith('on') || /^javascript:/i.test(text))
        ? ''
        : ` ${name}="${text.replace(/"/g, '&quot;')}"`
      return safe
    }

    /**
     * Open a tag.
     * @param tag - element name.
     * @param attributes - attribute map; nullish values are dropped.
     * @returns the opening tag.
     */
    function open(tag, attributes) {
      let out = `<${tag}`
      for (const [name, value] of Object.entries(attributes ?? {})) {
        if (value === null || value === undefined) continue
        out += attr(name, value)
      }
      return `${out}>`
    }

    /**
     * The 山青婷彩 scene: two mountain ridges, a mist band, water at the foot with
     * expanding ripples, two hovering dragonflies, and falling petals.
     *
     * Ported from the source system's \`ShanQingTingCaiAnimation.vue\` — same paths,
     * same gradients, same structure. Colours are darkened from the source values:
     * the originals sat behind a 223px sidebar and, at this width, the far ridge
     * landed on the sidebar's own gradient value and was invisible.
     * @param petals - how many petals to seed.
     * @returns the scene markup.
     */
    function shanAmbientScene(petals) {
      const count = Math.max(0, Math.min(20, petals ?? 7))
      let petalNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const petalSize = 7 + ((n * 3) % 4)
        petalNodes += open('div', {
          class: 'sta-petal',
          // Everything inline: position, size, colour, shape and the animation timing.
          style: 'position:absolute;top:-1em;'
            + `left:${((n * 17) % 80) + 8}%;width:${petalSize}px;height:${petalSize - 1}px;`
            + 'background:linear-gradient(135deg,#F8BBD2 0%,#E88BB0 60%,#D97BA4 100%);'
            + 'border-radius:60% 40% 55% 45%/60% 55% 45% 40%;opacity:.9;'
            + `animation:dsh-amb-fall ${6 + ((n * 5) % 3)}s linear infinite;animation-delay:${-(n * 0.9)}s`,
        }) + '</div>'
      }

      const mountains = open('div', {
        class: 'sta-mountains',
        // Inline, like the layer itself: if the ridge appears but stays flat, the
        // stylesheet is not being applied at all, which the computed readings could not
        // reveal because they were reading the layer's inline values.
        style: 'position:absolute;left:0;right:0;bottom:0;height:46%;z-index:3',
      })
        + open('svg', {
          viewBox: '0 0 223 190',
          preserveAspectRatio: 'none',
          // No background. A magenta fill lived here while the layer's ability to paint was
          // still in question; it is what the user saw as a bright pink block over the
          // sidebar, and the ridges below are the actual artwork.
          style: 'display:block;width:100%;height:100%',
        })
        + open('defs', {})
        + open('linearGradient', { id: 'dsh-sta-back', x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0', 'stop-color': '#8FBFAA' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#74AE96' }) + '</stop>'
        + '</linearGradient>'
        + open('linearGradient', { id: 'dsh-sta-front', x1: '0', y1: '0', x2: '0', y2: '1' })
        + open('stop', { offset: '0', 'stop-color': '#3E8A66' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#2B6E4F' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + open('path', {
          d: 'M 0 78 Q 30 48 62 66 Q 96 34 128 60 Q 160 40 190 62 Q 208 50 223 58 L 223 190 L 0 190 Z',
          fill: 'url(#dsh-sta-back)',
        }) + '</path>'
        + open('path', {
          d: 'M 0 122 Q 36 92 70 110 Q 104 84 140 108 Q 176 90 223 116 L 223 190 L 0 190 Z',
          fill: 'url(#dsh-sta-front)',
        }) + '</path>'
        + '</svg>'
        + '</div>'

      return open('div', {
        class: 'sta',
        // Fills the scene box — the sidebar's blank area — and no more.
        //
        // This was stretched to the full viewport during bring-up. That left it 1280x820
        // inside a 280x260 box, so every percentage-positioned child (the ridges at 46%
        // height, the dragonflies at 58%/74%) resolved against the SCREEN and landed
        // outside the box, where `overflow:hidden` removed them. Only the petals stayed
        // visible, because they start at the box's top edge and fall into it.
        style: 'position:absolute;inset:0;display:block',
      })
        + mountains
        + open('div', {
          class: 'sta-mist sta-mist-1',
          style: 'position:absolute;height:1.6em;width:66%;top:58.5%;left:13%;border-radius:1000px;z-index:4;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);'
            + 'filter:blur(5px);opacity:.85;animation:dsh-amb-mist 26s ease-in-out infinite alternate',
        }) + '</div>'
        + open('div', {
          class: 'sta-mist sta-mist-2',
          style: 'position:absolute;height:1.6em;width:48%;top:63%;left:40%;border-radius:1000px;z-index:4;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,255,255,.75),transparent);'
            + 'filter:blur(5px);opacity:.6;animation:dsh-amb-mist 32s ease-in-out infinite alternate;'
            + 'animation-delay:-9s',
        }) + '</div>'
        + open('div', {
          class: 'sta-pond',
          style: 'position:absolute;left:0;right:0;bottom:0;height:14%;z-index:5;'
            + 'background:linear-gradient(to bottom,rgba(104,178,150,.62),rgba(66,141,113,.78))',
        })
        + open('div', {
          class: 'sta-pond-line',
          style: 'position:absolute;top:0;left:0;right:0;height:1.2px;opacity:.6;'
            + 'background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent)',
        }) + '</div>'
        + '</div>'
        + rippleMarkup('38%', '5.2%', '0s')
        + rippleMarkup('62%', '3.4%', '1.6s')
        + dragonflyBlock('1', 'sta-dfly-1', 'top:58%;left:6%;width:3.8em', 'dsh-amb-hover1 11s ease-in-out infinite', '0s')
        + dragonflyBlock('2', 'sta-dfly-2', 'top:74%;left:16%;width:2.6em;opacity:.95', 'dsh-amb-hover2 13s ease-in-out infinite', '-5s')
        + open('div', { class: 'sta-petals', style: 'position:absolute;inset:0;z-index:7;pointer-events:none' })
        + petalNodes + '</div>'
        + '</div>'
    }

    /**
     * The dragonfly artwork, shared by both instances.
     *
     * Each copy carries its own \`<defs>\` and a suffixed gradient id, because the two
     * dragonflies are separate elements that animate independently and gradient ids
     * must stay unique across the document.
     * @param suffix - makes the gradient id unique per instance.
     * @returns the dragonfly markup.
     */
    function dragonflyMarkup(suffix) {
      const gradient = `dsh-sta-dfly-body-${suffix}`
      return open('svg', { viewBox: '0 0 100 70' })
        + open('defs', {})
        + open('linearGradient', { id: gradient, x1: '1', y1: '0', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#1F6B4C' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#2E8C66' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + open('ellipse', { cx: '36', cy: '15', rx: '17', ry: '4.4', fill: 'rgba(150,200,222,0.5)', transform: 'rotate(-40 36 15)' }) + '</ellipse>'
        + open('ellipse', { cx: '38', cy: '24', rx: '15', ry: '4', fill: 'rgba(150,200,222,0.42)', transform: 'rotate(-14 38 24)' }) + '</ellipse>'
        + open('ellipse', {
          cx: '31', cy: '11', rx: '19', ry: '5', fill: 'rgba(214,242,248,0.7)',
          transform: 'rotate(-30 31 11)', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': '0.6',
        }) + '</ellipse>'
        + open('ellipse', {
          cx: '34', cy: '22', rx: '16', ry: '4.6', fill: 'rgba(240,214,242,0.62)',
          transform: 'rotate(-6 34 22)', stroke: 'rgba(255,255,255,0.55)', 'stroke-width': '0.6',
        }) + '</ellipse>'
        + open('path', {
          d: 'M 27 32 C 42 39, 60 46, 84 55',
          stroke: `url(#${gradient})`, 'stroke-width': '3', fill: 'none', 'stroke-linecap': 'round',
        }) + '</path>'
        + open('circle', { cx: '84', cy: '55', r: '1.4', fill: '#17513C' }) + '</circle>'
        + open('ellipse', { cx: '27', cy: '30', rx: '6.5', ry: '5', fill: '#1F6B4C' }) + '</ellipse>'
        + open('circle', { cx: '18.5', cy: '27.5', r: '4.2', fill: '#17513C' }) + '</circle>'
        + open('circle', { cx: '16.2', cy: '25.8', r: '1.9', fill: '#0F3D2E' }) + '</circle>'
        + open('circle', { cx: '20.6', cy: '25.4', r: '1.9', fill: '#0F3D2E' }) + '</circle>'
        + open('circle', { cx: '15.6', cy: '25.2', r: '0.6', fill: '#DFF3EC' }) + '</circle>'
        + open('circle', { cx: '20', cy: '24.8', r: '0.6', fill: '#DFF3EC' }) + '</circle>'
        + '</svg>'
    }

    /**
     * The 梦海游鱼 scene: a soft corner glow with two drifting light washes, rising
     * bubbles, a second layer of glowing motes, and swaying seaweed over stones,
     * all grounded on a water-floor band. The floor is what makes the scene read as
     * one piece the way shan's mountains do: it starts fully transparent (the
     * sidebar's own gradient shows through at the junction) and deepens downward,
     * so the elements emerge from the water instead of floating on it.
     *
     * Ported from \`DreamOceanAmbient.vue\`. The source also keeps a separate
     * cartoon-fish animation on top; that is a distinct component there and is not
     * part of this ambience.
     * @param bubbles - how many bubbles to seed.
     * @param motes - how many glowing motes to seed. A separate effect from the bubbles,
     *   and deliberately seeded separately so either can be tuned without touching the other.
     * @returns the scene markup.
     */
    function dreamAmbientScene(bubbles, motes, fish) {
      const count = Math.max(0, Math.min(24, bubbles ?? 9))
      let bubbleNodes = ''
      for (let n = 1; n <= count; n += 1) {
        const size = 3 + ((n * 4) % 4)
        bubbleNodes += open('div', {
          class: 'dof-bubble',
          style: 'position:absolute;bottom:-1em;border-radius:50%;'
            + 'background:radial-gradient(circle at 32% 30%,rgba(255,255,255,.95),rgba(190,232,246,.55));'
            + 'box-shadow:inset 0 0 0 1px rgba(255,255,255,.6);'
            + `left:${((n * 23) % 86) + 6}%;width:${size}px;height:${size}px;`
            + `animation:dsh-amb-rise ${8 + ((n * 7) % 8)}s linear infinite;animation-delay:${-(n * 1.7)}s`,
        }) + '</div>'
      }

      // The cartoon fish, from the source system's own `FishAnimation.vue`. They are a
      // distinct effect again — not bubbles and not motes — so they get their own container
      // and their own count.
      const fishCount = Math.max(0, Math.min(6, fish ?? 3))
      // size(em), top(%), duration(s), delay(s), direction. Three different depths, sizes and
      // speeds so they read as separate fish rather than one repeated sprite.
      const FISH_PLAN = [
        [2.4, 26, 34, -4, false],
        [1.7, 52, 46, -18, true],
        [1.3, 71, 40, -29, false],
        [2.0, 40, 52, -36, true],
        [1.5, 63, 38, -11, false],
        [1.1, 33, 48, -24, true],
      ]
      let fishNodes = ''
      for (let n = 0; n < fishCount; n += 1) {
        const [size, top, duration, delay, flip] = FISH_PLAN[n % FISH_PLAN.length]
        fishNodes += fishMarkup(String(n + 1), size, top, duration, delay, flip)
      }

      // The glowing motes: a second, independent effect drawn over the bubbles.
      const moteCount = Math.max(0, Math.min(24, motes ?? 5))
      let moteNodes = ''
      for (let n = 1; n <= moteCount; n += 1) {
        const size = 5 + ((n * 3) % 4)
        moteNodes += open('div', {
          class: 'dof-mote',
          style: 'position:absolute;bottom:-1em;border-radius:50%;'
            + 'background:radial-gradient(circle at 34% 30%,#FFFFFF 0%,#D6F1FF 40%,'
            + 'rgba(122,205,255,.5) 72%,rgba(122,205,255,0) 100%);'
            + 'box-shadow:0 0 10px 3px rgba(122,205,255,.55),0 0 22px 6px rgba(122,205,255,.22);'
            + `left:${((n * 31) % 84) + 8}%;width:${size}px;height:${size}px;`
            + `animation:dsh-amb-mote ${9 + ((n * 5) % 7)}s linear infinite;animation-delay:${-(n * 2.1)}s`,
        }) + '</div>'
      }

      return open('div', { class: 'dof', style: 'position:absolute;inset:0;display:block' })
        + open('div', { class: 'dof-glow', style: 'position:absolute;inset:0;z-index:2' })
        // The sunlight pool. It used to be centred ON the band's top edge at full
        // brightness, so the scene box's overflow clip cut it into a hard white line
        // against the un-lit middle of the sidebar — the boundary the user reported.
        // Now it starts AT the edge, is dimmer, and is masked to zero there; the
        // sidebar gradient's own light-pool stop (meng-hai-you-yu.json, 62–70%)
        // continues the bloom above the edge.
        + open('div', {
          class: 'dof-corner',
          style: 'position:absolute;top:0;left:-30%;width:150%;height:40%;'
            + 'background:radial-gradient(ellipse at 32% 50%,rgba(255,255,255,.55),rgba(255,255,255,0) 62%);'
            + 'filter:blur(12px);'
            + '-webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 45%);'
            + 'mask-image:linear-gradient(to bottom,transparent 0,#000 45%);'
            + 'animation:dsh-amb-wash 18s ease-in-out infinite alternate',
        }) + '</div>'
        + open('div', {
          class: 'dof-wash dof-wash-1',
          style: 'position:absolute;left:-20%;width:140%;height:30%;top:14%;filter:blur(12px);opacity:.5;'
            + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);'
            + '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'animation:dsh-amb-wash 24s ease-in-out infinite alternate',
        }) + '</div>'
        + open('div', {
          class: 'dof-wash dof-wash-2',
          style: 'position:absolute;left:-20%;width:140%;height:30%;top:34%;filter:blur(12px);opacity:.34;'
            + 'background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);'
            + '-webkit-mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'mask-image:linear-gradient(to bottom,transparent,#000 22%,#000 78%,transparent);'
            + 'animation:dsh-amb-wash 31s ease-in-out infinite alternate;animation-delay:-8s',
        }) + '</div>'
        + '</div>'
        + open('div', { class: 'dof-bubbles', style: 'position:absolute;inset:0;z-index:6;pointer-events:none' })
        + bubbleNodes + '</div>'
        + open('div', { class: 'dof-fish-layer', style: 'position:absolute;inset:0;z-index:6;pointer-events:none' })
        + fishNodes + '</div>'
        + open('div', { class: 'dof-motes', style: 'position:absolute;inset:0;z-index:7;pointer-events:none' })
        + moteNodes + '</div>'
        + open('div', {
          class: 'dof-floor',
          style: 'position:absolute;left:0;right:0;bottom:0;height:20%;z-index:4;'
            + 'background:linear-gradient(to bottom,rgba(126,184,222,0) 0%,rgba(126,184,222,.4) 46%,rgba(84,152,199,.62) 100%)',
        }) + '</div>'
        + open('div', {
          class: 'dof-seaweed',
          style: 'position:absolute;left:0;right:0;bottom:0;height:38%;z-index:5',
        }) + seaweedMarkup() + '</div>'
        + '</div>'
    }

    /**
     * The seaweed artwork, reproduced from the source system's paths.
     *
     * Five blades from three gradients, each animating on its own phase so the bed
     * sways rather than moving as one rigid shape, over three resting stones.
     * @returns the seaweed markup.
     */
/**
     * One expanding ring on the water, positioned inline.
     * @param left - horizontal position.
     * @param bottom - vertical position.
     * @param delay - animation delay, so the rings do not pulse in unison.
     * @returns the ring markup.
     */
    function rippleMarkup(left, bottom, delay) {
      const ring = 'position:absolute;inset:0;border:1.6px solid rgba(232,139,176,.92);border-radius:50%;'
        + `animation:dsh-amb-ring 3.2s ease-out infinite;animation-delay:${delay}`
      return open('div', {
        class: 'sta-ripple',
        style: `position:absolute;z-index:6;width:.55em;height:.55em;left:${left};bottom:${bottom}`,
      }) + `<span style="${ring}"></span><span style="${ring}"></span></div>`
    }

    /**
     * One hovering dragonfly: an outer element on its flight path and an inner one
     * bobbing on the wingbeat, so the two motions compose.
     * @param suffix - gradient id suffix.
     * @param className - the positioning class.
     * @param position - inline position.
     * @param flight - animation shorthand for the flight path.
     * @param delay - animation delay.
     * @returns the dragonfly markup.
     */
    function dragonflyBlock(suffix, className, position, flight, delay) {
      return open('div', {
        class: `sta-dfly ${className}`,
        style: `position:absolute;z-index:8;will-change:transform;${position};`
          + `animation:${flight};animation-delay:${delay}`,
      }) + open('div', {
        class: 'sta-bob',
        style: `animation:dsh-amb-bob ${suffix === '2' ? '1.1s' : '.9s'} ease-in-out infinite;`
          + `animation-delay:${suffix === '2' ? '-.4s' : '0s'}`,
      }) + dragonflyMarkup(suffix) + '</div></div>'
    }

    /**
     * One seaweed blade. The sway is applied to the group so the blades move from their
     * base, and each blade animates on its own phase.
     * @param key - blade index.
     * @param d - path data.
     * @param gradient - gradient id.
     * @param width - stroke width.
     * @param opacity - blade opacity.
     * @returns the blade markup.
     */
    function bladeMarkup(key, d, gradient, width, opacity) {
      const durations = { 1: '6s', 2: '7.4s', 3: '5.2s', 4: '8.1s', 5: '6.6s' }
      const delays = { 1: '0s', 2: '-1.6s', 3: '-2.8s', 4: '-.9s', 5: '-3.4s' }
      return open('g', {
        class: `dof-blade dof-blade-${key}`,
        style: `transform-origin:50% 100%;animation:dsh-amb-sway ${durations[key]} ease-in-out infinite alternate;`
          + `animation-delay:${delays[key]}`,
      }) + open('path', {
        d, fill: `url(#${gradient})`, stroke: `url(#${gradient})`, 'stroke-width': width, opacity,
      }) + '</path></g>'
    }

    function seaweedMarkup() {
      const blade = bladeMarkup

      return open('svg', {
        viewBox: '0 0 140 120',
        preserveAspectRatio: 'none',
        style: 'display:block;width:100%;height:100%',
      })
        + open('defs', {})
        + open('linearGradient', { id: 'dsh-dof-weed-a', x1: '0', y1: '1', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#1E6E93' }) + '</stop>'
        + open('stop', { offset: '0.55', 'stop-color': '#3E93BC' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#A5DEF0', 'stop-opacity': '0.85' }) + '</stop>'
        + '</linearGradient>'
        + open('linearGradient', { id: 'dsh-dof-weed-b', x1: '0', y1: '1', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#2B7FA6' }) + '</stop>'
        + open('stop', { offset: '0.6', 'stop-color': '#4FA3C6' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#B8E2F2', 'stop-opacity': '0.85' }) + '</stop>'
        + '</linearGradient>'
        + open('linearGradient', { id: 'dsh-dof-weed-c', x1: '0', y1: '1', x2: '0', y2: '0' })
        + open('stop', { offset: '0', 'stop-color': '#4A78A8' }) + '</stop>'
        + open('stop', { offset: '0.6', 'stop-color': '#7FA9CE' }) + '</stop>'
        + open('stop', { offset: '1', 'stop-color': '#CBE2F4', 'stop-opacity': '0.8' }) + '</stop>'
        + '</linearGradient>'
        + '</defs>'
        + blade('1', 'M 22 120 C 12 96, 26 74, 18 48 C 15 38, 18 28, 24 20 C 20 34, 24 44, 30 60 C 36 80, 30 100, 32 120 Z', 'dsh-dof-weed-a', '2.2', '0.95')
        + blade('2', 'M 48 120 C 40 98, 54 80, 46 56 C 42 44, 48 34, 56 24 C 50 40, 56 52, 60 68 C 64 88, 56 104, 58 120 Z', 'dsh-dof-weed-b', '2', '0.92')
        + blade('3', 'M 74 120 C 68 102, 78 88, 72 68 C 69 58, 72 48, 78 40 C 74 52, 78 62, 82 76 C 86 94, 80 108, 82 120 Z', 'dsh-dof-weed-c', '1.8', '0.88')
        + blade('4', 'M 96 120 C 92 104, 102 90, 96 72 C 93 62, 96 54, 102 46 C 98 58, 102 68, 106 82 C 110 98, 102 110, 104 120 Z', 'dsh-dof-weed-a', '1.6', '0.85')
        + blade('5', 'M 118 120 C 114 108, 122 96, 117 82 C 115 74, 117 68, 121 62 C 118 72, 121 80, 124 92 C 127 104, 121 112, 123 120 Z', 'dsh-dof-weed-b', '1.4', '0.8')
        + open('ellipse', { cx: '30', cy: '119', rx: '14', ry: '4', fill: '#7FAFC6', opacity: '0.55' }) + '</ellipse>'
        + open('ellipse', { cx: '72', cy: '120', rx: '10', ry: '3.4', fill: '#8FB9CE', opacity: '0.5' }) + '</ellipse>'
        + open('ellipse', { cx: '108', cy: '119.5', rx: '12', ry: '3.6', fill: '#7FAFC6', opacity: '0.45' }) + '</ellipse>'
        + '</svg>'
    }

    /**
     * One cartoon fish, swimming across the water.
     *
     * Ported from the source system's separate `FishAnimation.vue`. That component drives the
     * fish from JavaScript through entering / bubbling / leaving phases on a 60-second cycle,
     * but this skin is a static bundle with no component runtime to host a script — so the
     * same artwork swims continuously instead, on a CSS `@keyframes` cross, with the tail and
     * the whole body on separate animations so it reads as swimming rather than sliding.
     *
     * The artwork is reproduced shape for shape: the body curve, tail, dorsal fin, pectoral
     * fin, and the three-part eye. The colours are retuned into the theme's blue family —
     * the source values (`#38bdf8` body, `#1d4ed8` fins) sat outside the dream palette and
     * read as a sticker, the same treatment shan's mountains got when their source greens
     * were darkened for this sidebar.
     * @param suffix - unique id suffix, so several fish can coexist.
     * @param size - rendered width in em.
     * @param top - vertical position within the water, as a percentage.
     * @param duration - seconds for one crossing.
     * @param delay - animation delay, so the fish do not move in lockstep.
     * @param flip - whether this fish swims right-to-left instead.
     * @returns the fish markup.
     */
    function fishMarkup(suffix, size, top, duration, delay, flip) {
      const anim = flip ? 'dsh-amb-swim-back' : 'dsh-amb-swim'
      return open('div', {
        class: `dof-fish${flip ? ' dof-fish-flip' : ''}`,
        style: 'position:absolute;left:0;opacity:.94;'
          + `top:${top}%;width:${size}em;`
          + `animation:${anim} ${duration}s linear infinite;animation-delay:${delay}s`,
      })
        + open('div', {
          class: 'dof-fish-bob',
          style: `animation-duration:${(duration / 8).toFixed(2)}s`,
        })
        + open('svg', {
          viewBox: '0 0 50 18',
          preserveAspectRatio: 'xMidYMid meet',
          style: 'display:block;width:100%;height:auto;overflow:visible',
        })
        + open('g', { class: 'dof-fish-body' })
        // Body — recoloured into the theme's own blue family. The source values
        // (`#38bdf8` body, `#1d4ed8` fins) sat outside the dream palette and read
        // as a sticker pasted on the water; the same treatment shan's mountains
        // got when their source greens were darkened for this sidebar.
        + open('path', {
          d: 'M10 10 C20 5 35 5 45 10 C40 15 25 15 10 10 Z',
          fill: '#5FA5D6', stroke: '#2B6E9E', 'stroke-width': '1',
        }) + '</path>'
        // Tail
        + open('path', {
          d: 'M10 10 L5 7 L5 13 Z',
          fill: '#2B6E9E', stroke: '#2B6E9E', 'stroke-width': '1', class: 'dof-fish-tail',
        }) + '</path>'
        // Dorsal fin
        + open('path', {
          d: 'M20 7 L25 3 L30 7',
          fill: '#2B6E9E', stroke: '#2B6E9E', 'stroke-width': '1',
        }) + '</path>'
        // Pectoral fin
        + open('path', {
          d: 'M35 9 L40 12 L45 9',
          fill: '#5FA5D6', stroke: '#2B6E9E', 'stroke-width': '1',
        }) + '</path>'
        // Eye: white, pupil, highlight
        + open('circle', { cx: '40', cy: '8', r: '2', fill: '#FFFFFF' }) + '</circle>'
        + open('circle', { cx: '41', cy: '8', r: '1', fill: '#16384F' }) + '</circle>'
        + open('circle', { cx: '40.5', cy: '7.5', r: '0.5', fill: '#FFFFFF' }) + '</circle>'
        + '</g>'
        + '</svg>'
        + '</div></div>'
    }

    /**
     * Apply a function on every tick until the thing it observes stops changing.
     *
     * This exists because the scenery has to be placed against a layout that is still being
     * built. The previous approach fired a fixed burst of animation frames plus three fixed
     * delays, all counted from the moment the plugin applied — the wrong clock entirely. The
     * shell mounts its sidebar whenever it is ready (after fonts, stores and window state),
     * which on this machine is later than 900ms; by then every retry had been spent and the
     * scenery stayed absent until something unrelated fired one more sync.
     *
     * So the wait is driven by the OBSERVED GEOMETRY rather than by elapsed time: sample it,
     * and once two consecutive samples agree, the shell has settled and the measurement can be
     * trusted. `apply` runs on every tick so the scenery keeps up while the layout moves, and
     * the loop stops as soon as it is stable — or after a bounded window, so a failed boot
     * cannot leave a timer running forever.
     *
     * The loop body is isolated from the DOM so it can be tested directly against a stub clock
     * and a stub sample: the bug it fixes is a timing bug, and a timing bug that cannot be
     * tested is how this one survived several rounds.
     * @param options - the loop's collaborators.
     * @param options.sample - returns a geometry fingerprint, or null when unavailable.
     * @param options.apply - runs each tick, before sampling.
     * @param options.setTimer - schedules a callback after a delay, returning a handle.
     * @param options.clearTimer - cancels a handle from `setTimer`.
     * @param options.now - current time in milliseconds.
     * @param options.intervalMs - delay between ticks.
     * @param options.maxMs - give up after this long.
     * @param options.stableTicks - consecutive equal samples required to call it settled.
     * @returns a handle with `stop()`, which cancels any pending tick.
     */
    function repeatUntilStable(options) {
      const {
        sample, apply, setTimer, clearTimer, now,
        intervalMs = 100,
        maxMs = 15000,
        stableTicks = 2,
      } = options
      const startedAt = now()
      let previous
      let stable = 0
      let handle
      let stopped = false

      const tick = () => {
        if (stopped) return
        apply()
        const signature = sample()
        if (signature !== null && signature === previous) stable += 1
        else stable = 0
        previous = signature
        const settled = signature !== null && stable >= stableTicks
        if (settled || now() - startedAt > maxMs) return
        handle = setTimer(tick, intervalMs)
      }

      handle = setTimer(tick, intervalMs)

      return {
        stop() {
          stopped = true
          if (handle !== undefined) clearTimer(handle)
          handle = undefined
        },
      }
    }

    /**
     * Pick the scene markup for a theme.
     *
     * Returns an empty string for a theme with no scenery, which is what clears the
     * seat — the scenery belongs to the skin, not to the app.
     * @param kind - the ambient kind.
     * @param options - the theme's ambient options.
     * @returns the markup.
     */
    function sceneMarkup(kind, options) {
      const markup = kind === 'shan'
        ? shanAmbientScene(options?.petals)
        : kind === 'dream'
          ? dreamAmbientScene(options?.bubbles, options?.motes, options?.fish)
          : ''
      // The builder is fed only attributes and hex values, but this is the one place
      // markup from outside this file could ever arrive, so it refuses anyway.
      if (/<script|\son[a-z]+\s*=/i.test(markup)) {
        throw new Error('theme-gallery: refusing scenery markup containing script or handlers')
      }
      return markup
    }

    function sidebarColumn() {
      if (typeof document === 'undefined') return null
      return document.querySelector('[data-windows-titlebar] .ZTP-Xa_sidebarCol')
        || document.querySelector('.ZTP-Xa_sidebarCol')
        || document.querySelector('[class*="_sidebarCol"]')
        || document.querySelector('aside[class*="sidebar" i]')
        || null
    }

    /**
     * Mount a React element into a plain DOM node owned by this plugin.
     *
     * The scenery cannot go through the slot system — the sidebar column has no
     * slot for scenery, and a slot component would be a child of the column rather
     * than a layer behind it. So this owns the seat, and is the ONLY place in this
     * plugin that touches the shell's DOM directly.
     */
    let ambientPaintError

    /**
     * What the last scenery sync actually achieved, for the debug line.
     *
     * Kept because "the scenery did not appear" has several indistinguishable
     * causes from outside the app — sidebar not found, seat never created, a mount
     * that failed, or a seat with zero size — and only the live element separates
     * them.
     */
    let ambientReport

    /**
     * The signature of the last scenery sync that actually touched the DOM.
     *
     * `syncAmbient` is invoked from a body-wide `MutationObserver` and also writes to the DOM,
     * so it can observe its own writes. Comparing this before doing any work is what breaks
     * that cycle — see the long note inside `syncAmbient`. Reset to `undefined` whenever the
     * sync bails out, so the next call is allowed to try again.
     */
    let lastAmbientFingerprint

    /**
     * A rolling log of every attempt to place the scenery, newest last.
     *
     * The previous diagnostics reported only the FINAL state, which cannot distinguish
     * "never computed" from "computed wrongly and then corrected". That gap is exactly where
     * the boot-time bug lived: the scenery was synced while the sidebar did not exist yet,
     * bailed out, and nothing said so — the report simply showed the last, healthy run.
     *
     * Each entry records when an attempt happened, whether the column was found, and the
     * geometry that was actually used.
     */
    const AMBIENT_LOG_LIMIT = 12
    let ambientLog = []

    /** When this module began, for readable relative timings in the log. */
    const bootAt = typeof Date.now === 'function' ? Date.now() : 0

    /** When the page itself started, so a late first sync is visible as such. */
    const pageAt = (() => {
      try {
        const origin = typeof performance !== 'undefined' ? performance.timeOrigin : undefined
        return typeof origin === 'number' && origin > 0 ? origin : bootAt
      } catch {
        return bootAt
      }
    })()

    /**
     * Milliseconds since the page began loading.
     *
     * The log used to be relative to PLUGIN start only, which hid the single most important fact
     * during the boot investigation: when the first sync actually happened. Every entry shown was
     * already tens of seconds old, so "did anything run during startup?" could not be answered
     * from the panel at all. Anchoring to the page makes a late start obvious.
     * @returns milliseconds since page start.
     */
    function sincePageStart() {
      try {
        return Math.max(0, Math.round(Date.now() - pageAt))
      } catch {
        return 0
      }
    }

    /**
     * Record one scenery-sync attempt.
     * @param entry - the attempt, without its timestamp.
     */
    function noteAmbientAttempt(entry) {
      try {
        const now = Date.now()
        ambientLog.push({
          // `bootAt` is 0 only when `Date.now` is unavailable, and then 0 is the honest value.
          t: bootAt === 0 ? 0 : now - bootAt,
          page: sincePageStart(),
          ...entry,
        })
        if (ambientLog.length > AMBIENT_LOG_LIMIT) ambientLog = ambientLog.slice(-AMBIENT_LOG_LIMIT)
      } catch {
        // Diagnostics must never break the feature they are diagnosing.
      }
    }

    /**
     * Record a lifecycle DECISION, which is not a sync attempt.
     *
     * The boot investigation kept stalling because the log held only sync attempts, so a gate that
     * silently refused to act left no trace whatsoever — `ensureSkinPainted` returning early
     * because `bootSettled` was still false, or `markBootSettled` never firing, were both
     * invisible. Decisions are now recorded alongside the attempts.
     *
     * A repeated state COLLAPSES into its existing line instead of appending another. These paths
     * run every frame, and a ring buffer of twelve identical entries buries the one line that
     * matters: during the boot investigation the first sync was tens of seconds earlier than
     * everything else, and by the time the panel was opened to read the log it had long been
     * pushed out by repeats.
     * @param label - a short decision label, e.g. `未上色·跳转一次`.
     * @param detail - optional extra context.
     */
    function noteAmbientEvent(label, detail) {
      try {
        const text = detail === undefined ? label : `${label}(${detail})`
        const last = ambientLog.length === 0 ? undefined : ambientLog[ambientLog.length - 1]
        if (last !== undefined && last.band === text) {
          // Same state: refresh the clock rather than adding a line, so "still here" reads as a
          // recent time and the rest of the buffer stays available for state CHANGES.
          last.t = bootAt === 0 ? 0 : Date.now() - bootAt
          last.page = sincePageStart()
          return
        }
        ambientLog.push({
          t: bootAt === 0 ? 0 : Date.now() - bootAt,
          page: sincePageStart(),
          column: true,
          band: text,
        })
        if (ambientLog.length > AMBIENT_LOG_LIMIT) ambientLog = ambientLog.slice(-AMBIENT_LOG_LIMIT)
      } catch {
        // Diagnostics must never break the feature they are diagnosing.
      }
    }

    /**
     * Render the attempt log as one line.
     * @returns a compact, ordered summary of recent attempts.
     */
    function describeAmbientLog() {
      if (ambientLog.length === 0) return '（无记录）'
      return ambientLog
        .map((e) => {
          // Two clocks: `p` is since page start (when boot really began), `+` is since this plugin
          // mounted. Comparing them is what exposes a late start.
          const at = `p${e.page ?? '?'}/+${e.t}ms`
          if (e.column === false) return `${at} 无侧栏`
          return `${at} ${e.band === undefined ? '几何未测' : e.band}`
        })
        .join(' | ')
    }


    /**
     * Draw a scene into the seat.
     *
     * @param element - the scene element, or null to clear the seat.
     * @param seat - the seat node inside the sidebar column.
     */
    /**
     * Where the scenery band goes, in viewport coordinates.
     *
     * The band fills the sidebar's BLANK AREA: it stops above the account row and reaches
     * up roughly a third of the column.
     *
     * Two corrections are folded in here. A cap of 420px once put the band's top at 55% of
     * a 780px column — the middle of the sidebar rather than its lower third. And the band
     * used to run to the column's very bottom, which is where the account row lives: the
     * water band ended up over the signed-in user's avatar and name, and because this layer
     * is pointer-transparent the area stayed clickable, so it read as a broken menu rather
     * than a covered one.
     *
     * `footerHeight()` measures that reserved strip instead of hard-coding a value, so the
     * band follows the row if its size changes.
     * @param column - the sidebar column.
     * @returns the band box, or null when the column is unmeasurable.
     */
    function bandBox(column) {
      const rect = column.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null

      // Reserved strip at the bottom: the account row with the avatar and nickname.
      //
      // Clamped so the measurement can never consume the band. Early in boot the shell's
      // layout is not settled and this probe can read something far too tall; without the
      // clamp the band collapsed and the scenery silently disappeared until an unrelated
      // repaint brought it back — which is why the artwork only showed up after opening the
      // settings panel.
      const reserved = Math.min(footerHeight(column), Math.max(0, Math.round(rect.height * 0.25)))

      // The band is placed by POSITION, not by a share of the height.
      //
      // Sizing it as a fraction of the column ("height = 30% of usable", "40%") kept the
      // right footprint but moved its CENTRE around: on a 780px column a 288px band spanned
      // 472..760, so its middle sat at y=616 — inside the sidebar's MIDDLE third, not the
      // bottom third the artwork is meant to occupy. The user's framing is the correct one:
      // the sidebar reads as three stacked regions, and the scenery belongs in the lowest
      // one.
      //
      // So the top edge is pinned to the start of the bottom third and the band extends down
      // to the account row. On a taller window the third starts lower, the band is taller,
      // and the artwork grows in place instead of drifting upward.
      const thirdStart = rect.top + (rect.height * 2) / 3
      const bottom = Math.min(rect.bottom - reserved, viewportBottomOf(rect))
      let top = Math.max(thirdStart, rect.top)
      // A very short column would leave nothing; fall back to a usable minimum.
      if (bottom - top < 150) top = Math.max(rect.top, bottom - 150)
      return {
        left: Math.round(rect.left),
        top: Math.round(top),
        width: Math.round(rect.width),
        height: Math.max(1, Math.round(bottom - top)),
      }
    }

    /**
     * The lowest y the scenery may reach.
     *
     * On a short window the column's bottom edge can sit below the viewport, and artwork
     * placed there is simply not visible, so the visible bottom wins.
     * @param rect - the column's rectangle.
     * @returns the y coordinate to stop at.
     */
    function viewportBottomOf(rect) {
      if (typeof window === 'undefined') return rect.bottom
      return Math.min(rect.bottom, window.innerHeight)
    }

    /**
     * Height of the strip at the column's bottom that scenery must not cover.
     *
     * That strip is the account row — the avatar and nickname the user is signed in as. The
     * artwork used to be drawn straight over it, and because this layer is
     * pointer-transparent the row stayed clickable, so it read as a broken menu rather than
     * a covered one.
     *
     * Measuring "the descendant nearest the bottom edge" does not work: the shell's own
     * full-height wrappers are flush with it, so the shortest distance is always 0. What
     * distinguishes the account row is its SHAPE — a short, full-width bar anchored to the
     * bottom — so that is what is matched.
     * @param column - the sidebar column.
     * @returns the reserved height in px, clamped to a sane range.
     */
    function footerHeight(column) {
      try {
        const rect = column.getBoundingClientRect()
        let reserve = 0
        for (const node of column.querySelectorAll('*')) {
          // Skip this plugin's own overlay, which is not part of the shell's layout.
          if (node.closest('#dsh-theme-ambient, .dsh-amb-control') !== null) continue
          const r = node.getBoundingClientRect()
          if (r.width < rect.width * 0.5) continue
          if (r.height < 28 || r.height > 96) continue
          const distance = rect.bottom - r.bottom
          if (distance > 24) continue
          const needed = r.height + distance
          if (needed > reserve) reserve = needed
        }
        // The reservation is kept as tight as the measurement allows. It only has to clear
        // the account row, and every pixel beyond that shows as a gap between the artwork
        // and the row — which is what "too much height reserved" describes. A small constant
        // padding is added rather than a proportional one, because the row is a fixed-height
        // control that does not grow with the window.
        const measured = reserve === 0 ? 52 : reserve
        return Math.max(56, Math.min(measured + 2, 72))
      } catch {
        return 60
      }
    }

    /**
     * Whether this plugin's ambient stylesheet is actually in the document.
     *
     * The seat must never be created before it. `syncAmbient` runs on every shell
     * mutation, so without this guard it could create the seat during a window when
     * `AMBIENT_CSS` was not yet installed — leaving an UNSTYLED div in normal flow at
     * the bottom of the sidebar. That is exactly the stray block that appeared over
     * the main column and covered conversation text: an unstyled element joins the
     * layout instead of sitting behind it, and every later report still looks
     * healthy because the element does exist.
     *
     * A seat without its stylesheet is worse than no seat.
     * @returns true when the stylesheet element is in the document.
     */
    function ambientStylesheetReady() {
      if (typeof document === 'undefined') return false
      return document.querySelector('style[data-plugin-css="theme-gallery/ambient"]') !== null
    }

    /**
     * Put the ambient stylesheet into the document, and keep it there.
     *
     * Self-healing on purpose. A one-shot install inside an effect assumed the sheet
     * would survive, and in the shipped app it did not: the report kept reading
     * `css=false`, which silently turned the guard above into a permanent no-op — the
     * guard was right, the sheet was simply never there. Because the guard bails out
     * while the sheet is absent, one failed install disabled the scenery for good.
     *
     * The document is searched for the sheet directly rather than trusting a cached
     * reference, because the failure being defended against is precisely "our
     * reference is stale".
     * @returns the stylesheet element, or null when there is no document.
     */
    function ensureAmbientStylesheet() {
      if (typeof document === 'undefined') return null
      const existing = document.querySelector('style[data-plugin-css="theme-gallery/ambient"]')
      // A sheet that is present but STALE is worse than none. The shell keeps its DOM
      // across a plugin reload, so the previous build's sheet survives — and a check that
      // only asks "is a sheet there?" happily reuses rules that no longer match this
      // build. That is exactly what happened: the layer was restructured, the old sheet
      // stayed, and every new rule was missing while the check insisted the sheet existed.
      if (existing !== null) {
        if (existing.textContent === AMBIENT_CSS) return existing
        existing.remove()
      }

      const tag = document.createElement('style')
      tag.dataset.plugin = 'theme-gallery'
      tag.dataset.pluginCss = 'theme-gallery/ambient'
      tag.textContent = AMBIENT_CSS
      // `head` can be absent if this runs before the parser produced one; appending to
      // the document element still applies the rules.
      if (document.head !== null) document.head.append(tag)
      else document.documentElement.append(tag)
      return tag
    }

    /**
     * Remove any ambient node that this run does not own.
     *
     * An earlier revision could leave a stray seat behind — unstyled, in the layout,
     * covering the main column — and because the shell keeps its DOM across a plugin
     * reload, such a node outlives the code that made it. Cleaning up on sight means a
     * fixed build repairs the previous build's damage instead of inheriting it.
     *
     * Seats are matched anywhere in the document now that the layer lives on the body,
     * so ownership is decided by an attribute this run stamps rather than by parentage.
     */
    function removeStrayAmbientSeats() {
      if (typeof document === 'undefined') return
      for (const seat of document.querySelectorAll('#dsh-theme-ambient')) {
        if (seat.dataset.ambientOwner === AMBIENT_OWNER) continue
        seat.remove()
      }
    }

    /**
     * Remove every ambient node, ownership aside.
     *
     * Used when no scenery should exist at all: a theme without `ambient`, or a seat
     * whose placement can no longer be computed. Leaving a layer behind would paint one
     * theme's scenery over the next one's.
     */
    function removeAllAmbientSeats() {
      if (typeof document === 'undefined') return
      for (const seat of document.querySelectorAll('#dsh-theme-ambient')) seat.remove()
    }

    /**
     * Depth counter for theme changes this plugin causes ITSELF.
     *
     * ── THE SELF-DRIVING LOOP THIS EXISTS TO STOP ───────────────────────────
     *
     * `ctx.theme.overrideTokens()` and `ctx.theme.setTheme()` both emit `theme/change`, and the
     * plugin subscribes to that event and calls `publish()`, which calls `syncSkin()`, which
     * calls back into `overrideTokens()`. Nothing in that cycle yields to the event loop, so it
     * is not a slow loop — it is a spin.
     *
     * The old brake was `stackedSkin === id`, and it could not work: `stackSkinTokens` clears
     * `stackedSkin` BEFORE calling `overrideTokens` (to dispose the previous layer), so the
     * handler that `overrideTokens` synchronously triggers sees `stackedSkin === undefined` and
     * stacks another layer — for ever. Measured on the real app: renderer RSS to 11 GB and ~2.7
     * cores of accumulated CPU, with main/host/GPU perfectly normal and no crash log, because
     * nothing throws.
     *
     * A depth counter is used rather than a boolean so nested emits (a disposer called while
     * stacking) are handled correctly: the flag is only clear once every emit has returned.
     * @type {number}
     */
    let selfEmitDepth = 0

    /**
     * Run something that will emit `theme/change` as a consequence of this plugin's own action.
     *
     * The subscription installed later checks {@link selfEmitDepth} and declines to react, so an
     * action cannot be re-entered through the event it caused. That is the only reliable brake:
     * comparing values cannot distinguish "the service changed underneath me" from "I just
     * changed the service", and the whole defect was that distinction.
     * @param action - the action to run under the guard.
     * @returns whatever the action returns.
     */
    function emitting(action) {
      selfEmitDepth += 1
      try {
        return action()
      } finally {
        selfEmitDepth -= 1
      }
    }

    /**
     * A kill switch, read from this bundle's own composition patch.
     *
     * Until now the only lever for stopping a misbehaving skin was removing the plugin from
     * `dsh.profile.bundles` — and on the desktop that list is not hand-maintained. The
     * application re-derives it from `dependencies` whenever a package is installed, enabled or
     * optimised, so a package declaring `dsh.bundle.patch` is written straight back and the
     * plugin returns on its own. There was no emergency brake on the plugin's side.
     *
     * With this, either layer can be switched off in `cordis.patch.yml` without touching the
     * bundle list, which means a broken skin can be defused without fighting the installer:
     *
     *     - id: theme-gallery
     *       name: dsh-theme-gallery
     *       config:
     *         ambient: false      # 停掉氛围装饰层与皮肤恢复
     *
     * Anything other than an explicit `false` leaves both layers on, so an absent config behaves
     * exactly as before.
     * @returns whether the ambient and skin-restore layers may run.
     */
    function ambientEnabled() {
      try {
        const config = ctx?.config
        if (config === undefined || config === null) return true
        return config.ambient !== false
      } catch {
        // A config that cannot be read must not disable the feature.
        return true
      }
    }

    let restoreDisabledReason
    /**
     * A global budget and cooldown for `setTheme`.
     *
     * The per-skin "one bounce" allowance only covered the `wanted === activeId` branch. The
     * other branch — a plain `setTheme(wanted)` taken whenever the service reports a different
     * theme — had no cooldown and no budget, and it runs on every publish. Because the shell's
     * `adopt()` puts the active id back to a built-in value, that branch could be taken
     * indefinitely: setTheme → theme/change → publish → setTheme.
     *
     * These counters bound the damage no matter which path asks: at most 6 calls per session and
     * at least 1 second apart. When the budget is gone the plugin stops asking and says so in the
     * panel, rather than burning the renderer to no effect.
     */
    const THEME_WRITE_BUDGET = 6
    const THEME_WRITE_COOLDOWN_MS = 1000
    let themeWrites = 0
    let lastThemeWriteAt = 0

    /**
     * Ask the theme service for a skin, under the global budget.
     * @param id - the theme id to request.
     * @returns whether the request was actually made.
     */
    function requestTheme(id) {
      if (restoreDisabledReason !== undefined) return false
      if (themeWrites >= THEME_WRITE_BUDGET) {
        restoreDisabledReason = `已停止自动恢复皮肤（本次会话写主题 ${THEME_WRITE_BUDGET} 次上限已到）`
        noteAmbientEvent('主题写入预算耗尽', id)
        return false
      }
      if (Date.now() - lastThemeWriteAt < THEME_WRITE_COOLDOWN_MS) return false
      themeWrites += 1
      lastThemeWriteAt = Date.now()
      // Marked as self-caused so the subscription ignores the `theme/change` this produces.
      emitting(() => ctx.theme.setTheme(id))
      return true
    }

    /**
     * Render the active theme's scenery into the sidebar column.
     *
     * Idempotent: the seat is created once and its contents are replaced whenever
     * the active theme (or its ambient config) changes, so re-running is cheap and
     * cannot stack duplicate scenes. Themes with no `ambient` get an empty seat —
     * the scenery belongs to the skin, so switching skins must remove it.
     * @param kind - the ambient kind, or undefined for none.
     * @param options - the theme's ambient options.
     */
    function syncAmbient(kind, options, record = true) {
      if (typeof document === 'undefined') return
      // The kill switch. `cordis.patch.yml` sets `config: { ambient: false }` to stop the whole
      // scenery layer, which is the only lever that works without editing the bundle list — the
      // desktop re-derives that list from `dependencies`, so removing the package does not stick.
      if (!ambientEnabled()) return

      // ── THE IDEMPOTENCE TEST MUST COME BEFORE *ANY* WRITE ────────────────────
      //
      // This function is driven by a `MutationObserver` over the whole body, so anything it
      // writes schedules another call. The guard therefore has to be the FIRST thing that happens,
      // and the two calls below it write DOM:
      //
      //   • `ensureAmbientStylesheet()` appends (or replaces) the `<style>` node;
      //   • `removeStrayAmbientSeats()` removes nodes.
      //
      // Both used to run BEFORE the fingerprint test, which meant the test could never prevent a
      // write — every pass wrote at least the stylesheet's absence-check, the observer fired
      // again, and the cycle was self-sustaining regardless of the fingerprint. The test also
      // reset the fingerprint on its two bail-out paths, so those windows disabled it entirely.
      //
      // The order is now: measure cheaply (a rect read and a string) → decide → only then write.
      // The fingerprint is intentionally cheap — a few numbers and a markup length — because this
      // runs up to once per frame and anything geometry-derived would call `footerHeight`, which
      // walks every descendant of the sidebar.
      const column = sidebarColumn()
      if (column !== null) {
        const columnRect = column.getBoundingClientRect()
        const markup = sceneMarkup(kind, options)
        const fingerprint = [
          kind ?? '',
          JSON.stringify(options ?? {}),
          markup.length,
          Math.round(columnRect.width),
          Math.round(columnRect.height),
          ambientStylesheetReady() ? 'css' : 'nocss',
        ].join('|')
        if (fingerprint === lastAmbientFingerprint && ambientReport !== undefined) {
          if (record) noteAmbientAttempt({ kind: kind ?? '(无)', column: true, band: '未变化(跳过)' })
          return
        }
        lastAmbientFingerprint = fingerprint
      }

      // Repair, then proceed. A one-shot install was assumed to survive and did not —
      // the report kept reading `css=false`, which quietly turned the guard below into
      // a permanent no-op. Re-adding the sheet here makes the scenery independent of
      // whatever removes the node.
      ensureAmbientStylesheet()
      removeStrayAmbientSeats()
      // A seat created before the stylesheet landed is a stray block in the layout,
      // not scenery. Remove it so the next pass can build a properly positioned one;
      // the un-styled state is the only one that can spill over the main column.
      if (!ambientStylesheetReady()) {
        removeAllAmbientSeats()
        if (record) noteAmbientAttempt({ kind, column: column !== null, note: '样式表未就绪' })
        ambientReport = { found: false, note: '等待氛围样式表就位（已清除无样式节点，避免其落入布局）' }
        return
      }
      if (column === null) {
        removeAllAmbientSeats()
        if (record) noteAmbientAttempt({ kind, column: false })
        ambientReport = { found: false, note: '未找到侧栏列（三个选择器全部落空）' }
        return
      }

      const markup = sceneMarkup(kind, options)

      if (markup === '') {
        removeAllAmbientSeats()
        if (record) noteAmbientAttempt({ kind, column: true, band: '无装饰' })
        ambientReport = { found: true, kind: '(none)', note: '该主题无装饰' }
        return
      }

      // ── ONE RENDER PATH, NOT TWO ─────────────────────────────────────────────
      //
      // This used to draw the scene TWICE into two sibling containers: once into a
      // `#dsh-theme-ambient` seat, and again into the `.dsh-amb-control` layer that was added
      // while the painting defect was being investigated. The control layer is the one that
      // actually renders, so the seat was dead weight — except that its copy of the DOM was
      // real. Two copies of the same scene means two of every animated element, which is what
      // produced the duplicated dragonflies.
      //
      // The surviving container is `.dsh-amb-control`, whose arrangement is the one proven to
      // paint (see the comment on AMBIENT_CSS); the seat is no longer created and any seat left
      // over from an earlier build is swept away above.
      const placement = drawScene(column, markup, kind)
      if (record) noteAmbientAttempt({ kind, column: true, band: placement.band })
      ambientReport = placement.report
    }

    /**
     * Draw the scene into the single ambient layer, and report what landed.
     *
     * The layer itself is a full-viewport fixed element styled by a CLASS — the arrangement copied
     * from the working `dsh-theme-firefly` plugin. Inside it, the scene box is positioned over the
     * sidebar's blank area. Splitting those two concerns is what makes both possible at once: the
     * layer takes the arrangement known to paint, and the artwork keeps the placement asked for.
     * @param column - the sidebar column to anchor the scene to.
     * @param markup - the scene markup.
     * @param kind - the ambient kind, for the report.
     * @returns the band description and the report.
     */
    function drawScene(column, markup, kind) {
      let wrap = document.querySelector('.dsh-amb-control')
      if (wrap === null) {
        wrap = document.createElement('div')
        wrap.className = 'dsh-amb-control'
        document.body.appendChild(wrap)
      }
      let box = wrap.querySelector(':scope > .dsh-amb-control-scene')
      if (box === null) {
        box = document.createElement('div')
        box.className = 'dsh-amb-control-scene'
        wrap.appendChild(box)
      }

      // GEOMETRY every pass; CONTENT only when it changes.
      //
      // Re-assigning `innerHTML` rebuilt every scene node, which restarts all CSS animations from
      // zero — visible as the artwork snapping back to its starting position. Geometry has to be
      // rewritten because it is measured; the markup does not, because it is derived from the
      // theme alone.
      applySceneBox(box, column)
      const painted = box.dataset.ambientMarkup
      if (painted !== markup) {
        box.dataset.ambientMarkup = markup
        box.innerHTML = String(markup)
      }

      const rect = box.getBoundingClientRect()
      return {
        band: `y${Math.round(rect.top)}..${Math.round(rect.bottom)}`,
        report: describeAmbient(wrap, kind, `场景=${Math.round(rect.width)}x${Math.round(rect.height)}`),
      }
    }

    /**
     * Position the scene box over the sidebar's blank area.
     *
     * Split out from the painting so a resync can refresh the geometry without disturbing the
     * scene's DOM — and therefore without restarting its animations.
     * @param box - the scene box.
     * @param column - the sidebar column to anchor to.
     */
    function applySceneBox(box, column) {
      // The scenery occupies the sidebar's BLANK AREA, not its whole height.
      //
      // Full height put the water band at the column's bottom, which is where the account
      // row lives — the artwork ended up covering the signed-in user's avatar and name
      // (clicks still reached it, because the layer is pointer-transparent, so the menu
      // looked broken rather than covered). The bottom third is the region the request
      // named for the main artwork, and it stops short of the account row.
      const band = bandBox(column)
      const rect = column.getBoundingClientRect()
      const top = band === null ? Math.round(rect.top) : band.top
      const height = band === null ? Math.round(rect.height) : band.height
      box.setAttribute('style', [
        'position:absolute',
        `left:${Math.round(rect.left)}px`,
        `top:${top}px`,
        `width:${Math.round(rect.width)}px`,
        `height:${height}px`,
        // No background of its own: anything opaque here would sit on top of the sidebar
        // and hide the shell's own menu. The box exists to give the artwork a frame, not to
        // be seen.
        'overflow:hidden',
      ].join(';'))
    }


    /**
     * Name the topmost element at a point, and why it is on top.
     *
     * `elementFromPoint` alone said *who* wins; it did not say *why*, and this layer
     * kept losing to the shell's own containers even at the maximum z-index. That means
     * an ancestor stacking context decides the order, not the element's own `z-index`.
     * Walking the winner's ancestors and reporting the nearest one that establishes a
     * stacking context names the thing that actually has to be outranked.
     * @param x - viewport x.
     * @param y - viewport y.
     * @returns a short description.
     */
    function describeTopmost(x, y) {
      const hit = document.elementFromPoint(x, y)
      if (hit === null) return '空'
      const tag = hit.tagName === undefined ? '?' : hit.tagName.toLowerCase()
      const classes = typeof hit.className === 'string' && hit.className !== ''
        ? `.${hit.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : ''
      let node = hit
      let context = '无'
      let depth = 0
      while (node !== null && depth < 12) {
        const style = getComputedStyle(node)
        const positioned = style.position !== 'static'
        const opacity = Number(style.opacity)
        const owns = (positioned && style.zIndex !== 'auto')
          || (Number.isFinite(opacity) && opacity < 1)
          || style.isolation === 'isolate'
          || style.transform !== 'none'
        if (owns) {
          const owner = node === hit ? '自身' : node.tagName.toLowerCase()
          context = `${owner} z=${style.zIndex} pos=${style.position}`
          break
        }
        node = node.parentElement
        depth += 1
      }
      return `${tag}${classes}[${context}]`
    }

    /**
     * Sample the points where the artwork should be visible.
     *
     * Every measurement kept agreeing that the scenery exists with the right size,
     * while nothing was visible. `getBoundingClientRect` reports GEOMETRY, and geometry
     * cannot tell "painted" from "painted and then covered". Hit testing can.
     * @param seat - the seat node.
     * @returns one short token per sample.
     */
    function hitTestAmbient(seat) {
      try {
        if (typeof document.elementFromPoint !== 'function') return 'elementFromPoint 不可用'
        const rect = seat.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return '座位尺寸为 0'
        const samples = [
          ['远山', rect.left + rect.width * 0.5, rect.bottom - rect.height * 0.30],
          ['近山', rect.left + rect.width * 0.5, rect.bottom - rect.height * 0.12],
          ['水面', rect.left + rect.width * 0.5, rect.bottom - rect.height * 0.05],
          // The layer's own top-left corner, where the probe sits. If the probe is not
          // visible, this point says who took its place.
          ['探针', rect.left + 20, rect.top + 20],
        ]
        return samples.map(([label, x, y]) => `${label}:${describeTopmost(x, y)}`).join(' ')
      } catch (error) {
        return `命中测试失败: ${String(error && error.message ? error.message : error)}`
      }
    }

    /**
     * Describe the scenery layer as the document actually has it.
     *
     * A layer that is missing, empty, zero-sized or transparent all look identical
     * from outside the app, and each has a different cause. Reading the live element
     * is the only way to tell them apart.
     * @param seat - the seat node.
     * @param kind - the scene that was requested.
     * @returns the report.
     */
    function describeAmbient(seat, kind, placement) {
      try {
        const style = getComputedStyle(seat)
        const rect = seat.getBoundingClientRect()
        const column = seat.parentElement
        const columnRect = column === null ? null : column.getBoundingClientRect()
        const columnStyle = column === null ? null : getComputedStyle(column)
        // Measure the artwork itself, not just its container: a healthy-looking
        // 280x780 seat can still hold a scene that collapsed to zero height, and
        // the two need different fixes.
        const scene = seat.firstElementChild
        const sceneRect = scene === null ? null : scene.getBoundingClientRect()
        const art = seat.querySelector('.sta-mountains, .dof-seaweed')
        const artRect = art === null ? null : art.getBoundingClientRect()
        return {
          found: true,
          kind,
          children: seat.childElementCount,
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          display: style.display,
          position: style.position,
          zIndex: style.zIndex,
          overflow: style.overflow,
          // Where the seat landed, relative to the column it was inserted into.
          // A large negative or oversized offset means it was placed outside the
          // visible box rather than covered.
          offsetInColumn: columnRect === null
            ? '?'
            : `${Math.round(rect.left - columnRect.left)},${Math.round(rect.top - columnRect.top)}`,
          columnPosition: columnStyle === null ? '?' : columnStyle.position,
          columnOverflow: columnStyle === null ? '?' : columnStyle.overflow,
          sceneSize: sceneRect === null ? '?' : `${Math.round(sceneRect.width)}x${Math.round(sceneRect.height)}`,
          artSize: artRect === null ? '?' : `${Math.round(artRect.width)}x${Math.round(artRect.height)}`,
          // The column clips its own overflow, so artwork painted outside the
          // column's box is invisible while every other reading looks healthy.
          artInsideColumn: artRect !== null && columnRect !== null
            && artRect.bottom > columnRect.top
            && artRect.top < columnRect.bottom,
          css: document.querySelector('style[data-plugin-css="theme-gallery/ambient"]') !== null,
          // The stylesheet is the other half of the mechanism: without it the seat
          // is a plain static div and every child collapses to nothing.
          inColumn: column !== null && column.className.includes('sidebarCol'),
          siblings: column === null ? -1 : column.childElementCount,
          // Who is on top where the artwork should be: the one reading that can
          // tell "never painted" apart from "painted and then covered".
          hitTest: hitTestAmbient(seat),
          // Whoever wins the hit test, measured. The previous round named `div.tg-page` —
          // this plugin's OWN panel — at every sample point, which would mean the scenery
          // IS painted and is then covered by the panel being looked at. Reporting the
          // winner's rectangle and the two column rectangles turns "covered" from a guess
          // into a comparison.
          columns: (() => {
            const out = []
            for (const selector of ['.ZTP-Xa_sidebarCol', '.ZTP-Xa_centerCol']) {
              const node = document.querySelector(selector)
              if (node === null) { out.push(`${selector.replace('.ZTP-Xa_', '')}=无`); continue }
              const r = node.getBoundingClientRect()
              out.push(`${selector.replace('.ZTP-Xa_', '')}=${Math.round(r.left)},${Math.round(r.top)}`
                + ` ${Math.round(r.width)}x${Math.round(r.height)}`)
            }
            // The winner at one point over the SIDEBAR, measured. The centre column starts
            // at x=280, so a panel inside it cannot legitimately cover x=0..280 — if this
            // reports a rectangle that does reach the sidebar, that is a finding in itself.
            const seatRect = seat.getBoundingClientRect()
            const sampleX = seatRect.left + 140
            const sampleY = seatRect.top + 140
            const top = document.elementFromPoint(sampleX, sampleY)
            if (top === null) {
              out.push(`采样(${Math.round(sampleX)},${Math.round(sampleY)})=空`)
            } else {
              const r = top.getBoundingClientRect()
              const s = getComputedStyle(top)
              const cls = typeof top.className === 'string' && top.className !== ''
                ? `.${String(top.className).split(' ')[0]}`
                : ''
              out.push(`采样(${Math.round(sampleX)},${Math.round(sampleY)})`
                + `=${top.tagName.toLowerCase()}${cls}`
                + `@${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
                + ` pos=${s.position} z=${s.zIndex} pe=${s.pointerEvents}`)
            }
            return out.join(' ')
          })(),
          placement,
          // A preview of what the layer actually CONTAINS. If the scene markup never
          // arrived, every geometry reading still looks healthy — the container has the
          // right size either way — so the content has to be reported, not assumed.
          html: (() => {
            const raw = seat.innerHTML
            return raw.length === 0 ? '(空)' : `${raw.length}字符`
          })(),
          // The first three descendants with their OWN computed geometry and paint state.
          // The seat can be perfectly sized and full of markup while every child is
          // zero-sized, hidden or clipped — and the parent's numbers look identical in all
          // three cases. The probe proves a simple element renders here; this reports the
          // complex one, which is where the difference must lie.
          kids: (() => {
            const out = []
            let node = seat.firstElementChild
            while (node !== null && out.length < 3) {
              const r = node.getBoundingClientRect()
              const s = getComputedStyle(node)
              const cls = String(node.className).split(' ')[0]
              out.push(`<${node.tagName.toLowerCase()}${cls === '' ? '' : `.${cls}`}`
                + ` ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)}`
                + ` pos=${s.position} disp=${s.display} vis=${s.visibility} op=${s.opacity}>`)
              node = node.firstElementChild
            }
            return out.length === 0 ? '(无子元素)' : out.join(' ')
          })(),
          // The seat's OWN box, inline-styled from `placeAmbient`. Its colour is the
          // one signal that separates "the layer paints" from "the layer's children
          // paint": the probe proved an overlay can be drawn, this proves THIS one is.
          seatBackground: style.backgroundColor,
          // WHERE the layer hangs. The whole defect came down to this: an identical
          // minimal element on `documentElement` rendered while the layer on `body`
          // painted nothing. Reporting the parent turns that into a reading instead of
          // something to be inferred from the code.
          parent: seat.parentElement === null
            ? '(无父节点)'
            : `${seat.parentElement.tagName.toLowerCase()}`
              + `${seat.parentElement.id === '' ? '' : `#${seat.parentElement.id}`}`,
          paintError: ambientPaintError,
        }
      } catch (error) {
        return {
          found: true,
          kind,
          note: `读取失败: ${String(error && error.message ? error.message : error)}`,
        }
      }
    }

    /**
     * Resolve a bundled theme by id.
     *
     * Only this package's own themes are addressable: they are the ones whose
     * `accent` and `ambient` fields this plugin can trust. A theme contributed by
     * another plugin is simply skipped, which degrades to "no scenery, base accent"
     * rather than to an error.
     * @param id - the theme id.
     * @returns the bundled theme, or undefined.
     */
    function bundledTheme(id) {
      return BUNDLED_THEMES.find((theme) => theme.id === id)
    }

    /**
     * Disposer of the active accent layer, when one is stacked.
     *
     * Declared BEFORE `syncAccent`, which reads it. The body runs top to bottom during
     * mount, so a `let` read above its own declaration throws a ReferenceError — and the
     * caller wraps this in a `try`, so the error was swallowed and the accent marker
     * silently never appeared. Same shape as the `paintAttempts` fault; see
     * `tests/check-tdz-order.mjs`, which now covers declarations that precede the function
     * reading them, not just declarations inside it.
     */
    let accentLayerDispose

    /**
     * The plugin context, published for the factory-level helpers.
     *
     * `syncAccent` and `themeDiagnostics` are defined at factory scope but were written when they
     * lived inside the mount body, where `ctx` was a parameter. Extracting that body left them
     * without it, so their `ctx` reads threw — and because their callers wrap them in `try`, the
     * failure was invisible and the features simply never worked.
     *
     * Assigned once, by `applyGallery`, before anything can call those helpers.
     * @type {object|undefined}
     */
    let ctx

    /**
     * Stack the active theme's accent colour over the selection states.
     *
     * The source system's design rules are explicit that an active marker takes the
     * theme's own characteristic colour rather than a colour invented for it, and
     * that the marker must be unmistakable: a coloured left bar **plus** coloured
     * text **plus** a 600 weight **plus** a translucent fill. In this shell those
     * states read from the `button-ghost-active-*` family, which is what the
     * sidebar entry and the selected conversation row both use.
     *
     * Two constraints matter more than the colours themselves:
     *
     *  - **Only the ACTIVE theme may contribute.** `overrideTokens` layers compose
     *    over whatever theme is active, so reading a fixed accent would paint
     *    山青婷彩's pink onto 梦海游鱼 and onto the built-in light/dark themes too.
     *    The layer is withdrawn whenever the active theme is not one this package
     *    contributed, so every other theme keeps its own selection colour.
     *  - **The theme's brand colour is left alone.** Repointing `brand-primary` at a
     *    warm accent would also repoint links, primary buttons and status chips —
     *    far more than the marker this is about.
     *
     * Alpha is composed here because the token is a colour: the source stores the
     * active fill as `rgba(...,0.15)`-style values, and an 8-digit hex is how the
     * same intent is expressed in a token.
     * @param accent - the active theme's accent colour, or undefined for none.
     */
    function syncAccent(accent) {
      // A factory-level helper that needs the plugin context.
      //
      // These helpers used to live INSIDE the mount body, where `ctx` was a parameter in scope.
      // Extracting the body into `mountGallery(ctx)` left them at factory level, where `ctx` does
      // not exist at all — so every call threw `ReferenceError: ctx is not defined`, the caller's
      // `try` swallowed it, and the accent marker silently never appeared. The module-level `ctx`
      // below is assigned at mount and read here.
      if (ctx === undefined) return
      if (accentLayerDispose !== undefined) {
        accentLayerDispose()
        accentLayerDispose = undefined
      }
      if (typeof accent !== 'string' || accent === '') return
      accentLayerDispose = ctx.theme.overrideTokens('theme-gallery: accent', {
        '--dsw-alias-button-ghost-active-fill': { light: `${accent}29`, dark: `${accent}29` },
        '--dsw-alias-button-ghost-active-border': { light: accent, dark: accent },
        '--dsw-alias-button-ghost-active-hover': { light: `${accent}47`, dark: `${accent}47` },
      })
    }

    /**
     * Report whether the accent token layer actually reached the theme snapshot.
     *
     * ── WHY THIS READING IS NEEDED ───────────────────────────────────────────
     *
     * `syncAccent` stacks three tokens (`button-ghost-active-fill` / `-border` / `-hover`) with
     * `ctx.theme.overrideTokens`. Whether that layer works had **never been verified**, and one
     * earlier attempt to verify it used the wrong evidence: the active workspace FOLDER icon
     * turns the accent colour, which was taken as proof — but that icon is painted by the skin's
     * own `--dsw-alias-state-business-primary` token and has nothing to do with the layer.
     *
     * The service makes this checkable without any guesswork: `composeActive` folds every
     * override layer into `snapshot.active.tokens` before publishing, so the composed value is
     * readable straight off `getTheme()`. If the layer is registered, the token IS there; if it
     * is not, the token is absent or still the built-in value.
     * @returns the reading, as one segment of the panel line.
     */
    function describeAccentLayer() {
      try {
        const theme = ctx?.theme
        if (theme === undefined) return '激活层[无 theme 服务]'
        const snapshot = theme.getTheme()
        const active = snapshot?.active
        const tokens = active?.tokens ?? {}
        const TOKEN = '--dsw-alias-button-ghost-active-border'
        const value = tokens[TOKEN]
        const layers = snapshot?.overrides === undefined
          ? '(服务未暴露)'
          : String(snapshot.overrides.size ?? snapshot.overrides.length ?? '?')
        // Its OWN key count too: layers folding into `active.tokens` is the mechanism, so a
        // token count that does not move when the layer is stacked also disproves it.
        return `激活层[id=${active?.id ?? '?'}`
          + ` 层数=${layers}`
          + ` token数=${Object.keys(tokens).length}`
          + ` ${TOKEN.replace('--dsw-alias-', '')}=${value === undefined ? '(缺失)' : String(value)}]`
      } catch (error) {
        return `激活层[读取失败: ${String(error && error.message ? error.message : error)}]`
      }
    }

    /**
     * Render the main-column gallery page.
     *
     * `usePanelInfo` comes from the layout's GlobalStandardProps, so the page can
     * render nothing when another panel is selected without the shell having to
     * mount and unmount it.
     * @param props - composed slot props.
     * @returns the page element tree.
     */
    function ThemeGalleryPage({ t, setTheme, useStore, usePanelInfo }) {
      const info = usePanelInfo((s) => s.activePanelId)
      const ids = useStore((s) => s.ids)
      const labels = useStore((s) => s.labels)
      const descriptions = useStore((s) => s.descriptions)
      const swatches = useStore((s) => s.swatches)
      const selected = useStore((s) => s.selected)
      const status = useStore((s) => s.status)
      // The layout keeps this page registered whatever the selection is, so it
      // renders nothing while another panel owns the main column.
      if (info !== PANEL_ID) return null
      // An empty picker must explain itself: the boot screen says only "failed",
      // and a silent empty page is indistinguishable from a broken one.
      if (ids.length === 0) {
        return jsxs('div', {
          className: 'tg-page',
          children: [
            jsx('div', { className: 'tg-title', children: t('title') }),
            jsx('div', { className: 'tg-hint', children: status || t('empty') }),
          ],
        })
      }
      // Detail lines are opt-in; a line that reports a problem is not detail.
      const scenery = sceneryLine(selected)
      const showScenery = scenery !== null && (debugEnabled() || sceneryLineIsWarning(scenery))
      return jsxs('div', {
        className: 'tg-page',
        children: [
          jsxs('div', {
            className: 'tg-head',
            children: [
              jsx('span', { className: 'tg-title', children: t('title') }),
              jsx('span', { className: 'tg-hint', children: t('hint') }),
              jsx('span', { className: 'tg-hint', children: t('count', { count: ids.length }) }),
              // What this copy is, so a reader can compare it with the version npm
              // publishes without digging through the profile.
              jsx('span', { className: 'tg-hint', children: `v${BUNDLED_VERSION}` }),
            ],
          }),
          debugEnabled() ? jsx('div', { className: 'tg-debug', children: themeDiagnostics(selected) }) : null,
          // Routine reports wait for the debug switch; warnings and errors print
          // regardless — when the active skin's decorations are missing, the reason
          // has to reach the person looking at the panel.
          showScenery
            ? jsx('div', {
              className: `tg-debug${ambientWarning(selected) === null ? '' : ' tg-warn'}`,
              children: scenery,
            })
            : null,
          jsx('div', {
            className: 'tg-grid',
            children: ids.map((id) => jsx(ThemeCard, {
              id,
              label: labels[id],
              description: descriptions[id],
              swatches: swatches[id] || [],
              selected: id === selected,
              applied: t('applied'),
              onSelect: setTheme,
              t,
            }, id)),
          }),
        ],
      })
    }

    /**
     * Render the sidebar panel entry.
     *
     * The sidebar owns the button and resolves the row label from the list
     * metadata; this renders only the glyph. Drawn inline rather than imported
     * from ui-primitives, whose payload is not part of the client's seeded module
     * table — the same reason the official bundle carries its own icons.
     * @param props - owner share (size, active).
     * @returns an inline SVG glyph.
     */
    function PanelGlyph({ size, active }) {
      const edge = typeof size === 'number' ? size : 16
      return jsxs('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 16 16',
        fill: 'none',
        'aria-hidden': 'true',
        children: [
          jsx('circle', {
            cx: 8, cy: 8, r: 6,
            stroke: 'currentColor',
            'stroke-width': active ? 1.8 : 1.4,
          }),
          jsx('path', {
            d: 'M8 2a6 6 0 0 0 0 12z',
            fill: 'currentColor',
            opacity: active ? 0.9 : 0.55,
          }),
        ],
      })
    }

    /** Display name used in client diagnostics. */
    exports.name = 'theme-gallery'

    /**
     * The HARD dependency list — deliberately ONE entry.
     *
     * Cordis' array form makes every entry REQUIRED: if an entry never becomes available the
     * fiber parks in `pending` forever, the loader's `await` never returns, and the desktop app
     * stops at "Loading plugins..." with nothing written to the crash log. This plugin has paid
     * for that lesson three times:
     *
     *   - `settingsScope` — provided by the CLIENT half of ui-theme, so a HOST-side request for
     *     it could never be satisfied: `pending (waiting for service: settingsScope)`.
     *   - `theme` together with a reverse `modifies: [ui-theme]` in the bundle patch — the
     *     loader was told to start this row both before AND after ui-theme, so both fibers
     *     waited on each other: `dsh-theme-gallery: failed`.
     *   - the same `theme` entry with no `dsh.client.inject` in the manifest, so nothing
     *     guaranteed the module providing the service was loaded first — a hang with NO log line.
     *
     * ── WHY `theme` IS BACK, AND WHY THAT IS NOW SAFE ────────────────────────
     *
     * An attempt was made to avoid the hazard entirely by taking `theme` as a soft dependency
     * through `ctx.inject([], cb)`. That does not work, and the side effect was visible on the
     * page: the toolbar showed "主题服务不可用" and no panel appeared, because a context given an
     * EMPTY inject list cannot read the service at all. The probe in
     * `scripts/probe-soft-inject.mjs` records the two semantics that were considered.
     *
     * The deciding evidence is on this machine: the two third-party client plugins that work
     * both declare `theme` as a HARD dependency — `dsh-theme-firefly` uses exactly
     * `inject: ['theme']` — and both also declare the providing module in `dsh.client.inject`.
     * That is the pair that makes it safe, and this package now has both:
     *
     *   package.json  dsh.client.inject = ["@deepseek-ai/dsh-client-locale",
     *                                      "@deepseek-ai/dsh-client-ui-theme"]
     *   here          exports.inject   = ['slots', 'locale', 'theme']
     *
     * The two earlier failures were the `modifies` cycle and the missing module declaration.
     * Both are fixed, and both are asserted in `tests/check-boot-safety.mjs`.
     *
     * `locale` is declared for the same reason: the sidebar row resolves its label through it,
     * and the providing module is declared in the manifest.
     * @type {string[]}
     */
    exports.inject = ['slots', 'locale', 'theme']

    /**
     * Marks this client module as a PLUGIN rather than a plain service module.
     *
     * This flag was missing, and the web-boot log recorded the entry as
     *
     *     dsh-theme-gallery: failed
     *
     * which is distinct from `pending (waiting for service: settingsScope)` — the other half
     * of the same boot hang. `pending` means the loader knew about this entry and was waiting
     * on a dependency it was promised; `failed` is what an entry reports when it is evaluated
     * but never activates, which is the shape a missing plugin flag produces. Every working
     * third-party client plugin on this machine declares it (`dsh-theme-firefly`:
     * `exports.isPlugin = true`). `@deepseek-ai/dsh-client-ui-theme` does not, but it belongs
     * to the official composition and is mounted through a different path, so it is not the
     * pattern to copy here.
     * @type {boolean}
     */
    exports.isPlugin = true

    /**
     * Client plugin body: register the sidebar page and track the reading state.
     *
     * WRAPPED SO A FAILURE HERE CANNOT HANG THE APPLICATION.
     *
     * The desktop shell waits for EVERY plugin's fiber to settle before it leaves the
     * "Loading plugins..." screen. A plugin that throws while mounting does not settle, so a
     * bug in a decoration plug-in becomes a boot hang — with the added cruelty that nothing
     * reaches the crash log, because no exception escapes. That is exactly how a theme skin
     * once stranded a real install.
     *
     * The body is therefore built in stages, and each stage is isolated: whatever fails is
     * reported and skipped, and the remaining stages still run. This plugin is an ENHANCEMENT
     * — a skin — so degrading it must never cost the user their application.
     *
     * @param ctx - the plugin context.
     */
    exports.apply = function apply(ctx) {
      // Nothing below is allowed to escape. A synchronous throw in `apply` is the one
      // failure mode that takes the whole boot down with it.
      try {
        applyGallery(ctx)
      } catch (error) {
        console.error('[theme-gallery] mount failed; the app continues without this plugin:', error)
        reportMountFailure(error)
      }
    }

    /**
     * Record a mount failure where the user can see it.
     *
     * A console nobody opens is not a diagnosis, and this failure mode is invisible by
     * nature — the app simply never finishes loading. The message is written onto the document
     * so it survives the partial mount.
     * @param error - whatever was thrown.
     */
    function reportMountFailure(error) {
      try {
        if (typeof document === 'undefined') return
        const note = document.createElement('div')
        note.dataset.plugin = 'theme-gallery'
        note.dataset.pluginError = 'mount'
        note.setAttribute('style', 'position:fixed;left:0;bottom:0;z-index:2147483647;'
          + 'max-width:60ch;padding:6px 10px;font:12px/1.5 system-ui,sans-serif;'
          + 'background:#7f1d1d;color:#fff;pointer-events:none;white-space:pre-wrap')
        note.textContent = '主题皮肤插件挂载失败，已跳过（不影响使用）：'
          + String(error && error.message ? error.message : error)
        document.body?.append?.(note)
      } catch {
        // Reporting must never be the thing that breaks the boot.
      }
    }

    /**
     * Run a callback on the next frame, or as soon as possible when there is no frame clock.
     *
     * Used to coalesce DOM work: the scenery sync is triggered by a body-wide mutation observer
     * and by resize events, and streaming a reply mutates the transcript many times per frame.
     * Running the sync once per frame keeps its cost proportional to frames rather than to
     * mutations, which is the difference between "some work when the layout changes" and a
     * process that climbs to 11 GB.
     * @param callback - what to run.
     */
    function step(callback) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => callback())
        return
      }
      // A documentless or animation-less environment (a test harness): a timeout still
      // coalesces, it just does not align to a paint.
      setTimeout(callback, 16)
    }

    /**
     * The plugin body proper, run inside `apply`'s guard.
     *
     * The services this needs — `slots`, `locale`, `theme` — are DECLARED in `exports.inject`,
     * which is the same shape the two working third-party client plugins on this machine use
     * (`dsh-theme-firefly` declares `theme` and nothing else). By the time `apply` runs, the
     * framework has resolved all three, so they are used directly.
     *
     * An attempt was made to take `theme` softly instead, to remove every possible boot hazard.
     * It does not work: a context carrying an EMPTY inject list cannot read the service, so the
     * plugin reported "主题服务不可用" and never mounted. The safety that matters is not achieved
     * by weakening this list — it is achieved by the two fixes that actually address the hangs,
     * both asserted in `tests/check-boot-safety.mjs`: no `modifies` against the providing row,
     * and the providing module declared in `dsh.client.inject`.
     * @param ctx - the plugin context, with every declared service resolved.
     */
    function applyGallery(pluginCtx) {
      // Published for the factory-level helpers (`syncAccent`, `themeDiagnostics`). The parameter
      // is deliberately NOT named `ctx`: that would shadow the module-level binding this line
      // needs to assign, and the assignment would silently do nothing.
      ctx = pluginCtx
      mountGallery(pluginCtx)
    }

    /**
     * Show, on the page, that a service this plugin needs never arrived.
     *
     * Kept even though nothing calls it now: a plugin that cannot load should be able to say so
     * where a person will see it, rather than disappearing silently. Silence is exactly how the
     * earlier boot failures stayed invisible for several rounds.
     * @param name - the service name.
     * @param message - what to display.
     */
    function reportMissingService(name, message) {
      console.error(`[theme-gallery] service "${name}" unavailable; skipping the skin`)
      try {
        if (typeof document === 'undefined' || document.body == null) return
        const note = document.createElement('div')
        note.dataset.plugin = 'theme-gallery'
        note.dataset.pluginMissing = name
        note.setAttribute('style', 'position:fixed;left:0;bottom:0;z-index:2147483647;'
          + 'max-width:60ch;padding:6px 10px;font:12px/1.5 system-ui,sans-serif;'
          + 'background:#78350f;color:#fff;pointer-events:none;white-space:pre-wrap')
        note.textContent = message
        document.body.append(note)
      } catch {
        // Reporting must never be what breaks the boot.
      }
    }

    /**
     * The gallery itself.
     *
     * Every service it needs — `slots`, `locale`, `theme` — was declared in `exports.inject`, so
     * the framework resolved them before `apply` ran and they are used directly here.
     * @param ctx - the plugin context.
     */
    function mountGallery(ctx) {
      // Dictionaries first: the page's `locale` seat needs them installed.
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'theme-gallery: dictionaries')

      // The page stylesheet, owned for this plugin's lifetime.
      ctx.effect(() => {
        if (typeof document === 'undefined') return
        const tag = document.createElement('style')
        tag.dataset.plugin = 'theme-gallery'
        tag.dataset.pluginCss = 'theme-gallery/page'
        tag.textContent = PAGE_CSS
        document.head.append(tag)
        return () => { tag.remove() }
      }, 'theme-gallery: page stylesheet')

      /* ---------------- gallery page ---------------- */

      const storeHandle = createGalleryStore()
      /**
       * The one live store instance, shared by the publisher and the page.
       *
       * `handle.create()` returns a NEW instance on every call — verified by
       * `tests/check-store-contract.mjs` — so the render machinery's instance and
       * the one this code writes through would otherwise be different objects and
       * every publish would land in a throwaway. That is exactly why the shipped
       * panel plugins pin theirs: `{ ...handle, create: () => instance }`.
       */
      const storeInstance = storeHandle.create()
      const store = { ...storeHandle, create: () => storeInstance }
      /**
       * The shared instance's write surface.
       *
       * Publishing goes through THIS, not through the registration's `inject`
       * factory. `inject` supplies the component's business face, and the page
       * does not need one — it reads the store seat directly — so a page could
       * render perfectly while `inject` never ran, leaving every publish written
       * into `undefined` and the banner silent. Writing to the pinned instance
       * removes that whole class of silent failure.
       */
      const storeActions = storeInstance.actions

      let revision = -1
      /** Whether the `main` slot gate has fired — i.e. the page really registered. */
      let gateRan = false
      /** Whether the registration's inject factory has run (diagnostics only). */
      let injectRan = false

      /**
       * Reflect the ACTIVE theme's scenery and accent.
       *
       * Called from `publish()`, so it tracks whatever the theme service reports as
       * active — including themes selected through the official Appearance row, not
       * just through this plugin's picker.
       *
       * Both effects are driven by the same lookup, and both must be **withdrawn**
       * when the active theme is not one this package contributed: the scenery
       * belongs to the skin rather than to the app, and an accent layer would
       * otherwise colour some other theme's selection states. Active themes that
       * this package does not know resolve to `undefined`, which is what withdraws
       * both.
       * @param snapshot - the official theme snapshot.
       */
      function syncSkin(snapshot) {
        const activeId = snapshot?.active?.id
        const theme = typeof activeId === 'string' ? bundledTheme(activeId) : undefined

        // ── THE PALETTE LAYER IS DRIVEN BY WHAT THE USER CHOSE, NOT BY WHAT IS ACTIVE ──
        //
        // Everything below follows `snapshot.active` — the theme the SERVICE currently reports.
        // That is right for the artwork and the accent marker, which belong to whichever skin is
        // active. It is NOT right for the palette: the shell reverts the active theme to a
        // built-in id whenever it adopts the persisted preference (`ui-theme`'s `adopt()`), so
        // following `active` would tear the skin's colours down moments after they appear —
        // exactly the "colours show, then vanish" that was reported.
        //
        // The layer therefore follows the REMEMBERED skin instead. It is withdrawn only when the
        // user has genuinely moved to a theme this package does not provide.
        try {
          stackSkinTokens(theme === undefined ? undefined : (rememberedSkin() ?? activeId))
        } catch (error) {
          console.error('[theme-gallery] could not stack the skin palette:', error)
        }

        try {
          syncAmbient(theme?.ambient?.kind, theme?.ambient)
        } catch (error) {
          console.error('[theme-gallery] could not render sidebar scenery:', error)
        }
        try {
          syncAccent(theme?.accent)
        } catch (error) {
          console.error('[theme-gallery] could not stack the accent layer:', error)
        }
      }

      /**
       * Remember the user's skin, and put it back after a restart.
       *
       * The composition layer does carry `ui-theme.config.preference`, but it is read while
       * the boot graph is still assembling — before this plugin has registered its themes —
       * so a preference naming one of our skins does not survive that moment. Every restart
       * therefore came up on the built-in white theme and the skin had to be picked by hand.
       *
       * The choice is kept where this plugin can reach it early instead: written whenever a
       * bundled skin becomes active, and re-applied once the registry holds that id again.
       *
       * ── THIS IS ALSO THE FALLBACK, AND IT IS WHY THE FALLBACK CANNOT FAIL ──────
       *
       * The skin id is deliberately NOT persisted through the preference at all. The official
       * service only stores built-in values —
       *
       *     if (isThemePreference(id)) this.host.set(THEME_PREFERENCE_FIELD, id)
       *     const THEME_PREFERENCES = ['light', 'dark', 'system']
       *
       * — so `preference` in the profile can only ever hold a built-in id. If this plugin is
       * disabled, uninstalled or simply fails to mount, the next boot reads a built-in
       * preference and starts normally on the built-in theme. The skin selection survives in
       * `localStorage`, which is private to this plugin and simply stops being consulted.
       *
       * That is the automatic fallback the user asked for, and it is stronger than anything
       * this plugin could do at runtime: a plugin that is not loaded cannot run a recovery
       * handler, so the safety has to live in the CONFIGURATION CONTRACT rather than in code.
       * The one way to break it is to hand-write a skin id into `preference` — which the
       * official service would then reject at boot. Never do that.
       */
      const SKIN_KEY = 'theme-gallery:last-skin'

      /**
       * The token used to prove a skin's palette reached the document.
       *
       * `ui-layout`'s presenter writes every token with `body.style.setProperty`, so this can be
       * read straight back as an inline declaration. `--dsw-alias-bg-base` is chosen because every
       * bundled skin gives it a `linear-gradient(...)` literal while the built-in themes give it a
       * `var(...)` reference — two forms that cannot be mistaken for one another.
       */
      const PROBE_TOKEN = '--dsw-alias-bg-base'

      /**
       * A built-in theme to bounce through when the presenter missed a change.
       *
       * `setTheme` short-circuits when the id is already active, so re-applying the same skin
       * emits nothing. Switching to a built-in value and back produces the two real changes that
       * force a repaint — the same thing the user was doing by hand.
       */
      const BUILT_IN_PROBE_THEME = 'light'

      /** @returns the remembered skin id, or null. */
      function rememberedSkin() {
        try {
          const value = window.localStorage.getItem(SKIN_KEY)
          return typeof value === 'string' && value !== '' && bundledTheme(value) !== undefined
            ? value
            : null
        } catch {
          return null
        }
      }

      /** The skin whose palette layer is currently stacked, and how to remove it. */
      let stackedSkin
      let stackedSkinDispose




      /** Set once a rate limit or the kill switch has stopped the restore. */

      /**
       * Stack a skin's palette as an OVERRIDE LAYER, which the shell cannot undo.
       *
       * ── WHY SETTING THE THEME IS NOT ENOUGH ─────────────────────────────────
       *
       * `setTheme(id)` writes `this.preference` in memory, and that is all. The official service
       * ALSO adopts a persisted preference whenever the settings document changes:
       *
       *     adopt() {
       *       const section = this.host.getSnapshot().value
       *       if (this.preference === section.preference && …) return
       *       this.preference = section.preference     // ← overwrites what we just set
       *       this.publish()
       *     }
       *
       * The persisted value can only ever be a BUILT-IN id (`light`/`dark`/`system`) — the service
       * stores no others — so that adoption always reverts the skin. On screen the colours appear
       * and then vanish a moment later, and clicking the skin once is not enough because the same
       * adoption can land straight after; only switching away and back produces changes late
       * enough to survive.
       *
       * An override layer does not have that problem. `overrideTokens` keeps layers in their own
       * map, keyed by source, and `buildSnapshot` composes them OVER whatever theme is active —
       * `adopt()` never touches them. The layer is owned by this plugin's fiber, so it also
       * disappears cleanly when the plugin unloads.
       *
       * Re-stacking is guarded by `stackedSkin`: `overrideTokens` emits `theme/change` itself, so
       * registering unconditionally would drive `publish` from inside `publish`.
       * @param id - the skin id, or undefined to withdraw the layer.
       */
      function stackSkinTokens(id) {
        if (!ambientEnabled()) return
        if (id === stackedSkin) return
        try {
          // The whole body runs under the self-emit guard.
          //
          // Both `stackedSkinDispose()` and `overrideTokens()` emit `theme/change`, and the
          // subscription that consumes that event would otherwise re-enter `syncSkin` →
          // `stackSkinTokens` at a moment when `stackedSkin` is deliberately undefined (it is
          // cleared below to release the previous layer). That re-entry used to stack another
          // layer, which emitted again — the spin that took the renderer to 11 GB.
          emitting(() => {
            if (stackedSkinDispose !== undefined) {
              stackedSkinDispose()
              stackedSkinDispose = undefined
            }
            stackedSkin = undefined
            if (typeof id !== 'string') return
            const definition = bundledTheme(id)
            if (definition === undefined) return
            const tokens = {}
            for (const [name, value] of Object.entries(flatten(definition).tokens)) {
              // The override format is a `{ light, dark }` pair. These palettes are a single
              // scheme by design, so both arms carry the same value rather than leaving one
              // undefined — an absent arm would render as a bare `undefined` inside the variable.
              tokens[name] = { light: value, dark: value }
            }
            stackedSkinDispose = ctx.theme.overrideTokens('theme-gallery: palette', tokens)
            // Handed to the plugin's fiber as well, so the layer is withdrawn even on the paths
            // that do not go through `stackSkinTokens` again (plugin unload).
            ctx.effect(() => stackedSkinDispose, 'theme-gallery: palette layer')
            stackedSkin = id
            noteAmbientEvent('叠加皮肤令牌层', id)
          })
        } catch (error) {
          noteAmbientEvent('令牌层抛错', String(error && error.message ? error.message : error))
          console.error('[theme-gallery] could not stack the skin palette layer:', error)
        }
      }

      /**
       * Whether the shell has finished assembling, so a theme change will actually be painted.
       *
       * Set by the scenery effect once it has found a laid-out sidebar column — the same
       * readiness signal the artwork uses, and the earliest point at which the document is known
       * to have a real layout.
       *
       * Declared BEFORE `syncRememberedSkin` because `publish()` can run while this body is still
       * executing, and reading a `let` in its temporal dead zone would throw — producing a
       * misleading "could not restore" error on the very first publish.
       */
      let bootSettled = false

      /**
       * Called by the scenery effect when the shell is ready.
       *
       * Re-reads the snapshot so the remembered skin gets a chance to be applied now that a
       * theme change is more likely to be observed.
       */
      function markBootSettled() {
        if (bootSettled) return
        bootSettled = true
        noteAmbientEvent('外壳就绪')
        try {
          syncRememberedSkin(ctx.theme.getTheme())
        } catch (error) {
          noteAmbientEvent('就绪复核抛错', String(error && error.message ? error.message : error))
          console.error('[theme-gallery] could not re-check the remembered skin:', error)
        }
      }

      /**
       * Whether the document is actually showing the given skin's palette.
       *
       * ── WHY THIS DETECTOR IS NECESSARY ───────────────────────────────────────
       *
       * `ui-layout`'s presenter does this on mount:
       *
       *     const presenter = new ThemePresenter()
       *     presenter.apply(ctx.theme.getTheme())      // applies whatever is active NOW
       *     const off = ctx.on('theme/change', ...)    // and only then starts listening
       *
       * So it paints the theme that is active at mount time, and any `setTheme` call made before
       * that subscription is observed by nobody. The service still records the skin as active —
       * which is why the scenery switches but the colours do not — and because `setTheme`
       * short-circuits on `preference === id`, clicking the same skin afterwards emits NOTHING.
       * Only switching to another skin and back produces the two genuine changes that repaint.
       *
       * The presenter writes each token with `body.style.setProperty(name, value)`, so the tokens
       * are readable back as INLINE styles. That makes the effect verifiable instead of assumed:
       * an inline declaration carrying the skin's own value means the presenter has run for this
       * skin, and a missing one means the change was missed and must be retried.
       *
       * `--dsw-alias-bg-base` is the probe token because the skin gives it a gradient literal
       * while the built-in light theme gives it `var(--dsw-static-neutral-bluish-00)` — the two
       * forms cannot be confused.
       * @param id - the skin id to look for.
       * @returns whether the skin's palette is on the document.
       */
      function skinIsPainted(id) {
        try {
          if (typeof document === 'undefined' || document.body == null) return false
          const definition = bundledTheme(id)
          if (definition === undefined) return false
          const expected = flatten(definition).tokens[PROBE_TOKEN]
          if (typeof expected !== 'string' || expected === '') return false
          const actual = document.body.style.getPropertyValue(PROBE_TOKEN)
          return actual.trim() === expected.trim()
        } catch {
          return false
        }
      }

      /**
       * How many times a bounce has been spent on a given skin.
       *
       * Declared BEFORE `ensureSkinPainted`, which reads it. This body runs top to bottom during
       * mount, so a `const` read above its own declaration throws a ReferenceError — and because
       * every caller here sits inside a `try`, that error is swallowed and the feature silently
       * does nothing. That is exactly what happened: the declaration sat below its reader, the
       * first `markBootSettled()` threw, `bootSettled` never became true, and the skin colours
       * were never applied.
       *
       * A bounce means switching to a built-in theme and straight back, which forces the
       * presenter to repaint — but it is two real repaints, so it is rationed to ONE per skin and
       * only used once the document has demonstrably failed to follow the service.
       */
      const paintAttempts = new Map()
      /**
       * Apply the remembered skin, and confirm it landed.
       *
       * Called on every publish while the app sits on a built-in theme, and also when the service
       * already reports a skin — the second case is the one that used to be unreachable, because
       * the id looked correct while the document had never been repainted.
       *
       * The retry is BOUNDED and cooled down. `publish()` fires often, and each attempt that has
       * to bounce through another theme causes two real repaints, so an unbounded retry would
       * flicker the whole interface while the presenter is still unavailable. A handful of spaced
       * attempts is enough to cover the mount window; after that the plugin stays quiet rather
       * than fighting the shell.
       * @param wanted - the skin id to put in effect.
       * @param activeId - what the service currently reports as active.
       */
      function ensureSkinPainted(wanted, activeId) {
        if (!ambientEnabled()) return
        if (restoreDisabledReason !== undefined) return
        if (!bootSettled) {
          // The gate that silently refused to act. It is the likeliest explanation for "the
          // colours never appear until something else happens", and it used to leave no trace.
          noteAmbientEvent('等待外壳', wanted)
          return
        }
        if (skinIsPainted(wanted)) {
          paintAttempts.clear()
          noteAmbientEvent('已上色', wanted)
          return
        }

        // ── THE BOUNCE IS THE LAST RESORT, NOT THE FIRST MOVE ──────────────────
        //
        // The presenter writes tokens asynchronously: for a frame or two after a real theme
        // change the document still shows the old palette. Treating that window as "missed" made
        // this code bounce `built-in → skin` repeatedly, and every bounce is two genuine repaints
        // — which is what showed on screen as the interface flashing between coloured and plain.
        //
        // So a bounce happens only after the skin has failed to appear across a PAUSE, and only
        // once per skin. Telling the service first is always safe: when the id is already active
        // it is a documented no-op.
        if (wanted !== activeId) {
          // Budgeted and cooled down. This branch used to call `setTheme` unconditionally on every
          // publish, with no throttle at all, so the shell putting the active id back to a
          // built-in value made it a perpetual request ↔ publish ping-pong.
          if (requestTheme(wanted)) noteAmbientEvent('置为皮肤', wanted)
          // Give the presenter a chance to land before judging it.
          return
        }

        // The service ALREADY reports this skin, yet the document does not show it: the change
        // was missed by a presenter that had not subscribed yet. Only now is a bounce justified.
        const bounced = paintAttempts.get(wanted) ?? 0
        if (bounced >= 1) {
          noteAmbientEvent('跳转已用尽', wanted)
          return
        }
        paintAttempts.set(wanted, bounced + 1)
        noteAmbientEvent('未上色·跳转一次', wanted)
        try {
          // Two writes, both under the global budget, and both marked as self-caused so the
          // subscription ignores the `theme/change` they produce.
          emitting(() => ctx.theme.setTheme(BUILT_IN_PROBE_THEME))
          emitting(() => ctx.theme.setTheme(wanted))
        } catch (error) {
          noteAmbientEvent('跳转抛错', String(error && error.message ? error.message : error))
          console.error('[theme-gallery] could not re-apply the remembered skin:', error)
        }
      }


      /**
       * Record the active skin, or restore the remembered one.
       *
       * ── TIMING IS THE WHOLE POINT HERE ───────────────────────────────────────
       *
       * The restore must not be a one-shot hope. `ctx.theme.setTheme(id)` updates the registry
       * and emits `theme/change`; the tokens reach the document only if the layout package's
       * presenter is already subscribed. When this plugin restored during mount, the call landed
       * before that subscription existed: the service recorded the skin as active while nothing
       * repainted — and because the service now believes the skin IS active, clicking it again
       * emits nothing at all. That is why the user had to switch to a different skin and back.
       *
       * Two things make the restore dependable:
       *
       *  1. it waits for the shell (`bootSettled`), so a change is far more likely to be seen;
       *  2. it CONFIRMS the effect by reading the tokens back off the document
       *     (`skinIsPainted`), and re-applies while the confirmation is missing — so a change
       *     that was missed is retried on the next publish instead of being lost for the session.
       *
       * When the service already reports the skin as active but the document disagrees, the plain
       * `setTheme` call is a documented no-op, so the retry bounces through a built-in theme and
       * back. That is exactly the manual toggle the user had to perform.
       * @param snapshot - the official theme snapshot.
       */
      function syncRememberedSkin(snapshot) {
        try {
          const activeId = snapshot?.active?.id
          // A contributed skin is active: remember it for the next boot, and make sure the document
          // is genuinely painted with it. The id alone is not proof — a change that arrived before
          // the presenter subscribed leaves the service reporting the skin while the page still
          // shows the built-in palette.
          if (typeof activeId === 'string' && bundledTheme(activeId) !== undefined) {
            if (window.localStorage.getItem(SKIN_KEY) !== activeId) {
              window.localStorage.setItem(SKIN_KEY, activeId)
            }
            ensureSkinPainted(activeId, activeId)
            return
          }

          // The app is on a built-in theme even though a skin is remembered: the boot race lost
          // the preference. Re-checked on every publish rather than once per session, because a
          // single attempt can be swallowed by a presenter that is not listening yet.
          const wanted = rememberedSkin()
          if (wanted === null) return
          ensureSkinPainted(wanted, activeId)
        } catch (error) {
          console.error('[theme-gallery] could not restore the remembered skin:', error)
        }
      }


      /* ---------------- scenery stylesheet ----------------
       *
       * Installed before anything can create the seat, and installed defensively:
       * the sheet must be in the document before `#dsh-theme-ambient` exists, because
       * an UNSTYLED seat is not merely invisible — being a plain block, it joins the
       * sidebar's layout and spills over the main column, covering conversation text.
       * That happened for real, and it is why `syncAmbient` refuses to create a seat
       * while this sheet is absent.
       *
       * `head` can be missing if this runs before the parser has produced one, so the
       * fallback appends to the document element rather than dropping the sheet.
       *
       * Installation happens here for the earliest possible mount, but the sheet is
       * also re-checked and re-added by `ensureAmbientStylesheet()` on every sync —
       * this effect is the first attempt, not the only one.
       */
      ctx.effect(() => {
        if (typeof document === 'undefined') return
        const tag = ensureAmbientStylesheet()
        return () => {
          // Unloading is the one legitimate reason for the sheet to disappear, so the
          // cleanup removes it and the seat together.
          if (tag !== null) tag.remove()
          const column = sidebarColumn()
          if (column !== null) {
            const seat = column.querySelector(':scope > #dsh-theme-ambient')
            if (seat !== null) seat.remove()
          }
        }
      }, 'theme-gallery: sidebar scenery stylesheet')

      /* ---------------- contribute themes, unconditionally ----------------
       *
       * Deliberately NOT inside the `main` gate. Contribution needs nothing but
       * the theme service — guaranteed present because `theme` is in `inject` —
       * and putting it behind the gate made the symptom ambiguous: when the panel
       * page came up empty there was no way to tell "the gate never ran" from "the
       * page never rendered".
       *
       * The call itself is placed AFTER `contribute` is defined, not here:
       * `ctx.effect` runs its callback synchronously, so an earlier call would hit
       * the temporal dead zone on the `contributed` set that `contribute` closes
       * over. That failure surfaced on the page as "Cannot access 'contributed'
       * before initialization".
       */

      /**
       * Push the current registry into the page's store.
       *
       * Writes straight to the pinned instance, so it does not care whether the
       * registration's `inject` factory has run.
       *
       * Also records a status line when there is nothing to show, because an
       * empty picker is otherwise indistinguishable from a broken one and the
       * boot screen only ever says "failed". The line names which link is
       * missing: the slot gate, the contribution call, or the registry itself.
       * @param snapshot - the official theme snapshot.
       */
      function publish(snapshot) {
        revision += 1
        const themes = [...snapshot.themes].filter((theme) => !OMITTED_IDS.has(theme.id))
        storeActions.sync(themes, snapshot.preference, revision)
        syncSkin(snapshot)
        syncRememberedSkin(snapshot)
        // Expose what the theme SERVICE believes, so the page can compare it with
        // what is actually in effect on the document. The presenter consumes this
        // same snapshot (`snapshot.active.tokens`) and writes it to `body`, so a
        // mismatch between the two points at the presenter, and agreement points
        // at the colours themselves having no visible effect.
        const active = snapshot.active ?? {}
        window.__DSH_THEME_DEBUG__ = {
          activeId: active.id ?? '?',
          activeTokens: active.tokens === undefined ? '?' : Object.keys(active.tokens).length,
          themeIds: snapshot.themes.map((theme) => theme.id).join(','),
        }
        if (themes.length === 0) {
          storeActions.note(
            !gateRan
              ? 'main 插槽的 gate 尚未触发（页面外壳还没声明该插槽）'
              : !injectRan
                ? '页面已注册但尚未渲染；主题注册表为空'
                : '主题注册表为空：贡献调用已执行但没有皮肤进入注册表',
          )
        }
      }

      /**
       * Resolve a bundled theme into the shape `register` actually consumes.
       *
       * `register()` stores the definition BY REFERENCE and `composeActive()`
       * passes it through untouched when no override layer exists — so the
       * `{ light, dark }` pair format belongs to `overrideTokens` layers, NOT
       * here. `ThemeDefinition.tokens` is `Record<string, string>`, one value for
       * the theme's own `colorScheme`. Feeding pairs to `register` writes
       * literally `[object Object]` into the CSS variables, which paints nothing
       * and reads on the page as a theme with no colours at all.
       * @param definition - the bundled theme.
       * @returns the registrable definition.
       */
      function flatten(definition) {
        const tokens = {}
        for (const [name, value] of Object.entries(definition.tokens ?? {})) {
          tokens[name] = typeof value === 'string' ? value : value[definition.colorScheme]
        }
        return { ...definition, tokens }
      }

      /**
       * Put this package's themes into the registry, once each.
       *
       * `ctx.theme.register` THROWS on a duplicate id, and this runs again on
       * every `theme/change` — including the change its own first registration
       * causes. A local set of ids this plugin has already offered is what makes
       * it idempotent without depending on the snapshot being fresh one
       * microtask later, which is not guaranteed.
       *
       * Disposers land on the plugin fiber through `ctx.effect`, so unloading
       * withdraws this package's themes.
       * @param snapshot - the official theme snapshot.
       */
      const contributed = new Set()
      function contribute(snapshot) {
        const known = new Set(snapshot.themes.map((theme) => theme.id))
        for (const definition of BUNDLED_THEMES) {
          if (contributed.has(definition.id)) continue
          contributed.add(definition.id)
          // Another provider already registers this id: leave it to them.
          if (known.has(definition.id)) continue
          ctx.effect(
            () => ctx.theme.register(flatten(definition)),
            `theme-gallery: theme ${definition.id}`,
          )
        }
      }

      // Placed after both declarations above, because `ctx.effect` calls its
      // callback synchronously.
      ctx.effect(() => {
        try {
          contribute(ctx.theme.getTheme())
        } catch (error) {
          console.error('[theme-gallery] could not contribute themes:', error)
          try { storeActions.note(`主题注册失败：${String(error && error.message ? error.message : error)}`) } catch { /* store unavailable */ }
        }
      }, 'theme-gallery: theme contribution')

      /* ---------------- scenery follows the sidebar ----------------
       *
       * `publish()` can run before the shell has mounted the sidebar, and the seat
       * has to live inside that column. So the snapshot is remembered and the
       * scenery is re-synced when the column appears — and again if the shell ever
       * re-creates it, which is why this observes rather than checks once.
       */
      let lastSnapshot
      let ambientObserver
      let ambientResizeObserver
      let ambientResizeHandler
      let visibilityHandler

      /**
       * A cheap fingerprint of the sidebar's geometry.
       *
       * Used to decide when the layout has stopped moving. Two consecutive equal samples mean
       * the shell has finished laying the sidebar out and a measurement can be trusted.
       * @returns a string, or null when the column does not exist.
       */
      function columnSignature() {
        const column = sidebarColumn()
        if (column === null) return null
        const r = column.getBoundingClientRect()
        const style = getComputedStyle(column)
        const band = bandBox(column)
        return [
          Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height),
          style.display, style.visibility,
          band === null ? 'no-band' : `${band.top}:${band.height}`,
        ].join('|')
      }

      ctx.effect(() => {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
        lastSnapshot = ctx.theme.getTheme()

        /**
         * The single action every trigger funnels into: put the scenery where the sidebar is
         * right now. Everything is recomputed, so a call that lands on unchanged geometry is
         * cheap and harmless — which is what makes it safe to call from many triggers.
         */
        /**
         * Coalesce every trigger into at most one sync per frame, and never let a sync's own
         * DOM writes queue the next one.
         *
         * Two separate hazards are handled here, and both of them were live:
         *
         *  1. FEEDBACK. The observer watches the whole body with `subtree: true`, and the sync
         *     appends/removes nodes on the same body. A write therefore scheduled a sync, whose
         *     write scheduled another. The idempotence guard inside `syncAmbient` stops the
         *     cascade from doing work, but the round trip still costs a full-body mutation
         *     delivery each time, so it is closed properly here as well: mutations queued while
         *     a sync is running are discarded.
         *
         *  2. STAMPEDE. Streaming a reply mutates the transcript many times per frame. Calling
         *     the sync per mutation multiplied the sidebar measurements by that factor, which is
         *     what turned "a bit of work on layout change" into continuous CPU burn. Batching to
         *     one call per frame makes the cost proportional to frames instead of mutations.
         */
        let syncInFlight = false
        let syncQueued = false

        const runSync = () => {
          if (syncInFlight) {
            // Our own write. Do not re-enter: the geometry cannot have changed as a result.
            return
          }
          syncInFlight = true
          try {
            resync()
          } finally {
            syncInFlight = false
          }
        }

        const requestSync = () => {
          if (syncQueued) return
          syncQueued = true
          step(() => {
            syncQueued = false
            runSync()
          })
        }

        const resync = () => {
          // The snapshot is re-read rather than reused. If the theme changed while the shell
          // was still assembling, a cached `lastSnapshot` would describe the wrong skin.
          try {
            lastSnapshot = ctx.theme.getTheme()
          } catch {
            // Keep the previous snapshot if the registry is not ready yet.
          }
          const active = lastSnapshot?.active?.id
          const kind = typeof active === 'string' ? bundledTheme(active)?.ambient?.kind : undefined
          if (sidebarColumn() === null) {
            // Recorded even though there is nothing to draw. An attempt that finds no sidebar
            // is the likeliest explanation for boot-time silence, and the old report could not
            // show it because it only ever described the final, successful run.
            noteAmbientAttempt({ kind: kind ?? '(无)', column: false })
            return
          }
          syncSkin(lastSnapshot)
        }

        ambientObserver = new MutationObserver(requestSync)
        if (document.body !== null) ambientObserver.observe(document.body, { childList: true, subtree: true })

        // The geometry is measured, so it must be recomputed whenever it changes — including
        // when the shell REPLACES the sidebar node, which unregisters the observer with it.
        // Rebinding is therefore part of every sync rather than something done once at setup.
        let observed = null
        const bindResize = () => {
          if (typeof ResizeObserver === 'undefined') return
          const column = sidebarColumn()
          if (column === null || column === observed) return
          if (ambientResizeObserver !== undefined) ambientResizeObserver.disconnect()
          ambientResizeObserver = new ResizeObserver(requestSync)
          ambientResizeObserver.observe(column)
          observed = column
        }

        ambientResizeHandler = () => {
          bindResize()
          requestSync()
        }
        window.addEventListener('resize', ambientResizeHandler)

        // A backgrounded window does not lay out; on return the geometry may be stale.
        visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            bindResize()
            requestSync()
          }
        }
        document.addEventListener('visibilitychange', visibilityHandler)

        /**
         * Keep asking for the remembered skin until the document actually shows it.
         *
         * ── WHY THIS IS A SEPARATE LOOP ──────────────────────────────────────────
         *
         * The skin check used to live only in two places, and both of them stop early:
         * `publish()` (which the shell may not call during startup) and the settling loop above
         * (which finishes as soon as the geometry holds still — about 100 ms in). Meanwhile the
         * LAYOUT presenter that actually paints tokens mounts later, so the boot-time request was
         * simply not observed, and nothing was watching any more by the time it could have been.
         *
         * On screen: the artwork appears (it is drawn directly and does not need the presenter)
         * while the colours do not, and opening any panel — which triggers the shell's first
         * `publish()` — finally applies them. That is exactly what was reported.
         *
         * So the check gets its own bounded window, driven by a plain interval, and stops the
         * moment the palette is confirmed OR the window closes. Confirmation is what keeps it
         * cheap: once the tokens are on the document this does nothing at all.
         */
        const paintWatch = (() => {
          const INTERVAL_MS = 500
          const MAX_MS = 20000
          const startedAt = Date.now()
          let handle

          const tick = () => {
            handle = undefined
            let done = false
            try {
              const snapshot = ctx.theme.getTheme()
              const active = snapshot?.active?.id
              const wanted = rememberedSkin()
              if (wanted === null) {
                done = true
              } else if (skinIsPainted(wanted)) {
                paintAttempts.clear()
                done = true
              } else {
                if (active !== wanted) noteAmbientEvent('启动核对', `${active ?? '?'}→${wanted}`)
                ensureSkinPainted(wanted, active)
              }
            } catch (error) {
              noteAmbientEvent('启动核对抛错', String(error && error.message ? error.message : error))
            }
            const expired = Date.now() - startedAt > MAX_MS
            if (!done && !expired) handle = window.setTimeout(tick, INTERVAL_MS)
            else if (!done) noteAmbientEvent('启动核对超时')
          }

          handle = window.setTimeout(tick, 0)
          return {
            stop() {
              if (handle !== undefined) window.clearTimeout(handle)
              handle = undefined
            },
          }
        })()

        /**
         * Settle the scenery against a MOVING layout.
         *
         * The waiting itself lives in `repeatUntilStable`, which is driven by the observed
         * geometry rather than by elapsed time — see its documentation for why the earlier
         * fixed retry timing could not work. `stableTicks` and `maxMs` are hard bounds: the loop
         * always terminates, so it can never become the frame-by-frame loop that burned a core
         * and grew the process to 11 GB.
         */
        const settling = repeatUntilStable({
          sample: columnSignature,
          apply: () => {
            // The column having a layout is the readiness signal for the whole plugin: it means
            // the shell has mounted, so a `theme/change` now reaches ui-theme's presenter and is
            // actually painted. Restoring the remembered skin before this point was silently
            // swallowed — the scenery appeared (it is derived from the service) while the colours
            // never reached the document.
            if (sidebarColumn() !== null) markBootSettled()
            bindResize()
            runSync()
          },
          setTimer: (fn, delay) => window.setTimeout(fn, delay),
          clearTimer: (handle) => window.clearTimeout(handle),
          now: () => Date.now(),
          intervalMs: 100,
          maxMs: 15000,
          stableTicks: 2,
        })

        // One immediate pass, so a sidebar that is already mounted shows the scenery on the
        // first paint rather than after the first interval.
        runSync()

        return () => {
          settling.stop()
          paintWatch.stop()
          if (ambientObserver !== undefined) ambientObserver.disconnect()
          ambientObserver = undefined
          if (ambientResizeObserver !== undefined) ambientResizeObserver.disconnect()
          ambientResizeObserver = undefined
          if (ambientResizeHandler !== undefined) window.removeEventListener('resize', ambientResizeHandler)
          ambientResizeHandler = undefined
          if (visibilityHandler !== undefined) document.removeEventListener('visibilitychange', visibilityHandler)
          visibilityHandler = undefined
        }
      }, 'theme-gallery: scenery follows the sidebar')

      /* ---------------- slot registrations ----------------
       *
       * Both registrations go through `ctx.slots.inject(key, callback)`, which is
       * what the shipped panel plugins do and what the contract requires: the
       * callback runs only AFTER the target slot is declared, and its returned
       * disposers are installed transactionally. Registering into an undeclared
       * slot creates a pending wait whose entry then vanishes when the shell
       * recomposes — the sidebar entry did exactly that before this change.
       */

      // Main-column page, addressed by the same key as the sidebar entry.
      //
      // The callback returns a single disposer, which is the plainest shape the
      // contract documents ("callback effects are synchronous disposers"). An
      // earlier revision returned a generator to yield several disposers; both
      // shipped panel plugins use the plain form, so this does too — the extra
      // machinery was unverified, and a subscription that never installs is
      // indistinguishable from a panel that never registers.
      ctx.slots.inject('main', () => {
        const disposePage = ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          store,
          locale: NS,
          inject: () => {
            // The only thing this face exists for is switching a theme; all state
            // is published straight into the pinned store instance, so nothing
            // silences the page if this factory never runs. `injectRan` records
            // that it did, purely so the empty state can say which link is missing
            // — so it is set BEFORE the publish that reads it.
            injectRan = true
            publish(ctx.theme.getTheme())
            return { setTheme: (id) => { ctx.theme.setTheme(id) } }
          },
        }, ThemeGalleryPage)

        // The page is now live, so record that the gate ran — an empty picker has
        // to be able to say whether the panel registered or the registry is bare.
        gateRan = true
        publish(ctx.theme.getTheme())

        // ── THE ECHO GUARD ───────────────────────────────────────────────────────
        //
        // This plugin WRITES to the theme service (`setTheme`, `overrideTokens`) and also
        // SUBSCRIBES to the event those writes emit. Without a guard the two feed each other:
        //
        //     publish → syncSkin → overrideTokens → theme/change → publish → …
        //
        // Nothing yields to the event loop along that path, so it is not a slow loop but a spin —
        // which is exactly what was measured: renderer RSS to 11 GB, ~2.7 cores of accumulated
        // CPU, main/host/GPU untouched, and no crash log because nothing throws.
        //
        // Comparing values cannot break it. `stackSkinTokens` clears `stackedSkin` before asking
        // for the new layer, so a re-entrant call always sees a different value; and `setTheme`
        // legitimately has to be called when the active id differs, which the shell's own
        // `adopt()` guarantees will keep happening. What CAN be distinguished is *who caused the
        // event*, and `emitting()` records exactly that.
        const disposeChange = ctx.on('theme/change', (snapshot) => {
          if (selfEmitDepth > 0) {
            // Our own write coming back. Applying our own change would re-enter the write.
            return
          }
          contribute(snapshot)
          publish(snapshot)
        })

        return () => {
          disposeChange()
          disposePage()
        }
      })

      // Sidebar entrance: the list id IS the main-panel key. `locale` is declared
      // the way the shipped panel entries declare it, so the row label resolves
      // through the dictionary rather than a raw string.
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 30,
        locale: NS,
        label: () => zh.title,
      }, PanelGlyph))

      /* ---------------- reading state ---------------- */

      /** The stylesheet element carrying the one reading rule, once installed. */
      let readingTag
      /** Disposer of the active reading token layer, when one is stacked. */
      let readingLayerDispose

      /**
       * Install the reading rule, once per plugin lifetime.
       *
       * It constrains the reading measure only. Earlier revisions painted the
       * centre column here — first with a lightened card, then (while reading) with
       * `background: transparent`. The transparent form was the reason a selected
       * theme looked like a plain white app: the column stopped showing the theme's
       * own `--dsw-alias-bg-base`, and what showed through was the app's default
       * ground. A skin must never be painted over by its own plugin.
       *
       * Lightening is a TOKEN concern, so it goes through `overrideTokens` — the
       * service's own mechanism for stacking a layer over the active theme — and
       * not through this stylesheet.
       */
      function installReadingStyle() {
        if (typeof document === 'undefined' || readingTag !== undefined) return
        readingTag = document.createElement('style')
        readingTag.dataset.plugin = 'theme-gallery'
        readingTag.dataset.pluginCss = 'theme-gallery/reading'
        const sel = `[data-windows-titlebar] body[${READING_ATTRIBUTE}] .centerCol,body[${READING_ATTRIBUTE}] .centerCol`
        readingTag.textContent = `${sel}>*{max-width:var(--dsh-reading-width,640px);margin-inline:auto;width:100%;}`
        document.head.append(readingTag)
      }

      /**
       * Find the centre column: the official stylesheet's own Windows anchor.
       * @returns the centre column element, or null before the shell mounts.
       */
      function centreColumn() {
        if (typeof document === 'undefined') return null
        return document.querySelector('[data-windows-titlebar] .centerCol')
          || document.querySelector('.centerCol')
      }

      /**
       * Find the composer: the contenteditable inside the centre column.
       * @param centre - the centre column element.
       * @returns the composer element, or null.
       */
      function composerOf(centre) {
        if (centre === null) return null
        return centre.querySelector('[contenteditable="true"]') || centre.querySelector('textarea')
      }

      /**
       * Decide whether the transcript holds messages.
       *
       * The composer's parent is its own seat; the transcript is a sibling that
       * holds element children. If the layout changes and this stops matching, the
       * plugin degrades to the idle look rather than breaking anything.
       * @param centre - the centre column element.
       * @returns true when a transcript sibling has content.
       */
      function transcriptHasContent(centre) {
        const composer = composerOf(centre)
        if (composer === null) return false
        const seat = composer.parentElement
        if (seat === null) return false
        const parent = seat.parentElement
        if (parent === null) return false
        for (const sibling of parent.children) {
          if (sibling === seat) continue
          if (sibling.childElementCount > 0) return true
        }
        return false
      }

      /**
       * Apply the reading state for the current document.
       *
       * Lightening the transcript is a token concern, so it is expressed as an
       * `overrideTokens` layer (applied by `syncReadingLayer`) rather than a
       * stylesheet rule: a rule that paints over the centre column also paints
       * over the theme, which is how a selected skin came to look like a plain
       * white app.
       */
      function applyReading() {
        if (typeof document === 'undefined') return
        const centre = centreColumn()
        const body = document.body
        if (body === null) return

        if (centre !== null) {
          centre.style.setProperty('--dsh-reading-width', `${READING.maxWidth}px`)
        }

        if (transcriptHasContent(centre)) body.setAttribute(READING_ATTRIBUTE, 'card')
        else body.removeAttribute(READING_ATTRIBUTE)
        syncReadingLayer()
      }

      /**
       * Stack or retract the reading token layer.
       *
       * `overrideTokens(source, tokens)` folds a `{ light, dark }`-shaped layer
       * over the ACTIVE theme, so the lightening follows whichever skin and
       * palette is in play and disappears cleanly when the transcript empties.
       * The source string is the layer's identity: re-calling it with the same
       * source replaces the layer, which is what makes this idempotent.
       */
      function syncReadingLayer() {
        if (typeof document === 'undefined') return
        const reading = document.body !== null && document.body.hasAttribute(READING_ATTRIBUTE)
        if (!reading) {
          if (readingLayerDispose !== undefined) {
            readingLayerDispose()
            readingLayerDispose = undefined
          }
          return
        }
        // Lightened ground for both palettes: a light theme wants a softer wash,
        // a dark one a slightly raised surface. Both keep the theme's hue.
        const lightened = lighten(READING.bg, READING.alpha)
        const darkLightened = lighten(READING.bg, Math.max(0, READING.alpha - 0.2))
        readingLayerDispose = ctx.theme.overrideTokens('theme-gallery: reading', {
          '--dsw-alias-bg-base': { light: lightened, dark: darkLightened },
        })
      }

      // Debounced onto a microtask: streaming a reply mutates the transcript many
      // times per frame, and only the settled answer matters here.
      let pending
      const schedule = () => {
        if (pending !== undefined) return
        pending = Promise.resolve().then(() => {
          pending = undefined
          applyReading()
        })
      }

      ctx.effect(() => {
        installReadingStyle()
        // The shell may not be mounted yet when apply runs.
        const observer = new MutationObserver(schedule)
        if (document.body !== null) observer.observe(document.body, { childList: true, subtree: true })
        else document.addEventListener('DOMContentLoaded', () => {
          if (document.body !== null) observer.observe(document.body, { childList: true, subtree: true })
          schedule()
        }, { once: true })
        schedule()
        return () => {
          observer.disconnect()
          if (readingTag !== undefined) readingTag.remove()
          readingTag = undefined
          if (readingLayerDispose !== undefined) {
            readingLayerDispose()
            readingLayerDispose = undefined
          }
          document.body.removeAttribute(READING_ATTRIBUTE)
          const centre = centreColumn()
          if (centre !== null) centre.style.removeProperty('--dsh-reading-width')
        }
      }, 'theme-gallery: reading state')
    }

    return module.exports
  },
})
