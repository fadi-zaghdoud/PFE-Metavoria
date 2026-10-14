// Garde-fou du mode sombre : aucune couleur écrite « pour le thème clair seulement ».
//
// Les composants doivent passer par les jetons sémantiques d'index.css (surface, texte,
// bordure, succes-*, alerte-*…), qui changent de valeur avec le thème. Une classe Tailwind
// de palette écrite en dur garde la même couleur dans les deux thèmes : un écran qui en
// contient devient illisible en sombre. Ce script échoue si une telle classe apparaît.
//
// INTERDIT :
//   - toute nuance neutre de palette (slate, gray, zinc, neutral, stone) ;
//   - le blanc et le noir pleins en fond, anneau, bordure ou dégradé (bg-white, ring-white…),
//     et le blanc translucide à 50 % et plus en fond ;
//   - les nuances « claires seulement » des teintes d'état et de marque : fonds et dégradés
//     50 à 200, textes 600 à 950, bordures et anneaux 50 à 300 — sauf si la même ligne
//     porte explicitement leur pendant `dark:` pour la même propriété.
// AUTORISÉ : `text-white`, les blancs translucides sur les surfaces de marque (bg-white/10,
// ring-white/20…), les teintes moyennes (300 à 500), les aplats soutenus des boutons.
//
// APLAT (consigne du 09/10/2026) : aucun dégradé, effet de verre, flou ni lueur — ils passent
// mal au vidéoprojecteur et gênent le mode sombre. INTERDIT dans src/ (composants et
// index.css) : utilitaires de dégradé (bg-gradient-*, bg-linear-*, bg-radial-*, bg-conic-*,
// text-gradient), toute fonction CSS *-gradient(), les utilitaires backdrop-* et
// backdrop-filter, le flou (blur-*, blur()), les lueurs (shadow-glow) et la classe glass.
//
// Lancer : npm run verifier:couleurs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../src', import.meta.url));
// Palette propre au document PDF/Excel exporté, indépendante du thème : rien à vérifier.
const EXCLUS = new Set(['features/statistiques/exportRapport.ts']);

const NEUTRES = 'slate|gray|zinc|neutral|stone';
const TEINTES =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|primary|accent';
const UTILITAIRES =
  'bg|text|border(?:-[trblxyse])?|ring|ring-offset|from|via|to|fill|stroke|divide|placeholder|outline|shadow|decoration|caret';
const CLASSE = new RegExp(
  String.raw`(?<![\w-])((?:[a-z0-9-]+:)*)(${UTILITAIRES})-([a-z]+)(?:-(\d{2,3}))?(?:\/(\d{1,3}))?(?![\w-])`,
  'g',
);
const EST_NEUTRE = new RegExp(`^(${NEUTRES})$`);
const EST_TEINTE = new RegExp(`^(${TEINTES})$`);

const famille = (utilitaire) => (utilitaire.startsWith('border') ? 'border' : utilitaire);

function nuanceClaireSeulement(util, nuance) {
  if (['bg', 'from', 'via', 'to'].includes(util)) return nuance <= 200;
  if (['text', 'fill', 'stroke', 'decoration', 'caret', 'placeholder'].includes(util)) return nuance >= 600;
  if (['border', 'ring', 'divide', 'outline', 'ring-offset'].includes(util)) return nuance <= 300;
  return false;
}

// Blanc : autorisé en texte, et translucide sur les surfaces de marque — sauf en fond à
// 50 % et plus, qui tient lieu de surface et doit passer par le jeton.
function blancAutorise(util, alpha) {
  if (util === 'text') return true;
  if (alpha === null) return false;
  return util !== 'bg' || alpha < 50;
}

// Paire explicite sur la même ligne : un `dark:` pour la même propriété, éventuellement
// combiné à d'autres variantes (dark:hover:border-…).
const aSonPendantSombre = (ligne, utilitaire) => new RegExp(`dark:(?:[a-z0-9-]+:)*${utilitaire}-`).test(ligne);

function verdict(variantes, utilitaire, couleur, nuanceTexte, alphaTexte, ligne) {
  if (variantes.includes('dark:')) return null; // pendant sombre explicite, par définition voulu
  const util = famille(utilitaire);
  if (EST_NEUTRE.test(couleur)) return 'nuance neutre de palette : passer par un jeton (surface, texte, bordure…)';
  if (couleur === 'black') return 'noir écrit en dur';
  if (couleur === 'white') {
    const alpha = alphaTexte ? Number(alphaTexte) : null;
    if (blancAutorise(util, alpha)) return null;
    return 'blanc plein en dur : passer par un jeton (surface…)';
  }
  const claireSeulement = EST_TEINTE.test(couleur) && nuanceTexte && nuanceClaireSeulement(util, Number(nuanceTexte));
  if (claireSeulement && !aSonPendantSombre(ligne, utilitaire)) {
    return 'nuance claire seulement : passer par un jeton d\'état ou de marque, ou ajouter son pendant dark:';
  }
  return null;
}

