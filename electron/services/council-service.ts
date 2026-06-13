import { net } from 'electron'

// ---------------------------------------------------------------------------
// Council Service — calls OpenRouter API with different system prompts
// ---------------------------------------------------------------------------

interface CouncillorConfig {
  id: string
  name: string
  systemPrompt: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionChoice {
  message: { content: string }
  finish_reason: string
}

interface ChatCompletionResponse {
  choices: ChatCompletionChoice[]
  error?: { message: string }
}

// Council members with distinct thinking perspectives
export const COUNCILLOR_CONFIGS: CouncillorConfig[] = [
  {
    id: 'builder',
    name: 'Builder',
    systemPrompt: `You are "Builder", a practical implementation expert on a multi-agent council.
Your role: Evaluate ideas from a hands-on, build-it perspective.
- Focus on: feasibility, implementation steps, technical risks, required resources
- Be direct and specific: suggest concrete tools, libraries, patterns
- Identify blockers early: what could go wrong during implementation?
- Consider: time estimates, skill requirements, dependencies
- Tone: practical, action-oriented, pragmatic
- Always respond in the same language as the user's question.
- Keep your response under 300 words. Be concise and actionable.`,
  },
  {
    id: 'optimizer',
    name: 'Optimizer',
    systemPrompt: `You are "Optimizer", a performance and efficiency specialist on a multi-agent council.
Your role: Evaluate ideas from a performance, scalability, and optimization perspective.
- Focus on: bottlenecks, resource usage, scalability limits, technical debt
- Ask: Is there a faster/cleaner/more efficient way?
- Consider: memory footprint, CPU usage, network latency, caching strategies
- Flag over-engineering: simpler solutions that achieve 80% of the result with 20% effort
- Tone: analytical, data-driven, efficiency-focused
- Always respond in the same language as the user's question.
- Keep your response under 300 words. Be concise and actionable.`,
  },
  {
    id: 'curator',
    name: 'Curator',
    systemPrompt: `You are "Curator", an architecture and design quality guardian on a multi-agent council.
Your role: Evaluate ideas from an architectural, design patterns, and long-term maintainability perspective.
- Focus on: system cohesion, coupling, separation of concerns, design principles
- Consider: how does this fit the existing architecture? Does it introduce anti-patterns?
- Think about: future extensibility, code readability, developer experience
- Evaluate: does this follow SOLID principles? Is it testable?
- Tone: thoughtful, big-picture, quality-focused
- Always respond in the same language as the user's question.
- Keep your response under 300 words. Be concise and actionable.`,
  },
  {
    id: 'news',
    name: 'News',
    systemPrompt: `You are "News", a market awareness and trend analysis specialist on a multi-agent council.
Your role: Evaluate ideas from an industry trends, competitor landscape, and user demand perspective.
- Focus on: what are others doing? What's trending? What do users actually want?
- Consider: market timing, competitive differentiation, user adoption risk
- Think about: ecosystem effects, community reception, documentation and onboarding
- Ask: is this solving a real problem? Are there existing solutions?
- Tone: informed, market-aware, user-centric
- Always respond in the same language as the user's question.
- Keep your response under 300 words. Be concise and actionable.`,
  },
  {
    id: 'supervisor',
    name: 'Supervisor',
    systemPrompt: `You are "Supervisor", a project management and risk assessment specialist on a multi-agent council.
Your role: Evaluate ideas from a project management, timeline, and risk perspective.
- Focus on: cost-benefit analysis, risk-reward ratio, rollback planning
- Consider: what's the MVP? What can be deferred? What's the critical path?
- Think about: dependencies, milestones, success metrics, exit criteria
- Evaluate: is the scope right? Are we over/under-committing?
- Tone: structured, risk-aware, planning-focused
- Always respond in the same language as the user's question.
- Keep your response under 300 words. Be concise and actionable.`,
  },
]

export const CHAIRMAN_CONFIG: CouncillorConfig = {
  id: 'supervisor_chairman',
  name: 'Supervisor (Chairman)',
  systemPrompt: `You are the "Chairman" of a multi-agent council. Five councillors have each provided their perspective on a question. Your job is to synthesise their insights into a clear, actionable recommendation.

Your synthesis should:
1. Summarise each councillor's key point (1 sentence each)
2. Identify areas of agreement and disagreement
3. Weigh the strongest arguments
4. Provide a final recommendation with clear reasoning
5. List 3-5 concrete next steps
6. Note the top 2-3 risks to monitor

Structure your response in Markdown format.
Always respond in the same language as the user's question.
Be comprehensive but concise (under 500 words).`,
}

// Call OpenRouter API
async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<string> {
  const body = JSON.stringify({
    model,
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  })

  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://agentos.local',
        'X-Title': 'AgentOS Council',
      },
    })

    let responseData = ''

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString()
      })
      response.on('end', () => {
        try {
          const parsed = JSON.parse(responseData) as ChatCompletionResponse
          if (parsed.error) {
            reject(new Error(`OpenRouter API error: ${parsed.error.message}`))
          } else if (parsed.choices && parsed.choices.length > 0) {
            resolve(parsed.choices[0].message.content)
          } else {
            reject(new Error('No response from OpenRouter API'))
          }
        } catch (e) {
          reject(new Error(`Failed to parse API response: ${responseData.substring(0, 200)}`))
        }
      })
    })

    request.on('error', (err) => {
      reject(new Error(`Network error: ${err.message}`))
    })

    request.write(body)
    request.end()
  })
}

