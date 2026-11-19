# dsh-edit

适用于 DeepSeek Harness / DSH Desktop 的就地消息编辑

将鼠标悬停在你的任意消息上，点击铅笔图标，编辑文本，然后按 **更新** —— 该轮对话之前的历史记录将被重写，新的提示词将立即开始运行，**无需重新加载页面**。

## 功能特性

* **无缝更新：** 视图就地切换到新分支（`uiWorkspace.openSession`）—— 无需刷新整个页面，不会丢失滚动位置，没有闪烁
* **模型跟随输入框：** 编辑重跑的那一轮使用**输入框当前选中的模型**；如果输入框里的模型已经被删除，则自动回退到仍然可用的模型，而不是沿用历史里那个失效的 provider
* **更新按钮始终可点击：** 即使文本未更改，更新按钮仍保持启用状态 —— 点击它只会重新运行该消息（重新生成）
* **紧凑的按钮：** 取消/更新按钮组的尺寸与编辑框相匹配，而不是与撰写器相匹配（高度为 28 像素）
* **就地编辑：** 直接在聊天中修改任何过往消息
* **干净的分支：** 在目标轮次处分叉历史记录 // 无幽灵轮次，无损坏的日志
* **保留附件：** 图片和文件在编辑后完好无损
* **自动归档：** 被取代的会话将被隐藏到归档中，以保持侧边栏整洁
* **安全失败处理：** 如果视图无法自动切换，被取代的会话将被保留（不会被暗中归档），并在页面内联显示错误信息
* **DSH 原生：** 与当前激活的深色/浅色主题 token 融为一体
* **输入法安全：** 在选择拼音/汉字字符时不会触发提交
* **多语言：** 自动检测英文 // 中文 // 俄文

## 快捷键

* `Enter` // 提交（文本未更改时重新运行）
* `Shift + Enter` // 换行
* `Ctrl + Enter` // 快速提交
* `Escape` // 取消

## 安装 (DSH Desktop)

1. 打开 DSH Desktop 中的插件管理器，并导入此文件夹
2. 确保 `dsh-edit` 已启用
3. 重启/重新加载客户端一次（插件包将提供给浏览器客户端）

包名 `dsh-edit` 刻意与市场里的 `dsh-message-edit`、`dsh-plugin-message-edit` 区分开：本插件占用的是
`messageEditDesktop` 服务和命名空间，因此可以和它们共存而不冲突。同时安装时只有槽位优先级
最低的那个渲染器生效 —— 本插件注册在 `-2`，所以它的编辑器会压过内置渲染器（`0`）和
`dsh-prompt-edit`（`-1`）。

## 版本兼容（0.2.1-rc.5 起，前向兼容后续版本）

本版本在 **DSH Desktop 0.2.1-rc.5** 上验证，并且刻意写成对后续版本免维护的形式。

### 1. 清单不再精确钉版

`engines.dsh` 从精确的 `0.2.1-rc.3` 改成开放的 `>=0.2.1-rc.5`。DSH 在安装与启动时都会先用
`semver.satisfies(运行版本, engines.dsh, { includePrerelease: true })` 校验；写成下限范围后，
rc.6、0.2.2、0.3.x 乃至 1.x 都不再触发「插件与 dsh 版本不兼容」的拒绝，也就不会每次升级都要改清单。

### 2. 不再把宿主包写进 dependencies

`@deepseek-ai/dsh-typert-protocol` 与 `@deepseek-ai/cordis` 已从 `dependencies` 移除，
typert-protocol 改为 **可选 peerDependency**：

* pnpm 不会把可选 peer 装进 profile（安装后 `profiles/<name>/node_modules` 里只有本插件和 zod），
  因此不会出现旧副本遮蔽宿主同名包——那正是历史上 `sessions` 服务无法激活、启动即崩的根因。
* 运行时解析由 DSH 自己的 runtime resolution 负责，`import "@deepseek-ai/dsh-typert-protocol"`
  始终命中宿主当前那一份，插件不需要跟着 rc 版本改依赖。

### 3. 分叉交给宿主，接口缺失才回退

rc.5 的 `sessionController.fork({ sessionId, atSeq })` 已经原生实现了本插件的核心动作：观测会话、
按边界构造分叉种子、按父会话的 Agent preset 组合同样能力、继承会话模型、并把子会话挂到父会话所在工作区。
插件现在优先调用它，只在宿主没有这个命令时才回退到 `lib/compat.host.js` 里的等价实现
（`session/end-seed` 标记 + 未闭合工具调用的 `forked` 收尾事件 + `agents.create` 传 seed）。

这让最易随版本漂移的一层（种子格式、预设组合、工作区迁移、格式迁移预检）由宿主自己负责，
插件只保留「算编辑边界 + 发送改写后的消息 + 归档旧分支」这些与版本无关的逻辑。

### 4. 所有宿主能力都按能力探测

服务与方法一律先探测再调用（`ctx.get` + 方法存在性检查），任何一项缺失只会降级该能力：