function* fichiers(dossier, motif = /\.(tsx?|jsx?)$/) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) yield* fichiers(chemin, motif);
    else if (motif.test(nom)) yield chemin;
  }
}

// Effets interdits par l'aplat. `glass-box` (la transparence du module IA, dans les
// commentaires) n'est pas la classe `glass` : le tiret qui suit l'exclut.
const EFFETS = [
  [/(?<![\w-])(?:[a-z0-9-]+:)*bg-(?:gradient|linear|radial|conic)-/g, 'dégradé'],
  [/(?<![\w-])text-gradient(?![\w-])/g, 'texte en dégradé'],
  [/[a-z-]*-gradient\(/g, 'dégradé CSS'],
  [/(?<![\w-])(?:[a-z0-9-]+:)*backdrop-[a-z]+/g, 'effet de verre (arrière-plan filtré)'],
  [/(?<![\w-])(?:[a-z0-9-]+:)*blur-(?:none|xs|sm|md|lg|xl|[2-3]xl|\[[^\]]*\])(?![\w-])/g, 'flou'],
  [/(?<![\w-])blur\(/g, 'flou CSS'],
  [/shadow-glow/g, 'lueur'],
  [/(?<![\w-])glass(?![\w-])/g, 'effet de verre'],
];
// Un texte en jeton rendu translucide (text-alerte-texte/90…) échappe au calcul de
// `verifier:contrastes`, qui mesure les jetons pleins : un tel texte tombait à 4,18:1.
const TEXTE_TRANSLUCIDE =
  /(?<![\w-])(?:[a-z0-9-]+:)*text-(?:texte(?:-[234])?|marque(?:-fort)?|(?:succes|alerte|danger|info)-texte(?:-fort)?)\/\d{1,3}(?![\w-])/g;

const ecarts = [];
let examines = 0;
for (const chemin of fichiers(RACINE)) {
  const rel = relative(RACINE, chemin).split(sep).join('/');
  if (EXCLUS.has(rel)) continue;
  examines++;
  readFileSync(chemin, 'utf-8')
    .split('\n')
    .forEach((ligne, i) => {
      for (const m of ligne.matchAll(CLASSE)) {
        const [classe, variantes, utilitaire, couleur, nuance, alpha] = m;
        const raison = verdict(variantes, utilitaire, couleur, nuance, alpha, ligne);
        if (raison) ecarts.push(`${rel}:${i + 1}  ${classe}  — ${raison}`);
      }
    });
}

// Aplat : composants ET feuille de style (la palette du PDF/Excel reste exclue).
const effets = [];
for (const chemin of fichiers(RACINE, /\.(tsx?|jsx?|css)$/)) {
  const rel = relative(RACINE, chemin).split(sep).join('/');
  if (EXCLUS.has(rel)) continue;
  readFileSync(chemin, 'utf-8')
    .split('\n')
    .forEach((ligne, i) => {
      for (const [motif, nature] of EFFETS)
        for (const m of ligne.matchAll(motif)) effets.push(`${rel}:${i + 1}  ${m[0]}  — ${nature}`);
      for (const m of ligne.matchAll(TEXTE_TRANSLUCIDE))
        effets.push(`${rel}:${i + 1}  ${m[0]}  — texte translucide : contraste non vérifiable, passer au jeton plein`);
    });
}

if (ecarts.length > 0) {
  console.error(`✗ ${ecarts.length} couleur(s) écrite(s) pour le thème clair seulement :\n`);
  for (const e of ecarts) console.error(`  ${e}`);
  console.error('\nVoir les jetons sémantiques de src/index.css.');
}
if (effets.length > 0) {
  console.error(`✗ ${effets.length} effet(s) interdit(s) par l'aplat (dégradé, verre, flou, lueur) :\n`);
  for (const e of effets) console.error(`  ${e}`);
}
if (ecarts.length > 0 || effets.length > 0) process.exit(1);
console.log(`✓ Aucune couleur réservée au thème clair (${examines} fichiers examinés).`);
console.log('✓ Aucun dégradé, effet de verre, flou ni lueur, ni texte translucide (composants et feuille de style).');
