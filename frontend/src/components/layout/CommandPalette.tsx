import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboard,
  LogOut,
  Search,
  Ticket,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../features/auth/authApi';
import { cn } from '../../lib/cn';

interface Commande {
  label: string;
  icon: LucideIcon;
  section: string;
  motsCles?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const deconnecter = useAuthStore((state) => state.deconnecter);

  const [requete, setRequete] = useState('');
  const [indexActif, setIndexActif] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandes = useMemo<Commande[]>(() => {
    const aller = (to: string) => () => {
      navigate(to);
      onClose();
    };
    const liste: Commande[] = [
      { label: 'Tableau de bord', icon: LayoutDashboard, section: 'Navigation', action: aller('/tableau-de-bord') },
      { label: 'Tickets', icon: Ticket, section: 'Navigation', motsCles: 'support demandes', action: aller('/tickets') },
      { label: 'Mon profil', icon: UserCircle, section: 'Navigation', motsCles: 'compte parametres', action: aller('/profil') },
    ];
    if (utilisateur?.role === 'ADMINISTRATEUR') {
      liste.push({
        label: 'Gestion des utilisateurs',
        icon: Users,
        section: 'Administration',
        motsCles: 'admin comptes roles',
        action: aller('/administration/utilisateurs'),
      });
    }
    liste.push({
      label: 'Se déconnecter',
      icon: LogOut,
      section: 'Compte',
      motsCles: 'logout quitter',
      action: () => {
        void authApi.deconnexion().catch(() => {});
        deconnecter();
        onClose();
        navigate('/connexion', { replace: true });
      },
    });
    return liste;
  }, [navigate, onClose, utilisateur?.role, deconnecter]);

  const resultats = useMemo(() => {
    const q = requete.trim().toLowerCase();
    if (!q) return commandes;
    return commandes.filter((c) => `${c.label} ${c.motsCles ?? ''}`.toLowerCase().includes(q));
  }, [commandes, requete]);

  useEffect(() => {
    if (open) {
      setRequete('');
      setIndexActif(0);
      // Laisse l'animation démarrer avant de focus.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setIndexActif(0), [requete]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndexActif((i) => Math.min(i + 1, resultats.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndexActif((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && resultats[indexActif]) {
      resultats[indexActif].action();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]" onKeyDown={onKeyDown}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-encre/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Palette de commandes"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-bordure/80 bg-surface shadow-xl"
          >
            <div className="flex items-center gap-2.5 border-b border-bordure-faible px-4">
              <Search className="size-4 text-texte-4" aria-hidden />
              <input
                ref={inputRef}
                value={requete}
                onChange={(e) => setRequete(e.target.value)}
                placeholder="Rechercher une page ou une action…"
                aria-label="Rechercher une commande"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-texte-4"
              />
              <kbd className="rounded border border-bordure bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-texte-4">
                Échap
              </kbd>
            </div>

            <ul role="listbox" aria-label="Résultats" className="max-h-72 overflow-y-auto p-2">
              {resultats.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-texte-4">Aucun résultat</li>
              )}
              {resultats.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <li key={cmd.label} role="option" aria-selected={i === indexActif}>
                    <button
                      onClick={cmd.action}
                      onMouseEnter={() => setIndexActif(i)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                        i === indexActif ? 'bg-marque-fond text-marque-fort' : 'text-texte-2',
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="flex-1">{cmd.label}</span>
                      <span className="text-xs text-texte-4">{cmd.section}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
