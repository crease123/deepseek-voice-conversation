# Voice call

## Install

The public npm package is `voice-call`, maintained from `crease123/deepseek-voice-conversation`. In the DSH plugin manager, install `voice-call`, or run `dsh plugin --profile <your-profile> add voice-call`. Other similarly named packages belong to other projects.

Use the prebuilt [v0.3.0 release](https://github.com/crease123/deepseek-voice-conversation/releases/tag/v0.3.0) in the DSH plugin manager, or run `dsh plugin --profile <your-profile> add https://github.com/crease123/deepseek-voice-conversation/releases/download/v0.3.0/voice-call-0.3.0.tgz`. DSH Desktop users should install through the app. Requires DSH 0.2.2-rc.1 or later in the 0.2.x line. Releases include prebuilt Host and Client packages, so no local build is required.

DeepSeek reuses your own `DEEPSEEK_API_KEY`; this plugin does not supply a shared key. For Doubao, open Settings → Voice call, select Doubao for ASR and/or TTS, then enter your API key or legacy App ID and Access token and Apply. Credentials stay in the Host credential store. Open a conversation in Voice call mode and press the microphone to begin.


This repository contains the standalone real-time voice conversation plugins for DeepSeek Harness:

- `@deepseek-ai/dsh-voice-speech-doubao`: Host-side DeepSeek and Doubao ASR/TTS and voice settings.
- `@deepseek-ai/dsh-personal-agent`: selectable personal Agent preset, editable prompts, and Session-bound call context.
- `@deepseek-ai/dsh-client-ui-voice-conversation`: Client microphone capture, utterance detection, streaming playback, interruption handling, and settings UI.
- `@deepseek-ai/dsh-voice-conversation-bundle`: installable composition of the Host and Client packages.

The packages target the matching DeepSeek Harness release line. For source development, install this workspace’s dependencies and build a matching Harness checkout; set `DSH_HARNESS_ROOT` to that checkout when building the Client bundle. See the [Chinese guide](README.zh.md), package READMEs, and the [voice conversation subsystem](docs/voice-conversation.md) for integration details.

## Build the local Client bundle

Build the matching Harness artifacts first:

```sh
cd /absolute/path/to/deepseek-harness
pnpm run build:artifacts
```

Then, from this repository, build the packages and generate both Host Remote definitions:

```sh
pnpm install
DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness pnpm run build
```

`generate:remote` reserves a temporary Host package path and adds a project reference so Typert can resolve its Remote decorators. It refuses to use an existing staging directory, checks the Harness config again before writing, and restores it when generation finishes. Do not run it while another task edits `tsconfig.host.json`; if the script detects a later change, it preserves the current file and reports a backup path for manual recovery.

## Use Voice call

Select Voice call beside Standard mode when creating a new conversation. Settings → Voice call instructions edits its base prompt and call-only rules; Apply persists both to the Host profile. The saved-rules preview shows your configured text and call additions, while Harness and tool instructions remain separate. Prompt edits affect the next model request, including requests in existing personal conversations.

A connected call registers its Session with the Host before microphone admission. The next model request receives the current voice/text state; personal calls also receive the saved call rules. Hanging up or disconnecting withdraws that registration without sending a chat message or cancelling Agent work. Mode changes do not rewrite an already streaming response. The default call rules request short, natural replies and retain code and long details in text.

## Edit the linked source

For local development, run `pnpm run dev:watch` with `DSH_HARNESS_ROOT` set. Changes under the Host and Client `src/` directories are type-checked before rebuilding the linked package; Client changes hot-swap into the open app, and Host changes reload the running plugin. A failed type-check keeps the last successful bundle. Profile manifests, package metadata, and generated Remote definitions still require their documented install or restart steps.


### Speech providers and call view

ASR and TTS default to DeepSeek and reuse the Host credential reference `DEEPSEEK_API_KEY`. No separate Volcengine credentials are needed for DeepSeek. Voice settings select ASR and TTS independently between DeepSeek and Doubao. DeepSeek offers Stella and Tide at 24 kHz; rate, pitch, and delivery controls apply to Doubao only. Apply provider changes before previewing and restart active calls. Doubao retains its existing `SPEECH_API_KEY` or application/token configuration. Provider endpoints and credential references remain configurable on the Host; secrets never enter browser preferences.

DeepSeek ASR uploads each completed WAV utterance; TTS uses WebSocket PCM with explicit completion checks. The call view hides the text editor while preserving the draft, shows five compact monochrome bars responding to microphone RMS, and retains status, warnings, and hangup. Reduced-motion preferences disable visual motion.

Voice conversation is a dedicated item in the Settings sidebar. Select it to configure speech providers, voices, preview, and speech detection directly; there is no nested General settings dialog.

Doubao credentials can be entered directly in Voice call settings: API key, or legacy App ID and Access token. Apply writes secrets to the Host credential store; blank inputs retain saved values, Cancel clears drafts, and saved values are never returned or stored in profile patches. Environment-supplied credentials may be read-only. Credentials are saved before ordinary preferences; if a later write fails, already accepted credentials remain saved.
