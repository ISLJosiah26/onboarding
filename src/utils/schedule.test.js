import {
  normalizeTask, groupParentsByBucket, businessDayDate,
  bucketDateHint, isBucketUpcoming, sortTasks,
} from './schedule'

const isWeekend = d => d.getDay() === 0 || d.getDay() === 6

test('businessDayDate returns 10 strictly-increasing weekdays', () => {
  const hire = '2026-07-13'
  const dates = Array.from({ length: 10 }, (_, i) => businessDayDate(hire, i + 1))
  dates.forEach(d => expect(isWeekend(d)).toBe(false))
  for (let i = 1; i < dates.length; i++) {
    expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime())
  }
  // Day 1 is on/after the hire date
  expect(dates[0].getTime()).toBeGreaterThanOrEqual(new Date('2026-07-13T00:00:00').getTime())
})

test('normalizeTask prefers per-instance overrides and tolerates ad-hoc tasks', () => {
  const templated = normalizeTask({
    id: 'c1', completed: true, notes: 'n', day: 'Day 3', sort_order: 2,
    custom_task_name: null, custom_owner: null,
    onboarding_templates: { id: 't1', task_name: 'Set up laptop', phase: 'Day 1', owner: 'IT', parent_id: null },
  })
  expect(templated).toMatchObject({ name: 'Set up laptop', owner: 'IT', bucket: 'Day 3', isCustom: false, completed: true })

  const overridden = normalizeTask({
    id: 'c2', completed: false, day: 'Day 5', sort_order: 0,
    custom_task_name: 'Custom name', custom_owner: 'HR',
    onboarding_templates: { id: 't2', task_name: 'Orig', phase: 'Day 1', owner: 'IT', parent_id: null },
  })
  expect(overridden).toMatchObject({ name: 'Custom name', owner: 'HR', bucket: 'Day 5' })

  const adhoc = normalizeTask({
    id: 'c3', completed: false, day: 'Week 3', sort_order: 1,
    custom_task_name: 'Ad-hoc task', custom_owner: 'Manager',
    onboarding_templates: null,
  })
  expect(adhoc).toMatchObject({ name: 'Ad-hoc task', owner: 'Manager', bucket: 'Week 3', isCustom: true, parentId: null })
})

test('groupParentsByBucket buckets parents, excludes subtasks, and sorts by order', () => {
  const tasks = [
    normalizeTask({ id: 'a', completed: false, day: 'Day 1', sort_order: 1, onboarding_templates: { id: 'ta', task_name: 'A', phase: 'Day 1', owner: 'HR', parent_id: null } }),
    normalizeTask({ id: 'b', completed: false, day: 'Day 1', sort_order: 0, onboarding_templates: { id: 'tb', task_name: 'B', phase: 'Day 1', owner: 'HR', parent_id: null } }),
    normalizeTask({ id: 's', completed: false, day: 'Day 1', sort_order: 0, onboarding_templates: { id: 'ts', task_name: 'Sub', phase: 'Day 1', owner: 'HR', parent_id: 'ta' } }),
  ]
  const grouped = groupParentsByBucket(tasks)
  expect(grouped['Day 1'].map(t => t.id)).toEqual(['b', 'a']) // sorted by sort_order
  expect(grouped['Day 2']).toEqual([])
})

test('sortTasks orders by sortOrder then name', () => {
  const list = [
    { sortOrder: 2, name: 'Z' }, { sortOrder: 0, name: 'B' }, { sortOrder: 0, name: 'A' },
  ].sort(sortTasks)
  expect(list.map(t => t.name)).toEqual(['A', 'B', 'Z'])
})

test('bucket date hints and upcoming flag are derived from hire date', () => {
  expect(bucketDateHint('2026-07-13', 'Day 1')).toMatch(/Jul/)
  expect(bucketDateHint('2026-07-13', 'Week 3')).toMatch(/^week of/)
  expect(bucketDateHint('2026-07-13', '30 Day')).toMatch(/^~/)
  // A hire date far in the future makes Day 1 upcoming; far in the past does not.
  expect(isBucketUpcoming('2999-01-01', 'Day 1')).toBe(true)
  expect(isBucketUpcoming('2000-01-01', 'Day 1')).toBe(false)
})
