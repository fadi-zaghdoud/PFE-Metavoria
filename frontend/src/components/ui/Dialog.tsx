import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  // 'centre' (défaut) : boîte de dialogue classique, pour une action à confirmer ou un
  // formulaire court. 'lateral' : panneau glissant sur la droite, pour CONSULTER un
  // contenu long sans quitter la liste qu'on parcourt.
  // Même composant dans les deux cas : échappement, piège de focus, fermeture au clic
  // sur le fond et bouton de fermeture sont identiques — seuls la position et le sens de
  // l'animation changent.
  variant?: 'centre' | 'lateral';
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  variant = 'centre',
}: DialogProps) {
  const lateral = variant === 'lateral';
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Déplace le focus dans la boîte de dialogue à l'OUVERTURE uniquement.
  // Ne dépend surtout pas de onClose : les pages passent des fonctions inline
  // (nouvelle identité à chaque rendu), et rejouer cet effet à chaque frappe
  // volerait le focus du champ en cours de saisie.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Si un champ du dialog a déjà le focus (ex. autoFocus), on ne le vole pas.
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex',
            lateral ? 'justify-end' : 'items-center justify-center p-4',
          )}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-encre/40 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={lateral ? { opacity: 0, x: 32 } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={lateral ? { opacity: 1, x: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={lateral ? { opacity: 0, x: 32 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'relative border border-bordure/80 bg-surface shadow-xl outline-none',
              lateral
                ? 'flex h-full w-full max-w-lg flex-col overflow-hidden border-y-0 border-r-0 sm:rounded-l-2xl'
                : 'w-full max-w-md rounded-2xl',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <h2 className="text-base font-semibold text-texte">{title}</h2>
                {description && <p className="mt-1 text-sm text-texte-4">{description}</p>}
              </div>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="rounded-md p-1 text-texte-4 transition-colors hover:bg-surface-3 hover:text-texte-3"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            {children && (
              <div className={cn('px-5 py-4', lateral && 'flex-1 overflow-y-auto')}>{children}</div>
            )}
            {footer && (
              <div className="flex justify-end gap-2 rounded-b-xl border-t border-bordure-faible bg-surface-2/60 px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
