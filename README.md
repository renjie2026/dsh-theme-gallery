# dsh-theme-gallery

[![npm version](https://img.shields.io/npm/v/dsh-theme-gallery.svg)](https://www.npmjs.com/package/dsh-theme-gallery)
[![license](https://img.shields.io/github/license/renjie2026/dsh-theme-gallery.svg)](https://github.com/renjie2026/dsh-theme-gallery/blob/main/LICENSE)

给 DeepSeek Harness 的**主题画廊**：一个插件 + 一堆 JSON 皮肤。装一次，拿到全部主题；加皮肤**不用改代码、不用重启、不用重新装包**。

| 你想要 | 怎么做 |
|---|---|
| 直接用别人做好的皮肤 | 装上插件，在设置里点选 |
| 自己做皮肤（或让 AI 做） | 在 `lib/themes/` 加 JSON 后重跑 `npm run embed-themes`，或装 `dsh-theme-skin-author` 技能让 AI 生成 |
| 贡献一个皮肤给所有人 | 在 `lib/themes/` 放一个 JSON，提 PR |

已随 **0.4.0** 发布 **7 套**皮肤：四套复刻自**蜂链商城**电商新零售系统管理后台
（[`renjie2026/fenglianshop-open`](https://github.com/renjie2026/fenglianshop-open) 的
`admin-modular/src/utils/themes.js`），两套是本插件**原创**的宠物主题（同一套造色方法，色相取自中国传统色库），
另有一套是**「纯色/拼色」配色选择器**卡片（15 个可点色值，见下）。

| id | 名称 | 主色 | 强调色 |
|---|---|---|---|
| `shan-qing-ting-cai` | **山青婷彩** | `#2F7D5E` 青山绿 | `#E88BB0` 蜻蜓粉 |
| `meng-hai-you-yu` | **梦海游鱼** | `#177CB0` 靛青 | `#FFD166` 琥珀金 |
| `ying-mu-cai-yun` | **营慕彩云** | `#2D5A3D` 林间深绿 | `#FFB347` 琥珀 |
| `pei-an-jie-xin` | **佩安杰心** | `#7A5C3E` 暖檀褐 | `#B4653A` 赭陶 |
| `hu-po-mao-mi` | **琥珀猫咪**（原创） | `#9C5F24` 琥珀深焙（按钮/边框族） | `#CA6924` 琥珀（中国传统色） |
| `hu-zi-a-huang` | **虎子阿黄**（原创） | `#896C39` 秋色（按钮/边框族） | `#F0C239` 缃色（中国传统色） |
| `shi-liu-jin` | **纯色/拼色**（配色选择器） | `#F20C00` 石榴红（默认那套「石榴金」） | `#9D2933` 胭脂（按钮族） |

面板里另有**两张内置外观卡**（`浅色` / `深色`）：它们**不是皮肤**，作用是把配色切回官方的浅色 / 深色
（与「设置 → 通用 → 外观」同一套），所以**不计入上面这 7 套**。我们在官方浅色/深色上加了一点**小惊喜**
—— 见 [效果预览](#效果预览) 最后一行。官方外观里的「跟随系统」**不出卡**：它就是浅色/深色二选一，
再占一张卡只是重复。

工作区里另有三套复刻皮肤仍在打磨，**尚未发布**：江畔冬云 `jiang-pan-dong-yun`、
徐山军月 `xu-shan-jun-yue`、光彩凤晨 `guang-cai-feng-chen`。
（发布前自检会核对这份清单：README 里的每个 id 都要真实存在，
`lib/themes` 里的每套皮肤也必须在这里被提到。）

每个皮肤 67 个 token，覆盖整屏。

## 效果预览

| 山青婷彩 `shan-qing-ting-cai` | 梦海游鱼 `meng-hai-you-yu` |
|---|---|
| ![山青婷彩：青山两层、云雾、蜻蜓与落花，侧栏水塘收底](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/shan-qing-ting-cai.png) | ![梦海游鱼：左上柔光辉、上浮气泡与光点、蓝色小鱼、水草与水底渐变](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/meng-hai-you-yu.png) |

| 营慕彩云 `ying-mu-cai-yun` | 佩安杰心 `pei-an-jie-xin` |
|---|---|
| ![营慕彩云：暮色暖光、三层彩云与前后两层漂移云海，两只热气球往返漫游](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/ying-mu-cai-yun.png) | ![佩安杰心：雾山远衬、禅意圆相与坐禅人影、香炉两缕青烟与浮尘，底部禅语](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/pei-an-jie-xin.png) |

| 琥珀猫咪 `hu-po-mao-mi`（原创） | 虎子阿黄 `hu-zi-a-huang`（原创） |
|---|---|
| ![琥珀猫咪：暖阳光晕与晒暖窗台，坐姿虎斑猫摆尾抖耳，蜷卧酣睡猫呼吸起伏并冒小 z，阳光浮尘](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/hu-po-mao-mi.png) | ![虎子阿黄：金色光晕与田埂干草丛，中黄田园犬镰刀尾摇摆、歪头、挂着铃铛项圈，缃色皮球与蒲公英绒毛](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/hu-zi-a-huang.png) |

**内置浅色 / 深色 + 皮肤素材 —— 那个小惊喜**

| 内置「浅色」+ 山青婷彩的侧栏素材 | 内置「深色」+ 营慕彩云的侧栏素材 |
|---|---|
| ![内置浅色外观：调色回到官方浅色，而侧栏仍留着山青婷彩的山峦、水塘与蜻蜓](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/builtin-light-with-shan-qing-ting-cai.png) | ![内置深色外观：调色回到官方深色，而侧栏仍留着营慕彩云的彩云与热气球](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/builtin-dark-with-ying-mu-cai-yun.png) |

**「纯色/拼色」卡片 —— 同一张卡、两套配色**（点色格即时换色；卡片名旁边的「已应用」标出当前那套）

| 石榴金配色（默认） | 换点「松柏绿」那一格之后 |
|---|---|
| ![纯色/拼色卡片 + 石榴金配色：侧栏与主区都是石榴红/赤金/翡翠那套暖调](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/shi-liu-jin.png) | ![同一张卡片换成松柏绿配色：整屏转为松柏叶的墨绿调](https://raw.githubusercontent.com/renjie2026/dsh-theme-gallery/main/screenshots/shi-liu-jin-song-bai-lu.png) |

玩法：**先点一套皮肤，再点「浅色」或「深色」** —— 调色回到官方外观，而侧栏素材**留在原处**
（切到**另一套皮肤**时素材会正常替换；重启应用后不会有残留，因为那时的页面上本来就没有"上一套"可留）。

截图取自桌面版 0.1.7-rc.2 实机。图片用**绝对地址**引用而不是相对路径，是为了让同一份 README 在
GitHub、npm 与社区市场三处都能显示（npm 不会把相对路径解析到仓库）。原图在
[`screenshots/`](screenshots/) 下，不在 npm 包内（`package.json` 的 `files` 白名单只含运行必需文件）。

侧栏装饰还可以先看后装：仓库内的
[`tools/theme-bench/ambient-preview.html`](tools/theme-bench/ambient-preview.html) 以宽窄两种侧栏宽度
并排渲染全部皮肤（该页把 CSS 与场景标记直接读自 `lib/client.js`，不会与出货版本漂移）；
[`tools/theme-bench/panel-preview.html`](tools/theme-bench/panel-preview.html) 则渲染**面板本身的卡片顺序与文案**
—— 顺序表、内置卡文案、页面样式同样直接读自 `lib/client.js`。

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

## 入口在哪：左侧菜单区【插件】图标的下方，不是设置

| 位置 | 官方插槽 | 形态 |
|---|---|---|
| **本插件用这个** | `sidebar.panellist` + `main`（keyed，同一个 id） | 左栏一个图标 → 主区一整页主题卡片 |
| 备选（未用） | `sidebar.footer.action` | 齿轮旁的小图标 + 弹出气泡 |
| 备选（未用） | `settings.general.item` | 设置里一行按钮 |

选第一个的理由不只是位置好：**它正是这个应用的"插件"机制**——一个插件 = 侧栏一个入口 + 主区一个页面，和 `Plugins` 页同级。

而且侧栏入口是 `list` 插槽，**一个插件最多占一个座位**：这从机制上就否定了"每个皮肤一个插件"。

> `sidebar.footer.action` 同样是 `list`，一个插件也只有一个座位，且气泡里放不下预览。设置行则额外需要 settings 域——见下面的踩坑记录。

**打开方式**：在**左侧菜单区，【插件】图标的下方**点 **主题皮肤**（它与「插件」同为面板入口，就在其下一行），
主区显示全部可选主题，点卡片切换，选中态会记入设置。

---

## 安装

### 三种安装方式

**① 用包名安装（推荐）** —— 包已发布到 npm：<https://www.npmjs.com/package/dsh-theme-gallery>

1. **设置 → 插件 → 添加插件** → 填 **`dsh-theme-gallery`**
2. **重启应用**
3. **左侧菜单区【插件】图标的下方**出现 **主题皮肤** 入口（**不在**「设置 → 通用 → 外观」里，
   原因见下文），面板里是 **6 套皮肤 + 内置浅色/深色两张卡**（清单见页面顶部表格）

Web / CLI profile 用官方 CLI 装同一个包：

```sh
dsh plugin --profile web add dsh-theme-gallery
```

> 桌面版的 profile 由 Electron 独占，`dsh plugin --profile desktop …` 会被拒绝 ——
> 桌面用户请走上面的界面。

**② 下载构建产物**（不经过 npm 的等价方式，零构建授权）

1. 到 [Releases](https://github.com/renjie2026/dsh-theme-gallery/releases/latest) 下载 `dsh-theme-gallery-<版本>.tgz`
2. **设置 → 插件 → 添加插件** → 粘贴该文件的**完整路径**
3. **重启应用**

**③ 用仓库地址安装**（`github:renjie2026/dsh-theme-gallery`，拉的是**源码**，不推荐）

只在你想跟源码时用它。本包**没有构建步骤**，所以不会出现"缺 `lib/` 目录"那类失败；
它的代价是 pnpm 可能要求你为构建脚本授权（`allowBuilds`）。

### 更新到新版本

**先说清楚：DSH 桌面版本身不会提示第三方插件有更新**，所以「发现新版」和「执行更新」这两件事得靠下面的渠道。

**怎么知道有新版本？**

| 渠道 | 说明 |
|---|---|
| **插件市场** | 装 [DSH-Plugins-Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace) 后，卡片会显示 **「已装 v0.2.0 → v0.3.0」** 并给**更新**按钮 —— 目前最省事的路径 |
| **GitHub Releases** | 在本仓库点 **Watch → Custom → Releases only**，有新版本会收到邮件 |
| **对照版本号** | 插件面板右上角显示**你装的版本**（如 `v0.3.0`），与 [npm 页面](https://www.npmjs.com/package/dsh-theme-gallery) 上的版本号直接对照 |

**怎么更新？**

1. **设置 → 插件 → 添加插件** → 再填一次 `dsh-theme-gallery` → **重启**（装上 `^x.y.z` 范围内的最新版）
2. 想要**强制拿最新**（含 0.2.x → 0.3.0 这类次版本号变更）：**先移除、再添加**
3. 装了市场的：点卡片上的**更新**按钮
4. Web / CLI profile：`dsh plugin --profile web add dsh-theme-gallery`

**版本范围语义**：安装时会记录成 **`^0.2.0`**，即 `>=0.2.0 <0.3.0` ——
`0.2.1` 这类补丁会在重装时自动带上；**`0.3.0` 不会**（npm 对 `0.x` 的惯例是
把次版本号变更视为可能破坏性），那种情况按第 2 条显式重装即可。

> ⚠️ 从 **Release 的 `.tgz`** 安装的用户**没有更新机制**（tgz 是一次性快照，只能重新下载）——
> 想长期跟更新，建议用**包名安装**。

### 兼容性与权限

| 项 | 说明 |
|---|---|
| 平台 | DeepSeek Harness **桌面版 0.1.7-rc.2**（实测通过）；同为 web 客户端的 Web / CLI profile 理论可用，但本项目只实测过桌面版 |
| 网络 | **不联网** —— 插件半侧不发起任何请求 |
| 文件 | 包内只有 `lib/`、`schema/`、`cordis.patch.yml`（见 `package.json` 的 `files`），不读写用户文件 |
| 界面改动 | 只新增左侧菜单区一个面板入口（在【插件】图标下方）；官方「设置 → 通用 → 外观」那一行**保持原样**——面板里的浅色/深色卡只是调用官方偏好接口，不会往那一行塞任何东西 |
| 本地状态 | 皮肤选择存在 `localStorage`；主题偏好只写 `light`/`dark`/`system` |

### 装不上或想手动装

桌面 profile 由 Electron 独占，**CLI 会被拒绝**：

```
error: profile "desktop" is managed exclusively by the Electron application
```

那就手动改 profile 清单（这是官方 profile 的既定机制，不是 hack）：

```jsonc
// <DSH_HOME>/profiles/desktop/package.json
//   "dependencies":        { "dsh-theme-gallery": "^0.3.0" }
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

皮肤不只是配色，还把原系统**左侧菜单区的元素素材**复刻了过来，并给"正在使用"的状态加了标记色。

### 侧栏氛围装饰 `ambient`

| 皮肤 | 素材 |
|---|---|
| 山青婷彩 `kind: "shan"` | 青山两层 + 山间云雾 + 山脚水面与点水涟漪 + 两只悬停蜻蜓 + 花瓣飘落 |
| 梦海游鱼 `kind: "dream"` | 左上柔光辉 + 两道弥散光洗 + 上浮气泡 + 五叶水草摇摆 |
| 营慕彩云 `kind: "caiyun"` | 暮色暖光 + 暖金光点 + 三层模糊彩云 + 前后两层漂移云海 + 两只往返漫游的热气球 |
| 佩安杰心 `kind: "jiexin"` | 雾山远衬 + 禅意圆相与坐禅人影 + 香炉两缕青烟 + 浮尘光点 + 禅语「自在 · 安顿」 |
| 琥珀猫咪 `kind: "humao"`（原创） | 暖阳光晕 + 晒暖窗台 + 坐姿虎斑猫（摆尾 / 抖耳）+ 蜷卧酣睡猫（呼吸起伏 + 小 z）+ 阳光浮尘 |
| 虎子阿黄 `kind: "ahuang"`（原创） | 金色光晕 + 田埂 + 中黄田园犬（镰刀尾摇摆 / 歪头 / 铃铛项圈）+ 干草丛 + 缃色皮球 + 蒲公英绒毛 |

素材逐像素复刻自源系统对应的主题动画组件（`ShanQingTingCaiAnimation.vue`、
`DreamOceanAmbient.vue`、`YingMuCaiYunAnimation.vue`、`PeiAnJieXinAnimation.vue`）；`humao` / `ahuang`
两套为本插件**原创**绘制（同一条造色十步法，色相取自中国传统色库）。与原系统**有意偏离**两处：

1. **尺寸改为百分比 / em**。原系统写死 223px 侧栏宽；DSH 侧栏可拖拽，固定像素在窄侧栏会截断。
2. **`pointer-events:none` 且置于导航之下**。原系统文档记有一条 bug：不透明山形贴在侧栏底部会遮挡最下方菜单项。

`kind` 是**数据键而非素材路径**——插件只为它真正画得出的场景提供键，写错会在构建期失败，而不是运行时静默不画。

装饰挂在 `document.body` 上的全屏 `.dsh-amb-control` 图层里，场景盒再按侧栏几何绝对定位在图层内部——**图层与场景盒必须拆成两层**，这是本项目花了二十多轮才找到的结论（压在一个元素上时两种形态都不绘制）。这是本插件**唯一**直接操作外壳 DOM 的地方（侧栏没有装饰插槽，插槽组件会成为列的兄弟而非其背后的图层），因此单独隔离、整体 try/catch：**装饰是修饰，绝不能成为故障原因**。侧栏定位用三级回退，因为外壳类名是 CSS-module 哈希、不是稳定契约。

先看效果再装：`npm run preview:ambient` 生成的预览页**把 CSS 直接读自 `lib/client.js`**，因此不会与出货版本漂移；两种侧栏宽度并排。

### 激活标记 `accent`

侧栏条目与选中对话行在 DSH 里共同读取 `--dsw-alias-button-ghost-active-fill/-border/-hover`，所以 `accent` 叠加到这三个 token 上，**两者同时变成标记色**。

取值遵循来源项目《主题皮肤设计规范（第二区域）》第 123 / 118 行：**强调色取本皮肤第一区域的特征色，且禁止引入第一区域不存在的色相**。所以

| 皮肤 | 强调色 | 出处 |
|---|---|---|
| 山青婷彩 | `#E88BB0` | 蜻蜓粉 |
| 梦海游鱼 | `#FFD166` | 夕照金 |
| 营慕彩云 | `#FFB347` | 云霞琥珀 |
| 佩安杰心 | `#B4653A` | 赭陶 |
| 琥珀猫咪（原创） | `#CA6924` | 中国传统色「琥珀」 |
| 虎子阿黄（原创） | `#F0C239` | 中国传统色「缃色」 |

**不是所有主题一律粉**——那样恰好违反来源项目自己的规范。两条约束由代码强制：叠加**只对活跃主题**生效、切走即撤除；**不动 `brand-primary`**（否则链接、主按钮、状态徽标会被一起改掉）。

| 状态 | 判定 | 视觉 |
|---|---|---|
| **空对话态** | 会话里还没有消息 | 整屏铺满主题：左侧栏渐变 + Windows 顶部标题栏渐变 + 中间留白也是主题色 |
| **有对话态** | 出现消息后 | 正文套一层**提亮卡片**（默认 62% 不透明度 / 3px 模糊 / 640px 限宽），四周仍透出主题渐变；左侧栏与顶部**保持主题强度**，一眼可辨是哪个皮肤 |

### 配色选择器 `card`（纯色/拼色 一类）

到 0.3.0 为止，每张卡片都是**一条 6px 色带**，取色由代码从皮肤的 3 个 token 里挑
（`brand-primary` / `label-secondary` / `state-business-primary`），所以任何皮肤都不用额外写卡片信息。
一条色带只能表达"一套配色长什么样"，而这一类卡片要表达的是**"这里有多少套配色，点哪个换哪个"**。

所以新增了可选字段 `card.rows`（不写它就还是那条色带，九套场景皮肤一个字都没改）：
卡片上排 **15 个可点的色值按钮**，**5 + 5 + 5**：上两排是 **10 个纯色**方案，最后一排是 **5 个拼色**方案。

```jsonc
"card": {
  "rows": [
    { "kind": "solid", "schemes": ["p-xiang-se", "p-ju-huang", "p-tao-hong", "p-hai-tang-hong", "p-jiang-zi"] },
    { "kind": "solid", "schemes": ["p-song-bai-lu", "p-zhu-qing", "p-cang-qing", "p-dai-zi", "p-xuan-qing"] },
    { "kind": "clash", "schemes": ["p-shi-liu-jin", "p-bao-lan-jin", "p-qing-lian-jin", "p-song-hua-tao", "p-wu-jin"] }
  ]
}
```

**15 套配色不是 15 个主题。** 它们住在 [`lib/palette-schemes.json`](lib/palette-schemes.json)，由建期
内联进包里，但**不注册进主题服务**：所以官方「设置 → 通用 → 外观」的主题列表里不会多出 15 项，
面板头部的"N 款皮肤"也仍然是皮肤数。点一个按钮 = 把该方案的 token 层叠到整屏上，
所选方案记在 `localStorage`（`theme-gallery:palette`），**绝不**写进 `ui-theme.preference`。

| 规则 | 为什么 |
|---|---|
| 2 或 3 排，**最后一排必须是拼色** | 拼色排在最下方才读得出层级；放别处只会像画错了 |
| 一排 1–5 个按钮，等宽 | 5 个是卡片最小宽度（200px）下仍能读出 5 种颜色的上限，第 6 个只剩约 28px，会读成条纹 |
| 每个按钮**按宽度分带**：纯色格一条带占满；拼色格主色占 **2 份**、每个次色各占 **1 份** | 一眼看出"这一套谁占大头、旁边配了哪些色"。比值由数据算出来（一主一次 = 2/1、一主两次 = 2/1/1、一主四次 = 2/1/1/1/1），不是写死的；画法和点下去的效果取自**同一张表**，不可能对不上 |
| 每个次色相对主色的对比度 **≥ 2.5:1** | 次色带在最窄的卡片上只有几像素宽，明度接近时整条糊进主色里，**没有异常也没有日志**。实测反面样本：`碧色 #1BD1A5` 上的红点 1.14:1、`海棠红 #DB5A6B` 上的竹青 1.07:1 |
| 深色正文压在方案底色上 **≥ 7:1** | 15 套方案只写三四个色，其余 60 多个 token 由 `schemeTokens()` 派生；底色与正文的对比度是整屏的阅读下限 |
| 按钮填充色按对比度选（本色 + 深色字 / 本色 + 白字 / 压深后用白字） | 缃色、橘黄、桃红这类**亮色**做填充时白字只有 1.7–3.7:1，读不清。规则逐个候选试，尽量让按钮留在色库那个**名字色**上；石榴金显式指定用「胭脂」`#9D2933`（白字 7.50:1） |
| 15 套全部出自**中国传统色库** | `zerosoul/chinese-colors` 的 `src/assets/colors.json`，每套都写明「组 + id」出处（见 `source` 字段） |

**15 套色值一览**（`主色` = 纯色格那一整条带 / 拼色格的第 1 条带；`次色` = 拼色格其余各条带。
表由 `lib/palette-schemes.json` 直接生成，不手抄）：

| 位置 | 方案 | 主色 | 次色 | 色库出处 |
|---|---|---|---|---|
| 纯色 1 | 缃色 | `#F0C239` | — | 黄 1-9 缃色（浅黄色） |
| 纯色 2 | 橘黄 | `#FF8936` | — | 黄 1-5 橘黄（柑橘的黄色） |
| 纯色 3 | 桃红 | `#F47983` | — | 红 0-3 桃红（桃花的颜色） |
| 纯色 4 | 海棠红 | `#DB5A6B` | — | 红 0-4 海棠红（淡紫红色、较桃红色深一些） |
| 纯色 5 | 绛紫 | `#8C4356` | — | 红 0-9 绛紫（紫中略带红的颜色） |
| 纯色 6 | 松柏绿 | `#057748` | — | 绿 2-30 松花绿（松柏叶的墨绿） |
| 纯色 7 | 竹青 | `#789262` | — | 绿 2-3 竹青（竹子的绿色） |
| 纯色 8 | 苍青 | `#7397AB` | — | 苍 4-3 苍青 |
| 纯色 9 | 黛紫 | `#574266` | — | 蓝 3-12 黛紫（深紫色） |
| 纯色 10 | 玄青 | `#3D3B4F` | — | 黑 7-1 玄青（深黑色） |
| 拼色 1 | 石榴金 | `#F20C00` | `#FFFFFF` `#D6ECF0` `#EACD76` `#3DE1AD` | 红 0-5 石榴红 + 金银 8-0 赤金 + 绿 2-14 翡翠色；按钮族用红 0-11 胭脂（白字 7.50:1，而压在石榴红上只有 4.35:1） |
| 拼色 2 | 宝蓝·赤金 | `#4B5CC4` | `#F2BE45` `#EACD76` `#D9B611` `#FFFFFF` | 蓝 3-5 宝蓝（多和小面积纯黄色（金色）配合使用）+ 金银 8-0 赤金 |
| 拼色 3 | 青莲·金玉 | `#801DAE` | `#F2BE45` `#FFF143` `#3DE1AD` `#FFFFFF` | 蓝 3-19 青莲（偏蓝的紫色）+ 黄 1-0 鹅黄 + 绿 2-14 翡翠色 |
| 拼色 4 | 松花·桃粉 | `#BCE672` | `#C93756` `#057748` | 绿 2-31 松花色（嫩黄绿）+ 红 0-1 樱桃色 + 绿 2-30 松花绿 |
| 拼色 5 | 藏青·鹅黄 | `#2E4E7E` | `#F2BE45` `#FFFFFF` `#FFB3A7` `#3DE1AD` | 蓝 8-2 藏青（深蓝）+ 金银 8-0 赤金 + 精白 + 红 0-0 粉红 + 绿 2-14 翡翠色 |

> **两处按用户反馈改过色**（2026-09-26）：① 原「松花·桃粉」的主色是**松花绿 `#057748`**，
> 与纯色「松柏绿」撞脸（两张卡看着是同一个绿），于是那个墨绿**归给松柏绿**这一格，
> 「松花·桃粉」改用**松花色 `#BCE672`** 当主色、只配两个次色（画出来正是 2/1/1）；
> ② 原「乌金·翡翠」是拿玄色 `#622A1D` 当"乌"用，观感发闷，整条换成「**藏青·鹅黄**」。
> 色库里的「乌金」其实是 `#A78E44` 这个金褐色 —— 名字与用途对不上也是换掉它的原因之一。

### 出处与致谢

- **纯色/拼色卡片上的 15 个色值，全部取自「中国传统色库」项目（chinese-colors）**：
  <https://github.com/zerosoul/chinese-colors>
  —— 作者 **tristan**（GitHub [@zerosoul](https://github.com/zerosoul)），
  在线手册 <https://colors.ichuantong.cn>，许可 ISC。
  该项目把 170 个中国传统色的名字与色值整理成 `src/assets/colors.json`，
  **本插件只做取色与派生**（每套方案只挑三四个名字色，其余 token 由同一条造色规则算出来）；
  取色数据在 [`lib/palette-schemes.json`](lib/palette-schemes.json)，每套都带 `source`
  记着它在色库里的「组 + id」。色名与色值是作者整理的开源成果，
  **在此感谢作者 tristan 的整理与开源。**
- 七套**复刻**皮肤的场景与配色复刻自**蜂链商城**电商新零售系统管理后台的主题：
  <https://github.com/renjie2026/fenglianshop-open>（该项目的开发者就是本插件的作者）。
- 两套宠物主题（琥珀猫咪、虎子阿黄）与内置浅色/深色的卡片文案是本插件原创。

如果你是要**转载或再分发**本插件：色值本身请按上面那条一并保留出处与致谢；
复刻皮肤的场景素材请遵循蜂链商城仓库的许可。

**这一类卡片不印 `description`**：15 个按钮已经占满卡面，文字会把卡片挤爆。`description` 仍然必须非空 ——
它照 Schema 的定义只作 **tooltip**（`title`），也就是说这一类反而用回了字段本来的契约。
这条"不印正文"是**渲染分支的属性**，不是另一个开关（多一个 `text:false` 只会多一个能自相矛盾的状态），
由 `tests/check-card-order.mjs` 的源码断言与 `tests/check-boot-path.mjs` 的行为断言（含反证）共同钉住。

样本卡是 **`shi-liu-jin`**（序号 97，尚在打磨）：它是这 15 套里「石榴金」那一套的**锚主题** ——
卡片本体、`accent`（激活标记）与拼色按钮都由它承载。

**点「石榴金」那一格（拼色排第 1 格）与点其它 14 格走的是两条不同的路**，这不是疏漏而是刻意的：
它是锚主题**自己那套手工写好的 67 个 token**（`lib/themes/shi-liu-jin.json`，侧栏渐变、两层底、
正文、按钮族都在里面）—— 也就是最初那版"两排纯色 + 一排拼色"合起来的整套配色。所以点它**不叠**
配色层，屏幕上是皮肤自己的调色；其余 14 格才用 `main/ground/ink` + 次色派生出一整套 token 叠上去。
（早先没有区分：点石榴金也会派生一层，得到"相似但不等"的另一套颜色 —— 实机一眼就能看出
不是原版，已修，并由行为断言 + 反证 10 钉住。）

**它不配 `ambient`** —— 侧栏仍有自己的渐变，
只是上面不画任何素材；因此从一套**有素材**的皮肤切过来时，上一套的侧栏素材会**留在原处**
（与内置浅色/深色卡同样的"惊喜"行为，已确认**有意保留**：装饰不会因为换皮肤就消失，
只有切到另一套有素材的皮肤才会被替换）。

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
├── screenshots/          # README 里的实机截图（不进 npm 包）
├── tools/
│   ├── theme-bench/             # 视觉调参台 + 两套预览页（单文件 HTML）
│   ├── profile-skin.mjs         # skin:status / disable / enable / rollback
│   └── watch-renderer.mjs       # 采样 renderer 的 CPU 与内存（查自旋事故）
├── scripts/
│   ├── embed-themes.mjs          # 校验内置皮肤并内联进 client.js
│   ├── publish-check.mjs         # 发布前自检（含 README 与 lib/themes 一致性）
│   ├── build-ambient-preview.mjs # 生成侧栏素材预览页（CSS 读自 client.js）
│   ├── build-panel-preview.mjs   # 生成面板卡片顺序/文案预览页
│   ├── lib/card-rows.mjs         # 卡片色块（card.rows）的校验（建期与测试共用）
│   └── serve-bench.mjs           # 启动调参台
├── tests/                # 20 组校验（一个 *.mjs 文件一组；lib/ 是共用解析器）
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
pnpm run check     # tsc + npm test 的 20 组校验 + 内联皮肤 + 重建两个预览页
pnpm run bench     # 调参台
```

`pnpm run check` = `typecheck && test && embed-themes && preview:ambient && preview:panel`；`npm test` 的 **20 组**按职责分六类：

1. **`tsc`（exit 0）**：`types/*.ts` 用官方发布的真实类型包校验插槽注册契约、`defineStore` 座位形状、主题注册与 token 契约。
2. **契约与桩**：`check-schema`（真实 schemastery 解析 + **10 个反向用例**，含缺 `label`、缺 `description`、`reading.alpha` 越界）、`smoke-host`（**真机加载** `lib/index.js` 跑 `apply`，并守住 `inject` 清单与插槽门控）、`check-store-contract`（`handle.create()` 每次返回新实例）、`check-client-module`（bundle 形状、挂载失败必须可见）。
3. **启动安全与端到端引导**：`check-boot-safety`（`inject` 清单、无 `modifies` 环）、`check-boot-timing`、`check-boot-path`（桩里跑完整引导：上色确认、默认皮肤、点内置卡不被弹回、切内置主题后素材保留 —— 每条都带**反证**）。
4. **静态审计（含自检与变异反证）**：`check-declaration-order`、`check-tdz-order` + `check-tdz-logic`、`check-scope-reach` + `check-scope-reach-logic`、`check-undefined-calls`、`check-bounded-work`（有界工作量：指纹守卫、单一路径渲染、循环有截止）、`check-self-emit-guard` + `check-self-emit-guard-logic`（数出**全部**主题服务写入点）。
5. **主题与皮肤**：`check-theme-contribution`（贡献逻辑与幂等，并断言**注册的 token 必须是字符串**——成对对象会变成 `[object Object]`）、`check-card-order`（卡片顺序、内置卡文案、默认皮肤、色块排版 `card.rows`，含 **17 处变异反证**）、`check-ambient-render`（场景标记与关键帧）。
6. **介绍文字不落后于实际**：`check-copy-consistency-logic` —— 核对 README 的皮肤清单 / 数量 / 版本 / 入口说法、面板与预览页的计数口径、README 里写的校验组数，与 `lib/themes`、`package.json`、`lib/client.js` 一致（**10 处变异反证 + 1 个"正式发布一套皮肤必须全过"的对照组**）。发布自检 `npm run publish:check` 用同一份实现，所以"改了皮肤忘了改文案"会在发布前被拦住。

`scripts/embed-themes.mjs` 校验每套皮肤（形状 / id 唯一 / 双配色 / 12 必需 token / `reading`）后内联进 `lib/client.js`，幂等；两个预览页随后重建。

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

---

作者 & 维护：[renjie2026](https://github.com/renjie2026)
