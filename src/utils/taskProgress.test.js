import { computeProgress, isParentComplete, computeProgressFromRaw } from './taskProgress'

// Normalized task shape: { id, parentId, templateId }
const parent = (id, templateId) => ({ id, parentId: null, templateId })
const sub = (id, parentTemplateId) => ({ id, parentId: parentTemplateId, templateId: `${id}t` })

test('parent with no subtasks is driven by its own completion', () => {
  const tasks = [parent('p1', 't1')]
  expect(isParentComplete(tasks[0], tasks, { p1: true })).toBe(true)
  expect(isParentComplete(tasks[0], tasks, { p1: false })).toBe(false)
})

test('parent with subtasks completes only when all subtasks complete', () => {
  const tasks = [parent('p2', 't2'), sub('s1', 't2'), sub('s2', 't2')]
  expect(isParentComplete(tasks[0], tasks, { s1: true, s2: false })).toBe(false)
  expect(isParentComplete(tasks[0], tasks, { s1: true, s2: true })).toBe(true)
})

test('computeProgress counts only parents', () => {
  const tasks = [parent('p1', 't1'), parent('p2', 't2'), sub('s1', 't2'), sub('s2', 't2')]
  expect(computeProgress(tasks, { p1: true, s1: true, s2: false })).toEqual({ total: 2, done: 1, pct: 50 })
})

test('empty plan is zero progress', () => {
  expect(computeProgress([], {})).toEqual({ total: 0, done: 0, pct: 0 })
})

test('computeProgressFromRaw handles the dashboard row shape', () => {
  const raw = [
    { id: 'p1', completed: true, onboarding_templates: { id: 't1', parent_id: null } },
    { id: 'p2', completed: false, onboarding_templates: { id: 't2', parent_id: null } },
    { id: 's1', completed: true, onboarding_templates: { id: 's1t', parent_id: 't2' } },
    { id: 's2', completed: false, onboarding_templates: { id: 's2t', parent_id: 't2' } },
  ]
  expect(computeProgressFromRaw(raw)).toEqual({ total: 2, done: 1, pct: 50 })
})
