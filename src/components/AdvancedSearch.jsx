import  { useState } from 'react'

/**
 * Advanced Search Component  
 * Global search across patients, drugs, appointments
 * Author: David Gabion Selorm
 */

const AdvancedSearch = ({ onClose }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState({ patients: [], drugs: [], appointments: [] })
  const [loading, setLoading] = useState(false)

  const performSearch = async () => {
    if (!searchTerm.trim()) return
    
    setLoading(true)
    try {
      const { supabase } = await import('../supabaseClient')
      
      const [patientsData, drugsData, appointmentsData] = await Promise.all([
        supabase.from('patients').select('*').ilike('name', `%${searchTerm}%`).limit(10),
        supabase.from('drugs').select('*').ilike('name', `%${searchTerm}%`).limit(10),
        supabase.from('appointments').select('*, patients(name)').or(`patients.name.ilike.%${searchTerm}%`).limit(10)
      ])

      setResults({
        patients: patientsData.data || [],
        drugs: drugsData.data || [],
        appointments: appointmentsData.data || []
      })
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalResults = results.patients.length + results.drugs.length + results.appointments.length

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Search patients, drugs, appointments..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button onClick={performSearch} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
              Search
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 px-3">
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="spinner mx-auto mb-2"></div>
              <p>Searching...</p>
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-3">🔍</div>
              <p>No results found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {results.patients.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Patients ({results.patients.length})</h3>
                  <div className="space-y-2">
                    {results.patients.map(patient => (
                      <a key={patient.id} href={`/patients?id=${patient.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                        <h4 className="font-medium">{patient.name}</h4>
                        <p className="text-sm text-gray-600">{patient.patient_id} • {patient.phone}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {results.drugs.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Drugs ({results.drugs.length})</h3>
                  <div className="space-y-2">
                    {results.drugs.map(drug => (
                      <a key={drug.id} href={`/drugs?id=${drug.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                        <h4 className="font-medium">{drug.name}</h4>
                        <p className="text-sm text-gray-600">{drug.category} • Stock: {drug.stock}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {results.appointments.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Appointments ({results.appointments.length})</h3>
                  <div className="space-y-2">
                    {results.appointments.map(apt => (
                      <a key={apt.id} href={`/appointments?id=${apt.id}`} className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                        <h4 className="font-medium">{apt.patients?.name}</h4>
                        <p className="text-sm text-gray-600">{new Date(apt.appointment_date).toLocaleDateString()}</p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdvancedSearch
