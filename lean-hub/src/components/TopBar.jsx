import { useState, useRef, useEffect } from 'react'
import { LogOut, ChevronDown, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

function getAvatarColor(name) {
  const colors = [
    ['#A855F7', '#2D1B69'],
    ['#7C3AED', '#1E0A4A'],
    ['#3B82F6', '#1E3A5F'],
    ['#22C55E', '#14532D'],
    ['#EC4899', '#5B1647'],
    ['#EAB308', '#4A3000'],
  ]
  const idx = (name?.charCodeAt(0) || 0) % colors.length
  return colors[idx]
}

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

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : '?'

  const [fg, bg] = getAvatarColor(profile?.full_name)

  return (
    <header style={{
      height: 60,
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: 'var(--bg-secondary)',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </div>

      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div className="avatar avatar-sm" style={{ background: bg, color: fg }}>
            {initials}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{profile?.full_name || 'User'}</span>
          <ChevronDown size={14} color="var(--text-muted)" />
        </button>

        {open && (
          <div className="fade-in" style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '6px',
            minWidth: 180,
            boxShadow: 'var(--shadow-md)',
            zIndex: 50,
          }}>
            <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
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
    </header>
  )
}
