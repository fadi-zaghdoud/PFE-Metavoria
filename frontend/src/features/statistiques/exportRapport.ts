import writeXlsxFile from 'write-excel-file/browser';
import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { StatistiquesTickets } from '../../types/ticket';
import { LABEL_PRIORITE, LABEL_STATUT } from '../tickets/ticket-ui';
import { nombreFr } from '../../lib/format';
import { jourLisible } from './periodes';
import type { IndicateursTableau, TechnicienTableau, TechniciensTableau } from './tableauDeBordApi';

const COULEUR_MARQUE = '#4f46e5';
const nomFichier = (ext: string) => `rapport-tickets-${new Date().toISOString().slice(0, 10)}.${ext}`;

// PDF : nombres à la française (« 48,1 »). Les polices standard de jsPDF ne connaissent pas
// l'espace fine insécable (U+202F) qu'Intl place entre les milliers : elle devient une
// espace insécable ordinaire (U+00A0), qu'elles savent écrire.
const pdf = (v: number | null, decimales = 1) =>
  v == null ? '—' : nombreFr(v, decimales).replace(/\u202f/g, '\u00a0');

// Excel : une valeur reste un NOMBRE (le tableur l'affiche selon sa propre langue) ; seule
// une valeur absente s'écrit « — ».
const cellule = (v: number | null, format = '0') =>
  v == null ? ({ value: '—' } as const) : ({ value: v, type: Number, format } as const);

// Synthèse : les quatre indicateurs de l'écran, mêmes définitions (journal technique), avec
// la valeur de la période précédente — absente (« — ») quand elle n'a pas de données — et
// l'effectif des moyennes. La satisfaction vient des tickets créés dans la période.
type Ligne = { libelle: string; valeur: number | null; precedent: number | null; decimal?: boolean };
function lignesSynthese(stats: StatistiquesTickets, i: IndicateursTableau): Ligne[] {
  return [
    { libelle: 'Tickets résolus sur la période', valeur: i.resolus.valeur, precedent: i.resolus.precedent },
    {
      libelle: 'Temps moyen de résolution (h)',
      valeur: i.tempsResolution.heures,
      precedent: i.tempsResolution.precedent?.heures ?? null,
      decimal: true,
    },
    { libelle: '   sur (tickets résolus)', valeur: i.tempsResolution.n, precedent: i.tempsResolution.precedent?.n ?? null },
    { libelle: 'Tickets ouverts en fin de période', valeur: i.ouverts.valeur, precedent: i.ouverts.precedent },
    {
      libelle: 'Délai moyen de 1re prise en charge (h)',
      valeur: i.priseEnCharge.heures,
      precedent: i.priseEnCharge.precedent?.heures ?? null,
      decimal: true,
    },
    { libelle: '   sur (tickets pris en charge)', valeur: i.priseEnCharge.n, precedent: i.priseEnCharge.precedent?.n ?? null },
    { libelle: 'Satisfaction moyenne (/5)', valeur: stats.satisfactionMoyenne, precedent: null, decimal: true },
    { libelle: "Nombre d'évaluations", valeur: stats.nombreEvaluations, precedent: null },
  ];
}

const DEFINITIONS = [
  'Résolus : tickets dont la résolution tombe dans la période (dernier passage à « Résolu », sinon clôture).',
  'Temps de résolution : de la création à la résolution. 1re prise en charge : de la création à la première prise en charge.',
  'Ouverts : tickets non résolus à la fin de la période. Satisfaction et répartitions : tickets créés dans la période.',
];
const DEFINITION_TECHNICIENS =
  'Techniciens : au technicien actuel du ticket — ouverts à la fin de la période, résolus et temps moyen sur la période.';

// La section des techniciens, telle qu'à l'écran : le support seul la reçoit (D7) ; un
// technicien n'y a que sa propre ligne, sous le titre « Mon activité ».
export interface EquipeExport {
  donnees: TechniciensTableau;
  vueEquipe: boolean;
}

const definitions = (equipe: EquipeExport | null) => (equipe ? [...DEFINITIONS, DEFINITION_TECHNICIENS] : DEFINITIONS);

