import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi } from '../features/auth/authApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import type { InvitationInfo } from '../types/auth';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { PasswordInput, PasswordStrength, scoreMotDePasse } from '../components/ui/PasswordInput';
import { useToast } from '../components/ui/Toast';

type Etat =
  | { statut: 'CHARGEMENT' }
  | { statut: 'INVALIDE'; message: string }
  | { statut: 'PRET'; invitation: InvitationInfo };

export function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const connecter = useAuthStore((state) => state.connecter);

  const token = searchParams.get('token');

  const [etat, setEtat] = useState<Etat>({ statut: 'CHARGEMENT' });
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurConfirmation, setErreurConfirmation] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Valide le lien dès l'arrivée sur la page, pour un retour immédiat.
  useEffect(() => {
    if (!token) {
      setEtat({ statut: 'INVALIDE', message: "Lien d'invitation invalide : le token est manquant." });
      return;
    }
    authApi
      .validerInvitation(token)
      .then(({ invitation }) => setEtat({ statut: 'PRET', invitation }))
      .catch((err) =>
        setEtat({
          statut: 'INVALIDE',
          message: err instanceof ApiError ? err.message : 'Impossible de vérifier le lien d\'invitation',
        }),
      );
  }, [token]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setErreur(null);
    setErreurConfirmation(null);

    if (motDePasse !== confirmation) {
      setErreurConfirmation('Les deux mots de passe ne correspondent pas');
      return;
    }

    setEnCours(true);
    try {
      const auth = await authApi.activerCompte({ token, motDePasse });
      connecter(auth);
      toast.success(
        `Bienvenue, ${auth.utilisateur.prenom} !`,
        'Votre compte est activé — bon travail sur Smart Ticketing.',
      );
      navigate('/tableau-de-bord', { replace: true });
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible d'activer le compte");
    } finally {
      setEnCours(false);
    }
  }

  let contenu;
  if (etat.statut === 'CHARGEMENT') {
    contenu = (
      <div className="flex items-center gap-2.5 text-sm text-texte-4" role="status">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Vérification du lien d'invitation…
      </div>
    );
  } else if (etat.statut === 'INVALIDE') {
    contenu = (
      <div className="space-y-4">
        <Alert variant="danger">{etat.message}</Alert>
        <p className="text-sm text-texte-4">
          Besoin d'un nouveau lien ? Contactez votre administrateur : il peut renvoyer l'invitation en
          un clic depuis la gestion des utilisateurs.
        </p>
      </div>
    );
  } else {
    contenu = (
      <form onSubmit={handleSubmit} className="space-y-4">
        <Alert variant="info">
          Bonjour <strong className="font-semibold">{etat.invitation.prenom}</strong> — ce compte est
          rattaché à <strong className="font-semibold">{etat.invitation.email}</strong>.
        </Alert>

        <div className="space-y-1.5">
          <label htmlFor="motDePasse" className="block text-sm font-medium text-texte-2">
            Choisissez votre mot de passe
          </label>
          <PasswordInput
            id="motDePasse"
            required
            autoFocus
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
          <PasswordStrength motDePasse={motDePasse} />
        </div>

        <Field label="Confirmer le mot de passe" htmlFor="confirmation" error={erreurConfirmation}>
          <PasswordInput
            id="confirmation"
            required
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </Field>

        {erreur && <Alert variant="danger">{erreur}</Alert>}

        <Button
          type="submit"
          loading={enCours}
          disabled={scoreMotDePasse(motDePasse) < 3}
          className="w-full"
        >
          Activer mon compte
        </Button>
      </form>
    );
  }

  return (
    <AuthLayout
      titre="Activer votre compte"
      sousTitre="Dernière étape : choisissez votre mot de passe personnel."
      pied={
        <Link to="/connexion" className="font-medium text-marque hover:underline">
          J'ai déjà un compte actif
        </Link>
      }
    >
      {contenu}
    </AuthLayout>
  );
}
