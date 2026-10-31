import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { compileCharacterPersona, isCharacterRoleId, type CharacterProfile } from '../shared/character-space'
import type { CharacterQQBinding, CharacterQQSnapshot } from '../shared/character-qq-types'

/** Host callbacks keep credentials, network/model execution, and QQ history outside the plugin. */
export interface CharacterQQEngine {
  readonly running: boolean
  savedAccountQQ(): Promise<string>
  snapshot(): Promise<{ status: string }>
  copyConfigurationTo(target: any, character: { expectedAccountQQ: string; name: string; persona: string; model?: { provider: string; model: string } }): Promise<void>
  start(options: { startupTest: boolean }): Promise<void>
  stop(): Promise<void>
}
export interface CharacterQQChannelsOptions {
  directory: string
  legacy: CharacterQQEngine
  getRole(roleId: string): Promise<CharacterProfile>
  roleIsRunning(roleId: string): boolean | Promise<boolean>
  createCompanion(role: CharacterProfile): Promise<CharacterQQEngine>
  onChange?(): void
}
const account = (value: unknown): value is string => typeof value === 'string' && /^[1-9]\d{4,11}$/u.test(value)
const badStore = () => new Error('角色 QQ 绑定资料无效，请检查本地资料目录')
const cancelled = () => new Error('QQ 渠道开启已取消')
type Owner = { roleId: string; engine?: CharacterQQEngine; state: 'starting' | 'running' | 'stopping' | 'error' }

