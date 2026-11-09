# DeepSeek 语音通话插件

这是从 DeepSeek Harness 独立出来的实时语音对话插件仓库，包含三个可组合的包：

- `@deepseek-ai/dsh-voice-speech-doubao`：Host 侧豆包 ASR/TTS 服务和语音设置。
- `@deepseek-ai/dsh-client-ui-voice-conversation`：Client 侧麦克风采集、自动断句、流式播报、打断和设置面板。
- `@deepseek-ai/dsh-voice-conversation-bundle`：把 Host 与 Client 组合成可安装插件。

## 与 DeepSeek Harness 集成

插件依赖 DeepSeek Harness 的公开插件接口。源码开发时，在 Harness checkout 中安装或构建匹配版本的依赖，并在自定义 profile 自有 `cordis.patch.yml` 中插入两个源码入口：

```yaml
- insert:
    - id: voice-speech-doubao
      name: '/absolute/path/to/deepseek-voice-conversation/packages/experimental/voice-speech-doubao/src/index.ts'
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

然后回到本仓库构建三个插件包并生成 Host Remote 元数据：

```sh
pnpm install
DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness pnpm run build
```

`generate:remote` 会把 Host 包暂存到 Harness workspace 的专用路径，并添加临时项目引用，让 Typert 识别 Remote 装饰器。若暂存目录已存在，脚本会拒绝使用；写入前会再次检查 Harness 配置，生成结束后会还原配置。请勿与其他会编辑 `tsconfig.host.json` 的任务并行执行；若脚本检测到后续改动，会保留当前文件并报告备份路径，供手动恢复或合并。

### 修改本地源码

当前 Mac 已配置登录后台任务，登录后自动运行 `pnpm run dev:watch`。Host 与 Client 的 `src/` 改动会先经过 TypeScript 检查，再重建本地链接包；Client 改动会热更新到打开的应用，Host 改动会重载运行中的插件。类型检查失败时会保留上一次成功构建。Profile 清单、包元数据和生成的 Remote 定义仍需按各自说明重新安装或重启。

修改监听配置后，可运行 `launchctl kickstart -k gui/$(id -u)/local.deepseek.voice-conversation.watch` 重启后台监听。若改为手动运行，先用 `launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/local.deepseek.voice-conversation.watch.plist` 停止后台任务，再在本仓库运行 `DSH_HARNESS_ROOT=/absolute/path/to/deepseek-harness pnpm run dev:watch`。

启用后，入口位于 **设置 → 通用设置 → 语音通话**。面板支持选择音色、调节语速和播放音量、试听，以及调节打断灵敏度和触发前的最短持续说话时间。试听期间会暂停当前通话的收音和自动播报，完成后恢复。

## 目录

- [豆包 Host 包](packages/experimental/voice-speech-doubao/README.zh.md)
- [Client 通话包](packages/experimental/client-ui-voice-conversation/README.zh.md)
- [组合包](packages/experimental/voice-conversation-bundle/README.zh.md)
- [语音通话子系统说明](docs/voice-conversation.zh.md)

## 凭据

凭据只在 Harness Host 侧配置并通过 Credentials 服务读取。不要把 API Key、App ID 或 Access Token 写入本仓库。

## 当前验证

插件已在匹配版本的 DeepSeek Harness Web 组合中完成设置面板、音色保存、短噪声过滤、通话试听暂停与恢复、通话挂断释放的本地回归；测试使用本地 mock，不调用付费语音服务。
