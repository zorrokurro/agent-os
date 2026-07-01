/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Councillor, Deliberation } from '../types'

const api = () => window.electronAPI as any

export async function getSettings(): Promise<any> {
  return api().getSettings()
}

export async function getCouncillorResponses(
  apiKey: string,
  model: string,
  question: string,
  mode: Deliberation['mode'],
): Promise<any[]> {
  return api().councilGetCouncillorResponses(apiKey, model, question, mode)
}

export async function getPeerRankings(
  apiKey: string,
  model: string,
  question: string,
  responses: Array<{ id: string; response: string }>,
): Promise<Record<string, number>> {
  return api().councilGetPeerRankings(apiKey, model, question, responses)
}

export async function getChairmanSynthesis(
  apiKey: string,
  model: string,
  question: string,
  responses: Array<{ id: string; response: string }>,
  rankings: Record<string, number>,
): Promise<string> {
  return api().councilGetChairmanSynthesis(apiKey, model, question, responses, rankings)
}
