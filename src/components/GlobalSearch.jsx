import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { toast } from 'react-toastify'

/**
 * Global Search Component
 * Searches across patients, prescriptions, drugs, appointments, and claims
 * Author: David Gabion Selorm
 */

const GlobalSearch = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState({
    patients: [],
    prescriptions: [],
    drugs: [],
    appointments: [],
    claims: [],
    labTests: [],
    referrals: []
  })
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef(null)

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 2) {
        performSearch()
      } else {
        setResults({
          patients: [],
          prescriptions: [],
          drugs: [],
          appointments: [],
          claims: [],
          labTests: [],
          referrals: []
        })
      }
    }, 300)

    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])

  const performSearch = async () => {
    try {
      setLoading(true)
      const searchPattern = `%${searchTerm}%`

      const [patientsRes, prescriptionsRes, drugsRes, appointmentsRes, claimsRes, labTestsRes, referralsRes] = await Promise.allSettled([
        supabase
          .from('patients')
          .select('id, name, phone, nhis_number, insurance_type')
          .or(`name.ilike.${searchPattern},phone.ilike.${searchPattern},nhis_number.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('prescriptions')
          .select('id, diagnosis, created_at, patients(name)')
          .or(`diagnosis.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('drugs')
          .select('id, name, category, price, stock')
          .or(`name.ilike.${searchPattern},category.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, patients(name), users(full_name)')
          .limit(5),
        supabase
          .from('claims')
          .select('id, amount, status, insurance_type, patients(name)')
          .limit(5),
        supabase
          .from('lab_tests')
          .select('id, test_name, test_type, status, patients(name)')
          .or(`test_name.ilike.${searchPattern},test_type.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from('referrals')
          .select('id, referral_reason, status, referred_to, patients(name)')
          .or(`referral_reason.ilike.${searchPattern},referred_to.ilike.${searchPattern}`)
          .limit(5)
      ])

      setResults({
        patients: patientsRes.status === 'fulfilled' ? patientsRes.value.data || [] : [],
        prescriptions: prescriptionsRes.status === 'fulfilled' ? prescriptionsRes.value.data || [] : [],
        drugs: drugsRes.status === 'fulfilled' ? drugsRes.value.data || [] : [],
        appointments: appointmentsRes.status === 'fulfilled' ? appointmentsRes.value.data || [] : [],
        claims: claimsRes.status === 'fulfilled' ? claimsRes.value.data || [] : [],
        labTests: labTestsRes.status === 'fulfilled' ? labTestsRes.value.data || [] : [],
        referrals: referralsRes.status === 'fulfilled' ? referralsRes.value.data || [] : []
      })

      setShowResults(true)
    } catch (error) {
      console.error('Error searching:', error)
      toast.error('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const totalResults = 
    results.patients.length + 
    results.prescriptions.length + 
    results.drugs.length + 
    results.appointments.length +
    results.claims.length +
    results.labTests.length +
    results.referrals.length

  return (
    <div className="relative w-full" ref={searchRef}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search patients, drugs, prescriptions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm && setShowResults(true)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-[#f7f8fe] pl-11 pr-4 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
        />
        <svg
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchTerm && (
        <div className="absolute z-50 mt-3 max-h-96 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.15)]">
          {totalResults === 0 && !loading ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No results found for "{searchTerm}"</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Patients */}
              {results.patients.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Patients</p>
                  {results.patients.map((patient) => (
                    <Link
                      key={patient.id}
                      to="/patients"
                      onClick={() => setShowResults(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">👤</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{patient.name}</p>
                        <p className="text-xs text-gray-500">{patient.phone} • {patient.insurance_type || 'No insurance'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Drugs */}
              {results.drugs.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Drugs</p>
                  {results.drugs.map((drug) => (
                    <Link
                      key={drug.id}
                      to="/drugs"
                      onClick={() => setShowResults(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-green-600 font-semibold text-sm">💊</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{drug.name}</p>
                        <p className="text-xs text-gray-500">{drug.category} • Stock: {drug.stock} • GH₵{drug.price}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Prescriptions */}
              {results.prescriptions.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Prescriptions</p>
                  {results.prescriptions.map((prescription) => (
                    <Link
                      key={prescription.id}
                      to="/prescriptions"
                      onClick={() => setShowResults(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-purple-600 font-semibold text-sm">📋</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {prescription.patients?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {prescription.diagnosis || 'No diagnosis'} • {new Date(prescription.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Appointments */}
              {results.appointments.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Appointments</p>
                  {results.appointments.map((appointment) => (
                    <Link
                      key={appointment.id}
                      to="/appointments"
                      onClick={() => setShowResults(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold text-sm">📅</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {appointment.patients?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(appointment.appointment_date).toLocaleDateString()} at {appointment.appointment_time}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Claims */}
              {results.claims.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Claims</p>
                  {results.claims.map((claim) => (
                    <Link
                      key={claim.id}
                      to="/claims"
                      onClick={() => setShowResults(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                        <span className="text-yellow-600 font-semibold text-sm">🧾</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {claim.patients?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-xs text-gray-500">
                          GH₵{claim.amount} • {claim.status} • {claim.insurance_type}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Lab Tests */}
              {results.labTests.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Lab Tests</p>
                  {results.labTests.map((test) => (
                    <Link
                      key={test.id}
                      to="/laboratory"
                      onClick={() => setShowResults(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                        <span className="text-teal-600 font-semibold text-sm">🔬</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {test.patients?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {test.test_name} • {test.test_type} • {test.status}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Referrals */}
              {results.referrals.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Referrals</p>
                  {results.referrals.map((referral) => (
                    <Link
                      key={referral.id}
                      to="/referrals"
                      onClick={() => setShowResults(false)}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">
                        <span className="text-pink-600 font-semibold text-sm">↗️</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {referral.patients?.name || 'Unknown Patient'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {referral.referral_reason} • {referral.referred_to} • {referral.status}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default GlobalSearch
