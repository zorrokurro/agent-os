import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

interface Settings {
  modelId: string
  obsidianVault: string
  [key: string]: unknown
}

interface SettingsContextValue {
  settings: Settings
  isLoading: boolean
  updateSetting: (key: string, value: unknown) => void
  refresh: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({ modelId: '', obsidianVault: '' })
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const raw = await (window as any).electronAPI.getSettings()
      if (raw) {
        setSettings({
          modelId: ((raw.apiModel as string) || (raw.modelId as string) || ''),
          obsidianVault: ((raw.obsidianVault as string) || ''),
        })
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const updateSetting = useCallback((key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSetting, refresh: load }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
