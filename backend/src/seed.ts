// =============================================================================
//  Seed de la base — catégories de tickets (§3.2 / §6.2 du cahier des charges)
//  et amorçage de l'administrateur initial.
//
//  Idempotent : relançable sans créer de doublons. Il est donc exécuté à CHAQUE
//  démarrage du conteneur backend, juste après les migrations.
//
//  POURQUOI CE FICHIER VIT DANS `src/` ET NON DANS `prisma/` : `tsconfig.json`
//  ne compile que `src/**/*.ts`. Tant qu'il était sous `prisma/`, le seed
//  n'existait qu'en TypeScript et exigeait `tsx` — une devDependency, absente de
//  l'image de production. Résultat mesuré sur une pile fraîchement déployée :
//  migrations appliquées, sept services `healthy`, et ZÉRO catégorie en base —
//  donc aucun ticket catégorisable, une administration vide et un service IA
//  incapable de lire ses catégories. Ici, il est compilé en `dist/seed.js` et
//  s'exécute avec le seul `node`.
//
//  Exécution : automatique au démarrage ; manuellement `npm run db:seed`.
// =============================================================================
import bcrypt from 'bcryptjs';

import { env } from './config/env';
import { prisma } from './config/prisma';

const CATEGORIES = [
  { nom: 'Réseau', description: 'Connexion Internet, VPN, Wi-Fi, accès aux serveurs.' },
  { nom: 'Matériel', description: 'Postes de travail, périphériques, imprimantes, écrans.' },
  { nom: 'Logiciel', description: "Applications, licences, systèmes d'exploitation, mises à jour." },
  { nom: 'Accès', description: 'Comptes, droits, dossiers partagés, authentification.' },
  { nom: 'Autre', description: 'Demandes ne relevant pas des autres catégories.' },
];

// Longueur minimale du mot de passe de l'administrateur amorcé. On ne réutilise
// pas le schéma d'inscription (il vit côté validateurs HTTP) mais on refuse un
// secret trivial pour un compte qui détient tous les droits.
const LONGUEUR_MIN_MOT_DE_PASSE = 12;

async function semerCategories(): Promise<void> {
  for (const categorie of CATEGORIES) {
    await prisma.categorie.upsert({
      where: { nom: categorie.nom },
      update: { description: categorie.description },
      create: categorie,
    });
  }
  console.log(`✅ ${CATEGORIES.length} catégories seedées.`);
}

async function amorcerAdministrateur(): Promise<void> {
  const email = env.ADMIN_EMAIL?.trim();
  const motDePasse = env.ADMIN_PASSWORD;

  // Pas de compte administrateur par défaut codé en dur : ce serait une porte
  // dérobée livrée avec le produit. Sans ces deux variables, on ne crée rien.
  if (!email || !motDePasse) {
    console.log('ℹ️  ADMIN_EMAIL / ADMIN_PASSWORD absents — aucun administrateur amorcé.');
    return;
  }

  // Amorçage, pas réinitialisation : dès qu'UN administrateur existe, ces
  // variables n'ont plus aucun effet — elles ne peuvent donc pas servir à
  // reprendre la main sur une instance en service.
  const existant = await prisma.utilisateur.findFirst({
    where: { role: 'ADMINISTRATEUR' },
    select: { email: true },
  });
  if (existant) {
    console.log(`ℹ️  Un administrateur existe déjà (${existant.email}) — amorçage ignoré.`);
    return;
  }

  if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
    throw new Error(
      `ADMIN_PASSWORD trop court (${motDePasse.length} caractères, minimum ${LONGUEUR_MIN_MOT_DE_PASSE}).`,
    );
  }

  await prisma.utilisateur.create({
    data: {
      nom: 'Administrateur',
      prenom: 'Initial',
      email,
      motDePasse: await bcrypt.hash(motDePasse, env.BCRYPT_SALT_ROUNDS),
      role: 'ADMINISTRATEUR',
    },
  });
  console.log(`✅ Administrateur initial créé (${email}).`);
}

async function main(): Promise<void> {
  await semerCategories();
  await amorcerAdministrateur();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // Sortie non nulle : la commande de démarrage enchaîne avec `&&`, le serveur
    // ne démarrera donc pas sur une base incomplète. Échouer bruyamment plutôt
    // que servir une application vide.
    console.error('❌ Échec du seed :', err);
    await prisma.$disconnect();
    process.exit(1);
  });
