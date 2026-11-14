# 语音通话

[English](voice-conversation.md) | 中文

实验性[语音通话组合包](../../packages/experimental/voice-conversation-bundle/README.zh.md)将麦克风输入与语音回复接入当前 Session。[Host 服务](../../packages/experimental/voice-speech-doubao/README.zh.md)管理豆包识别与合成；[Client 插件](../../packages/experimental/client-ui-voice-conversation/README.zh.md)管理采集、语句检测、Session 提交和播放。组合包按需启用。

## 语音操作

`VoiceSpeechCatalog` 提供保存的 `VoicePreferences`、兼容的 `VoiceSpeaker` 选项、合成采样率、语句静音时长与总时长上限、麦克风阈值、最短持续说话时长，以及每次请求的文字上限。可选的 `settingsNamespace` 标识 Settings 写入使用的 Host profile 条目，不包含凭据值。识别与合成复用其他 Host 服务使用的带认证 Remote 传输。

`VoiceTranscriptionRequest` 携带以 base64 编码的完整 16 kHz 单声道 PCM16 WAV。`VoiceTranscript` 返回最终识别文字；空文字表示未识别出语音。录音字节与转写结果均为临时数据，直到 Client 通过普通 Session 输入提交识别出的语句。

`VoiceSynthesisRequest` 携带一个纯文本语句和可选的完整试听偏好。`VoicePreferences` 选择音色、整数语速、整数音高和 `VoiceStyle` 语气预设。省略偏好时，请求开始时固定保存的 Host 选择；显式偏好仅影响该请求。每个 `VoiceAudioChunk` 携带以 base64 编码的 PCM16 小端单声道采样，采样率由目录指定。合成可能在部分音频块已输出后失败；通话会停止失败的流及其排队音频，不重播该句，显示警告直到下次开口，并继续采集和后续语句。播放错误仍会结束通话。

设置编辑保持为草稿，直到应用将音色和检测字段保存到当前 Host profile。这些字段更新时无需替换语音服务，也不改变已接纳的合成请求。播放增益属于 Client 单独持久保存的本地设置。试听文本与音频不进入 Session 历史。

## 个人 Agent 与交流状态

组合包提供可编辑的通话规则，不再注册预设或替换当前会话人设。Client 编辑器将草稿与已保存的通话规则分开。

采集开始前，Client 为确切的 Session 保持带认证的 `personalAgent/call` 流，并等待确认。Host 上下文在每次模型请求中报告当前语音或文字状态，为所有已连接的通话追加已保存的通话要求。普通运行时上下文快照会记录这份模型可见输入。多客户端各自持有独立登记，最后一条登记取消、断线、Session 释放或 Host 释放后撤销语音状态；Host 重启以文字状态开始。状态变化不提交用户消息，不启动或取消 Agent 工作；已经分派的模型请求保留原输入。

## Session 与播放归属

通话绑定一个 Client 实例和一个 Session。识别出的语句使用该 Session 现有的模型、工具和审批策略。用户文字、助手回复与工具活动沿用普通的持久 Session 记录；原始音频、麦克风测量与播放位置不添加 Session 事件。

Client 按句合成符合条件的助手实时正文，不包含思考、工具输出、历史回放或其他 Session 的回复。不含 Unicode 字母或数字的片段（如单独的标点和 Markdown 标记）会在合成前被丢弃。现有 Session 跟随流继续管理实时输出与持久记录的结算。

## 打断与释放

麦克风语音必须持续超过 RMS 阈值达到 `minSpeechMs` 后，才会触发打断。灵敏度越低，阈值越高；`minSpeechMs` 默认为 `200` 毫秒，`0` 表示立即触发。采集会保留起音前最近 `1` 秒及候选语音。低于阈值的帧只重置确认计时，弱音开头和短暂停顿仍会保留在缓冲中。录音上限较短时，会缩短缓冲，为起音确认和结尾静音预留时长；录音总时长仍受 `maxUtteranceMs` 限制。播放时确认用户说话后，会立即停止排队音频并取消合成。Client 会移除自己仍在排队的语音输入，请求取消当前智能体轮次，并等待 Session 停止运行后再提交下一句话。Session 中其他待处理输入会保留。如果无法确认自己的输入仍在排队还是已经开始，通话会结束并显示取消操作的恢复建议。取消请求被接受不表示工具工作已经停止，也不会撤销已完成的外部操作。

设置试听会暂停通话的麦克风输入和播放，并保留播放位置；当前未完成的录音会被丢弃。试听完成或取消后恢复同一个仍然活动的通话，不取消智能体工作，也不将试听文本提交为消息。

挂断、替换 Session 和释放插件会关闭本次通话拥有的麦克风音轨、音频节点和服务请求。隐藏页面时会暂停麦克风输入和播放，但保留通话；返回页面后恢复。通话关闭后才返回的麦克风授权与回调不能向替换后的 Session 提交内容。语音 Host 对请求施加上限，并在其贡献被撤销时取消自己拥有的服务工作。

## 包集成

Host 通过已声明的包导出提供生成的 Remote 贡献和浏览器安全类型。Client 挂载该贡献，并在 `conversation.input.activity` 注册通话控件。组合包通过静态配置补丁选择这些包；它不修改 `agent-loop`，也不添加第二套智能体历史。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../../README.zh.md#与-deepseek-harness-集成), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../../README.zh.md#与-deepseek-harness-集成).

<a id="ctxvoicespeech--voicespeechdoubao"></a>

### `ctx.voiceSpeech` — `VoiceSpeechDoubao`

Speech audio is transient; the Client owns ordinary Session text submission.

```ts cordis-catalog
/**
 * Read recording and playback preferences without starting provider requests.
 * @param signal - caller cancellation for this Remote request.
 * @returns safe browser settings; credential values are never included.
 */
@Remote catalog(signal: AbortSignal): VoiceSpeechCatalog

/**
 * Transcribe one complete WAV recording without submitting to an Agent.
 * @param request - canonical base64 16 kHz mono PCM16 WAV.
 * @param signal - caller cancellation; settlement waits for transport cleanup.
 * @returns final recognized text, empty when no speech was recognized.
 */
@Remote async transcribe(request: VoiceTranscriptionRequest, signal: AbortSignal): Promise<VoiceTranscript>

/**
 * Stream consecutive PCM16 little-endian mono audio chunks for one sentence.
 * @param request - plain text with optional one-request preview preferences.
 * @param signal - caller cancellation; stops and joins the upstream request.
 * @returns base64 audio chunks; a failure after output leaves partial audio.
 */
@Remote({ mode: 'stream' }) async *synthesize(request: VoiceSynthesisRequest, signal: AbortSignal): RemoteStream<VoiceAudioChunk>
```

Types: [RemoteStream](typert.zh.md)

Source: [`packages/experimental/voice-speech-doubao/src/index.ts`](../../packages/experimental/voice-speech-doubao/src/index.ts)
<!-- END GENERATED cordis-surface -->


## 通话上下文与预设

语音插件不再注册 `personal` 预设或注入基础人设。在任何预设的会话中，开启通话会登记当前 Session，后续模型请求注入已保存的 `callPrompt`；挂断、断连或卸载时撤回。内部 `personalAgent` 接口名称为兼容现有客户端保留，旧 `basePreset`、`basePrompt` 不再生效。
