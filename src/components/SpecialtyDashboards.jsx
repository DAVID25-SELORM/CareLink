/**
 * Specialty-Specific Dashboard Components
 * Custom dashboard sections for each of the 36 medical specialties
 * Author: David Gabion Selorm
 */

// General Practitioner Dashboard
export const GeneralPractitionerDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-3">🩺 General Practice Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">📋 Common Conditions</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">💉 Vaccinations</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🔍 Health Screening</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">📊 Vital Signs Log</button>
      </div>
    </div>
  </div>
)

// Cardiologist Dashboard
export const CardiologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 className="font-semibold text-red-900 mb-3">❤️ Cardiology Tools</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">📈 ECG Results</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">💓 Heart Rate Monitor</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🩺 BP Tracking</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">💊 Cardiac Meds</button>
      </div>
      <div className="mt-4 p-3 bg-white rounded border">
        <p className="text-sm text-gray-700"><strong>High-Risk Patients:</strong> 0 requiring immediate attention</p>
      </div>
    </div>
  </div>
)

// Pediatrician Dashboard
export const PediatricianDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
      <h3 className="font-semibold text-pink-900 mb-3">👶 Pediatric Care</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">📏 Growth Charts</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">💉 Immunization Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">🍼 Feeding Guidelines</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">🌡️ Pediatric Fever Protocol</button>
      </div>
    </div>
  </div>
)

// Gynecologist Dashboard
export const GynecologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <h3 className="font-semibold text-purple-900 mb-3">👩‍⚕️ Gynecology Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">🤰 Prenatal Care</button>
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">🔬 Pap Smear Results</button>
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">📅 Contraception Counseling</button>
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">🩺 Menstrual Disorders</button>
      </div>
    </div>
  </div>
)

// Dermatologist Dashboard
export const DermatologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <h3 className="font-semibold text-orange-900 mb-3">🧴 Dermatology Tools</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">📸 Skin Lesion Photos</button>
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">🔬 Biopsy Results</button>
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">💊 Topical Treatments</button>
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">☀️ UV Protection Guidelines</button>
      </div>
    </div>
  </div>
)

// Orthopedic Surgeon Dashboard
export const OrthopedicSurgeonDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3">🦴 Orthopedic Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-gray-50 text-sm">🏥 Surgery Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-gray-50 text-sm">🦿 Joint Replacement</button>
        <button className="bg-white p-3 rounded border hover:bg-gray-50 text-sm">📸 X-Ray Viewer</button>
        <button className="bg-white p-3 rounded border hover:bg-gray-50 text-sm">🩹 Post-Op Follow-ups</button>
      </div>
    </div>
  </div>
)

// Psychiatrist Dashboard
export const PsychiatristDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
      <h3 className="font-semibold text-indigo-900 mb-3">🧠 Mental Health Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">📋 Mental Status Exam</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">💊 Psychiatric Meds</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">🗣️ Therapy Sessions</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">📊 Mood Tracking</button>
      </div>
      <div className="mt-4 p-3 bg-white rounded border">
        <p className="text-sm text-gray-700"><strong>Crisis Alerts:</strong> 0 patients requiring urgent intervention</p>
      </div>
    </div>
  </div>
)

// Ophthalmologist Dashboard
export const OphthalmologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
      <h3 className="font-semibold text-cyan-900 mb-3">👁️ Eye Care Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">👓 Vision Tests</button>
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">🔬 Retinal Imaging</button>
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">💧 Glaucoma Screening</button>
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">🏥 Cataract Surgery</button>
      </div>
    </div>
  </div>
)

// ENT Specialist Dashboard
export const ENTSpecialistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
      <h3 className="font-semibold text-teal-900 mb-3">👂 ENT Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">👂 Hearing Tests</button>
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">👃 Sinus Imaging</button>
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">🗣️ Voice Disorders</button>
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">🏥 Tonsillectomy Schedule</button>
      </div>
    </div>
  </div>
)

// Neurologist Dashboard
export const NeurologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
      <h3 className="font-semibold text-violet-900 mb-3">🧠 Neurology Tools</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-violet-50 text-sm">🧠 MRI/CT Scans</button>
        <button className="bg-white p-3 rounded border hover:bg-violet-50 text-sm">⚡ EEG Results</button>
        <button className="bg-white p-3 rounded border hover:bg-violet-50 text-sm">💊 Seizure Management</button>
        <button className="bg-white p-3 rounded border hover:bg-violet-50 text-sm">🩺 Stroke Protocol</button>
      </div>
    </div>
  </div>
)

// Oncologist Dashboard
export const OncologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-pink-50 border border-pink-300 rounded-lg p-4">
      <h3 className="font-semibold text-pink-900 mb-3">🎗️ Oncology Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">💉 Chemotherapy Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">🔬 Tumor Markers</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">📊 Treatment Response</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">🩺 Survivorship Care</button>
      </div>
    </div>
  </div>
)

