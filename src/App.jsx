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
                  <ProtectedRoute allowedRoles={['admin', 'doctor']}>
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
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
