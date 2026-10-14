import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../features/auth/authApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { PasswordInput } from '../components/ui/PasswordInput';
import { useToast } from '../components/ui/Toast';

export function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const connecter = useAuthStore((state) => state.connecter);

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const auth = await authApi.connecter({ email, motDePasse });
      connecter(auth);
      toast.success('Connexion réussie', `Bon retour, ${auth.utilisateur.prenom} !`);
      navigate('/tableau-de-bord', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Impossible de se connecter';
      setErreur(message);
      if (err instanceof ApiError && err.status === 0) {
        toast.error('Connexion perdue', message);
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <AuthLayout
      titre="Bon retour parmi nous"
      sousTitre="Connectez-vous à votre espace de support."
      pied={
        <>
          Pas encore de compte ?{' '}
          <Link to="/inscription" className="font-medium text-marque hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@metavoria.tn"
          />
        </Field>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="motDePasse" className="block text-sm font-medium text-texte-2">
              Mot de passe
            </label>
            <Link to="/mot-de-passe-oublie" className="text-xs font-medium text-marque hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
          <PasswordInput
            id="motDePasse"
            required
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {erreur && <Alert variant="danger">{erreur}</Alert>}

        <Button type="submit" loading={enCours} className="w-full">
          Se connecter
        </Button>
      </form>
    </AuthLayout>
  );
}
