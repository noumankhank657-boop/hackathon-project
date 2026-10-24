import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnly, RoleGuard, SetupOnly } from "./auth/RouteGuards";
import { AppLayout } from "./components/AppLayout";
import { ChangePasswordPage, LoginPage, SetupPage } from "./pages/AuthPages";
import { AttendanceBoardPage, AttendancePage } from "./pages/AttendancePage";
import { AttendanceCorrectionsPage } from "./pages/AttendanceCorrectionsPage";
import { LoadingScreen } from "./components/Feedback";
import { CsvImportPage } from "./pages/CsvImportPage";
import { EmployeeDirectoryPage } from "./pages/EmployeeDirectoryPage";
import { EmployeeFormPage } from "./pages/EmployeeFormPage";
import { EmployeeProfilePage } from "./pages/EmployeeProfilePage";
import { AuditPage } from "./pages/AuditPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { LeavePage } from "./pages/LeavePage";
import { PayrollPage } from "./pages/PayrollPage";
import { UsersPage } from "./pages/UsersPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupOnly><SetupPage /></SetupOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/change-password" element={<ProtectedRoute allowMustChange><ChangePasswordPage /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Suspense fallback={<LoadingScreen label="Loading dashboard…" />}><DashboardPage /></Suspense>} />
        <Route path="organization" element={<RoleGuard roles={["ADMIN", "HR"]}><OrganizationPage /></RoleGuard>} />
        <Route path="users" element={<RoleGuard roles={["ADMIN"]}><UsersPage /></RoleGuard>} />
        <Route path="employees" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeDirectoryPage /></RoleGuard>} />
        <Route path="employees/new" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeFormPage /></RoleGuard>} />
        <Route path="employees/import" element={<RoleGuard roles={["ADMIN", "HR"]}><CsvImportPage /></RoleGuard>} />
        <Route path="employees/:id/edit" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeFormPage /></RoleGuard>} />
        <Route path="employees/:id" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeProfilePage /></RoleGuard>} />
        <Route path="profile" element={<RoleGuard roles={["EMPLOYEE"]}><EmployeeProfilePage self /></RoleGuard>} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/board" element={<RoleGuard roles={["ADMIN", "HR"]}><AttendanceBoardPage /></RoleGuard>} />
        <Route path="attendance/corrections" element={<RoleGuard roles={["ADMIN", "HR"]}><AttendanceCorrectionsPage /></RoleGuard>} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="communications" element={<CommunicationsPage />} />
        <Route path="audit" element={<RoleGuard roles={["ADMIN"]}><AuditPage /></RoleGuard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
