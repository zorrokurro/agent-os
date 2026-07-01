import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Deliberation, Councillor, PageView } from '../types'
import { DEFAULT_COUNCILLORS, DEFAULT_CHAIRMAN, generateId } from '../types'
import * as service from '../services/council.service'

export function useCouncil() {
  const queryClient = useQueryClient()

  const [view, setView] = useState<PageView>('list')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<Deliberation['mode']>('general')
  const [isRunning, setIsRunning] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')

  const { data: settings } = useQuery({
    queryKey: ['council-settings'],
    queryFn: service.getSettings,
    staleTime: Infinity,
  })

  useEffect(() => {
    if (settings) {
      setApiKey((settings.apiKey as string) || '')
      setModel((settings.modelId as string) || '')
    }
  }, [settings])

  const { data: deliberations = [] } = useQuery({
    queryKey: ['council-deliberations'],
    queryFn: () => Promise.resolve([] as Deliberation[]),
    staleTime: Infinity,
  })

  const [localDeliberations, setLocalDeliberations] = useState<Deliberation[]>([])

  const allDeliberations = [...localDeliberations, ...deliberations]

  const activeDeliberation = allDeliberations.find(d => d.id === activeId) || null

  const runDeliberation = useCallback(async (
    id: string,
    q: string,
    m: Deliberation['mode'],
    councillors: Councillor[],
    chairman: Councillor,
  ) => {
    try {
      const councillorResponses = await service.getCouncillorResponses(apiKey, model, q, m)

      setLocalDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d
        return {
          ...d,
          status: 'stage1',
          councillors: d.councillors.map((c) => {
            const resp = councillorResponses.find((r: any) => r.id === c.id)
            return {
              ...c,
              status: resp?.error ? 'error' as const : 'done' as const,
              response: resp?.response || '',
              error: resp?.error,
            }
          }),
        }
      }))

      const validResponses = councillorResponses.filter((r: any) => r.response && !r.error)
      const rankings = await service.getPeerRankings(apiKey, model, q, validResponses)

      setLocalDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d
        return { ...d, status: 'stage2', rankings }
      }))

      const synthesis = await service.getChairmanSynthesis(apiKey, model, q, validResponses, rankings)

      setLocalDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d
        return {
          ...d,
          status: 'complete',
          chairman: { ...d.chairman!, status: 'done', response: synthesis },
          synthesis,
          completedAt: new Date().toISOString(),
        }
      }))
    } catch (e) {
      console.error('Deliberation error:', e)
      setLocalDeliberations(prev => prev.map(d => {
        if (d.id !== id) return d
        return { ...d, status: 'error', completedAt: new Date().toISOString() }
      }))
    } finally {
      setIsRunning(false)
    }
  }, [apiKey, model])

  const startDeliberation = useCallback(() => {
    if (!question.trim() || isRunning || !apiKey || !model) return

    const id = generateId()
    const now = new Date().toISOString()

    const councillors: Councillor[] = DEFAULT_COUNCILLORS.map(c => ({
      ...c,
      status: 'thinking' as const,
      response: '',
    }))

    const chairman: Councillor = {
      ...DEFAULT_CHAIRMAN,
      status: 'idle' as const,
      response: '',
    }

    const deliberation: Deliberation = {
      id,
      question: question.trim(),
      mode,
      status: 'stage1',
      councillors,
      chairman,
      rankings: {},
      synthesis: '',
      createdAt: now,
      completedAt: null,
    }

    setLocalDeliberations(prev => [deliberation, ...prev])
    setActiveId(id)
    setView('detail')
    setIsRunning(true)

    runDeliberation(id, question.trim(), mode, councillors, chairman)
  }, [question, mode, isRunning, apiKey, model, runDeliberation])

  const canStart = !!question.trim() && !isRunning && !!apiKey && !!model

  return {
    view,
    setView,
    activeId,
    setActiveId,
    question,
    setQuestion,
    mode,
    setMode,
    isRunning,
    apiKey,
    model,
    allDeliberations,
    activeDeliberation,
    canStart,
    startDeliberation,
  }
}
