import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Gantt from './pages/Gantt'
import Team from './pages/Team'
import Files from './pages/Files'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          {/* The shell is public and read-only; editing is gated per control.
              Files and Admin still need a session — anon cannot read those tables. */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="gantt" element={<Gantt />} />
            <Route path="team" element={<Team />} />
            <Route path="files" element={<ProtectedRoute><Files /></ProtectedRoute>} />
            <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
