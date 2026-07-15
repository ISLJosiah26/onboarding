import { useEffect, useRef, useState } from 'react'

// Counts from its previous value to the new one with an eased tween. Respects
// prefers-reduced-motion by snapping. `format` maps the numeric value to text.
export default function AnimatedNumber({ value, duration = 600, format = (n) => Math.round(n), style, className }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(null)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const from = fromRef.current
    const to = value
    if (reduce || from === to) { setDisplay(to); fromRef.current = to; return }

    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{format(display)}</span>
}
