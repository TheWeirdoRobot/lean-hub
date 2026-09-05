import { supabase } from './supabase'

// Signed-out visitors hold column-level SELECT on these columns only, so
// select('*') on profiles fails for them (see migration-roster.sql). email is
// deliberately absent — it exists to link a signup to a placeholder, not to
// be published.
export const PROFILE_COLUMNS = 'id, full_name, avatar_url, role, sub_team, is_placeholder, created_at'

// The shape of profiles before migration-roster.sql added the roster columns.
const LEGACY_COLUMNS = 'id, full_name, avatar_url, role, created_at'

function missingColumn(error) {
  return /does not exist/i.test(error?.message || '')
}

/**
 * Reads the roster. Deploys and SQL migrations don't land at the same moment, so
 * this falls back to the pre-roster columns rather than leaving the team list
 * empty in the gap. The fallback can go once migration-roster.sql has been run.
 */
export async function loadProfiles({ withEmail = false, ordered = false } = {}) {
  const build = (columns) => {
    const q = supabase.from('profiles').select(columns)
    return ordered ? q.order('created_at', { ascending: true }) : q
  }

  let { data, error } = await build(withEmail ? `${PROFILE_COLUMNS}, email` : PROFILE_COLUMNS)

  if (error && missingColumn(error)) {
    ({ data, error } = await build(LEGACY_COLUMNS))
  }
  if (error) console.error('Profiles fetch error:', error)
  return data || []
}

/** The signed-in member's own profile, with the same migration tolerance. */
export async function loadOwnProfile(userId) {
  const build = (columns) =>
    supabase.from('profiles').select(columns).eq('id', userId).single()

  let { data, error } = await build(PROFILE_COLUMNS)
  if (error && missingColumn(error)) {
    ({ data, error } = await build(LEGACY_COLUMNS))
  }
  if (error) console.error('Own profile fetch error:', error)
  return data || null
}
