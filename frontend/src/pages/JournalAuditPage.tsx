import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, History, Info, RefreshCw, ScrollText } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import {
  LABEL_ACTION,
  LABEL_CIBLE,
  auditApi,
  type EntreeAudit,
  type FiltresAudit,
  type ResultatAudit,
} from '../features/administration/auditApi';
import { PanneauAudit } from '../features/administration/PanneauAudit';
import { ticketsApi } from '../features/tickets/ticketsApi';
import type { Utilisateur } from '../types/auth';
import type { Categorie } from '../types/ticket';

// Journal d'audit (§7 — Traçabilité). Réservé à l'administrateur : la table contient des
// adresses IP et retrace l'activité de chacun.
//
// Ce que cet écran doit rendre visible, au-delà des lignes elles-mêmes :
//   - les ÉCHECS, distingués des succès (une rafale de connexions refusées depuis une même
//     adresse est le signal que la journalisation console ne pouvait pas produire) ;
//   - ce qu'on NE SAIT PAS : les entrées reprises de l'historique n'ont jamais eu de
//     contexte de requête, et quelques affectations anciennes ne sont rattachables à aucun
//     compte. Les annoncer vaut mieux que laisser croire à une trace complète.

const PAR_PAGE = 100;

const LIBELLES_RESULTAT: { valeur: ResultatAudit | ''; label: string }[] = [
  { valeur: '', label: 'Tous' },
  { valeur: 'SUCCES', label: 'Succès' },
  { valeur: 'ECHEC', label: 'Échecs' },
];

function formaterHorodatage(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Une entrée reprise de l'ancien historique des tickets : elle n'a jamais eu d'IP ni de
// user-agent, ce qui doit être dit et non deviné.
const estImportee = (e: EntreeAudit) => e.details?.importeDeLHistorique === true;

export function JournalAuditPage() {
  const token = useAuthStore((state) => state.token);

  const [entrees, setEntrees] = useState<EntreeAudit[]>([]);
  const [actionsConnues, setActionsConnues] = useState<string[]>([]);
  const [curseurSuivant, setCurseurSuivant] = useState<number | null>(null);
  const [ciblesNonRattachees, setCiblesNonRattachees] = useState(0);
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);

  const [selection, setSelection] = useState<EntreeAudit | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [filtres, setFiltres] = useState<FiltresAudit>({});
  const [chargement, setChargement] = useState(true);
  const [chargementSuite, setChargementSuite] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!token) return;
    setChargement(true);
    setErreur(null);
    try {
      const [journal, comptes, cats] = await Promise.all([
        auditApi.consulter({ ...filtres, limite: PAR_PAGE }, token),
        utilisateursApi.lister({}, token),
        // Sert à traduire en noms les identifiants de catégorie présents dans le détail.
        ticketsApi.listerCategories(token),
      ]);
      setEntrees(journal.entrees);
      setActionsConnues(journal.actionsConnues);
      setCurseurSuivant(journal.curseurSuivant);
      setCiblesNonRattachees(journal.ciblesNonRattachees);
      setUtilisateurs(comptes.utilisateurs);
      setCategories(cats.categories);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Chargement impossible');
    } finally {
      setChargement(false);
    }
  }, [token, filtres]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // « Charger plus » : on repart du dernier identifiant affiché. Le serveur poursuit dans
  // l'ordre ANTÉCHRONOLOGIQUE — et non dans l'ordre des identifiants, qui placerait les
  // entrées reprises de l'historique en tête alors qu'elles sont les plus anciennes.
  async function chargerSuite() {
    if (!token || !curseurSuivant) return;
    setChargementSuite(true);
    try {
      const suite = await auditApi.consulter(
        { ...filtres, limite: PAR_PAGE, avantId: curseurSuivant },
        token,
      );
      setEntrees((actuelles) => [...actuelles, ...suite.entrees]);
      setCurseurSuivant(suite.curseurSuivant);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Chargement impossible');
    } finally {
      setChargementSuite(false);
    }
  }

  const majFiltre = (ajout: Partial<FiltresAudit>) => setFiltres((f) => ({ ...f, ...ajout }));

  const nomUtilisateur = useMemo(
    () => new Map(utilisateurs.map((u) => [u.id, `${u.prenom} ${u.nom}`])),
    [utilisateurs],
  );
  const nomCategorie = useMemo(() => new Map(categories.map((c) => [c.id, c.nom])), [categories]);
  const nbEchecs = entrees.filter((e) => e.resultat === 'ECHEC').length;

  return (
    <div>
      <PageHeader
        title="Journal d'audit"
        description="Qui a fait quoi, quand, depuis où. Conservé 12 mois."
        actions={
          <Button variant="secondary" size="sm" onClick={charger} disabled={chargement}>
            <RefreshCw className="size-3.5" aria-hidden />
            Actualiser
          </Button>
        }
      />

      {erreur && (
        <Alert variant="danger" className="mb-4">
          {erreur}
        </Alert>
      )}

      {/* Ce que le journal ne sait pas — annoncé, pas masqué. */}
      {ciblesNonRattachees > 0 && (
        <Alert variant="info" className="mb-4">
          <p className="font-medium">
            {ciblesNonRattachees} événement{ciblesNonRattachees > 1 ? 's' : ''} antérieur
            {ciblesNonRattachees > 1 ? 's' : ''} ne peu{ciblesNonRattachees > 1 ? 'vent' : 't'} pas
            être rattaché{ciblesNonRattachees > 1 ? 's' : ''} à un compte
          </p>
          <p className="mt-0.5">
            Ces affectations n'enregistraient que le <em>nom</em> du technicien, et ce nom désigne
            plusieurs comptes. Le nom reste lisible dans l'historique du ticket ; seul le lien vers
            un compte manque. Les affectations enregistrées depuis sont, elles, rattachées.
          </p>
        </Alert>
      )}

      {/* Filtres */}
      <Card className="animate-fade-up mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="f-action" className="mb-1 block text-xs font-medium text-slate-500">
              Action
            </label>
            <Select
              id="f-action"
              value={filtres.action ?? ''}
              onChange={(e) => majFiltre({ action: e.target.value || undefined })}
              className="w-56"
            >
              <option value="">Toutes</option>
              {actionsConnues.map((a) => (
                <option key={a} value={a}>
                  {LABEL_ACTION[a] ?? a}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="f-acteur" className="mb-1 block text-xs font-medium text-slate-500">
              Acteur
            </label>
            <Select
              id="f-acteur"
              value={filtres.acteurId ?? ''}
              onChange={(e) => majFiltre({ acteurId: e.target.value ? Number(e.target.value) : undefined })}
              className="w-52"
            >
              <option value="">Tous</option>
              {utilisateurs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label htmlFor="f-debut" className="mb-1 block text-xs font-medium text-slate-500">
              Du
            </label>
            <Input
              id="f-debut"
              type="date"
              className="w-40"
              value={filtres.dateDebut ?? ''}
              onChange={(e) => majFiltre({ dateDebut: e.target.value || undefined })}
            />
          </div>
          <div>
            <label htmlFor="f-fin" className="mb-1 block text-xs font-medium text-slate-500">
              Au
            </label>
            <Input
              id="f-fin"
              type="date"
              className="w-40"
              value={filtres.dateFin ?? ''}
              onChange={(e) => majFiltre({ dateFin: e.target.value || undefined })}
            />
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">Résultat</span>
            <div className="flex gap-1" role="group" aria-label="Filtrer par résultat">
              {LIBELLES_RESULTAT.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  aria-pressed={(filtres.resultat ?? '') === r.valeur}
                  onClick={() => majFiltre({ resultat: r.valeur || undefined })}
                  className={[
                    'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    (filtres.resultat ?? '') === r.valeur
                      ? 'bg-primary-500 text-white'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {Object.keys(filtres).length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFiltres({})}>
              Réinitialiser
            </Button>
          )}
        </div>
      </Card>

      <Card className="animate-fade-up overflow-hidden">
        {chargement ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : entrees.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Aucune entrée"
            description="Aucune action ne correspond à ces filtres."
          />
        ) : (
          <>
            <TableContainer>
              <Table>
                <thead>
                  <tr>
                    <Th className="whitespace-nowrap">Date</Th>
                    <Th>Action</Th>
                    <Th>Acteur</Th>
                    <Th className="hidden md:table-cell">Cible</Th>
                    <Th>Résultat</Th>
                    <Th className="hidden lg:table-cell">IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {entrees.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelection(e)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                      tabIndex={0}
                      role="button"
                      aria-label={`Détail de l'action ${LABEL_ACTION[e.action] ?? e.action}`}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          setSelection(e);
                        }
                      }}
                    >
                      <Td className="whitespace-nowrap tabular-nums text-xs text-slate-500">
                        {formaterHorodatage(e.dateCreation)}
                      </Td>
                      <Td className="font-medium text-slate-700">{LABEL_ACTION[e.action] ?? e.action}</Td>
                      <Td className="text-slate-600">
                        {e.acteurId ? (nomUtilisateur.get(e.acteurId) ?? e.acteurNom) : e.acteurNom}
                        {!e.acteurId && e.acteurNom !== 'Système' && (
                          <span className="ml-1 text-xs text-slate-400">(non authentifié)</span>
                        )}
                      </Td>
                      <Td className="hidden text-slate-500 md:table-cell">
                        {e.cibleType ? `${LABEL_CIBLE[e.cibleType] ?? e.cibleType}${e.cibleId ? ` #${e.cibleId}` : ''}` : '—'}
                      </Td>
                      <Td>
                        <Badge variant={e.resultat === 'ECHEC' ? 'danger' : 'success'}>
                          {e.resultat === 'ECHEC' ? 'Échec' : 'Succès'}
                        </Badge>
                      </Td>
                      <Td className="hidden text-xs tabular-nums text-slate-500 lg:table-cell">
                        {/* Absence QUALIFIEE d'un coup d'oeil ; le pourquoi complet est
                            dans le panneau, ouvert au clic — plus d'infobulle native. */}
                        {e.ip ?? (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            {estImportee(e) && <History className="size-3" aria-hidden />}
                            {estImportee(e) ? 'historique' : '—'}
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-400">
                <Info className="size-3.5 shrink-0" aria-hidden />
                {entrees.length} entrée{entrees.length > 1 ? 's' : ''} affichée
                {entrees.length > 1 ? 's' : ''}
                {nbEchecs > 0 && ` · ${nbEchecs} échec${nbEchecs > 1 ? 's' : ''}`}
                {' · cliquez une ligne pour le détail complet'}
              </p>
              {curseurSuivant !== null && (
                <Button variant="secondary" size="sm" onClick={chargerSuite} loading={chargementSuite}>
                  <ChevronDown className="size-3.5" aria-hidden />
                  Charger plus
                </Button>
              )}
            </div>
          </>
        )}
      </Card>

      <PanneauAudit
        entree={selection}
        onClose={() => setSelection(null)}
        nomUtilisateur={(id) => nomUtilisateur.get(id)}
        nomCategorie={(id) => nomCategorie.get(id)}
      />
    </div>
  );
}
