import { useEffect, useMemo, useState, type SubmitEvent } from 'react';
import { RefreshCw, Search, Send, UserPlus, Users } from 'lucide-react';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import { ticketsApi } from '../features/tickets/ticketsApi';
import { administrationApi } from '../features/administration/administrationApi';
import type { Categorie } from '../types/ticket';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { LABELS_ROLE, tempsRelatif } from '../lib/format';
import type { FiltresUtilisateurs, Role, StatutCompte, Utilisateur } from '../types/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { Field, Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';

const ROLES: Role[] = ['EMPLOYE', 'TECHNICIEN', 'ADMINISTRATEUR'];

const BADGE_STATUT: Record<StatutCompte, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  ACTIF: { label: 'Actif', variant: 'success' },
  EN_ATTENTE: { label: 'En attente', variant: 'warning' },
  DESACTIVE: { label: 'Désactivé', variant: 'neutral' },
};

export function UsersManagementPage() {
  const token = useAuthStore((state) => state.token);
  const utilisateurConnecte = useAuthStore((state) => state.utilisateur);
  const toast = useToast();

  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtreRole, setFiltreRole] = useState<Role | ''>('');
  const [recherche, setRecherche] = useState('');
  const [enCoursId, setEnCoursId] = useState<number | null>(null);
  // Utilisateur en attente de confirmation de désactivation.
  const [aDesactiver, setADesactiver] = useState<Utilisateur | null>(null);

  // Spécialités (§6.2) : catégories couvertes par un technicien. Le dialog édite un
  // brouillon local, envoyé en une fois — le serveur REMPLACE la liste complète.
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [specialitesDe, setSpecialitesDe] = useState<Utilisateur | null>(null);
  const [brouillonSpecialites, setBrouillonSpecialites] = useState<number[]>([]);
  const [envoiSpecialites, setEnvoiSpecialites] = useState(false);

  // Formulaire d'invitation (dialog).
  const [invitationOuverte, setInvitationOuverte] = useState(false);
  const [invPrenom, setInvPrenom] = useState('');
  const [invNom, setInvNom] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invService, setInvService] = useState('');
  const [invPoste, setInvPoste] = useState('');
  const [invRole, setInvRole] = useState<Role>('TECHNICIEN');
  const [invErreur, setInvErreur] = useState<string | null>(null);
  const [invErreursChamps, setInvErreursChamps] = useState<Record<string, string | undefined>>({});
  const [invEnCours, setInvEnCours] = useState(false);

  function reinitialiserFormulaireInvitation() {
    setInvPrenom('');
    setInvNom('');
    setInvEmail('');
    setInvService('');
    setInvPoste('');
    setInvRole('TECHNICIEN');
    setInvErreur(null);
    setInvErreursChamps({});
  }

  async function handleInviter(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setInvErreur(null);
    setInvErreursChamps({});
    setInvEnCours(true);
    try {
      const { utilisateur } = await utilisateursApi.inviter(
        {
          prenom: invPrenom,
          nom: invNom,
          email: invEmail,
          service: invService || undefined,
          poste: invPoste || undefined,
          role: invRole,
        },
        token,
      );
      setUtilisateurs((liste) => [utilisateur, ...liste]);
      setInvitationOuverte(false);
      reinitialiserFormulaireInvitation();
      toast.success('Invitation envoyée', `${utilisateur.prenom} recevra un e-mail pour activer son compte (valable 72 h).`);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setInvErreursChamps({
          prenom: err.champ('prenom'),
          nom: err.champ('nom'),
          email: err.champ('email'),
          service: err.champ('service'),
          poste: err.champ('poste'),
        });
      } else {
        setInvErreur(err instanceof ApiError ? err.message : "Impossible d'envoyer l'invitation");
      }
    } finally {
      setInvEnCours(false);
    }
  }

  async function handleRenvoyerInvitation(cible: Utilisateur) {
    if (!token) return;
    setEnCoursId(cible.id);
    setErreur(null);
    try {
      await utilisateursApi.renvoyerInvitation(cible.id, token);
      toast.success('Invitation renvoyée', `Un nouveau lien (72 h) a été envoyé à ${cible.email}. L'ancien lien est invalidé.`);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de renvoyer l'invitation");
    } finally {
      setEnCoursId(null);
    }
  }

  async function chargerUtilisateurs() {
    if (!token) return;
    setChargement(true);
    setErreur(null);
    try {
      const filtres: FiltresUtilisateurs = { role: filtreRole || undefined };
      const [{ utilisateurs: liste }, { categories: cats }] = await Promise.all([
        utilisateursApi.lister(filtres, token),
        ticketsApi.listerCategories(token),
      ]);
      setUtilisateurs(liste);
      setCategories(cats);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les utilisateurs');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerUtilisateurs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtreRole, token]);

  // Recherche instantanée côté client (nom, prénom, e-mail, service).
  const nomCategorie = useMemo(
    () => new Map(categories.map((c) => [c.id, c.nom])),
    [categories],
  );

  function ouvrirSpecialites(u: Utilisateur) {
    setSpecialitesDe(u);
    setBrouillonSpecialites(u.specialites ?? []);
  }

  function basculerSpecialite(categorieId: number) {
    setBrouillonSpecialites((actuelles) =>
      actuelles.includes(categorieId)
        ? actuelles.filter((id) => id !== categorieId)
        : [...actuelles, categorieId],
    );
  }

  async function enregistrerSpecialites() {
    if (!token || !specialitesDe) return;
    setEnvoiSpecialites(true);
    try {
      await administrationApi.definirSpecialites(specialitesDe.id, brouillonSpecialites, token);
      toast.success(
        'Spécialités enregistrées',
        brouillonSpecialites.length === 0
          ? 'Ce technicien ne recevra que des affectations de repli.'
          : `${brouillonSpecialites.length} catégorie(s) couverte(s).`,
      );
      setSpecialitesDe(null);
      await chargerUtilisateurs();
    } catch (err) {
      toast.error('Enregistrement impossible', err instanceof ApiError ? err.message : 'Réessayez.');
    } finally {
      setEnvoiSpecialites(false);
    }
  }

  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return utilisateurs;
    return utilisateurs.filter((u) =>
      `${u.prenom} ${u.nom} ${u.email} ${u.service ?? ''}`.toLowerCase().includes(q),
    );
  }, [utilisateurs, recherche]);

  async function handleChangerRole(id: number, role: Role) {
    if (!token) return;
    setEnCoursId(id);
    setErreur(null);
    try {
      const { utilisateur } = await utilisateursApi.changerRole(id, role, token);
      setUtilisateurs((liste) => liste.map((u) => (u.id === id ? utilisateur : u)));
      toast.success(
        'Rôle mis à jour',
        `${utilisateur.prenom} ${utilisateur.nom} est désormais ${LABELS_ROLE[utilisateur.role]}.`,
      );
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de changer le rôle');
    } finally {
      setEnCoursId(null);
    }
  }

  async function handleChangerStatut(cible: Utilisateur, actif: boolean) {
    if (!token) return;
    setEnCoursId(cible.id);
    setErreur(null);
    try {
      const { utilisateur } = await utilisateursApi.changerStatutActif(cible.id, actif, token);
      setUtilisateurs((liste) => liste.map((u) => (u.id === cible.id ? utilisateur : u)));
      toast.success(
        actif ? 'Compte réactivé' : 'Compte désactivé',
        `${utilisateur.prenom} ${utilisateur.nom} ${actif ? 'peut de nouveau se connecter' : 'ne peut plus se connecter'}.`,
      );
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de changer le statut');
    } finally {
      setEnCoursId(null);
      setADesactiver(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Gestion des utilisateurs"
        description="Rôles, statuts et comptes de la plateforme."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={chargerUtilisateurs} disabled={chargement}>
              <RefreshCw className="size-3.5" aria-hidden />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => setInvitationOuverte(true)}>
              <UserPlus className="size-3.5" aria-hidden />
              Inviter un utilisateur
            </Button>
          </>
        }
      />

      {/* Barre d'outils : recherche + filtres (collante au défilement) */}
      <div className="sticky top-14 z-20 -mx-4 mb-4 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par nom, e-mail, service…"
              aria-label="Rechercher un utilisateur"
              className="pl-9"
            />
          </div>
          <Select
            value={filtreRole}
            onChange={(e) => setFiltreRole(e.target.value as Role | '')}
            aria-label="Filtrer par rôle"
            className="w-44"
          >
            <option value="">Tous les rôles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {LABELS_ROLE[role]}
              </option>
            ))}
          </Select>
          <p className="ml-auto text-xs tabular-nums text-slate-400">
            {chargement ? '…' : `${resultats.length} ${resultats.length > 1 ? 'comptes' : 'compte'}`}
          </p>
        </div>
      </div>

      {erreur && (
        <Alert variant="danger" className="mb-4">
          {erreur}
        </Alert>
      )}

      <TableContainer className="max-h-[calc(100dvh-16rem)]">
        <Table>
          <thead>
            <tr>
              <Th>Utilisateur</Th>
              <Th className="hidden md:table-cell">Service</Th>
              <Th>Rôle</Th>
              <Th>Statut</Th>
              <Th className="hidden xl:table-cell">Spécialités</Th>
              <Th className="hidden lg:table-cell">Créé</Th>
              <Th className="w-28 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {chargement &&
              ['sq1', 'sq2', 'sq3', 'sq4', 'sq5'].map((cle) => (
                <tr key={cle}>
                  <Td colSpan={7}>
                    <Skeleton className="h-9" />
                  </Td>
                </tr>
              ))}

            {!chargement && resultats.length === 0 && (
              <tr>
                <Td colSpan={7} className="p-0">
                  <EmptyState
                    icon={Users}
                    title="Aucun utilisateur trouvé"
                    description="Essayez de modifier votre recherche ou vos filtres."
                  />
                </Td>
              </tr>
            )}

            {!chargement &&
              resultats.map((u) => {
                const estSoiMeme = u.id === utilisateurConnecte?.id;
                return (
                  <tr key={u.id} className="transition-colors hover:bg-slate-50/60">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar prenom={u.prenom} nom={u.nom} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                            <span className="truncate">
                              {u.prenom} {u.nom}
                            </span>
                            {estSoiMeme && <span className="text-xs font-normal text-slate-400">(vous)</span>}
                            {/* Rappel en lecture seule : l'administrateur qui regarde les
                                comptes ne doit pas ignorer qu'un technicien est absent.
                                Dates uniquement — le motif n'appartient qu'a la page Absences. */}
                            {u.absenceJusquau && (
                              <Badge variant="warning" title={`Absent jusqu'au ${u.absenceJusquau}`}>
                                Absent
                              </Badge>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden text-slate-500 md:table-cell">{u.service ?? '—'}</Td>
                    <Td>
                      <Select
                        value={u.role}
                        disabled={estSoiMeme || enCoursId === u.id}
                        onChange={(e) => handleChangerRole(u.id, e.target.value as Role)}
                        aria-label={`Rôle de ${u.prenom} ${u.nom}`}
                        className="w-40"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {LABELS_ROLE[role]}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <Badge variant={BADGE_STATUT[u.statutCompte].variant} dot>
                        {BADGE_STATUT[u.statutCompte].label}
                      </Badge>
                    </Td>
                    <Td className="hidden xl:table-cell">
                      {u.role === 'TECHNICIEN' ? (
                        <button
                          type="button"
                          onClick={() => ouvrirSpecialites(u)}
                          className="rounded-lg px-2 py-1 text-left text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Modifier les spécialités de ${u.prenom} ${u.nom}`}
                        >
                          {u.specialites && u.specialites.length > 0
                            ? u.specialites.map((id) => nomCategorie.get(id) ?? '?').join(', ')
                            : 'Aucune — définir'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </Td>
                    <Td className="hidden text-xs text-slate-400 lg:table-cell">
                      {tempsRelatif(u.dateCreation)}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {u.statutCompte === 'EN_ATTENTE' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={enCoursId === u.id}
                            onClick={() => handleRenvoyerInvitation(u)}
                            title="Renvoyer l'e-mail d'invitation (nouveau lien 72 h)"
                          >
                            <Send className="size-3.5" aria-hidden />
                            Renvoyer
                          </Button>
                        )}
                        <Button
                          variant={u.actif ? 'ghost' : 'secondary'}
                          size="sm"
                          disabled={estSoiMeme || enCoursId === u.id}
                          loading={enCoursId === u.id}
                          onClick={() => (u.actif ? setADesactiver(u) : handleChangerStatut(u, true))}
                        >
                          {u.actif ? 'Désactiver' : 'Réactiver'}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
          </tbody>
        </Table>
      </TableContainer>

      {/* Invitation d'un collaborateur : le compte est créé sans mot de passe,
          l'invité le choisit lui-même via un lien e-mail valable 72 h. */}
      <Dialog
        open={invitationOuverte}
        onClose={() => setInvitationOuverte(false)}
        title="Inviter un utilisateur"
        description="Un e-mail d'invitation lui sera envoyé — il choisira lui-même son mot de passe. Aucun secret à transmettre."
      >
        <form onSubmit={handleInviter} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" htmlFor="inv-prenom" error={invErreursChamps.prenom}>
              <Input
                id="inv-prenom"
                required
                autoFocus
                maxLength={100}
                value={invPrenom}
                onChange={(e) => setInvPrenom(e.target.value)}
              />
            </Field>
            <Field label="Nom" htmlFor="inv-nom" error={invErreursChamps.nom}>
              <Input
                id="inv-nom"
                required
                maxLength={100}
                value={invNom}
                onChange={(e) => setInvNom(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Email" htmlFor="inv-email" error={invErreursChamps.email}>
            <Input
              id="inv-email"
              type="email"
              required
              maxLength={254}
              value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
              placeholder="prenom.nom@metavoria.tn"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Service" htmlFor="inv-service" error={invErreursChamps.service}>
              <Input
                id="inv-service"
                maxLength={100}
                value={invService}
                onChange={(e) => setInvService(e.target.value)}
                placeholder="Ex. Support IT"
              />
            </Field>
            <Field label="Poste" htmlFor="inv-poste" error={invErreursChamps.poste}>
              <Input
                id="inv-poste"
                maxLength={100}
                value={invPoste}
                onChange={(e) => setInvPoste(e.target.value)}
                placeholder="Ex. Technicien N1"
              />
            </Field>
          </div>

          <Field label="Rôle" htmlFor="inv-role">
            <Select id="inv-role" value={invRole} onChange={(e) => setInvRole(e.target.value as Role)}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {LABELS_ROLE[role]}
                </option>
              ))}
            </Select>
          </Field>

          {invErreur && <Alert variant="danger">{invErreur}</Alert>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setInvitationOuverte(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={invEnCours}>
              <Send className="size-3.5" aria-hidden />
              Envoyer l'invitation
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Confirmation avant désactivation (action à impact) */}
      <Dialog
        open={aDesactiver !== null}
        onClose={() => setADesactiver(null)}
        title="Désactiver ce compte ?"
        description={
          aDesactiver
            ? `${aDesactiver.prenom} ${aDesactiver.nom} ne pourra plus se connecter à la plateforme. Son historique est conservé et le compte peut être réactivé à tout moment.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setADesactiver(null)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={enCoursId === aDesactiver?.id}
              onClick={() => aDesactiver && handleChangerStatut(aDesactiver, false)}
            >
              Désactiver le compte
            </Button>
          </>
        }
      />

      {/* Spécialités d'un technicien (§6.2) : quelles catégories il couvre. La liste
          envoyée REMPLACE l'existante — l'interface transmet l'état complet des cases,
          jamais un delta. Un ensemble vide est valide : le technicien reste candidat aux
          affectations de repli, il n'est simplement prioritaire sur aucune catégorie. */}
      <Dialog
        open={specialitesDe !== null}
        onClose={() => setSpecialitesDe(null)}
        title="Spécialités"
        description={
          specialitesDe
            ? `${specialitesDe.prenom} ${specialitesDe.nom} — catégories de tickets qu'il traite en priorité.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setSpecialitesDe(null)} disabled={envoiSpecialites}>
              Annuler
            </Button>
            <Button onClick={enregistrerSpecialites} loading={envoiSpecialites}>
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {categories.map((categorie) => {
            const coche = brouillonSpecialites.includes(categorie.id);
            return (
              <label
                key={categorie.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={coche}
                  onChange={() => basculerSpecialite(categorie.id)}
                  className="size-4 rounded border-slate-300 text-primary-600 focus:ring-primary-400"
                />
                <span className="text-sm font-medium text-slate-700">{categorie.nom}</span>
              </label>
            );
          })}
          <p className="pt-1 text-xs text-slate-400">
            Sans spécialité, ce technicien ne recevra que des affectations de repli (quand aucun
            spécialiste n'est disponible).
          </p>
        </div>
      </Dialog>
    </div>
  );
}
