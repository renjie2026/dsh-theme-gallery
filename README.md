# dsh-theme-gallery

给 DeepSeek Harness 的**主题画廊**：一个插件 + 一堆 JSON 皮肤。装一次，拿到全部主题；加皮肤**不用改代码、不用重启、不用重新装包**。

| 你想要 | 怎么做 |
|---|---|
| 直接用别人做好的皮肤 | 装上插件，在设置里点选 |
| 自己做皮肤（或让 AI 做） | 在 `lib/themes/` 加 JSON 后重跑 `npm run embed-themes`，或装 `dsh-theme-skin-author` 技能让 AI 生成 |
| 贡献一个皮肤给所有人 | 在 `lib/themes/` 放一个 JSON，提 PR |

内置两个皮肤，均复刻自电商新零售系统管理后台（`admin-modular/src/utils/themes.js`）：

| id | 名称 | 主色 | 强调色 |
|---|---|---|---|
| `shan-qing-ting-cai` | **山青婷彩** | `#2F7D5E` 青山绿 | `#E88BB0` 蜻蜓粉 |
| `meng-hai-you-yu` | **梦海游鱼** | `#177CB0` 靛青 | `#FFD166` 琥珀金 |

每个皮肤 67 个 token，覆盖整屏。

---

## 为什么是「一个插件 + 数据」，而不是「一个皮肤一个插件」

这是本项目唯一重要的架构决定，结论是前者：

| 维度 | 一个插件 + N 个皮肤数据 | 每个皮肤一个插件 |
|---|---|---|
| 用户装一个皮肤 | 不用动，设置里直接就出现 | 要再装一个包 |
| 设置里的选择器 | 一行列出全部 | 每个插件各自注册一行，UI 抢位 |
| 作者加皮肤 | 改一个 JSON | 新建仓库 + 发 npm + 绑版本 |
| 加载开销 | 一个插件一行 | N 个插件 N 行 |
| 升级 | 一个包对一个 DSH 版本 | N 个包各自绑版本，升级全炸 |

**判断准则**：有运行时逻辑 / 服务 / Hook → 独立插件；只是数据 / 配色 → 数据文件。

皮肤是纯数据，所以走后者。这也正是官方 `ctx.theme` 的设计意图——官方 README 原话：*"registering one means overriding same-named alias variables"*。

---

## 为什么官方「设置 → 通用 → 外观」看不到这些皮肤

官方那一行的选项是**写死的常量数组**：

```ts
// 官方源码 packages/client/ui-theme/src/client/AppearanceRow.tsx
const CUBES = [light, dark, system]
```

它渲染 `CUBES.map(...)`，**从不读取主题注册表**。官方 README 也说得很直白：*"Third-party themes are an extension point, not a product"*。

所以本插件自带入口。

---

## 入口在哪：左侧栏面板，不是设置

| 位置 | 官方插槽 | 形态 |
|---|---|---|
| **本插件用这个** | `sidebar.panellist` + `main`（keyed，同一个 id） | 左栏一个图标 → 主区一整页主题卡片 |
| 备选（未用） | `sidebar.footer.action` | 齿轮旁的小图标 + 弹出气泡 |
| 备选（未用） | `settings.general.item` | 设置里一行按钮 |

选第一个的理由不只是位置好：**它正是这个应用的"插件"机制**——一个插件 = 侧栏一个入口 + 主区一个页面，和 `Plugins` 页同级。

而且侧栏入口是 `list` 插槽，**一个插件最多占一个座位**：这从机制上就否定了"每个皮肤一个插件"。

> `sidebar.footer.action` 同样是 `list`，一个插件也只有一个座位，且气泡里放不下预览。设置行则额外需要 settings 域——见下面的踩坑记录。

**打开方式**：左栏那排面板图标里点 **主题皮肤**，主区显示全部可选主题，点卡片切换，选中态会记入设置。

---

## 安装

### 直接用（推荐）

1. **设置 → 插件 → 添加插件**，输入：

   ```
   dsh-theme-gallery
   ```

   或粘贴本仓库地址 / 本地 `.tgz` 文件路径——该界面三者都接受。

2. **重启应用。**

3. 左侧栏底部会多出 **主题皮肤** 入口（**不在**「设置 → 通用 → 外观」里，原因见下文）。
   三个主题：山青婷彩 / 梦海游鱼 / 深色。

