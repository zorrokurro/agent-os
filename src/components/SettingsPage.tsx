import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import type { ModelProvider } from '../types'

interface Settings {
  autoStart: boolean; autoUpdate: boolean; darkMode: boolean; language: string;
  providerId: string; modelId: string; ollamaUrl: string; apiKey: string;
  memoryPath: string; checkInterval: number;
  hermesUrl: string;
  discordToken: string; discordChannelId: string; discordEnabled: boolean;
  obsidianVault: string; obsidianLiveSync: boolean;
}

interface UpdateStatus {
  state: string; version?: string; releaseDate?: string; percent?: number; message?: string;
}

function SettingsPage() {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<Settings>({
    autoStart: true, autoUpdate: true, darkMode: true, language: 'zh-TW',
    providerId: 'ollama', modelId: 'openai/gpt-4o-mini', ollamaUrl: 'http://localhost:11434',
    apiKey: '', memoryPath: 'C:\\AgentOS\\Memory', checkInterval: 30,
    hermesUrl: 'http://localhost:8080',
    discordToken: '', discordChannelId: '', discordEnabled: false,
    obsidianVault: '', obsidianLiveSync: false,
  })
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [providerModels, setProviderModels] = useState<{ id: string; name: string }[]>([])
  const [saved, setSaved] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
  const [hermesTestResult, setHermesTestResult] = useState<string | null>(null)
  const [hermesTesting, setHermesTesting] = useState(false)
  const [discordTestResult, setDiscordTestResult] = useState<string | null>(null)
  const [discordTesting, setDiscordTesting] = useState(false)
  const [obsidianTestResult, setObsidianTestResult] = useState<string | null>(null)
  const [obsidianTesting, setObsidianTesting] = useState(false)
  const [obsidianSyncing, setObsidianSyncing] = useState(false)
  const [obsidianSyncResult, setObsidianSyncResult] = useState<string | null>(null)

  useEffect(() => { loadSettings(); loadProviders() }, [])

  useEffect(() => {
    const unsub = window.electronAPI.onUpdateStatus((data) => {
      setUpdateStatus(data)
    })
    return unsub
  }, [])

  const loadSettings = async () => {
    try {
      const s = await window.electronAPI.getSettings()
      if (s) {
        setSettings(prev => ({ ...prev, ...s }))
        if (typeof s.language === 'string' && s.language !== i18n.language) {
          i18n.changeLanguage(s.language)
          localStorage.setItem('language', s.language)
        }
      }
    } catch (e) { console.error(e) }
  }
  const loadProviders = async () => {
    try { setProviders(await window.electronAPI.getProviders()) } catch (e) { console.error(e) }
  }
  const handleProviderChange = async (providerId: string) => {
    setSettings(prev => ({ ...prev, providerId }))
    try {
      const models = await window.electronAPI.getProviderModels(providerId)
      setProviderModels(models.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })))
    } catch { setProviderModels([]) }
  }
  const saveSettings = async () => {
    try {
      await window.electronAPI.setSettings(settings as unknown as Record<string, unknown>)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { console.error(e) }
  }
  const testHermes = async () => {
    setHermesTesting(true)
    setHermesTestResult(null)
    try {
      const result = await window.electronAPI.testHermesConnection(settings.hermesUrl)
      setHermesTestResult(result.message)
    } catch (e) {
      setHermesTestResult(`❌ 連線失敗：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setHermesTesting(false)
    }
  }
  const testDiscord = async () => {
    setDiscordTesting(true)
    setDiscordTestResult(null)
    try {
      const result = await window.electronAPI.discordTest()
      setDiscordTestResult(result.message)
    } catch (e) {
      setDiscordTestResult(`❌ 連線失敗：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDiscordTesting(false)
    }
  }
  const testObsidian = async () => {
    setObsidianTesting(true)
    setObsidianTestResult(null)
    try {
      const result = await window.electronAPI.obsidianTest(settings.obsidianVault || '')
      setObsidianTestResult(result.message)
    } catch (e) {
      setObsidianTestResult(`❌ 測試失敗：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setObsidianTesting(false)
    }
  }
  const syncObsidian = async () => {
    setObsidianSyncing(true)
    setObsidianSyncResult(null)
    try {
      const result = await window.electronAPI.obsidianSync()
      const parts: string[] = []
      if (result.imported > 0) parts.push(`匯入 ${result.imported} 筆`)
      if (result.updated > 0) parts.push(`更新 ${result.updated} 筆`)
      if (result.exported > 0) parts.push(`匯出 ${result.exported} 筆`)
      if (parts.length === 0) parts.push('無變更')
      setObsidianSyncResult(`✅ 同步完成：${parts.join('，')}`)
    } catch (e) {
      setObsidianSyncResult(`❌ 同步失敗：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setObsidianSyncing(false)
    }
  }
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    if (key === 'language') {
      i18n.changeLanguage(value as string)
      localStorage.setItem('language', value as string)
    }
  }
  const handleCheckUpdate = async () => {
    setUpdateStatus({ state: 'checking' })
    await window.electronAPI.checkForUpdates()
  }
  const handleDownload = async () => {
    await window.electronAPI.downloadUpdate()
  }
  const handleRestartInstall = async () => {
    await window.electronAPI.quitAndInstall()
  }
  const selectedProvider = providers.find(p => p.id === settings.providerId)

  const renderUpdateStatus = () => {
    if (!updateStatus) return null
    switch (updateStatus.state) {
      case 'checking':
        return <span style={{ fontSize: '13px', color: '#958ea0' }}>{t('settings.update.checking')}</span>
      case 'available':
        return <span style={{ fontSize: '13px', color: '#ffb74d' }}>{t('settings.update.available', { version: updateStatus.version })}</span>
      case 'not-available':
        return <span style={{ fontSize: '13px', color: '#5c8a2a' }}>{t('settings.update.notAvailable')}</span>
      case 'downloading':
        return <span style={{ fontSize: '13px', color: '#adc6ff' }}>{t('settings.update.downloading', { percent: updateStatus.percent })}</span>
      case 'downloaded':
        return <span style={{ fontSize: '13px', color: '#5c8a2a' }}>{t('settings.update.downloaded')}</span>
      case 'error':
        return <span style={{ fontSize: '13px', color: '#ffb4ab' }}>{t('settings.update.error', { message: updateStatus.message })}</span>
      default:
        return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>{t('settings.title')}</h1>
          <p style={{ fontSize: '13px', color: '#958ea0', marginTop: 4 }}>{t('settings.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {saved && <span style={{ fontSize: '13px', color: '#5c8a2a' }}>{t('settings.saved')}</span>}
          <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }} onClick={saveSettings}>{t('settings.save')}</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
          {/* General */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>{t('settings.general.title')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {([
                { key: 'autoStart' as const, label: t('settings.general.autoStart'), desc: t('settings.general.autoStartDesc') },
                { key: 'autoUpdate' as const, label: t('settings.general.autoUpdate'), desc: t('settings.general.autoUpdateDesc') },
                { key: 'darkMode' as const, label: t('settings.general.darkMode'), desc: t('settings.general.darkModeDesc') },
              ]).map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: '14px', color: '#d4e4fa' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', color: '#494454' }}>{item.desc}</div>
                  </div>
                  <input type="checkbox" checked={settings[item.key] as boolean} onChange={e => updateSetting(item.key, e.target.checked)} style={{ accentColor: '#a078ff' }} />
                </label>
              ))}
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>{t('settings.general.language')}</div>
                <select value={settings.language} onChange={e => updateSetting('language', e.target.value)} style={{ width: '200px' }}>
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Provider */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>{t('settings.provider.title')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>{t('settings.provider.providerId')}</div>
                <select value={settings.providerId} onChange={e => handleProviderChange(e.target.value)} style={{ width: '240px' }}>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {selectedProvider?.requiresKey && (
                <div>
                  <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>{t('settings.provider.apiKey')}</div>
                  <input type="password" value={settings.apiKey} onChange={e => updateSetting('apiKey', e.target.value)}
                    style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '0.25rem', fontSize: '14px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa' }}
                    placeholder={`${selectedProvider.name} API Key`}
                  />
                </div>
              )}
              {selectedProvider?.requiresKey && (
                <div>
                  <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>模型 ID</div>
                  <input type="text" value={settings.modelId} onChange={e => updateSetting('modelId', e.target.value)}
                    style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '0.25rem', fontSize: '14px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa' }}
                    placeholder="openai/gpt-4o-mini"
                  />
                  <div style={{ fontSize: '12px', color: '#494454', marginTop: 4 }}>輸入 OpenRouter 支援的模型 ID</div>
                </div>
              )}
            </div>
          </div>

          {/* Ollama */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>{t('settings.ollama.title')}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>{t('settings.ollama.url')}</div>
                <input type="text" value={settings.ollamaUrl} onChange={e => updateSetting('ollamaUrl', e.target.value)}
                  style={{ width: '100%', maxWidth: '400px' }} placeholder="http://localhost:11434"
                />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>{t('settings.ollama.checkInterval')}</div>
                <input type="number" value={settings.checkInterval} onChange={e => updateSetting('checkInterval', parseInt(e.target.value) || 30)}
                  style={{ width: '200px' }} min={10} max={300}
                />
              </div>
            </div>
          </div>

          {/* Hermes */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>Hermes</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>Hermes 位址</div>
                <input type="text" value={settings.hermesUrl} onChange={e => updateSetting('hermesUrl', e.target.value)}
                  style={{ width: '100%', maxWidth: '400px' }} placeholder="http://localhost:8080"
                />
                <div style={{ fontSize: '12px', color: '#494454', marginTop: 4 }}>Hermes agent 的 HTTP endpoint</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                  onClick={testHermes}
                  disabled={hermesTesting}
                >
                  {hermesTesting ? '測試中...' : '測試連線'}
                </button>
                {hermesTestResult && (
                  <span style={{ fontSize: '13px', color: hermesTestResult.startsWith('✅') ? '#5c8a2a' : '#ef4444' }}>
                    {hermesTestResult}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Discord */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>Discord</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: '14px', color: '#d4e4fa' }}>啟用 Discord 整合</div>
                  <div style={{ fontSize: '12px', color: '#494454' }}>開啟後可透過 Discord Bot 建立與接收任務</div>
                </div>
                <input type="checkbox" checked={settings.discordEnabled} onChange={e => updateSetting('discordEnabled', e.target.checked)} style={{ accentColor: '#a078ff' }} />
              </label>
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>Bot Token</div>
                <input type="password" value={settings.discordToken} onChange={e => updateSetting('discordToken', e.target.value)}
                  style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '0.25rem', fontSize: '14px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa' }}
                  placeholder="Discord Bot Token"
                />
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>通知頻道 ID</div>
                <input type="text" value={settings.discordChannelId} onChange={e => updateSetting('discordChannelId', e.target.value)}
                  style={{ width: '100%', maxWidth: '400px', padding: '10px 14px', borderRadius: '0.25rem', fontSize: '14px', background: '#0d1c2d', border: '1px solid rgba(255,255,255,0.1)', color: '#d4e4fa' }}
                  placeholder="Discord Channel ID"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                  onClick={testDiscord}
                  disabled={discordTesting}
                >
                  {discordTesting ? '測試中...' : '測試連線'}
                </button>
                {discordTestResult && (
                  <span style={{ fontSize: '13px', color: discordTestResult.startsWith('✅') ? '#5c8a2a' : '#ef4444' }}>
                    {discordTestResult}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Obsidian */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>Obsidian 雙向同步</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>Vault 路徑</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="text" value={settings.obsidianVault} onChange={e => updateSetting('obsidianVault', e.target.value)}
                    style={{ width: '100%', maxWidth: '400px' }}                     placeholder="C:\Users\你的帳號\obsidian"
                  />
                  <button
                    className="btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    onClick={testObsidian}
                    disabled={obsidianTesting}
                  >
                    {obsidianTesting ? '測試中...' : '測試路徑'}
                  </button>
                </div>
                {obsidianTestResult && (
                  <div style={{ fontSize: '12px', color: obsidianTestResult.startsWith('✅') ? '#5c8a2a' : '#ef4444', marginTop: 4 }}>
                    {obsidianTestResult}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={settings.obsidianLiveSync}
                  onChange={e => updateSetting('obsidianLiveSync', e.target.checked)}
                  id="obsidian-livesync"
                  style={{ accentColor: '#a078ff' }}
                />
                <label htmlFor="obsidian-livesync" style={{ fontSize: '14px', color: '#d4e4fa', cursor: 'pointer' }}>
                  啟用即時同步（監聽 Vault 變更）
                </label>
              </div>
              <div>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                  onClick={syncObsidian}
                  disabled={obsidianSyncing}
                >
                  {obsidianSyncing ? '同步中...' : '立即同步'}
                </button>
                {obsidianSyncResult && (
                  <div style={{ fontSize: '12px', color: obsidianSyncResult.startsWith('✅') ? '#5c8a2a' : '#ef4444', marginTop: 4 }}>
                    {obsidianSyncResult}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Memory */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>{t('settings.memory.title')}</h2>
            <div>
              <div style={{ fontSize: '14px', color: '#d4e4fa', marginBottom: 8 }}>{t('settings.memory.path')}</div>
              <input type="text" value={settings.memoryPath} onChange={e => updateSetting('memoryPath', e.target.value)}
                style={{ width: '100%', maxWidth: '400px' }}
              />
              <div style={{ fontSize: '12px', color: '#494454', marginTop: 4 }}>{t('settings.memory.pathDesc')}</div>
            </div>
          </div>

          {/* About & Update */}
          <div className="glass-panel" style={{ borderRadius: '0.5rem', padding: '20px' }}>
            <h2 style={{ color: '#d4e4fa', fontWeight: 600, marginBottom: 16, fontSize: '16px' }}>{t('settings.about.title')}</h2>
            <div style={{ color: '#958ea0', fontSize: '14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>{t('settings.about.version')}</div>
              <div>{t('settings.about.copyright')}</div>
              <div style={{ marginTop: 8, color: '#494454', fontSize: '13px' }}>
                {t('settings.about.description')}
              </div>
            </div>
            <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                  onClick={handleCheckUpdate}
                  disabled={updateStatus?.state === 'checking' || updateStatus?.state === 'downloading'}
                >
                  {t('settings.update.checkNow')}
                </button>
                {updateStatus?.state === 'downloaded' && (
                  <button
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px', background: '#5c8a2a' }}
                    onClick={handleRestartInstall}
                  >
                    {t('settings.update.restart')}
                  </button>
                )}
                {updateStatus?.state === 'available' && (
                  <button
                    className="btn-primary"
                    style={{ padding: '8px 16px', fontSize: '13px', background: '#0566d9' }}
                    onClick={handleDownload}
                  >
                    {t('settings.update.download')}
                  </button>
                )}
              </div>
              {renderUpdateStatus()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage