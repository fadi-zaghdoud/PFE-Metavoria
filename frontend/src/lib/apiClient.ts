const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

// Événement global émis quand le backend signale un jeton invalide/expiré :
// l'AppShell l'écoute pour déconnecter proprement l'utilisateur.
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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch ne rejette que sur erreur réseau (serveur injoignable, connexion perdue).
    throw new ApiError(0, 'Connexion au serveur impossible — vérifiez votre réseau');
  }

  const data = (await response.json().catch(() => null)) as (T & ErreurBackend) | null;

  if (!response.ok) {
    // Jeton expiré/invalide sur une requête authentifiée : déconnexion globale.
    if (response.status === 401 && token && data?.code === 'TOKEN_INVALIDE') {
      window.dispatchEvent(new CustomEvent(EVENEMENT_SESSION_EXPIREE));
    }
    throw new ApiError(response.status, data?.error ?? 'Une erreur est survenue', data?.details);
  }

  return data as T;
}
