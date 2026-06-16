import { useEffect, useState } from 'react'
import type { HardwareInfo, InstallOptions, InstallProgress, ModelProvider, ProviderModel } from '../types'

interface AgentInfo {
  id: string
  name: string
  description: string
  icon?: string
  installed: boolean
}

interface GithubAnalysis {
  name: string
  description: string
  stack: string
  installCommands: string[]
}

const STEPS = ['硬體偵測', '選擇 Agent', '模式設定', '安裝']

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
  const [currentStep, setCurrentStep] = useState(0)
  const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([])
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['hermes'])
  const [githubUrl, setGithubUrl] = useState('')
  const [githubAnalysis, setGithubAnalysis] = useState<GithubAnalysis | null>(null)
  const [githubLoading, setGithubLoading] = useState(false)
  const [githubInstalling, setGithubInstalling] = useState(false)
  const [githubLogs, setGithubLogs] = useState<string[]>([])

  const loadAvailableAgents = async () => {
    try {
      const agents = await window.electronAPI.getAgents()
      setAvailableAgents(agents)
    } catch {
      setAvailableAgents([{ id: 'hermes', name: 'Hermes', description: 'AI Agent 管理平台核心', installed: false }])
    }
  }

  const handleAnalyze = async () => {
    if (!githubUrl.trim()) return
    setGithubLoading(true)
    setGithubAnalysis(null)
    try {
      const result = await window.electronAPI.githubAnalyze(githubUrl.trim())
      setGithubAnalysis(result)
    } catch (e) {
      setGithubLogs([`分析失敗：${e}`])
    } finally {
      setGithubLoading(false)
    }
  }

  const handleGithubInstall = async () => {
    if (!githubUrl.trim()) return
    setGithubInstalling(true)
    setGithubLogs([])
    try {
      await window.electronAPI.githubInstall(githubUrl.trim(), (line: string) => {
        setGithubLogs(prev => [...prev, line])
      })
      setGithubLogs(prev => [...prev, '✓ 安裝完成'])
      loadAvailableAgents()
    } catch (e) {
      setGithubLogs(prev => [...prev, `✗ 安裝失敗：${e}`])
    } finally {
      setGithubInstalling(false)
    }
  }

  useEffect(() => {
    window.electronAPI.getHardwareInfo().then((h) => {
      setHardware(h)
      if (h) setCurrentStep(1)
    })
    const cleanup = window.electronAPI.onInstallProgress((data) => { setProgress(data) })
    return () => cleanup()
  }, [])

  useEffect(() => {
    loadAvailableAgents()
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

  const toggleAgent = (agentId: string) => {
    setSelectedAgents(prev => {
      const next = prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId]
      setOptions(o => ({ ...o, agents: next }))
      return next
    })
  }

  useEffect(() => {
    if (selectedAgents.length > 0 && currentStep === 1) {
      setCurrentStep(2)
    }
  }, [selectedAgents, currentStep])

  const startInstall = async () => {
    setInstalling(true); setError(''); setCurrentStep(3)
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

      {/* GitHub 匯入區塊 */}
      <div style={{ padding: '16px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#958ea0', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          從 GitHub 匯入 Agent
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={githubUrl}
            onChange={e => setGithubUrl(e.target.value)}
            placeholder="https://github.com/username/repo"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)', background: '#0d1c2d', color: '#d4e4fa', fontSize: 13 }}
          />
          <button
            onClick={handleAnalyze}
            disabled={!githubUrl.trim() || githubLoading}
            style={{ padding: '8px 16px', borderRadius: 6, background: '#7F77DD', border: 'none', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: githubLoading ? 0.6 : 1 }}
          >
            {githubLoading ? '分析中...' : '分析'}
          </button>
        </div>

        {githubAnalysis && (
          <div style={{ marginTop: 12, padding: 12, background: '#0d1c2d', borderRadius: 6, border: '0.5px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#d4e4fa' }}>{githubAnalysis.name}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 20, background: '#EEEDFE', color: '#534AB7' }}>
                {githubAnalysis.stack}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#958ea0', marginBottom: 10, lineHeight: 1.5 }}>
              {githubAnalysis.description}
            </div>
            <button
              onClick={handleGithubInstall}
              disabled={githubInstalling}
              style={{ padding: '7px 16px', borderRadius: 6, background: '#7F77DD', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}
            >
              {githubInstalling ? '安裝中...' : '安裝此 Agent'}
            </button>
          </div>
        )}

        {githubLogs.length > 0 && (
          <div style={{ marginTop: 8, padding: '8px 10px', background: '#0a0a0a', borderRadius: 6, fontFamily: 'monospace', fontSize: 11, color: '#aaa', maxHeight: 120, overflowY: 'auto' }}>
            {githubLogs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        )}
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '16px 24px', borderBottom: '0.5px solid rgba(255,255,255,0.1)' }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: currentStep > i ? '#7F77DD' : currentStep === i ? '#EEEDFE' : '#0d1c2d',
                border: `0.5px solid ${currentStep >= i ? '#7F77DD' : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 500,
                color: currentStep > i ? '#fff' : currentStep === i ? '#534AB7' : '#958ea0'
              }}>
                {currentStep > i ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, color: currentStep === i ? '#534AB7' : '#958ea0' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: '0.5px', background: currentStep > i ? '#7F77DD' : 'rgba(255,255,255,0.1)', margin: '0 8px', marginBottom: 16 }} />
            )}
          </div>
        ))}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {availableAgents.map(agent => (
              <div
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: `0.5px solid ${selectedAgents.includes(agent.id) ? '#7F77DD' : 'rgba(255,255,255,0.1)'}`,
                  background: selectedAgents.includes(agent.id) ? '#EEEDFE' : '#0d1c2d',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: selectedAgents.includes(agent.id) ? '#534AB7' : '#d4e4fa' }}>
                  {agent.icon || '🤖'} {agent.name}
                </div>
                <div style={{ fontSize: 11, color: '#958ea0', marginTop: 2 }}>
                  {agent.description}
                </div>
                {agent.installed && (
                  <span style={{ fontSize: 10, color: '#0F6E56', marginTop: 4, display: 'block' }}>✓ 已安裝</span>
                )}
              </div>
            ))}
          </div>
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
            <button className="btn-primary" onClick={startInstall} disabled={selectedAgents.length === 0}>開始安裝</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default InstallPage
