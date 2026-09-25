# 主题皮肤插件的启动安全约定

> 这份文件是给**以后修改本插件的人（以及 AI）**看的。
> 违反这里的任何一条，都可能让 **DeepSeek Harness 桌面端永远停在「Loading plugins...」**。

---

## 0. 动手之前：先切回默认皮肤

**改这个插件的代码之前，务必先把主题切回内置皮肤。** 原因不是代码改坏了会怎样，
而是**桌面端等所有插件的 fiber 落定才离开加载页**——一个 fiber 悬空就是全应用打不开，
而它**不抛异常、不写指向原因的崩溃日志**，排查成本极高。

```bash
cd D:\Ai\dsh\dsh-theme-gallery

npm run skin:status     # 看当前状态（只读，不改任何文件）
npm run skin:disable    # 停用插件 + preference 改回 system，并自动备份
#   ... 改代码、跑校验 ...
npm run skin:enable     # 重新启用（若 preference 非内置值会拒绝执行）
npm run skin:rollback   # 出问题就还原最近一次备份
```

`enable` 会在 `preference` 不是内置值（`light` / `dark` / `system`）时**直接拒绝**，
防止"上一次没收拾干净又被启用"。**`status` 是只读的，随时可以跑。**

---

## 1. 什么会让 fiber 悬空

桌面端启动流程会等每个插件落定。以下任一情况都会让它**永久 pending**：

| 情况 | 后果 |
|---|---|
| `inject` 数组里有一项**永远不会到达**的服务 | 该入口永久 pending |
| 同时"消费某服务"又用 `modifies` **反向声明依赖它** | 双方互相等待 → 死锁 |
| `apply` **同步抛错** | fiber 不落定 |
| `ctx.inject(..., cb)` 等待一个**本上下文拿不到**的服务 | 回调永不执行 |

### 实测过的两次真实故障

崩溃日志里出现过这两种形态（`%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log`）：

```
# 形态一：服务等不到
dsh-theme-gallery: pending (waiting for service: settingsScope)

# 形态二：入口未激活
dsh-theme-gallery: failed
```

**形态一的原因**：`lib/index.js`（服务端）用了

```js
ctx.inject(['settings'], (settingsCtx) => { settingsCtx.settings.register(...) })
```

但 `settingsScope` 是**客户端**服务（由 `@deepseek-ai/dsh-client-ui-theme` 在
`ctx.settingsScope.bind({namespace})` 时提供）。服务端模块**根本拿不到它**，
回调永不执行，fiber 永不落定。而且它注册的命名空间**从来没被任何代码读取过**
——纯粹的净风险。**已删除，`apply` 现在是空的同步函数。**

**形态二的原因**：`cordis.patch.yml` 声明了

```yaml
modifies:
  - id: ui-theme
    name: '@deepseek-ai/dsh-client-ui-theme'
```

而客户端 `inject` 里又有 `theme`（正是 `ui-theme` 提供的服务）。
`modifies` 是**顺序声明**，等于同时告诉加载器"我在 ui-theme 之后"（inject）
和"我在 ui-theme 之前"（modifies）→ **循环等待**。**已删除。**

---

## 2. 硬性规则

### 2.1 `inject` 只放官方静态组合一定提供的服务

当前 `exports.inject = ['slots', 'locale', 'theme']`，三个都由基础组合保证。

**绝对不要**往 `inject` 里加：`settings`、`settingsScope`、`configForms`、`remote`。
这些可能永远不到，加进去就是把"某个功能不可用"升级成"应用打不开"。
（官方 `ui-theme` 客户端自己也 inject 了 `settingsScope`，但**它本身就在静态组合里**，
位置不同，不要照抄它这一条。）

#### ⚠ "改成软依赖"不是出路 —— 已实测，别再试

为了彻底消除这个风险，曾把 `theme` 降级为软依赖（用 `ctx.inject([], cb)` 取服务，
`inject` 只留 `slots`）。**这条路走不通**：给一个**空 inject 列表**的上下文
**读不到任何服务**，`ctx.theme` 直接抛错，插件于是走了"服务不可用"分支 ——
用户在侧栏看不到「主题皮肤」入口，只看到一条服务不可用的提示。

**结论**：软依赖在这里不是更安全的选项，它只是把一个能工作的插件改成不能工作的。
真正的安全来自 2.2、2.3、2.4 —— 它们才对应历史上真实的挂死原因。

**`theme` 作为硬依赖是安全的，前提是同时满足 2.2 与 2.4。** 本机两个能正常工作的
第三方客户端插件都是这个形态：`dsh-theme-firefly` 的 `inject` 恰为 `['theme']`，
且 manifest 里声明了 `@deepseek-ai/dsh-client-ui-theme`。

### 2.1b manifest 必须声明 `dsh.client.inject`

两份清单**不是一回事，且都必须正确**：

| 位置 | 内容 | 含义 |
|---|---|---|
| `package.json` → `dsh.client.inject` | **模块 id**（`@deepseek-ai/...`） | 加载器**先加载哪些包** |
| `lib/client.js` → `exports.inject` | **服务名**（`theme`） | 代码运行时**向谁取服务** |

