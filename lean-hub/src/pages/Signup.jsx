import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, User, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import WheelchairLogo from '../components/WheelchairLogo'

export default function Signup() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error: err } = await signUp(form.email, form.password, form.fullName)
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  const set = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }))

  if (success) {
    return (
      <div className="auth-page">
        <div className="fade-in" style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 64, height: 64, background: 'rgba(63,185,80,0.12)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={28} color="var(--success)" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>Check your email</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{form.email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ width: '100%', padding: '10px 0' }}>
            Back to Sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="fade-in" style={{ width: '100%', maxWidth: 400 }}>
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
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>LEAN Hub</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Powered Wheelchair Basketball · Capstone 2026</p>
        </div>

        <div className="auth-card">
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 22 }}>Join the team</h2>

          {error && (
            <div className="alert-error" style={{ alignItems: 'center', marginBottom: 20, color: '#FCA5A5' }}>
              <AlertCircle size={15} aria-hidden="true" />{error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={15} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="signup-name" name="fullName" autoComplete="name" className="input" value={form.fullName} onChange={set('fullName')} placeholder="Jane Smith" required style={{ paddingLeft: 34 }} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input id="signup-email" type="email" name="email" autoComplete="email" className="input" value={form.email} onChange={set('email')} placeholder="you@example.com" required style={{ paddingLeft: 34 }} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input id="signup-password" type={showPassword ? 'text' : 'password'} name="password" autoComplete="new-password" className="input" value={form.password} onChange={set('password')} placeholder="Min. 6 characters" required style={{ paddingLeft: 34, paddingRight: 38 }} />
                <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(p => !p)} tabIndex={-1} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', padding: 2, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input id="signup-confirm" type={showConfirm ? 'text' : 'password'} name="confirm" autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} placeholder="Repeat password" required style={{ paddingLeft: 34, paddingRight: 38 }} />
                <button type="button" aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'} onClick={() => setShowConfirm(p => !p)} tabIndex={-1} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', padding: 2, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', marginTop: 8, padding: '10px 0', fontSize: 14 }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: '#fff' }} /> : 'Create Account'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
