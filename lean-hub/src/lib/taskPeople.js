/**
 * Assignee helpers.
 *
 * Tasks moved from a single `assigned_to` column to an `assignee_ids uuid[]`
 * array. `assigned_to` is still written as the first assignee so the old column
 * stays meaningful and the change can be reverted without losing data; reads
 * fall back to it when assignee_ids is missing or empty.
 */

export function assigneeIds(task) {
  const ids = task?.assignee_ids
  if (Array.isArray(ids) && ids.length > 0) return ids
  return task?.assigned_to ? [task.assigned_to] : []
}

/** Resolves ids to profile objects, dropping any that no longer exist. */
export function assigneesOf(task, profiles) {
  if (!profiles?.length) return []
  const ids = assigneeIds(task)
  if (ids.length === 0) return []
  return ids.map(id => profiles.find(p => p.id === id)).filter(Boolean)
}

export function isAssignedTo(task, userId) {
  return !!userId && assigneeIds(task).includes(userId)
}

/** The DB fields to write for a given set of assignee ids. */
export function assigneeFields(ids) {
  const clean = [...new Set((ids || []).filter(Boolean))]
  return { assignee_ids: clean, assigned_to: clean[0] || null }
}

/**
 * True for work handed to a group rather than a person: nobody is named on it,
 * and it belongs either to the whole team or to this person's sub-team, which
 * is set on their profile rather than guessed from their task history.
 */
export function isGroupTaskFor(task, mySubTeam) {
  if (assigneeIds(task).length > 0) return false
  const team = task?.sub_team || 'Full Team'
  return team === 'Full Team' || (!!mySubTeam && team === mySubTeam)
}
