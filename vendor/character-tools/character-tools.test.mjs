import { test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { mkdtemp, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import SandboxPolicy from '@deepseek-ai/dsh-sandbox-policy'
import SandboxedFileSystem from '@deepseek-ai/dsh-fs-sandbox'
import { startCharacterTools } from './index.mjs'

test('real DSH registry scopes tools to an exact agent and revokes them without global registration', async () => {
  const ctx = new Context(), role = { id: 'role-thread' }, other = { id: 'ordinary-thread' }
  ctx.plugin(SystemPrompt); ctx.plugin(ToolRuntime)
  ctx.plugin(SessionProjections); ctx.plugin(SandboxPolicy, { mode: 'read-only', workspaceRoot: process.cwd() })
  ctx.plugin(SandboxedFileSystem, { root: process.cwd() })
  ctx.provide('agents'); ctx.set('agents', { get: id => id === role.id ? role : id === other.id ? other : undefined })
  let bindings = [{ threadId: role.id, lease: 'lease-one' }], last
  let handle
  let created
  ctx.plugin({ inject: ['tools', 'agents'], apply: async child => { created = startCharacterTools(child, { url: 'http://127.0.0.1:43101', token: 'a'.repeat(64), pollMs: 10000, onError: error => { throw error },
    request: async (route, body) => { if (route === '/bindings') return { bindings }; last = { route, body }; return { result: { accepted: true } } } }); handle = await created } })
  await new Promise(resolve => setImmediate(resolve))
  await created
  try {
    await handle.sync()
    assert.equal(ctx.tools.schemas(role).length, 6)
    assert.equal(ctx.tools.schemas(other).length, 0)
    assert.equal(ctx.tools.schemas().length, 0)
    const result = await ctx.tools.execute({ id: 'call-one', name: 'companion_play_action', arguments: { action: 'dance' }, agent: role, signal: new AbortController().signal })
    assert.equal(result.isError, false)
    assert.equal(ctx.sandboxPolicy.resolve().mode, 'read-only')
    await assert.rejects(ctx.fs.writeText({ displayPath: 'must-not-write.txt' }, 'forbidden'), error => error.code === 'FS_SANDBOX_DENIED')
    assert.equal(last.route, '/invoke'); assert.equal(last.body.threadId, role.id); assert.equal(last.body.lease, 'lease-one')
    const blocked = await ctx.tools.execute({ id: 'call-two', name: 'companion_get_state', arguments: {}, agent: other, signal: new AbortController().signal })
    assert.equal(blocked.isError, true)
    bindings = []; await handle.sync()
    assert.equal(ctx.tools.schemas(role).length, 0)
  } finally { await handle.dispose(); await ctx.fiber.dispose() }
})

test('isolated profile plugin resolves the owned host dependency and calls the real authenticated loopback bridge', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'character-tools-wire-'))
  const built = await build({ entryPoints: ['src/main/character-tools-bridge.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
  await writeFile(path.join(root, 'bridge.mjs'), built.outputFiles[0].contents)
  await copyFile('vendor/character-tools/index.mjs', path.join(root, 'plugin.mjs'))
  const { CharacterToolsBridge } = await import(pathToFileURL(path.join(root, 'bridge.mjs')).href)
  const { startCharacterTools: start } = await import(pathToFileURL(path.join(root, 'plugin.mjs')).href)
  const calls = [], bridge = new CharacterToolsBridge({ invoke: async (...args) => { calls.push(args); return { accepted: true } } })
  const ctx = new Context(), role = { id: `session-character-${'a'.repeat(40)}` }
  ctx.plugin(SystemPrompt); ctx.plugin(ToolRuntime)
  ctx.provide('agents', { get: id => id === role.id ? role : undefined })
  let handle, created
  try {
    await bridge.start(); bridge.registerSession('role-11111111-1111-4111-8111-111111111111', role.id)
    const env = bridge.environment()
    ctx.plugin({ inject: ['tools', 'agents'], apply: async child => { created = start(child, { url: env.DEEPBLUE_CHARACTER_TOOLS_URL, token: env.DEEPBLUE_CHARACTER_TOOLS_TOKEN,
      anchor: path.resolve('node_modules/@deepseek-ai/dsh/package.json'), pollMs: 10000 }); handle = await created } })
    await new Promise(resolve => setImmediate(resolve)); await created; await handle.sync(); await bridge.waitReady(role.id, 500)
    const result = await ctx.tools.execute({ id: 'real-wire-call', name: 'companion_play_action', arguments: { action: 'dance' }, agent: role, signal: new AbortController().signal })
    assert.equal(result.isError, false); assert.equal(calls[0][0], 'role-11111111-1111-4111-8111-111111111111')
    assert.equal(calls[0][1], 'companion_play_action')
    bridge.unregisterSession(role.id)
    const revoked = await ctx.tools.execute({ id: 'revoked-call', name: 'companion_get_state', arguments: {}, agent: role, signal: new AbortController().signal })
    assert.equal(revoked.isError, true); assert.equal(calls.length, 1)
  } finally { await handle?.dispose(); await ctx.fiber.dispose(); await bridge.close(); await rm(root, { recursive: true, force: true }) }
})
