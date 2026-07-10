import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { EVENEMENT_SESSION_EXPIREE } from '../../lib/apiClient';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../ui/Toast';

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const deconnecter = useAuthStore((state) => state.deconnecter);
  const [mobileNavOuverte, setMobileNavOuverte] = useState(false);
  const [paletteOuverte, setPaletteOuverte] = useState(false);

  // Raccourci global Ctrl+K / ⌘K pour la palette de commandes.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Session expirée signalée par l'API : déconnexion propre + notification.
  useEffect(() => {
    function onSessionExpiree() {
      deconnecter();
      toast.warning('Session expirée', 'Veuillez vous reconnecter pour continuer.');
      navigate('/connexion', { replace: true });
    }
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, onSessionExpiree);
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, onSessionExpiree);
  }, [deconnecter, navigate, toast]);

  // Referme le drawer mobile à chaque navigation.
  useEffect(() => setMobileNavOuverte(false), [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Sidebar desktop */}
      <aside className="hidden shrink-0 md:block">
        <Sidebar />
      </aside>

      {/* Drawer mobile */}
      <AnimatePresence>
        {mobileNavOuverte && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-slate-950/40"
              onClick={() => setMobileNavOuverte(false)}
              aria-hidden
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0"
            >
              <Sidebar onNavigate={() => setMobileNavOuverte(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMobileNav={() => setMobileNavOuverte(true)}
          onOpenPalette={() => setPaletteOuverte(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette open={paletteOuverte} onClose={() => setPaletteOuverte(false)} />
    </div>
  );
}
