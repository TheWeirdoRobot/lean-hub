import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, BarChart2, Users, FolderOpen, Settings } from 'lucide-react'
import WheelchairLogo from './WheelchairLogo'

const links = [
  { to: '/',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks', icon: CheckSquare,     label: 'Tasks' },
  { to: '/gantt', icon: BarChart2,       label: 'Gantt Chart' },
  { to: '/team',  icon: Users,           label: 'Team' },
  { to: '/files', icon: FolderOpen,      label: 'Files' },
]

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
    >
      <Icon size={16} aria-hidden="true" />
      <span className="nav-label">{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  const [imgError, setImgError] = useState(false)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          {imgError ? (
            <WheelchairLogo size={24} color="#6E56CF" />
          ) : (
            <img
              src="/logo.png"
              width={32}
              height={32}
              alt="LEAN Hub"
              style={{ objectFit: 'contain' }}
              onError={() => setImgError(true)}
            />
          )}
        </div>
        <div className="sidebar-title">
          <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
            LEAN Hub
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            Capstone 2026
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Workspace</div>
        {links.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} end={to === '/'} />
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8 }}>
          <NavItem to="/admin" icon={Settings} label="Admin" />
        </div>
      </nav>

      <div className="sidebar-footer">
        <strong>Powered wheelchair basketball</strong>
        Torso-lean control · senior capstone
      </div>
    </aside>
  )
}
