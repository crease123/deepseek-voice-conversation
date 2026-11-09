# DeepSeek voice conversation plugins

This repository contains the standalone real-time voice conversation plugins for DeepSeek Harness:

- `@deepseek-ai/dsh-voice-speech-doubao`: Host-side Doubao ASR/TTS and voice settings.
- `@deepseek-ai/dsh-client-ui-voice-conversation`: Client microphone capture, utterance detection, streaming playback, interruption handling, and settings UI.
- `@deepseek-ai/dsh-voice-conversation-bundle`: installable composition of the Host and Client packages.

The packages target the matching DeepSeek Harness release line. For source development, install or build a matching Harness checkout, link its `node_modules` into this repository, and set `DSH_HARNESS_ROOT` to that checkout. See the [Chinese guide](README.zh.md), package READMEs, and the [voice conversation subsystem](docs/voice-conversation.md) for integration details.
