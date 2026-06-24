import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { saveClinicalNote } from '../services/encounterService'

const TABS = ['subjective', 'objective', 'assessment', 'plan']
const TAB_LABELS = { subjective: 'Subjective', objective: 'Objective', assessment: 'Assessment', plan: 'Plan' }
const TAB_HINTS = {
  subjective: 'Chief complaint, HPI, ROS, past medical/surgical/family/social history...',
  objective: 'Physical exam findings, vitals summary, inspection, palpation, auscultation...',
  assessment: 'Clinical impression, differential diagnoses, diagnosis reasoning...',
  plan: 'Medications, labs, imaging, referrals, follow-up, patient education...',
}

const SOAPNotesEditor = ({ encounterId, authorId, existingNote, onSaved }) => {
  const [activeTab, setActiveTab] = useState('subjective')
  const [note, setNote] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  })
  const [noteId, setNoteId] = useState(existingNote?.id || null)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const autoSaveTimer = useRef(null)

  // Load existing note
  useEffect(() => {
    if (existingNote) {
      setNote({
        subjective: existingNote.subjective || '',
        objective: existingNote.objective || '',
        assessment: existingNote.assessment || '',
        plan: existingNote.plan || '',
      })
      setNoteId(existingNote.id)
    }
  }, [existingNote])

  // Auto-save every 30 seconds when content changes
  useEffect(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    const hasContent = Object.values(note).some(v => v.trim())
    if (!hasContent) return

    autoSaveTimer.current = setTimeout(() => {
      handleSave(true)
    }, 30000)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [note])

  const handleSave = async (isAutoSave = false) => {
    const hasContent = Object.values(note).some(v => v.trim())
    if (!hasContent) return

    setSaving(true)
    try {
      const payload = {
        encounter_id: encounterId,
        author_id: authorId,
        note_type: 'soap',
        subjective: note.subjective || null,
        objective: note.objective || null,
        assessment: note.assessment || null,
        plan: note.plan || null,
      }
      if (noteId) payload.id = noteId

      const { data, error } = await saveClinicalNote(payload)
      if (error) throw error
      setNoteId(data.id)
      setLastSaved(new Date())
      if (!isAutoSave) {
        toast.success('Clinical note saved')
        onSaved?.(data)
      }
    } catch (error) {
      console.error('Error saving note:', error)
      if (!isAutoSave) toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const wordCount = Object.values(note).join(' ').split(/\s+/).filter(Boolean).length

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* SOAP Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        {TABS.map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-blue-700 bg-white'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5">
              <span className={`w-5 h-5 rounded text-xs flex items-center justify-center font-bold ${
                activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'
              }`}>
                {tab[0].toUpperCase()}
              </span>
              {TAB_LABELS[tab]}
              {note[tab].trim() && (
                <span className="w-2 h-2 rounded-full bg-green-500" />
              )}
            </span>
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div className="p-4">
        <textarea
          value={note[activeTab]}
          onChange={(e) => setNote(prev => ({ ...prev, [activeTab]: e.target.value }))}
          rows={8}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          placeholder={TAB_HINTS[activeTab]}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{wordCount} words</span>
          {lastSaved && (
            <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
          )}
          {saving && <span className="text-blue-600">Saving...</span>}
        </div>
        <button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}

export default SOAPNotesEditor
