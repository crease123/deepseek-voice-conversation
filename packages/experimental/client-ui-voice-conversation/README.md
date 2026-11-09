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

Choose Start voice call in the composer and grant microphone access. Speak a sentence and pause to submit it. The existing conversation displays the recognized user message, Agent output, and any tool approval. Only live replies to this call’s voice submissions are spoken; typing a separate message does not make its reply eligible for playback.

Open Settings → General → Voice conversation to edit the voice, speech rate, playback volume, and speech detection. More options contains pitch and delivery. Preview speaks the draft text with the draft voice and volume; it neither saves preferences nor adds a Session message. During a call, preview pauses microphone admission and automatic playback, then restores the call without cancelling Agent work. Apply saves Host voice and detection preferences through writable profile configuration and separately stores this Client’s playback volume; Cancel discards the draft. Use the bundle’s [source profile setup](../voice-conversation-bundle/README.md#source-checkout) when running from this checkout.

Lower interruption sensitivity raises the microphone RMS threshold and requires louder speech. Continuous speech before triggering defaults to `200` ms and accepts `0`–`1000` ms; `0` triggers immediately. Both settings control automatic recording and interruption. The detector retains the candidate speech so the confirmation delay does not remove the start of the utterance.

Speak during an answer to stop playback and request cancellation of the running Agent turn. The next voice submission waits for that turn to stop. Interruption removes this call’s own voice input if it is still queued; other pending Session messages remain. If cancellation fails or the call cannot confirm whether its input has started, the call ends and asks you to use the conversation’s Stop control. Cancellation does not undo completed tool operations.

Hang up releases capture, playback, and voice requests; already submitted Agent work remains under ordinary Session control. Session changes, page hiding, and plugin unloading also close the call. Recognition, synthesis, connection, and submission errors stop the call and leave localized recovery advice. An unconfirmed submission is not automatically resent; inspect the conversation before retrying.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin mounts the generated speech Remote and contributes one `conversation.input.activity` control. One call retains its exact Session binding and owns its microphone, event subscriptions, request cancellation, and audio queue. AudioWorklet capture produces mono samples; utterance detection emits a bounded complete recording, and the Host returns its transcript.

Recognized text follows ordinary identified Session submission without changing the unsent draft. Playback admits only live Assistant text from the corresponding voice-request turns. Sentence splitting keeps an unfinished suffix, synthesis streams PCM, and WebAudio preserves sentence order. Reasoning, tool output, and history baselines are excluded. Failed or cancelled attempts discard unplayed speech; a model retry can speak text again.

The [call controller](src/client/call.ts) owns request and cancellation ordering; [Assistant admission](src/client/output.ts) owns live-reply selection; [audio](src/client/audio.ts) owns browser resources. The Client imports sibling functionality only through declared public package exports. Independent packaging also needs its own build and tests and compatible published dependencies.

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