// Le nom, et la date de fin d'une absence en cours — jamais son motif.
const nomTechnicien = (t: TechnicienTableau) =>
  t.absenceJusquau
    ? `${t.prenom} ${t.nom} (absent jusqu'au ${jourLisible(t.absenceJusquau, { day: '2-digit', month: '2-digit', year: 'numeric' })})`
    : `${t.prenom} ${t.nom}`;

// Ce qui suit la liste : les comptes sans activité (vue de l'équipe), ou l'état vide.
function mentionEquipe({ donnees, vueEquipe }: EquipeExport): string | null {
  if (donnees.techniciens.length === 0 && !vueEquipe) return 'Aucune activité sur la période.';
  const parts: string[] = [];
  if (donnees.techniciens.length === 0) parts.push('Aucun technicien actif sur la période.');
  if (vueEquipe && donnees.sansActivite > 0) {
    const n = donnees.sansActivite;
    parts.push(`${nombreFr(n)} technicien${n > 1 ? 's' : ''} sans activité sur la période.`);
  }
  return parts.length ? parts.join(' ') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export Excel (.xlsx) — deux feuilles : Synthèse (KPI) et Répartitions.
// ─────────────────────────────────────────────────────────────────────────────
const entete = (value: string) =>
  ({ value, fontWeight: 'bold', color: '#ffffff', backgroundColor: COULEUR_MARQUE, align: 'left' }) as const;

export async function exporterStatistiquesExcel(
  stats: StatistiquesTickets,
  indicateurs: IndicateursTableau,
  equipe: EquipeExport | null,
  resumeFiltres: string,
) {
  const dateStr = new Date().toLocaleString('fr-FR');

  const synthese = [
    [{ value: 'Rapport — Tableau de bord tickets', fontWeight: 'bold' } as const],
    [{ value: `Généré le ${dateStr}`, color: '#64748b' } as const],
    [{ value: resumeFiltres ? `Filtres : ${resumeFiltres}` : 'Aucun filtre appliqué', color: '#64748b' } as const],
    [],
    [entete('Indicateur'), entete('Période'), entete('Période précédente')],
    ...lignesSynthese(stats, indicateurs).map((l) => [
      { value: l.libelle },
      cellule(l.valeur, l.decimal ? '0.0' : '0'),
      cellule(l.precedent, l.decimal ? '0.0' : '0'),
    ]),
    [],
    [{ value: 'Définitions', fontWeight: 'bold' } as const],
    ...definitions(equipe).map((d) => [{ value: d, color: '#64748b' } as const]),
  ];

  const nombre = (n: number) => ({ value: n, type: Number }) as const;
  const repartitions = [
    [entete('Statut'), entete('Nombre')],
    ...stats.repartitionStatut.map((r) => [{ value: LABEL_STATUT[r.statut] }, nombre(r.count)]),
    [],
    [entete('Priorité'), entete('Nombre')],
    ...stats.repartitionPriorite.map((r) => [{ value: LABEL_PRIORITE[r.priorite] }, nombre(r.count)]),
    [],
    [entete('Catégorie'), entete('Nombre')],
    ...stats.repartitionCategorie.map((r) => [{ value: r.categorie }, nombre(r.count)]),
    [],
    [entete('Satisfaction'), entete('Nombre')],
    ...[...stats.repartitionSatisfaction]
      .reverse()
      .map((r) => [{ value: `${r.note} étoile${r.note > 1 ? 's' : ''}` }, nombre(r.count)]),
  ];

  const feuilles = [
    { data: synthese, sheet: 'Synthèse', columns: [{ width: 40 }, { width: 14 }, { width: 20 }] },
    { data: repartitions, sheet: 'Répartitions', columns: [{ width: 28 }, { width: 18 }] },
  ];
  if (equipe) {
    const mention = mentionEquipe(equipe);
    feuilles.push({
      data: [
        [
          entete('Technicien'),
          entete('Ouverts en fin de période'),
          entete('Résolus sur la période'),
          entete('Temps moyen de résolution (h)'),
        ],
        ...equipe.donnees.techniciens.map((t) => [
          { value: nomTechnicien(t) },
          cellule(t.ouverts),
          cellule(t.resolus),
          cellule(t.tempsResolution.heures, '0.0'),
        ]),
        ...(mention ? [[], [{ value: mention, color: '#64748b' } as const]] : []),
      ],
      sheet: equipe.vueEquipe ? 'Techniciens' : 'Mon activité',
      columns: [{ width: 40 }, { width: 24 }, { width: 22 }, { width: 28 }],
    });
  }
  await writeXlsxFile(feuilles).toFile(nomFichier('xlsx'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Export PDF — titre, filtres appliqués, tableaux stylés et pagination.
// ─────────────────────────────────────────────────────────────────────────────
export function exporterStatistiquesPdf(
  stats: StatistiquesTickets,
  indicateurs: IndicateursTableau,
  equipe: EquipeExport | null,
  resumeFiltres: string,
) {
  const doc = new jsPDF();
  const dateStr = new Date().toLocaleString('fr-FR');
  const teteStyle = { fillColor: [79, 70, 229] as [number, number, number], textColor: 255, fontStyle: 'bold' as const };

  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Rapport — Tableau de bord tickets', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Généré le ${dateStr}`, 14, 25);
  if (resumeFiltres) doc.text(`Filtres : ${resumeFiltres}`, 14, 31);

  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: resumeFiltres ? 37 : 31,
    head: [['Indicateur', 'Période', 'Période précédente']],
    body: lignesSynthese(stats, indicateurs).map((l) => [l.libelle, pdf(l.valeur), pdf(l.precedent)]),
    headStyles: teteStyle,
    styles: { fontSize: 9 },
  });
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const lignesDefinitions: string[] = doc.splitTextToSize(definitions(equipe).join(' '), 182);
  doc.text(lignesDefinitions, 14, finalY() + 5);
  // L'écart d'origine (14 mm) vaut pour les définitions de base ; chaque ligne en plus — la
  // définition des techniciens — décale la suite d'autant.
  const lignesEnPlus = lignesDefinitions.length - doc.splitTextToSize(DEFINITIONS.join(' '), 182).length;
  const apresDefinitions = finalY() + 14 + lignesEnPlus * (doc.getLineHeight() / doc.internal.scaleFactor);

  let premiere = true;
  const section = (titre: string, tete: string[], corps: RowInput[]) => {
    let y = premiere ? apresDefinitions : finalY() + 8;
    premiere = false;
    // Un titre ne reste jamais seul en bas de page : sans la place d'un en-tête de tableau et
    // de quelques lignes sous lui, il passe à la page suivante avec son tableau.
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(titre, 14, y);
    autoTable(doc, { startY: y + 2, head: [tete], body: corps, headStyles: teteStyle, styles: { fontSize: 9 } });
  };

  section(
    'Répartition par statut',
    ['Statut', 'Nombre'],
    stats.repartitionStatut.map((r) => [LABEL_STATUT[r.statut], pdf(r.count)]),
  );
  section(
    'Répartition par priorité',
    ['Priorité', 'Nombre'],
    stats.repartitionPriorite.map((r) => [LABEL_PRIORITE[r.priorite], pdf(r.count)]),
  );
  section(
    'Répartition par catégorie',
    ['Catégorie', 'Nombre'],
    stats.repartitionCategorie.map((r) => [r.categorie, pdf(r.count)]),
  );
  if (equipe) {
    const mention = mentionEquipe(equipe);
    section(
      equipe.vueEquipe ? 'Techniciens' : 'Mon activité',
      ['Technicien', 'Ouverts (fin de période)', 'Résolus', 'Temps moyen (h)'],
      [
        ...equipe.donnees.techniciens.map((t) => [
          nomTechnicien(t),
          pdf(t.ouverts),
          pdf(t.resolus),
          pdf(t.tempsResolution.heures),
        ]),
        ...(mention
          ? [[{ content: mention, colSpan: 4, styles: { textColor: [100, 116, 139] as [number, number, number] } }]]
          : []),
      ],
    );
  }
  if (stats.nombreEvaluations > 0) {
    section(
      'Répartition des évaluations',
      ['Note', 'Nombre'],
      [...stats.repartitionSatisfaction].reverse().map((r) => [`${r.note} étoile${r.note > 1 ? 's' : ''}`, pdf(r.count)]),
    );
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Smart Ticketing — Metavoria · page ${i}/${pages}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  doc.save(nomFichier('pdf'));
}
