import type { QQKnowledgeNode, QQKnowledgeRetrievalOptions } from './qq-enhancements'

/** Publisher-trusted catalog, supplied by the main process, never accepted from renderer IPC. */
export interface CharacterPluginRelease {
  id: 'character-knowledge' | 'qq-channel'
  kind: 'native-adapter'
  version: string
  abi: 1
  name: string
  bytes: number
  sha256: string
  mirrors: string[]
}
export interface CharacterPluginStatus {
  id: CharacterPluginRelease['id']
  name: string
  installed: boolean
  activeVersion?: string
  previousVersion?: string
  latestVersion: string
  bytes: number
  error?: string
}
export interface CharacterKnowledgeAdapter {
  list(scope: string): QQKnowledgeNode[]
  save(value: Pick<QQKnowledgeNode, 'scope' | 'subjectQQ' | 'category' | 'title' | 'text'> & { id?: string; source?: string }): QQKnowledgeNode
  delete(scope: string, id?: string): void
  clearAccount(accountQQ: string): void
  observe(scope: string, subjectQQ: string, userText: string): void
  retrieve(scope: string, subjectQQ: string, text: string, options: QQKnowledgeRetrievalOptions): QQKnowledgeNode[]
}
export type CharacterKnowledgeFactory = (directory: string) => CharacterKnowledgeAdapter
export interface CharacterKnowledgeModule {
  abi: 1
  id: 'character-knowledge'
  version: string
  createKnowledge: CharacterKnowledgeFactory
}
