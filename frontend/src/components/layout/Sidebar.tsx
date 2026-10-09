import { NavLink, useNavigate } from 'react-router-dom';
import {
  Brain,
  CalendarOff,
  FolderTree,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
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
import { BasculeTheme } from '../ui/BasculeTheme';
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
            ? 'bg-marque-fond text-marque-fort shadow-xs ring-1 ring-inset ring-marque/10'
            : 'text-texte-3 hover:bg-surface-3 hover:text-texte',
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
              isActive ? 'text-marque' : 'text-texte-4 group-hover:text-texte-3',
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
    <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-wider text-texte-4">
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
    <div className="flex h-full w-64 flex-col border-r border-bordure/80 bg-surface/90 backdrop-blur-xl">
      <div className="flex h-14 items-center border-b border-bordure-faible px-4">
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
                item={{ to: '/administration/categories', label: 'Catégories', icon: FolderTree }}
                onNavigate={onNavigate}
              />
              <SidebarLink
                item={{ to: '/administration/absences', label: 'Absences', icon: CalendarOff }}
                onNavigate={onNavigate}
              />
              <SidebarLink
                item={{ to: '/administration/ia', label: 'Modèle IA', icon: Brain }}
                onNavigate={onNavigate}
              />
              <SidebarLink
                item={{ to: '/administration/journal', label: "Journal d'audit", icon: ScrollText }}
                onNavigate={onNavigate}
              />
              <SidebarLink
                item={{ to: '/administration/parametres', label: 'Paramètres', icon: Settings }}
                onNavigate={onNavigate}
              />
            </div>
          </>
        )}
      </nav>

      {/* Bascule de thème du téléphone (la barre du haut la masque sous 640 px). La barre
          latérale de bureau n'apparaît qu'à partir de 768 px : cette ligne n'y est jamais visible. */}
      <div className="flex items-center justify-between border-t border-bordure-faible px-5 py-2.5 sm:hidden">
        <span className="text-xs font-medium text-texte-4">Thème</span>
        <BasculeTheme />
      </div>

      {utilisateur && (
        <div className="border-t border-bordure-faible p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-bordure/70 hover:bg-surface-2">
            <Avatar prenom={utilisateur.prenom} nom={utilisateur.nom} photoUrl={utilisateur.photoUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-texte">
                {utilisateur.prenom} {utilisateur.nom}
              </p>
              <p className="truncate text-xs text-texte-4">{LABELS_ROLE[utilisateur.role]}</p>
            </div>
            <button
              onClick={handleDeconnexion}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="rounded-lg p-1.5 text-texte-4 transition-colors hover:bg-surface hover:text-danger-accent hover:shadow-xs"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
