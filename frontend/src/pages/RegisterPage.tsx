import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../features/auth/authApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { PasswordInput, PasswordStrength, scoreMotDePasse } from '../components/ui/PasswordInput';
import { useToast } from '../components/ui/Toast';

export function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const connecter = useAuthStore((state) => state.connecter);

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [service, setService] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  // Erreurs de validation par champ (client + serveur).
  const [erreursChamps, setErreursChamps] = useState<Record<string, string | undefined>>({});
  const [enCours, setEnCours] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur(null);
    setErreursChamps({});

    if (motDePasse !== confirmation) {
      setErreursChamps({ confirmation: 'Les deux mots de passe ne correspondent pas' });
      return;
    }

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
      toast.success(`Bienvenue, ${auth.utilisateur.prenom} !`, 'Votre compte a été créé avec succès.');
      navigate('/tableau-de-bord', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          // Erreurs Zod backend : affichées sous les champs concernés.
          setErreursChamps({
            nom: err.champ('nom'),
            prenom: err.champ('prenom'),
            email: err.champ('email'),
            motDePasse: err.champ('motDePasse'),
            service: err.champ('service'),
          });
        } else {
          setErreur(err.message);
        }
        if (err.status === 0) toast.error('Connexion perdue', err.message);
      } else {
        setErreur('Impossible de créer le compte');
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <AuthLayout
      titre="Créer un compte"
      sousTitre="Rejoignez votre espace de support en quelques secondes."
      pied={
        <>
          Déjà un compte ?{' '}
          <Link to="/connexion" className="font-medium text-marque hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom" htmlFor="prenom" error={erreursChamps.prenom}>
            <Input
              id="prenom"
              required
              maxLength={100}
              autoComplete="given-name"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
            />
          </Field>
          <Field label="Nom" htmlFor="nom" error={erreursChamps.nom}>
            <Input
              id="nom"
              required
              maxLength={100}
              autoComplete="family-name"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Email" htmlFor="email" error={erreursChamps.email}>
          <Input
            id="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@metavoria.tn"
          />
        </Field>

        <Field
          label="Service"
          htmlFor="service"
          error={erreursChamps.service}
          hint="Facultatif — ex. Comptabilité, IT, RH…"
        >
          <Input id="service" maxLength={100} value={service} onChange={(e) => setService(e.target.value)} />
        </Field>

        <div className="space-y-1.5">
          <label htmlFor="motDePasse" className="block text-sm font-medium text-texte-2">
            Mot de passe
          </label>
          <PasswordInput
            id="motDePasse"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
          {erreursChamps.motDePasse && (
            <p className="text-xs text-danger-texte" role="alert">
              {erreursChamps.motDePasse}
            </p>
          )}
          <PasswordStrength motDePasse={motDePasse} />
        </div>

        <Field label="Confirmer le mot de passe" htmlFor="confirmation" error={erreursChamps.confirmation}>
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
          Créer mon compte
        </Button>
      </form>
    </AuthLayout>
  );
}
