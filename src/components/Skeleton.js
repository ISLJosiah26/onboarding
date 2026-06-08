export function SkeletonLine({ width = '100%', height = '13px', style = {} }) {
  return (
    <div style={{
      width, height,
      background: 'linear-gradient(90deg, #f0efe9 25%, #e8e7e3 50%, #f0efe9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite, fadeIn 0.1s ease 0.28s both',
      borderRadius: '4px',
      ...style
    }} />
  )
}

export function SkeletonRow() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px 2fr 1.5fr 1fr 1fr 100px', padding: '14px 0', borderBottom: '1px solid #f0efe9', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#f0efe9' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <SkeletonLine width="60%" height="13px" />
        <SkeletonLine width="40%" height="11px" />
      </div>
      <SkeletonLine width="70%" />
      <SkeletonLine width="80%" height="4px" />
      <SkeletonLine width="50%" height="22px" style={{ borderRadius: '4px' }} />
      <SkeletonLine width="40%" style={{ marginLeft: 'auto' }} />
    </div>
  )
}

export function SkeletonTaskRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 0', borderBottom: '1px solid #f0efe9' }}>
      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#f0efe9', flexShrink: 0 }} />
      <SkeletonLine width="55%" />
      <SkeletonLine width="40px" height="22px" style={{ marginLeft: 'auto', borderRadius: '4px' }} />
    </div>
  )
}