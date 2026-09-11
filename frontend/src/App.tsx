import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ActivateAccountPage } from './pages/ActivateAccountPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { CategoriesManagementPage } from './pages/CategoriesManagementPage';
import { FlywheelPage } from './pages/FlywheelPage';
import { AbsencesPage } from './pages/AbsencesPage';
import { ParametresPage } from './pages/ParametresPage';
import { JournalAuditPage } from './pages/JournalAuditPage';
import { TicketsListPage } from './pages/TicketsListPage';
import { CreateTicketPage } from './pages/CreateTicketPage';
import { TicketDetailPage } from './pages/TicketDetailPage';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RequireRole } from './routes/RequireRole';
import { Logo } from './components/layout/Logo';
import { useAuthStore } from './store/authStore';
import { rafraichirAccessToken } from './lib/apiClient';

// Écran d'attente pendant la restauration de session (rafraîchissement silencieux).
function SplashScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <div className="animate-fade-in flex flex-col items-center gap-4">
        <Logo />
        <Loader2 className="size-5 animate-spin text-primary-500" aria-label="Chargement…" />
      </div>
    </div>
  );
}

function App() {
  const estAuthentifie = useAuthStore((s) => s.estAuthentifie);
  const token = useAuthStore((s) => s.token);
  const deconnecter = useAuthStore((s) => s.deconnecter);

  // Restauration de session au chargement : si l'on était authentifié mais que
  // l'access token (non persisté) est absent, on tente un rafraîchissement
  // silencieux via le cookie refresh httpOnly. Sinon, on rend l'app directement.
  const [pret, setPret] = useState(() => !(estAuthentifie && !token));

  useEffect(() => {
    if (estAuthentifie && !token) {
      rafraichirAccessToken()
        .then((nouveau) => {
          if (!nouveau) deconnecter();
        })
        .finally(() => setPret(true));
    }
    // Au montage uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!pret) return <SplashScreen />;

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
          <Route path="/tickets/nouveau" element={<CreateTicketPage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/profil" element={<ProfilePage />} />

          <Route element={<RequireRole roles={['ADMINISTRATEUR']} />}>
            <Route path="/administration/utilisateurs" element={<UsersManagementPage />} />
            <Route path="/administration/categories" element={<CategoriesManagementPage />} />
            <Route path="/administration/ia" element={<FlywheelPage />} />
            <Route path="/administration/absences" element={<AbsencesPage />} />
            <Route path="/administration/parametres" element={<ParametresPage />} />
            <Route path="/administration/journal" element={<JournalAuditPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/tableau-de-bord" replace />} />
    </Routes>
  );
}

export default App;
