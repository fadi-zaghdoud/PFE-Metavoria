// Contraste des couples texte / fond, dans les DEUX thèmes, calculé à partir des jetons
// d'index.css (et de la palette Tailwind qu'ils référencent).
//
// Rapport WCAG 2 : (L1 + 0,05) / (L2 + 0,05), L = luminance relative. Les aplats
// translucides (fonds d'état en sombre, color-mix(… P%, transparent)) sont d'abord
// composés sur leur fond réel — c'est ce que l'œil voit.
//
// Seuils : 4,5:1 pour le texte (WCAG AA). Le script échoue si un couple de texte passe
// sous son seuil. Les contours de contrôles et les glyphes décoratifs sont affichés pour
// information, sans faire échouer.
//
// GRAPHIQUES (seconde partie) : chaque marque à 3:1 sur la carte (WCAG 1.4.11) ; la palette
// de l'anneau et le couple créés / résolus dans la bande de luminance et au-dessus du
// plancher de saturation de leur thème, avec des teintes voisines séparées d'au moins 15 en
// vision normale et 8 sous protanopie et deutéranopie (distance OKLab ×100, simulation de
// Machado, Oliveira et Fernandes 2009, sévérité 1) ; la rampe des priorités monotone, à
// 0,06 de luminance d'un cran à l'autre, et chacune de ses marches à 3:1 comme toute marque.
//
// Lancer : npm run verifier:contrastes

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lire = (chemin) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf-8');
const CSS = lire('../src/index.css');
const PALETTE = lire('../node_modules/tailwindcss/theme.css');

// ── Lecture des définitions ──────────────────────────────────────────────────────────
function definitions(bloc) {
  const defs = {};
  for (const m of bloc.matchAll(/(--[\w-]+):([^;]*);/g)) defs[m[1]] = m[2].trim();
  return defs;
}
function blocs(source, ouverture) {
  const resultats = [];
  let i = source.indexOf(ouverture);
  while (i !== -1) {
    const debut = source.indexOf('{', i) + 1;
    let profondeur = 1;
    let j = debut;
    while (profondeur > 0 && j < source.length) {
      if (source[j] === '{') profondeur++;
      else if (source[j] === '}') profondeur--;
      j++;
    }
    resultats.push(source.slice(debut, j - 1));
    i = source.indexOf(ouverture, j);
  }
  return resultats;
}
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const css = sansCommentaires(CSS);
const palette = definitions(sansCommentaires(PALETTE));
const clair = { ...palette, ...Object.assign({}, ...blocs(css, '@theme').map(definitions)) };
const sombre = { ...clair, ...Object.assign({}, ...blocs(css, '.dark').map(definitions)) };

