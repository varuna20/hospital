import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';

// Public
const HospitalLoginPage = React.lazy(() => import('./pages/HospitalLoginPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const BookingPage = React.lazy(() => import('./pages/patient/BookingPage'));
const QueueStatus = React.lazy(() => import('./pages/patient/QueueStatus'));
const PatientDashboard = React.lazy(() => import('./pages/patient/PatientDashboard'));
const DisplayScreen = React.lazy(() => import('./pages/display/DisplayScreen'));
const DoctorDisplay = React.lazy(() => import('./pages/display/DoctorDisplay'));
const KioskApp = React.lazy(() => import('./pages/display/KioskApp'));
const PrescriptionPrint = React.lazy(() => import('./pages/doctor/PrescriptionPrint'));

// Super Admin
const SuperLayout = React.lazy(() => import('./pages/superadmin/SuperLayout'));
const SuperDashboard = React.lazy(() => import('./pages/superadmin/SuperDashboard'));
const SuperHospitals = React.lazy(() => import('./pages/superadmin/SuperHospitals'));
const SuperRevenue = React.lazy(() => import('./pages/superadmin/SuperRevenue'));
const SuperSubscriptions = React.lazy(() => import('./pages/superadmin/SuperSubscriptions'));
const SuperHospitalLinks = React.lazy(() => import('./pages/superadmin/SuperHospitalLinks'));
const SuperSystem = React.lazy(() => import('./pages/superadmin/SuperSystem'));
const SuperLogs = React.lazy(() => import('./pages/superadmin/SuperLogs'));
const SuperPatients = React.lazy(() => import('./pages/superadmin/SuperPatients'));

// Admin
const AdminLayout = React.lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const AdminDoctors = React.lazy(() => import('./pages/admin/AdminDoctors'));
const AdminStaff = React.lazy(() => import('./pages/admin/AdminStaff'));
const AdminRevenue = React.lazy(() => import('./pages/admin/AdminRevenue'));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings'));
const AdminMedia = React.lazy(() => import('./pages/admin/AdminMedia'));
const DrugLibrary = React.lazy(() => import('./pages/admin/DrugLibrary'));

// Staff
const StaffLayout = React.lazy(() => import('./pages/staff/StaffLayout'));
const StaffDashboard = React.lazy(() => import('./pages/staff/StaffDashboard'));
const StaffQueue = React.lazy(() => import('./pages/staff/StaffQueue'));
const StaffBooking = React.lazy(() => import('./pages/staff/StaffBooking'));
const StaffRefund = React.lazy(() => import('./pages/staff/StaffRefund'));

// Doctor
const DoctorLayout = React.lazy(() => import('./pages/doctor/DoctorLayout'));
const DoctorDashboard = React.lazy(() => import('./pages/doctor/DoctorDashboard'));
const DoctorRevenue = React.lazy(() => import('./pages/doctor/DoctorRevenue'));
const DoctorPrescriptions = React.lazy(() => import('./pages/doctor/DoctorPrescriptions'));
const PrescriptionForm = React.lazy(() => import('./pages/doctor/PrescriptionForm'));
const DoctorCalendar = React.lazy(() => import('./pages/doctor/DoctorCalendar'));
const ProfilePage = React.lazy(() => import('./pages/shared/ProfilePage'));

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)' }} />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const map = { superadmin: '/super', admin: '/admin', staff: '/staff', doctor: '/doctor', patient: '/patient-dashboard' };
    return <Navigate to={map[user.role] || '/'} replace />;
  }
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SocketProvider>
          <BrowserRouter>
            <Toaster position="top-right" toastOptions={{
              style: { background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' },
              success: { iconTheme: { primary: 'var(--color-primary)', secondary: '#fff' } }
            }} />
            <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin border-primary"></div></div>}>
              <Routes>
              {/* Public */}
              <Route path="/"                         element={<BookingPage />} />
              <Route path="/book/:slug"               element={<BookingPage />} />
              <Route path="/login/:slug"              element={<HospitalLoginPage />} />
              <Route path="/login"                    element={<LoginPage />} />
              <Route path="/queue-status/:token"      element={<QueueStatus />} />
              <Route path="/display/:hospitalId"      element={<DisplayScreen />} />
              <Route path="/display/:hospitalId/:doctorId" element={<DoctorDisplay />} />
              <Route path="/kiosk/:hospitalId"        element={<KioskApp />} />
              <Route path="/prescription/print/:id"   element={<PrescriptionPrint />} />
              <Route path="/patient-dashboard"        element={<Protected roles={['patient']}><PatientDashboard /></Protected>} />

              {/* Super Admin */}
              <Route path="/super" element={<Protected roles={['superadmin']}><SuperLayout /></Protected>}>
                <Route index                 element={<SuperDashboard />} />
                <Route path="hospitals"      element={<SuperHospitals />} />
                <Route path="revenue"        element={<SuperRevenue />} />
                <Route path="subscriptions"  element={<SuperSubscriptions />} />
                <Route path="system"         element={<SuperSystem />} />
                <Route path="logs"           element={<SuperLogs />} />
                <Route path="patients"       element={<SuperPatients />} />
                <Route path="profile"        element={<ProfilePage />} />
              </Route>

              {/* Admin */}
              <Route path="/admin" element={<Protected roles={['admin']}><AdminLayout /></Protected>}>
                <Route index           element={<AdminDashboard />} />
                <Route path="doctors"  element={<AdminDoctors />} />
                <Route path="staff"    element={<AdminStaff />} />
                <Route path="revenue"  element={<AdminRevenue />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="media"    element={<AdminMedia />} />
                <Route path="drugs"    element={<DrugLibrary />} />
                <Route path="refund"   element={<StaffRefund />} />
                <Route path="profile"  element={<ProfilePage />} />
              </Route>

              {/* Staff */}
              <Route path="/staff" element={<Protected roles={['staff', 'admin']}><StaffLayout /></Protected>}>
                <Route index          element={<StaffDashboard />} />
                <Route path="queue"   element={<StaffQueue />} />
                <Route path="booking" element={<StaffBooking />} />
                <Route path="refund"  element={<StaffRefund />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* Doctor */}
              <Route path="/doctor" element={<Protected roles={['doctor']}><DoctorLayout /></Protected>}>
                <Route index                    element={<DoctorDashboard />} />
                <Route path="drugs"             element={<DrugLibrary />} />
                <Route path="revenue"           element={<DoctorRevenue />} />
                <Route path="prescriptions"     element={<DoctorPrescriptions />} />
                <Route path="prescriptions/new" element={<PrescriptionForm />} />
                <Route path="prescriptions/:id" element={<PrescriptionForm />} />
                <Route path="calendar"          element={<DoctorCalendar />} />
                <Route path="profile"           element={<ProfilePage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
              </Suspense>
          </BrowserRouter>
        </SocketProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