// Radiologist Dashboard
export const RadiologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
      <h3 className="font-semibold text-slate-900 mb-3">📷 Radiology Workstation</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-slate-50 text-sm">📸 X-Ray Queue</button>
        <button className="bg-white p-3 rounded border hover:bg-slate-50 text-sm">🧠 CT/MRI Viewer</button>
        <button className="bg-white p-3 rounded border hover:bg-slate-50 text-sm">📋 Reports Pending</button>
        <button className="bg-white p-3 rounded border hover:bg-slate-50 text-sm">⚠️ Critical Findings</button>
      </div>
    </div>
  </div>
)

// Anesthesiologist Dashboard
export const AnesthesiologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-3">💉 Anesthesia Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🏥 Surgery Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">📋 Pre-Op Assessment</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">💊 Anesthesia Plans</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🩺 Post-Op Monitoring</button>
      </div>
    </div>
  </div>
)

// Pathologist Dashboard
export const PathologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
      <h3 className="font-semibold text-emerald-900 mb-3">🔬 Pathology Lab</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">🧪 Specimen Queue</button>
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">📊 Biopsy Results</button>
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">🔬 Histology Reports</button>
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">⚠️ Abnormal Findings</button>
      </div>
    </div>
  </div>
)

// Urologist Dashboard
export const UrologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-3">🩺 Urology Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🔬 Urinalysis Results</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">📊 Kidney Function</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🏥 Procedure Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">💊 BPH Management</button>
      </div>
    </div>
  </div>
)

// Gastroenterologist Dashboard
export const GastroenterologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h3 className="font-semibold text-amber-900 mb-3">🫀 GI Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">🔬 Endoscopy Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">📋 Colonoscopy Results</button>
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">💊 IBD Management</button>
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">🧪 Liver Function Tests</button>
      </div>
    </div>
  </div>
)

// Endocrinologist Dashboard
export const EndocrinologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <h3 className="font-semibold text-green-900 mb-3">⚕️ Endocrinology Tools</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">📊 Diabetes Management</button>
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">🦴 Thyroid Function</button>
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">💉 Insulin Therapy</button>
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">📈 Hormone Levels</button>
      </div>
    </div>
  </div>
)

// Rheumatologist Dashboard
export const RheumatologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
      <h3 className="font-semibold text-rose-900 mb-3">🦴 Rheumatology Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">🔬 Autoimmune Tests</button>
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">💊 Arthritis Management</button>
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">📊 Joint Assessment</button>
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">💉 Biologics Therapy</button>
      </div>
    </div>
  </div>
)

// Pulmonologist Dashboard
export const PulmonologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
      <h3 className="font-semibold text-sky-900 mb-3">🫁 Pulmonology Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-sky-50 text-sm">🌬️ Pulmonary Function</button>
        <button className="bg-white p-3 rounded border hover:bg-sky-50 text-sm">📸 Chest X-Rays</button>
        <button className="bg-white p-3 rounded border hover:bg-sky-50 text-sm">💨 Asthma Control</button>
        <button className="bg-white p-3 rounded border hover:bg-sky-50 text-sm">😷 COPD Management</button>
      </div>
    </div>
  </div>
)

// Nephrologist Dashboard
export const NephrologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-cyan-50 border border-cyan-300 rounded-lg p-4">
      <h3 className="font-semibold text-cyan-900 mb-3">🩺 Nephrology Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">🔬 Kidney Function Tests</button>
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">💧 Dialysis Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">📊 GFR Tracking</button>
        <button className="bg-white p-3 rounded border hover:bg-cyan-50 text-sm">🩺 Transplant Follow-up</button>
      </div>
    </div>
  </div>
)

// Dietician/Nutritionist Dashboard
export const DieticianDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-lime-50 border border-lime-200 rounded-lg p-4">
      <h3 className="font-semibold text-lime-900 mb-3">🥗 Nutrition Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-lime-50 text-sm">🍽️ Meal Plans</button>
        <button className="bg-white p-3 rounded border hover:bg-lime-50 text-sm">📊 Nutrition Calculator</button>
        <button className="bg-white p-3 rounded border hover:bg-lime-50 text-sm">⚖️ Weight Management</button>
        <button className="bg-white p-3 rounded border hover:bg-lime-50 text-sm">🥑 Diet Tracking</button>
      </div>
      <div className="mt-4 p-3 bg-white rounded border">
        <p className="text-sm text-gray-700"><strong>Active Programs:</strong> Weight loss, Diabetes diet, Sports nutrition</p>
      </div>
    </div>
  </div>
)