> **不需要任何构建授权。** 本包把 `lib/` 作为源码随包分发（无构建步骤），
> 安装即用，不会出现"缺 `lib/` 目录"那类失败。

### 装不上或想手动装

桌面 profile 由 Electron 独占，**CLI 会被拒绝**：

```
error: profile "desktop" is managed exclusively by the Electron application
```

那就手动改 profile 清单（这是官方 profile 的既定机制，不是 hack）：

```jsonc
// <DSH_HOME>/profiles/desktop/package.json
//   "dependencies":        { "dsh-theme-gallery": "^0.1.0" }
//   "dsh.profile.bundles": [ ..., "dsh-theme-gallery" ]
```

```bash
cd <DSH_HOME>/profiles/desktop && pnpm install
```

Windows 上 `<DSH_HOME>` 默认是 `C:\Users\<你>\.dsh`。

**然后重启。**

---

## 卸载与回滚

主题插件最坏的情况是**界面进不去**。以下四招按"由轻到重"排列，**都不需要重装应用**。

### ① 只停装饰与自动恢复，保留插件（最轻）

插件的两个活动层可以用一个配置开关整体停掉，**不必卸载**。编辑 profile 自己的
`cordis.patch.yml`（位置：`<DSH_HOME>/profiles/desktop/cordis.patch.yml`），加：

```yaml
- id: theme-gallery
  name: dsh-theme-gallery
  config:
    ambient: false      # 停掉氛围装饰层与皮肤恢复层
```

**为什么需要这一招**：`dsh.profile.bundles` **不是手写清单** —— 每次插件安装 / 启用 /
优化后，应用都会按 `dependencies` 里声明了 `dsh.bundle.patch` 的包**自动推导重建**它。
所以把一个包从 `bundles` 里删掉**不能持久**，会被写回来。上面的开关是插件侧的刹车。

### ② 从应用里卸载

**设置 → 插件** 里移除本插件，然后重启。这是最干净的做法。

### ③ 手动从 profile 卸掉

```jsonc
// <DSH_HOME>/profiles/desktop/package.json
//   删掉 dependencies 里的 "dsh-theme-gallery"
//   删掉 dsh.profile.bundles 里的 "dsh-theme-gallery"
```

```bash
cd <DSH_HOME>/profiles/desktop && pnpm install
```

重启。

### ④ 界面完全起不来时：把偏好改回内置值

**这是最可能的"起不来"原因，而且它完全是你自己写的配置造成的。**

皮肤 id **绝不能**写进主题偏好。`ui-theme.config.preference` 只接受
`light` / `dark` / `system`：

```yaml
# <DSH_HOME>/profiles/desktop/cordis.patch.yml
ui-theme:
  config:
    preference: light      # 只能是 light | dark | system
```

写成皮肤 id（如 `shan-qing-ting-cai`）时，`buildSnapshot()` 会抛
`theme registry lost` 并**拒绝启动** —— 因为偏好指向一个（当时）还没注册的主题。

> **皮肤的当前选择存在 `localStorage` 里，不在 `preference` 里。** 这是刻意设计：
> 偏好是启动期读取的，而皮肤要等插件加载后才注册，两者天然有先后。

### 还有一招：拿一份干净的 profile 快照

`<DSH_HOME>/profiles/desktop/` 整个目录可以先复制一份再改。出问题时把
`package.json` 与 `cordis.patch.yml` 换回去即可。改之前备份是**最省事的保险**。

---

## 疑难排障

### 应用弹「无法使用」并给出「禁用第三方插件」出口

DSH 有启动保护。先用它进去，再按上面的「卸载与回滚」处理。

### 启动挂起、日志里什么都没有

**怀疑 fiber pending，去查 `inject` 与循环等待；不要去看模型或网络配置。**

