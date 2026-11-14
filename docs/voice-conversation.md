# Voice conversation

English | [中文](voice-conversation.zh.md)

The experimental [voice conversation bundle](../../packages/experimental/voice-conversation-bundle/README.md) connects microphone input and spoken replies to the current Session. The [Host service](../../packages/experimental/voice-speech-doubao/README.md) owns Doubao recognition and synthesis; the [Client plugin](../../packages/experimental/client-ui-voice-conversation/README.md) owns capture, utterance detection, Session submission, and playback. The bundle remains opt-in.

## Speech operations

`VoiceSpeechCatalog` exposes the saved `VoicePreferences`, compatible `VoiceSpeaker` choices, synthesis sample rate, utterance silence and duration limits, microphone threshold, minimum sustained speech, and per-request text limit. Its optional `settingsNamespace` identifies the Host profile entry for Settings writes; it contains no credential values. Recognition and synthesis share the authenticated Remote transport with other Host services.

`VoiceTranscriptionRequest` carries one complete 16 kHz mono PCM16 WAV encoded as base64. `VoiceTranscript` returns the final recognized text; empty text means no recognized speech. Recording bytes and transcripts remain transient until the Client submits a recognized sentence through ordinary Session input.

`VoiceSynthesisRequest` carries one plain-text sentence and optional complete preview preferences. `VoicePreferences` selects a speaker, integer speech rate, integer pitch, and `VoiceStyle` delivery preset. Omitted preferences capture the saved Host selection at request start; explicit preferences affect only that request. Each `VoiceAudioChunk` carries base64 PCM16 little-endian mono samples at the catalog’s sample rate. A synthesis failure may follow earlier audio chunks; the call stops the failed stream and its queued audio without replaying that sentence, displays a warning until the next speech onset, and continues capture and later sentences. Playback failures still end the call.

Settings edits remain drafts until Apply saves the voice and detection fields to the current Host profile. Those fields update without replacing the speech service or changing accepted synthesis requests. Playback gain belongs to the Client’s separately persisted local settings. Preview text and audio remain outside Session history.

## Personal Agent and communication state

The bundle provides editable call guidance without registering a preset or replacing the current persona. The settings editor saves call rules while keeping unsaved drafts separate.

Before capture starts, the Client holds the authenticated `personalAgent/call` stream for its exact Session and waits for acknowledgement. Host context reports the current voice/text state for each model request and adds saved call instructions for every connected call. The normal runtime-context snapshot records this model-visible input. Multiple clients hold independent registrations; the final cancellation, disconnect, Session disposal, or Host disposal clears voice state. Restarted Hosts begin in text state. Channel changes neither submit user messages nor start or cancel Agent work; already dispatched model requests retain their input.

## Session and playback ownership

The call is bound to one Client instance and one Session. Recognized sentences use that Session’s existing model, tools, and approval policy. User text, Assistant replies, and tool activity follow the ordinary durable Session records; raw audio, microphone measurements, and playback position do not add Session events.

The Client synthesizes eligible live Assistant text sentence by sentence. Fragments without Unicode letters or numbers, such as standalone punctuation and Markdown markers, are discarded before synthesis. Reasoning, tool output, historical replay, and other Sessions’ replies are excluded. Existing Session follow streams remain responsible for live output and durable settlement.

## Interruption and disposal

Microphone speech must exceed the RMS threshold continuously for `minSpeechMs` before interruption begins. Lower sensitivity raises the threshold; `minSpeechMs` defaults to `200` ms and `0` triggers immediately. Capture retains the latest `1` second before onset and the candidate speech. Below-threshold frames reset only confirmation, preserving weak beginnings and brief gaps in this buffer. Short recording limits reduce the buffer to reserve onset confirmation and trailing silence; the total recording remains bounded by `maxUtteranceMs`. Confirmed speech during playback immediately stops queued audio and cancels synthesis. The Client removes its own voice input if it is still queued, requests cancellation of the current Agent turn, and waits for the Session to stop running before submitting the next sentence. Other pending Session input remains. If the call cannot confirm whether its input is queued or has started, it ends with cancellation recovery advice. Acceptance of a cancellation request is not evidence that tool work has already stopped, and completed external operations are not undone.

A settings preview pauses the call’s microphone admission and playback while retaining its playback position. The current unfinished recording is discarded. Preview completion or cancellation restores the same live call; it does not cancel Agent work or submit preview text as a message.

Hangup, Session replacement, and plugin disposal close call-owned microphone tracks, audio nodes, and provider requests. Hiding the page pauses microphone input and playback while retaining the call; returning resumes it. Late microphone grants and callbacks from a closed call cannot submit into a replacement Session. The speech Host bounds requests and cancels its own provider work when its contribution is withdrawn.

## Package integration

The Host exposes its generated Remote contribution and browser-safe types through declared package exports. The Client mounts that contribution and registers its call control in `conversation.input.activity`. The bundle selects these packages through a static profile patch; it neither modifies `agent-loop` nor adds a second Agent history.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../../README.md#deepseek-harness-integration), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../../README.zh.md#与-deepseek-harness-集成).

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

Types: [RemoteStream](typert.md)

Source: [`packages/experimental/voice-speech-doubao/src/index.ts`](../../packages/experimental/voice-speech-doubao/src/index.ts)
<!-- END GENERATED cordis-surface -->


## Call context and presets

The plugin no longer registers the `personal` preset or injects a base persona. Calls in any preset register their Session and inject saved `callPrompt` guidance into subsequent model requests. Hangup, disconnect, or unload withdraws the registration. The internal `personalAgent` API name is retained for client compatibility; legacy `basePreset` and `basePrompt` are ignored.
