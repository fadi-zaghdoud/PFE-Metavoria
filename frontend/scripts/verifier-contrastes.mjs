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
if (echecs > 0) {
  console.error(`\n✗ ${echecs} couple(s) de texte sous le seuil.`);
  process.exit(1);
}
console.log(`\n✓ Tous les couples de texte respectent leur seuil, dans les deux thèmes (${couples.filter((c) => c.bloquant).length} couples).`);
