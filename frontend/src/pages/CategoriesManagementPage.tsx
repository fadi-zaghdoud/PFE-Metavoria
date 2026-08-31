import { useEffect, useState, type SubmitEvent } from 'react';
import { Link } from 'react-router-dom';
import { Brain, FolderTree, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { categoriesApi } from '../features/categories/categoriesApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { tempsRelatif } from '../lib/format';
import type { CategorieAdmin, StatutCategorie } from '../types/ticket';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { Field, Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Dialog } from '../components/ui/Dialog';
import { useToast } from '../components/ui/Toast';

// Rendu du statut du cycle de vie. Les libellés disent ce que l'IA SAIT FAIRE, pas un état
// interne : l'admin doit comprendre d'un coup d'œil si l'IA classera dans cette catégorie.
const BADGE_STATUT: Record<StatutCategorie, { label: string; variant: BadgeVariant; aide: string }> = {
  ACTIVE: {
    label: 'Active',
    variant: 'success',
    aide: "Reconnue par l'IA : elle peut être suggérée automatiquement.",
  },
  APPRENABLE: {
    label: 'Apprenable',
    variant: 'warning',
    aide: "Assez d'exemples validés — réentraînez le modèle pour qu'il l'apprenne.",
  },
  EN_APPRENTISSAGE: {
    label: 'En apprentissage',
    variant: 'info',
    aide: "Pas encore reconnue par l'IA : les techniciens doivent l'utiliser pour créer des exemples.",
  },
  INDETERMINE: {
    label: 'Indéterminé',
    variant: 'neutral',
    aide: 'Service IA indisponible — statut inconnu.',
  },
};

export function CategoriesManagementPage() {
  const token = useAuthStore((state) => state.token);
  const toast = useToast();

  const [categories, setCategories] = useState<CategorieAdmin[]>([]);
  const [modeleDisponible, setModeleDisponible] = useState(true);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCoursId, setEnCoursId] = useState<number | null>(null);

  // Dialogue de création.
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [nouvNom, setNouvNom] = useState('');
  const [nouvDescription, setNouvDescription] = useState('');
  const [creationErreur, setCreationErreur] = useState<string | null>(null);
  const [creationErreursChamps, setCreationErreursChamps] = useState<Record<string, string | undefined>>({});
  const [creationEnCours, setCreationEnCours] = useState(false);

  // Dialogue d'édition (nom + description).
  const [aEditer, setAEditer] = useState<CategorieAdmin | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editErreur, setEditErreur] = useState<string | null>(null);
  const [editEnCours, setEditEnCours] = useState(false);

  // Confirmation de suppression (action irréversible).
  const [aSupprimer, setASupprimer] = useState<CategorieAdmin | null>(null);
  const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null);

  async function charger() {
    if (!token) return;
    setChargement(true);
    setErreur(null);
    try {
      const data = await categoriesApi.listerAdministration(token);
      setCategories(data.categories);
      setModeleDisponible(data.modeleDisponible);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les catégories');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreer(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setCreationErreur(null);
    setCreationErreursChamps({});
    setCreationEnCours(true);
    try {
      const { categorie } = await categoriesApi.creer(
        { nom: nouvNom, description: nouvDescription || undefined },
        token,
      );
      setCategories((liste) => [...liste, categorie].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')));
      setCreationOuverte(false);
      setNouvNom('');
      setNouvDescription('');
      toast.success(
        'Catégorie créée',
        `« ${categorie.nom} » n'est pas encore reconnue par l'IA : elle le sera après un réentraînement.`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setCreationErreursChamps({ nom: err.champ('nom'), description: err.champ('description') });
      } else {
        setCreationErreur(err instanceof ApiError ? err.message : 'Impossible de créer la catégorie');
      }
    } finally {
      setCreationEnCours(false);
    }
  }

  function ouvrirEdition(categorie: CategorieAdmin) {
    setAEditer(categorie);
    setEditNom(categorie.nom);
    setEditDescription(categorie.description ?? '');
    setEditErreur(null);
  }

  async function handleEditer(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !aEditer) return;
    setEditErreur(null);
    setEditEnCours(true);
    try {
      const payload: { nom?: string; description?: string } = {};
      if (editNom !== aEditer.nom) payload.nom = editNom;
      if (editDescription !== (aEditer.description ?? '')) payload.description = editDescription;
      if (Object.keys(payload).length === 0) {
        setAEditer(null);
        return;
      }
      const { categorie } = await categoriesApi.mettreAJour(aEditer.id, payload, token);
      setCategories((liste) =>
        liste
          .map((c) => (c.id === categorie.id ? { ...c, nom: categorie.nom, description: categorie.description } : c))
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      );
      setAEditer(null);
      toast.success('Catégorie mise à jour', `« ${categorie.nom} » a été enregistrée.`);
    } catch (err) {
      setEditErreur(err instanceof ApiError ? err.message : 'Impossible de modifier la catégorie');
    } finally {
      setEditEnCours(false);
    }
  }

  async function handleSupprimer() {
    if (!token || !aSupprimer) return;
    setEnCoursId(aSupprimer.id);
    setSuppressionErreur(null);
    try {
      await categoriesApi.supprimer(aSupprimer.id, token);
      setCategories((liste) => liste.filter((c) => c.id !== aSupprimer.id));
      toast.success('Catégorie supprimée', `« ${aSupprimer.nom} » a été retirée.`);
      setASupprimer(null);
    } catch (err) {
      // Les refus métier (409 tickets/active, 503 IA indéterminée) s'affichent DANS le dialogue :
      // le message explique pourquoi et reste sous les yeux de l'admin.
      setSuppressionErreur(err instanceof ApiError ? err.message : 'Impossible de supprimer la catégorie');
    } finally {
      setEnCoursId(null);
    }
  }

  const aDesNonReconnues = categories.some(
    (c) => c.statut === 'APPRENABLE' || c.statut === 'EN_APPRENTISSAGE',
  );
  const nbApprenables = categories.filter((c) => c.statut === 'APPRENABLE').length;

  return (
    <div>
      <PageHeader
        title="Gestion des catégories"
        description="Catégories de tickets et leur reconnaissance par le module IA."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={charger} disabled={chargement}>
              <RefreshCw className="size-3.5" aria-hidden />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => setCreationOuverte(true)}>
              <Plus className="size-3.5" aria-hidden />
              Nouvelle catégorie
            </Button>
          </>
        }
      />

      {/* Service IA injoignable : les statuts sont inconnus et le serveur bloque les actions
          risquées (renommage / suppression) — on le dit AVANT que l'admin ne s'y heurte. */}
      {!modeleDisponible && !chargement && (
        <Alert variant="warning" className="mb-4">
          <p className="font-medium">Statut IA indisponible</p>
          <p className="mt-0.5 text-amber-700/90">
            Le service IA est injoignable : la reconnaissance des catégories ne peut pas être vérifiée. La
            création et l'édition des descriptions restent possibles ; le renommage et la suppression sont
            bloqués par sécurité.
          </p>
        </Alert>
      )}

      {/* Cycle de vie : une catégorie récente n'est pas connue du modèle tant qu'il n'a pas été
          réentraîné. Le message explique la marche à suivre plutôt que d'afficher un simple état. */}
      {modeleDisponible && aDesNonReconnues && !chargement && (
        <Alert variant="info" className="mb-4">
          <p className="font-medium">Certaines catégories ne sont pas encore reconnues par l'IA</p>
          <p className="mt-0.5 text-sky-800/90">
            L'IA ne peut suggérer que les catégories qu'elle a apprises. Les autres restent utilisables
            manuellement : chaque ticket que les techniciens y classent devient un exemple.{' '}
            {nbApprenables > 0
              ? `${nbApprenables} catégorie${nbApprenables > 1 ? 's ont' : ' a'} assez d'exemples — vous pouvez réentraîner le modèle.`
              : "Dès qu'une catégorie aura assez d'exemples, elle passera « apprenable »."}
          </p>
          <Link
            to="/administration/ia"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-sky-900 underline underline-offset-2 hover:text-sky-950"
          >
            <Brain className="size-3.5" aria-hidden />
            Aller au réentraînement du modèle
          </Link>
        </Alert>
      )}

      {erreur && (
        <Alert variant="danger" className="mb-4">
          {erreur}
        </Alert>
      )}

      <TableContainer className="max-h-[calc(100dvh-16rem)]">
        <Table>
          <thead>
            <tr>
              <Th>Catégorie</Th>
              <Th>Statut IA</Th>
              <Th className="hidden md:table-cell">Exemples validés</Th>
              <Th className="hidden lg:table-cell">Créée</Th>
              <Th className="w-28 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {chargement &&
              ['sq1', 'sq2', 'sq3', 'sq4', 'sq5'].map((cle) => (
                <tr key={cle}>
                  <Td colSpan={5}>
                    <Skeleton className="h-9" />
                  </Td>
                </tr>
              ))}

            {!chargement && categories.length === 0 && (
              <tr>
                <Td colSpan={5} className="p-0">
                  <EmptyState
                    icon={FolderTree}
                    title="Aucune catégorie"
                    description="Créez une première catégorie pour classer les tickets."
                  />
                </Td>
              </tr>
            )}

            {!chargement &&
              categories.map((c) => {
                const badge = BADGE_STATUT[c.statut];
                return (
                  <tr key={c.id} className="transition-colors hover:bg-slate-50/60">
                    <Td>
                      <p className="font-medium text-slate-900">{c.nom}</p>
                      {c.description && (
                        <p className="mt-0.5 max-w-md truncate text-xs text-slate-400">{c.description}</p>
                      )}
                    </Td>
                    <Td>
                      <Badge variant={badge.variant} dot title={badge.aide}>
                        {badge.label}
                      </Badge>
                    </Td>
                    <Td className="hidden tabular-nums text-slate-500 md:table-cell">{c.nLabelsValides}</Td>
                    <Td className="hidden text-xs text-slate-400 lg:table-cell">
                      {tempsRelatif(c.dateCreation)}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => ouvrirEdition(c)}
                          title="Modifier le nom ou la description"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          <span className="sr-only">Modifier {c.nom}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={enCoursId === c.id}
                          onClick={() => {
                            setSuppressionErreur(null);
                            setASupprimer(c);
                          }}
                          title="Supprimer cette catégorie"
                        >
                          <Trash2 className="size-3.5 text-rose-500" aria-hidden />
                          <span className="sr-only">Supprimer {c.nom}</span>
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
          </tbody>
        </Table>
      </TableContainer>

      {/* Création — on annonce d'emblée le cycle de vie pour éviter la surprise
          « pourquoi l'IA ne la propose pas ? ». */}
      <Dialog
        open={creationOuverte}
        onClose={() => setCreationOuverte(false)}
        title="Nouvelle catégorie"
        description="Elle sera immédiatement utilisable manuellement. L'IA ne la suggérera qu'après un réentraînement du modèle."
      >
        <form onSubmit={handleCreer} className="space-y-4">
          <Field label="Nom" htmlFor="cat-nom" error={creationErreursChamps.nom}>
            <Input
              id="cat-nom"
              required
              autoFocus
              maxLength={50}
              value={nouvNom}
              onChange={(e) => setNouvNom(e.target.value)}
              placeholder="Ex. Sécurité"
            />
          </Field>
          <Field label="Description" htmlFor="cat-description" error={creationErreursChamps.description}>
            <Input
              id="cat-description"
              maxLength={200}
              value={nouvDescription}
              onChange={(e) => setNouvDescription(e.target.value)}
              placeholder="Ex. Incidents de sécurité, phishing, antivirus."
            />
          </Field>

          {creationErreur && <Alert variant="danger">{creationErreur}</Alert>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreationOuverte(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={creationEnCours}>
              <Plus className="size-3.5" aria-hidden />
              Créer la catégorie
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Édition — renommer une catégorie ACTIVE est refusé côté serveur (le modèle la désigne
          par son nom) ; on prévient ici plutôt que de laisser l'admin buter sur un 409. */}
      <Dialog
        open={aEditer !== null}
        onClose={() => setAEditer(null)}
        title="Modifier la catégorie"
        description={
          aEditer?.statut === 'ACTIVE'
            ? "Cette catégorie est reconnue par l'IA : son nom ne peut pas être modifié (le modèle l'identifie par ce nom). La description reste modifiable."
            : undefined
        }
      >
        <form onSubmit={handleEditer} className="space-y-4">
          <Field label="Nom" htmlFor="edit-nom">
            <Input
              id="edit-nom"
              required
              maxLength={50}
              value={editNom}
              disabled={aEditer?.statut === 'ACTIVE'}
              onChange={(e) => setEditNom(e.target.value)}
            />
          </Field>
          <Field label="Description" htmlFor="edit-description">
            <Input
              id="edit-description"
              maxLength={200}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </Field>

          {editErreur && <Alert variant="danger">{editErreur}</Alert>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAEditer(null)}>
              Annuler
            </Button>
            <Button type="submit" loading={editEnCours}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Suppression — confirmation explicite ; le serveur refuse si la catégorie est utilisée
          par des tickets ou reconnue par l'IA (le refus s'affiche dans ce dialogue). */}
      <Dialog
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        title="Supprimer cette catégorie ?"
        description={
          aSupprimer
            ? `« ${aSupprimer.nom} » sera définitivement retirée. La suppression est refusée si des tickets l'utilisent ou si l'IA la reconnaît encore.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setASupprimer(null)}>
              Annuler
            </Button>
            <Button variant="danger" loading={enCoursId === aSupprimer?.id} onClick={handleSupprimer}>
              <Trash2 className="size-3.5" aria-hidden />
              Supprimer
            </Button>
          </>
        }
      >
        {suppressionErreur && <Alert variant="danger">{suppressionErreur}</Alert>}
      </Dialog>
    </div>
  );
}
