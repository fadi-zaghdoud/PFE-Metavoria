import writeXlsxFile from 'write-excel-file/browser';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StatistiquesTickets } from '../../types/ticket';
import { LABEL_PRIORITE, LABEL_STATUT } from '../tickets/ticket-ui';

const COULEUR_MARQUE = '#4f46e5';
const nomFichier = (ext: string) => `rapport-tickets-${new Date().toISOString().slice(0, 10)}.${ext}`;

const fmtValeur = (v: number | null) => (v == null ? '—' : String(v));

// ─────────────────────────────────────────────────────────────────────────────
// Export Excel (.xlsx) — deux feuilles : Synthèse (KPI) et Répartitions.
// ─────────────────────────────────────────────────────────────────────────────
const entete = (value: string) =>
  ({ value, fontWeight: 'bold', color: '#ffffff', backgroundColor: COULEUR_MARQUE, align: 'left' }) as const;

export async function exporterStatistiquesExcel(stats: StatistiquesTickets, resumeFiltres: string) {
  const dateStr = new Date().toLocaleString('fr-FR');

  const synthese = [
    [{ value: 'Rapport — Tableau de bord tickets', fontWeight: 'bold' } as const],
    [{ value: `Généré le ${dateStr}`, color: '#64748b' } as const],
    [{ value: resumeFiltres ? `Filtres : ${resumeFiltres}` : 'Aucun filtre appliqué', color: '#64748b' } as const],
    [],
    [entete('Indicateur'), entete('Valeur')],
    [{ value: 'Tickets ouverts' }, { value: fmtValeur(stats.ticketsOuverts) }],
    [{ value: 'Résolus / clôturés' }, { value: fmtValeur(stats.ticketsResolus + stats.ticketsClotures) }],
    [{ value: 'Temps de résolution moyen (h)' }, { value: fmtValeur(stats.tempsResolutionMoyenHeures) }],
    [{ value: 'Délai de prise en charge moyen (h)' }, { value: fmtValeur(stats.delaiPriseEnChargeMoyenHeures) }],
    [{ value: 'Satisfaction moyenne (/5)' }, { value: fmtValeur(stats.satisfactionMoyenne) }],
    [{ value: "Nombre d'évaluations" }, { value: fmtValeur(stats.nombreEvaluations) }],
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
    { data: synthese, sheet: 'Synthèse', columns: [{ width: 36 }, { width: 16 }] },
    { data: repartitions, sheet: 'Répartitions', columns: [{ width: 28 }, { width: 18 }] },
  ]).toFile(nomFichier('xlsx'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Export PDF — titre, filtres appliqués, tableaux stylés et pagination.
// ─────────────────────────────────────────────────────────────────────────────
export function exporterStatistiquesPdf(stats: StatistiquesTickets, resumeFiltres: string) {
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
    head: [['Indicateur', 'Valeur']],
    body: [
      ['Tickets ouverts', fmtValeur(stats.ticketsOuverts)],
      ['Résolus / clôturés', fmtValeur(stats.ticketsResolus + stats.ticketsClotures)],
      ['Temps de résolution moyen (h)', fmtValeur(stats.tempsResolutionMoyenHeures)],
      ['Délai de prise en charge moyen (h)', fmtValeur(stats.delaiPriseEnChargeMoyenHeures)],
      ['Satisfaction moyenne (/5)', fmtValeur(stats.satisfactionMoyenne)],
      ["Nombre d'évaluations", fmtValeur(stats.nombreEvaluations)],
    ],
    headStyles: teteStyle,
    styles: { fontSize: 9 },
  });

  const section = (titre: string, tete: string[], corps: string[][]) => {
    const y = finalY() + 8;
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(titre, 14, y);
    autoTable(doc, { startY: y + 2, head: [tete], body: corps, headStyles: teteStyle, styles: { fontSize: 9 } });
  };

  section(
    'Répartition par statut',
    ['Statut', 'Nombre'],
    stats.repartitionStatut.map((r) => [LABEL_STATUT[r.statut], String(r.count)]),
  );
  section(
    'Répartition par priorité',
    ['Priorité', 'Nombre'],
    stats.repartitionPriorite.map((r) => [LABEL_PRIORITE[r.priorite], String(r.count)]),
  );
  section(
    'Répartition par catégorie',
    ['Catégorie', 'Nombre'],
    stats.repartitionCategorie.map((r) => [r.categorie, String(r.count)]),
  );
  section(
    'Charge par technicien',
    ['Technicien', 'Tickets ouverts'],
    // Même mention qu'à l'écran : sans elle, l'export contredirait le tableau de bord.
    stats.chargeParTechnicien.map((r) => [
      r.absenceJusquau ? `${r.technicien} (absent jusqu'au ${r.absenceJusquau})` : r.technicien,
      String(r.count),
    ]),
  );
  if (stats.nombreEvaluations > 0) {
    section(
      'Répartition des évaluations',
      ['Note', 'Nombre'],
      [...stats.repartitionSatisfaction].reverse().map((r) => [`${r.note} étoile${r.note > 1 ? 's' : ''}`, String(r.count)]),
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
