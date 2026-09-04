import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import WheelchairLogo from '../components/WheelchairLogo'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="auth-page">
      <div className="fade-in" style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="auth-logo">
            {imgError ? (
              <WheelchairLogo size={34} color="#6E56CF" />
            ) : (
              <img
                src="/logo.png"
                width={48}
                height={48}
                alt="LEAN"
                style={{ objectFit: 'contain' }}
                onError={() => setImgError(true)}
              />
            )}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
            LEAN Hub
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Powered Wheelchair Basketball · Capstone 2026
          </p>
        </div>

        {/* Card */}
        <div className="auth-card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 22 }}>Sign in to your workspace</h2>

          {error && (
            <div className="alert-error" style={{ alignItems: 'center', marginBottom: 20, color: '#FCA5A5' }}>
              <AlertCircle size={15} aria-hidden="true" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="login-email">Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  className="input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{ paddingLeft: 34 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  className="input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingLeft: 34, paddingRight: 38 }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', padding: 2, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: 8, padding: '10px 0', fontSize: 14 }}
            >
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            No account?{' '}
            <Link to="/signup" style={{ color: 'var(--accent-light)', fontWeight: 500 }}>
              Create one
            </Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
          <Link to="/" style={{ color: 'var(--text-secondary)' }}>
            Just looking? Browse the board read-only &rarr;
          </Link>
        </p>

      </div>
    </div>
  )
}
