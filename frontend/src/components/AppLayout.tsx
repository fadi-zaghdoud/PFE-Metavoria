import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const LABELS_ROLE: Record<string, string> = {
  EMPLOYE: 'Employé',
  TECHNICIEN: 'Technicien',
  ADMINISTRATEUR: 'Administrateur',
};

export function AppLayout() {
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const deconnecter = useAuthStore((state) => state.deconnecter);
  const navigate = useNavigate();

  function handleDeconnexion() {
    deconnecter();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="text-lg font-semibold text-slate-900">Smart Ticketing & Support Assistant</div>
        {utilisateur && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {utilisateur.prenom} {utilisateur.nom} ·{' '}
              <span className="font-medium text-slate-900">{LABELS_ROLE[utilisateur.role]}</span>
            </span>
            <button
              onClick={handleDeconnexion}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Déconnexion
            </button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
