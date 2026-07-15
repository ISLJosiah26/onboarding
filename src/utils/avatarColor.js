// Deterministically map a person's name to a stable color chip, so the same
// person always shows the same color across the app. Palette is a set of soft
// tints that read well on both light and dark surfaces.
const PALETTE = [
  { bg: '#dbeafe', fg: '#1d4ed8' }, // blue
  { bg: '#dcfce7', fg: '#15803d' }, // green
  { bg: '#fef3c7', fg: '#b45309' }, // amber
  { bg: '#fce7f3', fg: '#be185d' }, // pink
  { bg: '#ede9fe', fg: '#6d28d9' }, // violet
  { bg: '#ccfbf1', fg: '#0f766e' }, // teal
  { bg: '#ffe4e6', fg: '#9f1239' }, // rose
  { bg: '#e0e7ff', fg: '#4338ca' }, // indigo
]

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function avatarColors(name) {
  const key = (name || '').trim().toLowerCase() || '?'
  return PALETTE[hash(key) % PALETTE.length]
}

// Convenience: returns a style object { background, color } for an avatar chip.
export function avatarStyle(name) {
  const c = avatarColors(name)
  return { background: c.bg, color: c.fg }
}
