import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthProvider } from './hooks/useAuth'
import { OrgProvider } from './hooks/useOrg'
import ProtectedRoute from './components/ProtectedRoute'
import AppErrorBoundary from './components/AppErrorBoundary'
import OfflineIndicator from './components/OfflineIndicator'

// Route-level code splitting — each page loads only when first visited
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'))
const NurseDashboard = lazy(() => import('./pages/NurseDashboard'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const Patients = lazy(() => import('./pages/Patients'))
const PatientRegistration = lazy(() => import('./pages/PatientRegistration'))
const Prescriptions = lazy(() => import('./pages/Prescriptions'))
const Cashier = lazy(() => import('./pages/Cashier'))
const Pharmacy = lazy(() => import('./pages/Pharmacy'))
const DrugManagement = lazy(() => import('./pages/DrugManagement'))
const Billing = lazy(() => import('./pages/Billing'))
const Claims = lazy(() => import('./pages/Claims'))
const Laboratory = lazy(() => import('./pages/Laboratory'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Referrals = lazy(() => import('./pages/Referrals'))
const Reports = lazy(() => import('./pages/Reports'))
const RecordsDashboard = lazy(() => import('./pages/RecordsDashboard'))
const HospitalOnboarding = lazy(() => import('./pages/HospitalOnboarding'))
const HospitalProfile = lazy(() => import('./pages/HospitalProfile'))
const QueueManagement = lazy(() => import('./pages/QueueManagement'))
const Telemedicine = lazy(() => import('./pages/Telemedicine'))
const BedManagement = lazy(() => import('./pages/BedManagement'))
const InventoryManagement = lazy(() => import('./pages/InventoryManagement'))
const EmergencyTriage = lazy(() => import('./pages/EmergencyTriage'))
const BloodBank = lazy(() => import('./pages/BloodBank'))
const PatientDetail = lazy(() => import('./pages/PatientDetail'))
const ServicesCatalog = lazy(() => import('./pages/ServicesCatalog'))
const EncounterView = lazy(() => import('./pages/EncounterView'))
const NursingCare = lazy(() => import('./pages/NursingCare'))
const WardRounds = lazy(() => import('./pages/WardRounds'))
const DHIMS2Reports = lazy(() => import('./pages/DHIMS2Reports'))
const SampleTracking = lazy(() => import('./pages/SampleTracking'))
const Landing = lazy(() => import('./pages/Landing'))
const Settings = lazy(() => import('./pages/Settings'))
const Radiology = lazy(() => import('./pages/Radiology'))
const Discharge = lazy(() => import('./pages/Discharge'))
const Procurement = lazy(() => import('./pages/Procurement'))
const Theatre = lazy(() => import('./pages/Theatre'))
const Maternity = lazy(() => import('./pages/Maternity'))
const Dietary = lazy(() => import('./pages/Dietary'))
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'))
const HRPayroll = lazy(() => import('./pages/HRPayroll'))
const Ambulance = lazy(() => import('./pages/Ambulance'))
const PatientPortal = lazy(() => import('./pages/PatientPortal'))

/**
 * CareLink HMS - Main Application Component
 * Connecting Care, Simplifying Healthcare
 * 
 * Author: David Gabion Selorm
 * Email: gabiondavidselorm@gmail.com
 */

function App() {
  return (
    <AuthProvider>
      <OrgProvider>
      <AppErrorBoundary>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="App">
            <Suspense fallback={
              <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">Loading...</p>
                </div>
              </div>
            }>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor-dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nurse-dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'nurse']}>
                  <NurseDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients"
              element={
                <ProtectedRoute>
                  <Patients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients/register"
              element={
                <ProtectedRoute>
                  <PatientRegistration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients/:id"
              element={
                <ProtectedRoute>
                  <PatientDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prescriptions"
              element={
                <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                  <Prescriptions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cashier"
              element={
                <ProtectedRoute allowedRoles={['admin', 'cashier']}>
                  <Cashier />
                </ProtectedRoute>
              }
            />
              <Route
                path="/pharmacy"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pharmacist']}>
                    <Pharmacy />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/drugs"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pharmacist']}>
                    <DrugManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/billing"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Billing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/claims"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Claims />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/laboratory"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'lab_tech']}>
                    <Laboratory />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/appointments"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                    <Appointments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/referrals"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                    <Referrals />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <UserManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/records"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'records_officer']}>
                    <RecordsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hospital-profile"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <HospitalProfile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hospital-onboarding"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <HospitalOnboarding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/queue-management"
                element={
                  <ProtectedRoute>
                    <QueueManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/telemedicine"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                    <Telemedicine />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bed-management"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'nurse']}>
                    <BedManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <InventoryManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/triage"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor']}>
                    <EmergencyTriage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/blood-bank"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                    <BloodBank />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/services-catalog"
                element={
                  <ProtectedRoute>
                    <ServicesCatalog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/encounter/:encounterId"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                    <EncounterView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/nursing-care"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'nurse']}>
                    <NursingCare />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ward-rounds"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                    <WardRounds />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dhims2-reports"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <DHIMS2Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sample-tracking"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'lab_tech', 'doctor', 'nurse']}>
                    <SampleTracking />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/radiology"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'lab_tech', 'nurse']}>
                    <Radiology />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/discharge"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                    <Discharge />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/procurement"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'pharmacist']}>
                    <Procurement />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/theatre"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                    <Theatre />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/maternity"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                    <Maternity />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dietary"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor']}>
                    <Dietary />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <NotificationSettings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/hr-payroll"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <HRPayroll />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ambulance"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'nurse', 'doctor']}>
                    <Ambulance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/patient-portal"
                element={
                  <ProtectedRoute>
                    <PatientPortal />
                  </ProtectedRoute>
                }
              />

              {/* 404 - Not Found */}
              <Route
                path="*"
                element={
                  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-10 text-center">
                      <div className="text-7xl mb-4">🏥</div>
                      <h1 className="text-5xl font-bold text-slate-800 mb-2">404</h1>
                      <h2 className="text-xl font-semibold text-slate-700 mb-3">Page Not Found</h2>
                      <p className="text-slate-500 text-sm mb-8">
                        The page you're looking for doesn't exist or has been moved.
                      </p>
                      <a
                        href="/dashboard"
                        className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm"
                      >
                        Back to Dashboard
                      </a>
                    </div>
                  </div>
                }
              />
            </Routes>
            </Suspense>

            {/* Toast Notifications */}
            <ToastContainer
              position="top-right"
              autoClose={3000}
              hideProgressBar={false}
              newestOnTop
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
            <OfflineIndicator />
          </div>
        </Router>
      </AppErrorBoundary>
      </OrgProvider>
    </AuthProvider>
  )
}

export default App
