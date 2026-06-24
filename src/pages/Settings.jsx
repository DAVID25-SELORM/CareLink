import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import DashboardLayout from '../layouts/DashboardLayout'
import { pingHealthFlow } from '../services/healthflowService'

export default function Settings() {
  const { user } = useAuth()
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '')
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '')
  const [saving, setSaving] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  // HealthFlow integration config
  const [hfLoaded, setHfLoaded] = useState(false)
  const [hfEndpointId, setHfEndpointId] = useState(null)
  const [hfUrl, setHfUrl] = useState('http://server-pc:9090')
  const [hfToken, setHfToken] = useState('')
  const [hfEnabled, setHfEnabled] = useState(false)
  const [hfSaving, setHfSaving] = useState(false)
  const [hfPinging, setHfPinging] = useState(false)
  const [hfPingResult, setHfPingResult] = useState(null)

  useEffect(() => {
    loadHealthFlowConfig()
  }, [])

  const loadHealthFlowConfig = async () => {
    const { data } = await supabase
      .from('integration_endpoints')
      .select('*')
      .eq('endpoint_type', 'healthflow')
      .maybeSingle()
    if (data) {
      setHfEndpointId(data.id)
      setHfUrl(data.base_url || 'http://server-pc:9090')
      setHfToken(data.auth_config?.token || '')
      setHfEnabled(data.enabled ?? false)
    }
    setHfLoaded(true)
  }

  const saveHealthFlowConfig = async (e) => {
    e.preventDefault()
    setHfSaving(true)
    try {
      const payload = {
        endpoint_type: 'healthflow',
        name: 'HealthFlow Pharmacy POS',
        base_url: hfUrl.trim(),
        auth_type: 'token',
        auth_config: { token: hfToken.trim() },
        enabled: hfEnabled,
        updated_at: new Date().toISOString(),
      }
      if (hfEndpointId) {
        const { error } = await supabase
          .from('integration_endpoints')
          .update(payload)
          .eq('id', hfEndpointId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('integration_endpoints')
          .insert([payload])
          .select()
          .single()
        if (error) throw error
        setHfEndpointId(data.id)
      }
      toast.success('HealthFlow integration saved')
    } catch (err) {
      toast.error(err.message || 'Failed to save HealthFlow config')
    } finally {
      setHfSaving(false)
    }
  }

  const testHealthFlowConnection = async () => {
    setHfPinging(true)
    setHfPingResult(null)
    const result = await pingHealthFlow()
    setHfPingResult(result)
    setHfPinging(false)
    if (result.reachable) {
      toast.success(`HealthFlow connected — mode: ${result.mode}`)
    } else {
      toast.error(`Cannot reach HealthFlow: ${result.reason}`)
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone },
      })
      if (error) throw error
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setChangingPw(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast.error(err.message || 'Failed to change password')
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>

        {/* Profile Section */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Profile</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+233..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </section>

        {/* Password Section */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={changingPw}
              className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50 transition"
            >
              {changingPw ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        </section>

        {/* HealthFlow Integration Section */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-700">HealthFlow Pharmacy Integration</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Connect to the HealthFlow POS for live stock checks, NHIS member lookup, and claim submission via CLAIM-it.
              </p>
            </div>
            {hfPingResult && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                hfPingResult.reachable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {hfPingResult.reachable ? '● Online' : '● Offline'}
              </span>
            )}
          </div>

          {hfLoaded && (
            <form onSubmit={saveHealthFlowConfig} className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  id="hf-enabled"
                  type="checkbox"
                  checked={hfEnabled}
                  onChange={(e) => setHfEnabled(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="hf-enabled" className="text-sm font-medium text-slate-700">
                  Enable HealthFlow integration
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Branch Server URL</label>
                <input
                  type="url"
                  value={hfUrl}
                  onChange={(e) => setHfUrl(e.target.value)}
                  placeholder="http://server-pc:9090"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">e.g. http://server-pc:9090 or http://192.168.1.x:9090</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Branch Token (x-branch-token)</label>
                <input
                  type="password"
                  value={hfToken}
                  onChange={(e) => setHfToken(e.target.value)}
                  placeholder="hf_local_..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  autoComplete="off"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Found in the HealthFlow branch server .env as <code className="bg-slate-100 px-1 rounded">BRANCH_TOKEN</code>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={hfSaving}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {hfSaving ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={testHealthFlowConnection}
                  disabled={hfPinging}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 px-5 py-2 text-sm font-medium text-slate-700 disabled:opacity-50 transition"
                >
                  {hfPinging ? 'Testing…' : 'Test Connection'}
                </button>
              </div>

              {hfPingResult && !hfPingResult.reachable && (
                <p className="text-xs text-red-600 bg-red-50 rounded p-2">
                  {hfPingResult.reason}. Make sure HealthFlow is running on server-pc and the token matches.
                </p>
              )}
            </form>
          )}
        </section>

        {/* App Info */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-700 mb-3">About CareLink HMS</h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-500">Version</dt>
            <dd className="text-slate-700 font-medium">1.0.0</dd>
            <dt className="text-slate-500">Platform</dt>
            <dd className="text-slate-700 font-medium">Web (PWA)</dd>
            <dt className="text-slate-500">Author</dt>
            <dd className="text-slate-700 font-medium">David Gabion Selorm</dd>
            <dt className="text-slate-500">Contact</dt>
            <dd className="text-slate-700 font-medium">gabiondavidselorm@gmail.com</dd>
          </dl>
        </section>
      </div>
    </DashboardLayout>
  )
}
