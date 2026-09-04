import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const pageTitles = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/gantt': 'Gantt Chart',
  '/team': 'Team',
  '/files': 'Files',
  '/admin': 'Admin',
}

export default function Layout() {
  const { pathname } = useLocation()
  const { loading } = useAuth()
  const title = pageTitles[pathname] || 'LEAN Hub'

  // Avoid flashing the signed-out view while the session is still resolving
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar title={title} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px', background: 'var(--bg-primary)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
