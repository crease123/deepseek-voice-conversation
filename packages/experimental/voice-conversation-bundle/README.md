---
description: "Opt-in continuous voice conversations with the current Web or Desktop agent, using Doubao speech recognition and synthesis."
kind: "package-bundle"
---

# @deepseek-ai/dsh-voice-conversation-bundle

English | [中文](README.zh.md)

## Summary

Speak to the current agent and hear its replies without pressing Send after each sentence. The call uses Doubao speech recognition and synthesis while keeping the Session’s model, tools, and approvals. This bundle is opt-in and does not activate in shipped profiles.

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

The [speech plugin](../voice-speech-doubao/README.md#use-this-package) owns credential and voice configuration. Configure its speech credentials on the Host before starting a call; the browser receives no credential values. Model credentials remain those of the existing Session.

Disable [Voice input](the separate Voice input bundle) before enabling this bundle. Both contribute to the composer’s single activity slot and cannot be active together. If the existing Web profile references an outdated plugin package name, disable or correct that entry first.

### Source checkout

<a id="source-checkout"></a>

Build the workspace using the [repository guide](../../../README.md#build-the-local-client-bundle). From the matching Harness checkout’s root, create a custom Web profile with an unused name; `voice-conversation` below is an example:

```sh
pnpm dsh voice-conversation --from-default-profile web --dump-config
```

For source development, build the local Client bundle using the [repository guide](../../../README.md#build-the-local-client-bundle) before starting the profile.

Run this initialization only once: `--from-default-profile` replaces the named profile directory, including its existing patch and dependencies. Edit `$DSH_HOME/profiles/voice-conversation/cordis.patch.yml` (`~/.dsh/profiles/voice-conversation/cordis.patch.yml` by default) and insert both plugins there, replacing `/absolute/path/to/deepseek-voice-conversation` with this checkout’s absolute path:

```yaml
- insert:
    - id: voice-speech-doubao
      name: '/absolute/path/to/deepseek-voice-conversation/packages/experimental/voice-speech-doubao/src/index.ts'
    - id: personal-agent
      name: '/absolute/path/to/deepseek-voice-conversation/packages/experimental/personal-agent/src/index.ts'
    - id: client-ui-voice-conversation
      name: '/absolute/path/to/deepseek-voice-conversation/packages/experimental/client-ui-voice-conversation/src/index.ts'
```

Start this profile without the initialization flag:

```sh
pnpm dsh voice-conversation --no-open --port 0
```

Open the URL printed in the terminal. To inspect composition without starting the app or a model request, run `pnpm dsh voice-conversation --dump-config`; the output includes `voice-speech-doubao` and `client-ui-voice-conversation`. Keeping the inserts in the profile’s own patch lets Settings save their preferences there. A plugin inserted only by a command-line `--patch` overlay cannot accept those profile writes. The browser half still requires the workspace’s built Client artifact. The installable bundle declares the same three rows by package name in [its patch](cordis.patch.yml).

### Talk to the agent

Select Personal Agent in a new conversation and edit its base and call rules in Settings → Personal Agent. Call registration reaches the Host before microphone admission; hangup or disconnection withdraws it. The next model request returns to text guidance without an extra chat message.

Open a conversation, start a call from the composer, and grant microphone access. A pause ends each utterance; recognition submits its text to that Session automatically. Replies to voice input and delivered scheduled reminders play sentence by sentence; schedule-change notices remain silent. Speaking during a reply stops playback and requests cancellation of the active Agent turn before the next utterance is submitted. Existing tool permissions and approval prompts still apply.

Use Settings → Voice conversation for voice, playback, and speech-detection preferences. The [Client settings](../client-ui-voice-conversation/README.md#use-this-package) support draft previews during calls without adding Session messages; Apply saves the accepted preferences.

Hang up to release the microphone and voice requests. Switching Sessions or unloading the Client closes the call. Hiding the page pauses microphone input and playback while retaining the call; returning to the page resumes it. Cancelling a turn does not undo operations that have already completed.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Maintainer details — click to expand</summary>

The bundle composes a [Doubao Host service](../voice-speech-doubao/README.md) and a [Client call controller](../client-ui-voice-conversation/README.md). Each package owns its behavior; the bundle carries no Agent loop or conversation history. The plugins integrate through declared package exports, the authenticated Remote transport, and registered conversation slots.

This repository keeps the Host, Client, and bundle packages in one workspace. The bundle uses `workspace:*` dependencies locally; publishing the packages requires replacing those selectors with published version ranges and verifying the supported Harness version.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

[Voice conversation subsystem](../../../docs/voice-conversation.md) · [Repository guide](../../../README.md) · [Profile management](../../../README.md#deepseek-harness-integration)

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the Client’s ordinary Session submissions; the Client owns recognized user text, and the Session’s preset owns model requests and tool access.

#### KV Cache effect

The bundle adds no prompt section. Ordinary user submissions extend the existing Session history; speech audio and playback state do not enter model context.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Recognition receives complete utterances after a pause. Continuous calling does not provide partial transcripts while the user speaks.
- Speech uses a cloud provider and requires separately granted Doubao ASR and TTS resources. Microphone access requires a supported secure browser context; speaker playback can cause false interruptions, so headphones are preferable.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
