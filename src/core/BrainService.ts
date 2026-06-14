import { fusionLoop, FusionLoopConfig } from '../agents/fusion/FusionLoopOrchestrator'

export interface BrainRequest {
  prompt: string
  useFusion: boolean
  useLoop: boolean
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
  }

  const { result, rounds, usedFusion } = await fusionLoop(req.prompt, config)

  return { result, rounds, usedFusion, timestamp: Date.now() }
}