// ── Couleurs : hex, rgb(), oklch(), color-mix(… P%, transparent), var() ──────────────
function oklchVersSrgb(L, C, H) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
  return lin.map((v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
}

// color-mix(in oklab, <couleur> P%, transparent) : la couleur, avec une opacité de P %.
function lireMelange(v) {
  const ouverture = 'color-mix(in oklab,';
  const fermeture = 'transparent)';
  if (!v.startsWith(ouverture) || !v.endsWith(fermeture)) return null;
  const interieur = v.slice(ouverture.length, -fermeture.length).trim().replace(/,$/, '').trim();
  const espace = interieur.lastIndexOf(' ');
  return { base: interieur.slice(0, espace), pourcentage: Number.parseFloat(interieur.slice(espace + 1)) };
}

// rgb(r g b) ou rgb(r g b / a), notation à espaces.
function lireRgb(v) {
  if (!v.startsWith('rgb(') || !v.endsWith(')')) return null;
  const [canaux, alpha] = v.slice(4, -1).split('/');
  const [r, g, b] = canaux.trim().split(/\s+/).map((c) => Number(c) / 255);
  return { rvb: [r, g, b], alpha: alpha === undefined ? 1 : Number(alpha) };
}

function couleur(valeur, defs, profondeur = 0) {
  if (profondeur > 10) throw new Error(`Référence circulaire : ${valeur}`);
  const v = valeur.trim();
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  if (ref) {
    if (!(ref[1] in defs)) throw new Error(`Variable inconnue : ${ref[1]}`);
    return couleur(defs[ref[1]], defs, profondeur + 1);
  }
  const melange = lireMelange(v);
  if (melange) {
    const base = couleur(melange.base, defs, profondeur + 1);
    return { rvb: base.rvb, alpha: base.alpha * (melange.pourcentage / 100) };
  }
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return { rvb: [0, 2, 4].map((k) => Number.parseInt(h.slice(k, k + 2), 16) / 255), alpha: 1 };
  }
  const rgb = lireRgb(v);
  if (rgb) return rgb;
  const ok = v.match(/^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (ok) return { rvb: oklchVersSrgb(Number(ok[1]) / 100, Number(ok[2]), Number(ok[3])), alpha: 1 };
  throw new Error(`Couleur non reconnue : ${v}`);
}

// Compose une couleur (éventuellement translucide) sur un fond opaque, en sRGB.
const composer = (dessus, dessous) => dessus.rvb.map((c, k) => dessus.alpha * c + (1 - dessus.alpha) * dessous[k]);
const lineaire = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * lineaire(r) + 0.7152 * lineaire(g) + 0.0722 * lineaire(b);
const rapport = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// Fond réel d'un jeton : composé sur la surface, elle-même opaque.
function fondReel(jeton, defs, support = 'surface') {
  const surface = couleur(`var(--color-${support})`, defs);
  const base = composer(surface, [1, 1, 1]);
  return composer(couleur(`var(--color-${jeton})`, defs), base);
}
function mesurer(texte, fond, defs, support) {
  const f = fondReel(fond, defs, support);
  return rapport(composer(couleur(`var(--color-${texte})`, defs), f), f);
}

// ── Couples vérifiés ─────────────────────────────────────────────────────────────────
const TEXTE = 4.5;
const couples = [];
const ajouter = (texte, fond, seuil = TEXTE, bloquant = true, support = 'surface', note = '') =>
  couples.push({ texte, fond, seuil, bloquant, support, note });

for (const t of ['texte', 'texte-2', 'texte-3', 'texte-4'])
  for (const f of ['fond', 'surface', 'surface-2', 'surface-3']) ajouter(t, f);
ajouter('texte-sur-encre', 'encre', TEXTE, true, 'encre', 'panneau de la connexion');
for (const t of ['marque', 'marque-fort']) for (const f of ['surface', 'surface-2', 'marque-fond']) ajouter(t, f);
ajouter('marque-fort', 'marque-fond-2');
// États : le TEXTE coloré passe par `texte` / `texte-fort` (4,5:1) ; `accent` est réservé
// aux icônes et graphismes, soumis au seuil des éléments non textuels (WCAG 1.4.11 : 3:1).
const ICONE = 3;
for (const e of ['succes', 'alerte', 'danger', 'info']) {
  for (const t of ['texte', 'texte-fort']) ajouter(`${e}-${t}`, `${e}-fond`);
  ajouter(`${e}-texte`, `${e}-fond-2`);
  ajouter(`${e}-texte`, 'surface', TEXTE, true, 'surface', 'texte d\'état sur carte');
  ajouter(`${e}-texte`, 'surface-2', TEXTE, true, 'surface', 'texte d\'état sur encart');
  ajouter(`${e}-accent`, 'surface', ICONE, true, 'surface', 'icône sur carte');
  ajouter(`${e}-accent`, `${e}-fond`, ICONE, true, 'surface', 'icône sur fond d\'état');
}
// Pour information (non bloquant) : contours de champs, glyphes décoratifs.
ajouter('bordure-forte', 'surface', 3, false, 'surface', 'contour de champ (WCAG 1.4.11 : 3:1)');
ajouter('bordure-survol', 'surface', 3, false, 'surface', 'contour de champ survolé');
ajouter('decor', 'surface', 3, false, 'surface', 'glyphe décoratif — sans exigence');

let echecs = 0;
const f1 = (x) => x.toFixed(1).replace('.', ',');
const f2 = (x) => x.toFixed(2).replace('.', ',');
console.log('Couple (texte sur fond)                     Clair     Sombre    Seuil');
for (const c of couples) {
  const rc = mesurer(c.texte, c.fond, clair, c.support);
  const rs = mesurer(c.texte, c.fond, sombre, c.support);
  const ok = (r) => r >= c.seuil;
  let etat = '  ';
  if (!(ok(rc) && ok(rs))) etat = c.bloquant ? '✗ ' : '· ';
  if (c.bloquant && !(ok(rc) && ok(rs))) echecs++;
  const nom = `${c.texte} / ${c.fond}`.padEnd(42);
  console.log(`${etat}${nom}${(f2(rc) + ':1').padStart(8)}${ok(rc) ? ' ' : '!'} ${(f2(rs) + ':1').padStart(8)}${ok(rs) ? ' ' : '!'}  ${f2(c.seuil)}:1${c.bloquant ? '' : ' (info)'}${c.note ? '  — ' + c.note : ''}`);
}
const echecsTexte = echecs;
console.log('  (Axes, légendes et infobulles des graphiques : texte-4 et texte sur surface, ci-dessus.)');

// ── Graphiques ───────────────────────────────────────────────────────────────────────
// OKLab depuis le sRGB linéaire (Ottosson), distance ×100 ; simulation des dichromasies
// rouge-vert de Machado, Oliveira et Fernandes (2009), sévérité 1, en RVB linéaire.
function oklab(rvb) {
  const [r, g, b] = rvb.map(lineaire);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const MACHADO = {
  protanopie: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopie: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function simuler(rvb, matrice) {
  const lin = rvb.map(lineaire);
  return matrice.map((ligne) => gamma(Math.min(1, Math.max(0, ligne[0] * lin[0] + ligne[1] * lin[1] + ligne[2] * lin[2]))));
}
const distance = (a, b) => {
  const [p, q] = [oklab(a), oklab(b)];
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};
const distanceCvd = (a, b) =>
  Math.min(...Object.values(MACHADO).map((m) => distance(simuler(a, m), simuler(b, m))));
const luminosite = (rvb) => oklab(rvb)[0];
const saturation = (rvb) => Math.hypot(oklab(rvb)[1], oklab(rvb)[2]);

const THEMES = { clair, sombre };
const BANDE = { clair: [0.43, 0.77], sombre: [0.48, 0.67] };
const MARQUE = 3;
const NORMALE = 15;
const DALTONISME = 8;
const SATURATION_MIN = 0.1;
const ECART_RAMPE = 0.06;
const RAMPE_BORD = 3;
let echecsGraphiques = 0;
const rvbDe = (jeton, defs) => fondReel(jeton, defs);
const surfaceDe = (defs) => fondReel('surface', defs);
function verdict(ok, ligne) {
  if (!ok) echecsGraphiques++;
  console.log(`${ok ? '  ' : '✗ '}${ligne}`);
}

console.log('\nGraphiques                                  Clair     Sombre    Seuil');
// 1. Chaque marque à 3:1 sur la carte.
const MARQUES = [
  'statut-nouveau', 'statut-attente', 'statut-cours', 'statut-resolu', 'statut-clos', 'serie-accent',
  'categorie-1', 'categorie-2', 'categorie-3', 'categorie-4', 'categorie-5', 'categorie-6',
  'categorie-aucune', 'avis-negatif', 'avis-neutre', 'avis-positif',
  'priorite-faible', 'priorite-moyenne', 'priorite-haute', 'priorite-critique',
];
for (const jeton of MARQUES) {
  const [rc, rs] = ['clair', 'sombre'].map((t) => rapport(rvbDe(jeton, THEMES[t]), surfaceDe(THEMES[t])));
  verdict(rc >= MARQUE && rs >= MARQUE,
    `${`${jeton} / surface`.padEnd(42)}${(f2(rc) + ':1').padStart(8)}${rc >= MARQUE ? ' ' : '!'} ${(f2(rs) + ':1').padStart(8)}${rs >= MARQUE ? ' ' : '!'}  ${f2(MARQUE)}:1  — marque de graphique`);
}

// 2. Séries distinguées par la couleur : bande, saturation, voisins séparés.
function series(nom, jetons, paires, bande = true) {
  for (const t of ['clair', 'sombre']) {
    const rvb = jetons.map((j) => rvbDe(j, THEMES[t]));
    if (bande) {
      const hors = jetons.filter((_, i) => luminosite(rvb[i]) < BANDE[t][0] || luminosite(rvb[i]) > BANDE[t][1]);
      verdict(hors.length === 0, `${nom} — ${t} : luminance OKLCH dans [${BANDE[t].join(' ; ')}]${hors.length ? ` — hors bande : ${hors.join(', ')}` : ''}`);
      const ternes = jetons.filter((_, i) => saturation(rvb[i]) < SATURATION_MIN);
      verdict(ternes.length === 0, `${nom} — ${t} : saturation ≥ ${f2(SATURATION_MIN)}${ternes.length ? ` — trop ternes : ${ternes.join(', ')}` : ''}`);
    }
    let pireN = { d: Infinity }, pireC = { d: Infinity };
    for (const [i, j] of paires) {
      const n = distance(rvb[i], rvb[j]);
      const c = distanceCvd(rvb[i], rvb[j]);
      if (n < pireN.d) pireN = { d: n, p: `${jetons[i]} ↔ ${jetons[j]}` };
      if (c < pireC.d) pireC = { d: c, p: `${jetons[i]} ↔ ${jetons[j]}` };
    }
    verdict(pireN.d >= NORMALE, `${nom} — ${t} : voisins en vision normale ${f1(pireN.d)} (≥ ${NORMALE}) — pire : ${pireN.p}`);
    verdict(pireC.d >= DALTONISME, `${nom} — ${t} : voisins sous daltonisme ${f1(pireC.d)} (≥ ${DALTONISME}) — pire : ${pireC.p}`);
  }
}
// Anneau : voisins (i, i+1) et bouclage (dernière ↔ première) pour 3 à 6 parts.
const CATEGORIES = ['categorie-1', 'categorie-2', 'categorie-3', 'categorie-4', 'categorie-5', 'categorie-6'];
const pairesAnneau = [];
for (let i = 0; i + 1 < CATEGORIES.length; i++) pairesAnneau.push([i, i + 1]);
for (let k = 3; k <= CATEGORIES.length; k++) pairesAnneau.push([k - 1, 0]);
series('Anneau des catégories', CATEGORIES, pairesAnneau);
// « Non classé » ferme l'anneau : il peut toucher n'importe quelle catégorie.
series('Anneau — « Non classé »', [...CATEGORIES, 'categorie-aucune'], CATEGORIES.map((_, i) => [i, CATEGORIES.length]), false);
series('Aires créés / résolus', ['serie-accent', 'statut-resolu'], [[0, 1]]);
series('Satisfaction', ['avis-negatif', 'avis-neutre', 'avis-positif'], [[0, 1], [1, 2]], false);

// 3. Rampe ordinale des priorités (de Faible à Critique) : monotone, crans visibles, et la
// marche la plus proche de la carte à 3:1 — le seuil de toute marque, sans exception : la
// jauge a montré qu'une marche à 2,98:1 se voyait mal dans le rendu.
const PRIORITES = ['priorite-faible', 'priorite-moyenne', 'priorite-haute', 'priorite-critique'];
for (const t of ['clair', 'sombre']) {
  const L = PRIORITES.map((j) => luminosite(rvbDe(j, THEMES[t])));
  const sens = t === 'clair' ? -1 : 1; // en clair la rampe fonce, en sombre elle s'éclaircit
  const monotone = L.every((l, i) => i === 0 || Math.sign(l - L[i - 1]) === sens);
  const ecartMin = Math.min(...L.slice(1).map((l, i) => Math.abs(l - L[i])));
  const bord = rapport(rvbDe(PRIORITES[0], THEMES[t]), surfaceDe(THEMES[t]));
  verdict(monotone && ecartMin >= ECART_RAMPE && bord >= RAMPE_BORD,
    `Rampe des priorités — ${t} : ${monotone ? 'monotone' : 'NON monotone'}, écart minimal ${f2(ecartMin)} (≥ ${f2(ECART_RAMPE)}), Faible à ${f2(bord)}:1 (≥ ${f2(RAMPE_BORD)})`);
}

if (echecsTexte > 0) console.error(`\n✗ ${echecsTexte} couple(s) de texte sous le seuil.`);
if (echecsGraphiques > 0) console.error(`✗ ${echecsGraphiques} contrôle(s) de graphique en échec.`);
if (echecsTexte > 0 || echecsGraphiques > 0) process.exit(1);
console.log(`\n✓ Tous les couples de texte respectent leur seuil, dans les deux thèmes (${couples.filter((c) => c.bloquant).length} couples).`);
console.log('✓ Graphiques : marques à 3:1, teintes voisines séparées, rampe des priorités conforme, dans les deux thèmes.');
