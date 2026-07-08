import { useAuthStore } from '../store/authStore';
import type { Role } from '../types/auth';

const CONTENU_PAR_ROLE: Record<Role, { titre: string; description: string; sections: string[] }> = {
  EMPLOYE: {
    titre: 'Mes tickets',
    description: 'Suivez vos demandes de support et échangez avec les techniciens.',
    sections: ['Créer un ticket', 'Mes tickets en cours', 'Historique de mes tickets'],
  },
  TECHNICIEN: {
    titre: 'Tickets assignés',
    description: 'Consultez et traitez les tickets qui vous sont affectés.',
    sections: ['Tickets à traiter', 'Suggestions de l\'assistant IA', 'Tickets résolus'],
  },
  ADMINISTRATEUR: {
    titre: 'Vue d\'ensemble',
    description: 'Pilotez la plateforme, les utilisateurs et les indicateurs de performance.',
    sections: ['Tableau de bord & KPI', 'Gestion des utilisateurs', 'Gestion des catégories', 'Paramètres du module IA'],
  },
};

export function DashboardPage() {
  const utilisateur = useAuthStore((state) => state.utilisateur);

  if (!utilisateur) {
    return null;
  }

  const contenu = CONTENU_PAR_ROLE[utilisateur.role];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{contenu.titre}</h1>
      <p className="mt-1 text-slate-500">{contenu.description}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contenu.sections.map((section) => (
          <div
            key={section}
            className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400"
          >
            {section}
            <div className="mt-1 text-xs text-slate-300">À venir</div>
          </div>
        ))}
      </div>
    </div>
  );
}
