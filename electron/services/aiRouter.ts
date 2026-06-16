import http from 'http'
import { chat as ollamaChat } from './ollama'

export interface AIMessage {
  role: string
  content: string
}

export async function aiChat(
  model: string,
  messages: AIMessage[],
  opts?: { ollamaUrl?: string; apiProvider?: string; apiKey?: string }
): Promise<string> {
  if (model.startsWith('api:')) {
    return await callApiProvider(model.slice(4), messages, opts?.apiProvider, opts?.apiKey)
  }
  return await callOllama(model, messages, opts?.ollamaUrl)
}

async function callOllama(model: string, messages: AIMessage[], baseUrl?: string): Promise<string> {
  return await ollamaChat(
    model,
    messages.map(m => ({ role: m.role, content: m.content })),
    undefined,
    baseUrl
  )
}

async function callApiProvider(
  model: string,
  messages: AIMessage[],
  provider?: string,
  apiKey?: string
): Promise<string> {
  const p = provider || 'openrouter'
  const key = apiKey || ''

  const endpoints: Record<string, string> = {
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    anthropic:  'https://api.anthropic.com/v1/messages',
    openai:     'https://api.openai.com/v1/chat/completions',
  }
  const url = endpoints[p] || endpoints.openrouter

  if (p === 'anthropic') {
    return await fetchAnthropic(url, key, model, messages)
  }
  return await fetchOpenAICompatible(url, key, model, messages)
}

function fetchAnthropic(
  url: string,
  apiKey: string,
  model: string,
  messages: AIMessage[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, max_tokens: 2048, messages })
    const urlObj = new URL(url)
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
      timeout: 120000,
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'Anthropic API error'))
          } else {
            resolve(parsed.content?.[0]?.text ?? '')
          }
        } catch {
          reject(new Error(`Failed to parse Anthropic response: ${data.substring(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

function fetchOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  messages: AIMessage[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 })
    const urlObj = new URL(url)
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'content-length': Buffer.byteLength(body),
      },
      timeout: 120000,
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'API error'))
          } else {
            resolve(parsed.choices?.[0]?.message?.content ?? '')
          }
        } catch {
          reject(new Error(`Failed to parse API response: ${data.substring(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

export async function listApiModels(provider?: string, apiKey?: string): Promise<string[]> {
  const p = provider || 'openrouter'
  const key = apiKey || ''
  if (!key) return []

  try {
    if (p === 'openrouter') {
      const data = await fetchJSON('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      })
      return (data.data ?? []).map((m: { id: string }) => `api:${m.id}`)
    }
    if (p === 'openai') {
      const data = await fetchJSON('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
      })
      return (data.data ?? [])
        .filter((m: { id: string }) => m.id.includes('gpt'))
        .map((m: { id: string }) => `api:${m.id}`)
    }
    if (p === 'anthropic') {
      return [
        'api:claude-opus-4-6',
        'api:claude-sonnet-4-6',
        'api:claude-haiku-4-5-20251001',
      ]
    }
  } catch {
    return []
  }
  return []
}

function fetchJSON(url: string, opts?: { headers?: Record<string, string> }): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: opts?.headers || {},
      timeout: 30000,
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { reject(new Error('JSON parse error')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}