`crash-*-web-boot.log`（`%APPDATA%\@deepseek-ai\dsh-desktop\logs\`）里
**一条记录都没有**，而应用卡在 "Loading plugins..." —— 这就是 pending fiber 的指纹。

历史上撞过三次，都源自 `inject`：

| 版本 | 错误 | 结果 |
|---|---|---|
| 第一版 | 把 `settingsScope` 写成硬依赖 | `dsh-theme-gallery: pending (waiting for service: settingsScope)` |
| 第二版 | 以为 `immediately: true` 能解决 | **无效**，是错的根因判断 |
| 第三版 | 声明的模块没在 `dsh.client.inject` 里 | **完全没有任何日志** |

Cordis 的 `inject` 有两种形态：

```ts
inject: ['a', 'b']            // 数组 —— 每一项都是【必需】
inject: { a: cfg, b: null }   // 映射 —— null 标记该项可选
```

用数组形态时，**拿不到的服务会让 fiber 永远停在 `pending`**，而未激活的 entry 会让整个
web boot 失败。

> **教训**：把自己无法控制的服务写成硬依赖，等于给了它一票否决应用启动的权力。

**当前状态**：`exports.inject = ['slots', 'locale', 'theme']` —— 三者都由静态编入的
UI 包提供，保证存在。另外 `package.json` 的 `dsh.client.inject` 声明了提供主题服务的
模块，用来固定加载顺序（漏掉它时**不产生任何日志**，最难查）。

回归测试锁住了这件事（`tests/smoke-host.mjs`、`tests/check-boot-safety.mjs`）。

### 启动保护弹窗（比手改更快）

DSH 有启动保护，弹窗给两个出口：

1. **「禁用第三方插件、备份 profile patch 并重启」** —— 先用这个进去。
   注意它会**重置 profile 的 `cordis.patch.yml`**，所以恢复后要检查
   `<DSH_HOME>/profiles/desktop/cordis.patch.yml` 是否需要补回偏好设置。
2. **退出 / 重启**

崩溃详情在：

```
%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log
```

日志会**逐条列出 pending 的 entry 和它等待的服务名**——排查启动问题最快的信息源。

> **但注意**：本插件遇到过一种**完全不写日志**的启动失败（`dsh.client.inject` 漏声明），
> 所以"日志是空的"**不能**排除插件问题。详见上一节。

### ⚠️ 桌面版**不读** `$DSH_HOME/settings.yaml`

这一点与官方文档的默认值相反，值得单独记住：`dsh-base` 与 `dsh-web-app` 两个 bundle 都把设置文件 provider 配成了内存模式——

```yaml
- name: '@deepseek-ai/dsh-settings-file'
  path: ':memory:'
```

所以**桌面版里手写 `settings.yaml` 不生效**；应用启动时会把这类文件归档成 `settings.yaml.imported`，然后继续使用内存状态。控制皮肤选择的权威位置是组合层——profile 的 `cordis.patch.yml`：

```yaml
- id: ui-theme
  name: "@deepseek-ai/dsh-client-ui-theme"
  config:
    preference: shan-qing-ting-cai
