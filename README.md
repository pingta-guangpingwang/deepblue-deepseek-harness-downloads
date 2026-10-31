# 深蓝角色扩展

面向启动器 0.11 角色空间的可选原生插件。用户从角色能力页主动安装；安装不会自动开启角色或发送 QQ 消息。记忆与知识可离线使用，QQ 渠道复用用户已配置的小号并隔离会话。

`packages/` 为受版本和 SHA-256 约束的两项 CJS 产物；`catalog.json` 包含 GitHub / Gitee 下载源。`sources/` 为对应源文件，运行 `npm install && npm run build` 可重建。宿主接口由启动器提供，原版 AstrBot Python 插件不属于此运行格式。

`vendor/character-tools` 为 DSH 角色作用域的六项桌宠工具适配，`vendor/character-pet` 是启动器管理桌宠所用的隔离启动与本机控制适配。原独立桌宠核心、形象素材和用户资料不包含在这个源码仓库；请勿把适配文件当作可独立启动的完整应用。构建脚本 `scripts/build-character-pet-module.mjs` 需要另外提供已授权、相符版本的桌宠源码和完整运行环境；具体命令见适配 README。

完整受管桌宠运行包是单独的按需下载，版本 0.2.1，压缩大小 219,570,141 字节。`character-pet-runtime.json` 固定完整归档和文件清单的 SHA-256，并列出 OSS 与 GitHub 两个镜像。用户从角色页主动安装、绑定和开启，每个角色使用独立资料、端口、固定 DSH 对话；包不包含账号、密钥、QQ 历史或用户聊天。

- [GitHub 公共源码与插件](https://github.com/pingta-guangpingwang/deepblue-deepseek-harness-downloads/tree/character-plugins-0110)
- [Gitee 镜像](https://gitee.com/wanggp123/deepseek-harness-skins/tree/character-plugins-0110)
- [宠物按需运行包](https://github.com/pingta-guangpingwang/deepblue-deepseek-harness-downloads/releases/tag/character-pet-runtime-0.2.1)

此模块发布不会改变启动器稳定版本或自动更新入口。
