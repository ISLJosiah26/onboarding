import { renderHook, act } from '@testing-library/react'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

test('a freshly mounted useTheme reflects the persisted theme', () => {
  // Simulates a component (e.g. ThemeToggle) mounting after the user already
  // chose dark on a previous screen.
  localStorage.setItem('il-theme', 'dark')
  const { result } = renderHook(() => useTheme())
  expect(result.current.theme).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('a chosen theme survives a remount (navigating to another page)', () => {
  // Mount, choose dark, unmount (navigate away)...
  const { result, unmount } = renderHook(() => useTheme())
  act(() => result.current.setTheme('dark'))
  expect(localStorage.getItem('il-theme')).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  unmount()

  // ...then remount on the new page — it must NOT revert to light.
  const { result: result2 } = renderHook(() => useTheme())
  expect(result2.current.theme).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('the system choice clears the attribute so the OS preference applies', () => {
  localStorage.setItem('il-theme', 'dark')
  const { result } = renderHook(() => useTheme())
  act(() => result.current.setTheme('system'))
  expect(localStorage.getItem('il-theme')).toBeNull()
  expect(document.documentElement.getAttribute('data-theme')).toBeNull()
})
