import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/cn';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  variant: ToastVariant;
  titre: string;
  description?: string;
}

interface ToastApi {
  success: (titre: string, description?: string) => void;
  error: (titre: string, description?: string) => void;
  warning: (titre: string, description?: string) => void;
  info: (titre: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const STYLES: Record<ToastVariant, { icone: typeof Info; classes: string }> = {
  success: { icone: CircleCheck, classes: 'text-emerald-600' },
  error: { icone: CircleAlert, classes: 'text-rose-600' },
  warning: { icone: TriangleAlert, classes: 'text-amber-600' },
  info: { icone: Info, classes: 'text-sky-600' },
};

// Les erreurs restent affichées plus longtemps que les confirmations.
const DUREES: Record<ToastVariant, number> = {
  success: 4500,
  info: 4500,
  warning: 6500,
  error: 6500,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prochainId = useRef(0);

  const fermer = useCallback((id: number) => {
    setToasts((liste) => liste.filter((t) => t.id !== id));
  }, []);

  const ajouter = useCallback(
    (variant: ToastVariant, titre: string, description?: string) => {
      const id = prochainId.current++;
      setToasts((liste) => [...liste.slice(-4), { id, variant, titre, description }]);
      window.setTimeout(() => fermer(id), DUREES[variant]);
    },
    [fermer],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, d) => ajouter('success', t, d),
      error: (t, d) => ajouter('error', t, d),
      warning: (t, d) => ajouter('warning', t, d),
      info: (t, d) => ajouter('info', t, d),
    }),
    [ajouter],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Zone de notifications — annoncée aux lecteurs d'écran */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(92vw,24rem)] flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const { icone: Icone, classes } = STYLES[toast.variant];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                role={toast.variant === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg"
              >
                <Icone className={cn('mt-0.5 size-5 shrink-0', classes)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{toast.titre}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-sm leading-snug text-slate-500">{toast.description}</p>
                  )}
                </div>
                <button
                  onClick={() => fermer(toast.id)}
                  aria-label="Fermer la notification"
                  className="rounded-md p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const contexte = useContext(ToastContext);
  if (!contexte) {
    throw new Error('useToast doit être utilisé à l\'intérieur de <ToastProvider>');
  }
  return contexte;
}
