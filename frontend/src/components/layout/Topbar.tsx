import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronRight, Menu, Search } from 'lucide-react';

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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur md:px-6">
      <button
        onClick={onOpenMobileNav}
        aria-label="Ouvrir le menu"
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden />}
            {crumb.to ? (
              <Link to={crumb.to} className="truncate text-slate-500 transition-colors hover:text-slate-900">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-slate-900" aria-current="page">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        onClick={onOpenPalette}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400 shadow-xs transition-colors hover:border-slate-300 hover:text-slate-600"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 sm:inline">
          Ctrl K
        </kbd>
      </button>
    </header>
  );
}
