import { render, screen } from '@testing-library/react'

jest.mock('./supabaseClient', () => {
  const mockSupabase = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } })
    }
  }
  return {
    supabase: mockSupabase,
    getUserProfile: jest.fn().mockResolvedValue(null)
  }
})

import App from './App'

test('renders sign-in form when no active session exists', async () => {
  render(<App />)
  expect(await screen.findByText(/welcome back/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/you@integratedstaffing\.ca/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
})