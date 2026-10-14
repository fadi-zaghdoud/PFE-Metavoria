import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationsApi } from '../../features/notifications/notificationsApi';
import { API_BASE_URL } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { tempsRelatif } from '../../lib/format';
import type { Notification } from '../../types/ticket';
import { cn } from '../../lib/cn';

// Filet de sécurité si le flux SSE se coupe silencieusement : resynchronisation
// espacée. Le temps réel est assuré par EventSource, pas par ce timer.
const RESYNC_FALLBACK_MS = 120_000;

export function NotificationsBell() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  async function charger() {
    if (!token) return;
    try {
      const data = await notificationsApi.lister(token);
      setNotifications(data.notifications);
      setNonLues(data.nonLues);
    } catch {
      /* silencieux : la cloche ne doit pas perturber l'usage */
    }
  }

  useEffect(() => {
    if (!token) return;

    // État initial (notifications déjà existantes) puis flux temps réel.
    charger();

    // EventSource ne peut pas envoyer d'en-tête : le token passe en query.
    const source = new EventSource(
      `${API_BASE_URL}/notifications/flux?token=${encodeURIComponent(token)}`,
    );
    let premierOpen = true;

    source.addEventListener('notification', (e) => {
      try {
        const notif = JSON.parse((e as MessageEvent).data) as Notification;
        setNotifications((liste) => [notif, ...liste].slice(0, 50));
        setNonLues((c) => c + 1);
      } catch {
        /* charge malformée ignorée */
      }
    });

    source.onopen = () => {
      // À la reconnexion, resynchronise pour rattraper les événements manqués.
      if (!premierOpen) charger();
      premierOpen = false;
    };

    const fallback = window.setInterval(charger, RESYNC_FALLBACK_MS);

    return () => {
      source.close();
      window.clearInterval(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fermeture au clic extérieur et à la touche Échap.
  useEffect(() => {
    if (!ouvert) return;
    function onClic(e: MouseEvent) {
      if (conteneurRef.current && !conteneurRef.current.contains(e.target as Node)) setOuvert(false);
    }
    function onTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') setOuvert(false);
    }
    document.addEventListener('mousedown', onClic);
    document.addEventListener('keydown', onTouche);
    return () => {
      document.removeEventListener('mousedown', onClic);
      document.removeEventListener('keydown', onTouche);
    };
  }, [ouvert]);

  async function marquerTout() {
    if (!token || nonLues === 0) return;
    setNotifications((liste) => liste.map((n) => ({ ...n, lu: true })));
    setNonLues(0);
    try {
      await notificationsApi.marquerToutLu(token);
    } catch {
      charger(); // resynchronise en cas d'échec
    }
  }

  async function marquerUne(notif: Notification) {
    if (!token || notif.lu) return;
    setNotifications((liste) => liste.map((n) => (n.id === notif.id ? { ...n, lu: true } : n)));
    setNonLues((c) => Math.max(0, c - 1));
    try {
      await notificationsApi.marquerLu(notif.id, token);
    } catch {
      charger();
    }
  }

  // Clic sur une notification : marque comme lue, ferme le panneau et ouvre le ticket concerné.
  function ouvrirNotification(notif: Notification) {
    marquerUne(notif);
    setOuvert(false);
    if (notif.ticketId) navigate(`/tickets/${notif.ticketId}`);
  }

  return (
    <div className="relative" ref={conteneurRef}>
      <button
        onClick={() => setOuvert((o) => !o)}
        aria-label={`Notifications${nonLues > 0 ? ` (${nonLues} non lues)` : ''}`}
        aria-haspopup="true"
        aria-expanded={ouvert}
        className="relative rounded-lg p-2 text-texte-4 transition-colors hover:bg-surface-3 hover:text-texte-2"
      >
        <Bell className="size-5" aria-hidden />
        {nonLues > 0 && (
          <span className="absolute right-0.5 top-0.5 inline-flex">
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-rose-400/70" />
            <span className="relative flex min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-4 text-white shadow-sm ring-2 ring-surface">
              {nonLues > 9 ? '9+' : nonLues}
            </span>
          </span>
        )}
      </button>

      <AnimatePresence>
        {ouvert && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="menu"
            className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-bordure/80 bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-bordure-faible px-4 py-3">
              <p className="text-sm font-semibold text-texte">Notifications</p>
              {nonLues > 0 && (
                <button
                  onClick={marquerTout}
                  className="inline-flex items-center gap-1 text-xs font-medium text-marque hover:text-marque-fort"
                >
                  <CheckCheck className="size-3.5" aria-hidden />
                  Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-texte-4">Aucune notification.</p>
              ) : (
                <ul className="divide-y divide-bordure-faible">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        onClick={() => ouvrirNotification(n)}
                        className={cn(
                          'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface-2',
                          !n.lu && 'bg-marque-fond/40',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-1.5 size-2 shrink-0 rounded-full',
                            n.lu ? 'bg-transparent' : 'bg-primary-500',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug text-texte-2">{n.contenu}</span>
                          <span className="mt-0.5 block text-xs text-texte-4">
                            {tempsRelatif(n.dateEnvoi)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
