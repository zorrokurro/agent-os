import { useState, useRef, useEffect } from 'react'
import type { ModelConfig } from '../../hooks/useModelConfig'

interface ModelSelectorProps {
  config: ModelConfig
  models: string[]
  onSave: (config: ModelConfig) => void
  onClose: () => void
}

const ROLE_LABELS: { key: keyof ModelConfig; label: string }[] = [
  { key: 'panelA',  label: 'Panel A' },
  { key: 'panelB',  label: 'Panel B' },
  { key: 'judge',   label: 'Judge（合成）' },
  { key: 'critic',  label: 'Critic（評估）' },
  { key: 'refiner', label: 'Refiner（修改）' },
  { key: 'hermes',  label: 'Hermes' },
]

export default function ModelSelector({ config, models, onSave, onClose }: ModelSelectorProps) {
  const [local, setLocal] = useState<ModelConfig>({ ...config })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  function update(key: keyof ModelConfig, value: string) {
    setLocal(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', top: '100%', right: 0, marginTop: 4,
      width: 280, background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', padding: 16, zIndex: 50,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 12 }}>
        模型設定
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ROLE_LABELS.map(({ key, label }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#958ea0', flexShrink: 0 }}>{label}</span>
            <select
              value={local[key]}
              onChange={e => update(key, e.target.value)}
              style={{
                width: 160, fontSize: 11, padding: '4px 6px', borderRadius: 4,
                background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
              }}
            >
              {models.length === 0 && <option value="">無可用模型</option>}
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{
          fontSize: 11, padding: '5px 12px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.12)',
          background: 'transparent', color: '#958ea0', cursor: 'pointer',
        }}>
          取消
        </button>
        <button onClick={() => onSave(local)} style={{
          fontSize: 11, padding: '5px 12px', borderRadius: 4, border: 'none',
          background: '#7F77DD', color: '#fff', cursor: 'pointer',
        }}>
          儲存
        </button>
      </div>
    </div>
  )
}
