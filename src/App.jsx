import { Routes, Route, Navigate } from "react-router-dom";
import RTBEsports from "./RTBEsports.jsx";
import AdminLogin from "./admin/AdminLogin.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import ProtectedRoute, { ADMIN_PATH, ADMIN_DASHBOARD_PATH } from "./admin/ProtectedRoute.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<RTBEsports />} />
      <Route path={ADMIN_PATH} element={<AdminLogin />} />
      <Route
        path={ADMIN_DASHBOARD_PATH}
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
