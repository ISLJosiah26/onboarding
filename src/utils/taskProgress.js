// Single source of truth for parent/subtask onboarding progress. A parent task
// is complete when it has subtasks and all of them are checked, or when it has
// no subtasks and its own completion is checked.

// `tasks` are normalized tasks ({ id, parentId, templateId }); `completions`
// maps completion id -> boolean.
export function isParentComplete(parent, tasks, completions) {
  const subs = tasks.filter(s => s.parentId && s.parentId === parent.templateId)
  if (subs.length === 0) return !!completions[parent.id]
  return subs.every(s => !!completions[s.id])
}

export function computeProgress(tasks, completions) {
  const parents = tasks.filter(t => !t.parentId)
  const total = parents.length
  const done = parents.filter(p => isParentComplete(p, tasks, completions)).length
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
}

// Adapter for the dashboard's raw task_completions shape (each row carries a
// nested onboarding_templates with id/parent_id and a `completed` flag).
export function computeProgressFromRaw(taskCompletions) {
  const tasks = taskCompletions.map(tc => ({
    id: tc.id,
    parentId: tc.onboarding_templates?.parent_id || null,
    templateId: tc.onboarding_templates?.id || null,
  }))
  const completions = {}
  taskCompletions.forEach(tc => { completions[tc.id] = tc.completed })
  return computeProgress(tasks, completions)
}
