import { useState, useRef, useEffect } from 'react'

// Common ICD-10 codes for Ghana OPD — loaded as a static subset for offline/typeahead use
// Full catalog would come from the database (diagnoses or a codes lookup table)
const ICD10_COMMON = [
  { code: 'B50.9', desc: 'Plasmodium falciparum malaria, unspecified' },
  { code: 'B51.9', desc: 'Plasmodium vivax malaria, unspecified' },
  { code: 'J06.9', desc: 'Acute upper respiratory infection, unspecified' },
  { code: 'J18.9', desc: 'Pneumonia, unspecified organism' },
  { code: 'A09', desc: 'Infectious gastroenteritis and colitis, unspecified' },
  { code: 'K29.7', desc: 'Gastritis, unspecified' },
  { code: 'N39.0', desc: 'Urinary tract infection, site not specified' },
  { code: 'J45.9', desc: 'Asthma, unspecified' },
  { code: 'I10', desc: 'Essential (primary) hypertension' },
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', desc: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'J02.9', desc: 'Acute pharyngitis, unspecified' },
  { code: 'J03.9', desc: 'Acute tonsillitis, unspecified' },
  { code: 'K35.8', desc: 'Acute appendicitis, other and unspecified' },
  { code: 'D50.9', desc: 'Iron deficiency anaemia, unspecified' },
  { code: 'B82.9', desc: 'Intestinal parasitism, unspecified' },
  { code: 'L30.9', desc: 'Dermatitis, unspecified' },
  { code: 'M54.5', desc: 'Low back pain' },
  { code: 'G43.9', desc: 'Migraine, unspecified' },
  { code: 'R50.9', desc: 'Fever, unspecified' },
  { code: 'R10.4', desc: 'Other and unspecified abdominal pain' },
  { code: 'R51', desc: 'Headache' },
  { code: 'R05', desc: 'Cough' },
  { code: 'R11.2', desc: 'Nausea with vomiting, unspecified' },
  { code: 'K59.0', desc: 'Constipation' },
  { code: 'R42', desc: 'Dizziness and giddiness' },
  { code: 'O80', desc: 'Single spontaneous delivery' },
  { code: 'O82', desc: 'Encounter for cesarean delivery without indication' },
  { code: 'O21.0', desc: 'Mild hyperemesis gravidarum' },
  { code: 'O13', desc: 'Gestational hypertension' },
  { code: 'O14.1', desc: 'Severe pre-eclampsia' },
  { code: 'S06.0', desc: 'Concussion' },
  { code: 'S52.5', desc: 'Fracture of lower end of radius' },
  { code: 'T78.4', desc: 'Allergy, unspecified' },
  { code: 'J44.1', desc: 'COPD with acute exacerbation' },
  { code: 'I50.9', desc: 'Heart failure, unspecified' },
  { code: 'I21.9', desc: 'Acute myocardial infarction, unspecified' },
  { code: 'N18.9', desc: 'Chronic kidney disease, unspecified' },
  { code: 'J96.0', desc: 'Acute respiratory failure' },
  { code: 'A01.0', desc: 'Typhoid fever' },
]

const DiagnosisPicker = ({ onSelect, selectedDiagnoses = [], encounterId }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [diagType, setDiagType] = useState('primary')
  const [severity, setSeverity] = useState('moderate')
  const [certainty, setCertainty] = useState('confirmed')
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (value) => {
    setQuery(value)
    if (value.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    const lower = value.toLowerCase()
    const matches = ICD10_COMMON.filter(item =>
      item.code.toLowerCase().includes(lower) || item.desc.toLowerCase().includes(lower)
    ).slice(0, 10)
    setResults(matches)
    setShowDropdown(matches.length > 0)
  }

  const handleSelect = (item) => {
    onSelect?.({
      icd10_code: item.code,
      icd10_description: item.desc,
      diagnosis_type: diagType,
      severity,
      certainty,
      encounter_id: encounterId,
    })
    setQuery('')
    setResults([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const hasPrimary = selectedDiagnoses.some(d => d.diagnosis_type === 'primary')

  return (
    <div className="space-y-3">
      {/* Type/Severity/Certainty row */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
          <select
            value={diagType}
            onChange={(e) => setDiagType(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="primary" disabled={hasPrimary}>Primary</option>
            <option value="secondary">Secondary</option>
            <option value="comorbidity">Comorbidity</option>
            <option value="complication">Complication</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Certainty</label>
          <select
            value={certainty}
            onChange={(e) => setCertainty(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="confirmed">Confirmed</option>
            <option value="provisional">Provisional</option>
            <option value="differential">Differential</option>
            <option value="ruled_out">Ruled Out</option>
          </select>
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="Search ICD-10 code or description..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {showDropdown && (
          <div ref={dropdownRef} className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((item, idx) => {
              const alreadySelected = selectedDiagnoses.some(d => d.icd10_code === item.code)
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={alreadySelected}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50 last:border-0 flex items-center justify-between ${alreadySelected ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div>
                    <span className="font-mono font-medium text-blue-700">{item.code}</span>
                    <span className="ml-2 text-slate-600">{item.desc}</span>
                  </div>
                  {alreadySelected && <span className="text-xs text-slate-400">Added</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected diagnoses */}
      {selectedDiagnoses.length > 0 && (
        <div className="space-y-2">
          {selectedDiagnoses.map((diag, idx) => (
            <div key={diag.id || idx} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  diag.diagnosis_type === 'primary' ? 'bg-blue-100 text-blue-700' :
                  diag.diagnosis_type === 'secondary' ? 'bg-slate-200 text-slate-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {diag.diagnosis_type}
                </span>
                <span className="font-mono text-blue-700">{diag.icd10_code}</span>
                <span className="text-slate-600">{diag.icd10_description}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`px-1.5 py-0.5 rounded ${
                  diag.severity === 'severe' ? 'bg-red-100 text-red-700' :
                  diag.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>{diag.severity}</span>
                <span>{diag.certainty}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DiagnosisPicker
