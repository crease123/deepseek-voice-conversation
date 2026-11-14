# 语音通话 · Voice call

## 安装

公开 npm 包名为 `voice-call`，源码仓库为 `crease123/deepseek-voice-conversation`。可在 DSH 插件管理器中安装 `voice-call`，或运行 `dsh plugin --profile <你的-profile> add voice-call`。其他相似名称的包属于其他项目。

在 DSH 插件管理器中使用 [v0.3.0 预构建发行包](https://github.com/crease123/deepseek-voice-conversation/releases/tag/v0.3.0)，或运行 `dsh plugin --profile <你的-profile> add https://github.com/crease123/deepseek-voice-conversation/releases/download/v0.3.0/voice-call-0.3.0.tgz`。DSH Desktop 请通过应用内插件管理器安装。要求 0.2.x 系列的 DSH 0.2.2-rc.1 或更新版本。发行包已包含构建产物，无需在本地编译。

DeepSeek 复用你自己配置的 `DEEPSEEK_API_KEY`，插件不提供共享密钥。使用豆包时，打开「设置 → 语音通话」，分别选择识别和合成服务，填写 API Key 或旧控制台的 App ID 与 Access Token，然后点击应用。密钥只保存到宿主凭据库。新建「语音通话」模式的会话后，点击麦克风开始通话。


这是从 DeepSeek Harness 独立出来的实时语音对话插件仓库，包含以下可组合的包：

- `@deepseek-ai/dsh-voice-speech-doubao`：Host 侧 DeepSeek 与豆包 ASR/TTS 服务和语音设置。
- `@deepseek-ai/dsh-personal-agent`：可选择的语音通话 模式、可编辑提示词和绑定 Session 的通话上下文。
- `@deepseek-ai/dsh-client-ui-voice-conversation`：Client 侧麦克风采集、自动断句、流式播报、打断和设置面板。
- `@deepseek-ai/dsh-voice-conversation-bundle`：把 Host 与 Client 组合成可安装插件。

## 与 DeepSeek Harness 集成

插件依赖 DeepSeek Harness 的公开插件接口。源码开发时，在 Harness checkout 中安装或构建匹配版本的依赖，并在自定义 profile 自有 `cordis.patch.yml` 中插入以下源码入口：

```yaml
- insert:
    - id: voice-speech-doubao
      name: '/absolute/path/to/deepseek-voice-conversation/packages/experimental/voice-speech-doubao/src/index.ts'
    - id: personal-agent
      name: '/absolute/path/to/deepseek-voice-conversation/packages/experimental/personal-agent/src/index.ts'
    - id: client-ui-voice-conversation
      name: '/absolute/path/to/deepseek-voice-conversation/packages/experimental/client-ui-voice-conversation/src/index.ts'
```

从本仓库源码运行时，先安装本工作区依赖，并设置 `DSH_HARNESS_ROOT` 指向匹配版本的 Harness checkout；发布包安装时由包管理器解析对应的 Harness 版本。把源码入口写入 profile 自有补丁后，设置面板才能把音色、语速、音高、语气、播放音量、打断灵敏度和持续说话时长保存到该 profile。命令行 `--patch` 覆盖层只适合临时组合，不能作为可写设置归属层。

### 构建本地 Client 产物

先在匹配版本的 Harness 仓库构建产物：

```sh
cd /absolute/path/to/deepseek-harness
pnpm run build:artifacts
```

然后回到本仓库构建插件包并生成两个 Host 的 Remote 元数据：

```sh
pnpm install
DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness pnpm run build
```

`generate:remote` 会把 Host 包暂存到 Harness workspace 的专用路径，并添加临时项目引用，让 Typert 识别 Remote 装饰器。若暂存目录已存在，脚本会拒绝使用；写入前会再次检查 Harness 配置，生成结束后会还原配置。请勿与其他会编辑 `tsconfig.host.json` 的任务并行执行；若脚本检测到后续改动，会保留当前文件并报告备份路径，供手动恢复或合并。

### 修改本地源码

本地开发时，设置 `DSH_HARNESS_ROOT` 并运行 `pnpm run dev:watch`。Host 与 Client 的 `src/` 改动会先经过 TypeScript 检查，再重建本地链接包；Client 改动会热更新到打开的应用，Host 改动会重载运行中的插件。类型检查失败时会保留上一次成功构建。Profile 清单、包元数据和生成的 Remote 定义仍需按各自说明重新安装或重启。


启用后，入口位于 **设置 → 通用设置 → 语音通话**。面板支持选择音色、调节语速和播放音量、试听，以及调节打断灵敏度和触发前的最短持续说话时间。试听期间会暂停当前通话的收音和自动播报，完成后恢复。

## 使用语音通话

新建会话时，在标准模式旁选择「语音通话」。在「设置 → 语音通话」分别编辑基础提示词和通话补充规则，保存后持久写入 Host profile。「查看已保存规则」展示你配置的文字与通话补充内容；Harness 和各工具自己的指引仍独立生效。提示词修改从下一次模型请求生效，包括已有个人会话的后续请求。

通话连接会先向 Host 登记当前 Session，再接纳麦克风输入。下一次模型请求会收到当前语音或文字状态，个人模式通话还会收到保存的通话规则。挂断或断线会撤销登记，不发送聊天消息，也不取消 Agent 工作。状态变化无法修改已在生成中的回复。默认通话规则要求简短、自然口语表达，把代码和长篇细节留在文字中。

## 目录

- [豆包 Host 包](packages/experimental/voice-speech-doubao/README.zh.md)
- [语音通话 包](packages/experimental/personal-agent/README.zh.md)
- [Client 通话包](packages/experimental/client-ui-voice-conversation/README.zh.md)
- [组合包](packages/experimental/voice-conversation-bundle/README.zh.md)
- [语音通话子系统说明](docs/voice-conversation.zh.md)

## 凭据

凭据只在 Harness Host 侧配置并通过 Credentials 服务读取。不要把 API Key、App ID 或 Access Token 写入本仓库。

## 当前验证

插件已在匹配版本的 DeepSeek Harness Web 组合中完成设置面板、音色保存、短噪声过滤、通话试听暂停与恢复、通话挂断释放的本地回归；测试使用本地 mock，不调用付费语音服务。

### 语音厂商与通话界面

ASR、TTS 默认使用 DeepSeek，复用 Host 凭据引用 `DEEPSEEK_API_KEY`，无需另配火山引擎凭据。语音设置可分别选择 DeepSeek 或豆包。DeepSeek 提供 Stella、Tide 两种音色，输出采样率为 24 kHz；语速、音调、风格仅对豆包生效。更换厂商后先应用再试听，并重新开始通话。豆包沿用 `SPEECH_API_KEY` 或应用 ID/Token 配置。服务端可配置接口地址和凭据引用，密钥不会进入浏览器偏好设置。

DeepSeek ASR 上传每段完整 WAV，TTS 通过 WebSocket 接收 PCM 并验证完成事件。通话期间隐藏文字编辑器并保留草稿，显示随麦克风实际 RMS 变化的五段单色声条，保留状态、警告与挂断操作。系统开启减少动态效果时禁用视觉动画。

“语音通话”是设置左侧的独立选项，点击即可直接配置语音厂商、音色、试听和说话检测，无需进入通用设置或打开二级弹窗。

可直接在语音通话设置中填写豆包 API Key，或旧控制台的 App ID 与 Access Token。点击应用后写入宿主凭据库；留空保留原值，取消会清空草稿，已保存的密钥不会回传或写入 profile 配置补丁。环境变量提供的凭据可能为只读。凭据先于普通偏好保存；后续写入失败时，已被接受的凭据仍会保留。
