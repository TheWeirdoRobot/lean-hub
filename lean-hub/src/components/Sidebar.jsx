import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, BarChart2, Users, FolderOpen } from 'lucide-react'
import WheelchairLogo from './WheelchairLogo'

const links = [
  { to: '/',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: CheckSquare,     label: 'Tasks' },
  { to: '/gantt', icon: BarChart2,       label: 'Gantt Chart' },
  { to: '/team',  icon: Users,           label: 'Team' },
  { to: '/files', icon: FolderOpen,      label: 'Files' },
]

export default function Sidebar() {
  return (
    <aside style={{
      width: 220,
      minHeight: '100vh',
      background: '#13132A',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            background: '#F1F5F9',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 14px rgba(124,58,237,0.45)',
            flexShrink: 0,
          }}>
            <WheelchairLogo size={26} color="#7C3AED" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em', color: '#F1F5F9' }}>
              LEAN Hub
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 1 }}>
              CAPSTONE 2026
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', padding: '6px 10px 8px', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 8,
              marginBottom: 2,
              color: isActive ? '#A855F7' : 'var(--text-secondary)',
              background: isActive ? 'rgba(124,58,237,0.14)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: 13,
              transition: 'all 0.15s',
              textDecoration: 'none',
              boxShadow: isActive ? 'inset 3px 0 0 0 #7C3AED' : 'none',
            })}
            onMouseEnter={e => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = 'rgba(124,58,237,0.07)'
                e.currentTarget.style.color = '#C4B5FD'
              }
            }}
            onMouseLeave={e => {
              if (!e.currentTarget.classList.contains('active')) {
                e.currentTarget.style.background = ''
                e.currentTarget.style.color = ''
              }
            }}
          >
            {({ isActive }) => (
              <>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} aria-hidden="true" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Project badge */}
      <div style={{ padding: '16px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.22), rgba(168,85,247,0.1))',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 8,
          padding: '10px 12px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#A855F7', marginBottom: 3 }}>
            Powered Wheelchair
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Torso-lean control via pressure cushion
          </div>
        </div>
      </div>
    </aside>
  )
}
