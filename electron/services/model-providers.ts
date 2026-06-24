import type { ProviderModel, ModelProvider, ProviderId } from '../../shared/types'

export type { ProviderModel, ModelProvider, ProviderId }

const PROVIDERS: Record<ProviderId, ModelProvider> = {
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: '免費開源，完全本地運行，資料不離開電腦。需下載模型。',
    apiBase: 'http://localhost:11434',
    apiKeyEnvVar: '',
    requiresKey: false,
    requiresLocal: true,
    website: 'https://ollama.com',
    models: [
      { id: 'llama3.1:8b', name: 'Llama 3.1 8B', description: '高效能開源模型，適合日常任務', contextLength: 128000, strengths: ['一般問答', '程式碼', '推理'] },
      { id: 'mistral:7b', name: 'Mistral 7B', description: '輕量高效，良好的延遲表現', contextLength: 32000, strengths: ['一般問答', '多語言'] },
      { id: 'qwen2.5:7b', name: 'Qwen 2.5 7B', description: '中文支援極佳的開源模型', contextLength: 128000, strengths: ['中文', '推理', '程式碼'] },
      { id: 'qwen2.5:3b', name: 'Qwen 2.5 3B', description: '省資源的中文模型，適合低配裝置', contextLength: 32000, strengths: ['中文', '輕量'] },
      { id: 'qwen2.5:1.5b', name: 'Qwen 2.5 1.5B', description: '極輕量模型，CPU 也能運行', contextLength: 32000, strengths: ['中文', '極輕量'] },
      { id: 'llama3.2:3b', name: 'Llama 3.2 3B', description: '最新輕量 Llama 模型', contextLength: 128000, strengths: ['一般問答', '輕量'] },
      { id: 'nomic-embed-text', name: 'Nomic Embed Text', description: '嵌入向量模型，用於記憶檢索', contextLength: 8192, strengths: ['嵌入', '檢索'] },
    ],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '統一的 API 閘道，存取數百種模型（含 Claude、GPT、Llama 等）。需 API Key。',
    apiBase: 'https://openrouter.ai/api/v1',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    requiresKey: true,
    requiresLocal: false,
    website: 'https://openrouter.ai',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: '頂尖推理與程式碼能力', contextLength: 200000, strengths: ['推理', '程式碼', '長上下文'] },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: '快速輕量，適合日常任務', contextLength: 200000, strengths: ['快速', '輕量', '一般問答'] },
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: '多模態全能模型', contextLength: 128000, strengths: ['推理', '多模態', '創意'] },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: '經濟高效的小型模型', contextLength: 128000, strengths: ['一般問答', '經濟'] },
      { id: 'meta-llama/llama-3.1-8b', name: 'Llama 3.1 8B', description: '高效開源模型', contextLength: 128000, strengths: ['一般問答', '程式碼'] },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', description: 'Google 快速模型', contextLength: 1000000, strengths: ['快速', '長上下文', '多模態'] },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', description: '高效能中文與推理', contextLength: 64000, strengths: ['中文', '推理', '程式碼'] },
      { id: 'qwen/qwen-2.5-72b', name: 'Qwen 2.5 72B', description: '頂尖中文大模型', contextLength: 128000, strengths: ['中文', '推理'] },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 系列模型，以安全、推理、長上下文著稱。需 API Key。',
    apiBase: 'https://api.anthropic.com/v1',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    requiresKey: true,
    requiresLocal: false,
    website: 'https://anthropic.com',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '最新旗艦，頂尖推理與程式碼', contextLength: 200000, strengths: ['推理', '程式碼', '長上下文'] },
      { id: 'claude-3.5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '穩定版旗艦模型', contextLength: 200000, strengths: ['推理', '程式碼'] },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: '快速經濟，低延遲', contextLength: 200000, strengths: ['快速', '輕量'] },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: '終極推理能力', contextLength: 200000, strengths: ['深度推理', '研究'] },
    ],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT 系列模型，業界標準。需 API Key。',
    apiBase: 'https://api.openai.com/v1',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    requiresKey: true,
    requiresLocal: false,
    website: 'https://openai.com',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: '全能多模態模型', contextLength: 128000, strengths: ['推理', '多模態', '創意'] },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '小型經濟模型', contextLength: 128000, strengths: ['一般問答', '經濟'] },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '舊版旗艦，穩定可靠', contextLength: 128000, strengths: ['推理', '穩定'] },
      { id: 'o3-mini', name: 'o3-mini', description: '推理專用模型，擅長邏輯', contextLength: 200000, strengths: ['推理', '邏輯', '科學'] },
    ],
  },
}

export function getProviders(): ModelProvider[] {
  return Object.values(PROVIDERS)
}

export function getProvider(id: ProviderId): ModelProvider | undefined {
  return PROVIDERS[id]
}

export function getProviderModels(providerId: ProviderId): ProviderModel[] {
  return PROVIDERS[providerId]?.models ?? []
}

export function getDefaultModel(providerId: ProviderId): string {
  const p = PROVIDERS[providerId]
  if (!p || p.models.length === 0) return ''
  return p.models[0].id
}