// Optometrist Dashboard
export const OptometristDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
      <h3 className="font-semibold text-indigo-900 mb-3">👓 Vision Care</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">👁️ Vision Tests</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">👓 Eyeglass Prescriptions</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">📏 Contact Lens Fitting</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">🔍 Eye Exams</button>
      </div>
    </div>
  </div>
)

// Physiotherapist Dashboard
export const PhysiotherapistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
      <h3 className="font-semibold text-orange-900 mb-3">🏃 Physical Therapy</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">💪 Exercise Protocols</button>
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">📊 Mobility Assessment</button>
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">🏋️ Strength Training</button>
        <button className="bg-white p-3 rounded border hover:bg-orange-50 text-sm">🩹 Injury Rehabilitation</button>
      </div>
    </div>
  </div>
)

// Dentist Dashboard
export const DentistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-teal-50 border border-teal-300 rounded-lg p-4">
      <h3 className="font-semibold text-teal-900 mb-3">🦷 Dental Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">🦷 Dental Chart</button>
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">📸 X-Ray Viewer</button>
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">🪥 Cleaning Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-teal-50 text-sm">🦴 Root Canal Tracker</button>
      </div>
      <div className="mt-4 p-3 bg-white rounded border">
        <p className="text-sm text-gray-700"><strong>Today's Procedures:</strong> Fillings, Extractions, Cleanings</p>
      </div>
    </div>
  </div>
)

// General Surgeon Dashboard
export const GeneralSurgeonDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-red-50 border border-red-300 rounded-lg p-4">
      <h3 className="font-semibold text-red-900 mb-3">🔪 Surgical Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🏥 OR Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">📋 Pre-Op Clearance</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🔪 Procedure Log</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🩹 Post-Op Follow-ups</button>
      </div>
    </div>
  </div>
)

// Neurosurgeon Dashboard
export const NeurosurgeonDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-purple-50 border border-purple-300 rounded-lg p-4">
      <h3 className="font-semibold text-purple-900 mb-3">🧠 Neurosurgery</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">🧠 MRI/CT Review</button>
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">🏥 Surgery Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">📊 Neurological Assessment</button>
        <button className="bg-white p-3 rounded border hover:bg-purple-50 text-sm">🔬 Spinal Procedures</button>
      </div>
    </div>
  </div>
)

// Plastic Surgeon Dashboard
export const PlasticSurgeonDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
      <h3 className="font-semibold text-pink-900 mb-3">✨ Plastic Surgery</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">📸 Before/After Photos</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">🏥 Procedure Consultations</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">🎨 Reconstructive Cases</button>
        <button className="bg-white p-3 rounded border hover:bg-pink-50 text-sm">💉 Injectables Schedule</button>
      </div>
    </div>
  </div>
)

// Obstetrician Dashboard
export const ObstetricianDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-rose-50 border border-rose-300 rounded-lg p-4">
      <h3 className="font-semibold text-rose-900 mb-3">🤰 Obstetrics</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">👶 Prenatal Visits</button>
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">📊 Ultrasound Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">🏥 Delivery Schedule</button>
        <button className="bg-white p-3 rounded border hover:bg-rose-50 text-sm">🩺 High-Risk Pregnancies</button>
      </div>
    </div>
  </div>
)

// Speech Therapist Dashboard
export const SpeechTherapistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <h3 className="font-semibold text-yellow-900 mb-3">🗣️ Speech Therapy</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-yellow-50 text-sm">🗨️ Speech Assessment</button>
        <button className="bg-white p-3 rounded border hover:bg-yellow-50 text-sm">📊 Progress Tracking</button>
        <button className="bg-white p-3 rounded border hover:bg-yellow-50 text-sm">🎯 Therapy Exercises</button>
        <button className="bg-white p-3 rounded border hover:bg-yellow-50 text-sm">👶 Pediatric Cases</button>
      </div>
    </div>
  </div>
)

// Occupational Therapist Dashboard
export const OccupationalTherapistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4">
      <h3 className="font-semibold text-emerald-900 mb-3">🧩 Occupational Therapy</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">🎯 Daily Living Skills</button>
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">🧠 Cognitive Assessment</button>
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">🏠 Home Modifications</button>
        <button className="bg-white p-3 rounded border hover:bg-emerald-50 text-sm">📊 Function Improvement</button>
      </div>
    </div>
  </div>
)

// Clinical Psychologist Dashboard
export const ClinicalPsychologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-4">
      <h3 className="font-semibold text-indigo-900 mb-3">💭 Clinical Psychology</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">🧠 Psychological Testing</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">🗣️ Therapy Sessions</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">📊 Behavioral Analysis</button>
        <button className="bg-white p-3 rounded border hover:bg-indigo-50 text-sm">📋 Treatment Plans</button>
      </div>
    </div>
  </div>
)

