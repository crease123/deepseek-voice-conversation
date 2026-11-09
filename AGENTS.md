# DeepSeek voice conversation plugin

这是独立维护的 DeepSeek Harness 语音通话插件仓库，包含豆包 Host 语音服务、Client 通话控件和可安装组合包。

插件通过 DeepSeek Harness 的公开插件接口接入。修改 Host、Client 或组合补丁时，同步更新对应的中英文 README 和测试。不要把凭据写入源码、配置补丁或测试日志。

源码开发需要一个匹配版本的 DeepSeek Harness checkout；运行 Web 验收时，把本仓库的两个源码入口放入 Harness profile 自有 `cordis.patch.yml`，不要使用命令行 `--patch` 保存插件配置。
