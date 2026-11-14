---
description: "Configure DeepSeek and Doubao speech recognition and streaming spoken replies for voice conversations."
kind: "package-reference"
---

# @deepseek-ai/dsh-voice-speech-doubao

English | [中文](README.zh.md)

## Summary

Transcribe recorded speech and hear generated text through DeepSeek by default, with optional Doubao support. Use this optional package with the voice conversation bundle for hands-free conversations with the existing Agent. Speech credentials stay on the Host, and audio is transient. Recognition and synthesis use the selected provider resources and incur their provider charges.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The [voice conversation bundle](../voice-conversation-bundle/README.md) composes this package with its browser controls; custom compositions mount it alongside Credentials and Typert.

Open Settings → Voice conversation to choose a voice, speech rate, and detection sensitivity; pitch and delivery are under More options. Preview uses the current draft without saving or creating a Session message. Apply saves voice and detection preferences through the current Host profile’s writable configuration. Playback volume is stored separately in the Client. Follow the bundle’s [source profile setup](../voice-conversation-bundle/README.md#source-checkout) to keep these writes effective.

```yaml
- id: voice-speech-doubao
  name: '@deepseek-ai/dsh-voice-speech-doubao'
```

Configure credentials through the [credential service](../../../README.md#credentials). `apiKeyEnv` names the new-console speech API key reference and defaults to `SPEECH_API_KEY`. When that reference has no value, `appIdEnv` and `accessTokenEnv` name the old-console application and access-token references, defaulting to `SPEECH_APP_ID` and `SPEECH_ACCESS_TOKEN`. These fields contain reference names, never secret values. The selected ASR and TTS resources must be enabled for the same speech account.

| Field | Default | Meaning |
|---|---|---|
| `asrResourceId` / `ttsResourceId` | `volc.seedasr.sauc.duration` / `seed-tts-2.0` | Resources granted to the configured credentials. |
| `speaker` | `zh_female_xiaohe_uranus_bigtts` | Voice compatible with the TTS resource. |
| `speechRate` / `pitch` / `style` | `0` / `0` / `natural` | Integer speech rate from `-50` to `100`, integer pitch from `-12` to `12`, and `natural`, `gentle`, or `lively` delivery. |
| `sampleRate` | `24000` | Synthesis PCM rate; recognition always uses 16 kHz. |
| `timeoutMs` | `60000` | Overall deadline for one recognition or synthesis request. |
| `silenceMs` / `maxUtteranceMs` / `threshold` | `650` / `15000` / `0.012` | Browser silence, recording duration, and RMS detection settings. |
| `minSpeechMs` | `200` | Continuous speech required before recording and interruption, from `0` to `1000` ms and no longer than `maxUtteranceMs`; `0` triggers immediately. |
| `maxAudioBytes` / `maxTextLength` | `1048576` / `600` | Maximum WAV bytes and Unicode code points per text request. |

The [voice conversation subsystem](../../../docs/voice-conversation.md) documents the accepted fields and integration behavior. Provider URLs require TLS, except loopback HTTP or WebSocket addresses used for local protocol fixtures. Missing credentials, invalid input, provider errors, and deadlines produce typed Remote failures; the package performs no automatic provider retry or fallback.

The voice choices include Xiaohe 2.0, Vivi 2.0, Yunzhou 2.0, and Xiaotian 2.0. A deployment’s custom speaker remains available with natural delivery. Gentle and lively delivery use provider instructions whose effect depends on the text. Voice and detection fields update without replacing the service; synthesis captures its preferences when each request starts, so accepted audio keeps its original selection and later sentences use the saved values.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The authenticated `voiceSpeech` Remote accepts a complete canonical 16 kHz mono PCM16 WAV and sends it to the selected ASR endpoint (multipart WAV for DeepSeek, gzip-framed audio for Doubao). It returns recognized text without activating an Agent. The Client submits that text through ordinary Session messaging, so Session access and tool permissions retain their existing owners.

Synthesis sends each requested sentence to the unidirectional SSE endpoint and returns bounded base64 PCM16 little-endian mono chunks. It rejects malformed frames and requires explicit provider completion; a failure after output leaves partial audio and remains visible to the caller. Each operation resolves current credentials, applies its deadline, and owns its upstream transport. Caller cancellation and plugin disposal abort accepted operations and await transport cleanup.

[index.ts](src/index.ts) owns configuration, Remote calls, credentials, and lifetimes; [protocol.ts](src/protocol.ts) owns WAV validation and provider protocols. Only published package exports are imported, so the package can be maintained in an independent workspace.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Voice conversation bundle](../voice-conversation-bundle/README.md): optional composition.
- [Voice conversation subsystem](../../../docs/voice-conversation.md): browser and Session behavior.
- [Credentials](../../../README.md#credentials): secret references and storage ownership.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package transcribes and synthesizes transient audio without constructing model requests.

#### KV Cache effect

No direct effect; the Agent's ordinary text messages determine model history.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Recognition begins after a complete utterance is recorded; partial transcripts and end-to-end audio models are not exposed.
- Audio is not retained as a Session attachment or offered for replay. Base64 adds transport overhead.
- Provider availability and resource access require real-account verification; local tests use HTTP and WebSocket fixtures without paid API calls.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer context — click to expand</summary>

Protocol tests use local HTTP and WebSocket fixtures. The optional [real-provider test](tests/speech.e2e.ts) requires `DSH_VOICE_REAL_API=1` and either `SPEECH_API_KEY` or both `SPEECH_APP_ID` and `SPEECH_ACCESS_TOKEN` in the process environment:

```sh
DSH_VOICE_REAL_API=1 node_modules/.bin/vitest run --config vitest.e2e.config.ts packages/experimental/voice-speech-doubao/tests/speech.e2e.ts
```

Set `SPEECH_ASR_RESOURCE_ID`, `SPEECH_TTS_RESOURCE_ID`, or `SPEECH_TTS_SPEAKER` when the account uses different resources or a different voice. This test makes paid provider requests; local protocol tests do not verify account access.

</details>

### Speech providers and call view

ASR and TTS default to DeepSeek and reuse the Host credential reference `DEEPSEEK_API_KEY`. No separate Volcengine credentials are needed for DeepSeek. Voice settings select ASR and TTS independently between DeepSeek and Doubao. DeepSeek offers Stella and Tide at 24 kHz; rate, pitch, and delivery controls apply to Doubao only. Apply provider changes before previewing and restart active calls. Doubao retains its existing `SPEECH_API_KEY` or application/token configuration. Provider endpoints and credential references remain configurable on the Host; secrets never enter browser preferences.

DeepSeek ASR uploads each completed WAV utterance; TTS uses WebSocket PCM with explicit completion checks. The call view hides the text editor while preserving the draft, shows five compact monochrome bars responding to microphone RMS, and retains status, warnings, and hangup. Reduced-motion preferences disable visual motion.

Doubao credentials can be entered directly in Voice call settings: API key, or legacy App ID and Access token. Apply writes secrets to the Host credential store; blank inputs retain saved values, Cancel clears drafts, and saved values are never returned or stored in profile patches. Environment-supplied credentials may be read-only. Credentials are saved before ordinary preferences; if a later write fails, already accepted credentials remain saved.
