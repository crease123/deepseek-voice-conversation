---
description: "在 Web 或 Desktop 中按需启用连续语音通话，使用豆包识别与合成对话并操控当前智能体。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-voice-conversation-bundle

[English](README.md) | 中文

## 概述

对当前智能体说话并收听回复，无需每句话后点击发送。通话使用豆包语音识别与合成，同时沿用 Session 的模型、工具和审批。本组合包按需启用，不在随包配置中激活。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

[语音插件](../voice-speech-doubao/README.zh.md#use-this-package)管理凭据与音色配置。开始通话前先在 Host 配置语音凭据；浏览器不会收到凭据值。模型凭据继续使用当前 Session 的配置。

启用本组合包前，先关闭[语音输入](独立的语音输入组合包)。两者都贡献到输入区唯一的活动插槽，不能同时启用。已有 Web profile 引用过时插件包名时，请先停用或修正该条目。

### 源码检出目录

<a id="source-checkout"></a>

先按[仓库指南](../../../README.zh.md#与-deepseek-harness-集成)构建匹配版本的 Harness 工作区。在 Harness checkout 的根目录创建一个名称尚未使用的自定义 Web profile；下文以 `voice-conversation` 为例：

```sh
pnpm dsh voice-conversation --from-default-profile web --dump-config
```

源码开发时，启动 profile 前先按照[仓库指南](../../../README.zh.md#构建本地-client-产物)构建本地 Client 产物。

仅首次执行这条初始化命令：`--from-default-profile` 会替换指定 profile 目录，包括已有补丁和依赖。编辑 `$DSH_HOME/profiles/voice-conversation/cordis.patch.yml`（默认为 `~/.dsh/profiles/voice-conversation/cordis.patch.yml`），在其中插入三个插件，并将 `/absolute/path/to/voice-call` 替换为当前检出目录的绝对路径：

```yaml
- insert:
    - id: voice-speech-doubao
      name: '/absolute/path/to/voice-call/packages/experimental/voice-speech-doubao/src/index.ts'
    - id: personal-agent
      name: '/absolute/path/to/voice-call/packages/experimental/personal-agent/src/index.ts'
    - id: client-ui-voice-conversation
      name: '/absolute/path/to/voice-call/packages/experimental/client-ui-voice-conversation/src/index.ts'
```

之后启动此 profile 时省略初始化参数：

```sh
pnpm dsh voice-conversation --no-open --port 0
```

打开终端打印的 URL。运行 `pnpm dsh voice-conversation --dump-config` 可只检查组合，不启动应用或模型请求；输出包含 `voice-speech-doubao` 和 `client-ui-voice-conversation`。将插入项放在 profile 自有补丁中，设置面板才能将偏好保存到该文件。仅由命令行 `--patch` 覆盖层插入的插件无法接受这些 profile 写入。浏览器部分仍需要工作区已构建的 Client 产物。可安装组合包通过[组合补丁](cordis.patch.yml)以包名声明相同的三个条目。

### 与智能体通话

新建会话时选择「个人 Agent」，在「设置 → 个人 Agent」编辑基础提示词和通话补充规则。通话连接先同步 Host 的 Session 状态，再接收第一句话；挂断或断线撤销状态，下次模型请求恢复文字规则，不额外发送聊天消息。

打开会话，从输入区开始通话并授予麦克风权限。每次停顿会结束当前语句，识别出的文字自动提交到该 Session。语音输入和已投递的定时提醒所触发的回复按句播放；任务变更通知保持静音。回复过程中开口会停止播报，并请求取消当前智能体轮次，再提交下一句话。工具继续遵循现有权限和审批提示。

在设置 → 语音通话中调整声音、播放与说话检测偏好。[Client 设置](../client-ui-voice-conversation/README.zh.md#use-this-package)支持通话中的草稿试听，不添加 Session 消息；应用后才保存偏好。

挂断会释放麦克风并停止语音请求。切换 Session 或卸载 Client 会关闭通话。隐藏页面时会暂停麦克风输入和播放，但保留通话；回到页面后恢复。取消轮次不会撤销已经完成的操作。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>维护者信息——点击展开</summary>

本组合包组合[豆包 Host 服务](../voice-speech-doubao/README.zh.md)和 [Client 通话控制器](../client-ui-voice-conversation/README.zh.md)。各包管理自己的行为；组合包不包含智能体循环或对话历史。插件通过已声明的包导出、带认证的 Remote 传输和已注册的会话插槽接入。

本仓库在一个工作区中维护 Host、Client 和组合包。组合包在本地使用 `workspace:*` 依赖；发布这些包时，需要将这些选择器替换为已发布的版本范围，并验证支持的 Harness 版本。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

[语音通话子系统](../../../docs/voice-conversation.zh.md) · [仓库说明](../../../README.zh.md) · [配置管理](../../../README.zh.md#与-deepseek-harness-集成)

-----

<a id="model-experience"></a>
## 模型体验

通过 Client 的普通 Session 提交间接产生影响；Client 管理识别后的用户文字，Session 的预设管理模型请求与工具访问。

#### KV 缓存影响

组合包不添加提示词章节。普通用户提交会扩展现有 Session 历史；语音音频与播放状态不进入模型上下文。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 识别服务在停顿后接收完整语句。连续通话不会在用户说话时展示增量转写。
- 语音使用云端服务，需要分别开通豆包 ASR 与 TTS 资源。麦克风访问需要受支持的浏览器安全上下文；外放可能误触发打断，建议使用耳机。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
