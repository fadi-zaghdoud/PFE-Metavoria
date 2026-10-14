import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Menu, Search } from 'lucide-react';
import { NotificationsBell } from './NotificationsBell';
import { BasculeTheme } from '../ui/BasculeTheme';

interface Crumb {
  label: string;
  to?: string;
}

function useBreadcrumbs(): Crumb[] {
  const { pathname } = useLocation();
  const { id } = useParams();

  if (pathname.startsWith('/tickets/') && id) {
    return [{ label: 'Tickets', to: '/tickets' }, { label: id }];
  }
  const MAP: Record<string, Crumb[]> = {
    '/tableau-de-bord': [{ label: 'Tableau de bord' }],
    '/tickets': [{ label: 'Tickets' }],
    '/profil': [{ label: 'Mon profil' }],
    '/administration/utilisateurs': [{ label: 'Administration' }, { label: 'Utilisateurs' }],
  };
  return MAP[pathname] ?? [];
}

interface TopbarProps {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}

export function Topbar({ onOpenMobileNav, onOpenPalette }: TopbarProps) {
  const crumbs = useBreadcrumbs();

  return (
    <header className="sticky top-0 z-30 bg-surface flex h-14 items-center gap-3 border-b border-bordure/70 px-4 shadow-xs md:px-6">
      <button
        onClick={onOpenMobileNav}
        aria-label="Ouvrir le menu"
        className="rounded-md p-1.5 text-texte-4 hover:bg-surface-3 md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-decor" aria-hidden />}
            {crumb.to ? (
              <Link to={crumb.to} className="truncate text-texte-4 transition-colors hover:text-texte">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-texte" aria-current="page">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        onClick={onOpenPalette}
        aria-label="Rechercher"
        className="group flex items-center gap-2 rounded-lg border border-bordure bg-surface/70 px-3 py-1.5 text-sm text-texte-4 shadow-xs transition-all hover:border-marque-bordure hover:text-texte-3 hover:shadow-sm"
      >
        <Search className="size-4 transition-colors group-hover:text-primary-500" aria-hidden />
        {/* Entre 768 et 1 023 px, la barre latérale est ouverte et la place manque : le libellé
            tronquerait le fil d'Ariane. La loupe seule y suffit. */}
        <span className="hidden sm:inline md:max-lg:hidden">Rechercher…</span>
        <kbd className="hidden rounded border border-bordure bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-medium text-texte-4 sm:inline md:max-lg:hidden">
          Ctrl K
        </kbd>
      </button>

      {/* Sous 640 px, la bascule tronquerait le fil d'Ariane : elle passe dans le menu (Sidebar). */}
      <BasculeTheme className="hidden sm:inline-flex" />
      <NotificationsBell />
    </header>
  );
}
