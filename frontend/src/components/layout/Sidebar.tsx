import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Brain,
  LayoutDashboard,
  LogOut,
  Ticket,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../features/auth/authApi';
import { LABELS_ROLE } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Logo } from './Logo';
import { cn } from '../../lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const NAV_PRINCIPAL: NavItem[] = [
  { to: '/tableau-de-bord', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/profil', label: 'Mon profil', icon: UserCircle },
];

const NAV_A_VENIR: { label: string; icon: LucideIcon; phase: string }[] = [
  { label: 'Statistiques', icon: BarChart3, phase: 'Phase 4' },
  { label: 'Base de connaissances', icon: BookOpen, phase: 'Phase 5' },
];

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
          isActive
            ? 'bg-primary-50 text-primary-700 shadow-xs ring-1 ring-inset ring-primary-600/10'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={cn(
              'absolute -left-2.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary-600 transition-all duration-200',
              isActive ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0',
            )}
          />
          <Icon
            className={cn(
              'size-4.5 shrink-0 transition-colors duration-150',
              isActive ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600',
            )}
            aria-hidden
          />
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && <Badge variant="primary">{item.badge}</Badge>}
        </>
      )}
    </NavLink>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

// onNavigate : permet au drawer mobile de se refermer après un clic.
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const deconnecter = useAuthStore((state) => state.deconnecter);
  const navigate = useNavigate();

  async function handleDeconnexion() {
    // Révoque le refresh token côté serveur (best-effort) avant de vider l'état.
    await authApi.deconnexion().catch(() => {});
    deconnecter();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="flex h-14 items-center border-b border-slate-100 px-4">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        <SectionTitle>Espace de travail</SectionTitle>
        <div className="space-y-1">
          {NAV_PRINCIPAL.map((item) => (
            <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        {utilisateur?.role === 'ADMINISTRATEUR' && (
          <>
            <SectionTitle>Administration</SectionTitle>
            <div className="space-y-1">
              <SidebarLink
                item={{ to: '/administration/utilisateurs', label: 'Utilisateurs', icon: Users }}
                onNavigate={onNavigate}
              />
              <SidebarLink
                item={{ to: '/administration/ia', label: 'Modèle IA', icon: Brain }}
                onNavigate={onNavigate}
              />
            </div>
          </>
        )}

        <SectionTitle>À venir</SectionTitle>
        <div className="space-y-1">
          {NAV_A_VENIR.map(({ label, icon: Icon, phase }) => (
            <div
              key={label}
              className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300"
              title={`Disponible en ${phase}`}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{label}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                {phase}
              </span>
            </div>
          ))}
        </div>
      </nav>

      {utilisateur && (
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-slate-200/70 hover:bg-slate-50">
            <Avatar prenom={utilisateur.prenom} nom={utilisateur.nom} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {utilisateur.prenom} {utilisateur.nom}
              </p>
              <p className="truncate text-xs text-slate-400">{LABELS_ROLE[utilisateur.role]}</p>
            </div>
            <button
              onClick={handleDeconnexion}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-rose-600 hover:shadow-xs"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
