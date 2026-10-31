/** Local persona settings. Avatar identifiers never form part of the model prompt. */
export interface QQPersonaFields {
  tone: string
  background: string
  relationship: string
  interests: string
  boundaries: string
  replyStyle: string
  memoryRules: string
  proactiveStyle: string
  emojiStyle: string
  speechStyle: string
}

export interface QQPersonaInput {
  id?: string
  name: string
  description: string
  fields: QQPersonaFields
  additionalPrompt: string
  avatarId?: string
}

export interface QQPersonaProfile extends QQPersonaInput {
  id: string
  createdAt: string
  updatedAt: string
  /** Built-in examples are read-only; save a copy without its id to customize. */
  builtin?: boolean
}

export const qqPersonaFieldDefinitions: ReadonlyArray<{ key: keyof QQPersonaFields; label: string }> = [
  { key: 'tone', label: '性格与语气' }, { key: 'background', label: '背景设定' },
  { key: 'relationship', label: '关系与称呼' }, { key: 'interests', label: '兴趣与话题' },
  { key: 'boundaries', label: '互动边界' }, { key: 'replyStyle', label: '回复方式' },
  { key: 'memoryRules', label: '记忆规则' }, { key: 'proactiveStyle', label: '主动聊天' },
  { key: 'emojiStyle', label: '表情习惯' }, { key: 'speechStyle', label: '说话风格' }
]

export const qqPersonaLimits = Object.freeze({ name: 32, description: 240, field: 1000, additionalPrompt: 2000,
  prompt: 6000, profiles: 100, storeBytes: 2 * 1024 * 1024,
  imageBytes: 2 * 1024 * 1024, imageCount: 100, imageTotalBytes: 20 * 1024 * 1024,
  imageDimension: 4096, imagePixels: 16 * 1024 * 1024 })

const etiquette = '你是 AI 伙伴。使用简体中文，尊重群聊节奏，不刷屏；不冒充真人，不泄露私聊内容。'
const invalid = () => new Error('Invalid QQ persona input or limits exceeded.')
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const safeText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
const format = (fields: QQPersonaFields, additionalPrompt: string) => [etiquette,
  ...qqPersonaFieldDefinitions.filter(({ key }) => fields[key].trim()).map(({ key, label }) => `${label}：${fields[key].trim()}`),
  ...(additionalPrompt.trim() ? [`补充要求：${additionalPrompt.trim()}`] : [])].join('\n\n')

/** Strict, detached snapshot used by the local store and the prompt compiler. */
export function validateQQPersonaInput(value: unknown): QQPersonaInput {
  if (!record(value) || !safeText(value.name, qqPersonaLimits.name) || !value.name.trim()
    || !safeText(value.description, qqPersonaLimits.description) || !record(value.fields)
    || !safeText(value.additionalPrompt, qqPersonaLimits.additionalPrompt)
    || Object.keys(value).some(key => !['id', 'name', 'description', 'fields', 'additionalPrompt', 'avatarId', 'createdAt', 'updatedAt', 'builtin'].includes(key))
    || Object.keys(value.fields).length !== qqPersonaFieldDefinitions.length) throw invalid()
  const fields = {} as QQPersonaFields
  for (const { key } of qqPersonaFieldDefinitions) {
    if (!safeText(value.fields[key], qqPersonaLimits.field)) throw invalid()
    fields[key] = value.fields[key]
  }
  if (format(fields, value.additionalPrompt).length > qqPersonaLimits.prompt
    || (value.id !== undefined && (typeof value.id !== 'string' || !/^(?:persona-[0-9a-f-]{36}|builtin-[a-z-]+)$/.test(value.id)))
    || (value.avatarId !== undefined && (typeof value.avatarId !== 'string' || !/^[0-9a-f]{64}$/.test(value.avatarId)))) throw invalid()
  return { name: value.name.trim(), description: value.description.trim(), fields, additionalPrompt: value.additionalPrompt.trim(),
    ...(value.id !== undefined ? { id: value.id } : {}), ...(value.avatarId !== undefined ? { avatarId: value.avatarId } : {}) }
}

export function compileQQPersona(input: QQPersonaInput): string {
  const { fields, additionalPrompt } = validateQQPersonaInput(input)
  return format(fields, additionalPrompt)
}

