import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Download, FileText, Hand, Inbox, X } from 'lucide-react';
import { ticketsApi } from '../tickets/ticketsApi';
import { utilisateursApi } from '../utilisateurs/utilisateursApi';
import { LABEL_PRIORITE } from '../tickets/ticket-ui';
import { PASTILLE_STATUT } from '../tickets/statutCouleurs';
import { useAuthStore } from '../../store/authStore';
import type { Categorie, PrioriteTicket } from '../../types/ticket';
import type { Utilisateur } from '../../types/auth';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { Alert } from '../../components/ui/Alert';
import { cn } from '../../lib/cn';
import { dureeHeuresFr, nombreFr } from '../../lib/format';
import { CarteGraphique } from './graphiques/CarteGraphique';
import { AnneauCategories } from './graphiques/AnneauCategories';
import { JaugePriorites } from './graphiques/JaugePriorites';
import { SectionSatisfaction } from './graphiques/SectionSatisfaction';
import { CarteIndicateur } from './graphiques/CarteIndicateur';
import { CourbeTendance, LegendeTendance } from './graphiques/CourbeTendance';
import { SectionIA } from './graphiques/SectionIA';
import { SectionATraiter } from './graphiques/SectionATraiter';
import { ColonneOuverts, SectionTechniciens } from './graphiques/SectionTechniciens';
import { calculerVariation } from './graphiques/variation';
import { COULEUR_PRIORITE, partsCategories, type PartGraphique } from './graphiques/couleurs';
import { SelecteurPeriode } from './SelecteurPeriode';
import { bornesPour, intervalleLisible, jourLisible, PERIODE_PAR_DEFAUT, type ChoixPeriode } from './periodes';
import { tableauDeBordApi, type FiltresTableau, type IndicateursTableau } from './tableauDeBordApi';
import { useChargement } from './useChargement';

// Jauge des priorités : de Faible, à gauche, à Critique, à droite.
const PRIORITES_JAUGE: PrioriteTicket[] = ['FAIBLE', 'MOYENNE', 'HAUTE', 'CRITIQUE'];

// Sources chargées en parallèle sur les mêmes bornes : les points d'accès du tableau de bord
// (indicateurs, courbe, module IA, « À traiter », techniciens) et /tickets/statistiques,
// inchangé, pour les répartitions et la satisfaction (période sur la date de création).
// Fonctions définies hors du composant, donc stables pour `useChargement`.
const chargerStatistiques = (f: FiltresTableau, token: string) =>
  ticketsApi.statistiques(
    { dateDebut: f.du, dateFin: f.au, categorieId: f.categorieId, technicienId: f.technicienId, service: f.service },
    token,
  );
const chargerIndicateurs = tableauDeBordApi.indicateurs;
const chargerTendance = tableauDeBordApi.tendance;
const chargerIa = tableauDeBordApi.ia;
const chargerATraiter = tableauDeBordApi.aTraiter;
const chargerTechniciens = tableauDeBordApi.techniciens;

function ChampFiltre({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-texte-4">{label}</span>
      {children}
    </div>
  );
}

// Statuts des tickets ouverts aujourd'hui, sous la carte « Ouverts » — aux couleurs qu'ils
// ont sur tous les écrans. Chez l'administrateur, « nouveaux » mène aux tickets sans
// technicien : c'est ce que disait la carte « À affecter », qu'elle remplace (dans ce cycle
// de vie, un ticket Nouveau n'a pas de technicien ; l'assignation le fait passer En attente).
function MentionStatuts({
  statuts,
  lienAffecter,
}: {
  statuts: NonNullable<IndicateursTableau['ouverts']['statuts']>;
  lienAffecter: boolean;
}) {
  const nouveaux = `${nombreFr(statuts.NOUVEAU)} nouveau${statuts.NOUVEAU > 1 ? 'x' : ''}`;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', PASTILLE_STATUT.NOUVEAU)} aria-hidden />
        {lienAffecter && statuts.NOUVEAU > 0 ? (
          <Link
            to="/tickets?vue=non-assignes"
            className="text-marque underline-offset-2 hover:underline"
            title="Tickets sans technicien, à affecter"
          >
            {nouveaux}
          </Link>
        ) : (
          nouveaux
        )}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', PASTILLE_STATUT.EN_ATTENTE)} aria-hidden />
        {nombreFr(statuts.EN_ATTENTE)} en attente
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={cn('size-1.5 rounded-full', PASTILLE_STATUT.EN_COURS)} aria-hidden />
        {nombreFr(statuts.EN_COURS)} en cours
      </span>
    </p>
  );
}

