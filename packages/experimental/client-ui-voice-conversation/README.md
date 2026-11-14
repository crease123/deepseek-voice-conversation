---
description: "Continuous voice calls in the existing conversation composer, including microphone capture, automatic submission, spoken replies, and interruption."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-voice-conversation

English | [中文](README.zh.md)

## Summary

Talk to the current agent through the conversation composer and hear its replies as they arrive. Pauses end utterances and submit recognized text automatically. The call keeps the Session’s model, tools, permissions, and visible history. Starting a call requires microphone access and the optional Doubao speech service.

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

The [voice conversation bundle](../voice-conversation-bundle/README.md) pairs this Client with its Host speech service. Disable the separate [Voice input](the separate Voice input bundle) bundle first because both use the same single composer activity slot. The Client reads recording limits and synthesis preferences from the [speech catalog](../voice-speech-doubao/README.md#use-this-package).

Choose Start voice call in the composer and grant microphone access. Speak a sentence and pause to submit it. The existing conversation displays the recognized user message, Agent output, and any tool approval. Live replies to this call’s voice submissions and delivered scheduled reminders are spoken. Schedule-change notices and replies to separately typed messages remain silent.

Select Personal Agent when starting a new conversation to use its own persona and call rules. Settings → Personal Agent edits both prompts, with a read-only preview of saved rules. Draft changes do not affect the Agent. Saving applies at the next model request; Cancel reloads the latest saved values after an external edit conflict.

Open Settings → Voice conversation to edit the voice, speech rate, playback volume, and speech detection. More options contains pitch and delivery. Preview speaks the draft text with the draft voice and volume; it neither saves preferences nor adds a Session message. During a call, preview pauses microphone admission and automatic playback, then restores the call without cancelling Agent work. Apply saves Host voice and detection preferences through writable profile configuration and separately stores this Client’s playback volume; Cancel discards the draft. Use the bundle’s [source profile setup](../voice-conversation-bundle/README.md#source-checkout) when running from this checkout.

Lower interruption sensitivity raises the microphone RMS threshold and requires louder speech. Continuous speech before triggering defaults to `200` ms and accepts `0`–`1000` ms; `0` triggers immediately. Both settings control automatic recording and interruption. The detector retains the latest `1` second before speech onset together with the candidate speech; weak audio and brief gaps reset confirmation without clearing this buffer. The buffer is shortened when necessary to reserve onset confirmation and trailing silence within the configured recording limit. Pausing capture or completing an utterance clears it.

Speak during an answer to stop playback and request cancellation of the running Agent turn. The next voice submission waits for that turn to stop. Interruption removes this call’s own voice input if it is still queued; other pending Session messages remain. If cancellation fails or the call cannot confirm whether its input has started, the call ends and asks you to use the conversation’s Stop control. Cancellation does not undo completed tool operations.

Hang up releases capture, playback, and voice requests; already submitted Agent work remains under ordinary Session control. Session changes and plugin unloading close the call. Hiding the page pauses microphone input and playback while retaining the call; returning to the page resumes it. A synthesis failure skips that sentence and shows a warning while capture and subsequent replies continue; the warning clears when you speak again. Recognition, playback, connection, and submission errors stop the call and leave localized recovery advice. An unconfirmed submission is not automatically resent; inspect the conversation before retrying.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin mounts the generated speech Remote and contributes one `conversation.input.activity` control. One call retains its exact Session binding and owns its microphone, event subscriptions, request cancellation, and audio queue. AudioWorklet capture produces mono samples; utterance detection emits a bounded complete recording, and the Host returns its transcript.

Recognized text follows ordinary identified Session submission without changing the unsent draft. Playback admits live Assistant text from the corresponding voice-request turns and from delivered scheduled reminders, identified by their Schedule source and reminder prefix. Schedule-change notices, separately typed messages, tool output, reasoning, and history baselines are excluded. Sentence splitting keeps an unfinished suffix and drops fragments containing no Unicode letters or numbers, including standalone punctuation, Markdown markers, and emoji. Synthesis streams PCM, and WebAudio preserves sentence order. Failed or cancelled attempts discard unplayed speech; a model retry can speak text again.

The [call controller](src/client/call.ts) owns request and cancellation ordering; [Assistant admission](src/client/output.ts) owns live-reply selection; [audio](src/client/audio.ts) owns browser resources. The Client imports sibling functionality only through declared public package exports. Run the repository’s focused output test with `pnpm run test:voice-output`. Run the Client tests with `pnpm exec vitest run --config scripts/vitest.config.mts`; set `DSH_HARNESS_ROOT` when the matching Harness checkout is not the adjacent `deepseek-harness` directory.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Voice conversation bundle](../voice-conversation-bundle/README.md): opt-in profile composition.
- [Doubao speech](../voice-speech-doubao/README.md): credentials, synthesis voice, and provider limits.
- [Voice conversation subsystem](../../../docs/voice-conversation.md): transient audio and Session ownership.

-----

<a id="model-experience"></a>
## Model Experience

### Recognized user messages

#### What the model sees

The model receives trimmed `VoiceTranscript.text` as an ordinary `user/message` in the existing Session. The plugin adds no system prompt, tool schema, raw recording, synthesis audio, or playback state.

#### Token effect

Each nonempty accepted transcript adds its ordinary user-text tokens and starts the Session’s normal Agent work. Speech recognition and synthesis add no separate LLM request.

#### KV Cache effect

Recognized messages extend existing Session history through the ordinary submission path. The plugin does not rewrite earlier model messages; Session assembly and the configured model provider own cache reuse.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Recognition waits for a pause or the configured utterance limit; partial transcripts while speaking are unavailable. Voice detection uses microphone energy, so background noise and loudspeaker echoes can trigger unintended submissions or interruptions.
- Browsers need AudioWorklet, WebAudio, and secure-context microphone access. Audio is transient and cannot be replayed from Session history. Host credentials and provider resources require separate configuration.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

### Speech providers and call view

ASR and TTS default to DeepSeek and reuse the Host credential reference `DEEPSEEK_API_KEY`. No separate Volcengine credentials are needed for DeepSeek. Voice settings select ASR and TTS independently between DeepSeek and Doubao. DeepSeek offers Stella and Tide at 24 kHz; rate, pitch, and delivery controls apply to Doubao only. Apply provider changes before previewing and restart active calls. Doubao retains its existing `SPEECH_API_KEY` or application/token configuration. Provider endpoints and credential references remain configurable on the Host; secrets never enter browser preferences.

DeepSeek ASR uploads each completed WAV utterance; TTS uses WebSocket PCM with explicit completion checks. The call view hides the text editor while preserving the draft, shows five compact monochrome bars responding to microphone RMS, and retains status, warnings, and hangup. Reduced-motion preferences disable visual motion.

Voice conversation is a dedicated item in the Settings sidebar. Select it to configure speech providers, voices, preview, and speech detection directly; there is no nested General settings dialog.

Doubao credentials can be entered directly in Voice call settings: API key, or legacy App ID and Access token. Apply writes secrets to the Host credential store; blank inputs retain saved values, Cancel clears drafts, and saved values are never returned or stored in profile patches. Environment-supplied credentials may be read-only. Credentials are saved before ordinary preferences; if a later write fails, already accepted credentials remain saved.
