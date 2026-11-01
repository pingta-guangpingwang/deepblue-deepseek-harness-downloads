import { qqPersonaBuiltins, qqPersonaFieldDefinitions, validateQQPersonaInput, type QQPersonaFields } from './qq-personas'

export const characterSchemaVersion = 1 as const
export interface CharacterInput {
  roleId?: string
  name: string
  description: string
  templateId?: string
  /** Content-addressed local image, resolved only by the existing main-side image service. */
  avatarId?: string
  /** Independent local cover; never included in the model persona. */
  coverId?: string
  persona: { fields: QQPersonaFields; additionalPrompt: string }
  model: { mode: 'inherit' | 'override'; providerId?: string; modelId?: string }
  preferences: { remember: boolean; startWithLauncher: boolean; keepRunningOnMinimize: boolean }
  channels: { qq: boolean; desktopPet: boolean; voice: boolean }
  /** Per-role assignments only. Installation status belongs to the global extension service. */
  extensions: Array<{ id: string; enabled: boolean }>
}
export interface CharacterProfile extends CharacterInput {
  schemaVersion: 1
  kind: 'character-managed'
  roleId: string
  projectId: string
  threadId?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
}
export interface CharacterTemplate { id: string; name: string; description: string; fields: QQPersonaFields; additionalPrompt: string }
export const characterTemplates: ReadonlyArray<CharacterTemplate> = Object.freeze(qqPersonaBuiltins.map(({ id, name, description, fields, additionalPrompt }) =>
  Object.freeze({ id, name, description, fields, additionalPrompt })))

export function createCharacterInput(templateId = 'builtin-gentle'): CharacterInput {
  const template = characterTemplates.find(entry => entry.id === templateId)
  if (!template) throw new Error('Invalid character template.')
  return { name: template.name, description: template.description, templateId,
    persona: { fields: { ...template.fields }, additionalPrompt: template.additionalPrompt }, model: { mode: 'inherit' },
    preferences: { remember: false, startWithLauncher: false, keepRunningOnMinimize: false },
    channels: { qq: false, desktopPet: false, voice: false }, extensions: [] }
}

const invalid = () => new Error('Invalid character input or limits exceeded.')
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key))
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value)
export const isCharacterRoleId = (value: unknown): value is string => typeof value === 'string' && /^role-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value) && value.length === 41
export const isCharacterThreadId = (value: unknown): value is string => text(value, 256) && value.trim() === value && !/[\\/]/u.test(value)

/** Renderer input is a complete settings snapshot, never runtime metadata or a path. */
export function validateCharacterInput(value: unknown): CharacterInput {
  if (!record(value) || !exactKeys(value, ['roleId', 'name', 'description', 'templateId', 'avatarId', 'coverId', 'persona', 'model', 'preferences', 'channels', 'extensions'])
    || (value.roleId !== undefined && !isCharacterRoleId(value.roleId))
    || (value.templateId !== undefined && !characterTemplates.some(template => template.id === value.templateId))
    || !record(value.persona) || !exactKeys(value.persona, ['fields', 'additionalPrompt'])
    || !record(value.model) || !exactKeys(value.model, ['mode', 'providerId', 'modelId'])
    || (value.model.mode !== 'inherit' && value.model.mode !== 'override')
    || !record(value.preferences) || !exactKeys(value.preferences, ['remember', 'startWithLauncher', 'keepRunningOnMinimize'])
    || !['remember', 'startWithLauncher', 'keepRunningOnMinimize'].every(key => typeof value.preferences![key as never] === 'boolean')
    || !record(value.channels) || !exactKeys(value.channels, ['qq', 'desktopPet', 'voice'])
    || !['qq', 'desktopPet', 'voice'].every(key => typeof value.channels![key as never] === 'boolean')
    || !Array.isArray(value.extensions) || value.extensions.length > 100) throw invalid()
  if (value.model.mode === 'inherit' ? Object.keys(value.model).length !== 1
    : !text(value.model.providerId, 128) || !text(value.model.modelId, 256)) throw invalid()
  const extensionIds = new Set<string>()
  for (const extension of value.extensions) {
    if (!record(extension) || !exactKeys(extension, ['id', 'enabled']) || !text(extension.id, 100)
      || !/^[a-z0-9][a-z0-9._-]*$/u.test(extension.id) || typeof extension.enabled !== 'boolean' || extensionIds.has(extension.id)) throw invalid()
    extensionIds.add(extension.id)
  }
  try {
    const persona = validateQQPersonaInput({ name: value.name, description: value.description, fields: value.persona.fields,
      additionalPrompt: value.persona.additionalPrompt, ...(value.avatarId !== undefined ? { avatarId: value.avatarId } : {}) })
    if (value.avatarId !== undefined && (typeof value.avatarId !== 'string' || value.avatarId.length !== 64)) throw invalid()
    if (value.coverId !== undefined && (typeof value.coverId !== 'string' || !/^[a-f0-9]{64}$/u.test(value.coverId))) throw invalid()
    return structuredClone({ name: persona.name, description: persona.description,
      ...(value.roleId !== undefined ? { roleId: value.roleId } : {}), ...(value.templateId !== undefined ? { templateId: value.templateId as string } : {}),
      ...(persona.avatarId ? { avatarId: persona.avatarId } : {}), ...(value.coverId ? { coverId: value.coverId } : {}), persona: { fields: persona.fields, additionalPrompt: persona.additionalPrompt },
      model: value.model, preferences: value.preferences, channels: value.channels, extensions: value.extensions }) as CharacterInput
  } catch { throw invalid() }
}

/** Explicit projection for editing a persisted profile; runtime identities never become editable. */
export function characterInputFromProfile(value: CharacterInput): CharacterInput {
  const { roleId, name, description, templateId, avatarId, coverId, persona, model, preferences, channels, extensions } = value
  return validateCharacterInput({ ...(roleId !== undefined ? { roleId } : {}), name, description,
    ...(templateId !== undefined ? { templateId } : {}), ...(avatarId !== undefined ? { avatarId } : {}), ...(coverId !== undefined ? { coverId } : {}), persona, model, preferences, channels, extensions })
}

/** Same validated field definitions as QQ, with neutral local-chat framing. Image metadata is excluded. */
export function compileCharacterPersona(value: CharacterInput): string {
  const { persona } = characterInputFromProfile(value)
  return ['你是 AI 伙伴。使用简体中文，清楚区分角色设定和现实，不冒充真人，不泄露其他会话内容。',
    ...qqPersonaFieldDefinitions.filter(({ key }) => persona.fields[key].trim()).map(({ key, label }) => `${label}：${persona.fields[key].trim()}`),
    ...(persona.additionalPrompt.trim() ? [`补充要求：${persona.additionalPrompt.trim()}`] : [])].join('\n\n')
}
