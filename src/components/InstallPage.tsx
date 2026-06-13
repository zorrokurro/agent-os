import { useEffect, useState } from 'react'
import type { HardwareInfo, InstallOptions, InstallProgress, ModelProvider, ProviderModel } from '../types'

function InstallPage({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const [hardware, setHardware] = useState<HardwareInfo | null>(null)
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([])
  const [options, setOptions] = useState<InstallOptions>({
    agents: ['hermes'], runMode: 'local', modelPreference: 'auto',
    providerId: 'ollama', modelId: '', apiKey: '', autoStart: true, selectedGpuIndex: -1,
  })
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<InstallProgress>({ step: '', percent: 0, message: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loadingProviders, setLoadingProviders] = useState(false)

  useEffect(() => {
    window.electronAPI.getHardwareInfo().then(setHardware)
    const cleanup = window.electronAPI.onInstallProgress((data) => { setProgress(data) })
    return () => cleanup()
  }, [])

  useEffect(() => {
    setLoadingProviders(true)
    Promise.all([
      window.electronAPI.getProviders(),
      window.electronAPI.getDefaultModel(options.providerId),
    ]).then(([provs, defaultModel]) => {
      setProviders(provs)
      const p = provs.find((x: ModelProvider) => x.id === options.providerId)
      setProviderModels(p?.models ?? [])
      if (!options.modelId) setOptions(o => ({ ...o, modelId: defaultModel }))
      setLoadingProviders(false)
    })
  }, [])

  const handleProviderChange = async (providerId: string) => {
    const [models, defaultModel] = await Promise.all([
      window.electronAPI.getProviderModels(providerId),
      window.electronAPI.getDefaultModel(providerId),
    ])
    setProviderModels(models)
    setOptions(o => ({ ...o, providerId: providerId as InstallOptions['providerId'], modelId: defaultModel }))
  }

  const startInstall = async () => {
    setInstalling(true); setError('')
    try {
      const result = await window.electronAPI.runInstallation(options)
      if (result.success) { setDone(true) } else { setError(result.error || '安裝失敗') }
    } catch (e) { setError(String(e)) } finally { setInstalling(false) }
  }

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div className="drag-region h-10 shrink-0" style={{ background: '#051424' }} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold text-white">安裝完成！</h1>
          <p style={{ color: '#958ea0' }}>AgentOS 已準備就緒</p>
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={onClose}>返回</button>
            <button className="btn-primary" onClick={onComplete}>完成</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="drag-region p-5 shrink-0" style={{ background: '#051424', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold no-drag" style={{ color: '#d0bcff' }}>AgentOS</div>
            <span className="text-xs px-2 py-0.5 rounded no-drag" style={{ background: 'rgba(208,188,255,0.15)', color: '#d0bcff' }}>安裝精靈</span>
          </div>
          <button className="no-drag text-sm transition-colors" onClick={onClose} style={{ color: '#958ea0' }}>
            ✕ 關閉
          </button>
        </div>
        <h1 className="text-xl font-bold text-white mt-2">安裝 Agent</h1>
        <p className="text-sm mt-1" style={{ color: '#958ea0' }}>回答幾個問題，我們將自動完成所有設定</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', minHeight: 0 }} className="space-y-5">
        {/* 硬體資訊 */}
        {hardware && (
          <div className="card">
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#d4e4fa' }}>📊 硬體偵測結果</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span style={{ color: '#958ea0' }}>CPU:</span> <span style={{ color: '#d4e4fa' }}>{hardware.cpu} ({hardware.cpuCores}C)</span></div>
              <div><span style={{ color: '#958ea0' }}>RAM:</span> <span style={{ color: '#d4e4fa' }}>{hardware.ramGB} GB</span></div>
              <div><span style={{ color: '#958ea0' }}>可用磁碟:</span> <span style={{ color: '#d4e4fa' }}>{hardware.diskFreeGB} GB</span></div>
              <div><span style={{ color: '#958ea0' }}>系統:</span> <span style={{ color: '#d4e4fa' }}>{hardware.windowsVersion}</span></div>
            </div>
          </div>
        )}

        {/* GPU 選擇 */}
        {(hardware && (hardware.allGpus.length > 0 || hardware.gpu !== 'Unknown GPU')) && (
          <div className="card">
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#d4e4fa' }}>🎮 選擇要使用的 GPU</h2>
            <div className="space-y-2">
              {(hardware.allGpus.length > 0 ? hardware.allGpus : [{
                model: hardware.gpu,
                vendor: '',
                vramMB: hardware.vramGB * 1024,
                isActive: true,
                isDedicated: false,
              }]).map((gpu, idx) => (
                <label key={idx}
                  className="flex items-center gap-3 p-3 rounded cursor-pointer transition"
                  style={{
                    background: options.selectedGpuIndex === idx ? 'rgba(208,188,255,0.1)' : '#0d1c2d',
                    border: `1px solid ${options.selectedGpuIndex === idx ? 'rgba(208,188,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <input type="radio" name="gpu-select" checked={options.selectedGpuIndex === idx}
                    onChange={() => setOptions(o => ({ ...o, selectedGpuIndex: idx }))} className="w-4 h-4" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#d4e4fa' }}>
                      {gpu.model}
                      {!gpu.isActive && <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(255,183,77,0.15)', color: '#ffb74d' }}>休眠中</span>}
                      {gpu.isDedicated && <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(208,188,255,0.15)', color: '#d0bcff' }}>獨立顯卡</span>}
                    </div>
                    <div className="text-xs" style={{ color: '#958ea0' }}>
                      VRAM：{gpu.vramMB > 0 ? `${Math.round(gpu.vramMB / 1024)} GB` : '無法偵測'}{gpu.vendor ? ` · ${gpu.vendor}` : ''}
                    </div>
                  </div>
                  {options.selectedGpuIndex === idx && <span className="ml-auto text-xs" style={{ color: '#d0bcff' }}>✓ 已選取</span>}
                </label>
              ))}
            </div>
            <div className="mt-3 p-2 rounded text-sm" style={{ background: 'rgba(208,188,255,0.08)' }}>
              <span style={{ color: '#d0bcff' }}>💡 提示：</span>
              <span className="text-xs ml-1" style={{ color: '#958ea0' }}>若獨顯顯示「休眠中」，其 VRAM 來自 WMI 資料，仍可用於模型推薦。</span>
            </div>
          </div>
        )}

        {/* Agent 選擇 */}
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#d4e4fa' }}>🤖 選擇要安裝的 Agent</h2>
          <label className="flex items-center gap-3 p-3 rounded cursor-pointer transition"
            style={{ background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)' }}>
            <input type="checkbox" checked={options.agents.includes('hermes')}
              onChange={(e) => {
                if (e.target.checked) setOptions(o => ({ ...o, agents: [...o.agents, 'hermes'] }))
                else setOptions(o => ({ ...o, agents: o.agents.filter(a => a !== 'hermes') }))
              }} className="w-4 h-4" />
            <div>
              <div style={{ color: '#d4e4fa' }} className="font-medium">Hermes Agent ⚡</div>
              <div className="text-xs" style={{ color: '#958ea0' }}>AI Agent 管理平台核心 — 任務委派、工具調用、記憶管理</div>
            </div>
          </label>
        </div>

        {/* 運行模式 */}
        <div className="card">
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#d4e4fa' }}>⚙️ AI 模型運行方式</h2>
          <div className="space-y-2">
            {[
              { value: 'local', label: '完全本地', desc: '使用 Ollama + 本地模型，資料不離開電腦' },
              { value: 'api', label: '使用 API', desc: '透過 API 使用雲端模型（OpenRouter、Claude、GPT 等）' },
              { value: 'both', label: '兩者都要', desc: '預設本地模型，API 作為備用' },
            ].map(m => (
              <label key={m.value} className="flex items-start gap-3 p-3 rounded cursor-pointer transition"
                style={{ background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)' }}>
                <input type="radio" name="runMode" value={m.value} checked={options.runMode === m.value}
                  onChange={() => setOptions(o => ({ ...o, runMode: m.value as InstallOptions['runMode'] }))} className="mt-1 w-4 h-4" />
                <div>
                  <div style={{ color: '#d4e4fa' }} className="font-medium">{m.label}</div>
                  <div className="text-xs" style={{ color: '#958ea0' }}>{m.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 模型提供者 — API / Both 模式 */}
        {(options.runMode === 'api' || options.runMode === 'both') && (
          <div className="card">
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#d4e4fa' }}>🌐 選擇 AI 提供者</h2>
            <div className="grid grid-cols-2 gap-3">
              {providers.filter(p => !p.requiresLocal).map(p => (
                <button key={p.id} onClick={() => handleProviderChange(p.id)}
                  className="text-left p-4 rounded transition"
                  style={{
                    background: options.providerId === p.id ? 'rgba(208,188,255,0.12)' : '#0d1c2d',
                    border: `1px solid ${options.providerId === p.id ? '#d0bcff' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <div style={{ color: '#d4e4fa' }} className="font-medium">{p.name}</div>
                  <div className="text-xs mt-1" style={{ color: '#958ea0' }}>{p.description}</div>
                  <div className="text-xs mt-2" style={{ color: '#494454' }}>{p.models.length} 個可用模型</div>
                </button>
              ))}
            </div>
            {!loadingProviders && providerModels.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-2" style={{ color: '#d4e4fa' }}>選擇模型</h3>
                <select value={options.modelId} onChange={(e) => setOptions(o => ({ ...o, modelId: e.target.value }))} className="w-full">
                  {providerModels.map(m => (<option key={m.id} value={m.id}>{m.name} — {m.description}</option>))}
                </select>
                {providerModels.find(m => m.id === options.modelId) && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {providerModels.find(m => m.id === options.modelId)!.strengths.map(s => (
                      <span key={s} className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(208,188,255,0.1)', color: '#d0bcff' }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#d4e4fa' }}>🔑 API Key</h3>
              <input type="password" value={options.apiKey} onChange={(e) => setOptions(o => ({ ...o, apiKey: e.target.value }))}
                className="w-full"
                placeholder={providers.find(p => p.id === options.providerId)?.requiresKey ? '請輸入 API Key' : 'Ollama 不需要 API Key'} />
            </div>
          </div>
        )}

        {/* 本地模型偏好 */}
        {(options.runMode === 'local' || options.runMode === 'both') && (
          <div className="card">
            <h2 className="text-sm font-semibold mb-3" style={{ color: '#d4e4fa' }}>🧠 本地模型偏好</h2>
            <select value={options.modelPreference} onChange={(e) => setOptions(o => ({ ...o, modelPreference: e.target.value as InstallOptions['modelPreference'] }))} className="w-full">
              <option value="auto">自動選擇（根據硬體推薦）</option>
              <option value="speed">速度優先（需要 8GB+ VRAM）</option>
              <option value="memory">省資源（適合 4GB 以下 VRAM）</option>
            </select>
            {hardware && (
              <div className="mt-3 p-2 rounded text-sm" style={{ background: 'rgba(208,188,255,0.08)' }}>
                <span style={{ color: '#d0bcff' }}>💡 推薦模型：</span>
                <span style={{ color: '#d4e4fa' }} className="font-mono">
                  {options.selectedGpuIndex >= 0
                    ? (hardware.allGpus[options.selectedGpuIndex]?.vramMB ?? 0) >= 8192 ? 'llama3.1:8b'
                      : (hardware.allGpus[options.selectedGpuIndex]?.vramMB ?? 0) >= 4096 ? 'mistral:7b' : 'qwen2.5:3b'
                    : hardware.recommendedModel}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 開機自動啟動 */}
        <div className="card">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={options.autoStart} onChange={(e) => setOptions(o => ({ ...o, autoStart: e.target.checked }))} className="w-4 h-4" />
            <div style={{ color: '#d4e4fa' }}>開機自動啟動 AgentOS</div>
          </label>
        </div>

        {/* 錯誤 */}
        {error && (
          <div className="p-4 rounded" style={{ background: 'rgba(196,58,58,0.15)', border: '1px solid rgba(196,58,58,0.3)' }}>
            <div className="font-semibold mb-1" style={{ color: '#c43a3a' }}>❌ 安裝失敗</div>
            <div className="text-sm" style={{ color: '#c43a3a' }}>{error}</div>
          </div>
        )}
      </div>

      {/* 底部按鈕 */}
      <div className="p-5 shrink-0" style={{ background: '#051424', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        {installing ? (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span style={{ color: '#958ea0' }}>{progress.message}</span>
              <span style={{ color: '#d0bcff' }}>{progress.percent}%</span>
            </div>
            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} /></div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button className="btn-primary" onClick={startInstall} disabled={options.agents.length === 0}>開始安裝</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default InstallPage