/** One host instance owns all legacy and character QQ mutations. Nothing automatically starts on load. */
export class CharacterQQChannels {
  private readonly directory: string
  private readonly file: string
  private queue: Promise<unknown> = Promise.resolve()
  private owner?: Owner
  private generations = new Map<string, number>()
  private lifecycleGeneration = 0
  private unbinding = new Set<string>()
  private closed = false
  constructor(private readonly options: CharacterQQChannelsOptions) {
    if (!path.isAbsolute(options.directory)) throw badStore()
    this.directory = path.resolve(options.directory); this.file = path.join(this.directory, 'qq-bindings.json')
  }
  get activeRoleId(): string | undefined { return this.owner?.roleId }
  private emit(): void { try { this.options.onChange?.() } catch { /* Rendering must not alter ownership. */ } }
  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation); this.queue = result.catch(() => undefined); return result
  }
  private assertOpen(): void { if (this.closed) throw new Error('QQ 渠道管理器已关闭') }
  private roleId(value: string): void { if (!isCharacterRoleId(value)) throw new Error('角色标识无效') }
  private generation(roleId: string): number { return this.generations.get(roleId) ?? 0 }
  private invalidate(roleId: string): void { this.generations.set(roleId, this.generation(roleId) + 1) }
  private async directorySafe(create = false): Promise<boolean> {
    let current = path.parse(this.directory).root
    for (const segment of path.relative(current, this.directory).split(path.sep).filter(Boolean)) {
      current = path.join(current, segment)
      try {
        let info
        try { info = await lstat(current) }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          if (!create) return false
          try { await mkdir(current, { mode: 0o700 }) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
          info = await lstat(current)
        }
        if (!info.isDirectory() || info.isSymbolicLink()) throw badStore()
      } catch { throw badStore() }
    }
    return true
  }
  private async read(): Promise<CharacterQQBinding[]> {
    if (!await this.directorySafe()) return []
    let handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      const info = await lstat(this.file)
      if (!info.isFile() || info.isSymbolicLink() || info.size > 32000) throw badStore()
      handle = await open(this.file, 'r')
      const buffer = Buffer.alloc(32001), { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      if (bytesRead > 32000) throw badStore()
      const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead)))
      if (!raw || raw.schemaVersion !== 1 || Object.keys(raw).length !== 2 || !Array.isArray(raw.bindings) || raw.bindings.length > 100) throw badStore()
      const roles = new Set<string>(), accounts = new Set<string>()
      return raw.bindings.map((entry: CharacterQQBinding) => {
        if (!entry || Object.keys(entry).length !== 2 || !isCharacterRoleId(entry.roleId) || !account(entry.accountQQ) || roles.has(entry.roleId) || accounts.has(entry.accountQQ)) throw badStore()
        roles.add(entry.roleId); accounts.add(entry.accountQQ); return { roleId: entry.roleId, accountQQ: entry.accountQQ }
      })
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw badStore() }
    finally { await handle?.close().catch(() => undefined) }
  }
  private async write(bindings: CharacterQQBinding[]): Promise<void> {
    await this.directorySafe(true)
    const temporary = `${this.file}.${randomUUID()}.tmp`
    let created = false, handle: Awaited<ReturnType<typeof open>> | undefined
    try {
      await this.read()
      handle = await open(temporary, 'wx', 0o600); created = true
      await handle.writeFile(JSON.stringify({ schemaVersion: 1, bindings }), 'utf8'); await handle.sync(); await handle.close(); handle = undefined
      await this.directorySafe(); await rename(temporary, this.file)
    } catch { throw new Error('角色 QQ 绑定保存失败，原绑定已保留') }
    finally { await handle?.close().catch(() => undefined); if (created) await unlink(temporary).catch(() => undefined) }
  }
  async snapshot(roleId?: string): Promise<CharacterQQSnapshot> {
    if (roleId !== undefined) this.roleId(roleId)
    const binding = roleId ? (await this.read()).find(entry => entry.roleId === roleId) : undefined
    const owner = this.owner, own = owner?.roleId === roleId ? owner : undefined
    let state: CharacterQQSnapshot['state'] = own?.state ?? (binding ? 'ready' : 'unbound')
    if (own?.state === 'running') {
      try {
        const native = await own.engine?.snapshot()
        state = !own.engine?.running ? 'error' : native?.status === 'starting' ? 'starting' : native?.status === 'running' ? 'running' : 'error'
      } catch { state = 'error' }
      // A native snapshot may finish after an explicit stop/replacement.
      if (this.owner !== own || own.state !== 'running') return this.snapshot(roleId)
    }
    return { ...(binding ? { binding } : {}), sourceAccountQQ: await this.options.legacy.savedAccountQQ(),
      ...(owner ? { activeRoleId: owner.roleId } : {}), legacyRunning: this.options.legacy.running, state,
      message: { unbound: '尚未绑定 QQ 小号。', ready: '已绑定，需手动启用 QQ 渠道。', starting: '正在连接 QQ 渠道。', running: 'QQ 渠道已启用，等待允许名单内的新消息。', stopping: '正在停止 QQ 渠道。', error: 'QQ 渠道异常，请停止后检查连接与配置。' }[state] }
  }
  bind(roleId: string, accountQQ: string): Promise<void> {
    this.roleId(roleId)
    if (!account(accountQQ)) return Promise.reject(new Error('QQ 小号无效'))
    return this.serialized(async () => {
      this.assertOpen(); if (this.unbinding.has(roleId)) throw new Error('正在解除 QQ 绑定，请稍候')
      const role = await this.options.getRole(roleId)
      if (role.archivedAt) throw new Error('请先恢复角色')
      if (this.owner || this.options.legacy.running) throw new Error('请先停止正在运行的 QQ 伙伴或渠道')
      if (await this.options.legacy.savedAccountQQ() !== accountQQ) throw new Error('QQ 小号已改变，请重新核对绑定')
      const bindings = await this.read()
      if (bindings.some(entry => entry.accountQQ === accountQQ && entry.roleId !== roleId)) throw new Error('此 QQ 小号已绑定另一角色，请先解除绑定')
      await this.write([...bindings.filter(entry => entry.roleId !== roleId), { roleId, accountQQ }]); this.emit()
    })
  }
  async unbind(roleId: string): Promise<void> {
    this.roleId(roleId)
    if (this.unbinding.has(roleId)) throw new Error('正在解除 QQ 绑定，请稍候')
    this.unbinding.add(roleId)
    try {
      await this.disable(roleId)
      await this.serialized(async () => { this.assertOpen(); await this.write((await this.read()).filter(entry => entry.roleId !== roleId)); this.emit() })
    } finally { this.unbinding.delete(roleId) }
  }
  enable(roleId: string): Promise<void> {
    this.roleId(roleId); const generation = this.generation(roleId), lifecycleGeneration = this.lifecycleGeneration
    return this.serialized(async () => {
      this.assertOpen()
      const valid = () => { this.assertOpen(); if (this.generation(roleId) !== generation || this.lifecycleGeneration !== lifecycleGeneration || this.unbinding.has(roleId)) throw cancelled() }
      valid()
      if (this.owner || this.options.legacy.running) throw new Error('请先停止正在运行的 QQ 伙伴或渠道')
      const role = await this.options.getRole(roleId), binding = (await this.read()).find(entry => entry.roleId === roleId)
      if (!binding) throw new Error('请先核对并绑定 QQ 小号')
      if (role.archivedAt || !role.channels.qq || !await this.options.roleIsRunning(roleId)) throw new Error('请开启角色并在设置中选择 QQ 渠道')
      if (binding.accountQQ !== await this.options.legacy.savedAccountQQ()) throw new Error('QQ 小号已改变，请重新连接或绑定')
      const persona = compileCharacterPersona(role)
      if (persona.length > 6000) throw new Error('角色的人格设定超过 QQ 渠道 6000 字限制，请精简后启用')
      valid(); const owner: Owner = { roleId, state: 'starting' }; this.owner = owner; this.emit()
      try {
        owner.engine = await this.options.createCompanion(role); valid()
        if (owner.engine === this.options.legacy) throw new Error('角色渠道必须使用独立引擎')
        await this.options.legacy.copyConfigurationTo(owner.engine, { expectedAccountQQ: binding.accountQQ, name: role.name,
          persona, ...(role.model.mode === 'override' ? { model: { provider: role.model.providerId!, model: role.model.modelId! } } : {}) })
        valid(); if (!await this.options.roleIsRunning(roleId)) throw cancelled()
        await owner.engine.start({ startupTest: false }); valid()
        if (!owner.engine.running) throw new Error('QQ 渠道尚未连接')
        owner.state = 'running'; this.emit()
      } catch {
        try { if (owner.engine !== this.options.legacy) await owner.engine?.stop(); if (this.owner === owner) this.owner = undefined }
        catch { owner.state = 'error' }
        this.emit(); throw new Error(this.generation(roleId) !== generation ? 'QQ 渠道开启已取消' : 'QQ 渠道开启失败，请检查小号登录、允许名单和模型配置')
      }
    })
  }
  disable(roleId: string): Promise<void> {
    this.roleId(roleId); this.invalidate(roleId)
    const owner = this.owner?.roleId === roleId ? this.owner : undefined
    if (owner) { owner.state = 'stopping'; this.emit() }
    // Stop immediately, including an in-flight connect, before waiting behind its serialized start.
    const stopping = owner?.engine?.stop(); void stopping?.catch(() => undefined)
    return this.serialized(async () => {
      if (owner && this.owner === owner) {
        try { await stopping; await owner.engine?.stop(); this.owner = undefined }
        catch { owner.state = 'error'; this.emit(); throw new Error('QQ 渠道停止未确认，请重试停止') }
      }
      this.emit()
    })
  }
  withLegacy<T>(operation: () => Promise<T>): Promise<T> {
    return this.serialized(async () => { this.assertOpen(); if (this.owner) throw new Error('请先停止角色的 QQ 渠道，再操作旧 QQ 伙伴'); return operation() })
  }
  async stopAll(): Promise<void> {
    // The shutdown barrier is synchronous and must work even with damaged persistence.
    this.lifecycleGeneration++
    const roleId = this.owner?.roleId
    if (roleId) await this.disable(roleId)
    else await this.queue
  }
  async dispose(): Promise<void> { this.closed = true; await this.stopAll() }
}
