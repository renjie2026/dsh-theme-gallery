/**
 * 契约校验源（编译期，不参与运行）：把主题选择器注册到**左侧栏面板**，
 * 而不是「设置 → 通用设置」。
 *
 * 这条路径不只位置更好，它是**绕开 settingsScope 死结**的正解：
 * 主题列表来自 `ctx.theme.getTheme().themes`，选中走 `ctx.theme.setTheme(id)`
 * ——两者都由官方 ui-theme 提供，而它自己负责把选中持久化进它拥有的
 * `ui-theme` settings 命名空间。所以本插件**完全不需要 settings 域**。
 * 上一版把 `settingsScope` 写成硬依赖，在桌面版编排里永远 pending，
 * 直接导致整个 web boot 失败。
 *
 * 涉及的两个官方插槽（来自 ui-layout / ui-sidebar 的 SlotMap 声明）：
 *   'sidebar.panellist'  list   侧栏那排面板图标（id 必须是 MainPanelId）
 *   'main'               keyed  主区页面，按同一个 key 寻址
 */
import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { Context } from '@deepseek-ai/cordis'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { JSX } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

// 值导入：拉入插槽注册表的 Context 增补（ctx.slots）。
import '@deepseek-ai/dsh-client-ui-slots'
// 类型导入：ctx.theme 服务与 ThemeDefinition 的声明合并。
import type { ThemeDefinition, ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
// 类型导入：拉入 ctx.slots 服务本身与渲染器的声明合并。
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// 类型导入：'main' 插槽与 MainPanelId 品牌类型。
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// 类型导入：'sidebar.panellist' 插槽的 SlotMap 增补。
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// 类型导入：ctx.locale 服务。
import type {} from '@deepseek-ai/dsh-client-locale/client'

/** 本插件拥有文案的命名空间。 */
export const NS = 'theme-gallery'

/** 主区页面 key 与侧栏图标 id 共用的标识。 */
export const PANEL_ID = 'theme-gallery' as MainPanelId

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 主题画廊的文案。 */
    'theme-gallery': 'title' | 'hint' | 'count' | 'current' | 'applied'
  }
}

/** 注册表在页面里的镜像。 */
export interface GalleryState {
  /** 可选主题 id，按注册顺序。 */
  ids: string[]
  /** 主题 id → 显示名。 */
  labels: Record<string, string>
  /** 主题 id → 一句话描述。 */
  descriptions: Record<string, string>
  /** 主题 id → 取自该主题自身 token 的色条。 */
  swatches: Record<string, string[]>
  /** 当前持久化偏好（可能是 'system'）。 */
  selected: string
  /** 列表为空时显示的一行说明；有皮肤时为空串。 */
  status: string
  /** 状态 revision；-1 起步，保证 0 能落地。 */
  revision: number
}

/**
 * 声明页面的状态与写入面。
 *
 * 与官方 settings-store.ts 同构：**不能**给 defineStore 显式传类型参数，
 * 泛型靠 init 与 draft 参数单次推断得出。
 * @returns store 句柄，作为页面注册的 store 座位。
 */
export function createGalleryStore() {
  return defineStore({
    init: (): GalleryState => ({ ids: [], labels: {}, descriptions: {}, swatches: {}, selected: 'system', status: '', revision: -1 }),
    actions: {
      /**
       * 记录页面为何没有内容可显示。
       *
       * 没有这个字段时，空列表与坏页面无法区分，而启动屏只会说 "failed"、
       * 从不说原因。
       * @param draft - store 草稿。
       * @param status - 一行状态说明。
       */
      note: (draft, status: string) => { draft.status = status },
      sync: (draft, themes: ThemeDefinition[], selected: string, revision: number) => {
        if (revision <= draft.revision) return
        const labels: Record<string, string> = {}
        const descriptions: Record<string, string> = {}
        const swatches: Record<string, string[]> = {}
        for (const theme of themes) {
          const extra = theme as { label?: string, description?: string }
          labels[theme.id] = extra.label || theme.id
          descriptions[theme.id] = extra.description || ''
          const tokens = (theme.tokens ?? {}) as Record<string, unknown>
          const pick = (name: string): string | undefined => {
            const value = tokens[name]
            if (value === undefined || value === null) return undefined
            if (typeof value === 'string') return value
            const modes = value as { light?: string, dark?: string }
            return modes[theme.colorScheme]
          }
          swatches[theme.id] = [
            pick('--dsw-alias-bg-base'),
            pick('--dsw-alias-brand-primary'),
            pick('--dsw-alias-label-secondary'),
            pick('--dsw-alias-state-business-primary'),
          ].filter((value): value is string => typeof value === 'string' && value !== '')
        }
        draft.ids = themes.map((theme) => theme.id)
        draft.labels = labels
        draft.descriptions = descriptions
        draft.swatches = swatches
        draft.selected = selected
        draft.revision = revision
      },
    },
  })
}

/** 注入给页面的业务面。 */
export interface GalleryInjected {
  /** 切换主题偏好。 */
  setTheme: (id: string) => void
}

/** 页面完整 props：运行时份额 + store 份额 + locale 座位 + 注入面。 */
export type GalleryProps =
  & PropsRuntime<'main', typeof PANEL_ID>
  & PropsStore<ReturnType<typeof createGalleryStore>>
  & PropsLocale<'theme-gallery'>
  & GalleryInjected

