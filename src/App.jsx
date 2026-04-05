import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AppErrorBoundary from './components/AppErrorBoundary'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DoctorDashboard from './pages/DoctorDashboard'
import NurseDashboard from './pages/NurseDashboard'
import UserManagement from './pages/UserManagement'
import Patients from './pages/Patients'
import PatientRegistration from './pages/PatientRegistration'
import Prescriptions from './pages/Prescriptions'
import Cashier from './pages/Cashier'
import Pharmacy from './pages/Pharmacy'
import DrugManagement from './pages/DrugManagement'
import Billing from './pages/Billing'
import Claims from './pages/Claims'
import Laboratory from './pages/Laboratory'
import Appointments from './pages/Appointments'
import Referrals from './pages/Referrals'
import Reports from './pages/Reports'
import RecordsDashboard from './pages/RecordsDashboard'
import HospitalOnboarding from './pages/HospitalOnboarding'
import HospitalProfile from './pages/HospitalProfile'
import QueueManagement from './pages/QueueManagement'
import Telemedicine from './pages/Telemedicine'
import BedManagement from './pages/BedManagement'
import InventoryManagement from './pages/InventoryManagement'
import EmergencyTriage from './pages/EmergencyTriage'
import BloodBank from './pages/BloodBank'
import PatientDetail from './pages/PatientDetail'
import ServicesCatalog from './pages/ServicesCatalog'

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
      <AppErrorBoundary>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <div className="App">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
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
          </div>
        </Router>
      </AppErrorBoundary>
    </AuthProvider>
  )
}

export default App
