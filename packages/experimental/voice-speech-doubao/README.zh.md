---
description: "为语音通话配置 DeepSeek 与豆包语音识别和流式回复播报。"
kind: "package-reference"
---

# @deepseek-ai/dsh-voice-speech-doubao

[English](README.md) | 中文

## 概述

默认使用 DeepSeek 识别录制的语音并合成回复，也可切换为豆包。将这个可选包与语音通话组合包配合使用，即可免手动输入地与现有 Agent 连续交谈。语音凭据保留在 Host，音频仅用于当前请求。识别和合成使用所选厂商的资源，并按服务商规则计费。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

[语音通话组合包](../voice-conversation-bundle/README.zh.md) 将此包与浏览器控件组合；自定义组合可将此包与 Credentials 和 Typert 一起挂载。

在设置 → 语音通话中选择音色、语速和检测灵敏度；音高和语气位于更多选项中。试听使用当前草稿，不保存设置，也不产生 Session 消息。应用通过当前 Host profile 的可写配置保存音色和检测偏好；播放音量单独保存在 Client。请按组合包的[源码 profile 配置](../voice-conversation-bundle/README.zh.md#source-checkout)操作，确保这些写入能够生效。

```yaml
- id: voice-speech-doubao
  name: '@deepseek-ai/dsh-voice-speech-doubao'
```

通过[凭据服务](../../../README.zh.md#凭据) 配置凭据。`apiKeyEnv` 指定新版控制台语音 API Key 的引用名，默认为 `SPEECH_API_KEY`。该引用没有值时，`appIdEnv` 和 `accessTokenEnv` 指定旧版控制台应用 ID 和访问令牌的引用名，默认为 `SPEECH_APP_ID` 和 `SPEECH_ACCESS_TOKEN`。这些字段只填写引用名，不填写密钥。所选 ASR 和 TTS 资源必须已在同一语音账号下开通。

| 字段 | 默认值 | 含义 |
|---|---|---|
| `asrResourceId` / `ttsResourceId` | `volc.seedasr.sauc.duration` / `seed-tts-2.0` | 已向配置凭据授权的资源。 |
| `speaker` | `zh_female_xiaohe_uranus_bigtts` | 与 TTS 资源兼容的音色。 |
| `speechRate` / `pitch` / `style` | `0` / `0` / `natural` | 语速为 `-50` 到 `100` 的整数，音高为 `-12` 到 `12` 的整数，语气为 `natural`、`gentle` 或 `lively`。 |
| `sampleRate` | `24000` | 合成 PCM 采样率；识别始终使用 16 kHz。 |
| `timeoutMs` | `60000` | 每次识别或合成请求的总时限。 |
| `silenceMs` / `maxUtteranceMs` / `threshold` | `650` / `15000` / `0.012` | 浏览器静音断句、录音时长和 RMS 检测设置。 |
| `minSpeechMs` | `200` | 起录和打断前所需的持续说话时长，范围为 `0` 到 `1000` 毫秒，且不能超过 `maxUtteranceMs`；`0` 表示立即触发。 |
| `maxAudioBytes` / `maxTextLength` | `1048576` / `600` | WAV 字节数和每次文本请求 Unicode 码点数的上限。 |

语音通话[子系统说明](../../../docs/voice-conversation.zh.md)列出配置字段和接入行为。服务商 URL 必须使用 TLS，本地协议测试使用的回环 HTTP 或 WebSocket 地址除外。缺少凭据、无效输入、服务商错误和超时均返回带类型的 Remote 错误；此包不会自动重试或切换服务商。

音色选项包含小何 2.0、Vivi 2.0、云舟 2.0 和小天 2.0。部署配置的自定义音色仍可使用自然语气。温柔和活泼语气使用服务商指令，效果取决于文本。音色与检测字段更新时无需替换服务；每个合成请求开始时固定其偏好，因此已接纳的音频沿用原选择，后续语句使用保存后的值。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

经过身份验证的 `voiceSpeech` Remote 接收完整的标准 16 kHz 单声道 PCM16 WAV，并发送给所选 ASR 接口（DeepSeek 使用 multipart WAV，豆包使用 gzip 音频帧）。它返回识别文字，不激活 Agent。Client 通过普通 Session 消息提交文字，因此 Session 访问和工具权限继续由现有机制负责。

合成将每次请求中的句子发往单向 SSE 接口，并返回有界的 base64 PCM16 小端单声道音频块。它拒绝无效帧并要求服务商明确结束；输出后的失败会留下部分音频，调用者仍会收到错误。每次操作读取当前凭据、应用总时限并管理上游传输。调用者取消和插件卸载都会中止已接受的操作，并等待传输清理完成。

[index.ts](src/index.ts) 管理配置、Remote 调用、凭据和生命周期；[protocol.ts](src/protocol.ts) 管理 WAV 校验与服务商协议。此包仅导入公开的包导出，可在独立工作区中维护。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [语音通话组合包](../voice-conversation-bundle/README.zh.md)：可选组合。
- [语音通话子系统](../../../docs/voice-conversation.zh.md)：浏览器与 Session 行为。
- [凭据](../../../README.zh.md#凭据)：密钥引用和存储职责。

-----

<a id="model-experience"></a>
## 模型体验

无，因为此包只识别和合成临时音频，不构造模型请求。

#### KV 缓存影响

无直接影响；Agent 的普通文本消息决定模型历史。

## 已知限制与待办工作

<a id="known-limitations-and-deferred-work"></a>

- 完整话语录制结束后才开始识别，不提供中间识别结果或端到端音频模型。
- 音频不会保存为 Session 附件，也不提供回放。Base64 会增加传输开销。
- 服务可用性和资源权限需要使用真实账号验证；本地测试通过 HTTP 与 WebSocket 替身完成，不调用付费 API。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者上下文 — 点击展开</summary>

协议测试使用本地 HTTP 和 WebSocket 夹具。可选的[真实服务测试](tests/speech.e2e.ts)要求进程环境中设置 `DSH_VOICE_REAL_API=1`，并提供 `SPEECH_API_KEY` 或同时提供 `SPEECH_APP_ID` 和 `SPEECH_ACCESS_TOKEN`：

```sh
DSH_VOICE_REAL_API=1 node_modules/.bin/vitest run --config vitest.e2e.config.ts packages/experimental/voice-speech-doubao/tests/speech.e2e.ts
```

账号使用其他资源或音色时，设置 `SPEECH_ASR_RESOURCE_ID`、`SPEECH_TTS_RESOURCE_ID` 或 `SPEECH_TTS_SPEAKER`。该测试会发起付费服务请求；本地协议测试不能验证账号权限。

</details>

### 语音厂商与通话界面

ASR、TTS 默认使用 DeepSeek，复用 Host 凭据引用 `DEEPSEEK_API_KEY`，无需另配火山引擎凭据。语音设置可分别选择 DeepSeek 或豆包。DeepSeek 提供 Stella、Tide 两种音色，输出采样率为 24 kHz；语速、音调、风格仅对豆包生效。更换厂商后先应用再试听，并重新开始通话。豆包沿用 `SPEECH_API_KEY` 或应用 ID/Token 配置。服务端可配置接口地址和凭据引用，密钥不会进入浏览器偏好设置。

DeepSeek ASR 上传每段完整 WAV，TTS 通过 WebSocket 接收 PCM 并验证完成事件。通话期间隐藏文字编辑器并保留草稿，显示随麦克风实际 RMS 变化的五段单色声条，保留状态、警告与挂断操作。系统开启减少动态效果时禁用视觉动画。

可直接在语音通话设置中填写豆包 API Key，或旧控制台的 App ID 与 Access Token。点击应用后写入宿主凭据库；留空保留原值，取消会清空草稿，已保存的密钥不会回传或写入 profile 配置补丁。环境变量提供的凭据可能为只读。凭据先于普通偏好保存；后续写入失败时，已被接受的凭据仍会保留。
