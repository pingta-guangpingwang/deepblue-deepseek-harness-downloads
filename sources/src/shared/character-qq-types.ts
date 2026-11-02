export interface CharacterQQBinding { roleId: string; accountQQ: string }
export interface CharacterQQSnapshot {
  binding?: CharacterQQBinding
  sourceAccountQQ: string
  activeRoleId?: string
  legacyRunning: boolean
  state: 'unbound' | 'ready' | 'starting' | 'running' | 'stopping' | 'error'
  message: string
}
export const characterQQHelp = Object.freeze([
  '先为角色安装 QQ 渠道，在角色页的“登录与 QQ 配置”中完成登录、自动连接，保存主人和允许名单。',
  '在角色设置选择 QQ 渠道，核对小号并绑定。绑定和保存不会登录 QQ 或发送消息。',
  '手动开启角色后，再点击启用 QQ 渠道；它只处理允许名单内的新消息，不发送启动测试消息。',
  '同一时刻只由一个角色接管当前 QQ 小号。多个本机角色可以同时开启。',
  'QQ 使用此角色的 DSH 与人格。私聊、群聊和不同联系人分别保存；不会读取角色本机对话或个人文件，也不能通过 QQ 发起本机子任务。',
  '停止角色会停止它的 QQ 回复，保留账号登录和资料。重新开启需要再次启用 QQ 渠道。'
])
