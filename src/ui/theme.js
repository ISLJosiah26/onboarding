// JS mirror of the CSS custom properties in index.css. Components can import
// `T` instead of hardcoding hex values, so the palette lives in one place and
// stays in sync with the stylesheet tokens.
export const T = {
  bg: '#f4f3ef',
  surface: '#ffffff',
  border: '#e2e1dd',
  borderSubtle: '#eceae6',
  text: '#18181b',
  muted: '#70706b',
  subtle: '#a4a39f',
  brand: '#0066cc',
  brandMid: '#3d9eff',
  brandLight: '#eff6ff',
  success: '#1a7a4a',
  warning: '#b8740a',
  danger: '#c04040',
  dangerBg: '#fdf0f0',
  dangerBorder: '#f5d6d6',
  shadowSm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 2px 8px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
  radiusSm: '6px',
  radiusMd: '8px',
  radiusLg: '12px',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}

export default T
