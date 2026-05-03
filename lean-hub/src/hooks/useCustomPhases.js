import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_PHASES = [
  { name: 'Research',    color: '#3B82F6' },
  { name: 'Design',      color: '#A855F7' },
  { name: 'Fabrication', color: '#F97316' },
  { name: 'Testing',     color: '#22C55E' },
  { name: 'Competition', color: '#EAB308' },
]

export function useCustomPhases() {
  const [phases, setPhases] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('custom_phases')
      .select('*')
      .order('created_at', { ascending: true })

    if (!error && data !== null) {
      if (data.length === 0) {
        await supabase
          .from('custom_phases')
          .upsert(DEFAULT_PHASES, { onConflict: 'name', ignoreDuplicates: true })
        const { data: seeded } = await supabase
          .from('custom_phases')
          .select('*')
          .order('created_at', { ascending: true })
        setPhases(seeded || DEFAULT_PHASES)
      } else {
        setPhases(data)
      }
    } else {
      setPhases(DEFAULT_PHASES)
    }
    setLoading(false)
  }

  const phaseColorMap = Object.fromEntries(phases.map(p => [p.name, p.color]))

  return { phases, loading, phaseColorMap, reload: load }
}
