import { useState, useEffect } from 'react'

export interface ModelConfig {
  panelA:  string
  panelB:  string
  judge:   string
  critic:  string
  refiner: string
  hermes:  string
}

const DEFAULTS: ModelConfig = {
  panelA:  'qwen2.5:14b',
  panelB:  'deepseek-r1:14b',
  judge:   'qwen2.5:14b',
  critic:  'llama3.1:8b',
  refiner: 'qwen2.5:14b',
  hermes:  'qwen2.5:14b',
}

export function useModelConfig() {
  const [config, setConfigState] = useState<ModelConfig>(DEFAULTS)
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const [saved, available] = await Promise.all([
        window.electronAPI.getModelConfig(),
        window.electronAPI.listModels()
      ])
      setModels(available)
      setConfigState({
        panelA:  saved.panelA  || DEFAULTS.panelA,
        panelB:  saved.panelB  || DEFAULTS.panelB,
        judge:   saved.judge   || DEFAULTS.judge,
        critic:  saved.critic  || DEFAULTS.critic,
        refiner: saved.refiner || DEFAULTS.refiner,
        hermes:  saved.hermes  || DEFAULTS.hermes,
      })
      setLoading(false)
    }
    init()
  }, [])

  async function saveConfig(newConfig: ModelConfig) {
    setConfigState(newConfig)
    await window.electronAPI.setModelConfig(newConfig as unknown as Record<string, string>)
  }

  return { config, models, loading, saveConfig }
}
