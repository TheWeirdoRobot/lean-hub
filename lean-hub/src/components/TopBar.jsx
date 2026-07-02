import { useState, useRef, useEffect } from 'react'
import { LogOut, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import Avatar from './Avatar'

export default function TopBar({ title }) {
  const { profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span className="topbar-date">{format(new Date(), 'EEE, MMM d')}</span>

        <div ref={ref} style={{ position: 'relative' }}>
          <button
            className="user-chip"
            onClick={() => setOpen(!open)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <Avatar name={profile?.full_name} size="sm" />
            <span style={{ fontSize: 13, fontWeight: 500 }}>{profile?.full_name || 'User'}</span>
            <ChevronDown size={13} color="var(--text-muted)" />
          </button>

          {open && (
            <div className="user-menu fade-in">
              <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{profile?.full_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{profile?.role}</div>
              </div>
              <button
                onClick={signOut}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--danger)', gap: 8 }}
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
