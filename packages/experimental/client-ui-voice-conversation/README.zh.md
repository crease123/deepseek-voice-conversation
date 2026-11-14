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

在输入区选择“开始语音通话”并授予麦克风权限。说完一句话后停顿即可提交。现有会话显示识别后的用户消息、智能体输出与工具审批。播报由本次通话语音提交触发的实时回复和已投递的定时提醒回复。任务变更通知以及单独输入的文字消息所触发的回复保持静音。

新建会话时选择「个人 Agent」，即可使用独立身份提示词和通话规则。在「设置 → 个人 Agent」分别编辑两层提示词，并查看已保存规则。草稿不会影响 Agent，保存从下一次模型请求生效；外部编辑冲突后，取消会重新加载最新保存值。

在设置 → 语音通话中调整音色、语速、播放音量和说话检测；更多选项包含音高与语气。试听用草稿音色和音量朗读草稿文本，不保存偏好，也不添加 Session 消息。通话中试听会暂停麦克风输入和自动播报，结束后恢复通话，不取消智能体工作。应用通过可写 profile 配置保存 Host 音色和检测偏好，并单独保存此 Client 的播放音量；取消会丢弃草稿。从当前检出目录运行时，请使用组合包的[源码 profile 配置](../voice-conversation-bundle/README.zh.md#source-checkout)。

打断灵敏度越低，麦克风 RMS 阈值越高，需要更大声音才会触发。持续说话多久才触发默认为 `200` 毫秒，可设为 `0`–`1000` 毫秒；`0` 表示立即触发。两项设置同时影响自动起录与打断。检测器会保留起音前最近 `1` 秒及候选语音；弱音和短暂停顿只重置确认计时，不会清空这份缓冲。如果配置的录音上限较短，会相应缩短缓冲，为起音确认和结尾静音预留时长。暂停采集或完成一句录音会清空缓冲。

回答过程中开口可停止播报，并请求取消正在运行的智能体轮次。下一条语音提交会等待该轮次停止。打断会移除本次通话仍在排队的语音输入，保留 Session 中其他待处理消息。如果取消失败，或无法确认自己的输入是否已经开始，通话结束，并提示先使用会话中的停止控件。取消不会撤销已完成的工具操作。

挂断会释放采集、播放与语音请求；已提交的智能体工作继续由普通 Session 控制。切换 Session 和卸载插件会关闭通话。隐藏页面时会暂停麦克风输入和播放，但保留通话；回到页面后恢复。合成失败会跳过该句并显示警告，采集与后续回复继续；再次开口后清除警告。识别、播放、连接与提交错误会停止通话，并保留本地化的恢复建议。无法确认的提交不会自动重发；重试前先检查会话。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

插件挂载生成的语音 Remote，并贡献一个 `conversation.input.activity` 控件。每次通话保留其确切的 Session 绑定，并管理麦克风、事件订阅、请求取消与音频队列。AudioWorklet 采集单声道采样；语句检测输出有界的完整录音，再由 Host 返回转写。

识别文字沿用带请求标识的普通 Session 提交，不改变未发送的草稿。播放接纳对应语音请求轮次以及已投递定时提醒轮次中的助手实时正文；后者通过 Schedule 来源和提醒前缀识别。任务变更通知、单独输入的文字消息、工具输出、思考内容和历史基线都不会播报。分句保留未完成的尾部，并丢弃不含 Unicode 字母或数字的片段，包括单独的标点、Markdown 标记和表情。合成流输出 PCM，WebAudio 维持语句顺序。失败或取消的尝试会丢弃尚未播放的语音；模型重试可能再次播报相同文字。

[通话控制器](src/client/call.ts)管理请求与取消顺序；[助手正文接纳](src/client/output.ts)管理实时回复选择；[音频模块](src/client/audio.ts)管理浏览器资源。Client 仅通过已声明的公开包导出导入其他包的能力。运行 `pnpm run test:voice-output` 可执行仓库中的定向播报测试。运行 `pnpm exec vitest run --config scripts/vitest.config.mts` 可执行 Client 测试；若匹配的 Harness checkout 不在相邻的 `deepseek-harness` 目录，需设置 `DSH_HARNESS_ROOT`。

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

### 语音厂商与通话界面

ASR、TTS 默认使用 DeepSeek，复用 Host 凭据引用 `DEEPSEEK_API_KEY`，无需另配火山引擎凭据。语音设置可分别选择 DeepSeek 或豆包。DeepSeek 提供 Stella、Tide 两种音色，输出采样率为 24 kHz；语速、音调、风格仅对豆包生效。更换厂商后先应用再试听，并重新开始通话。豆包沿用 `SPEECH_API_KEY` 或应用 ID/Token 配置。服务端可配置接口地址和凭据引用，密钥不会进入浏览器偏好设置。

DeepSeek ASR 上传每段完整 WAV，TTS 通过 WebSocket 接收 PCM 并验证完成事件。通话期间隐藏文字编辑器并保留草稿，显示随麦克风实际 RMS 变化的五段单色声条，保留状态、警告与挂断操作。系统开启减少动态效果时禁用视觉动画。

“语音通话”是设置左侧的独立选项，点击即可直接配置语音厂商、音色、试听和说话检测，无需进入通用设置或打开二级弹窗。

可直接在语音通话设置中填写豆包 API Key，或旧控制台的 App ID 与 Access Token。点击应用后写入宿主凭据库；留空保留原值，取消会清空草稿，已保存的密钥不会回传或写入 profile 配置补丁。环境变量提供的凭据可能为只读。凭据先于普通偏好保存；后续写入失败时，已被接受的凭据仍会保留。
