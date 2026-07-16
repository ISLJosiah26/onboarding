import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// A tiny chainable Supabase query-builder mock. Every builder method returns
// the builder, and the builder is awaitable (implements `then`), resolving to
// `{ data, error }` based on the table and operation. Update calls are recorded
// so tests can assert what got persisted.
function makeSupabase(fixtures, updates) {
  return {
    from(table) {
      const state = { table, op: 'select', select: null, filters: {}, payload: null }
      const builder = {
        select(cols) { state.op = 'select'; state.select = cols; return builder },
        update(payload) { state.op = 'update'; state.payload = payload; return builder },
        insert(payload) { state.op = 'insert'; state.payload = payload; return builder },
        delete() { state.op = 'delete'; return builder },
        eq(col, val) { state.filters[col] = val; return builder },
        in() { return builder },
        order() { return builder },
        single() { state.single = true; return builder },
        then(resolve, reject) {
          return Promise.resolve(resolveResult(state, fixtures, updates)).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

function resolveResult(state, fixtures, updates) {
  if (state.op === 'update') {
    updates.push({ table: state.table, payload: state.payload, filters: { ...state.filters } })
    return { data: null, error: null }
  }
  if (state.table === 'roles') return { data: fixtures.roles, error: null }
  if (state.table === 'task_library') return { data: fixtures.taskLibrary, error: null }
  if (state.table === 'onboarding_templates') {
    if (state.select === 'role_id, parent_id') {
      return { data: fixtures.templates.map(t => ({ role_id: t.role_id, parent_id: t.parent_id })), error: null }
    }
    return { data: fixtures.templates.filter(t => t.role_id === state.filters.role_id), error: null }
  }
  return { data: [], error: null }
}

// vi.mock is hoisted above module scope, so the shared `updates` array and the
// mock client are created inside vi.hoisted and referenced from both places.
// sort_order deliberately disagrees with alphabetical order so the tests prove
// the saved order — not the name — drives how tasks render.
const { updates } = vi.hoisted(() => ({ updates: [] }))

vi.mock('../supabaseClient', () => ({
  supabase: makeSupabase(
    {
      roles: [{ id: 'r1', name: 'Driver', brand: 'ISL' }],
      taskLibrary: [{ id: 'l1', task_name: 'Order laptop' }],
      templates: [
        { id: 't1', role_id: 'r1', task_name: 'Zebra task', phase: 'Day 1', owner: 'HR', parent_id: null, sort_order: 0 },
        { id: 't2', role_id: 'r1', task_name: 'Apple task', phase: 'Day 1', owner: 'HR', parent_id: null, sort_order: 1 },
      ],
    },
    updates
  ),
}))

import Admin from './Admin'

const noop = () => {}

function renderTemplates() {
  return render(
    <Admin
      session={{ user: { id: 'u1' } }}
      userProfile={{ role: 'admin' }}
      initialTab="templates"
      onBack={noop}
      onNavigate={noop}
      onStartOnboarding={noop}
      onViewOnboarding={noop}
    />
  )
}

async function openRole() {
  const roleBtn = await screen.findByRole('button', { name: /Driver/ })
  fireEvent.click(roleBtn)
  await screen.findByText('Zebra task')
}

beforeEach(() => { updates.length = 0 })

test('renders a role\'s tasks in saved sort_order, not alphabetically', async () => {
  renderTemplates()
  await openRole()

  const zebra = screen.getByText('Zebra task')
  const apple = screen.getByText('Apple task')
  // sort_order 0 (Zebra) must precede sort_order 1 (Apple), even though "Apple"
  // sorts first alphabetically.
  expect(zebra.compareDocumentPosition(apple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('add-task field defaults to a free-text custom entry with library suggestions', async () => {
  renderTemplates()
  await openRole()

  // Open the Day 1 add form (first phase in the schedule).
  fireEvent.click(screen.getAllByText('+ Add task')[0])

  // Typing works immediately — no dropdown to open, no "custom" option to find.
  const input = screen.getByPlaceholderText(/type a task name/i)
  expect(input).toBeInTheDocument()
  expect(screen.queryByText(/select from library/i)).toBeNull()

  // The library is still reachable as autocomplete suggestions.
  const datalist = document.getElementById('tpl-task-library')
  expect(datalist).toBeTruthy()
  expect(within(datalist).getByRole('option', { hidden: true })).toHaveValue('Order laptop')
})

test('task rows are draggable and dropping persists a new sort_order', async () => {
  renderTemplates()
  await openRole()

  const rows = document.querySelectorAll('[draggable="true"]')
  expect(rows.length).toBe(2)

  const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
  // Drag the second task (Apple) and drop it above the first (Zebra) — a real
  // reorder. The drop bubbles to the day's drop zone.
  fireEvent.dragStart(rows[1], { dataTransfer })
  fireEvent.dragOver(rows[0], { dataTransfer, clientY: 0 })
  fireEvent.drop(rows[0], { dataTransfer })

  // Both tasks in the day get their sort_order rewritten to the new positions.
  await waitFor(() => {
    const templateUpdates = updates.filter(u => u.table === 'onboarding_templates')
    expect(templateUpdates.length).toBeGreaterThan(0)
    expect(templateUpdates.every(u => typeof u.payload.sort_order === 'number')).toBe(true)
  })
})
