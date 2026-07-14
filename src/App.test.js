import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('./supabaseClient', () => {
  const mockSupabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } })
    }
  }
  return {
    supabase: mockSupabase,
    getUserProfile: vi.fn().mockResolvedValue(null)
  }
})

import App from './App'

test('renders sign-in form when no active session exists', async () => {
  render(<App />)
  expect(await screen.findByText(/welcome back/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/you@integratedstaffing\.ca/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
})