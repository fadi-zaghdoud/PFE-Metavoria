import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, Utilisateur } from '../types/auth';

interface AuthState {
  utilisateur: Utilisateur | null;
  token: string | null;
  estAuthentifie: boolean;
  connecter: (auth: AuthResponse) => void;
  deconnecter: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      utilisateur: null,
      token: null,
      estAuthentifie: false,
      connecter: (auth) => set({ utilisateur: auth.utilisateur, token: auth.token, estAuthentifie: true }),
      deconnecter: () => set({ utilisateur: null, token: null, estAuthentifie: false }),
    }),
    { name: 'smart-ticketing-auth' },
  ),
);
