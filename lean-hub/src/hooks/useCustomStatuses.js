import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_STATUSES = [
  { name: 'Not Started', color: '#94A3B8', column_order: 0 },
  { name: 'In Progress', color: '#EAB308', column_order: 1 },
  { name: 'Review',      color: '#3B82F6', column_order: 2 },
  { name: 'Done',        color: '#22C55E', column_order: 3 },
]

// Maps a display name to the slug stored in tasks.status
export function statusToValue(name) {
  return name.toLowerCase().replace(/\s+/g, '_')
}

export function useCustomStatuses() {
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('custom_statuses')
      .select('*')
      .order('column_order', { ascending: true })

    if (!error && data !== null) {
      if (data.length === 0) {
        await supabase
          .from('custom_statuses')
          .upsert(DEFAULT_STATUSES, { onConflict: 'name', ignoreDuplicates: true })
        const { data: seeded } = await supabase
          .from('custom_statuses')
          .select('*')
          .order('column_order', { ascending: true })
        setStatuses(seeded || DEFAULT_STATUSES)
      } else {
        setStatuses(data)
      }
    } else {
      setStatuses(DEFAULT_STATUSES)
    }
    setLoading(false)
  }

  return { statuses, loading, reload: load }
}
