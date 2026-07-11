// =============================================================================
//  Seed de la base — catégories de tickets (§3.2 / §6.2 du cahier des charges).
//  Idempotent : relançable sans créer de doublons (upsert sur le nom unique).
//  Exécution : `npm run db:seed`.
// =============================================================================
import { prisma } from '../src/config/prisma';

const CATEGORIES = [
  { nom: 'Réseau', description: 'Connexion Internet, VPN, Wi-Fi, accès aux serveurs.' },
  { nom: 'Matériel', description: 'Postes de travail, périphériques, imprimantes, écrans.' },
  { nom: 'Logiciel', description: "Applications, licences, systèmes d'exploitation, mises à jour." },
  { nom: 'Accès', description: 'Comptes, droits, dossiers partagés, authentification.' },
  { nom: 'Autre', description: 'Demandes ne relevant pas des autres catégories.' },
];

async function main() {
  for (const categorie of CATEGORIES) {
    await prisma.categorie.upsert({
      where: { nom: categorie.nom },
      update: { description: categorie.description },
      create: categorie,
    });
  }
  console.log(`✅ ${CATEGORIES.length} catégories seedées.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌ Échec du seed :', err);
    await prisma.$disconnect();
    process.exit(1);
  });
