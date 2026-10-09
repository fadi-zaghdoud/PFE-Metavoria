import { useRef, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { Camera, KeyRound, Loader2, Mail } from 'lucide-react';
import { authApi } from '../features/auth/authApi';
import { ACCEPT_PHOTO, FORMATS_PHOTO_LABEL, validerPhoto } from '../features/auth/photoProfil';
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

  const inputPhoto = useRef<HTMLInputElement>(null);
  const [enCoursPhoto, setEnCoursPhoto] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);

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

  async function handleChoisirPhoto(event: ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];
    // Remis à vide immédiatement : sans ça, re-choisir LE MÊME fichier après une erreur
    // ne déclencherait aucun événement (la valeur de l'input n'aurait pas changé).
    event.target.value = '';
    if (!fichier) return;

    const probleme = validerPhoto(fichier);
    if (probleme) {
      setErreurPhoto(probleme);
      return;
    }

    setErreurPhoto(null);
    setEnCoursPhoto(true);
    try {
      const { utilisateur: miseAJour } = await authApi.televerserPhoto(fichier, token!);
      // Le store alimente aussi le sidebar : la nouvelle photo y apparaît sans rechargement.
      mettreAJourUtilisateur(miseAJour);
      toast.success('Photo mise à jour', 'Votre nouvelle photo de profil est enregistrée.');
    } catch (err) {
      setErreurPhoto(err instanceof ApiError ? err.message : "Impossible d'envoyer la photo");
    } finally {
      setEnCoursPhoto(false);
    }
  }

  async function handleRetirerPhoto() {
    setErreurPhoto(null);
    setEnCoursPhoto(true);
    try {
      const { utilisateur: miseAJour } = await authApi.supprimerPhoto(token!);
      mettreAJourUtilisateur(miseAJour);
      toast.success('Photo retirée', 'Vos initiales sont de nouveau affichées.');
    } catch (err) {
      setErreurPhoto(err instanceof ApiError ? err.message : 'Impossible de retirer la photo');
    } finally {
      setEnCoursPhoto(false);
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
      <Card className="mb-6 overflow-hidden bg-gradient-to-br from-surface to-marque-fond/50">
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="relative shrink-0">
            <Avatar
              prenom={utilisateur.prenom}
              nom={utilisateur.nom}
              photoUrl={utilisateur.photoUrl}
              size="lg"
              className="ring-2 ring-surface shadow-sm"
            />
            {enCoursPhoto && (
              <span
                className="absolute inset-0 flex items-center justify-center rounded-full bg-encre/45"
                aria-hidden
              >
                <Loader2 className="size-5 animate-spin text-white" />
              </span>
            )}
            <button
              type="button"
              onClick={() => inputPhoto.current?.click()}
              disabled={enCoursPhoto}
              aria-label={utilisateur.photoUrl ? 'Changer la photo de profil' : 'Ajouter une photo de profil'}
              title={`${utilisateur.photoUrl ? 'Changer' : 'Ajouter'} une photo (${FORMATS_PHOTO_LABEL}, 2 Mo maximum)`}
              className="absolute -bottom-0.5 -right-0.5 rounded-full bg-surface p-1.5 text-texte-4 shadow-sm ring-1 ring-bordure transition-colors hover:text-marque disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Camera className="size-3.5" aria-hidden />
            </button>
            <input
              ref={inputPhoto}
              type="file"
              accept={ACCEPT_PHOTO}
              className="hidden"
              onChange={handleChoisirPhoto}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-texte">
                {utilisateur.prenom} {utilisateur.nom}
              </h2>
              <Badge variant={utilisateur.role === 'ADMINISTRATEUR' ? 'primary' : 'neutral'}>
                {LABELS_ROLE[utilisateur.role]}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-texte-4">
              <Mail className="size-3.5" aria-hidden />
              {utilisateur.email}
            </p>
            {utilisateur.photoUrl && (
              <button
                type="button"
                onClick={handleRetirerPhoto}
                disabled={enCoursPhoto}
                className="mt-1.5 text-xs font-medium text-texte-4 underline-offset-2 transition-colors hover:text-danger-texte hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Retirer la photo
              </button>
            )}
          </div>
          <p className="text-xs text-texte-4">Membre depuis {tempsRelatif(utilisateur.dateCreation)}</p>
          {erreurPhoto && (
            <div className="w-full">
              <Alert variant="danger">{erreurPhoto}</Alert>
            </div>
          )}
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
                <label htmlFor="nouveauMotDePasse" className="block text-sm font-medium text-texte-2">
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
