import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Inbox,
  SlidersHorizontal,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import { ticketsApi } from '../tickets/ticketsApi';
import { utilisateursApi } from '../utilisateurs/utilisateursApi';
import { LABEL_PRIORITE, LABEL_STATUT } from '../tickets/ticket-ui';
import { PASTILLE_STATUT } from '../tickets/statutCouleurs';
import { useAuthStore } from '../../store/authStore';
import type {
  Categorie,
  FiltresStatistiques,
  PrioriteTicket,
  StatistiquesTickets,
} from '../../types/ticket';
import type { Utilisateur } from '../../types/auth';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';

// Aplats par série (jetons d'index.css, vérifiés dans les deux thèmes par
// `verifier:contrastes`). Les statuts gardent la couleur qu'ils ont sur tous les écrans ;
// les priorités suivent la rampe de l'accent, de Faible (claire) à Critique (soutenue).
// L'étiquette reste toujours visible : l'identité ne repose jamais sur la couleur seule.
const COULEUR_PRIORITE: Record<PrioriteTicket, string> = {
  CRITIQUE: 'bg-priorite-critique',
  HAUTE: 'bg-priorite-haute',
  MOYENNE: 'bg-priorite-moyenne',
  FAIBLE: 'bg-priorite-faible',
};

interface DonneeBarre {
  label: string;
  value: number;
  couleur: string;
  // Clé de rendu. Indispensable pour la charge par technicien : deux homonymes
  // partageraient le même libellé, et React confondrait leurs lignes (le risque a
  // augmenté depuis que les techniciens sans ticket ouvert sont eux aussi affichés).
  cle?: string;
  // Mention discrète à droite du libellé (ex. « absent jusqu au 20/08 »).
  annotation?: string;
}

