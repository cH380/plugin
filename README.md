# dsh-edit

适用于 DeepSeek Harness / DSH Desktop 的就地消息编辑

将鼠标悬停在你的任意消息上，点击铅笔图标，编辑文本，然后按 **更新** —— 该轮对话之前的历史记录将被重写，新的提示词将立即开始运行，**无需重新加载页面**。

## 功能特性

* **无缝更新：** 视图就地切换到新分支（`uiWorkspace.openSession`）—— 无需刷新整个页面，不会丢失滚动位置，没有闪烁
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
2. 确保 `dsh-message-edit-desktop` 已启用
3. 重启/重新加载客户端一次（插件包将提供给浏览器客户端）

包名刻意与市场里的 `dsh-message-edit`、`dsh-plugin-message-edit` 区分开：本插件占用的是
`messageEditDesktop` 服务和命名空间，因此可以和它们共存而不冲突。同时安装时只有槽位优先级
最低的那个渲染器生效 —— 本插件注册在 `-2`，所以它的编辑器会压过内置渲染器（`0`）和
`dsh-prompt-edit`（`-1`）。

## 版本兼容（DSH 0.2.1-rc.3）

当前版本针对 **DSH Desktop 0.2.1-rc.3** 构建与验证，`package.json` 用 `engines.dsh`
精确声明了 `0.2.1-rc.3`：DSH 在安装与启动时都会先校验该范围，版本不符时只给出明确的
拒绝并跳过本插件，而不是让插件在启动阶段把整个应用拖垮。

* 运行时只保留两个必须随宿主版本走的依赖：`@deepseek-ai/dsh-typert-protocol`（服务基类）
  与 `@deepseek-ai/cordis`，版本与 0.2.1-rc.3 内置版本一致。
* **刻意不再依赖 `@deepseek-ai/dsh-session`。** 该版本的 Host 已经内置它；插件如果把它
  作为依赖装进 profile，会在 `profile/node_modules` 里出现一份旧副本，遮蔽宿主自己的包，
  导致 `sessions` 服务无法激活、17 个插件集体等待、DSH 启动即崩。
  分叉种子改由 `lib/compat.host.js` 内置的等价实现（`session/end-seed` 标记 + 未闭合
  工具调用的 `forked` 收尾事件）生成，行为与宿主 `buildForkSeed` 一致。
* 编辑时停止旧会话使用的是 rc.3 的 `agent.cancel({ kind: "user" })` 收尾原因对象；
  rc.2 时代的裸字符串会让循环在收尾时抛错。
* 读取会话标题走 `sessionTitle.get(session)` 快照（rc.2 的 `titleOf` 保留为回退）。

升级到新的 DSH rc 时，只需要同步 `engines.dsh`、`@deepseek-ai/dsh-typert-protocol` 和
`@deepseek-ai/cordis` 三处版本，不要重新引入任何 `@deepseek-ai/dsh-*` 运行时依赖。

### 启动失败排查

若 DSH 启动时报 `startup failed: N required plugin did not activate`，且等待服务的插件里
大量出现 `sessions`，通常是 profile 里残留了旧版官方包的副本：

```powershell
Get-ChildItem "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\@deepseek-ai"
```

其中出现低于当前 DSH 版本的包（例如 rc.2 的 `dsh-session`）即为遮蔽源；删掉这些旧副本
（连同 `pnpm-lock.yaml`、`package.json` 里对它们的声明）后重启 DSH 即可。本插件自身只会
安装与宿主同版本的 `dsh-typert-protocol` 与 `cordis`，不会再引入其它 `@deepseek-ai/dsh-*`
运行时包。

## 工作原理

1. 在编辑的轮次之前截断会话历史记录
2. 使用你更新后的消息和附件生成一个干净的子会话
3. 通过客户端的工作区服务就地显示该子会话
4. 视图切换后，归档旧的会话分支

## 许可证

MIT
