import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarOff, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Dialog } from '../components/ui/Dialog';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import {
  LABEL_MOTIF,
  MOTIFS_ABSENCE,
  administrationApi,
  type Absence,
  type FiltrePeriode,
  type MotifAbsence,
  type StatutAbsence,
} from '../features/administration/administrationApi';
import type { Utilisateur } from '../types/auth';

// Gestion des absences des techniciens (§6.2). Un technicien absent aujourd'hui est
// EXCLU de l'affectation automatique, sans rien perdre d'autre : il garde son accès
// complet et ses tickets déjà assignés ne bougent pas. Mécanisme DISTINCT de la
// désactivation de compte, qui coupe la connexion et vise un départ, pas un congé.
//
// Page réservée à l'administrateur — c'est le SEUL endroit où le motif est affiché :
// MALADIE est une donnée de santé, et le tableau de bord (visible par tous les
// techniciens) n'en montre jamais que les dates.

const FILTRES: { valeur: FiltrePeriode; label: string }[] = [
  { valeur: 'EN_COURS', label: 'En cours' },
  { valeur: 'A_VENIR', label: 'À venir' },
  { valeur: 'PASSEES', label: 'Passées' },
  { valeur: 'TOUTES', label: 'Toutes' },
];

const STATUT_BADGE: Record<StatutAbsence, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  EN_COURS: { label: 'En cours', variant: 'warning' },
  A_VENIR: { label: 'À venir', variant: 'success' },
  PASSEE: { label: 'Passée', variant: 'neutral' },
};

// « 2026-08-20 » -> « 20/08/2026 ». Découpe de chaîne et non `new Date` : un jour seul
// serait interprété à minuit UTC et pourrait s'afficher la veille selon le fuseau.
function formaterJour(jour: string): string {
  const [a, m, j] = jour.split('-');
  return a && m && j ? `${j}/${m}/${a}` : jour;
}

const aujourdhui = () => new Date().toISOString().slice(0, 10);

interface Brouillon {
  technicienId: number | '';
  dateDebut: string;
  dateFin: string;
  motif: MotifAbsence;
  commentaire: string;
}

const BROUILLON_VIDE: Brouillon = {
  technicienId: '',
  dateDebut: aujourdhui(),
  dateFin: aujourdhui(),
  motif: 'CONGE',
  commentaire: '',
};

