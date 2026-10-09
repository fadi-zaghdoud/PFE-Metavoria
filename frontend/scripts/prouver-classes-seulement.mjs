// Preuve qu'un fichier ne diffère d'une révision de référence QUE par des classes CSS.
//
// Les deux versions sont analysées par le compilateur TypeScript, puis comparées nœud par
// nœud. Les commentaires ne font pas partie de l'arbre ; une chaîne dont TOUS les mots sont
// des classes Tailwind (et dont au moins un porte un tiret ou une variante, pour ne jamais
// confondre une valeur comme 'primary' avec une classe) est remplacée par un jeton neutre.
// Si les deux arbres ainsi normalisés sont identiques, aucune logique, aucun texte, aucune
// propriété ni aucun élément n'a changé : seules des listes de classes diffèrent. Le script
// les affiche, mot par mot.
//
// Lancer : node scripts/prouver-classes-seulement.mjs <révision> <fichier.tsx>…
//   ex.   node scripts/prouver-classes-seulement.mjs v1.0 src/pages/CreateTicketPage.tsx

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const [revision, ...chemins] = process.argv.slice(2);
if (!revision || chemins.length === 0) {
  console.error('Usage : node scripts/prouver-classes-seulement.mjs <révision> <fichier.tsx>…');
  process.exit(2);
}

const MOT_CLASSE = /^(?:[@a-z0-9-]+(?:\[[^\]\s]+\])?:)*!?-?[@a-z0-9][@a-z0-9.-]*(?:\/\d{1,3})?(?:\[[^\]\s]+\])?$|^\[[^\]\s]+\]$/;
const estListeDeClasses = (texte) => {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  return mots.length > 0 && mots.every((m) => MOT_CLASSE.test(m)) && mots.some((m) => /[-:[]/.test(m));
};

// Sérialise l'arbre : type de chaque nœud, texte des identifiants et littéraux. Les listes de
// classes deviennent « ⟨classes⟩ » et sont collectées à part, dans l'ordre.
function serialiser(source, nom) {
  const fichier = ts.createSourceFile(nom, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const jetons = [];
  const classes = [];
  const visiter = (noeud) => {
    const genre = ts.SyntaxKind[noeud.kind];
    if (ts.isStringLiteral(noeud) || ts.isNoSubstitutionTemplateLiteral(noeud)) {
      if (estListeDeClasses(noeud.text)) {
        jetons.push(`${genre}:⟨classes⟩`);
        classes.push(noeud.text);
      } else jetons.push(`${genre}:${JSON.stringify(noeud.text)}`);
      return;
    }
    if (ts.isJsxText(noeud)) {
      const texte = noeud.text.replace(/\s+/g, ' ').trim();
      if (texte) jetons.push(`JsxText:${JSON.stringify(texte)}`);
      return;
    }
    if (ts.isIdentifier(noeud) || ts.isPrivateIdentifier(noeud) || ts.isNumericLiteral(noeud)
      || ts.isTemplateHead(noeud) || ts.isTemplateMiddle(noeud) || ts.isTemplateTail(noeud)) {
      jetons.push(`${genre}:${noeud.text}`);
      return;
    }
    jetons.push(genre);
    ts.forEachChild(noeud, visiter);
  };
  visiter(fichier);
  return { jetons, classes };
}

const mots = (listes) => listes.flatMap((l) => l.trim().split(/\s+/));
function multiDiff(avant, apres) {
  const compte = new Map();
  for (const m of avant) compte.set(m, (compte.get(m) ?? 0) - 1);
  for (const m of apres) compte.set(m, (compte.get(m) ?? 0) + 1);
  const retires = [], ajoutes = [];
  for (const [m, n] of compte) {
    for (let i = 0; i < -n; i++) retires.push(m);
    for (let i = 0; i < n; i++) ajoutes.push(m);
  }
  return { retires: retires.sort(), ajoutes: ajoutes.sort() };
}

let echec = false;
for (const chemin of chemins) {
  const rel = chemin.replace(/\\/g, '/');
  const ancien = execFileSync('git', ['show', `${revision}:frontend/${rel}`], { encoding: 'utf-8' });
  const nouveau = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf-8');
  const a = serialiser(ancien, rel);
  const b = serialiser(nouveau, rel);
  let premierEcart = -1;
  const n = Math.max(a.jetons.length, b.jetons.length);
  for (let i = 0; i < n; i++) if (a.jetons[i] !== b.jetons[i]) { premierEcart = i; break; }
  const listesChangees = a.classes.filter((c, i) => c !== b.classes[i]).length;
  const { retires, ajoutes } = multiDiff(mots(a.classes), mots(b.classes));
  console.log(`\n${rel} — ${revision} → arbre de travail`);
  if (premierEcart >= 0) {
    echec = true;
    console.log(`  ✗ STRUCTURE DIFFÉRENTE au nœud ${premierEcart} :`);
    console.log(`      ${revision} : ${a.jetons.slice(premierEcart, premierEcart + 6).join(' · ')}`);
    console.log(`      travail : ${b.jetons.slice(premierEcart, premierEcart + 6).join(' · ')}`);
    continue;
  }
  console.log(`  ✓ Arbres identiques hors listes de classes (${a.jetons.length} nœuds comparés).`);
  console.log(`  ${listesChangees} liste(s) de classes modifiée(s) sur ${a.classes.length}.`);
  console.log(`  Classes retirées (${retires.length}) : ${retires.join(' ') || '—'}`);
  console.log(`  Classes ajoutées (${ajoutes.length}) : ${ajoutes.join(' ') || '—'}`);
}
process.exit(echec ? 1 : 0);
