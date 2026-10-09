import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { authApi } from '../features/auth/authApi';
import { ApiError } from '../lib/apiClient';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { OtpInput } from '../components/ui/OtpInput';
import { PasswordInput, PasswordStrength, scoreMotDePasse } from '../components/ui/PasswordInput';
import { useToast } from '../components/ui/Toast';

type Etape = 'EMAIL' | 'CODE' | 'MOT_DE_PASSE';
const COOLDOWN_RENVOI_S = 60;

const SOUS_TITRES: Record<Etape, string> = {
  EMAIL: 'Indiquez votre e-mail, nous vous envoyons un code de vérification.',
  CODE: 'Saisissez le code à 6 chiffres reçu par e-mail.',
  MOT_DE_PASSE: 'Code vérifié — choisissez votre nouveau mot de passe.',
};

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [etape, setEtape] = useState<Etape>('EMAIL');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurConfirmation, setErreurConfirmation] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [renvoiDans, setRenvoiDans] = useState(0);

  // Compte à rebours avant de pouvoir redemander un code.
  useEffect(() => {
    if (renvoiDans <= 0) return;
    const timer = window.setInterval(() => setRenvoiDans((s) => s - 1), 1000);
    return () => window.clearInterval(timer);
  }, [renvoiDans]);

  async function demanderCode(cible: 'ENVOI' | 'RENVOI') {
    setErreur(null);
    setEnCours(true);
    try {
      await authApi.demanderCodeReinitialisation({ email });
      setRenvoiDans(COOLDOWN_RENVOI_S);
      setCode('');
      setEtape('CODE');
      toast.success(
        cible === 'ENVOI' ? 'Code de vérification envoyé' : 'Nouveau code envoyé',
        `Consultez la boîte de réception de ${email}.`,
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Une erreur est survenue';
      setErreur(message);
      if (err instanceof ApiError && err.status === 0) {
        toast.error('Connexion perdue', message);
      }
    } finally {
      setEnCours(false);
    }
  }

  async function handleSubmitEmail(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await demanderCode('ENVOI');
  }

  async function handleSubmitCode(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await authApi.verifierCode({ email, code });
      setEtape('MOT_DE_PASSE');
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setEnCours(false);
    }
  }

  async function handleSubmitMotDePasse(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreur(null);
    setErreurConfirmation(null);

    if (nouveauMotDePasse !== confirmation) {
      setErreurConfirmation('Les deux mots de passe ne correspondent pas');
      return;
    }

    setEnCours(true);
    try {
      await authApi.reinitialiserMotDePasse({ email, code, nouveauMotDePasse });
      toast.success('Mot de passe mis à jour', 'Vous pouvez maintenant vous connecter.');
      navigate('/connexion', { replace: true });
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Une erreur est survenue');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <AuthLayout
      titre="Mot de passe oublié"
      sousTitre={SOUS_TITRES[etape]}
      pied={
        <Link to="/connexion" className="font-medium text-marque hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={etape}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {etape === 'EMAIL' && (
            <form onSubmit={handleSubmitEmail} className="space-y-4">
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom.nom@metavoria.tn"
                />
              </Field>

              {erreur && <Alert variant="danger">{erreur}</Alert>}

              <Button type="submit" loading={enCours} className="w-full">
                Envoyer le code
              </Button>
            </form>
          )}

          {etape === 'CODE' && (
            <form onSubmit={handleSubmitCode} className="space-y-4">
              <Alert variant="info" className="items-center">
                <span className="flex items-center gap-1.5">
                  <MailCheck className="size-4 shrink-0" aria-hidden />
                  Code envoyé à <strong className="font-semibold">{email}</strong>
                </span>
              </Alert>

              <Field label="Code de vérification" htmlFor="otp-0" hint="Valable 10 minutes — 5 essais maximum.">
                <OtpInput value={code} onChange={setCode} disabled={enCours} />
              </Field>

              {erreur && <Alert variant="danger">{erreur}</Alert>}

              <Button type="submit" loading={enCours} disabled={code.length !== 6} className="w-full">
                Vérifier le code
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setEtape('EMAIL');
                    setErreur(null);
                  }}
                  className="inline-flex items-center gap-1 text-texte-4 hover:text-texte"
                >
                  <ArrowLeft className="size-3.5" aria-hidden />
                  Changer d'e-mail
                </button>
                {renvoiDans > 0 ? (
                  <span className="tabular-nums text-texte-4">Renvoyer dans {renvoiDans} s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => demanderCode('RENVOI')}
                    disabled={enCours}
                    className="font-medium text-marque hover:underline disabled:opacity-50"
                  >
                    Renvoyer le code
                  </button>
                )}
              </div>
            </form>
          )}

          {etape === 'MOT_DE_PASSE' && (
            <form onSubmit={handleSubmitMotDePasse} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="nouveauMotDePasse" className="block text-sm font-medium text-texte-2">
                  Nouveau mot de passe
                </label>
                <PasswordInput
                  id="nouveauMotDePasse"
                  required
                  autoFocus
                  minLength={10}
                  autoComplete="new-password"
                  value={nouveauMotDePasse}
                  onChange={(e) => setNouveauMotDePasse(e.target.value)}
                />
                <PasswordStrength motDePasse={nouveauMotDePasse} />
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
                disabled={scoreMotDePasse(nouveauMotDePasse) < 3}
                className="w-full"
              >
                Réinitialiser le mot de passe
              </Button>
            </form>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
}
