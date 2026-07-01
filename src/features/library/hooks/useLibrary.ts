import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AgentInfo, LibraryTab, OllamaStatus } from '../types'
import * as service from '../services/library.service'

export function useLibrary() {
  const queryClient = useQueryClient()
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [libTab, setLibTab] = useState<LibraryTab>('all')
  const selectedAgentRef = useRef(selectedAgentId)
  selectedAgentRef.current = selectedAgentId

  const { data: agents = [] } = useQuery({
    queryKey: ['library-agents'],
    queryFn: service.getAgents,
    refetchInterval: 15000,
  })

  const { data: favorites = [] } = useQuery({
    queryKey: ['library-favorites'],
    queryFn: service.getFavorites,
    refetchInterval: 15000,
  })

  const { data: ollamaStatus = { installed: false, running: false } } = useQuery<OllamaStatus>({
    queryKey: ['library-ollama'],
    queryFn: service.checkOllama,
    refetchInterval: 15000,
  })

  const { data: agentStatuses = {} } = useQuery({
    queryKey: ['library-agent-statuses', agents.map(a => a.id).join(',')],
    queryFn: async () => {
      const statuses: Record<string, string> = {}
      for (const a of agents) {
        try {
          const s = await service.getAgentStatus(a.id)
          statuses[a.id] = s.status
        } catch {
          statuses[a.id] = 'stopped'
        }
      }
      return statuses
    },
    enabled: agents.length > 0,
    refetchInterval: 15000,
  })

  const toggleFavoriteMutation = useMutation({
    mutationFn: (agentId: string) => service.toggleFavorite(agentId),
    onSuccess: (result) => {
      queryClient.setQueryData(['library-favorites'], result.favorites)
    },
  })

  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agent, currentStatus }: { agent: AgentInfo; currentStatus: string }) => {
      if (agent.runtimeType === 'external') return
      if (currentStatus === 'running') {
        await service.stopAgent(agent.id)
      } else {
        await service.startAgent(agent.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-agent-statuses'] })
      queryClient.invalidateQueries({ queryKey: ['library-agents'] })
    },
  })

  const displayAgents = libTab === 'favorites'
    ? agents.filter(a => favorites.includes(a.id))
    : agents

  const agent = agents.find(a => a.id === selectedAgentId) || null
  const agentStatus = agent ? (agentStatuses[agent.id] || 'stopped') : 'stopped'

  const selectAgent = useCallback((id: string) => {
    setSelectedAgentId(id)
  }, [])

  const toggleFavorite = useCallback((agentId: string) => {
    toggleFavoriteMutation.mutate(agentId)
  }, [toggleFavoriteMutation])

  const toggleAgent = useCallback((agent: AgentInfo) => {
    const currentStatus = agentStatuses[agent.id] || 'stopped'
    toggleAgentMutation.mutate({ agent, currentStatus })
  }, [agentStatuses, toggleAgentMutation])

  return {
    agents,
    favorites,
    ollamaStatus,
    agentStatuses,
    selectedAgentId,
    libTab,
    displayAgents,
    agent,
    agentStatus,
    setLibTab,
    selectAgent,
    toggleFavorite,
    toggleAgent,
  }
}
