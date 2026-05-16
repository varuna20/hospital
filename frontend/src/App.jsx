import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';

// Public
import HospitalLoginPage from './pages/HospitalLoginPage';
import LoginPage          from './pages/LoginPage';
import BookingPage        from './pages/patient/BookingPage';
import QueueStatus        from './pages/patient/QueueStatus';
import PatientDashboard   from './pages/patient/PatientDashboard';
import DisplayScreen      from './pages/display/DisplayScreen';
import DoctorDisplay      from './pages/display/DoctorDisplay';
import KioskApp           from './pages/display/KioskApp';
import PrescriptionPrint  from './pages/doctor/PrescriptionPrint';

// Super Admin
import SuperLayout        from './pages/superadmin/SuperLayout';
import SuperDashboard     from './pages/superadmin/SuperDashboard';
import SuperHospitals     from './pages/superadmin/SuperHospitals';
import SuperRevenue       from './pages/superadmin/SuperRevenue';
import SuperSubscriptions from './pages/superadmin/SuperSubscriptions';
import SuperHospitalLinks from './pages/superadmin/SuperHospitalLinks';
import SuperSystem        from './pages/superadmin/SuperSystem';
import SuperLogs          from './pages/superadmin/SuperLogs';
import SuperPatients      from './pages/superadmin/SuperPatients';

// Admin
import AdminLayout        from './pages/admin/AdminLayout';
import AdminDashboard     from './pages/admin/AdminDashboard';
import AdminDoctors       from './pages/admin/AdminDoctors';
import AdminStaff         from './pages/admin/AdminStaff';
import AdminRevenue       from './pages/admin/AdminRevenue';
import AdminSettings      from './pages/admin/AdminSettings';
import AdminMedia         from './pages/admin/AdminMedia';
import DrugLibrary        from './pages/admin/DrugLibrary';

// Staff
import StaffLayout        from './pages/staff/StaffLayout';
import StaffDashboard     from './pages/staff/StaffDashboard';
import StaffQueue         from './pages/staff/StaffQueue';
import StaffBooking       from './pages/staff/StaffBooking';
import StaffRefund        from './pages/staff/StaffRefund';

// Doctor
import DoctorLayout       from './pages/doctor/DoctorLayout';
import DoctorDashboard    from './pages/doctor/DoctorDashboard';
import DoctorRevenue      from './pages/doctor/DoctorRevenue';
import DoctorPrescriptions from './pages/doctor/DoctorPrescriptions';
import PrescriptionForm   from './pages/doctor/PrescriptionForm';
import DoctorCalendar   from './pages/doctor/DoctorCalendar';
import ProfilePage      from './pages/shared/ProfilePage';

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
            <Routes>
              {/* Public */}
              <Route path="/"                         element={<BookingPage />} />
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
          </BrowserRouter>
        </SocketProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
