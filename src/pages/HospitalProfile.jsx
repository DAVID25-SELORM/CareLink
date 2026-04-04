import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { useAuth } from '../hooks/useAuth'
import {
  DEFAULT_HOSPITAL_BRANDING,
  updateHospitalBrandingCache,
  useHospitalBranding,
} from '../hooks/useHospitalBranding'
import { supabase } from '../supabaseClient'
import { withTimeout } from '../services/queryTimeout'
import { logAuditEvent } from '../services/auditLog'

const MASTER_PLATFORM_NAME = 'CareLink HMS'

const EMPTY_FORM = {
  hospital_name: '',
  branch_name: '',
  dashboard_label: '',
  tagline: 'Powered by CareLink',
  primary_color: '',
  secondary_color: '',
  contact_email: '',
  contact_phone: '',
}

const isMissingHospitalProfileError = (message = '') =>
  /hospital_profile/i.test(message) &&
  /(does not exist|could not find the table|relation .* does not exist)/i.test(message)

const getNullableText = (value) => {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : null
}

const HospitalProfile = () => {
  const { user } = useAuth()
  const { branding } = useHospitalBranding()
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadError, setLoadError] = useState('')

  const previewName = useMemo(() => {
    const dashboardLabel = formData.dashboard_label.trim()
    const hospitalName = formData.hospital_name.trim()
    return dashboardLabel || hospitalName || 'Hospital Dashboard'
  }, [formData.dashboard_label, formData.hospital_name])

  useEffect(() => {
    fetchHospitalProfile()
  }, [])

  const fetchHospitalProfile = async () => {
    try {
      setLoading(true)
      setLoadError('')

      const { data, error } = await withTimeout(
        supabase.from('hospital_profile').select('*').eq('singleton_key', true).maybeSingle(),
        'Hospital profile',
      )

      if (error) throw error

      const nextProfile = {
        hospital_name: data?.hospital_name || '',
        branch_name: data?.branch_name || '',
        dashboard_label: data?.dashboard_label || '',
        tagline: data?.tagline || DEFAULT_HOSPITAL_BRANDING.tagline,
        primary_color: data?.primary_color || '',
        secondary_color: data?.secondary_color || '',
        contact_email: data?.contact_email || '',
        contact_phone: data?.contact_phone || '',
      }

      setFormData(nextProfile)
      updateHospitalBrandingCache({
        platform_name: MASTER_PLATFORM_NAME,
        ...data,
      })
      setSetupRequired(false)
    } catch (error) {
      if (isMissingHospitalProfileError(error.message)) {
        setSetupRequired(true)
        setFormData({
          ...EMPTY_FORM,
          hospital_name: branding.hospitalName || '',
          branch_name: branding.branchName || '',
          dashboard_label: branding.dashboardLabel || '',
          tagline: branding.tagline || DEFAULT_HOSPITAL_BRANDING.tagline,
          primary_color: branding.primaryColor || '',
          secondary_color: branding.secondaryColor || '',
          contact_email: branding.contactEmail || '',
          contact_phone: branding.contactPhone || '',
        })
        setLoadError('')
      } else {
        console.error('Error loading hospital profile:', error)
        setLoadError(error.message || 'Unable to load the hospital profile.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()

    if (!formData.hospital_name.trim()) {
      toast.error('Hospital name is required')
      return
    }

    try {
      setSaving(true)

      const profilePayload = {
        singleton_key: true,
        platform_name: MASTER_PLATFORM_NAME,
        hospital_name: formData.hospital_name.trim(),
        branch_name: getNullableText(formData.branch_name),
        dashboard_label: getNullableText(formData.dashboard_label),
        tagline: formData.tagline.trim() || DEFAULT_HOSPITAL_BRANDING.tagline,
        primary_color: getNullableText(formData.primary_color),
        secondary_color: getNullableText(formData.secondary_color),
        contact_email: getNullableText(formData.contact_email),
        contact_phone: getNullableText(formData.contact_phone),
      }

      const { data, error } = await withTimeout(
        supabase
          .from('hospital_profile')
          .upsert([profilePayload], { onConflict: 'singleton_key' })
          .select()
          .single(),
        'Save hospital profile',
      )

      if (error) throw error

      updateHospitalBrandingCache(data)
      await logAuditEvent({
        user,
        action: 'update_hospital_profile',
        tableName: 'hospital_profile',
        recordId: null,
        newValues: profilePayload,
      })

      toast.success('Hospital profile updated')
      setSetupRequired(false)
    } catch (error) {
      console.error('Error saving hospital profile:', error)
      toast.error(error.message || 'Failed to save the hospital profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[320px] flex flex-col items-center justify-center text-center">
          <div className="spinner mb-4"></div>
          <h2 className="mb-2 text-xl font-semibold text-slate-800">Loading hospital profile</h2>
          <p className="text-slate-600">Fetching the name and branding used for this deployment.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-900 to-emerald-700 px-6 py-7 text-white shadow-xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">Hospital Identity</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">CareLink umbrella brand, hospital-specific dashboard name</h1>
            <p className="mt-3 text-sm leading-6 text-blue-50 sm:text-base">
              Keep every deployment under the CareLink parent name while showing each hospital&apos;s own identity on the login page, sidebar, and dashboard.
            </p>
          </div>
        </section>

        {setupRequired ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm">
            Run <code>hospital-profile-setup.sql</code> in Supabase for this deployment, then reload this page.
          </section>
        ) : null}

        {loadError ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-800 shadow-sm">
            {loadError}
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-slate-900">Hospital profile</h2>
              <p className="mt-1 text-sm text-slate-600">
                This deployment will always keep <span className="font-semibold text-slate-900">{MASTER_PLATFORM_NAME}</span> as the parent brand.
                The fields below control which hospital name appears to staff.
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parent platform</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{MASTER_PLATFORM_NAME}</p>
                <p className="mt-1 text-sm text-slate-600">This stays consistent across all hospitals using CareLink.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Hospital name</span>
                  <input
                    type="text"
                    value={formData.hospital_name}
                    onChange={(event) => setFormData((current) => ({ ...current, hospital_name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Sunrise Specialist Hospital"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Branch or location</span>
                  <input
                    type="text"
                    value={formData.branch_name}
                    onChange={(event) => setFormData((current) => ({ ...current, branch_name: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Accra Central"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Dashboard label</span>
                  <input
                    type="text"
                    value={formData.dashboard_label}
                    onChange={(event) => setFormData((current) => ({ ...current, dashboard_label: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Sunrise Hospital Dashboard"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Tagline</span>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(event) => setFormData((current) => ({ ...current, tagline: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Powered by CareLink"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Primary color</span>
                  <input
                    type="text"
                    value={formData.primary_color}
                    onChange={(event) => setFormData((current) => ({ ...current, primary_color: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="#1E88E5"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Secondary color</span>
                  <input
                    type="text"
                    value={formData.secondary_color}
                    onChange={(event) => setFormData((current) => ({ ...current, secondary_color: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="#0F766E"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Support email</span>
                  <input
                    type="email"
                    value={formData.contact_email}
                    onChange={(event) => setFormData((current) => ({ ...current, contact_email: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="support@hospital.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">Support phone</span>
                  <input
                    type="text"
                    value={formData.contact_phone}
                    onChange={(event) => setFormData((current) => ({ ...current, contact_phone: event.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="+233..."
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={fetchHospitalProfile}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Reload profile
                </button>
                <button
                  type="submit"
                  disabled={saving || setupRequired}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving profile...' : 'Save hospital profile'}
                </button>
              </div>
            </form>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Live preview</p>
              <div
                className="mt-4 overflow-hidden rounded-3xl p-5 text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${formData.primary_color || '#0f172a'} 0%, ${formData.secondary_color || '#0f766e'} 100%)`,
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">{MASTER_PLATFORM_NAME}</p>
                <h3 className="mt-3 text-2xl font-semibold">{previewName}</h3>
                <p className="mt-2 text-sm text-blue-50">{formData.branch_name.trim() || formData.hospital_name.trim() || 'Hospital branch or location'}</p>
                <p className="mt-4 text-sm font-medium text-white/90">{formData.tagline.trim() || DEFAULT_HOSPITAL_BRANDING.tagline}</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Shown on login</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{previewName}</p>
                  <p className="mt-1 text-sm text-slate-600">{formData.tagline.trim() || DEFAULT_HOSPITAL_BRANDING.tagline}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Shown in sidebar</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{formData.hospital_name.trim() || 'Hospital name'}</p>
                  <p className="mt-1 text-sm text-slate-600">{MASTER_PLATFORM_NAME}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">How this works</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li>CareLink HMS remains the mother brand across every deployment.</li>
                <li>Your hospital name appears on the login page, sidebar, and dashboard welcome section.</li>
                <li>Run <code>hospital-profile-setup.sql</code> once per deployment, then manage names here.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default HospitalProfile
