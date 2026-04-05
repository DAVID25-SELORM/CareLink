import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { useHospitalBranding } from '../hooks/useHospitalBranding'
import { supabase } from '../supabaseClient'
import carelinkLogo from '../assets/carelink-logo.svg'

/**
 * Login Page
 * User authentication for CareLink HMS
 */

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const { signIn } = useAuth()
  const { branding, hospitalDisplayName } = useHospitalBranding()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await signIn(email, password)

    setLoading(false)

    if (data && !error) {
      navigate('/dashboard')
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/dashboard`,
      })
      if (error) throw error
      toast.success('Password reset link sent! Check your email.')
      setShowForgotPassword(false)
      setResetEmail('')
    } catch (error) {
      toast.error(error.message || 'Failed to send reset email')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50 to-blue-100 p-4 sm:p-6">
      <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-soft w-full max-w-md border border-slate-100">
        <div className="text-center mb-6 sm:mb-8">
          <img
            src={carelinkLogo}
            alt="CareLink HMS logo"
            className="mx-auto h-20 sm:h-28 w-auto"
          />
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            {branding.platformName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {hospitalDisplayName}
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-3 sm:mt-4">
            Secure staff access for {branding.hospitalName || 'your hospital'} on the CareLink platform.
          </p>
          <p className="text-slate-500 text-xs mt-2">
            {branding.tagline || 'Powered by CareLink'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="your.email@hospital.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="........"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all-smooth disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowForgotPassword(!showForgotPassword)}
              className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
            >
              Forgot your password?
            </button>
          </div>
        </form>

        {showForgotPassword && (
          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Reset Password</h3>
            <form onSubmit={handleForgotPassword} className="space-y-3">
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Enter your email address"
              />
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-slate-700 hover:bg-slate-800 text-white font-medium py-2.5 px-4 rounded-lg transition-all-smooth disabled:opacity-50 text-sm"
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-slate-500">
          <p>{branding.platformName} v1.0</p>
          <p className="mt-1.5">Support: {branding.contactEmail || 'gabiondavidselorm@gmail.com'}</p>
        </div>
      </div>
    </div>
  )
}

export default Login