只声明后者时，没有任何东西保证"提供该服务的模块"被加载 —— fiber 会永远等一个
永不到来的服务，**且不写任何日志**（这是最难查的一类）。
当前声明：`["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-client-ui-theme"]`。

### 2.1c 必须声明 `exports.isPlugin = true`

缺少它时 web boot 记录为 `dsh-theme-gallery: failed`（"入口被求值但未激活"），
与 `pending`（等依赖）是两种不同形态。本机所有能工作的第三方客户端插件都声明了它。

### 2.2 不要对"自己消费其服务的那一行"声明 `modifies`

消费服务**只需要** `inject`——它已经保证顺序。
`modifies` 是给"我要改这一行的配置"用的，方向相反。两者同时出现就是环。

### 2.3 服务端那一半保持惰性

`lib/index.js` 的 `apply` 必须是**同步且不碰任何服务**的。
它现在只导出 schema（作为 `lib/themes/*.json` 的校验契约），运行时不做事。
**如果将来确实需要服务端服务，必须在包自己的组合里提供，
而不是在 `apply` 里等一个可能永远不到的服务。**

### 2.4 `apply` 必须包在 guard 里

```js
exports.apply = function apply(ctx) {
  try { applyGallery(ctx) } catch (error) { /* 报告并降级 */ }
}
```

插件是**增强**（一个皮肤），坏了也只是少个装饰，**不该让用户失去应用**。
失败会写成页面上的一条可见提示，而不是只进控制台。

### 2.5 皮肤 id 绝不写进 `preference`

官方主题服务只持久化内置值：

```js
setTheme(id) {
  if (id !== 'system' && !this.themes.some((t) => t.id === id))
    throw new Error(`theme "${id}" is not registered`);
  ...
  if (isThemePreference(id)) this.host.set('preference', id);   // 只对 light/dark/system
}
const THEME_PREFERENCES = ['light', 'dark', 'system'];
```

**这就是兜底机制本身，而且它比任何运行时代码都可靠**：
放进 `preference` 的永远是内置值 → 插件被禁用/卸载/挂载失败时，
下次启动读到的是内置偏好，**正常启动、只是回到默认皮肤**。
皮肤选择记在 `localStorage`（插件私有），插件不在就自然不再被读取。

> **不要手动把 `shan-qing-ting-cai` 写进 `cordis.patch.yml` 的 `preference`。**
> 那正好破坏这个兜底：启动时该 id 尚未注册，官方服务直接拒绝启动。

**为什么兜底不能写成"崩溃时自动切回默认主题"**：插件没加载起来，
就没有代码在运行，自然也执行不了任何恢复逻辑。
**安全只能放在配置契约里，不能放在代码里。**

### 2.6 装饰层只做增强，不参与启动链路

DOM 注入、`ResizeObserver`、重试循环，全部放在**可清理的 effect** 里；
首帧失败要静默降级，**不能 throw**。

### 2.7 启动测量不要依赖固定延时

`120 / 400 / 900ms` 那套不可靠——外壳挂载侧栏晚于它。
要用 **`ResizeObserver` + "几何稳定"判定**（`repeatUntilStable`），
并保证窗口缩放后重算真正生效（含**侧栏节点被替换时改绑观察器**）。

---

## 3. 发布前必须做的事

```bash
npm run check        # 类型 + 9 组校验 + 内嵌主题 + 预览
npm run skin:status  # 确认 preference 是内置值
```

**最小组合验证**：官方基础包 + 本插件单独跑通，**再加装其它第三方插件复测**。
本次故障正是"各自能跑、组合起来才死"。

---

## 4. 排查口诀

停在「Loading plugins...」时：

1. 先看 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-web-boot.log`
2. **日志里什么都没有却一直卡住 → 基本就是某个 fiber 悬空（pending）**，
   往 **inject 依赖** 和 **循环等待** 上找
3. **不要**往模型 / 网络配置上找——那是最容易走错的方向
4. 恢复：`npm run skin:disable`，或 `npm run skin:rollback`

---

## 5. 这些约定已被自动校验

`tests/check-boot-safety.mjs`（33 条断言）覆盖：

- 补丁里**没有** `modifies`
- 服务端 `apply` **同步且惰性**，不含 `ctx.inject` / `.register`
- `inject` **恰为** `slots` / `locale` / `theme`，且**不含** `settings`、`settingsScope`、`configForms`、`remote`
- `apply` 有 guard、失败会写页面提示、报告本身不会抛
- 皮肤 id 只进 `localStorage`，**不写 `preference`**
- 装饰 effect 可清理（`disconnect()` / `settling.stop()`）

**已验证有效**：把 `modifies` 加回补丁、或把皮肤 id 写进 `preference`，
对应断言**立刻失败**。

`tests/smoke-host.mjs` 与 `tests/check-declaration-order.mjs` 也在守同一件事。
