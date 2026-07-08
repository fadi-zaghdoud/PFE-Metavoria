import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './routes/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/tableau-de-bord" element={<DashboardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
    </Routes>
  );
}

export default App;
