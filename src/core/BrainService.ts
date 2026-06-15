import { fusionLoop, FusionLoopConfig } from '../agents/fusion/FusionLoopOrchestrator'
import type { ModelConfig } from '../hooks/useModelConfig'

export interface BrainRequest {
  prompt: string
  useFusion: boolean
  useLoop: boolean
  modelConfig?: ModelConfig
}

export interface BrainResponse {
  result: string
  rounds: number
  usedFusion: boolean
  timestamp: number
}

export async function sendToBrain(req: BrainRequest): Promise<BrainResponse> {
  const config: FusionLoopConfig = {
    useFusion: req.useFusion,
    useLoop: req.useLoop,
    panelA: req.modelConfig?.panelA,
    panelB: req.modelConfig?.panelB,
    judge: req.modelConfig?.judge,
    critic: req.modelConfig?.critic,
    refiner: req.modelConfig?.refiner,
  }

  const { result, rounds, usedFusion } = await fusionLoop(req.prompt, config)

  return { result, rounds, usedFusion, timestamp: Date.now() }
}
