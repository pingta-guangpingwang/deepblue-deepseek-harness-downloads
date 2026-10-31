# 深蓝角色扩展

面向启动器 0.11 角色空间的可选原生插件。用户从角色能力页主动安装；下载安装不会自动开启角色或发送 QQ 消息。记忆与知识可离线使用，QQ 渠道复用用户已配置的小号并隔离会话。

`packages/` 为受版本和 SHA-256 约束的构建产物，`catalog.json` 包含双镜像信息。`sources/` 为对应源文件；`npm install && npm run build` 可重建。宿主接口由启动器提供，本包不是独立 QQ 客户端。原版 AstrBot Python 插件不属于此运行格式。

宠物 MCP 使用单独的按需运行包，不混入这两个小插件。所有用户账号、密钥、资料和对话均不包含在仓库中。

源码与模块分发分支：

- GitHub：https://github.com/pingta-guangpingwang/deepblue-deepseek-harness-downloads/tree/character-plugins-0110
- Gitee：https://gitee.com/wanggp123/deepseek-harness-skins/tree/character-plugins-0110
