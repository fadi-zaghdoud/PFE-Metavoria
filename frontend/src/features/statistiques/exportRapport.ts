import writeXlsxFile from 'write-excel-file/browser';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StatistiquesTickets } from '../../types/ticket';
import { LABEL_PRIORITE, LABEL_STATUT } from '../tickets/ticket-ui';
import { nombreFr } from '../../lib/format';
import type { IndicateursTableau } from './tableauDeBordApi';

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

// ─────────────────────────────────────────────────────────────────────────────
// Export Excel (.xlsx) — deux feuilles : Synthèse (KPI) et Répartitions.
// ─────────────────────────────────────────────────────────────────────────────
const entete = (value: string) =>
  ({ value, fontWeight: 'bold', color: '#ffffff', backgroundColor: COULEUR_MARQUE, align: 'left' }) as const;

export async function exporterStatistiquesExcel(
  stats: StatistiquesTickets,
  indicateurs: IndicateursTableau,
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
    ...DEFINITIONS.map((d) => [{ value: d, color: '#64748b' } as const]),
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
    [entete('Technicien'), entete('Tickets ouverts')],
    ...stats.chargeParTechnicien.map((r) => [
      { value: r.absenceJusquau ? `${r.technicien} (absent jusqu'au ${r.absenceJusquau})` : r.technicien },
      nombre(r.count),
    ]),
    [],
    [entete('Satisfaction'), entete('Nombre')],
    ...[...stats.repartitionSatisfaction]
      .reverse()
      .map((r) => [{ value: `${r.note} étoile${r.note > 1 ? 's' : ''}` }, nombre(r.count)]),
  ];

  await writeXlsxFile([
    { data: synthese, sheet: 'Synthèse', columns: [{ width: 40 }, { width: 14 }, { width: 20 }] },
    { data: repartitions, sheet: 'Répartitions', columns: [{ width: 28 }, { width: 18 }] },
  ]).toFile(nomFichier('xlsx'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Export PDF — titre, filtres appliqués, tableaux stylés et pagination.
// ─────────────────────────────────────────────────────────────────────────────
export function exporterStatistiquesPdf(
  stats: StatistiquesTickets,
  indicateurs: IndicateursTableau,
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
  doc.text(doc.splitTextToSize(DEFINITIONS.join(' '), 182), 14, finalY() + 5);
  const apresDefinitions = finalY() + 14;

  let premiere = true;
  const section = (titre: string, tete: string[], corps: string[][]) => {
    const y = premiere ? apresDefinitions : finalY() + 8;
    premiere = false;
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
  section(
    'Charge par technicien',
    ['Technicien', 'Tickets ouverts'],
    // Même mention qu'à l'écran : sans elle, l'export contredirait le tableau de bord.
    stats.chargeParTechnicien.map((r) => [
      r.absenceJusquau ? `${r.technicien} (absent jusqu'au ${r.absenceJusquau})` : r.technicien,
      pdf(r.count),
    ]),
  );
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