/**
 * 渲染主区画廊页面。
 *
 * `usePanelInfo` 来自 layout 的 GlobalStandardProps，页面据此在别的面板被选中时
 * 返回 null，外壳无需挂载/卸载它。
 * @param props - 插槽组合后的 props。
 * @returns 页面元素树。
 */
export function ThemeGalleryPage({ t, setTheme, useStore, usePanelInfo }: GalleryProps): JSX.Element | null {
  const info = usePanelInfo((s) => s.activePanelId)
  const ids = useStore((s) => s.ids)
  const selected = useStore((s) => s.selected)
  if (info !== PANEL_ID) return null
  return jsxs('div', {
    children: ids.map((id) => jsx('button', {
      type: 'button',
      key: id,
      'aria-pressed': id === selected,
      onClick: () => { setTheme(id) },
      children: t('applied'),
    })),
  })
}

/**
 * 渲染侧栏面板入口。
 *
 * 侧栏自己拥有按钮并从 list 元数据解析行标签，这里只画图标。图标内联绘制而
 * 不从 ui-primitives 导入：那个包的 payload 不在客户端 seeded module table 里。
 * @param props - owner 份额（size / active）。
 * @returns 内联 SVG 图标。
 */
export function PanelGlyph({ size, active }: PropsRuntime<'sidebar.panellist'>): JSX.Element {
  const edge = typeof size === 'number' ? size : 16
  return jsx('svg', { width: edge, height: edge, 'aria-hidden': 'true', children: jsx('circle', { cx: 8, cy: 8, r: 6, stroke: 'currentColor' }) })
}

/** 本包贡献的主题，由脚本从 lib/themes/*.json 内联。 */
export declare const BUNDLED_THEMES: ReadonlyArray<ThemeDefinition & { label: string, description: string }>

/**
 * 注册侧栏图标 + 主区页面，并把自己带的主题放进官方注册表。
 * @param ctx - 客户端上下文。
 */
export function apply(ctx: Context): void {
  // create() 每次调用都返回**新实例**（由 tests/check-store-contract.mjs 证实），
  // 所以必须固定一个：渲染机制拿到的与本插件写入口用的必须是同一实例，否则每次
  // publish 都写进一个废弃实例，组件永远看不到数据。官方两个面板插件正是这么钉的：
  // `{ ...handle, create: () => instance }`。
  const storeHandle = createGalleryStore()
  const storeInstance = storeHandle.create()
  const store: typeof storeHandle = { ...storeHandle, create: () => storeInstance }
  const storeActions = storeInstance.actions

  let bound: { sync: (themes: ThemeDefinition[], selected: string, revision: number) => void } | undefined
  /** main 插槽 gate 是否已触发。 */
  let gateRan = false
  /** inject 工厂是否已运行。 */
  let injectRan = false
  let revision = -1

  const publish = (snapshot: ThemeSnapshot): void => {
    revision += 1
    bound?.sync([...snapshot.themes], snapshot.preference, revision)
  }

  // ctx.theme.register 对重复 id **会抛错**，而本函数会在每次 theme/change 重跑
  // （包括它自己第一次注册引发的那次），所以用本地集合保证幂等，不依赖快照时序。
  const contributed = new Set<string>()
  const contribute = (snapshot: ThemeSnapshot): void => {
    const known = new Set(snapshot.themes.map((theme) => theme.id))
    for (const definition of BUNDLED_THEMES) {
      if (contributed.has(definition.id)) continue
      contributed.add(definition.id)
      if (known.has(definition.id)) continue
      ctx.effect(() => ctx.theme.register(definition), `theme-gallery: theme ${definition.id}`)
    }
  }

  // 两个注册都走 `ctx.slots.inject(key, callback)`——官方两个侧栏面板插件
  // （ui-plugin-manager、schedule TaskManager）都这么写，契约也如此要求：回调只在
  // 目标插槽**被声明之后**运行。往未声明的插槽直接 register 会产生 pending wait，
  // 条目先出现再在外壳重组合时消失。
  //
  // 回调返回**单个 disposer**，这是契约里最直白的形态（"callback effects are
  // synchronous disposers"）。早先版本用 generator yield 多个 disposer——契约虽
  // 写了支持 iterable，但官方两处范例都用普通函数，那点额外机制未经验证，而
  // "订阅没装上"与"页面没注册"症状完全一样。
  ctx.slots.inject('main', () => {
    const disposePage = ctx.slots.register({
      name: 'main',
      key: PANEL_ID,
      store,
      locale: NS,
      inject: (actions) => {
        bound = actions
        return { setTheme: (id: string) => { ctx.theme.setTheme(id) } }
      },
    }, ThemeGalleryPage)

    gateRan = true
    publish(ctx.theme.getTheme())

    const disposeChange = ctx.on('theme/change', (snapshot: ThemeSnapshot) => {
      contribute(snapshot)
      publish(snapshot)
    })
    return () => { disposeChange(); disposePage() }
  })

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 30,
    locale: NS,
    label: () => '主题皮肤',
  }, PanelGlyph))
}
