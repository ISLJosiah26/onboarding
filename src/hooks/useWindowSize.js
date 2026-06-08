import { useState, useEffect } from 'react'

export function useWindowSize() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  )
  useEffect(() => {
    let timer
    const handler = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setWidth(window.innerWidth), 100)
    }
    window.addEventListener('resize', handler, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', handler)
    }
  }, [])
  return { isMobile: width < 768, width }
}
