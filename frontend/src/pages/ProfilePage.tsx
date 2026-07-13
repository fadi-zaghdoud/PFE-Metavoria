import { useState, type SubmitEvent } from 'react';
import { KeyRound, Mail } from 'lucide-react';
import { authApi } from '../features/auth/authApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { LABELS_ROLE, tempsRelatif } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { PasswordInput, PasswordStrength, scoreMotDePasse } from '../components/ui/PasswordInput';
import { useToast } from '../components/ui/Toast';

export function ProfilePage() {
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const token = useAuthStore((state) => state.token);
  const mettreAJourUtilisateur = useAuthStore((state) => state.mettreAJourUtilisateur);
  const toast = useToast();

  const [nom, setNom] = useState(utilisateur?.nom ?? '');
  const [prenom, setPrenom] = useState(utilisateur?.prenom ?? '');
  const [service, setService] = useState(utilisateur?.service ?? '');
  const [poste, setPoste] = useState(utilisateur?.poste ?? '');
  const [erreurProfil, setErreurProfil] = useState<string | null>(null);
  const [enCoursProfil, setEnCoursProfil] = useState(false);

  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurMdp, setErreurMdp] = useState<string | null>(null);
  const [erreurConfirmation, setErreurConfirmation] = useState<string | null>(null);
  const [enCoursMdp, setEnCoursMdp] = useState(false);

  if (!utilisateur || !token) return null;

  async function handleSubmitProfil(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreurProfil(null);
    setEnCoursProfil(true);
    try {
      const { utilisateur: miseAJour } = await authApi.mettreAJourProfil(
        { nom, prenom, service: service || undefined, poste: poste || undefined },
        token!,
      );
      mettreAJourUtilisateur(miseAJour);
      toast.success('Profil mis à jour', 'Vos informations ont été enregistrées.');
    } catch (err) {
      setErreurProfil(err instanceof ApiError ? err.message : 'Impossible de mettre à jour le profil');
    } finally {
      setEnCoursProfil(false);
    }
  }

  async function handleSubmitMotDePasse(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setErreurMdp(null);
    setErreurConfirmation(null);

    if (nouveauMotDePasse !== confirmation) {
      setErreurConfirmation('Les deux mots de passe ne correspondent pas');
      return;
    }

    setEnCoursMdp(true);
    try {
      await authApi.changerMotDePasse({ motDePasseActuel, nouveauMotDePasse }, token!);
      toast.success('Mot de passe mis à jour', 'Utilisez-le lors de votre prochaine connexion.');
      setMotDePasseActuel('');
      setNouveauMotDePasse('');
      setConfirmation('');
    } catch (err) {
      setErreurMdp(err instanceof ApiError ? err.message : 'Impossible de changer le mot de passe');
    } finally {
      setEnCoursMdp(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Mon profil" description="Gérez vos informations personnelles et votre mot de passe." />

      {/* Carte d'identité */}
      <Card className="mb-6 overflow-hidden bg-gradient-to-br from-white to-primary-50/50">
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar prenom={utilisateur.prenom} nom={utilisateur.nom} size="lg" className="ring-2 ring-white shadow-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {utilisateur.prenom} {utilisateur.nom}
              </h2>
              <Badge variant={utilisateur.role === 'ADMINISTRATEUR' ? 'primary' : 'neutral'}>
                {LABELS_ROLE[utilisateur.role]}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="size-3.5" aria-hidden />
              {utilisateur.email}
            </p>
          </div>
          <p className="text-xs text-slate-400">Membre depuis {tempsRelatif(utilisateur.dateCreation)}</p>
        </CardContent>
      </Card>

      {/* Informations personnelles */}
      <Card className="mb-6">
        <CardHeader
          title="Informations personnelles"
          description="Votre e-mail est votre identifiant de connexion et ne peut pas être modifié."
        />
        <CardContent>
          <form onSubmit={handleSubmitProfil} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Prénom" htmlFor="prenom">
                <Input id="prenom" required value={prenom} onChange={(e) => setPrenom(e.target.value)} />
              </Field>
              <Field label="Nom" htmlFor="nom">
                <Input id="nom" required value={nom} onChange={(e) => setNom(e.target.value)} />
              </Field>
              <Field label="Service" htmlFor="service">
                <Input
                  id="service"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="Ex. Comptabilité"
                />
              </Field>
              <Field label="Poste" htmlFor="poste">
                <Input
                  id="poste"
                  value={poste}
                  onChange={(e) => setPoste(e.target.value)}
                  placeholder="Ex. Comptable senior"
                />
              </Field>
            </div>

            {erreurProfil && <Alert variant="danger">{erreurProfil}</Alert>}

            <div className="flex justify-end">
              <Button type="submit" loading={enCoursProfil}>
                Enregistrer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Sécurité */}
      <Card>
        <CardHeader title="Sécurité" description="Changez votre mot de passe de connexion." />
        <CardContent>
          <form onSubmit={handleSubmitMotDePasse} className="space-y-4">
            <Field label="Mot de passe actuel" htmlFor="motDePasseActuel">
              <PasswordInput
                id="motDePasseActuel"
                required
                autoComplete="current-password"
                value={motDePasseActuel}
                onChange={(e) => setMotDePasseActuel(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="nouveauMotDePasse" className="block text-sm font-medium text-slate-700">
                  Nouveau mot de passe
                </label>
                <PasswordInput
                  id="nouveauMotDePasse"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete="new-password"
                  value={nouveauMotDePasse}
                  onChange={(e) => setNouveauMotDePasse(e.target.value)}
                />
                <PasswordStrength motDePasse={nouveauMotDePasse} />
              </div>
              <Field label="Confirmer le nouveau mot de passe" htmlFor="confirmation" error={erreurConfirmation}>
                <PasswordInput
                  id="confirmation"
                  required
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </Field>
            </div>

            {erreurMdp && <Alert variant="danger">{erreurMdp}</Alert>}

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                loading={enCoursMdp}
                disabled={nouveauMotDePasse.length > 0 && scoreMotDePasse(nouveauMotDePasse) < 3}
              >
                <KeyRound className="size-4" aria-hidden />
                Changer le mot de passe
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
