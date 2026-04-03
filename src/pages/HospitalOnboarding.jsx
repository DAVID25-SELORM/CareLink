import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { withTimeout } from '../services/queryTimeout'
import { logAuditEvent } from '../services/auditLog'
import { canAccessPlatformOnboarding } from '../constants/platformAccess'

const HOSPITAL_STATUSES = ['lead', 'intake', 'provisioning', 'training', 'ready_for_go_live', 'live', 'paused']
const MODULE_OPTIONS = ['patients', 'appointments', 'laboratory', 'pharmacy', 'drug_management', 'billing', 'claims', 'reports', 'nurse_dashboard', 'records_dashboard', 'referrals']
const TASK_PHASE_ORDER = ['intake', 'technical', 'database', 'accounts', 'branding', 'go_live', 'security', 'handover']

const DEFAULT_TASK_TEMPLATE = [
  { phase: 'intake', task_name: 'Complete hospital intake form', task_details: 'Confirm owner email, hospital contact, branding assets, public URL, and launch modules.' },
  { phase: 'technical', task_name: 'Provision dedicated Supabase project', task_details: 'Create a fresh hospital database and confirm Auth email provider plus redirect URLs.' },
  { phase: 'technical', task_name: 'Provision dedicated Vercel deployment', task_details: 'Create a new Vercel project and add the hospital-specific Supabase environment variables.' },
  { phase: 'database', task_name: 'Run base CareLink schema', task_details: 'Execute database-setup.sql before any module scripts or production data entry.' },
  { phase: 'database', task_name: 'Enable requested modules', task_details: 'Run nurse-system-setup.sql, records-system-setup.sql, and referrals-setup.sql only when requested.' },
  { phase: 'accounts', task_name: 'Create owner account and sync public.users', task_details: 'Create the owner in Supabase Auth, update setup-users.sql first row, and run setup-users.sql.' },
  { phase: 'accounts', task_name: 'Create real hospital staff', task_details: 'Use the in-app User Management page after owner login; remove any test accounts before go-live.' },
  { phase: 'branding', task_name: 'Apply hospital branding', task_details: 'Update title, logo, favicon, colors, and agreed CareLink versus hospital branding treatment.' },
  { phase: 'go_live', task_name: 'Run full functional smoke test', task_details: 'Verify patients, appointments, prescriptions, pharmacy, billing, claims, and enabled specialty dashboards.' },
  { phase: 'security', task_name: 'Review data and security controls', task_details: 'Confirm no sample data remains, RLS is active, and only real staff have production access.' },
  { phase: 'handover', task_name: 'Train hospital staff and sign off', task_details: 'Train the owner plus enabled roles, share the user guide, and confirm first support review date.' },
]

const STATUS_STYLES = {
  lead: 'bg-slate-100 text-slate-700',
  intake: 'bg-blue-100 text-blue-700',
  provisioning: 'bg-amber-100 text-amber-700',
  training: 'bg-violet-100 text-violet-700',
  ready_for_go_live: 'bg-emerald-100 text-emerald-700',
  live: 'bg-green-100 text-green-700',
  paused: 'bg-rose-100 text-rose-700',
  pending: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  blocked: 'bg-rose-100 text-rose-700',
}

const PHASE_LABELS = {
  intake: 'Intake',
  technical: 'Technical Provisioning',
  database: 'Database Setup',
  accounts: 'Accounts',
  branding: 'Branding',
  go_live: 'Go-Live Test',
  security: 'Data and Security',
  handover: 'Training and Handover',
}

const EMPTY_FORM = {
  hospital_name: '',
  branch_location: '',
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  owner_full_name: '',
  owner_email: '',
  owner_phone: '',
  public_url: '',
  primary_color: '',
  secondary_color: '',
  status: 'lead',
  go_live_date: '',
  notes: '',
  enabled_modules: ['patients', 'appointments', 'pharmacy', 'billing'],
}

