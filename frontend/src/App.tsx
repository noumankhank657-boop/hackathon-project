import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnly, SetupOnly } from "./auth/RouteGuards";
import { AppLayout } from "./components/AppLayout";
import { ChangePasswordPage, LoginPage, SetupPage } from "./pages/AuthPages";
import { HomePage } from "./pages/HomePage";

export default function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupOnly><SetupPage /></SetupOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/change-password" element={<ProtectedRoute allowMustChange><ChangePasswordPage /></ProtectedRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
