import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export const name = 'deepblue-character-tools'
export const inject = ['tools', 'agents']
const objectSchema = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false })
const string = { type: 'string' }, boolean = { type: 'boolean' }
const tools = [
  ['companion_get_state', '读取当前角色自己的桌宠动作、位置与说话状态。', objectSchema()],
  ['companion_play_action', '让当前角色自己的桌宠播放动作。', objectSchema({ action: { type: 'string', enum: ['idle','talk','eat','walk-left','walk-right','headpat','cheek-pinch','battle','angry','dance'] } }, ['action'])],
  ['companion_set_autonomy', '设置当前角色桌宠的自主活动与活泼程度。', objectSchema({ enabled: boolean, liveliness: { type: 'string', enum: ['quiet','natural','lively'] } }, ['enabled'])],
  ['companion_speak', '在当前角色桌宠中节奏显示纯文本并播放说话动画。voice 只报告外部语音状态，不会合成声音。', objectSchema({ id: string, text: string, voice: boolean, textComplete: boolean }, ['text'])],
  ['companion_update_speech', '更新同一回复 ID 的累计文本或说话状态。', objectSchema({ id: string, text: string, textComplete: boolean, typing: boolean, voice: boolean, done: boolean }, ['id'])],
  ['companion_stop_speech', '停止当前角色桌宠指定回复的说话状态。', objectSchema({ id: string }, ['id'])]
]

/** A fixed launcher-owned bridge; model arguments never choose a role, thread, endpoint or token. */
export async function startCharacterTools(ctx, options) {
  if (options.anchor !== undefined && !path.isAbsolute(options.anchor)) throw new Error('Invalid DSH module anchor')
  const requireHost = createRequire(options.anchor ?? import.meta.url)
  const { createScope } = await import(pathToFileURL(requireHost.resolve('@deepseek-ai/dsh-scope')).href)
  const url = new URL(options.url)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash || !/^[a-f0-9]{64}$/.test(options.token)) throw new Error('Invalid launcher character bridge')
  const shutdown = new AbortController(), scopes = new Map()
  let closed = false, pending
  const request = options.request ?? (async (route, body, signal) => {
    const fused = AbortSignal.any([shutdown.signal, AbortSignal.timeout(12000), ...(signal ? [signal] : [])])
    const response = await fetch(new URL(route, url), { signal: fused, redirect: 'error', method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${options.token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    if (!response.ok) { await response.body?.cancel(); throw new Error('角色桌宠工具未连接，请确认已开启桌宠。') }
    const text = await response.text(); if (Buffer.byteLength(text) > 100000) throw new Error('角色工具响应过大。')
    return JSON.parse(text)
  })
  const disposeScope = async id => { const old = scopes.get(id); scopes.delete(id); await old?.scope.dispose() }
  const synchronize = async () => {
    if (closed) return
    let bindings
    try {
      const reply = await request('/bindings')
      if (!Array.isArray(reply.bindings) || reply.bindings.length > 100) throw new Error('Invalid binding registry')
      bindings = reply.bindings
    } catch { for (const id of scopes.keys()) await disposeScope(id); return }
    if (closed) return
    for (const [id, value] of scopes) if (!bindings.some(b => b.threadId === id && b.lease === value.lease) || ctx.agents.get(id) !== value.agent) await disposeScope(id)
    for (const binding of bindings) {
      if (!binding || typeof binding.threadId !== 'string' || typeof binding.lease !== 'string' || binding.threadId.length > 100 || binding.lease.length > 100) continue
      const agent = ctx.agents.get(binding.threadId)
      if (!agent || scopes.has(binding.threadId)) continue
      const scope = createScope(ctx, agent)
      const owned = { scope, agent, lease: binding.lease }; scopes.set(binding.threadId, owned)
      try {
        for (const [name, description, parameters] of tools) scope.ctx.tools.register({ name, description, parameters,
          output: { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] }, timeoutMs: 12000,
          async execute(args, exec) {
            if (closed || exec.agent !== agent || exec.agent.id !== binding.threadId || scopes.get(binding.threadId) !== owned || ctx.agents.get(binding.threadId) !== agent) throw new Error('角色桌宠权限已撤销。')
            const result = await request('/invoke', { threadId: exec.agent.id, lease: binding.lease, name, arguments: args }, exec.signal)
            return result.result ?? null
          }
        })
        await request('/ack', binding)
      } catch (error) { options.onError?.(error); await disposeScope(binding.threadId) }
    }
  }
  const sync = () => {
    if (pending) return pending
    pending = synchronize().finally(() => { pending = undefined }); return pending
  }
  const timer = setInterval(() => { void sync().catch(() => undefined) }, Math.max(100, options.pollMs ?? 250)); timer.unref?.()
  return { sync, async dispose() { closed = true; shutdown.abort(); clearInterval(timer); await pending; for (const id of scopes.keys()) await disposeScope(id) } }
}

export async function apply(ctx) {
  const url = process.env.DEEPBLUE_CHARACTER_TOOLS_URL, token = process.env.DEEPBLUE_CHARACTER_TOOLS_TOKEN
  if (!url || !token) return
  let handle
  try {
    const anchor = process.env.DEEPBLUE_CHARACTER_DSH_ANCHOR
    if (!anchor) throw new Error('Missing owned DSH anchor')
    handle = await startCharacterTools(ctx, { url, token, anchor })
    ctx.on('dispose', () => handle.dispose())
    void handle.sync().catch(() => undefined)
  } catch { await handle?.dispose(); ctx.logger?.warn('角色桌宠工具加载失败，请检查运行时模块。') }
}
