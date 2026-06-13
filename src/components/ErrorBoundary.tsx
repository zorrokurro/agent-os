import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#051424', color: '#d4e4fa', fontFamily: 'Inter, sans-serif',
          padding: '40px',
        }}>
          <div style={{ fontSize: '48px', marginBottom: 16 }}>💥</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 8 }}>程式發生錯誤</h1>
          <p style={{ fontSize: '14px', color: '#958ea0', marginBottom: 24, textAlign: 'center', maxWidth: 500 }}>
            {this.state.error?.message || '未知錯誤'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            style={{
              padding: '10px 24px', borderRadius: '0.25rem', fontWeight: 700, fontSize: '14px',
              color: '#3c0091', background: 'linear-gradient(135deg, #d0bcff, #a078ff)',
              border: 'none', cursor: 'pointer',
            }}
          >
            重新載入
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
