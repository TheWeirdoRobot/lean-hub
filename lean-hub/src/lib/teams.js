// Single source of truth for sub-teams. These were previously redeclared in
// TaskModal, Tasks, Team, Admin and Gantt, which made adding one a five-file edit.
// `name` must match the tasks.sub_team CHECK constraint in supabase-schema.sql.
export const SUB_TEAMS = [
  { name: 'Full Team',  abbr: 'FT',  color: '#6CA6E8' },
  { name: 'Mechanical', abbr: 'MT',  color: '#DE9260' },
  { name: 'Electrical', abbr: 'ET',  color: '#D9A73F' },
  { name: 'CSE',        abbr: 'CSE', color: '#5FBFC9' },
]

export const DEFAULT_SUB_TEAM = SUB_TEAMS[0].name

export function subTeamOf(name) {
  return SUB_TEAMS.find(s => s.name === name) || SUB_TEAMS[0]
}

export function subTeamAbbr(name) {
  return subTeamOf(name).abbr
}

export function subTeamColor(name) {
  return subTeamOf(name).color
}
