import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

const pageTitles = {
  '/': 'Dashboard',
  '/tasks': 'Tasks',
  '/gantt': 'Gantt Chart',
  '/team': 'Team',
  '/files': 'Files',
}

export default function Layout() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] || 'LEAN Hub'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar title={title} />
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '28px 28px',
          background: 'var(--bg-primary)',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