const pluriel = (n: number, mot: string) => `${nombreFr(n)} ${mot}${n > 1 ? 's' : ''}`;

// Emplacement d'une section sans ses données : un squelette pendant le chargement, une
// mention sobre en cas d'échec — jamais un squelette qui attend indéfiniment. L'encart du
// haut propose de réessayer.
function EnAttente({ erreur, hauteur }: { erreur: boolean; hauteur: string }) {
  return erreur ? (
    <p className={cn('flex items-center justify-center text-center text-sm text-texte-4', hauteur)}>
      Données indisponibles.
    </p>
  ) : (
    <Skeleton className={cn('rounded-xl', hauteur)} />
  );
}

export function TableauDeBord() {
  const token = useAuthStore((s) => s.token);
  const utilisateur = useAuthStore((s) => s.utilisateur);
  const estAdmin = utilisateur?.role === 'ADMINISTRATEUR';
  const estSupport = utilisateur?.role === 'TECHNICIEN' || estAdmin;

  const [choix, setChoix] = useState<ChoixPeriode>(PERIODE_PAR_DEFAUT);
  const [dates, setDates] = useState<{ du?: string; au?: string }>({});
  const [filtres, setFiltres] = useState<Pick<FiltresTableau, 'categorieId' | 'technicienId' | 'service'>>({});
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [techniciens, setTechniciens] = useState<Utilisateur[]>([]);
  const [essai, setEssai] = useState(0);
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

  const params: FiltresTableau = { ...bornesPour(choix, dates), ...filtres };
  const statistiques = useChargement(params, token, essai, chargerStatistiques);
  const indicateurs = useChargement(params, token, essai, chargerIndicateurs);
  const tendance = useChargement(params, token, essai, chargerTendance);
  // Module IA : le support seul (D7) — pour un employé, rien n'est demandé.
  const ia = useChargement(params, estSupport ? token : null, essai, chargerIa);
  // « À traiter » : sans période, donc sans rechargement quand elle change.
  const aTraiter = useChargement(filtres, token, essai, chargerATraiter);
  // Techniciens : le support seul (D7) ; le serveur ne rend à un technicien que sa ligne.
  const equipe = useChargement(params, estSupport ? token : null, essai, chargerTechniciens);
  const stats = statistiques.donnees;
  const ind = indicateurs.donnees;
  const erreur =
    statistiques.erreur || indicateurs.erreur || tendance.erreur || ia.erreur || aTraiter.erreur || equipe.erreur;
  // Rechargement : l'image précédente reste, atténuée, le temps que tout soit arrivé.
  const attenue =
    (statistiques.enChargement && stats !== null) ||
    (indicateurs.enChargement && ind !== null) ||
    (tendance.enChargement && tendance.donnees !== null) ||
    (ia.enChargement && ia.donnees !== null) ||
    (aTraiter.enChargement && aTraiter.donnees !== null) ||
    (equipe.enChargement && equipe.donnees !== null);

  function choisirPeriode(nouveau: ChoixPeriode) {
    // Passer à « Dates » part des bornes affichées, plutôt que d'un champ vide.
    if (nouveau === 'dates' && !dates.du && !dates.au) setDates(bornesPour(choix, {}));
    setChoix(nouveau);
  }
  function maj(patch: Partial<typeof filtres>) {
    setFiltres((f) => ({ ...f, ...patch }));
  }
  const filtresActifs =
    choix !== PERIODE_PAR_DEFAUT || Object.values(filtres).some((v) => v !== undefined && v !== '');
  function reinitialiser() {
    setChoix(PERIODE_PAR_DEFAUT);
    setDates({});
    setFiltres({});
  }

  const periode = ind?.periode;
  const precedente = periode?.precedente
    ? intervalleLisible(periode.precedente.du, periode.precedente.au)
    : undefined;
  const sansComparaison =
    ind !== null &&
    ind.resolus.precedent === null &&
    ind.tempsResolution.precedent === null &&
    ind.ouverts.precedent === null &&
    ind.priseEnCharge.precedent === null;

  // Résumé lisible de la période et des filtres (noms résolus), repris dans les exports.
  function descriptionFiltres(): string {
    const parts: string[] = [];
    if (periode) parts.push(`Période : ${intervalleLisible(periode.du, periode.au)}`);
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

  // Les exports reprennent les sections de l'écran : la liste des techniciens n'y figure que
  // pour le support, comme à l'écran (D7).
  const equipeExport = estSupport && equipe.donnees ? { donnees: equipe.donnees, vueEquipe: estAdmin } : null;
  const exportPret = stats !== null && ind !== null && (!estSupport || equipe.donnees !== null);

  // Import dynamique : les librairies d'export (jsPDF, write-excel-file) ne sont
  // chargées qu'au moment de l'export, pour ne pas alourdir le bundle principal.
  async function exporterExcel() {
    if (!stats || !ind) return;
    setExportEnCours('excel');
    try {
      const { exporterStatistiquesExcel } = await import('./exportRapport');
      await exporterStatistiquesExcel(stats, ind, equipeExport, descriptionFiltres());
    } finally {
      setExportEnCours(null);
    }
  }

  async function exporterPdf() {
    if (!stats || !ind) return;
    setExportEnCours('pdf');
    try {
      const { exporterStatistiquesPdf } = await import('./exportRapport');
      exporterStatistiquesPdf(stats, ind, equipeExport, descriptionFiltres());
    } finally {
      setExportEnCours(null);
    }
  }

  const partsCategorie = partsCategories(stats?.repartitionCategorie ?? [], categories);
  const partsPriorite: PartGraphique[] = PRIORITES_JAUGE.map((p) => ({
    cle: p,
    libelle: LABEL_PRIORITE[p],
    valeur: stats?.repartitionPriorite.find((r) => r.priorite === p)?.count ?? 0,
    ...COULEUR_PRIORITE[p],
  }));
  return (
    <div className="space-y-6">
      {/* En-tête : période, filtres existants, exports. */}
      <Card className="animate-fade-up p-4">
        <div className="flex flex-wrap items-end gap-3">
          <ChampFiltre label="Période">
            <SelecteurPeriode valeur={choix} onChange={choisirPeriode} />
          </ChampFiltre>
          {choix === 'dates' && (
            <>
              <ChampFiltre label="Du">
                <Input
                  type="date"
                  value={dates.du ?? ''}
                  onChange={(e) => setDates((d) => ({ ...d, du: e.target.value || undefined }))}
                  aria-label="Date de début"
                  className="w-40"
                />
              </ChampFiltre>
              <ChampFiltre label="Au">
                <Input
                  type="date"
                  value={dates.au ?? ''}
                  onChange={(e) => setDates((d) => ({ ...d, au: e.target.value || undefined }))}
                  aria-label="Date de fin"
                  className="w-40"
                />
              </ChampFiltre>
            </>
          )}
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
            <Button variant="ghost" size="sm" onClick={reinitialiser}>
              <X className="size-3.5" aria-hidden />
              Réinitialiser
            </Button>
          )}

          <div className="ml-auto flex items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!exportPret || exportEnCours !== null}
              loading={exportEnCours === 'excel'}
              onClick={exporterExcel}
            >
              <Download className="size-3.5" aria-hidden />
              Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!exportPret || exportEnCours !== null}
              loading={exportEnCours === 'pdf'}
              onClick={exporterPdf}
            >
              <FileText className="size-3.5" aria-hidden />
              PDF
            </Button>
          </div>
        </div>
        {periode && (
          <p className="mt-3 text-xs text-texte-4">
            Période : {intervalleLisible(periode.du, periode.au)}
            {periode.precedente
              ? sansComparaison
                ? ' · la période précédente ne contient pas de données : pas de variation'
                : ` · comparée à la période précédente, ${precedente}`
              : ' · depuis le premier ticket, sans période précédente'}
          </p>
        )}
      </Card>

      {erreur && (
        <Alert variant="danger">
          Les statistiques n'ont pas pu être chargées.{' '}
          <button
            type="button"
            onClick={() => setEssai((n) => n + 1)}
            className="font-semibold underline underline-offset-2"
          >
            Réessayer
          </button>
        </Alert>
      )}

      <div className={cn('space-y-6 transition-opacity duration-200', attenue && 'opacity-60')}>
        {/* Indicateurs clés (définitions : journal technique). */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ind ? (
            <>
              <CarteIndicateur
                libelle="Résolus"
                icone={CheckCircle2}
                valeur={nombreFr(ind.resolus.valeur)}
                variation={calculerVariation(ind.resolus.valeur, ind.resolus.precedent, true)}
                periodePrecedente={precedente}
                detail="sur la période"
                index={0}
              />
              <CarteIndicateur
                libelle="Temps de résolution"
                icone={Clock}
                valeur={dureeHeuresFr(ind.tempsResolution.heures)}
                variation={calculerVariation(
                  ind.tempsResolution.heures,
                  ind.tempsResolution.precedent?.heures ?? null,
                  false,
                )}
                periodePrecedente={precedente}
                detail={
                  ind.tempsResolution.n > 0
                    ? `moyenne sur ${pluriel(ind.tempsResolution.n, 'ticket')} résolu${ind.tempsResolution.n > 1 ? 's' : ''}`
                    : 'Aucun ticket résolu sur la période'
                }
                index={1}
              />
              <CarteIndicateur
                libelle="Ouverts"
                icone={Inbox}
                valeur={nombreFr(ind.ouverts.valeur)}
                variation={calculerVariation(ind.ouverts.valeur, ind.ouverts.precedent, false)}
                periodePrecedente={precedente}
                detail={
                  ind.ouverts.statuts ? (
                    <MentionStatuts statuts={ind.ouverts.statuts} lienAffecter={estAdmin} />
                  ) : (
                    `au ${jourLisible(ind.periode.au)}`
                  )
                }
                index={2}
              />
              <CarteIndicateur
                libelle="1re prise en charge"
                icone={Hand}
                valeur={dureeHeuresFr(ind.priseEnCharge.heures)}
                variation={calculerVariation(
                  ind.priseEnCharge.heures,
                  ind.priseEnCharge.precedent?.heures ?? null,
                  false,
                )}
                periodePrecedente={precedente}
                detail={
                  ind.priseEnCharge.n > 0
                    ? `délai moyen sur ${pluriel(ind.priseEnCharge.n, 'ticket')}`
                    : 'Aucune enregistrée'
                }
                index={3}
              />
            </>
          ) : erreur ? null : (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[150px] rounded-2xl" />)
          )}
        </div>

        {/* Tendance et catégories. */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <CarteGraphique titre="Tickets créés et résolus" action={<LegendeTendance />} className="xl:col-span-2">
            {tendance.donnees ? (
              <CourbeTendance points={tendance.donnees.points} granularite={tendance.donnees.periode.granularite} />
            ) : (
              <EnAttente erreur={tendance.erreur} hauteur="h-[260px]" />
            )}
          </CarteGraphique>
          <CarteGraphique titre="Par catégorie">
            {stats ? (
              <AnneauCategories parts={partsCategorie} />
            ) : (
              <EnAttente erreur={statistiques.erreur} hauteur="h-[290px]" />
            )}
          </CarteGraphique>
        </div>

        {/* Priorités, satisfaction ; techniciens pour le support. */}
        <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', estSupport && 'xl:grid-cols-3')}>
          <CarteGraphique titre="Par priorité">
            {stats ? (
              <JaugePriorites parts={partsPriorite} />
            ) : (
              <EnAttente erreur={statistiques.erreur} hauteur="h-[220px]" />
            )}
          </CarteGraphique>
          <CarteGraphique titre="Satisfaction">
            {stats ? (
              <SectionSatisfaction
                moyenne={stats.satisfactionMoyenne}
                nombre={stats.nombreEvaluations}
                repartition={stats.repartitionSatisfaction}
              />
            ) : (
              <EnAttente erreur={statistiques.erreur} hauteur="h-[220px]" />
            )}
          </CarteGraphique>
          {estSupport && (
            <CarteGraphique
              titre={estAdmin ? 'Techniciens' : 'Mon activité'}
              action={estAdmin && equipe.donnees ? <ColonneOuverts periode={equipe.donnees.periode} /> : undefined}
              className="md:col-span-2 xl:col-span-1"
            >
              {equipe.donnees ? (
                <SectionTechniciens donnees={equipe.donnees} vueEquipe={estAdmin} />
              ) : (
                <EnAttente erreur={equipe.erreur} hauteur="h-[220px]" />
              )}
            </CarteGraphique>
          )}
        </div>

        {/* Module IA (support) et « À traiter ». */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {estSupport && (
            <CarteGraphique titre="Module IA">
              {ia.donnees ? <SectionIA donnees={ia.donnees} /> : <EnAttente erreur={ia.erreur} hauteur="h-[200px]" />}
            </CarteGraphique>
          )}
          <CarteGraphique
            titre={estSupport ? 'À traiter' : 'Mes tickets ouverts'}
            className={estSupport ? undefined : 'lg:col-span-2'}
            action={
              <Link
                to="/tickets"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-marque transition-colors hover:text-marque-fort hover:underline"
              >
                Tout voir <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            {aTraiter.donnees ? (
              <SectionATraiter donnees={aTraiter.donnees} lienAffecter={estAdmin} />
            ) : (
              <EnAttente erreur={aTraiter.erreur} hauteur="h-[260px]" />
            )}
          </CarteGraphique>
        </div>
      </div>
    </div>
  );
}
