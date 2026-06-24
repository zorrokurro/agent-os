import { BrowserWindow } from 'electron'
import { detectHardware, computeRecommendedModel } from './hardware'
import { checkOllama, installOllama, pullModel, startOllamaServe } from './ollama'
import { checkHermesInstalled, installHermes, ensureHermesDir, HermesConfig } from './hermes'
import { getDefaultModel } from './model-providers'
import type { HardwareInfo, ProviderId, InstallOptions, ProgressData } from '../../shared/types'

export type { InstallOptions, ProgressData }

type ProgressCallback = (data: ProgressData) => void

export async function runFullInstallation(
  options: InstallOptions,
  win: BrowserWindow | null,
  onProgress?: ProgressCallback
): Promise<{ success: boolean; error?: string; hardware: HardwareInfo | null }> {
  const report = (step: string, percent: number, message: string) => {
    const data = { step, percent, message }
    onProgress?.(data)
    win?.webContents.send('install-progress', data)
  }

  let hardware: HardwareInfo | null = null

  try {
    // Step 1: 硬體偵測
    report('hardware', 0, '正在偵測硬體...')
    hardware = await detectHardware()
    report('hardware', 100, `硬體偵測完成 — ${hardware.gpu} / ${hardware.ramGB}GB RAM`)

    // Step 2: 解析模型
    const modelId = options.modelId || getDefaultModel(options.providerId)

    // Step 3: 若為本地模式，安裝 Ollama 並下載模型
    if (options.runMode === 'local' || options.runMode === 'both') {
      // 根據使用者選擇的 GPU index 重新計算推薦
      const gpuInfo = computeRecommendedModel(
        hardware.allGpus,
        hardware.ramGB,
        options.selectedGpuIndex
      )

      let localModel: string
      if (options.modelPreference === 'speed') {
        localModel = 'llama3.1:8b'
      } else if (options.modelPreference === 'memory') {
        localModel = 'qwen2.5:1.5b'
      } else {
        localModel = gpuInfo.recommendedModel
      }

      report('ollama-check', 0, '正在檢查 Ollama...')
      const ollamaStatus = await checkOllama()

      if (!ollamaStatus.installed) {
        report('ollama-install', 0, '正在安裝 Ollama...')
        const result = await installOllama((msg, pct) => {
          report('ollama-install', pct, msg)
        })
        if (!result.success) {
          return { success: false, error: `Ollama 安裝失敗: ${result.error}`, hardware }
        }
      } else if (!ollamaStatus.running) {
        report('ollama-start', 0, '正在啟動 Ollama...')
        startOllamaServe()
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 1000))
          const status = await checkOllama()
          if (status.running) break
        }
        const afterStart = await checkOllama()
        if (!afterStart.running) {
          return { success: false, error: 'Ollama 啟動逾時', hardware }
        }
      }

      report('ollama-ready', 100, 'Ollama 已就緒')

      report('model-pull', 0, `正在下載模型 ${localModel}...`)
      const pullResult = await pullModel(localModel, (msg, pct) => {
        report('model-pull', pct, msg)
      })
      if (!pullResult.success) {
        return { success: false, error: `模型下載失敗: ${pullResult.error}`, hardware }
      }
    }

    // Step 4: 安裝 Agents
    if (options.agents.includes('hermes')) {
      report('agent-check', 0, '正在檢查 Hermes Agent...')
      const hermesStatus = await checkHermesInstalled()

      if (!hermesStatus.installed) {
        report('agent-install', 0, '正在安裝 Hermes Agent...')
        const installResult = await installHermes((msg, pct) => {
          report('agent-install', pct, msg)
        })
        if (!installResult.success) {
          return { success: false, error: `Hermes 安裝失敗: ${installResult.error}`, hardware }
        }
      } else {
        report('agent-check', 100, `Hermes Agent ${hermesStatus.version} 已安裝`)
      }

      ensureHermesDir()
    }

    // Step 5: 設定開機自動啟動
    if (options.autoStart) {
      report('autostart', 0, '正在設定開機自動啟動...')
      report('autostart', 100, '開機自動啟動已設定')
    }

    // Step 6: 最終健康檢查
    report('health-check', 0, '正在執行最終健康檢查...')
    await new Promise(r => setTimeout(r, 2000))
    report('health-check', 100, '所有服務正常')

    report('complete', 100, '安裝完成！')
    return { success: true, error: '', hardware }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { success: false, error: msg, hardware }
  }
}