```

或者，等插件加载成功后直接用设置界面点选。

（`theme-gallery` 段仍可写在 `settings.yaml` 里，但需要 profile 换成文件型 provider；桌面版目前走内存，所以**加自定义皮肤请改 `lib/themes/*.json` 后重跑 `npm run embed-themes`**。）

### 首次启动的顺序注意

首次启动前，`cordis.patch.yml` 里的偏好先留内置值（`dark` / `light` / `system`）。因为 `ui-theme` 的 `buildSnapshot` 在偏好指向未注册 id 时会**抛错**（官方源码里是明确的 `throw`，不在 try/catch 内）：

```js
if (active === void 0) throw new Error(`theme registry lost "${resolvedId}"`)
```

而 `shan-qing-ting-cai` 要等本插件的浏览器半侧注册完才存在。确认插件加载成功后，再把偏好改成皮肤 id。

---

## 两种状态：整屏铺满 / 阅读时变浅

皮肤的价值是**整屏覆盖**；而整屏覆盖正是长对话难读的原因。所以界面被分成两种状态：

## 侧栏素材与激活标记（region 1 复刻）

两个皮肤不只是配色，还把原系统**左侧菜单区的元素素材**复刻了过来，并给"正在使用"的状态加了标记色。

### 侧栏氛围装饰 `ambient`

| 皮肤 | 素材 |
|---|---|
| 山青婷彩 `kind: "shan"` | 青山两层 + 山间云雾 + 山脚水面与点水涟漪 + 两只悬停蜻蜓 + 花瓣飘落 |
| 梦海游鱼 `kind: "dream"` | 左上柔光辉 + 两道弥散光洗 + 上浮气泡 + 五叶水草摇摆 |

素材逐像素复刻自 `ShanQingTingCaiAnimation.vue` 与 `DreamOceanAmbient.vue`。与原系统**有意偏离**两处：

1. **尺寸改为百分比 / em**。原系统写死 223px 侧栏宽；DSH 侧栏可拖拽，固定像素在窄侧栏会截断。
2. **`pointer-events:none` 且置于导航之下**。原系统文档记有一条 bug：不透明山形贴在侧栏底部会遮挡最下方菜单项。

`kind` 是**数据键而非素材路径**——插件只为它真正画得出的场景提供键，写错会在构建期失败，而不是运行时静默不画。

装饰挂在侧栏列里的 `#dsh-theme-ambient`。这是本插件**唯一**直接操作外壳 DOM 的地方（侧栏没有装饰插槽，插槽组件会成为列的兄弟而非其背后的图层），因此单独隔离、整体 try/catch：**装饰是修饰，绝不能成为故障原因**。侧栏定位用三级回退，因为外壳类名是 CSS-module 哈希、不是稳定契约。

先看效果再装：`npm run preview:ambient` 生成的预览页**把 CSS 直接读自 `lib/client.js`**，因此不会与出货版本漂移；两种侧栏宽度并排。

### 激活标记 `accent`

侧栏条目与选中对话行在 DSH 里共同读取 `--dsw-alias-button-ghost-active-fill/-border/-hover`，所以 `accent` 叠加到这三个 token 上，**两者同时变成标记色**。

取值遵循来源项目《主题皮肤设计规范（第二区域）》第 123 / 118 行：**强调色取本皮肤第一区域的特征色，且禁止引入第一区域不存在的色相**。所以

| 皮肤 | 强调色 | 出处 |
|---|---|---|
| 山青婷彩 | `#E88BB0` | 蜻蜓粉 |
| 梦海游鱼 | `#FFD166` | 夕照金 |

**不是所有主题一律粉**——那样恰好违反来源项目自己的规范。两条约束由代码强制：叠加**只对活跃主题**生效、切走即撤除；**不动 `brand-primary`**（否则链接、主按钮、状态徽标会被一起改掉）。

| 状态 | 判定 | 视觉 |
|---|---|---|
| **空对话态** | 会话里还没有消息 | 整屏铺满主题：左侧栏渐变 + Windows 顶部标题栏渐变 + 中间留白也是主题色 |
| **有对话态** | 出现消息后 | 正文套一层**提亮卡片**（默认 62% 不透明度 / 3px 模糊 / 640px 限宽），四周仍透出主题渐变；左侧栏与顶部**保持主题强度**，一眼可辨是哪个皮肤 |

### 原理：整屏覆盖靠 token，不靠注入 CSS

看起来渐变必须注入样式表，其实不用。官方布局**本来就用主题 token 画这些面**：

```css
/* 官方源码 packages/client/ui-layout/src/client/AppFrame.module.css */
.sidebarCol                        { background: var(--dsw-specific-sidebar-fill); }
[data-windows-titlebar] .frame     { background: var(--dsw-specific-sidebar-fill); }
[data-windows-titlebar] .centerCol { background: var(--dsw-alias-bg-base); }
```

所以皮肤只要把 **`--dsw-specific-sidebar-fill` 设成渐变**，左侧栏和 Windows 顶部标题栏就一起铺满了，**零注入**。

只有阅读态需要一条注入规则，且它锚在官方自己也在用的 `[data-windows-titlebar] .centerCol` 上（不是猜的组件类名）：

```css
[data-windows-titlebar] body[data-dsh-theme-reading] .centerCol { background: var(--dsh-reading-bg); }
```

### 阅读态怎么被判定

DSH 没有公开「当前会话有几条消息」的 API，所以状态从 DOM 推导：找到 composer（中列里唯一的 `[contenteditable]`）→ 取 composer 座位旁边的兄弟节点 → 该兄弟有元素子节点就认为会话有内容。用 `MutationObserver` 跟随变化，并**去抖到微任务**（流式回复每帧会改很多次 DOM，只有安定后的答案有意义）。

```js
// lib/client.js —— 判定集中在 transcriptHasContent()
document.body.setAttribute('data-dsh-theme-reading', reading.colorScheme)
```

> **这是未公开的 DOM 契约。** 官方 UI 大改后可能失效。届时行为是**降级为始终空对话态外观**（主题继续覆盖整屏，只是不再变浅），不会把界面弄坏。要改判定逻辑，只动 `transcriptHasContent()` 一个函数。

---

## 加自己的皮肤

### 放到 `lib/themes/` 后重新内联

在 `lib/themes/` 下新建一个 JSON（一个文件可放多个皮肤），然后：

```bash
npm run embed-themes      # 校验 + 内联进 lib/client.js
```

重启应用后，新皮肤出现在面板页里。

```json
[
  {
    "id": "cyberpunk",
    "label": "赛博朋克",
    "description": "深紫底 + 霓虹粉",
    "colorScheme": "dark",
    "tokens": {
      "--dsw-alias-bg-base": { "light": "#f0f0ff", "dark": "#0a0612" },
      "--dsw-alias-label-primary": { "light": "#12002e", "dark": "#f4eaff" },
      "--dsw-alias-brand-primary": { "light": "#7c3aed", "dark": "#ff2fd0" },
      "--dsw-specific-sidebar-fill": {
        "light": "linear-gradient(to bottom,#f0f0ff 0%,#c8c2e0 100%)",
        "dark": "linear-gradient(to bottom,#0a0612 0%,#2f2450 100%)"
      }
    }
  }
]
```

`embed-themes.mjs` 会先校验（形状 / id 唯一 / 双配色 / 12 个必需 token / `--dsw-specific-sidebar-fill`），任何一条不过就拒绝写入——这样坏皮肤不会进到产物里。

> **`id` 与内置皮肤相同时会冲突**：本包注册时若发现注册表里已有同名 id，会跳过自己的那份而不报错。所以想让你的皮肤生效，换个新 id，或先删掉 `lib/themes/` 里的同名项。

### 发成独立插件（分发给别人）

别人做皮肤时**不需要改这个仓库**：他自己的插件只要在客户端半侧调 `ctx.theme.register(definition)` 就行，官方注册表是共享的，本面板会自动列出他的皮肤——两个插件互不知情。

这就是"一个插件管全部皮肤"的实际含义：**画廊负责选择界面，注册表负责汇总**。

### 让 AI 生成皮肤（用配套技能）

配套技能 **`dsh-theme-skin-author`** 写全了皮肤 JSON 格式、token 契约与必需项、
配色方法、`register` / `overrideTokens` 的数据格式区别，以及一份完整的山青婷彩
范例——AI 不用读源码就能产出**合法**皮肤。

```sh
cp -r <技能目录>/dsh-theme-skin-author ~/.claude/skills/
```

> 本仓库**不再自带技能副本**。此前自带的那份 `dsh-theme-author` 有两处硬伤，
> 已删除：它教用户把皮肤写进 `settings.yaml`（桌面版不读该文件），并要求每个
> token 都给 `{ light, dark }` 成对值（那是 `overrideTokens` 层的格式；
> 喂给 `register` 会把 `[object Object]` 写进 CSS，皮肤选中却毫无颜色）。

然后直接说需求，例如：

> 给我做一个「深海」皮肤，深蓝背景，青色点缀，晚上看不刺眼，长对话要能读

### 视觉调参台

阅读态的取舍（主题存在感 vs 正文可读性）有专门的调参台：DSH 分区复刻、两种状态、两个皮肤、滑杆与 localStorage 持久化。

```sh
npm run bench     # http://127.0.0.1:8171/
```

URL 参数便于批量截图走查：

```
?theme=shan|dream  &state=idle|reading  &right=on  &readBg=62&readWidth=640&readBlur=3
```

调好后把参数行贴回来，或直接写进皮肤的 `reading` 段。

---

## 硬性规则（运行时会校验）

1. **每个 token 必须同时给 `light` 和 `dark`。** 给单个字符串会抛 `TypeError`：同一份定义在用户切换配色时会被复用，单值会让另一套配色看不清。
2. **`colorScheme` 决定底板**，不是 `id`。它也决定 `body[data-ds-dark-theme]`。
3. **`id` 只能小写字母、数字、连字符**（`^[a-z0-9][a-z0-9-]*$`），且**不能是 `system`**（那是偏好，不是皮肤）。
4. **token 键只能是 `--dsw-alias-*` 或 `--dsw-specific-*`。** 后者是官方配套层，`--dsw-specific-sidebar-fill` 就是整屏覆盖的关键。
5. **漏 token 是安全的**：没覆写的变量沿用基础调色板。但必需 token 漏多了，皮肤会像没生效。

### 必需 token（12 个）

官方只把这 12 个标记为必需（`BUILTIN_INSPECT_TOKENS` 里 `requiresLightAndDark: true`）：

```
--dsw-alias-bg-base                 --dsw-alias-label-primary
--dsw-alias-bg-layer-1              --dsw-alias-label-secondary
--dsw-alias-bg-layer-2              --dsw-alias-state-error-primary
--dsw-alias-bg-overlay              --dsw-alias-state-success-primary
--dsw-alias-border-l1               --dsw-alias-state-warn-primary
--dsw-alias-border-l2               --dsw-alias-brand-primary
```

**运行时不会校验完整性**——官方原话：*"no validation exists that an override set is complete"*。所以完整性检查放在本仓库的 schema 与构建脚本里。

alias 层共 **81** 个变量，权威定义在官方仓库
[design-platform.css](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-theme/src/styles/design-platform.css)。

### 优先用 `var(--dsw-static-*)`

引用官方静态色阶，皮肤会跟随产品调色板演进。只在表达皮肤身份的颜色（背景、主色）上用字面量。

---

## 开发

```
dsh-theme-gallery/
├── package.json          # dsh.bundle + dsh.client + exports["./client"]
├── cordis.patch.yml      # 被 profile 选中时应用的配置层
├── schema/theme.schema.json   # 皮肤 JSON Schema（含必需 token 清单）
├── tools/theme-bench/    # 视觉调参台（单文件 HTML）
├── scripts/
│   ├── embed-themes.mjs         # 校验内置皮肤并内联进 client.js
│   ├── build-ambient-preview.mjs # 生成侧栏素材预览页（CSS 读自 client.js）
│   └── serve-bench.mjs          # 启动调参台
├── tests/
│   ├── check-schema.mjs               # 真实 schemastery 解析 + 反向用例
│   ├── smoke-host.mjs                 # 真机加载 lib/index.js 并跑 apply
│   ├── check-store-contract.mjs       # create() 实例语义
│   ├── check-declaration-order.mjs    # ctx.effect 同步执行的 TDZ 审计
│   └── check-theme-contribution.mjs   # 贡献逻辑 + token 必须是字符串
├── types/                # 契约校验源（不参与运行）
└── lib/
    ├── index.js          # 宿主：注册 theme-gallery settings 命名空间（预留扩展点，当前无人读取）
    ├── client.js         # 浏览器：lazy-CJS 工厂，注册皮肤 + 侧栏面板 + 阅读态
    └── themes/*.json     # 内置皮肤（会内联进 client.js）
```

> `lib/index.js` 注册的 settings 命名空间**当前没有任何东西读取**。桌面版把设置
> provider 编成 `path: ':memory:'`，手写 `settings.yaml` 会被归档成
> `settings.yaml.imported` 且从不被查询；浏览器半侧也改为走 `ctx.theme.register`，
> 皮肤唯一来源是 `lib/themes/*.json`，选择由主题服务自己持久化。
>
> 保留它是因为它是**文件型 settings provider 的落点**：下面的 schema 会被这样的
> provider 用来校验，所以形状被钉住并被测试覆盖，只是暂时还没有运行者。

```sh
pnpm install
pnpm run check     # 全部五组，当前全绿
pnpm run bench     # 调参台
```

`pnpm run check` 依次做六件事：

1. **`tsc`（exit 0）**：`types/*.ts` 用官方发布的真实类型包校验插槽注册契约、`defineStore` 座位形状、主题注册与 token 契约。
2. **`tests/check-schema.mjs`**：用真实 schemastery 解析内置皮肤（正例），再跑 **10 个反向用例**确认 schema 不是空转——含缺 `label`、缺 `description`、`reading.alpha` 越界等。
3. **`tests/smoke-host.mjs`**：**真机加载** `lib/index.js`，用假 context 跑 `apply`，确认注册了命名空间与 schema 实例、缺 settings 服务时是安静的空操作；并守住客户端 `inject` 清单（必需服务在白名单内、settings 域的服务不得出现）与插槽注册是否都被 `ctx.slots.inject` 门控。
4. **`tests/check-store-contract.mjs`**：验证 `handle.create()` 的实例语义（每次返回新实例，因此必须钉住）。
5. **`tests/check-declaration-order.mjs`**：静态审计 `apply` 体，确认没有同步入口（`ctx.effect` / `ctx.on`）读取更晚声明的顶层标识符——`ctx.effect` 是**同步执行**的。
6. **`tests/check-theme-contribution.mjs`**：跑贡献逻辑与幂等守卫，并断言**注册的 token 必须是字符串**（成对对象会变成 `[object Object]`）；`scripts/embed-themes.mjs` 校验皮肤（形状 / id 唯一 / 双配色 / 12 必需 token / `reading`）后内联进 `lib/client.js`，幂等。

### 客户端插件通用陷阱（每一条都真实踩过，都已写成自动检查）

这些不只属于主题插件——**任何第三方客户端插件都会遇到**。

#### 1. `inject` 数组里声明的一切都是【必需】，拿不到就永久 pending

而**未激活的 entry 会让整个 web boot 失败**：

```
web boot: 1 entry did not activate
dsh-theme-gallery: pending (waiting for service: settingsScope)
```

- 服务由**插件**提供、而那个插件自己还依赖别的服务时，**不要**写进 `inject`。`settingsScope` 就是这种：它来自 `dsh-client-ui-settings`，后者在等 `remote.settings`。
- 服务由**静态编入**的包提供时，可以写：`slots` / `locale` 来自 `dsh-client-ui-layout`，`theme` 来自 `dsh-client-ui-theme`。
- **忘了声明同样会炸**：`cannot get property "theme" without inject` —— Cordis 的守卫不允许访问未声明的服务。

#### 2. `ctx.effect(cb)` **同步执行** `cb`

因此 `cb` 读到的任何东西必须在**调用点**就已初始化，否则 `Cannot access 'X' before initialization`。这个错误犯了**两次**（`storeActions`、`contributed`）——因为看不到运行时，每次只能靠"重装+重启"发现。所以补了静态审计 `tests/check-declaration-order.mjs`。

#### 3. `handle.create()` 每次返回**新实例**

```js
const instance = handle.create()
const store = { ...handle, create: () => instance }   // 必须钉住
```

不钉住：你写进 A、组件读 B，**每次 publish 都落进废弃实例**，而页面照常渲染、只是永远空着。官方两个面板插件都有这一行，我起初以为它是多余样板。

#### 4. 槽位注册必须用 `ctx.slots.inject(key, cb)` 等父插槽声明

直接 `register` 到未声明的插槽会产生 **pending wait**：条目**先出现、再在外壳重组合时消失**。回调返回**单个 disposer**（官方两处范例都是普通函数；我一度用 generator，无效）。

#### 5. `{ light, dark }` 成对 token 只属于 `overrideTokens`，**不属于 `register`**

```js
register(def)      { this.themes = [...this.themes, def] }        // 原样存，不展平
composeActive(act) { if (this.overrides.size === 0) return act }  // 无层时原样通过
```

`ThemeDefinition.tokens` 是 `Record<string, string>`。把成对对象喂给 `register` 会把 **`[object Object]`** 写进 CSS——**主题选中了、id 对、token 数对、颜色一个都没上**。注册前必须按 `colorScheme` 展平。

> 本文档别处那句「每个 token 必须同时给 `light` 和 `dark`」，适用范围是 **`overrideTokens` 层**，不是 `register`。

#### 6. 不要用样式表去画承载主题的区域

我注入过一条阅读态规则 `background: var(--dsh-reading-bg, transparent)`，把中列背景设成透明 —— 于是**皮肤被自己的插件盖掉**，整个界面透出应用默认白底。**"变浅"是 token 的事，走 `overrideTokens`**，不要碰背景。

#### 7. 配色职责：内容区接近白，主题性格交给 chrome

DSH 用 `--dsw-alias-bg-base` 铺满整个中列。把这个 token 设成饱和色 → **一整片平坦色块盖住一切**，看起来"只是变了颜色"。原版设计里左侧菜单与顶栏承担主题性格、大片工作区是白的。所以：

- `--dsw-alias-bg-base` → 极浅，可带很轻的纵向渐变
- `--dsw-specific-sidebar-fill` → **渐变，主题性格在这里**

#### 8. 排查手段：让页面自报「服务认为的」与「实际生效的」

症状往往是"选了没反应"，而从外部无法区分"没注册""没选中""选中了但 token 坏了""token 对了但被自己的 CSS 盖住"。有效做法是**在页面上并排显示**：

```js
// 服务认为的
const active = ctx.theme.getTheme().active
// 实际生效的 —— 读 live DOM，不要读服务自身
getComputedStyle(document.body).getPropertyValue('--dsw-alias-brand-primary')
getComputedStyle(document.body).backgroundColor
```

矛盾会立刻显形。当初正是这行对比一次指出 `brand=[object Object]` 与 `body 背景=transparent` 两个问题。

#### 9. 构建/工具链

- **schemastery 的对象字段默认「可选」**：`z.object({ label: z.string() })` 会**接受**缺 `label` 的对象，必须显式 `.required()`。最初的校验器形同虚设，是「缺 label」反向用例逼出来的。
- **`z.resolve()` 对非法值是抛 `ValidationError`**，不是返回失败标记；`[value, adaptedInput?]` 第二个元素是适配提示。
- **`dsh-client-store` 在 Node 下需要 `zustand` / `immer` / `react`**，否则契约测试无法加载。
- **`@deepseek-ai/dsh-client-*` 的 npm `latest` dist-tag 滞后**：`dsh-client-ui-slots` 的 `latest` 是 `0.0.1-rc.1`，真实最新已到 `0.1.7-rc.2`。用 `^0.0.1-rc.1` 会装到**缺 `ctx.slots` 声明**的老版本。本仓库按宿主实际安装版本**精确锁定**。

### 为什么内置皮肤要内联进 client.js

settings scope 返回的是**用户文档段**，内置皮肤是它下面的 fallback——干净安装解析出来**没有这个段**。所以宿主侧不读 JSON，浏览器侧必须把内置皮肤烤进 bundle。

### 为什么 `lib/*.js` 是手写的

`./client` 必须是客户端模块系统的 **lazy-CJS 工厂**（`window.__ModuleLoader__.load({ id, factory })`）。生成它的 `clientBundle` tsdown 预设**不在任何已发布的包里**（在仓库 `packages/client/tsdown.client.ts`）。手写就绕开了：本包**没有构建步骤**，git 安装与 npm 安装行为一致，用户也不必为 `prepare` 脚本授权。

---

## 分享到 GitHub

官方 `CONTRIBUTING.zh.md` 原文：**"很抱歉，我们目前无法接受外部 PR（Pull Request）"**——但紧接着给了生态贡献方式：

> 创建令你感兴趣的插件，并分享给其他人：
> **为你的 GitHub 项目添加 `dsh-plugin` 话题**，让其他人更容易找到你的插件。

所以是**独立仓库 + `dsh-plugin` 话题**。别人想贡献皮肤，往 `lib/themes/` 加一个 JSON 提 PR 即可——不需要碰任何代码。

| 分发方式 | 用户怎么做 | 代价 |
|---|---|---|
| **npm 预构建**（推荐） | `node scripts/install-into-profile.mjs desktop` 后填包名安装 | 你发布前构建好 `lib/`，用户零授权 |
| **tarball** | 同上，装 `.tgz` | 同上，无需注册表账号 |
| **git 源码** | 装 `github:you/dsh-theme-gallery` | 需要 `prepare` 脚本 + 用户 `allowBuilds` 授权；本包无构建步骤，可省 |

```sh
pnpm pack                     # 产出 tarball
npm publish --access public   # 发布到 npm
```

### 运行期依赖

`lib/client.js` 里 `require` 的 `@deepseek-ai/dsh-client-store` 与 `react/jsx-runtime` 来自客户端的 platform-module 种子表，**不要**写进 `dsh.client.inject`——官方 `ui-theme` 也是直接 require 值。`dsh.client.inject` 只能列**自身声明了 `dsh.client`** 的包名。

---

## License

MIT