// Hematologist Dashboard
export const HematologistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 className="font-semibold text-red-900 mb-3">🩸 Hematology Services</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🔬 Blood Tests</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">💉 Anemia Management</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🩸 Clotting Disorders</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">📊 CBC Analysis</button>
      </div>
    </div>
  </div>
)

// Allergist/Immunologist Dashboard
export const AllergistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
      <h3 className="font-semibold text-amber-900 mb-3">🤧 Allergy & Immunology</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">🧪 Allergy Testing</button>
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">💉 Immunotherapy</button>
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">🤧 Asthma Control</button>
        <button className="bg-white p-3 rounded border hover:bg-amber-50 text-sm">🍕 Food Allergies</button>
      </div>
    </div>
  </div>
)

// Infectious Disease Specialist Dashboard
export const InfectiousDiseaseSpecialistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-green-50 border border-green-300 rounded-lg p-4">
      <h3 className="font-semibold text-green-900 mb-3">🦠 Infectious Disease</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">🔬 Culture Results</button>
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">💊 Antibiotic Stewardship</button>
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">🦠 Outbreak Monitoring</button>
        <button className="bg-white p-3 rounded border hover:bg-green-50 text-sm">💉 Vaccination Records</button>
      </div>
    </div>
  </div>
)

// Geriatrician Dashboard
export const GeriatricianDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 className="font-semibold text-blue-900 mb-3">👴 Geriatric Care</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🧠 Cognitive Screening</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">💊 Polypharmacy Review</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🚶 Fall Risk Assessment</button>
        <button className="bg-white p-3 rounded border hover:bg-blue-50 text-sm">🏠 Long-term Care Planning</button>
      </div>
    </div>
  </div>
)

// Emergency Medicine Specialist Dashboard
export const EmergencyMedicineSpecialistDashboard = ({ stats, doctorInfo }) => (
  <div className="space-y-6">
    <div className="bg-red-50 border border-red-300 rounded-lg p-4">
      <h3 className="font-semibold text-red-900 mb-3">🚑 Emergency Department</h3>
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🚨 Triage Queue</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">⚠️ Critical Patients</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">🏥 Trauma Activations</button>
        <button className="bg-white p-3 rounded border hover:bg-red-50 text-sm">📊 ED Metrics</button>
      </div>
      <div className="mt-4 p-3 bg-white rounded border">
        <p className="text-sm text-gray-700"><strong>ED Status:</strong> 0 critical, 0 urgent, 0 non-urgent</p>
      </div>
    </div>
  </div>
)

// Component map for easy rendering
export const SpecialtyComponents = {
  'General Practitioner': GeneralPractitionerDashboard,
  'Cardiologist': CardiologistDashboard,
  'Pediatrician': PediatricianDashboard,
  'Gynecologist': GynecologistDashboard,
  'Dermatologist': DermatologistDashboard,
  'Orthopedic Surgeon': OrthopedicSurgeonDashboard,
  'Psychiatrist': PsychiatristDashboard,
  'Ophthalmologist': OphthalmologistDashboard,
  'ENT Specialist': ENTSpecialistDashboard,
  'Neurologist': NeurologistDashboard,
  'Oncologist': OncologistDashboard,
  'Radiologist': RadiologistDashboard,
  'Anesthesiologist': AnesthesiologistDashboard,
  'Pathologist': PathologistDashboard,
  'Urologist': UrologistDashboard,
  'Gastroenterologist': GastroenterologistDashboard,
  'Endocrinologist': EndocrinologistDashboard,
  'Rheumatologist': RheumatologistDashboard,
  'Pulmonologist': PulmonologistDashboard,
  'Nephrologist': NephrologistDashboard,
  'Dietician/Nutritionist': DieticianDashboard,
  'Optometrist': OptometristDashboard,
  'Physiotherapist': PhysiotherapistDashboard,
  'Dentist': DentistDashboard,
  'General Surgeon': GeneralSurgeonDashboard,
  'Neurosurgeon': NeurosurgeonDashboard,
  'Plastic Surgeon': PlasticSurgeonDashboard,
  'Obstetrician': ObstetricianDashboard,
  'Speech Therapist': SpeechTherapistDashboard,
  'Occupational Therapist': OccupationalTherapistDashboard,
  'Clinical Psychologist': ClinicalPsychologistDashboard,
  'Hematologist': HematologistDashboard,
  'Allergist/Immunologist': AllergistDashboard,
  'Infectious Disease Specialist': InfectiousDiseaseSpecialistDashboard,
  'Geriatrician': GeriatricianDashboard,
  'Emergency Medicine Specialist': EmergencyMedicineSpecialistDashboard
}
