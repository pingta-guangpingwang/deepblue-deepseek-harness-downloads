import { closeSync, existsSync, fsyncSync, fstatSync, mkdirSync, openSync, readSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { QQKnowledgeNode } from '../shared/qq-enhancements'

const LIMIT = { nodes: 512, bytes: 1024 * 1024, title: 80, text: 2000, source: 120, input: 8000, fact: 160 }
const CORRUPT = 'QQ knowledge store is corrupt or exceeds limits.'
const INVALID = 'Invalid QQ knowledge node.'
const AUTO_SOURCE = '用户自述'
type Edit = Pick<QQKnowledgeNode, 'scope' | 'subjectQQ' | 'category' | 'title' | 'text'> & { id?: string; source?: string }
type Scope = { kind: 'private' | 'group'; targetQQ: string }

function scopeFields(scope: string): Scope {
  const match = typeof scope === 'string' && /^([1-9]\d{4,11}):(private|group):([1-9]\d{4,11})$/.exec(scope)
  if (!match || match[0] !== scope) throw new Error('Invalid QQ knowledge scope.')
  return { kind: match[2] as Scope['kind'], targetQQ: match[3]! }
}
function subject(scope: Scope, value: string, shared = false): void {
  if (typeof value !== 'string' || (value === '' ? !(shared && scope.kind === 'group') : !/^[1-9]\d{4,11}$/.test(value))
    || /\D/u.test(value) || (scope.kind === 'private' && value !== scope.targetQQ)) throw new Error(INVALID)
}
function normalized(text: string): string {
  return text.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu, '').toLowerCase()
}
function sensitive(text: string): boolean {
  const value = normalized(text)
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
    || /api[\s_-]*key|password|passwd|\bpwd\b|token|secret|bearer|private[\s_-]*key|\b(?:key|credential)\s*[:=]/iu.test(value)
    || /密码|密钥|钥匙|口令|令牌|邮箱|邮件|私密|隐私|身份证|银行卡|手机号|电话号码|住址|家庭地址|验证码/u.test(value)
    || (value.includes('@') && /[\p{L}\d._%+-]+\s*@\s*[\p{L}\d.-]+\s*\.\s*[a-z]{2,}/iu.test(value))
    || /(?:sk-|gh[pousr]_|github_pat_|AKIA)[a-z\d_-]+/iu.test(value)
    || /eyJ[a-z\d_-]*\.[a-z\d_-]+\.[a-z\d_-]+/iu.test(value)
    || /[a-z\d+/_=-]{24,}|(?:\d[\s()+.-]*){7,}/iu.test(value)
}
function textValue(value: unknown, maximum: number, empty = false): string {
  if (typeof value !== 'string' || value.length > maximum || (!empty && !value.trim()) || sensitive(value)) throw new Error(INVALID)
  return value.trim()
}
function nodeId(id: string): void {
  if (typeof id !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/iu.test(id) || id.length !== 36) throw new Error(INVALID)
}
function edit(value: Edit): Omit<QQKnowledgeNode, 'id' | 'updatedAt'> & { id?: string } {
  if (!value || !['profile', 'preference', 'event', 'knowledge'].includes(value.category)) throw new Error(INVALID)
  const fields = scopeFields(value.scope)
  subject(fields, value.subjectQQ, value.category === 'knowledge')
  if (value.id !== undefined) nodeId(value.id)
  return { id: value.id, scope: value.scope, subjectQQ: value.subjectQQ, category: value.category,
    title: textValue(value.title, LIMIT.title), text: textValue(value.text, LIMIT.text), source: textValue(value.source ?? '玩家手动', LIMIT.source) }
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}
function decode(raw: Buffer): QQKnowledgeNode[] {
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
  if (!record(value) || !exactKeys(value, ['schema', 'nodes']) || value.schema !== 1 || !Array.isArray(value.nodes) || value.nodes.length > LIMIT.nodes) throw new Error(CORRUPT)
  const ids = new Set<string>()
  return value.nodes.map((node: unknown) => {
    if (!record(node) || !exactKeys(node, ['id', 'scope', 'subjectQQ', 'category', 'title', 'text', 'source', 'updatedAt'])
      || typeof node.id !== 'string' || typeof node.updatedAt !== 'string' || !Number.isFinite(Date.parse(node.updatedAt))
      || new Date(node.updatedAt).toISOString() !== node.updatedAt || ids.has(node.id)) throw new Error(CORRUPT)
    const clean = edit(node as unknown as Edit)
    if (clean.id !== node.id || clean.title !== node.title || clean.text !== node.text || clean.source !== node.source) throw new Error(CORRUPT)
    ids.add(node.id)
    return { ...clean, id: node.id, updatedAt: node.updatedAt }
  })
}
type Fact = Pick<QQKnowledgeNode, 'category' | 'title' | 'text'>
function extract(user: string): Fact[] {
  if (typeof user !== 'string' || user.length > LIMIT.input) return []
  const facts: Fact[] = []
  for (const clause of user.split(/[。！？!?；;\r\n，,]/u)) {
    if (sensitive(clause)) continue
    const match = /^(请叫我|以后叫我|我的名字是|我叫|我不喜欢|我喜欢|我们约定|记住)\s*[：:]?\s*(.+)$/u.exec(clause.trim())
    if (!match) continue
    const trigger = match[1]!, text = match[2]!.normalize('NFKC').replace(/\s+/gu, ' ').trim().replace(/[.。！!？?]+$/u, '')
    const name = ['请叫我', '以后叫我', '我的名字是', '我叫'].includes(trigger)
    if (!text || text.length > LIMIT.fact || (name && (text.length > 32 || !/^[\p{L}\p{N} ·_-]+$/u.test(text)))) continue
    facts.push({ category: name ? 'profile' : trigger.includes('喜欢') ? 'preference' : trigger === '我们约定' ? 'event' : 'knowledge',
      title: name ? '称呼' : trigger === '我喜欢' ? '喜欢' : trigger === '我不喜欢' ? '不喜欢' : trigger === '我们约定' ? '约定' : '记住', text })
  }
  return facts
}

