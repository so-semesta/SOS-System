/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MainLayout } from './components/layout/MainLayout';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { UserRole } from './types/auth';
import { MyProfile } from './pages/student/MyProfile';
import { StudentsDirectory } from './pages/admin/StudentsDirectory';
import { Guidance } from './pages/student/Guidance';
import { GuidanceMonitor } from './pages/admin/GuidanceMonitor';
import { Toaster } from './components/ui/sonner';

import { Competitions } from './pages/student/Competitions';
import { CompetitionsAdmin } from './pages/admin/CompetitionsAdmin';
import { RegistrationApprovals } from './pages/admin/RegistrationApprovals';
import { Leaderboard } from './pages/student/Leaderboard';
import { OSN } from './pages/OSNCorner';
import { Classroom } from './pages/Classroom';
import { UsersManagement } from './pages/management/UsersManagement';

import { PublicHome } from './pages/PublicHome';
import { InternalHome } from './pages/InternalHome';

// Komponen helper agar Dashboard melakukan hal yang tepat berdasarkan role
const RootRedirect = () => {
  const { userRole } = useAuth();
  if (userRole === UserRole.STUDENT) return <Navigate to="/home" replace />;
  if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGEMENT) return <Navigate to="/home" replace />;
  return <Navigate to="/home" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<RootRedirect />} />
              <Route path="/home" element={<InternalHome />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              
              {/* STUDENT ROUTES */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.STUDENT]} />}>
                <Route path="/profile" element={<MyProfile />} />
                <Route path="/competitions" element={<Competitions />} />
                <Route path="/guidance" element={<Guidance />} />
                <Route path="/osn-corner" element={<OSN />} />
                <Route path="/classroom" element={<Classroom />} />
              </Route>

              {/* ADMIN & MANAGEMENT ROUTES */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.MANAGEMENT]} />}>
                <Route path="/analytics" element={<Dashboard />} />
                <Route path="/admin/students" element={<StudentsDirectory />} />
                <Route path="/admin/competitions" element={<CompetitionsAdmin />} />
                <Route path="/admin/registrations" element={<RegistrationApprovals />} />
                <Route path="/admin/guidance" element={<GuidanceMonitor />} />
                <Route path="/admin/osn" element={<OSN />} />
              </Route>

              {/* MANAGEMENT ONLY ROUTES */}
              <Route element={<ProtectedRoute allowedRoles={[UserRole.MANAGEMENT]} />}>
                <Route path="/management/users" element={<UsersManagement />} />
              </Route>
              
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}
