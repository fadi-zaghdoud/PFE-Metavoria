import type { EntreeAudit } from './auditApi';

// Mise en forme LISIBLE du détail d'une entrée d'audit.
//
// Le détail est stocké en JSON libre, parce que chaque action a ses propres champs. Le
// donner brut à l'écran reviendrait à demander à l'administrateur de lire du JSON pour
// enquêter — exactement ce que ce chantier cherche à éviter. Ce module traduit les clés,
// traduit les valeurs, et regroupe les couples « avant / après » en un seul énoncé.

// Clés volontairement MASQUÉES du détail : leur information est déjà portée ailleurs dans
// le panneau (l'acteur, la cible, le bandeau « repris de l'historique »). Les répéter
// ferait du bruit et donnerait l'impression d'un écran technique.
const CLES_MASQUEES = new Set([
  'importeDeLHistorique',
  'evenementTicketId',
  'typeEvenement',
  'parUtilisateur',
]);

const LABEL_CLE: Record<string, string> = {
  emailTente: 'E-mail saisi',
  motif: 'Motif',
  compteExistant: 'Le compte existe',
  ticketId: 'Ticket',
  utilisateurId: 'Compte',
  categorieId: 'Catégorie',
  categorieIds: 'Catégories',
  absenceId: 'Absence',
  technicienId: 'Technicien',
  demandeurId: 'Demandeur',
  cibleTechnicienId: 'Technicien visé',
  priorite: 'Priorité',
  note: 'Note',
  cle: 'Paramètre',
  nom: 'Nom',
  email: 'E-mail',
  role: 'Rôle',
  du: 'Du',
  au: 'Au',
  stamp: 'Modèle',
  statutServiceIA: 'Réponse du service IA',
  nbCaptures: 'Captures utilisées',
  entreesSupprimees: 'Entrées supprimées',
  anterieuresAu: 'Antérieures au',
  retentionMois: 'Rétention (mois)',
  raison: 'Raison',
  automatique: 'Décidée par le système',
  renomme: 'Renommée',
  solution: 'Solution',
  pieceJointeId: 'Pièce jointe',
};

// Traduction des valeurs codées. Les motifs d'échec de connexion et de repli d'affectation
// sont les plus importants : ce sont eux qui portent le « pourquoi » d'une ligne.
const LABEL_VALEUR: Record<string, string> = {
  // Échecs de connexion — les trois modes que la réponse HTTP masque délibérément.
  COMPTE_INEXISTANT: 'Aucun compte pour cet e-mail',
  MOT_DE_PASSE_INVALIDE: 'Mot de passe incorrect',
  COMPTE_DESACTIVE: 'Compte désactivé',
  COMPTE_NON_ACTIVE: 'Compte pas encore activé',
  // Motifs de choix du technicien.
  SPECIALITE: 'Spécialiste de la catégorie',
  REPLI_SPECIALISTES_ABSENTS: 'Repli — tous les spécialistes étaient absents',
  REPLI_AUCUN_SPECIALISTE: 'Repli — aucun spécialiste pour cette catégorie',
  REPLI_CHARGE: 'Repli — sur la charge de travail seule',
  AUCUN_TECHNICIEN: 'Aucun technicien disponible',
  TOUS_ABSENTS: 'Tous les techniciens étaient absents',
  TICKET_DEJA_ASSIGNE: 'Le ticket était déjà assigné',
  ECHEC_TECHNIQUE: 'Échec technique',
  // Énumérations métier.
  NOUVEAU: 'Nouveau',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
  FAIBLE: 'Faible',
  MOYENNE: 'Moyenne',
  HAUTE: 'Haute',
  CRITIQUE: 'Critique',
  EMPLOYE: 'Employé',
  TECHNICIEN: 'Technicien',
  ADMINISTRATEUR: 'Administrateur',
  MANUEL: 'Manuel',
  AUTO: 'Automatique',
  CONGE: 'Congé',
  MALADIE: 'Maladie',
  FORMATION: 'Formation',
  AUTRE: 'Autre',
};