const normalizeStatusLabel = (value) => value.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase())
const isMissingOnboardingTableError = (message = '') => /hospitals|hospital_onboarding_tasks/i.test(message) && /(does not exist|could not find the table|relation .* does not exist)/i.test(message)
const getNullableText = (value) => (value.trim() ? value.trim() : null)
const getHospitalTaskStats = (hospitalTasks) => {
  const total = hospitalTasks.length
  const completed = hospitalTasks.filter((task) => task.status === 'completed').length
  return { total, completed, progress: total ? Math.round((completed / total) * 100) : 0, nextTask: hospitalTasks.find((task) => task.status !== 'completed') || null }
}

const formatDate = (value) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not set'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const HospitalOnboarding = () => {
  const { user, userRole } = useAuth()
  const hasPlatformAccess = canAccessPlatformOnboarding(user, userRole)
  const [hospitals, setHospitals] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedHospitalId, setSelectedHospitalId] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [updatingHospitalId, setUpdatingHospitalId] = useState(null)
  const [updatingTaskId, setUpdatingTaskId] = useState(null)

  useEffect(() => {
    if (!hasPlatformAccess) {
      setLoading(false)
      return
    }
    fetchOnboardingData()
  }, [hasPlatformAccess])

  const hospitalsWithStats = useMemo(() => hospitals.map((hospital) => {
    const hospitalTasks = tasks.filter((task) => task.hospital_id === hospital.id).sort((left, right) => left.sort_order - right.sort_order)
    return { ...hospital, onboardingStats: getHospitalTaskStats(hospitalTasks) }
  }), [hospitals, tasks])

  const selectedHospital = useMemo(() => hospitalsWithStats.find((hospital) => hospital.id === selectedHospitalId) || null, [hospitalsWithStats, selectedHospitalId])
  const selectedHospitalTasks = useMemo(() => tasks.filter((task) => task.hospital_id === selectedHospitalId).sort((left, right) => left.sort_order - right.sort_order), [tasks, selectedHospitalId])
  const groupedTasks = useMemo(() => TASK_PHASE_ORDER.map((phase) => ({ phase, label: PHASE_LABELS[phase], items: selectedHospitalTasks.filter((task) => task.phase === phase) })).filter((group) => group.items.length > 0), [selectedHospitalTasks])
  const overview = useMemo(() => {
    const totalHospitals = hospitalsWithStats.length
    const liveHospitals = hospitalsWithStats.filter((hospital) => hospital.status === 'live').length
    const activeOnboardings = hospitalsWithStats.filter((hospital) => hospital.status !== 'live').length
    const readyForLaunch = hospitalsWithStats.filter((hospital) => ['training', 'ready_for_go_live'].includes(hospital.status)).length
    const averageProgress = totalHospitals ? Math.round(hospitalsWithStats.reduce((sum, hospital) => sum + hospital.onboardingStats.progress, 0) / totalHospitals) : 0
    return { totalHospitals, liveHospitals, activeOnboardings, readyForLaunch, averageProgress }
  }, [hospitalsWithStats])

  const fetchOnboardingData = async () => {
    try {
      setLoading(true)
      setLoadError('')
      const [hospitalsResult, tasksResult] = await Promise.allSettled([
        withTimeout(supabase.from('hospitals').select('*').order('created_at', { ascending: false }), 'Hospital onboarding records'),
        withTimeout(
          supabase.from('hospital_onboarding_tasks').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
          'Hospital onboarding tasks',
        ),
      ])

      const hospitalsError = hospitalsResult.status === 'rejected' ? hospitalsResult.reason : hospitalsResult.value.error
      const tasksError = tasksResult.status === 'rejected' ? tasksResult.reason : tasksResult.value.error
      const errorMessages = [hospitalsError?.message, tasksError?.message].filter(Boolean)
      const nextSetupRequired = errorMessages.some(isMissingOnboardingTableError)
      const nextHospitals = hospitalsError ? [] : hospitalsResult.value.data || []
      const nextTasks = tasksError ? [] : tasksResult.value.data || []

      setSetupRequired(nextSetupRequired)
      setLoadError(nextSetupRequired ? '' : errorMessages.join(' '))
      setHospitals(nextHospitals)
      setTasks(nextTasks)
      setSelectedHospitalId((currentHospitalId) => {
        if (currentHospitalId && nextHospitals.some((hospital) => hospital.id === currentHospitalId)) {
          return currentHospitalId
        }
        return nextHospitals[0]?.id || null
      })
    } catch (error) {
      console.error('Error loading hospital onboarding data:', error)
      setLoadError(error.message || 'Unable to load hospital onboarding data.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => setFormData(EMPTY_FORM)

  const handleModuleToggle = (moduleName) => {
    setFormData((currentForm) => {
      const exists = currentForm.enabled_modules.includes(moduleName)
      return {
        ...currentForm,
        enabled_modules: exists
          ? currentForm.enabled_modules.filter((module) => module !== moduleName)
          : [...currentForm.enabled_modules, moduleName],
      }
    })
  }

  const handleCreateHospital = async (event) => {
    event.preventDefault()
    if (!formData.hospital_name.trim()) {
      toast.error('Hospital name is required')
      return
    }
    if (!formData.owner_email.trim()) {
      toast.error('Owner email is required')
      return
    }

    try {
      setSaving(true)
      const hospitalPayload = {
        hospital_name: formData.hospital_name.trim(),
        branch_location: getNullableText(formData.branch_location),
        contact_person: getNullableText(formData.contact_person),
        contact_phone: getNullableText(formData.contact_phone),
        contact_email: getNullableText(formData.contact_email),
        owner_full_name: getNullableText(formData.owner_full_name),
        owner_email: formData.owner_email.trim().toLowerCase(),
        owner_phone: getNullableText(formData.owner_phone),
        public_url: getNullableText(formData.public_url),
        primary_color: getNullableText(formData.primary_color),
        secondary_color: getNullableText(formData.secondary_color),
        status: formData.status,
        go_live_date: formData.go_live_date || null,
        notes: getNullableText(formData.notes),
        enabled_modules: formData.enabled_modules,
        created_by: user?.id || null,
      }

      const { data: hospital, error: hospitalError } = await withTimeout(
        supabase.from('hospitals').insert([hospitalPayload]).select().single(),
        'Create hospital onboarding record',
      )
      if (hospitalError) throw hospitalError

      const taskRows = DEFAULT_TASK_TEMPLATE.map((task, index) => ({
        hospital_id: hospital.id,
        phase: task.phase,
        task_name: task.task_name,
        task_details: task.task_details,
        sort_order: index + 1,
      }))

      const { error: taskError } = await withTimeout(
        supabase.from('hospital_onboarding_tasks').insert(taskRows),
        'Create hospital onboarding task list',
      )
      if (taskError) throw taskError

      await logAuditEvent({
        user,
        action: 'create_hospital_onboarding',
        tableName: 'hospitals',
        recordId: hospital.id,
        newValues: hospitalPayload,
      })

      toast.success(`${hospital.hospital_name} added to the onboarding pipeline`)
      setShowCreateForm(false)
      resetForm()
      await fetchOnboardingData()
      setSelectedHospitalId(hospital.id)
    } catch (error) {
      console.error('Error creating hospital onboarding record:', error)
      toast.error(error.message || 'Failed to create hospital onboarding record')
    } finally {
      setSaving(false)
    }
  }

  const updateHospitalStatus = async (hospitalId, nextStatus) => {
    try {
      setUpdatingHospitalId(hospitalId)
      const { error } = await withTimeout(
        supabase.from('hospitals').update({ status: nextStatus }).eq('id', hospitalId),
        'Update hospital status',
      )
      if (error) throw error

      setHospitals((currentHospitals) =>
        currentHospitals.map((hospital) => (hospital.id === hospitalId ? { ...hospital, status: nextStatus } : hospital)),
      )
      toast.success('Hospital stage updated')
    } catch (error) {
      console.error('Error updating hospital status:', error)
      toast.error(error.message || 'Failed to update hospital stage')
    } finally {
      setUpdatingHospitalId(null)
    }
  }

  const updateTaskStatus = async (taskId, nextStatus) => {
    try {
      setUpdatingTaskId(taskId)
      const payload = {
        status: nextStatus,
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
        completed_by: nextStatus === 'completed' ? user?.id || null : null,
      }
      const { error } = await withTimeout(
        supabase.from('hospital_onboarding_tasks').update(payload).eq('id', taskId),
        'Update onboarding task',
      )
      if (error) throw error

      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? { ...task, ...payload } : task)),
      )
      toast.success('Task updated')
    } catch (error) {
      console.error('Error updating onboarding task:', error)
      toast.error(error.message || 'Failed to update onboarding task')
    } finally {
      setUpdatingTaskId(null)
    }
  }

  if (!hasPlatformAccess) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Platform Onboarding</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">Hospital onboarding is reserved for the CareLink owner account</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            This area manages new client hospitals, not the day-to-day operations of a live hospital deployment.
          </p>
        </div>
      </DashboardLayout>
    )
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[320px] flex flex-col items-center justify-center text-center">
          <div className="spinner mb-4"></div>
          <h2 className="mb-2 text-xl font-semibold text-slate-800">Loading hospital onboarding hub</h2>
          <p className="text-slate-600">Fetching implementation pipeline data from CareLink.</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-900 to-emerald-700 px-6 py-7 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-100">CareLink Platform</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Hospital onboarding hub</h1>
              <p className="mt-3 text-sm leading-6 text-blue-50 sm:text-base">
                Track client intake, provisioning, go-live readiness, and handover from one owner-controlled dashboard.
                Each live hospital still gets its own dedicated Supabase and Vercel deployment.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm((currentState) => !currentState)}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition-all-smooth hover:-translate-y-0.5 hover:bg-slate-100"
            >
              {showCreateForm ? 'Close hospital form' : 'Onboard new hospital'}
            </button>
          </div>
        </section>

        {setupRequired ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm">
            Run <code>hospital-onboarding-setup.sql</code> in Supabase for this CareLink owner instance, then reload this page.
          </section>
        ) : null}

        {loadError ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-800 shadow-sm">
            {loadError}
          </section>
        ) : null}

        {showCreateForm ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-slate-900">New hospital intake</h2>
              <p className="mt-1 text-sm text-slate-600">Capture the owner account, launch modules, branding, and target go-live date.</p>
            </div>

            <form onSubmit={handleCreateHospital} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Hospital name</span><input type="text" value={formData.hospital_name} onChange={(event) => setFormData((current) => ({ ...current, hospital_name: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Sunrise Specialist Hospital" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Branch or location</span><input type="text" value={formData.branch_location} onChange={(event) => setFormData((current) => ({ ...current, branch_location: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Accra Central" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Status</span><select value={formData.status} onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">{HOSPITAL_STATUSES.map((status) => <option key={status} value={status}>{normalizeStatusLabel(status)}</option>)}</select></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Contact person</span><input type="text" value={formData.contact_person} onChange={(event) => setFormData((current) => ({ ...current, contact_person: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Operations manager" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Contact email</span><input type="email" value={formData.contact_email} onChange={(event) => setFormData((current) => ({ ...current, contact_email: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="ops@hospital.com" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Contact phone</span><input type="text" value={formData.contact_phone} onChange={(event) => setFormData((current) => ({ ...current, contact_phone: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="+233..." /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Owner full name</span><input type="text" value={formData.owner_full_name} onChange={(event) => setFormData((current) => ({ ...current, owner_full_name: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Hospital owner or admin lead" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Owner email</span><input type="email" value={formData.owner_email} onChange={(event) => setFormData((current) => ({ ...current, owner_email: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="owner@hospital.com" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Owner phone</span><input type="text" value={formData.owner_phone} onChange={(event) => setFormData((current) => ({ ...current, owner_phone: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="+233..." /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Target go-live date</span><input type="date" value={formData.go_live_date} onChange={(event) => setFormData((current) => ({ ...current, go_live_date: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Public URL</span><input type="text" value={formData.public_url} onChange={(event) => setFormData((current) => ({ ...current, public_url: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="https://hospital-carelink.vercel.app" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Primary color</span><input type="text" value={formData.primary_color} onChange={(event) => setFormData((current) => ({ ...current, primary_color: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="#1E88E5" /></label>
                <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Secondary color</span><input type="text" value={formData.secondary_color} onChange={(event) => setFormData((current) => ({ ...current, secondary_color: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="#0F766E" /></label>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-800">Modules at launch</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {MODULE_OPTIONS.map((module) => {
                    const checked = formData.enabled_modules.includes(module)
                    return (
                      <label key={module} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${checked ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                        <input type="checkbox" checked={checked} onChange={() => handleModuleToggle(module)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                        <span>{normalizeStatusLabel(module)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Implementation notes</span><textarea value={formData.notes} onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))} className="min-h-[120px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Special workflows, support constraints, payment preferences, or branding notes" /></label>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <button type="button" onClick={() => { setShowCreateForm(false); resetForm() }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Saving hospital...' : 'Create onboarding record'}</button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Tracked hospitals</p><p className="mt-3 text-3xl font-semibold text-slate-900">{overview.totalHospitals}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Active onboardings</p><p className="mt-3 text-3xl font-semibold text-slate-900">{overview.activeOnboardings}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Ready for launch</p><p className="mt-3 text-3xl font-semibold text-slate-900">{overview.readyForLaunch}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Live hospitals</p><p className="mt-3 text-3xl font-semibold text-slate-900">{overview.liveHospitals}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">Average checklist progress</p><p className="mt-3 text-3xl font-semibold text-slate-900">{overview.averageProgress}%</p></div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_1.65fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900">Hospital pipeline</h2>
              <p className="mt-1 text-sm text-slate-600">Click a hospital to inspect implementation status and next steps.</p>
            </div>

            {hospitalsWithStats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <p className="text-lg font-semibold text-slate-800">No hospitals tracked yet</p>
                <p className="mt-2 text-sm text-slate-600">Create your first onboarding record to start managing implementations from this dashboard.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {hospitalsWithStats.map((hospital) => (
                  <button key={hospital.id} type="button" onClick={() => setSelectedHospitalId(hospital.id)} className={`w-full rounded-2xl border p-5 text-left transition-all-smooth ${selectedHospitalId === hospital.id ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">{hospital.hospital_name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{hospital.branch_location || 'Location not yet set'}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[hospital.status]}`}>{normalizeStatusLabel(hospital.status)}</span>
                    </div>
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                        <span>{hospital.onboardingStats.completed} of {hospital.onboardingStats.total} tasks done</span>
                        <span>{hospital.onboardingStats.progress}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all-smooth" style={{ width: `${hospital.onboardingStats.progress}%` }} /></div>
                    </div>
                    <div className="mt-4 space-y-1 text-sm text-slate-600">
                      <p>Owner: {hospital.owner_email || 'Not set'}</p>
                      <p>Go-live: {formatDate(hospital.go_live_date)}</p>
                      <p>Next step: <span className="font-medium text-slate-800">{hospital.onboardingStats.nextTask?.task_name || 'All checklist items completed'}</span></p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {!selectedHospital ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <p className="text-lg font-semibold text-slate-800">Select a hospital</p>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Choose a hospital from the pipeline to see owner details, rollout modules, and the live checklist.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">{selectedHospital.branch_location || 'Hospital deployment'}</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-900">{selectedHospital.hospital_name}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{selectedHospital.notes || 'No implementation notes yet. Use this record to capture launch risks, branding constraints, and support expectations.'}</p>
                  </div>
                  <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current stage</span>
                      <select value={selectedHospital.status} onChange={(event) => updateHospitalStatus(selectedHospital.id, event.target.value)} disabled={updatingHospitalId === selectedHospital.id} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60">{HOSPITAL_STATUSES.map((status) => <option key={status} value={status}>{normalizeStatusLabel(status)}</option>)}</select>
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Owner account</p><p className="mt-3 text-sm font-semibold text-slate-900">{selectedHospital.owner_full_name || 'Not set'}</p><p className="mt-1 text-sm text-slate-600">{selectedHospital.owner_email || 'No email yet'}</p><p className="mt-1 text-sm text-slate-600">{selectedHospital.owner_phone || 'No phone yet'}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Client contact</p><p className="mt-3 text-sm font-semibold text-slate-900">{selectedHospital.contact_person || 'Not set'}</p><p className="mt-1 text-sm text-slate-600">{selectedHospital.contact_email || 'No email yet'}</p><p className="mt-1 text-sm text-slate-600">{selectedHospital.contact_phone || 'No phone yet'}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Target go-live</p><p className="mt-3 text-xl font-semibold text-slate-900">{formatDate(selectedHospital.go_live_date)}</p><p className="mt-1 text-sm text-slate-600">Progress {selectedHospital.onboardingStats.progress}% across the launch checklist.</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deployment URL</p><p className="mt-3 break-all text-sm font-semibold text-slate-900">{selectedHospital.public_url || 'Not assigned yet'}</p><p className="mt-1 text-sm text-slate-600">{selectedHospital.public_url ? 'URL captured and ready for rollout tracking.' : 'Add once Vercel is provisioned.'}</p></div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Launch modules</h3>
                      <p className="mt-1 text-sm text-slate-600">Confirm these against the hospital intake form before database provisioning starts.</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">{selectedHospital.onboardingStats.completed} / {selectedHospital.onboardingStats.total} tasks completed</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(selectedHospital.enabled_modules || []).length > 0 ? selectedHospital.enabled_modules.map((module) => <span key={module} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{normalizeStatusLabel(module)}</span>) : <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600">Modules not captured yet</span>}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Implementation checklist</h3>
                      <p className="mt-1 text-sm text-slate-600">This does not auto-provision Supabase or Vercel yet; it keeps the rollout disciplined and visible.</p>
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">Next step: {selectedHospital.onboardingStats.nextTask?.task_name || 'All tasks complete'}</div>
                  </div>
                  <div className="space-y-5">
                    {groupedTasks.map((group) => {
                      const completedInPhase = group.items.filter((task) => task.status === 'completed').length
                      return (
                        <div key={group.phase} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3">
                            <h4 className="text-base font-semibold text-slate-900">{group.label}</h4>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{completedInPhase} of {group.items.length} completed</p>
                          </div>
                          <div className="space-y-3">
                            {group.items.map((task) => (
                              <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">{task.task_name}</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-600">{task.task_details}</p>
                                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{task.completed_at ? `Completed ${formatDate(task.completed_at)}` : 'Not completed yet'}</p>
                                  </div>
                                  <select value={task.status} onChange={(event) => updateTaskStatus(task.id, event.target.value)} disabled={updatingTaskId === task.id} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 lg:w-44 disabled:cursor-not-allowed disabled:opacity-60">{['pending', 'in_progress', 'completed', 'blocked'].map((status) => <option key={status} value={status}>{normalizeStatusLabel(status)}</option>)}</select>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default HospitalOnboarding
