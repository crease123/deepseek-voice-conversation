# DeepSeek voice conversation plugins

This repository contains the standalone real-time voice conversation plugins for DeepSeek Harness:

- `@deepseek-ai/dsh-voice-speech-doubao`: Host-side Doubao ASR/TTS and voice settings.
- `@deepseek-ai/dsh-client-ui-voice-conversation`: Client microphone capture, utterance detection, streaming playback, interruption handling, and settings UI.
- `@deepseek-ai/dsh-voice-conversation-bundle`: installable composition of the Host and Client packages.

The packages target the matching DeepSeek Harness release line. For source development, install this workspace’s dependencies and build a matching Harness checkout; set `DSH_HARNESS_ROOT` to that checkout when building the Client bundle. See the [Chinese guide](README.zh.md), package READMEs, and the [voice conversation subsystem](docs/voice-conversation.md) for integration details.

## Build the local Client bundle

Build the matching Harness artifacts first:

```sh
cd /absolute/path/to/deepseek-harness
pnpm run build:artifacts
```

Then, from this repository, build all three packages and generate the Host Remote metadata:

```sh
pnpm install
DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness pnpm run build
```

`generate:remote` reserves a temporary Host package path and adds a project reference so Typert can resolve its Remote decorators. It refuses to use an existing staging directory, checks the Harness config again before writing, and restores it when generation finishes. Do not run it while another task edits `tsconfig.host.json`; if the script detects a later change, it preserves the current file and reports a backup path for manual recovery.