/**
 * Bounded local data, never executable instructions. Scoped authorization is the
 * companion's responsibility. Synchronous, bounded IO serializes every edit on
 * the main event loop, including edits from separate store instances. Each write
 * fsyncs a private temporary file then atomically renames it. No chat transcript
 * or assistant answer is accepted. Callers render/retrieve nodes as untrusted data.
 */
export class QQKnowledgeStore {
  private readonly file: string
  constructor(private readonly directory: string, private readonly clock: () => number = Date.now) { this.file = path.join(directory, 'qq-knowledge.json') }
  private read(): QQKnowledgeNode[] {
    let handle: number
    try { handle = openSync(this.file, 'r') } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw new Error('Unable to read QQ knowledge store.')
    }
    try {
      const info = fstatSync(handle)
      if (!info.isFile() || info.size > LIMIT.bytes) throw new Error(CORRUPT)
      const bytes = Buffer.alloc(LIMIT.bytes + 1)
      let length = 0
      while (length < bytes.length) {
        const count = readSync(handle, bytes, length, bytes.length - length, null)
        if (count === 0) break
        length += count
      }
      if (length > LIMIT.bytes) throw new Error(CORRUPT)
      return decode(bytes.subarray(0, length))
    } catch { throw new Error(CORRUPT) } finally { closeSync(handle) }
  }
  private write(nodes: QQKnowledgeNode[]): void {
    const data = JSON.stringify({ schema: 1, nodes })
    if (nodes.length > LIMIT.nodes || Buffer.byteLength(data, 'utf8') > LIMIT.bytes) throw new Error('QQ knowledge store quota limit exceeded.')
    const temporary = `${this.file}.${randomUUID()}.tmp`
    let handle: number | undefined
    let created = false
    try {
      mkdirSync(this.directory, { recursive: true, mode: 0o700 })
      handle = openSync(temporary, 'wx', 0o600); created = true
      writeFileSync(handle, data, 'utf8'); fsyncSync(handle); closeSync(handle); handle = undefined
      renameSync(temporary, this.file)
    } catch { throw new Error('Unable to write QQ knowledge store.') }
    finally {
      if (handle !== undefined) { try { closeSync(handle) } catch { /* Preserve the sanitized error. */ } }
      if (created && existsSync(temporary)) { try { unlinkSync(temporary) } catch { /* Do not expose file contents in OS errors. */ } }
    }
  }
  list(scope: string): QQKnowledgeNode[] { scopeFields(scope); return this.read().filter(node => node.scope === scope) }
  save(value: Edit): QQKnowledgeNode {
    const clean = edit(value), nodes = this.read()
    const index = clean.id === undefined ? -1 : nodes.findIndex(node => node.id === clean.id && node.scope === clean.scope)
    if (clean.id !== undefined && index < 0) throw new Error(INVALID)
    const node: QQKnowledgeNode = { ...clean, id: clean.id ?? randomUUID(), updatedAt: new Date(this.clock()).toISOString() }
    if (index < 0) nodes.push(node); else nodes[index] = node
    this.write(nodes)
    return { ...node }
  }
  delete(scope: string, id?: string): void {
    scopeFields(scope); if (id !== undefined) nodeId(id)
    this.write(this.read().filter(node => node.scope !== scope || (id !== undefined && node.id !== id)))
  }
  /** Clear persisted scopes even after their targets have left the allowlist. */
  clearAccount(accountQQ: string): void {
    if (typeof accountQQ !== 'string' || !/^[1-9]\d{4,11}$/.test(accountQQ) || /\D/u.test(accountQQ)) throw new Error('Invalid QQ knowledge account.')
    this.write(this.read().filter(node => !node.scope.startsWith(`${accountQQ}:`)))
  }
  observe(scope: string, subjectQQ: string, userText: string): void {
    subject(scopeFields(scope), subjectQQ)
    const facts = extract(userText)
    if (!facts.length) return
    let nodes = this.read()
    for (const fact of facts) {
      const belongs = (node: QQKnowledgeNode) => node.scope === scope && node.subjectQQ === subjectQQ && node.category === fact.category
      // A manual profile remains the user's correction until explicitly edited.
      if (fact.category === 'profile' && nodes.some(node => belongs(node) && node.title === fact.title && node.source !== AUTO_SOURCE)) continue
      const previous = nodes.find(node => belongs(node) && node.source === AUTO_SOURCE && (fact.category === 'profile' ? node.title === fact.title : node.title === fact.title && node.text === fact.text))
      nodes = nodes.filter(node => !(belongs(node) && node.source === AUTO_SOURCE && (node.id === previous?.id
        || (fact.category === 'preference' && node.text === fact.text && ['喜欢', '不喜欢'].includes(node.title)))))
      nodes.push({ ...fact, scope, subjectQQ, id: previous?.id ?? randomUUID(), source: AUTO_SOURCE, updatedAt: new Date(this.clock()).toISOString() })
    }
    this.write(nodes)
  }
  retrieve(scope: string, subjectQQ: string, text: string, options: { topK: number; retentionDays: number }): QQKnowledgeNode[] {
    subject(scopeFields(scope), subjectQQ, true)
    if (!options || !Number.isInteger(options.topK) || options.topK < 1 || options.topK > 8 || !Number.isInteger(options.retentionDays)
      || options.retentionDays < 1 || options.retentionDays > 365 || typeof text !== 'string' || text.length > LIMIT.input) throw new Error('Invalid QQ knowledge retrieval options.')
    const query = normalized(text).trim(), tokens = new Set<string>()
    for (const run of query.match(/[\p{L}\p{N}]+/gu) ?? []) {
      if (/\p{Script=Han}/u.test(run)) { for (let i = 0; i < run.length; i++) tokens.add(run.slice(i, i + 2)) }
      else if (run.length > 1) tokens.add(run)
    }
    const time = this.clock()
    return this.read().filter(node => node.scope === scope && (node.subjectQQ === subjectQQ || (node.subjectQQ === '' && node.category === 'knowledge')))
      .map((node, index) => {
        const age = Math.max(0, time - Date.parse(node.updatedAt)) / 86400000
        const haystack = normalized(`${node.title} ${node.text}`)
        let match = query && haystack.includes(query) ? 12 : 0
        for (const token of tokens) if (haystack.includes(token)) match += token.length === 1 ? 0.5 : 3
        const basic = node.category === 'profile' ? 2 : node.category === 'preference' ? 1 : 0
        return { node, index, score: age >= options.retentionDays ? 0 : (match + basic) * Math.exp(-age / 30) }
      }).filter(item => item.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index).slice(0, options.topK).map(item => item.node)
  }
}