// Get councillor responses (Stage 1 - parallel)
export async function getCouncillorResponses(
  apiKey: string,
  model: string,
  question: string,
  mode: string,
): Promise<Array<{ id: string; name: string; response: string; error?: string }>> {
  const modeContext: Record<string, string> = {
    general: 'Provide your general analysis and recommendation.',
    review: 'Focus your analysis on code quality, security, and potential bugs.',
    design: 'Focus your analysis on architecture, design patterns, and system design.',
    plan: 'Focus your analysis on implementation roadmap, milestones, and resource planning.',
    research: 'Focus your analysis on deep investigation, evidence, and best practices.',
  }

  const userMessage = `${modeContext[mode] || modeContext.general}\n\nQuestion: ${question}`

  // Call all councillors in parallel
  const promises = COUNCILLOR_CONFIGS.map(async (config) => {
    try {
      const response = await callOpenRouter(apiKey, model, [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userMessage },
      ])
      return { id: config.id, name: config.name, response }
    } catch (e) {
      return { id: config.id, name: config.name, response: '', error: String(e) }
    }
  })

  return Promise.all(promises)
}

// Peer review ranking (Stage 2 - each councillor ranks others)
export async function getPeerRankings(
  apiKey: string,
  model: string,
  question: string,
  councillorResponses: Array<{ id: string; name: string; response: string }>,
): Promise<Record<string, number>> {
  // Build a prompt asking the model to rank responses
  const responseList = councillorResponses
    .map((c, i) => `[${String.fromCharCode(65 + i)}] ${c.name}:\n${c.response}`)
    .join('\n\n')

  const rankingPrompt = `You are evaluating ${councillorResponses.length} councillor responses to a question.
Rank them from best to worst (1 = best). Consider: insight quality, actionability, originality, and relevance.

Question: ${question}

Responses:
${responseList}

Return ONLY a JSON object mapping councillor names to their rank (1 = best).
Example: {"Builder": 3, "Optimizer": 1, "Curator": 2, "News": 5, "Supervisor": 4}
No other text. Just the JSON.`

  try {
    const response = await callOpenRouter(apiKey, model, [
      { role: 'system', content: 'You are a ranking assistant. Return only valid JSON.' },
      { role: 'user', content: rankingPrompt },
    ])

    // Parse the JSON response
    const jsonMatch = response.match(/\{[^}]+\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Convert ranks to Borda scores (higher = better)
      const scores: Record<string, number> = {}
      for (const [name, rank] of Object.entries(parsed)) {
        const councillor = councillorResponses.find(c => c.name === name)
        if (councillor) {
          scores[councillor.id] = councillorResponses.length - (rank as number) + 1
        }
      }
      return scores
    }
  } catch {
    // Fallback: assign scores based on order
  }

  // Fallback: equal scores
  const scores: Record<string, number> = {}
  councillorResponses.forEach((c, i) => {
    scores[c.id] = councillorResponses.length - i
  })
  return scores
}

// Chairman synthesis (Stage 3)
export async function getChairmanSynthesis(
  apiKey: string,
  model: string,
  question: string,
  councillorResponses: Array<{ id: string; name: string; response: string }>,
  rankings: Record<string, number>,
): Promise<string> {
  const sorted = Object.entries(rankings).sort(([, a], [, b]) => b - a)
  const rankedList = sorted
    .map(([id, score]) => {
      const c = councillorResponses.find(x => x.id === id)
      return `- ${c?.name || id} (score: ${score}):\n${c?.response || 'No response'}`
    })
    .join('\n\n')

  const synthesisPrompt = `Question: ${question}

Here are the ranked councillor responses:
${rankedList}

Synthesise these perspectives into a comprehensive recommendation. Follow the Chairman's guidelines.`

  try {
    return await callOpenRouter(apiKey, model, [
      { role: 'system', content: CHAIRMAN_CONFIG.systemPrompt },
      { role: 'user', content: synthesisPrompt },
    ])
  } catch (e) {
    return `## Chairman's Synthesis (Error)\n\nFailed to generate synthesis: ${String(e)}\n\n### Individual Responses\n\n${councillorResponses.map(c => `**${c.name}:** ${c.response}`).join('\n\n')}`
  }
}
