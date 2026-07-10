import { calcProgress } from './useDashboard'

const parent = (id, completed, tid) => ({ id, completed, onboarding_templates: { id: tid, parent_id: null } })
const sub = (id, completed, parentTid) => ({ id, completed, onboarding_templates: { id: `${id}t`, parent_id: parentTid } })
const adhoc = (id, completed) => ({ id, completed, onboarding_templates: null })

test('counts only parent tasks, driven by subtasks when present', () => {
  const tcs = [
    parent('p1', true, 't1'),
    parent('p2', false, 't2'),
    sub('s1', true, 't2'),
    sub('s2', false, 't2'), // p2 not fully done -> incomplete
  ]
  expect(calcProgress(tcs)).toEqual({ total: 2, done: 1, pct: 50 })
})

test('ad-hoc tasks are independent parents and do not pollute each other', () => {
  const tcs = [
    adhoc('a1', true),
    adhoc('a2', false),
    adhoc('a3', true),
  ]
  // Each ad-hoc is its own parent; 2 of 3 complete. If ad-hocs wrongly counted
  // as each other's subtasks, this would collapse to 0 done.
  expect(calcProgress(tcs)).toEqual({ total: 3, done: 2, pct: 67 })
})

test('empty plan is zero progress', () => {
  expect(calcProgress([])).toEqual({ total: 0, done: 0, pct: 0 })
})
