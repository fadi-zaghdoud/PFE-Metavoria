import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ActivateAccountPage } from './pages/ActivateAccountPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { TicketsListPage } from './pages/TicketsListPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RequireRole } from './routes/RequireRole';

function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route path="/mot-de-passe-oublie" element={<ForgotPasswordPage />} />
      {/* Ancien flux par lien : les vieux e-mails redirigent vers le flux OTP. */}
      <Route path="/reinitialiser-mot-de-passe" element={<Navigate to="/mot-de-passe-oublie" replace />} />
      {/* Activation d'un compte invité par un administrateur */}
      <Route path="/activer-compte" element={<ActivateAccountPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/tableau-de-bord" element={<DashboardPage />} />
          <Route path="/tickets" element={<TicketsListPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/profil" element={<ProfilePage />} />

          <Route element={<RequireRole roles={['ADMINISTRATEUR']} />}>
            <Route path="/administration/utilisateurs" element={<UsersManagementPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
    </Routes>
  );
}

export default App;