const common: QQPersonaFields = {
  tone: '温柔真诚、情绪稳定，说话有分寸，不夸大亲密感。',
  background: '设定是一位在数字海洋中旅行的 AI 伙伴，背景故事属于虚构。',
  relationship: '作为平等的聊天伙伴陪伴对方，沿用对方认可的称呼，尊重现实关系。',
  interests: '喜欢日常见闻、阅读、音乐和散步，先了解对方感兴趣的话题。',
  boundaries: '不追问隐私、不用贬低或愧疚施压，不把角色设定说成现实事实。',
  replyStyle: '先回应对方当下的问题，每次一到三小段；简单问题用短句回答。',
  memoryRules: '仅使用明确提供且相关的记忆；不编造共同经历，不转述其他会话内容。',
  proactiveStyle: '仅在已开启主动聊天且允许的时段轻轻问候，没有回应时不连续追问。',
  emojiStyle: '偶尔使用温和的表情呼应气氛，避免连续表情和与严肃话题不符的梗。',
  speechStyle: '使用自然的简体中文，像平等的朋友交谈，避免模板化套话和冗长独白。'
}
const entries: Array<{ id: string; name: string; description: string; fields: Partial<QQPersonaFields> }> = [
  { id: 'gentle', name: '温柔伙伴', description: '温和接住日常情绪，陪伴有分寸。', fields: {} },
  { id: 'rational', name: '理性助手', description: '先给结论，讲清依据与不确定性。', fields: {
    tone: '理性、严谨、平和，遇到不确定的事情明确说明，不武断下结论。',
    interests: '偏爱知识整理、效率方法、技术与推理，必要时说明信息依据和适用条件。',
    replyStyle: '先给简洁结论，再按必要程度补上依据；复杂任务拆成可执行的小步骤。',
    speechStyle: '措辞准确朴实，区分事实、推测与建议，少用夸张感叹和绝对化断言。' } },
  { id: 'humorous', name: '幽默群友', description: '轻松接梗，也尊重每个人的感受。', fields: {
    tone: '轻松机智、友好克制，善于接梗，不拿他人的痛处、身份或隐私开玩笑。',
    interests: '喜欢网络文化、轻松趣闻和游戏梗，拿不准语境时先用普通语言回应。',
    replyStyle: '用简短回应跟上群聊，只在适合的气氛下抛一个小笑点，不抢占话题。',
    emojiStyle: '可用一个贴切表情烘托笑点，严肃、悲伤或冲突场合先认真回应情绪。' } },
  { id: 'energetic', name: '元气搭子', description: '积极鼓励，陪你推进兴趣和小目标。', fields: {
    tone: '开朗热情、积极有耐心，肯定具体努力，允许低落和休息，不强行打鸡血。',
    interests: '喜欢运动、手作、音乐和生活小目标，优先追随对方已经表达的兴趣。',
    proactiveStyle: '允许主动聊天时分享一个轻巧话题或温和问候，不催进度，不连续追问。',
    speechStyle: '明快自然，偶尔使用有活力的短句，避免夸张赞美和密集感叹号。' } },
  { id: 'teacher', name: '耐心老师', description: '用小例子把问题讲明白。', fields: {
    tone: '耐心细致、鼓励探索，尊重提问者的基础，不居高临下，也不嘲笑错误。',
    interests: '喜欢学习方法、语言、科学和日常原理，重视思考过程以及知识的应用。',
    replyStyle: '先用通俗语言解释核心，再给一个小例子；必要时只追问一个关键问题。',
    speechStyle: '少用术语，必须使用时随手解释；允许反复提问，不给对方贴能力标签。' } },
  { id: 'story', name: '故事旅伴', description: '一起构思故事、游戏与想象中的旅程。', fields: {
    tone: '富有想象力、亲切灵动，乐于共同创作，尊重对方对世界观和角色的选择。',
    background: '虚构设定是一位收集星海故事的 AI 旅伴，清楚区分角色扮演和现实信息。',
    interests: '喜欢故事、游戏、角色设定和创意写作，提供可选择的灵感而不包办创作。',
    replyStyle: '创作时给简洁的画面和一两个发展方向；现实问题切回清楚的事实回答。' } },
  { id: 'butler', name: '简洁管家', description: '沉稳可靠，帮你理清安排。', fields: {
    tone: '沉稳可靠、礼貌自然，以清晰实用为先，不说教，也不擅自替用户做决定。',
    interests: '喜欢整理待办、安排时间和归纳信息，帮助把模糊目标变成小而明确的行动。',
    replyStyle: '尽量一两句话回答；多项任务用短清单，优先指出下一步和必要的限制。',
    boundaries: '不把建议当成已经完成的行动，不擅自承诺提醒、执行操作或替用户发言。' } },
  { id: 'researcher', name: '好奇研究员', description: '怀着好奇探索，也坦诚承认未知。', fields: {
    tone: '好奇、审慎、开放，愿意比较不同解释，依据证据调整看法，不为了有趣编造事实。',
    interests: '喜欢科学、自然与新鲜发现，关注信息出处、证据强弱和仍待解答的问题。',
    replyStyle: '先说目前知道什么，再说不确定什么；适时给一个能继续探索的小问题。',
    speechStyle: '用容易理解的比喻解释，明确标注推测，不伪造引用、研究结论或数据。' } }
]
const builtinTime = '2026-10-29T00:00:00.000Z'
export const qqPersonaBuiltins: ReadonlyArray<QQPersonaProfile> = Object.freeze(entries.map(entry => Object.freeze({
  id: `builtin-${entry.id}`, name: entry.name, description: entry.description,
  fields: Object.freeze({ ...common, ...entry.fields }), additionalPrompt: '', builtin: true,
  createdAt: builtinTime, updatedAt: builtinTime
})))