// Ce qui a changé, selon l'action : donne son titre au couple avant/après.
// « Priorité : Moyenne → Haute » se lit ; « de : MOYENNE, vers : HAUTE » se déchiffre.
const LABEL_CHANGEMENT: Record<string, string> = {
  TICKET_STATUT: 'Statut',
  TICKET_PRIORITE: 'Priorité',
  TICKET_CATEGORIE: 'Catégorie',
  TICKET_AFFECTATION: 'Technicien',
  TICKET_DESAFFECTATION: 'Technicien',
  UTILISATEUR_ROLE: 'Rôle',
  PARAMETRE_MODIFIE: 'Valeur',
  CATEGORIE_MODIFIEE: 'Nom',
  ABSENCE_MODIFIEE: 'Période',
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

function formaterValeur(valeur: unknown, resoudre?: (id: number) => string | undefined): string {
  if (valeur === null || valeur === undefined) return '—';
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  if (Array.isArray(valeur)) {
    return valeur.length === 0 ? 'aucune' : valeur.map((v) => formaterValeur(v, resoudre)).join(', ');
  }
  if (typeof valeur === 'number') return resoudre?.(valeur) ?? String(valeur);
  if (typeof valeur === 'string') {
    if (LABEL_VALEUR[valeur]) return LABEL_VALEUR[valeur];
    // Horodatage ISO : lisible plutôt que technique.
    if (ISO_DATE.test(valeur)) {
      const d = new Date(valeur);
      if (!Number.isNaN(d.getTime())) {
        return valeur.length <= 10
          ? d.toLocaleDateString('fr-FR')
          : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
      }
    }
    return valeur;
  }
  return JSON.stringify(valeur);
}

export interface LigneDetail {
  label: string;
  valeur: string;
  // Renseigné pour un couple avant/après : l'écran affiche « avant → après ».
  avant?: string;
}

export interface OptionsFormatage {
  // Résolution d'identifiants en noms, quand la page les connaît (comptes, catégories).
  nomCategorie?: (id: number) => string | undefined;
  nomUtilisateur?: (id: number) => string | undefined;
}

export function formaterDetails(entree: EntreeAudit, options: OptionsFormatage = {}): LigneDetail[] {
  const details = entree.details;
  if (!details) return [];

  const lignes: LigneDetail[] = [];

  // Le couple avant/après est traité en PREMIER et comme UNE seule ligne : c'est
  // l'information principale de la plupart des actions.
  if ('de' in details || 'vers' in details) {
    // Sur un changement de catégorie de ticket, `de` et `vers` sont des identifiants —
    // on les résout en noms quand la page les connaît.
    const resoudre =
      entree.action === 'TICKET_CATEGORIE' ? options.nomCategorie : undefined;
    lignes.push({
      label: LABEL_CHANGEMENT[entree.action] ?? 'Modification',
      avant: formaterValeur(details.de, resoudre),
      valeur: formaterValeur(details.vers, resoudre),
    });
  }

  for (const [cle, valeur] of Object.entries(details)) {
    if (cle === 'de' || cle === 'vers' || CLES_MASQUEES.has(cle)) continue;
    // La cible est déjà affichée en tête du panneau : ne pas la répéter dans le détail.
    if (cle === 'ticketId' && entree.cibleType === 'TICKET') continue;
    if (cle === 'utilisateurId' && entree.cibleType === 'UTILISATEUR') continue;
    if (cle === 'absenceId' && entree.cibleType === 'ABSENCE') continue;

    const resoudre =
      cle === 'categorieId' || cle === 'categorieIds'
        ? options.nomCategorie
        : cle === 'technicienId' || cle === 'demandeurId' || cle === 'cibleTechnicienId'
          ? options.nomUtilisateur
          : undefined;

    lignes.push({ label: LABEL_CLE[cle] ?? cle, valeur: formaterValeur(valeur, resoudre) });
  }

  return lignes;
}

// Nature de l'acteur — trois cas qu'il ne faut surtout pas confondre.
export function qualifierActeur(entree: EntreeAudit): { libelle: string; explication: string } {
  if (entree.acteurId !== null) {
    return { libelle: 'Compte confirmé', explication: "L'action a été faite par ce compte authentifié." };
  }
  if (entree.acteurNom === 'Système') {
    return {
      libelle: 'Système',
      explication: "Décidée par l'application, sans intervention humaine — aucune adresse IP associée.",
    };
  }
  return {
    libelle: 'Non authentifié',
    explication:
      "Identité PRÉSENTÉE lors de la tentative, jamais vérifiée : aucun compte ne lui correspond.",
  };
}

// Qualification d'une adresse IP absente. Deux absences, deux raisons — les confondre
// reviendrait à laisser deviner.
export function qualifierIpAbsente(entree: EntreeAudit): string {
  return entree.details?.importeDeLHistorique === true
    ? "Repris de l'historique des tickets : le contexte de requête n'était pas enregistré à l'époque."
    : "Action du système : aucune adresse IP d'utilisateur n'est associée.";
}
