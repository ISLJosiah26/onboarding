import { SCHEDULE_BUCKETS, DAY_BUCKETS } from '../config'

const BUCKET_INDEX = Object.fromEntries(SCHEDULE_BUCKETS.map((b, i) => [b, i]))
const DEFAULT_BUCKET = DAY_BUCKETS[0]

// Flatten a task_completion row (with a possibly-null joined template) into a
// self-describing task. Per-instance columns (day, sort_order, custom_*) win
// over the shared template so an onboarding can be customized per person, and
// ad-hoc tasks (no template) are fully supported.
export function normalizeTask(tc) {
  const t = tc.onboarding_templates || null
  return {
    id: tc.id,
    templateId: t?.id ?? null,
    parentId: t?.parent_id ?? null,
    name: tc.custom_task_name ?? t?.task_name ?? 'Untitled task',
    owner: tc.custom_owner ?? t?.owner ?? null,
    bucket: tc.day ?? t?.phase ?? DEFAULT_BUCKET,
    sortOrder: tc.sort_order ?? 0,
    completed: !!tc.completed,
    notes: tc.notes ?? '',
    isCustom: !t,
  }
}

export function bucketRank(bucket) {
  return BUCKET_INDEX[bucket] ?? Number.MAX_SAFE_INTEGER
}

export function sortTasks(a, b) {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.name.localeCompare(b.name)
}

// Group normalized top-level tasks by their bucket, sorted within each bucket.
// Subtasks (parentId set) are excluded here — they render under their parent.
export function groupParentsByBucket(tasks) {
  const byBucket = {}
  SCHEDULE_BUCKETS.forEach(b => { byBucket[b] = [] })
  tasks.filter(t => !t.parentId).forEach(t => {
    const bucket = byBucket[t.bucket] ? t.bucket : DEFAULT_BUCKET
    byBucket[bucket].push(t)
  })
  Object.values(byBucket).forEach(list => list.sort(sortTasks))
  return byBucket
}

export function subtasksOf(parent, tasks) {
  return tasks.filter(t => t.parentId && t.parentId === parent.templateId)
}

// The Nth business day (Mon–Fri) on or after the hire date. n is 1-based.
export function businessDayDate(hireDate, n) {
  const d = new Date(`${hireDate}T00:00:00`)
  let count = 0
  // Guard against runaway loops; n is always small in practice.
  for (let i = 0; i < 400; i++) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      count++
      if (count === n) return new Date(d)
    }
    d.setDate(d.getDate() + 1)
  }
  return d
}

// The projected start date of a bucket, or null if it can't be derived.
export function bucketStartDate(hireDate, bucket) {
  if (!hireDate) return null
  const dayMatch = /^Day (\d+)$/.exec(bucket)
  if (dayMatch) return businessDayDate(hireDate, Number(dayMatch[1]))
  const weekMatch = /^Week (\d+)$/.exec(bucket)
  if (weekMatch) return businessDayDate(hireDate, (Number(weekMatch[1]) - 1) * 5 + 1)
  const milestoneMatch = /^(\d+) Day$/.exec(bucket)
  if (milestoneMatch) {
    const d = new Date(`${hireDate}T00:00:00`)
    d.setDate(d.getDate() + Number(milestoneMatch[1]))
    return d
  }
  return null
}

// Whether a bucket's projected start date is still in the future.
export function isBucketUpcoming(hireDate, bucket) {
  const start = bucketStartDate(hireDate, bucket)
  if (!start) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  start.setHours(0, 0, 0, 0)
  return start > today
}

// A short human date hint for a bucket, projected from the hire date.
export function bucketDateHint(hireDate, bucket) {
  if (!hireDate) return null
  const dayMatch = /^Day (\d+)$/.exec(bucket)
  if (dayMatch) {
    return businessDayDate(hireDate, Number(dayMatch[1]))
      .toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  const weekMatch = /^Week (\d+)$/.exec(bucket)
  if (weekMatch) {
    const start = businessDayDate(hireDate, (Number(weekMatch[1]) - 1) * 5 + 1)
    return `week of ${start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
  }
  const milestoneMatch = /^(\d+) Day$/.exec(bucket)
  if (milestoneMatch) {
    const d = new Date(`${hireDate}T00:00:00`)
    d.setDate(d.getDate() + Number(milestoneMatch[1]))
    return `~${d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`
  }
  return null
}
