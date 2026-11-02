/** Native adapters; these packages never execute downloaded AstrBot/Python code. */
export const qqEnhancementIds = ['living-memory', 'tree-memory', 'proactive-chat', 'meme-wiki', 'meme-manager', 'gradio-tts'] as const
export type QQEnhancementId = typeof qqEnhancementIds[number]
export interface QQEnhancementSettings {
  memoryTopK: number
  memoryRetentionDays: number
  autoRemember: boolean
  proactiveTargets: string[]
  proactiveIntervalMinutes: number
  quietStart: number
  quietEnd: number
  proactiveDailyLimit: number
  proactiveUnansweredLimit: number
  proactiveEnabled: boolean
  emojiProbability: number
  emojiCooldownSeconds: number
  emojiTags: string[]
  ttsEnabled: boolean
  ttsPrivateOnly: boolean
  ttsBaseUrl: string
  ttsApiName: string
  ttsVoice: string
  ttsArguments: string
}
export const defaultQQEnhancementSettings: QQEnhancementSettings = {
  memoryTopK: 5, memoryRetentionDays: 90, autoRemember: true,
  proactiveTargets: [], proactiveIntervalMinutes: 180, quietStart: 23, quietEnd: 8,
  proactiveDailyLimit: 2, proactiveUnansweredLimit: 1, proactiveEnabled: false,
  emojiProbability: 25, emojiCooldownSeconds: 90, emojiTags: [],
  ttsEnabled: false, ttsPrivateOnly: true, ttsBaseUrl: 'http://127.0.0.1:7860',
  ttsApiName: 'predict', ttsVoice: '', ttsArguments: '["$text", "$voice"]'
}
export interface QQEnhancementSource { title: string; url?: string; version?: string; commit?: string; verified: boolean; mirrorUrl?: string }
export interface QQEnhancementCatalogEntry {
  id: QQEnhancementId; name: string; description: string; version: string
  sources: QQEnhancementSource[]; downloadUrl: string; sha256: string; bytes: number; encoding?: 'gzip'
}
export interface QQEnhancementPackage {
  schema: 1; id: QQEnhancementId; version: string
  /** Data only, never scripts, commands, executables, telemetry or remote settings. */
  glossary?: Array<{ term: string; explanation: string; source: string }>
  notices?: string[]
}
export interface QQEnhancementStatus extends QQEnhancementCatalogEntry { installed: boolean; enabled: boolean }
export interface QQKnowledgeNode {
  id: string; scope: string; subjectQQ: string; category: 'profile' | 'preference' | 'event' | 'knowledge'
  title: string; text: string; source: string; updatedAt: string
}
export interface QQKnowledgeRetrievalOptions {
  topK: number
  retentionDays: number
  /** Omitted preserves legacy retrieval; an empty selection returns no references. */
  sourceTypes?: Array<'automatic' | 'manual'>
}
export type QQEnhancementAction =
  | { type: 'enhancement-list' }
  | { type: 'enhancement-install'; id: QQEnhancementId }
  | { type: 'enhancement-toggle'; id: QQEnhancementId; enabled: boolean }
  | { type: 'enhancement-uninstall'; id: QQEnhancementId }
  | { type: 'enhancement-settings'; settings: QQEnhancementSettings }
  | { type: 'knowledge-list'; scope: string }
  | { type: 'knowledge-save'; scope: string; subjectQQ: string; category: QQKnowledgeNode['category']; title: string; text: string; id?: string }
  | { type: 'knowledge-delete'; scope: string; id?: string }
  | { type: 'tts-preview'; text: string }
export interface QQEnhancementResult {
  enhancements?: QQEnhancementStatus[]
  enhancementSettings?: QQEnhancementSettings
  knowledge?: QQKnowledgeNode[]
  knowledgeSavedId?: string
  audioUrl?: string
}
