---
description: "在现有会话输入区进行连续语音通话，支持麦克风采集、自动提交、回复播报与打断。"
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-voice-conversation

[English](README.md) | 中文

## 概述

通过会话输入区与当前智能体交谈，并在回复生成时收听播报。停顿会结束语句，并自动提交识别文字。通话沿用 Session 的模型、工具、权限与可见历史。开始通话需要麦克风权限和可选的豆包语音服务。

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

[语音通话组合包](../voice-conversation-bundle/README.zh.md)将此 Client 与 Host 语音服务组合。先关闭独立的[语音输入](独立的语音输入组合包)组合包，因为两者使用同一个输入区活动插槽。Client 从[语音目录](../voice-speech-doubao/README.zh.md#use-this-package)读取录音上限与合成偏好。

在输入区选择“开始语音通话”并授予麦克风权限。说完一句话后停顿即可提交。现有会话显示识别后的用户消息、智能体输出与工具审批。仅播报由本次通话语音提交触发的实时回复；单独输入的文字消息不会使其回复获得播报资格。

在设置 → 通用 → 语音通话中调整音色、语速、播放音量和说话检测；更多选项包含音高与语气。试听用草稿音色和音量朗读草稿文本，不保存偏好，也不添加 Session 消息。通话中试听会暂停麦克风输入和自动播报，结束后恢复通话，不取消智能体工作。应用通过可写 profile 配置保存 Host 音色和检测偏好，并单独保存此 Client 的播放音量；取消会丢弃草稿。从当前检出目录运行时，请使用组合包的[源码 profile 配置](../voice-conversation-bundle/README.zh.md#source-checkout)。

打断灵敏度越低，麦克风 RMS 阈值越高，需要更大声音才会触发。持续说话多久才触发默认为 `200` 毫秒，可设为 `0`–`1000` 毫秒；`0` 表示立即触发。两项设置同时影响自动起录与打断。检测器会保留候选语音，因此确认延迟不会丢掉语句开头。

回答过程中开口可停止播报，并请求取消正在运行的智能体轮次。下一条语音提交会等待该轮次停止。打断会移除本次通话仍在排队的语音输入，保留 Session 中其他待处理消息。如果取消失败，或无法确认自己的输入是否已经开始，通话结束，并提示先使用会话中的停止控件。取消不会撤销已完成的工具操作。

挂断会释放采集、播放与语音请求；已提交的智能体工作继续由普通 Session 控制。切换 Session、隐藏页面和卸载插件也会关闭通话。识别、合成、连接与提交错误会停止通话，并保留本地化的恢复建议。无法确认的提交不会自动重发；重试前先检查会话。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

插件挂载生成的语音 Remote，并贡献一个 `conversation.input.activity` 控件。每次通话保留其确切的 Session 绑定，并管理麦克风、事件订阅、请求取消与音频队列。AudioWorklet 采集单声道采样；语句检测输出有界的完整录音，再由 Host 返回转写。

识别文字沿用带请求标识的普通 Session 提交，不改变未发送的草稿。播放仅接纳对应语音请求轮次中的助手实时正文。分句保留未完成的尾部，合成流输出 PCM，WebAudio 维持语句顺序。不播报思考、工具输出与历史基线。失败或取消的尝试会丢弃尚未播放的语音；模型重试可能再次播报相同文字。

[通话控制器](src/client/call.ts)管理请求与取消顺序；[助手正文接纳](src/client/output.ts)管理实时回复选择；[音频模块](src/client/audio.ts)管理浏览器资源。Client 仅通过已声明的公开包导出导入其他包的能力。独立打包还需要自己的构建、测试与兼容的已发布依赖。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [语音通话组合包](../voice-conversation-bundle/README.zh.md)：按需启用的配置组合。
- [豆包语音](../voice-speech-doubao/README.zh.md)：凭据、合成音色与服务限制。
- [语音通话子系统](../../../docs/voice-conversation.zh.md)：临时音频与 Session 归属。

-----

<a id="model-experience"></a>
## 模型体验

### 识别后的用户消息

#### 模型可见内容

模型将去除首尾空白的 `VoiceTranscript.text` 作为现有 Session 中的普通 `user/message` 接收。插件不添加系统提示词、工具定义、原始录音、合成音频或播放状态。

#### Token 影响

每条已接纳的非空转写添加普通用户文字的 token，并触发 Session 的正常智能体工作。语音识别与合成不额外发起 LLM 请求。

#### KV 缓存影响

识别消息通过普通提交路径扩展现有 Session 历史。插件不改写更早的模型消息；Session 组装与配置的模型服务管理缓存复用。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 识别需要等待停顿或达到配置的语句时长上限；说话时不提供中间转写。语音检测依赖麦克风能量，背景噪声与外放回声可能意外触发提交或打断。
- 浏览器需要 AudioWorklet、WebAudio 和安全上下文中的麦克风访问。音频为临时数据，不能从 Session 历史回放。Host 凭据与服务资源需要单独配置。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
