import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  LogOut,
  Ticket,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
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
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150',
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <Icon className="size-4.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <Badge variant="primary">{item.badge}</Badge>}
    </NavLink>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="px-2.5 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {children}
    </p>
  );
}

// onNavigate : permet au drawer mobile de se refermer après un clic.
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const deconnecter = useAuthStore((state) => state.deconnecter);
  const navigate = useNavigate();

  function handleDeconnexion() {
    deconnecter();
    navigate('/connexion', { replace: true });
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-14 items-center border-b border-slate-100 px-4">
        <Logo />
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Navigation principale">
        <SectionTitle>Espace de travail</SectionTitle>
        <div className="space-y-0.5">
          {NAV_PRINCIPAL.map((item) => (
            <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </div>

        {utilisateur?.role === 'ADMINISTRATEUR' && (
          <>
            <SectionTitle>Administration</SectionTitle>
            <div className="space-y-0.5">
              <SidebarLink
                item={{ to: '/administration/utilisateurs', label: 'Utilisateurs', icon: Users }}
                onNavigate={onNavigate}
              />
            </div>
          </>
        )}

        <SectionTitle>À venir</SectionTitle>
        <div className="space-y-0.5">
          {NAV_A_VENIR.map(({ label, icon: Icon, phase }) => (
            <div
              key={label}
              className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300"
              title={`Disponible en ${phase}`}
            >
              <Icon className="size-4.5 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{label}</span>
              <span className="text-[10px] font-medium text-slate-300">{phase}</span>
            </div>
          ))}
        </div>
      </nav>

      {utilisateur && (
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
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
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
