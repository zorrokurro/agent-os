export function Skeleton({ width, height, style }: { width?: string | number; height?: string | number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: width || '100%',
      height: height || '16px',
      borderRadius: '0.25rem',
      background: 'linear-gradient(90deg, rgba(18,33,49,0.7) 25%, rgba(39,54,71,0.5) 50%, rgba(18,33,49,0.7) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(18, 33, 49, 0.7)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '0.5rem',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <Skeleton height="14px" width="60%" />
      <Skeleton height="12px" width="80%" />
      <Skeleton height="12px" width="40%" />
    </div>
  )
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}
