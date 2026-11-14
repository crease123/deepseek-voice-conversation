---
description: "选择语音通话 行为，并分别配置文字交流与语音通话的提示词。"
kind: "package-reference"
---

# @deepseek-ai/dsh-personal-agent

[English](README.md) | 中文

## 概述

使用语音通话 处理日常事务、学习、讨论和具体任务，并保留标准模式可用的工具。分别编辑常规提示词和通话期间的附加规则。保存后，已有个人会话的下一次模型请求即可使用新设置。进入通话时，Agent 会收到当前交流方式，并默认采用简短口语回复。

## 目录

- [使用此包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

[语音通话组合包](../voice-conversation-bundle/README.zh.md) 将此包与麦克风控制和设置页一起挂载。创建会话时，在标准模式旁选择语音通话；打开“设置 → 语音通话”编辑并保存两份提示词。预览展示已保存的个人规则；Harness 和工具指令另外提供。

自定义组合应在来源预设之后挂载此包，并提供 Sessions、System Prompt、Typert 和 Settings：

```yaml
- id: personal-agent
  name: '@deepseek-ai/dsh-personal-agent'
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `basePreset` | `standard` | 语音通话 复用其工具和操作规则的已有预设。 |
| `basePrompt` | 中文个人助理提示词 | 面向日常事务、学习、讨论和执行的常规规则；保存后对已有语音通话 生效。 |
| `callPrompt` | 简短口语回复，通常为 1–3 句 | 个人通话期间的附加规则；用户要求详细说明时可以展开。 |

保存提示词会影响下一次模型请求，包括正在进行的通话中的下一次请求。已在流式输出的回复保留原有指令。配置校验会拒绝空提示词。需要原有身份设定时，可以继续使用标准模式。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 — 点击展开</summary>

此包通过公开的预设注册表读取并校验来源预设的 Loader 文档。语音通话 保留该组合，仅将顶层 persona 替换为读取当前常规提示词的变量。用户提示词中的 `{{...}}` 会保留原文。注册与清理由插件 fiber 管理；标准模式保留独立注册。

Client 为每个已连接的通话持有一条经过 Session 鉴权的 Remote 流。第一条确认表示 Host 已安装语音状态，Client 随后才接收麦克风输入。Host 分别计数各个并发客户端，并在对应流结束、Session 关闭或插件卸载时撤销登记。新的 Host 不保留任何通话登记。

System Prompt 为每个 Session 组装当前的文字或语音状态。仅个人通话会附加已保存的通话规则。普通模型请求会将这些 runtime-context 快照记录到 Session 日志，包括通话结束后明确的文字状态。开始和结束通话不会发送用户消息、启动模型轮次或中止 Agent 工作。

[index.ts](src/index.ts) 管理预设组合、动态配置和通话生命周期；[types.ts](src/types.ts) 定义面向 Client 的设置类型。[定向测试](tests/personal-agent.spec.ts) 在无需服务商凭据的情况下验证真实预设挂载和 AgentLoop 输入。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [仓库指南](../../../README.zh.md)：本地开发和链接构建。
- [语音通话组合包](../voice-conversation-bundle/README.zh.md)：应用组合。
- [语音通话子系统](../../../docs/voice-conversation.zh.md)：麦克风与打断行为。

-----

<a id="model-experience"></a>
## 模型体验

个人 Session 通过 persona 接收已保存的常规提示词。每个 Session 的下一次普通模型请求都会包含一份写入日志的 runtime-context 快照，明确当前使用文字还是语音；仅个人语音通话会追加已保存的通话提示词。单独切换通话状态不会产生模型请求或伪用户消息。

#### KV Cache 影响

编辑常规提示词会改变下一次请求的系统提示词。切换语音状态或编辑通话提示词会改变 runtime-context 后缀；未变化的提示词保留通常的缓存行为。

## 已知限制与待办

<a id="known-limitations-and-deferred-work"></a>

此包配置 Agent 指令与临时通话状态；音频采集和语音服务由其他包负责。

- 当前 Host profile 下的个人 Session 共享提示词设置，不提供每个 Session 独立的 persona。
- 此包加载时复制来源预设。之后来源预设的组合发生变化时，需要重新加载此包。
- 插件重新加载会结束已有通话登记。Client 必须重新连接才能继续通话。
- 提示词用于引导模型行为，不会强制截断回复长度。

-----

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者上下文 — 点击展开</summary>

无。

</details>
