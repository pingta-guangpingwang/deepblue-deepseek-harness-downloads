import { QQKnowledgeStore } from '../../src/main/qq-knowledge-store'
import type { CharacterKnowledgeAdapter } from '../../src/shared/character-plugin-types'

export const abi = 1
export const id = 'character-knowledge'
export const version = '1.0.0'
/** Shares the proven storage format; built artifact contains the engine, no host code import. */
export function createKnowledge(directory: string): CharacterKnowledgeAdapter {
  return new QQKnowledgeStore(directory)
}