// Graphique en barres horizontales : balayage animé à l'apparition, remplissage en
// aplat, survol de ligne. Chaque barre porte son libellé et sa valeur.
function CarteBarres({
  titre,
  description,
  donnees,
  index = 0,
  className,
}: {
  titre: string;
  description?: string;
  donnees: DonneeBarre[];
  index?: number;
  className?: string;
}) {
  const max = Math.max(1, ...donnees.map((d) => d.value));
  const vide = donnees.every((d) => d.value === 0);
  return (
    <Card
      className={cn('animate-fade-up overflow-hidden', className)}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <CardHeader title={titre} description={description} />
      <CardContent className="@container space-y-0.5">
        {vide ? (
          <p className="py-6 text-center text-sm text-texte-4">Aucune donnée sur la période.</p>
        ) : (
          donnees.map((d, i) => (
            <div
              key={d.cle ?? d.label}
              className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
            >
              {/* La colonne de libellés s'élargit avec LA CARTE, pas avec l'écran : en
                  bandeau pleine largeur, « Youssef Mansour » et « Nadia Khelifi » tenaient
                  dans 96 px fixes pendant que la barre disposait de toute la place. Le
                  seuil (56 rem de conteneur) ne se déclenche que sur la carte pleine
                  largeur — en deux colonnes, la carte fait ~35 rem et garde 96 px, pour ne
                  pas rogner les barres. `truncate` reste le filet pour les noms extrêmes,
                  avec le nom complet en infobulle. */}
              <span
                className="flex w-24 shrink-0 items-center gap-1 text-xs font-medium text-texte-4 @4xl:w-44"
                title={d.annotation ? `${d.label} — ${d.annotation}` : d.label}
              >
                <span className="truncate">{d.label}</span>
                {d.annotation && (
                  <span
                    className="shrink-0 rounded bg-alerte-fond-2 px-1 text-[10px] font-semibold text-alerte-texte"
                    aria-label={d.annotation}
                  >
                    abs.
                  </span>
                )}
              </span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className={cn('h-full rounded-full', d.couleur)}
                  initial={{ width: '0%' }}
                  animate={{ width: `${d.value === 0 ? 0 : Math.max(4, (d.value / max) * 100)}%` }}
                  transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="w-8 text-right text-xs font-semibold tabular-nums text-texte-2">
                {d.value}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ChampFiltre({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-texte-4">{label}</span>
      {children}
    </div>
  );
}

// « 2026-08-20 » -> « 20/08 ». Découpe de chaîne et non new Date(...) : construire une
// date à partir du jour seul la placerait à minuit UTC et pourrait afficher la veille
// dans un fuseau à décalage négatif.
const jourCourt = (jour: string) => {
  const [, mois, j] = jour.split('-');
  return mois && j ? `${j}/${mois}` : jour;
};

// Au-delà de ce nombre de barres, « Charge par technicien » occupe les deux colonnes.
// Six est la hauteur de la plus grande des autres séries (catégories + « Non classé ») :
// en dessous, la charge tient dans une colonne sans creuser la carte d'à côté.
const SEUIL_CHARGE_PLEINE_LARGEUR = 6;

const fmtHeures = (h: number | null) =>
  h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : `${h} h`;

export function TableauDeBord() {
  const token = useAuthStore((s) => s.token);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const estAdmin = utilisateur?.role === 'ADMINISTRATEUR';
  const estSupport = utilisateur?.role === 'TECHNICIEN' || estAdmin;

  const [filtres, setFiltres] = useState<FiltresStatistiques>({});
  const [stats, setStats] = useState<StatistiquesTickets | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [techniciens, setTechniciens] = useState<Utilisateur[]>([]);
  const [exportEnCours, setExportEnCours] = useState<'excel' | 'pdf' | null>(null);

  // Données des filtres : catégories pour tous, techniciens pour l'administrateur.
  useEffect(() => {
    if (!token) return;
    ticketsApi
      .listerCategories(token)
      .then(({ categories: liste }) => setCategories(liste))
      .catch(() => {});
    if (estAdmin) {
      utilisateursApi
        .lister({ role: 'TECHNICIEN' }, token)
        .then(({ utilisateurs }) => setTechniciens(utilisateurs.filter((u) => u.actif)))
        .catch(() => {});
    }
  }, [token, estAdmin]);

  useEffect(() => {
    if (!token) return;
    ticketsApi
      .statistiques(filtres, token)
      .then(setStats)
      .catch(() => setStats(null));
  }, [token, filtres]);

  function maj(patch: Partial<FiltresStatistiques>) {
    setFiltres((f) => ({ ...f, ...patch }));
  }
  const filtresActifs = Object.values(filtres).some((v) => v !== undefined && v !== '');

  // Résumé lisible des filtres actifs (noms résolus), repris dans les exports.
  function descriptionFiltres(): string {
    const parts: string[] = [];
    if (filtres.dateDebut || filtres.dateFin)
      parts.push(`Période : ${filtres.dateDebut ?? '…'} → ${filtres.dateFin ?? '…'}`);
    if (filtres.categorieId) {
      const c = categories.find((x) => x.id === filtres.categorieId);
      parts.push(`Catégorie : ${c?.nom ?? filtres.categorieId}`);
    }
    if (filtres.technicienId) {
      const t = techniciens.find((x) => x.id === filtres.technicienId);
      parts.push(`Technicien : ${t ? `${t.prenom} ${t.nom}` : filtres.technicienId}`);
    }
    if (filtres.service) parts.push(`Service : ${filtres.service}`);
    return parts.join(' · ');
  }

  // Import dynamique : les librairies d'export (jsPDF, write-excel-file) ne sont
  // chargées qu'au moment de l'export, pour ne pas alourdir le bundle principal.
  async function exporterExcel() {
    if (!stats) return;
    setExportEnCours('excel');
    try {
      const { exporterStatistiquesExcel } = await import('./exportRapport');
      await exporterStatistiquesExcel(stats, descriptionFiltres());
    } finally {
      setExportEnCours(null);
    }
  }

  async function exporterPdf() {
    if (!stats) return;
    setExportEnCours('pdf');
    try {
      const { exporterStatistiquesPdf } = await import('./exportRapport');
      exporterStatistiquesPdf(stats, descriptionFiltres());
    } finally {
      setExportEnCours(null);
    }
  }

  // « À affecter » — tickets NOUVEAU. Dans ce cycle de vie, NOUVEAU équivaut à « sans
  // technicien » : l'assignation fait passer à EN_ATTENTE, la désassignation ramène à
  // NOUVEAU. Vérifié sur les 870 tickets de la base — aucun NOUVEAU assigné, aucun ticket
  // ouvert non-NOUVEAU sans technicien. Dérivé ici plutôt que demandé au backend, laissé
  // hors périmètre de cette passe : si l'invariant devait tomber, c'est un compteur
  // explicite côté serveur qu'il faudrait, pas un correctif ici.
  const aAffecter = stats?.repartitionStatut.find((r) => r.statut === 'NOUVEAU')?.count ?? 0;
  const resolusEtClotures = (stats?.ticketsResolus ?? 0) + (stats?.ticketsClotures ?? 0);

  const dataStatut = (stats?.repartitionStatut ?? []).map((r) => ({
    label: LABEL_STATUT[r.statut],
    value: r.count,
    couleur: PASTILLE_STATUT[r.statut],
  }));
  const dataPriorite = (stats?.repartitionPriorite ?? []).map((r) => ({
    label: LABEL_PRIORITE[r.priorite],
    value: r.count,
    couleur: COULEUR_PRIORITE[r.priorite],
  }));
  const dataCategorie = (stats?.repartitionCategorie ?? []).map((r) => ({
    label: r.categorie,
    value: r.count,
    couleur: 'bg-serie-accent',
  }));
  const chargeComplete = (stats?.chargeParTechnicien ?? []).map((r) => ({
    cle: String(r.technicienId),
    label: r.technicien,
    value: r.count,
    couleur: 'bg-serie-accent',
    annotation: r.absenceJusquau ? `absent jusqu'au ${jourCourt(r.absenceJusquau)}` : undefined,
  }));

  // Un technicien à 0 ne veut pas dire la même chose selon qu'un filtre est actif ou non.
  // SANS FILTRE, c'est une information utile : de la capacité disponible, et précisément
  // celui qu'une affectation automatique doit préférer (§6.2). AVEC UN FILTRE, le même 0
  // ne dit plus « disponible » mais « aucun ticket correspondant » — filtrer sur un
  // technicien donnait 10 barres dont 9 vides. On les masque alors, en annonçant combien.
  //
  // Le tri se fait ICI et non côté serveur, volontairement : `chargeCourante` renvoie la
  // liste de TOUS les techniciens actifs par un findMany non filtré, parce que la même
  // fonction alimente l'affectation automatique, qui a besoin des techniciens à 0. Les
  // COMPTES, eux, respectent bien le filtre. Y toucher casserait le §6.2.
  const chargeMasquees = filtresActifs ? chargeComplete.filter((d) => d.value === 0).length : 0;
  const dataCharge = chargeMasquees > 0 ? chargeComplete.filter((d) => d.value > 0) : chargeComplete;
  const dataSatisfaction = [...(stats?.repartitionSatisfaction ?? [])].reverse().map((r) => ({
    label: `${r.note} étoile${r.note > 1 ? 's' : ''}`,
    value: r.count,
    couleur: 'bg-serie-accent',
  }));

  return (
    <div className="space-y-6">
      {/* Panneau de filtres */}
      <Card className="animate-fade-up p-4">
        <div className="flex flex-wrap items-end gap-3">
          <span className="mr-1 hidden items-center gap-1.5 self-center text-xs font-semibold uppercase tracking-wide text-texte-4 sm:inline-flex">
            <SlidersHorizontal className="size-3.5" aria-hidden />
            Filtres
          </span>
          <ChampFiltre label="Du">
            <Input
              type="date"
              value={filtres.dateDebut ?? ''}
              onChange={(e) => maj({ dateDebut: e.target.value || undefined })}
              aria-label="Date de début"
              className="w-40"
            />
          </ChampFiltre>
          <ChampFiltre label="Au">
            <Input
              type="date"
              value={filtres.dateFin ?? ''}
              onChange={(e) => maj({ dateFin: e.target.value || undefined })}
              aria-label="Date de fin"
              className="w-40"
            />
          </ChampFiltre>
          <ChampFiltre label="Catégorie">
            <Select
              value={filtres.categorieId != null ? String(filtres.categorieId) : ''}
              onChange={(e) => maj({ categorieId: e.target.value ? Number(e.target.value) : undefined })}
              aria-label="Filtrer par catégorie"
              className="w-44"
            >
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </Select>
          </ChampFiltre>
          {estAdmin && (
            <ChampFiltre label="Technicien">
              <Select
                value={filtres.technicienId != null ? String(filtres.technicienId) : ''}
                onChange={(e) => maj({ technicienId: e.target.value ? Number(e.target.value) : undefined })}
                aria-label="Filtrer par technicien"
                className="w-44"
              >
                <option value="">Tous</option>
                {techniciens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.prenom} {t.nom}
                  </option>
                ))}
              </Select>
            </ChampFiltre>
          )}
          {estSupport && (
            <ChampFiltre label="Service demandeur">
              <Input
                value={filtres.service ?? ''}
                onChange={(e) => maj({ service: e.target.value || undefined })}
                placeholder="Ex. Finance"
                aria-label="Filtrer par service"
                className="w-40"
              />
            </ChampFiltre>
          )}
          {filtresActifs && (
            <Button variant="ghost" size="sm" onClick={() => setFiltres({})}>
              <X className="size-3.5" aria-hidden />
              Réinitialiser
            </Button>
          )}

          <div className="ml-auto flex items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!stats || exportEnCours !== null}
              loading={exportEnCours === 'excel'}
              onClick={exporterExcel}
            >
              <Download className="size-3.5" aria-hidden />
              Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!stats || exportEnCours !== null}
              loading={exportEnCours === 'pdf'}
              onClick={exporterPdf}
            >
              <FileText className="size-3.5" aria-hidden />
              PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Indicateurs clés */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            {/* Réservée à l'ADMINISTRATEUR : lui seul peut affecter un ticket
                (ticket.service.affecter refuse tout autre rôle). Montrer ce chiffre à un
                technicien lui désignerait une tâche qu'il ne peut pas accomplir. */}
            {estAdmin && (
              // `h-full` des DEUX côtés : la grille étire le lien, pas la carte qu'il
              // enveloppe. Sans cela, « À affecter » était visiblement plus courte que
              // ses trois voisines — celle dont la mention tient sur deux lignes impose
              // la hauteur de la rangée.
              <Link
                to="/tickets?vue=non-assignes"
                className="block h-full"
                title="Ouvrir la liste des tickets non assignés"
              >
                <StatCard
                  label="À affecter"
                  value={aAffecter}
                  hint={aAffecter > 0 ? 'Aucun technicien assigné' : 'Rien en attente'}
                  icon={UserPlus}
                  tone={aAffecter > 0 ? 'danger' : 'success'}
                  index={0}
                  className="h-full"
                />
              </Link>
            )}
            {/* Chez l'administrateur, le cumul résolus + clôturés descend en mention sous
                les tickets ouverts : l'information reste à l'écran, et sa carte cède la
                place au seul chiffre qui appelle une décision. Les autres rôles, qui n'ont
                pas « À affecter », gardent la carte dédiée — la rangée fait quatre dans
                les deux cas, sans cellule vide. */}
            <StatCard
              label="Tickets ouverts"
              value={stats.ticketsOuverts}
              hint={estAdmin ? `${resolusEtClotures} résolus ou clôturés` : undefined}
              icon={Inbox}
              tone="warning"
              index={estAdmin ? 1 : 0}
            />
            {!estAdmin && (
              <StatCard
                label="Résolus / clôturés"
                value={resolusEtClotures}
                icon={CheckCircle2}
                tone="success"
                index={1}
              />
            )}
            {/* Le délai ne se calcule que sur les tickets portant un événement
                PRISE_EN_CHARGE — 6 sur 870 tant que la traçabilité reste plus récente que
                le corpus. La mention annonce donc son effectif, exactement comme
                « 185 évaluations » qualifie la satisfaction deux cartes plus loin : le
                lecteur juge lui-même du poids de la moyenne. */}
            <StatCard
              label="Résolution moyenne"
              value={fmtHeures(stats.tempsResolutionMoyenHeures)}
              hint={
                stats.delaiPriseEnChargeMoyenHeures != null
                  ? `1re prise en charge : ${fmtHeures(stats.delaiPriseEnChargeMoyenHeures)} sur ${
                      stats.nombrePrisesEnCharge
                    } ticket${stats.nombrePrisesEnCharge > 1 ? 's' : ''}`
                  : undefined
              }
              icon={Clock}
              tone="primary"
              index={2}
            />
            <StatCard
              label="Satisfaction moyenne"
              value={stats.satisfactionMoyenne ?? '—'}
              decimals={1}
              suffix=" / 5"
              hint={`${stats.nombreEvaluations} évaluation${stats.nombreEvaluations > 1 ? 's' : ''}`}
              icon={Star}
              tone="warning"
              index={3}
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[116px] rounded-2xl" />
          ))
        )}
      </div>

      {/* Graphiques — l'ordre appaire les hauteurs plutôt que les thèmes. Chaque carte
          mesure une barre par ligne de données : statut 5 et priorité 4 d'un côté,
          catégorie 6 et évaluations 5 de l'autre, soit deux rangées presque d'aplomb. La
          charge, seule série dont la longueur suit l'effectif des techniciens (10 ici),
          passe en dernier et prend toute la largeur dès qu'elle dépasse le seuil — sinon
          elle laissait une centaine de pixels de vide sous la carte voisine, et la
          dernière rangée se terminait sur une cellule creuse. */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CarteBarres titre="Tickets par statut" donnees={dataStatut} index={0} />
          <CarteBarres titre="Tickets par priorité" donnees={dataPriorite} index={1} />
          <CarteBarres titre="Tickets par catégorie" donnees={dataCategorie} index={2} />
          {stats.nombreEvaluations > 0 && (
            <CarteBarres
              titre="Répartition des évaluations"
              description={`${stats.nombreEvaluations} évaluation${stats.nombreEvaluations > 1 ? 's' : ''}`}
              donnees={dataSatisfaction}
              index={3}
            />
          )}
          {estSupport && (
            <CarteBarres
              titre="Charge par technicien"
              description={
                chargeMasquees > 0
                  ? `Tickets ouverts assignés · ${chargeMasquees} technicien${
                      chargeMasquees > 1 ? 's' : ''
                    } sans ticket sur ce filtre`
                  : 'Tickets ouverts assignés'
              }
              donnees={dataCharge}
              index={4}
              // Bandeau pleine largeur seulement si la série est longue : filtrée sur un
              // technicien (cf. masquage des zéros), elle n'a qu'une barre et une carte
              // pleine largeur pour une barre serait aussi déséquilibrée que l'inverse.
              className={dataCharge.length > SEUIL_CHARGE_PLEINE_LARGEUR ? 'lg:col-span-2' : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
