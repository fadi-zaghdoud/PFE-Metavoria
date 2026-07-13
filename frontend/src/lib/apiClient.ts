import { useAuthStore } from '../store/authStore';
import type { Utilisateur } from '../types/auth';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// Événement global émis quand la session est définitivement perdue (refresh
// échoué) : l'AppShell l'écoute pour déconnecter proprement l'utilisateur.
export const EVENEMENT_SESSION_EXPIREE = 'auth:session-expiree';

export class ApiError extends Error {
  readonly status: number;
  // Erreurs de validation par champ renvoyées par le backend (Zod).
  readonly details?: Record<string, string[]>;

  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  // Premier message d'erreur pour un champ donné, s'il existe.
  champ(nom: string): string | undefined {
    return this.details?.[nom]?.[0];
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

interface ErreurBackend {
  error?: string;
  code?: string;
  details?: Record<string, string[]>;
}

// ── Rafraîchissement silencieux de l'access token ────────────────────────────
// Le refresh token vit dans un cookie httpOnly (envoyé via credentials:'include',
// inaccessible au JS). Un seul appel /auth/rafraichir est en vol à la fois : les
// requêtes concurrentes qui tombent sur un 401 partagent la même promesse.
let rafraichissementEnCours: Promise<string | null> | null = null;

export function rafraichirAccessToken(): Promise<string | null> {
  rafraichissementEnCours ??= (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/rafraichir`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { utilisateur: Utilisateur; token: string };
      useAuthStore.getState().connecter({ utilisateur: data.utilisateur, token: data.token });
      return data.token;
    } catch {
      return null;
    } finally {
      rafraichissementEnCours = null;
    }
  })();
  return rafraichissementEnCours;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
  reessaye = false,
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include', // envoie le cookie refresh aux routes /api/auth
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch ne rejette que sur erreur réseau (serveur injoignable, connexion perdue).
    throw new ApiError(0, 'Connexion au serveur impossible — vérifiez votre réseau');
  }

  const data = (await response.json().catch(() => null)) as (T & ErreurBackend) | null;

  if (!response.ok) {
    // Access token expiré : on tente UN rafraîchissement silencieux, puis on
    // rejoue la requête. Si le refresh échoue aussi → déconnexion globale.
    if (response.status === 401 && data?.code === 'TOKEN_INVALIDE') {
      if (token && !reessaye) {
        const nouveau = await rafraichirAccessToken();
        if (nouveau) return apiRequest<T>(path, { ...options, token: nouveau }, true);
      }
      window.dispatchEvent(new CustomEvent(EVENEMENT_SESSION_EXPIREE));
    }
    throw new ApiError(response.status, data?.error ?? 'Une erreur est survenue', data?.details);
  }

  return data as T;
}
