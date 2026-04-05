import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import DashboardLayout from '../layouts/DashboardLayout'
import { supabase } from '../supabaseClient'

/**
 * Patient Detail Page
 * Full patient history: prescriptions, lab tests, appointments, payments, referrals, vitals
 * Author: David Gabion Selorm
 */

const PatientDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [prescriptions, setPrescriptions] = useState([])
  const [labTests, setLabTests] = useState([])
  const [appointments, setAppointments] = useState([])
  const [payments, setPayments] = useState([])
  const [vitals, setVitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchAll()
  }, [id])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [
        patientRes,
        prescriptionsRes,
        labTestsRes,
        appointmentsRes,
        paymentsRes,
        vitalsRes,
      ] = await Promise.all([
        supabase.from('patients').select('*').eq('id', id).single(),
        supabase
          .from('prescriptions')
          .select('*, users(full_name, email)')
          .eq('patient_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('lab_tests')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('appointments')
          .select('*, users(full_name, email)')
          .eq('patient_id', id)
          .order('appointment_date', { ascending: false })
          .limit(20),
        supabase
          .from('payments')
          .select('*')
          .eq('patient_id', id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('patient_vitals')
          .select('*')
          .eq('patient_id', id)
          .order('recorded_at', { ascending: false })
          .limit(10),
      ])

      if (patientRes.error) throw patientRes.error
      setPatient(patientRes.data)
      setPrescriptions(prescriptionsRes.data || [])
      setLabTests(labTestsRes.data || [])
      setAppointments(appointmentsRes.data || [])
      setPayments(paymentsRes.data || [])
      setVitals(vitalsRes.data || [])
    } catch (error) {
      console.error('Error fetching patient details:', error)
      toast.error('Failed to load patient details')
      navigate('/patients')
    } finally {
      setLoading(false)
    }
  }

  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'prescriptions', label: `Prescriptions (${prescriptions.length})` },
    { id: 'lab', label: `Lab Tests (${labTests.length})` },
    { id: 'appointments', label: `Appointments (${appointments.length})` },
    { id: 'payments', label: `Payments (${payments.length})` },
    { id: 'vitals', label: `Vitals (${vitals.length})` },
  ]

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[320px] flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!patient) return null

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Back link */}
        <Link to="/patients" className="text-sm text-blue-600 hover:underline">
          ← Back to Patients
        </Link>

        {/* Patient Header Card */}
        <div className="bg-white rounded-xl shadow-soft border border-slate-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold">
                  {patient.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">{patient.name}</h1>
                  <p className="text-slate-500 text-sm mt-0.5">
                    ID: {patient.patient_id || patient.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Age</p>
                  <p className="font-medium text-slate-700">{patient.age || '—'} yrs</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Gender</p>
                  <p className="font-medium text-slate-700 capitalize">{patient.gender || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Phone</p>
                  <p className="font-medium text-slate-700">{patient.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Address</p>
                  <p className="font-medium text-slate-700">{patient.address || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Insurance</p>
                  <p className="font-medium text-slate-700 uppercase">{patient.insurance_type || 'None'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">NHIS No.</p>
                  <p className="font-medium text-slate-700">{patient.nhis_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Ins. Name</p>
                  <p className="font-medium text-slate-700">{patient.insurance_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">Registered</p>
                  <p className="font-medium text-slate-700">
                    {patient.created_at ? new Date(patient.created_at).toLocaleDateString('en-GB') : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="flex gap-3 sm:flex-col sm:items-end">
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{prescriptions.length}</p>
                <p className="text-xs text-blue-500">Prescriptions</p>
              </div>
              <div className="bg-green-50 rounded-lg px-4 py-3 text-center">
                <p className="text-2xl font-bold text-green-600">GH₵{totalPaid.toFixed(2)}</p>
                <p className="text-xs text-green-500">Total Paid</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="flex overflow-x-auto border-b border-slate-100">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* Overview */}
            {activeTab === 'overview' && (
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-slate-700 mb-3">Recent Prescriptions</h3>
                  {prescriptions.slice(0, 3).length === 0 ? (
                    <p className="text-slate-400 text-sm">No prescriptions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {prescriptions.slice(0, 3).map(p => (
                        <div key={p.id} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                          <span className="text-slate-700">{p.diagnosis || 'No diagnosis'}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            p.status === 'dispensed' ? 'bg-green-100 text-green-700' :
                            p.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{p.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 mb-3">Recent Lab Tests</h3>
                  {labTests.slice(0, 3).length === 0 ? (
                    <p className="text-slate-400 text-sm">No lab tests yet</p>
                  ) : (
                    <div className="space-y-2">
                      {labTests.slice(0, 3).map(t => (
                        <div key={t.id} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                          <span className="text-slate-700">{t.test_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            t.status === 'completed' ? 'bg-green-100 text-green-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{t.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 mb-3">Upcoming Appointments</h3>
                  {appointments.filter(a => a.status === 'scheduled').slice(0, 3).length === 0 ? (
                    <p className="text-slate-400 text-sm">No upcoming appointments</p>
                  ) : (
                    <div className="space-y-2">
                      {appointments.filter(a => a.status === 'scheduled').slice(0, 3).map(a => (
                        <div key={a.id} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                          <span className="text-slate-700">{new Date(a.appointment_date).toLocaleDateString('en-GB')}</span>
                          <span className="text-slate-500">{a.users?.full_name || a.users?.email || 'Doctor'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 mb-3">Latest Vitals</h3>
                  {vitals.slice(0, 1).length === 0 ? (
                    <p className="text-slate-400 text-sm">No vitals recorded</p>
                  ) : (
                    vitals.slice(0, 1).map(v => (
                      <div key={v.id} className="grid grid-cols-2 gap-2 text-sm">
                        {v.blood_pressure_systolic && <div><span className="text-slate-400">BP: </span><span className="font-medium">{v.blood_pressure_systolic}/{v.blood_pressure_diastolic} mmHg</span></div>}
                        {v.heart_rate && <div><span className="text-slate-400">HR: </span><span className="font-medium">{v.heart_rate} bpm</span></div>}
                        {v.temperature && <div><span className="text-slate-400">Temp: </span><span className="font-medium">{v.temperature}°C</span></div>}
                        {v.oxygen_saturation && <div><span className="text-slate-400">SpO2: </span><span className="font-medium">{v.oxygen_saturation}%</span></div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Prescriptions Tab */}
            {activeTab === 'prescriptions' && (
              <div className="space-y-3">
                {prescriptions.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No prescriptions found</p>
                ) : (
                  prescriptions.map(p => (
                    <div key={p.id} className="border border-slate-100 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-800">{p.diagnosis || 'No diagnosis recorded'}</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Dr. {p.users?.full_name || p.users?.email || 'Unknown'} •{' '}
                            {new Date(p.created_at).toLocaleDateString('en-GB')}
                          </p>
                          {p.notes && <p className="text-sm text-slate-600 mt-1">{p.notes}</p>}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          p.status === 'dispensed' ? 'bg-green-100 text-green-700' :
                          p.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          p.status === 'paid' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{p.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Lab Tests Tab */}
            {activeTab === 'lab' && (
              <div className="space-y-3">
                {labTests.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No lab tests found</p>
                ) : (
                  labTests.map(t => (
                    <div key={t.id} className="border border-slate-100 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-800">{t.test_name}</p>
                          <p className="text-sm text-slate-500">{t.test_type} • {new Date(t.created_at).toLocaleDateString('en-GB')}</p>
                          {t.result && <p className="text-sm text-slate-700 mt-2 font-medium">Result: {t.result}</p>}
                          {t.notes && <p className="text-sm text-slate-500 mt-1">{t.notes}</p>}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          t.status === 'completed' ? 'bg-green-100 text-green-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>{t.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Appointments Tab */}
            {activeTab === 'appointments' && (
              <div className="space-y-3">
                {appointments.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No appointments found</p>
                ) : (
                  appointments.map(a => (
                    <div key={a.id} className="border border-slate-100 rounded-lg p-4 flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-800">
                          {new Date(a.appointment_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          {a.appointment_time && ` at ${a.appointment_time}`}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Dr. {a.users?.full_name || a.users?.email || 'Unknown'}</p>
                        {a.reason && <p className="text-sm text-slate-600 mt-1">{a.reason}</p>}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        a.status === 'completed' ? 'bg-green-100 text-green-700' :
                        a.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{a.status}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div className="space-y-3">
                {payments.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No payment records found</p>
                ) : (
                  <>
                    <div className="bg-green-50 rounded-lg p-4 text-center mb-4">
                      <p className="text-2xl font-bold text-green-700">GH₵{totalPaid.toFixed(2)}</p>
                      <p className="text-sm text-green-600">Total paid across all visits</p>
                    </div>
                    {payments.map(p => (
                      <div key={p.id} className="border border-slate-100 rounded-lg p-4 flex justify-between items-center">
                        <div>
                          <p className="font-medium text-slate-800">GH₵{parseFloat(p.amount).toFixed(2)}</p>
                          <p className="text-sm text-slate-500 capitalize">{p.payment_method} • {new Date(p.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{p.status}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Vitals Tab */}
            {activeTab === 'vitals' && (
              <div className="space-y-3">
                {vitals.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No vitals recorded yet</p>
                ) : (
                  vitals.map(v => (
                    <div key={v.id} className="border border-slate-100 rounded-lg p-4">
                      <p className="text-xs text-slate-400 mb-3">
                        {v.recorded_at ? new Date(v.recorded_at).toLocaleString('en-GB') : new Date(v.created_at).toLocaleString('en-GB')}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        {v.blood_pressure_systolic && (
                          <div className="bg-slate-50 rounded p-2">
                            <p className="text-xs text-slate-400">Blood Pressure</p>
                            <p className="font-semibold text-slate-800">{v.blood_pressure_systolic}/{v.blood_pressure_diastolic} mmHg</p>
                          </div>
                        )}
                        {v.heart_rate && (
                          <div className="bg-slate-50 rounded p-2">
                            <p className="text-xs text-slate-400">Heart Rate</p>
                            <p className="font-semibold text-slate-800">{v.heart_rate} bpm</p>
                          </div>
                        )}
                        {v.temperature && (
                          <div className="bg-slate-50 rounded p-2">
                            <p className="text-xs text-slate-400">Temperature</p>
                            <p className="font-semibold text-slate-800">{v.temperature}°C</p>
                          </div>
                        )}
                        {v.oxygen_saturation && (
                          <div className="bg-slate-50 rounded p-2">
                            <p className="text-xs text-slate-400">SpO₂</p>
                            <p className="font-semibold text-slate-800">{v.oxygen_saturation}%</p>
                          </div>
                        )}
                        {v.respiratory_rate && (
                          <div className="bg-slate-50 rounded p-2">
                            <p className="text-xs text-slate-400">Resp. Rate</p>
                            <p className="font-semibold text-slate-800">{v.respiratory_rate} /min</p>
                          </div>
                        )}
                        {v.weight && (
                          <div className="bg-slate-50 rounded p-2">
                            <p className="text-xs text-slate-400">Weight</p>
                            <p className="font-semibold text-slate-800">{v.weight} kg</p>
                          </div>
                        )}
                      </div>
                      {v.notes && <p className="text-sm text-slate-500 mt-2">{v.notes}</p>}
                    </div>
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default PatientDetail
