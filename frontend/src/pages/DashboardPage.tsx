import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  ShieldCheck,
  Ticket,
  UserCheck,
  UserCircle,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import type { Utilisateur } from '../types/auth';
import { dateLongue, LABELS_ROLE, tempsRelatif } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

// Cartes "modules à venir" — feuille de route du cahier des charges.
const MODULES_A_VENIR = [
  {
    icon: Ticket,
    titre: 'Gestion des tickets',
    texte: 'Création, affectation, suivi de statut et fil de discussion.',
    phase: 'Phase 3',
    lien: { to: '/tickets', label: "Voir l'aperçu" },
  },
  {
    icon: BrainCircuit,
    titre: 'Assistant IA',
    texte: 'Classification automatique, priorisation et suggestions de résolution.',
    phase: 'Phase 5',
  },
  {
    icon: ShieldCheck,
    titre: 'Statistiques & SLA',
    texte: 'Indicateurs de performance, temps de résolution, satisfaction.',
    phase: 'Phase 4',
  },
];

function StatsAdmin() {
  const token = useAuthStore((state) => state.token);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!token) return;
    utilisateursApi
      .lister({}, token)
      .then(({ utilisateurs: liste }) => setUtilisateurs(liste))
      .catch(() => setErreur(true));
  }, [token]);

  const stats = useMemo(() => {
    if (!utilisateurs) return null;
    return {
      total: utilisateurs.length,
      actifs: utilisateurs.filter((u) => u.actif).length,
      techniciens: utilisateurs.filter((u) => u.role === 'TECHNICIEN').length,
      admins: utilisateurs.filter((u) => u.role === 'ADMINISTRATEUR').length,
      recents: utilisateurs.slice(0, 5),
    };
  }, [utilisateurs]);

  if (erreur) return null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Utilisateurs" value={stats.total} icon={Users} tone="primary" />
            <StatCard label="Comptes actifs" value={stats.actifs} icon={UserCheck} tone="success" />
            <StatCard label="Techniciens" value={stats.techniciens} icon={Wrench} tone="warning" />
            <StatCard label="Administrateurs" value={stats.admins} icon={ShieldCheck} tone="neutral" />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-xl" />)
        )}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Derniers comptes créés"
          actions={
            <Link
              to="/administration/utilisateurs"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
            >
              Tout voir <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          }
        />
        <CardContent className="p-2">
          {stats ? (
            <ul className="divide-y divide-slate-100">
              {stats.recents.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar prenom={u.prenom} nom={u.nom} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {u.prenom} {u.nom}
                    </p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                  <Badge variant={u.role === 'ADMINISTRATEUR' ? 'primary' : 'neutral'}>
                    {LABELS_ROLE[u.role]}
                  </Badge>
                  <span className="hidden text-xs text-slate-400 sm:block">
                    {tempsRelatif(u.dateCreation)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function DashboardPage() {
  const utilisateur = useAuthStore((state) => state.utilisateur);

  if (!utilisateur) return null;

  const estAdmin = utilisateur.role === 'ADMINISTRATEUR';

  const DESCRIPTIONS: Record<string, string> = {
    ADMINISTRATEUR: "Vue d'ensemble de la plateforme et de ses utilisateurs.",
    TECHNICIEN: 'Vos tickets assignés arriveront ici dès la Phase 3.',
    EMPLOYE: 'Suivez vos demandes de support depuis cet espace.',
  };

  return (
    <div>
      <PageHeader
        eyebrow={dateLongue(new Date())}
        title={`Bonjour, ${utilisateur.prenom} 👋`}
        description={DESCRIPTIONS[utilisateur.role]}
        actions={
          <Link
            to="/profil"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
          >
            <UserCircle className="size-4" aria-hidden />
            Mon profil
          </Link>
        }
      />

      {estAdmin && <StatsAdmin />}

      <h2 className="mb-3 mt-8 text-sm font-semibold text-slate-900">Feuille de route du projet</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MODULES_A_VENIR.map(({ icon: Icon, titre, texte, phase, lien }) => (
          <Card key={titre} className="flex flex-col p-5 transition-shadow duration-200 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <Badge variant="neutral">{phase}</Badge>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">{titre}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{texte}</p>
            {lien && (
              <Link
                to={lien.to}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
              >
                {lien.label} <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
