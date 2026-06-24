import { useState, useEffect } from 'react'
import { toast } from 'react-toastify'
import { getPatientProblemList, addProblem, resolveProblem } from '../services/encounterService'

const ProblemList = ({ patientId, diagnosedBy, compact = false }) => {
  const [problems, setProblems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    icd10_code: '',
    description: '',
    onset_date: new Date().toISOString().split('T')[0],
    status: 'active',
    severity: 'moderate',
  })

  useEffect(() => {
    fetchProblems()
  }, [patientId])

  const fetchProblems = async () => {
    try {
      const { data, error } = await getPatientProblemList(patientId)
      if (error) throw error
      setProblems(data || [])
    } catch (error) {
      console.error('Error fetching problem list:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) return

    try {
      const { data, error } = await addProblem({
        patient_id: patientId,
        diagnosed_by: diagnosedBy,
        icd10_code: form.icd10_code || null,
        description: form.description,
        onset_date: form.onset_date,
        status: form.status,
        severity: form.severity,
      })
      if (error) throw error
      setProblems(prev => [data, ...prev])
      setShowForm(false)
      setForm({ icd10_code: '', description: '', onset_date: new Date().toISOString().split('T')[0], status: 'active', severity: 'moderate' })
      toast.success('Problem added')
    } catch (error) {
      toast.error('Failed to add problem')
    }
  }

  const handleResolve = async (problemId) => {
    try {
      const { error } = await resolveProblem(problemId)
      if (error) throw error
      setProblems(prev => prev.filter(p => p.id !== problemId))
      toast.success('Problem marked as resolved')
    } catch (error) {
      toast.error('Failed to resolve problem')
    }
  }

  const severityColor = (s) => {
    if (s === 'severe') return 'bg-red-100 text-red-700'
    if (s === 'moderate') return 'bg-amber-100 text-amber-700'
    return 'bg-green-100 text-green-700'
  }

  if (loading) return <div className="text-xs text-slate-400 py-2">Loading...</div>

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center justify-between">
        <h4 className={`font-semibold text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>
          Active Problems ({problems.length})
        </h4>
        {diagnosedBy && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-50 rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Problem description *"
            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={form.icd10_code}
              onChange={(e) => setForm(prev => ({ ...prev, icd10_code: e.target.value }))}
              placeholder="ICD-10 code"
              className="flex-1 text-xs border border-slate-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <select
              value={form.severity}
              onChange={(e) => setForm(prev => ({ ...prev, severity: e.target.value }))}
              className="text-xs border border-slate-200 rounded px-2 py-1.5"
            >
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Problem
          </button>
        </form>
      )}

      {problems.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">No active problems</p>
      ) : (
        <div className="space-y-1.5">
          {problems.map(problem => (
            <div key={problem.id} className="flex items-start justify-between bg-white border border-slate-100 rounded-lg px-3 py-2">
              <div>
                <div className="flex items-center gap-2">
                  {problem.icd10_code && (
                    <span className="font-mono text-xs text-blue-600">{problem.icd10_code}</span>
                  )}
                  <span className={`text-${compact ? 'xs' : 'sm'} text-slate-700`}>{problem.description}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${severityColor(problem.severity)}`}>
                    {problem.severity}
                  </span>
                  {problem.onset_date && (
                    <span className="text-xs text-slate-400">Since {problem.onset_date}</span>
                  )}
                </div>
              </div>
              {diagnosedBy && (
                <button
                  type="button"
                  onClick={() => handleResolve(problem.id)}
                  className="text-xs text-green-600 hover:text-green-800 font-medium shrink-0"
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProblemList
