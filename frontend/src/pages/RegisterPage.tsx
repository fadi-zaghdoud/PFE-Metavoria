import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../features/auth/authApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';

export function RegisterPage() {
  const navigate = useNavigate();
  const connecter = useAuthStore((state) => state.connecter);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [service, setService] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const auth = await authApi.inscrire({
        nom,
        prenom,
        email,
        motDePasse,
        service: service || undefined,
      });
      connecter(auth);
      navigate('/tableau-de-bord', { replace: true });
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de créer le compte');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Créer un compte</h1>
        <p className="mb-6 text-sm text-slate-500">Smart Ticketing & Support Assistant</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prenom" className="mb-1 block text-sm font-medium text-slate-700">
                Prénom
              </label>
              <input
                id="prenom"
                required
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="nom" className="mb-1 block text-sm font-medium text-slate-700">
                Nom
              </label>
              <input
                id="nom"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="prenom.nom@metavoria.tn"
            />
          </div>

          <div>
            <label htmlFor="service" className="mb-1 block text-sm font-medium text-slate-700">
              Service <span className="text-slate-400">(facultatif)</span>
            </label>
            <input
              id="service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Ex. Comptabilité"
            />
          </div>

          <div>
            <label htmlFor="motDePasse" className="mb-1 block text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id="motDePasse"
              type="password"
              required
              minLength={8}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="8 caractères minimum"
            />
          </div>

          {erreur && <p className="text-sm text-red-600">{erreur}</p>}

          <button
            type="submit"
            disabled={enCours}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {enCours ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Déjà un compte ?{' '}
          <Link to="/connexion" className="font-medium text-blue-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