export function AbsencesPage() {
  const token = useAuthStore((state) => state.token);
  const toast = useToast();

  const [absences, setAbsences] = useState<Absence[]>([]);
  const [techniciens, setTechniciens] = useState<Utilisateur[]>([]);
  const [periode, setPeriode] = useState<FiltrePeriode>('TOUTES');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [enEdition, setEnEdition] = useState<Absence | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon>(BROUILLON_VIDE);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Absence | null>(null);

  const charger = useCallback(async () => {
    if (!token) return;
    setChargement(true);
    setErreur(null);
    try {
      const [listeAbsences, listeTechs] = await Promise.all([
        administrationApi.absences(periode, token),
        utilisateursApi.lister({ role: 'TECHNICIEN' }, token),
      ]);
      setAbsences(listeAbsences.absences);
      setTechniciens(listeTechs.utilisateurs);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Chargement impossible');
    } finally {
      setChargement(false);
    }
  }, [token, periode]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const nomTechnicien = useMemo(
    () => new Map(techniciens.map((t) => [t.id, `${t.prenom} ${t.nom}`])),
    [techniciens],
  );

  function ouvrirCreation() {
    setEnEdition(null);
    setBrouillon(BROUILLON_VIDE);
    setErreurFormulaire(null);
    setDialogOuvert(true);
  }

  function ouvrirEdition(absence: Absence) {
    setEnEdition(absence);
    setBrouillon({
      technicienId: absence.technicienId,
      dateDebut: absence.dateDebut,
      dateFin: absence.dateFin,
      motif: absence.motif,
      commentaire: absence.commentaire ?? '',
    });
    setErreurFormulaire(null);
    setDialogOuvert(true);
  }

  async function enregistrer() {
    if (!token) return;
    if (brouillon.technicienId === '') {
      setErreurFormulaire('Choisissez un technicien.');
      return;
    }
    setEnvoi(true);
    setErreurFormulaire(null);
    try {
      const commun = {
        dateDebut: brouillon.dateDebut,
        dateFin: brouillon.dateFin,
        motif: brouillon.motif,
        commentaire: brouillon.commentaire.trim() || undefined,
      };
      if (enEdition) {
        await administrationApi.modifierAbsence(enEdition.id, commun, token);
        toast.success('Absence mise à jour');
      } else {
        await administrationApi.creerAbsence({ technicienId: brouillon.technicienId, ...commun }, token);
        toast.success('Absence enregistrée');
      }
      setDialogOuvert(false);
      await charger();
    } catch (err) {
      // Le 409 de chevauchement arrive ici : le message du serveur cite les dates de
      // l'absence en conflit, il est affiché tel quel dans le formulaire.
      setErreurFormulaire(err instanceof ApiError ? err.message : 'Enregistrement impossible');
    } finally {
      setEnvoi(false);
    }
  }

  async function supprimer() {
    if (!token || !aSupprimer) return;
    try {
      await administrationApi.supprimerAbsence(aSupprimer.id, token);
      toast.success('Absence supprimée');
      setASupprimer(null);
      await charger();
    } catch (err) {
      toast.error('Suppression impossible', err instanceof ApiError ? err.message : 'Réessayez.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Absences"
        description="Congés, maladies et formations des techniciens. Un technicien absent est exclu de l'affectation automatique."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={charger} disabled={chargement}>
              <RefreshCw className="size-3.5" aria-hidden />
              Actualiser
            </Button>
            <Button size="sm" onClick={ouvrirCreation}>
              <Plus className="size-3.5" aria-hidden />
              Nouvelle absence
            </Button>
          </>
        }
      />

      {erreur && (
        <Alert variant="danger" className="mb-4">
          {erreur}
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par période">
        {FILTRES.map((f) => (
          <button
            key={f.valeur}
            type="button"
            onClick={() => setPeriode(f.valeur)}
            aria-pressed={periode === f.valeur}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              periode === f.valeur
                ? 'bg-primary-600 text-white'
                : 'bg-surface text-texte-4 ring-1 ring-bordure hover:bg-surface-2',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="animate-fade-up overflow-hidden">
        {chargement ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : absences.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="Aucune absence"
            description={
              periode === 'TOUTES'
                ? "Aucune absence n'a été enregistrée."
                : 'Aucune absence sur cette période.'
            }
          />
        ) : (
          <TableContainer>
            <Table>
              <thead>
                <tr>
                  <Th>Technicien</Th>
                  <Th>Période</Th>
                  <Th className="hidden sm:table-cell">Durée</Th>
                  <Th>Motif</Th>
                  <Th>Statut</Th>
                  <Th className="hidden lg:table-cell">Saisie par</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {absences.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-surface-2">
                    <Td className="font-medium text-texte-2">
                      {a.technicien.prenom} {a.technicien.nom}
                    </Td>
                    <Td className="tabular-nums text-texte-3">
                      {formaterJour(a.dateDebut)} → {formaterJour(a.dateFin)}
                    </Td>
                    <Td className="hidden tabular-nums text-texte-4 sm:table-cell">
                      {a.dureeJours} j
                    </Td>
                    <Td>
                      <span className="text-texte-3">{LABEL_MOTIF[a.motif]}</span>
                      {a.commentaire && (
                        <span className="block text-xs text-texte-4" title={a.commentaire}>
                          {a.commentaire}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge variant={STATUT_BADGE[a.statut].variant}>
                        {STATUT_BADGE[a.statut].label}
                      </Badge>
                    </Td>
                    <Td className="hidden text-texte-4 lg:table-cell">
                      {a.creePar.prenom} {a.creePar.nom}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => ouvrirEdition(a)}
                          aria-label={`Modifier l'absence de ${a.technicien.prenom} ${a.technicien.nom}`}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setASupprimer(a)}
                          aria-label={`Supprimer l'absence de ${a.technicien.prenom} ${a.technicien.nom}`}
                        >
                          <Trash2 className="size-3.5 text-rose-500" aria-hidden />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog
        open={dialogOuvert}
        onClose={() => setDialogOuvert(false)}
        title={enEdition ? 'Modifier une absence' : 'Nouvelle absence'}
        description={
          enEdition
            ? `${enEdition.technicien.prenom} ${enEdition.technicien.nom}`
            : 'Les dates sont incluses : une absence du 10 au 20 couvre le 20 en entier.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOuvert(false)} disabled={envoi}>
              Annuler
            </Button>
            <Button onClick={enregistrer} disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {erreurFormulaire && <Alert variant="danger">{erreurFormulaire}</Alert>}

          {!enEdition && (
            <div>
              <label htmlFor="abs-tech" className="mb-1 block text-xs font-medium text-texte-4">
                Technicien
              </label>
              <select
                id="abs-tech"
                value={brouillon.technicienId}
                onChange={(e) =>
                  setBrouillon((b) => ({ ...b, technicienId: e.target.value ? Number(e.target.value) : '' }))
                }
                className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte-2 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-marque-fond-2"
              >
                <option value="">Choisir…</option>
                {techniciens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {nomTechnicien.get(t.id)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="abs-debut" className="mb-1 block text-xs font-medium text-texte-4">
                Du
              </label>
              <Input
                id="abs-debut"
                type="date"
                value={brouillon.dateDebut}
                onChange={(e) => setBrouillon((b) => ({ ...b, dateDebut: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="abs-fin" className="mb-1 block text-xs font-medium text-texte-4">
                Au (inclus)
              </label>
              <Input
                id="abs-fin"
                type="date"
                value={brouillon.dateFin}
                onChange={(e) => setBrouillon((b) => ({ ...b, dateFin: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="abs-motif" className="mb-1 block text-xs font-medium text-texte-4">
              Motif
            </label>
            <select
              id="abs-motif"
              value={brouillon.motif}
              onChange={(e) => setBrouillon((b) => ({ ...b, motif: e.target.value as MotifAbsence }))}
              className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte-2 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-marque-fond-2"
            >
              {MOTIFS_ABSENCE.map((m) => (
                <option key={m} value={m}>
                  {LABEL_MOTIF[m]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="abs-commentaire" className="mb-1 block text-xs font-medium text-texte-4">
              Commentaire (facultatif)
            </label>
            <Input
              id="abs-commentaire"
              value={brouillon.commentaire}
              onChange={(e) => setBrouillon((b) => ({ ...b, commentaire: e.target.value }))}
              placeholder="Congé parental, formation Kubernetes…"
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        open={aSupprimer !== null}
        onClose={() => setASupprimer(null)}
        title="Supprimer cette absence ?"
        description={
          aSupprimer
            ? `${aSupprimer.technicien.prenom} ${aSupprimer.technicien.nom}, du ${formaterJour(aSupprimer.dateDebut)} au ${formaterJour(aSupprimer.dateFin)}.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setASupprimer(null)}>
              Annuler
            </Button>
            <Button onClick={supprimer}>Supprimer</Button>
          </>
        }
      >
        <p className="text-sm text-texte-4">
          Le technicien redeviendra immédiatement candidat à l'affectation automatique s'il n'a pas
          d'autre absence en cours.
        </p>
      </Dialog>
    </div>
  );
}
