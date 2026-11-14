---
description: "Choose Voice call behavior and configure separate guidance for text and voice conversations."
kind: "package-reference"
---

# @deepseek-ai/dsh-personal-agent

English | [中文](README.zh.md)

## Summary

Choose Voice call for daily tasks, learning, discussion, and execution with the same tools available in Standard mode. Edit its general guidance and additional voice-call rules separately. Saved edits apply to the next model request in existing personal conversations. During a call, the Agent receives the current communication mode and uses concise spoken replies by default.

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

The [voice conversation bundle](../voice-conversation-bundle/README.md) mounts this package with the microphone controls and settings page. Select Voice call beside Standard when creating a conversation; open Settings → Voice call to edit and save both prompts. The preview displays the saved personal guidance; Harness and tool instructions remain separate.

Custom compositions mount this package after the source preset, with Sessions, System Prompt, Typert, and Settings available:

```yaml
- id: personal-agent
  name: '@deepseek-ai/dsh-personal-agent'
```

| Field | Default | Meaning |
|---|---|---|
| `basePreset` | `standard` | Existing preset whose tools and operating policies Voice call reuses. |
| `basePrompt` | Chinese personal-assistant guidance | General guidance for daily tasks, learning, discussion, and execution; saved changes apply to existing Voice calls. |
| `callPrompt` | Short spoken replies, normally 1–3 sentences | Additional guidance during connected personal calls; requests for detail can expand the response. |

Saving prompts affects the next model request, including the next request during an active call. An already streaming response keeps its existing instructions. An empty prompt is rejected by configuration validation. Users can keep Standard mode for its original persona.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The package reads and validates the source preset's Loader document through the public preset registry. Voice call preserves that composition and replaces its top-level persona with a variable that reads the current saved base prompt. User-authored `{{...}}` text remains literal. Registration and cleanup belong to the plugin fiber; Standard remains independently registered.

The Client holds a Session-authorized Remote stream for each connected call. Its first acknowledgement confirms that the Host has installed voice state before the Client admits microphone input. The Host counts concurrent callers independently and withdraws each registration when its stream ends, its Session closes, or the plugin unloads. A fresh Host has no active call registrations.

System Prompt assembles the current text or voice state for every Session. Only personal calls receive the saved call guidance. Ordinary model requests record these runtime-context snapshots in the Session log, including an explicit text state after a call ends. Starting and ending a call does not send a user message, start a model turn, or abort Agent work.

[index.ts](src/index.ts) owns composition, live configuration, and call lifetimes; [types.ts](src/types.ts) declares Client-facing preferences. The [focused tests](tests/personal-agent.spec.ts) exercise real preset mounting and AgentLoop input without provider credentials.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Repository guide](../../../README.md): local development and linked builds.
- [Voice conversation bundle](../voice-conversation-bundle/README.md): application composition.
- [Voice conversation subsystem](../../../docs/voice-conversation.md): microphone and interruption behavior.

-----

<a id="model-experience"></a>
## Model Experience

Personal Sessions receive the saved base prompt through their persona. Every Session's next ordinary model request includes a logged runtime-context snapshot identifying text or voice communication; only personal voice calls add the saved call prompt. Call transitions alone create no model request or synthetic user message.

#### KV Cache effect

Base-prompt edits change the system prompt on the next request. Voice transitions and call-prompt edits change the runtime-context suffix; unchanged prompts retain their normal cache behavior.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

The package configures Agent instructions and transient call state; audio capture and speech services have separate owners.

- Prompt preferences are shared by personal Sessions on the current Host profile. They do not provide per-Session personas.
- The source preset is copied when this plugin loads. Later source-preset composition changes require reloading this plugin.
- A plugin reload ends its call registrations. The Client must reconnect before resuming a call.
- Prompt wording guides model behavior and does not impose a hard response-length limit.

-----

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Maintainer context — click to expand</summary>

None.

</details>
