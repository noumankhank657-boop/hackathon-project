import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnly, RoleGuard, SetupOnly } from "./auth/RouteGuards";
import { AppLayout } from "./components/AppLayout";
import { ChangePasswordPage, LoginPage, SetupPage } from "./pages/AuthPages";
import { CsvImportPage } from "./pages/CsvImportPage";
import { EmployeeDirectoryPage } from "./pages/EmployeeDirectoryPage";
import { EmployeeFormPage } from "./pages/EmployeeFormPage";
import { EmployeeProfilePage } from "./pages/EmployeeProfilePage";
import { HomePage } from "./pages/HomePage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { UsersPage } from "./pages/UsersPage";

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupOnly><SetupPage /></SetupOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/change-password" element={<ProtectedRoute allowMustChange><ChangePasswordPage /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
        <Route path="organization" element={<RoleGuard roles={["ADMIN", "HR"]}><OrganizationPage /></RoleGuard>} />
        <Route path="users" element={<RoleGuard roles={["ADMIN"]}><UsersPage /></RoleGuard>} />
        <Route path="employees" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeDirectoryPage /></RoleGuard>} />
        <Route path="employees/new" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeFormPage /></RoleGuard>} />
        <Route path="employees/import" element={<RoleGuard roles={["ADMIN", "HR"]}><CsvImportPage /></RoleGuard>} />
        <Route path="employees/:id/edit" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeFormPage /></RoleGuard>} />
        <Route path="employees/:id" element={<RoleGuard roles={["ADMIN", "HR"]}><EmployeeProfilePage /></RoleGuard>} />
        <Route path="profile" element={<RoleGuard roles={["EMPLOYEE"]}><EmployeeProfilePage self /></RoleGuard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