* 标题：`sessionTitle.get(session)` 快照与旧的 `titleOf(session)` 都支持，取不到就跳过改名。
* 归档：优先 `archiveSession(id, { stopActivity: true })`（rc.5 要求在停止会话活动的前提下归档，
  否则会抛 `WorkspaceActiveSessionError`），失败再退回不带选项的调用，最后退回逐个 `detachSession`。
* 模型继承：原生分叉路径由宿主从会话投影继承；回退路径显式写入 `model/selection` 并带上 `agentOptions`。
* 取消旧会话：`agent.cancel({ kind: "user" })` 的收尾原因对象（裸字符串会让循环收尾时抛错）。

### 5. 客户端只依赖槽位契约

客户端只 `require("react")`，通过 `ctx.slots.inject("conversation.chat.node", ...)` 注册 `user` 与
`steering` 两个 key（priority `-2`），remote 走 `ctx.remote.$mount()`。槽位注册与 remote 挂载都有
try/catch 兜底，任一侧失败只会在控制台报错，不会拖垮整个插件的激活。

### 升级到新的 DSH 时

正常情况下什么都不用改。若某个未来版本删掉了这些能力，插件会自行降级或给出明确拒绝，
而不是在启动阶段把整个应用拖垮。真遇到问题时，先看 `%APPDATA%\@deepseek-ai\dsh-desktop\logs`
里的 host 日志与插件管理器日志。

### 启动失败排查

若 DSH 启动时报 `startup failed: N required plugin did not activate`，且等待服务的插件里
大量出现 `sessions`，通常是 profile 里残留了旧版官方包的副本：

```powershell
Get-ChildItem "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@deepseek-ai"
```

其中出现低于当前 DSH 版本的包（例如 rc.2 的 `dsh-session`）即为遮蔽源；删掉这些旧副本
（连同 `pnpm-lock.yaml`、`package.json` 里对它们的声明）后重启 DSH 即可。本插件自身不会往
profile 里装任何 `@deepseek-ai/*` 运行时包 —— 需要的那一个走可选 peer，由宿主运行时解析提供。

## 工作原理

1. 在编辑的轮次之前截断会话历史记录（宿主 `sessionController.fork({ atSeq })`）
2. 用你更新后的消息和附件在新分支上开始下一轮（原附件块原样保留）
3. 通过客户端的工作区服务就地显示该子会话（`uiWorkspace.openSession`）
4. 视图切换后，归档旧的会话分支

## 模型选择：为什么编辑要用输入框里的模型

### 问题

分叉出来的子会话会连同**分叉点之前的历史**一起继承，而历史里记录着当时用的模型。
宿主自己的 `AgentModel.current()` 取的是 `pending ?? lastUsed`：**已记录的选择优先于
Agent 参数**，所以子会话会继续跑那个「历史时刻」的模型。

于是会出现这样的场景：

1. 会话当时用的是 `opencode-go/deepseek-v4.1-flash`；
2. 你在设置里删掉了 `opencode-go` 的模型（它的 adapter 随之注销）；
3. 你在输入框里已经换成了别的模型，此时点「编辑」重跑；
4. 子会话继承了历史里的 `opencode-go` —— 而这个 provider 已经不存在了，于是报
   `no adapter registered for provider "opencode-go"`。

### 现在的行为

1. **客户端**把输入框模型座（composer model seat）当前显示的 provider/model 随编辑请求一起
   发送给宿主。没有这个服务时，回退到会话的 `modelSelection` 持久化投影。
2. **宿主**按「客户端上报 → 会话当前选择 → 部署默认」的顺序取候选。
3. 每个候选都用 **LLM 注册表**校验（`llm.listProviders()` / `llm.listModels()`）：
   已经被删掉的 provider 或模型会被跳过，落到下一个候选，而不是让这一轮直接失败。
4. 选定的路由以 `model/selection` 事件写进子会话 —— 这样「已记录的选择」就是新模型，
   它优先于种子继承来的旧选择，子会话的模型座也会显示同一个模型。
5. 所有候选都不可用时才失败，并给出明确错误，而不是 `NO_ADAPTER`。

> 只在「选定路由与子会话已经继承的路由不同」时才写入事件，避免无谓的日志噪音与多余的
> 「[model changed: ...]」提示。

## 热更新后的旧宿主

插件在 DSH 运行期间被重新安装时，宿主进程里仍然是启动那一刻加载的插件代码——
它的 `./typert` 描述符与 `resolve` 形参签名都是旧的——而浏览器端已经换成了新的
客户端包。此时点「更新」会报：

```
typert gateway: messageEditDesktop/resolve: args fields do not match the descriptor: unexpected "selection"
```

这时**重启 DSH** 即可（宿主代码只在启动时加载）。除此之外还有两层兜底：

1. 客户端识别到这个错误后会去掉 `selection` 参数重试一次，编辑仍然生效，只是这一轮
   沿用历史里记录的模型（旧宿主没有模型重定向逻辑）。
2. 宿主 `resolve` 的第四个形参刻意命名为 `selection`，因此在宿主加载不到本包的
   `./typert`、退化成「按方法签名反射」的弱描述符时，字段名依然和客户端一致，
   不会出现上面这个参数不匹配的错误。

## 许可证

MIT
