// =============================================================================
//  Données de DÉMONSTRATION du module Tickets (Phase 3/5 du cahier des charges).
//  Aucune donnée ne vient du backend : ce jeu de données statique permet de
//  valider l'UX cible avant le câblage sur l'API réelle.
// =============================================================================

export type StatutTicket = 'NOUVEAU' | 'EN_COURS' | 'EN_ATTENTE' | 'RESOLU' | 'CLOTURE';
export type PrioriteTicket = 'FAIBLE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE';
export type CanalTicket = 'EMAIL' | 'PORTAIL' | 'TEAMS';
export type Sentiment = 'POSITIF' | 'NEUTRE' | 'FRUSTRE';

export interface PersonneDemo {
  prenom: string;
  nom: string;
  email: string;
  service?: string;
}

export interface MessageDemo {
  id: number;
  auteur: PersonneDemo;
  role: 'DEMANDEUR' | 'TECHNICIEN';
  contenu: string;
  date: Date;
  noteInterne?: boolean;
}

export interface TicketDemo {
  id: string;
  titre: string;
  description: string;
  statut: StatutTicket;
  priorite: PrioriteTicket;
  categorie: string;
  canal: CanalTicket;
  tags: string[];
  demandeur: PersonneDemo;
  technicien?: PersonneDemo;
  dateCreation: Date;
  dateMaj: Date;
  slaEcheance: Date;
  messages: MessageDemo[];
  ia: {
    resume: string;
    sentiment: Sentiment;
    confianceClassification: number; // 0..1
    suggestionReponse: string;
    ticketsSimilaires: { id: string; titre: string; similarite: number }[];
  };
}

const ilYA = (heures: number) => new Date(Date.now() - heures * 3600_000);
const dans = (heures: number) => new Date(Date.now() + heures * 3600_000);

const TECHNICIENS: PersonneDemo[] = [
  { prenom: 'Karim', nom: 'Trabelsi', email: 'karim.trabelsi@metavoria.tn', service: 'Support IT' },
  { prenom: 'Ines', nom: 'Mansouri', email: 'ines.mansouri@metavoria.tn', service: 'Support IT' },
];

export const TICKETS_DEMO: TicketDemo[] = [
  {
    id: 'TK-1042',
    titre: 'Impossible de se connecter au VPN depuis ce matin',
    description:
      "Depuis ce matin 8h, la connexion au VPN échoue avec l'erreur « Authentication failed ». J'ai redémarré mon poste et vérifié mon mot de passe, sans succès. Je suis en télétravail et bloquée pour accéder au serveur de fichiers.",
    statut: 'EN_COURS',
    priorite: 'CRITIQUE',
    categorie: 'Réseau',
    canal: 'PORTAIL',
    tags: ['vpn', 'télétravail'],
    demandeur: { prenom: 'Sarra', nom: 'Ben Ali', email: 'sarra.benali@metavoria.tn', service: 'Comptabilité' },
    technicien: TECHNICIENS[0],
    dateCreation: ilYA(5),
    dateMaj: ilYA(1),
    slaEcheance: dans(1.5),
    messages: [
      {
        id: 1,
        auteur: { prenom: 'Sarra', nom: 'Ben Ali', email: 'sarra.benali@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu:
          "Bonjour, impossible de me connecter au VPN depuis ce matin (erreur « Authentication failed »). J'ai déjà redémarré mon poste. Pouvez-vous m'aider rapidement ? Je dois clôturer la paie aujourd'hui.",
        date: ilYA(5),
      },
      {
        id: 2,
        auteur: TECHNICIENS[0],
        role: 'TECHNICIEN',
        contenu:
          "Bonjour Sarra, je prends votre demande en charge. Pouvez-vous me confirmer le message d'erreur exact et me donner le nom de votre poste (étiquette au dos du PC) ?",
        date: ilYA(4),
      },
      {
        id: 3,
        auteur: TECHNICIENS[0],
        role: 'TECHNICIEN',
        contenu: 'Compte AD verrouillé après plusieurs tentatives — déverrouillage en cours côté serveur.',
        date: ilYA(1),
        noteInterne: true,
      },
    ],
    ia: {
      resume:
        'Utilisatrice en télétravail bloquée par un échec d’authentification VPN depuis 8h. Poste redémarré sans effet. Cause probable : compte AD verrouillé. Urgence élevée (clôture de paie aujourd’hui).',
      sentiment: 'FRUSTRE',
      confianceClassification: 0.94,
      suggestionReponse:
        "Bonjour Sarra,\n\nVotre compte a été verrouillé automatiquement après plusieurs tentatives de connexion. Je viens de le déverrouiller — pouvez-vous réessayer en fermant complètement le client VPN puis en le relançant ?\n\nSi le problème persiste, réinitialisez votre mot de passe via le portail avant une nouvelle tentative.\n\nCordialement,\nL'équipe support",
      ticketsSimilaires: [
        { id: 'TK-0891', titre: 'VPN : authentification refusée après changement de mot de passe', similarite: 0.91 },
        { id: 'TK-0764', titre: 'Compte AD verrouillé — connexion impossible', similarite: 0.87 },
        { id: 'TK-0512', titre: 'Erreur VPN « Authentication failed » en télétravail', similarite: 0.82 },
      ],
    },
  },
  {
    id: 'TK-1041',
    titre: "L'imprimante du 2e étage affiche « Toner vide »",
    description:
      "L'imprimante Canon du 2e étage (près de la salle de réunion) affiche « Toner vide » depuis hier. Nous avons un audit la semaine prochaine et beaucoup de documents à imprimer.",
    statut: 'NOUVEAU',
    priorite: 'FAIBLE',
    categorie: 'Matériel',
    canal: 'EMAIL',
    tags: ['imprimante', 'consommables'],
    demandeur: { prenom: 'Mehdi', nom: 'Khelifi', email: 'mehdi.khelifi@metavoria.tn', service: 'Juridique' },
    dateCreation: ilYA(20),
    dateMaj: ilYA(20),
    slaEcheance: dans(28),
    messages: [
      {
        id: 1,
        auteur: { prenom: 'Mehdi', nom: 'Khelifi', email: 'mehdi.khelifi@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu:
          "Bonjour, l'imprimante du 2e étage affiche « Toner vide ». Pourriez-vous prévoir un remplacement avant la fin de semaine ? Merci !",
        date: ilYA(20),
      },
    ],
    ia: {
      resume:
        'Toner vide sur l’imprimante Canon du 2e étage. Demande non urgente mais échéance implicite : audit la semaine prochaine.',
      sentiment: 'NEUTRE',
      confianceClassification: 0.97,
      suggestionReponse:
        "Bonjour Mehdi,\n\nMerci pour votre signalement. Un toner de remplacement est disponible en stock — le remplacement sera effectué aujourd'hui avant 17h.\n\nCordialement,\nL'équipe support",
      ticketsSimilaires: [
        { id: 'TK-0933', titre: 'Toner vide imprimante RH', similarite: 0.95 },
        { id: 'TK-0718', titre: 'Bourrage papier imprimante 2e étage', similarite: 0.71 },
      ],
    },
  },
  {
    id: 'TK-1040',
    titre: "Demande d'accès au dossier partagé « Projets 2026 »",
    description:
      "Je viens de rejoindre l'équipe avant-vente et j'ai besoin d'un accès en lecture/écriture au dossier partagé « Projets 2026 » pour préparer les réponses aux appels d'offres.",
    statut: 'EN_ATTENTE',
    priorite: 'MOYENNE',
    categorie: 'Accès',
    canal: 'TEAMS',
    tags: ['droits', 'dossier partagé'],
    demandeur: { prenom: 'Yasmine', nom: 'Gharbi', email: 'yasmine.gharbi@metavoria.tn', service: 'Avant-vente' },
    technicien: TECHNICIENS[1],
    dateCreation: ilYA(30),
    dateMaj: ilYA(6),
    slaEcheance: dans(18),
    messages: [
      {
        id: 1,
        auteur: { prenom: 'Yasmine', nom: 'Gharbi', email: 'yasmine.gharbi@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu:
          "Bonjour, pourrais-je avoir accès au dossier « Projets 2026 » ? Mon manager (M. Slim) est en copie et peut valider.",
        date: ilYA(30),
      },
      {
        id: 2,
        auteur: TECHNICIENS[1],
        role: 'TECHNICIEN',
        contenu:
          "Bonjour Yasmine, votre demande nécessite la validation écrite de votre manager. Je viens de lui envoyer la demande d'approbation — le ticket passe en attente le temps de sa réponse.",
        date: ilYA(6),
      },
    ],
    ia: {
      resume:
        'Nouvelle arrivée en avant-vente demandant un accès lecture/écriture au partage « Projets 2026 ». En attente de validation managériale.',
      sentiment: 'POSITIF',
      confianceClassification: 0.92,
      suggestionReponse:
        "Bonjour Yasmine,\n\nVotre manager vient de valider la demande. Les droits en lecture/écriture sur « Projets 2026 » sont désormais actifs — déconnectez/reconnectez votre session pour les voir apparaître.\n\nCordialement,\nL'équipe support",
      ticketsSimilaires: [
        { id: 'TK-0987', titre: 'Accès dossier partagé Marketing', similarite: 0.89 },
        { id: 'TK-0854', titre: 'Droits en écriture sur le partage Finance', similarite: 0.84 },
      ],
    },
  },
  {
    id: 'TK-1039',
    titre: 'Outlook très lent à l’ouverture des pièces jointes',
    description:
      "Depuis la dernière mise à jour, Outlook met plus de 30 secondes à ouvrir les pièces jointes volumineuses. Le problème se produit sur les fichiers Excel principalement.",
    statut: 'EN_COURS',
    priorite: 'MOYENNE',
    categorie: 'Logiciel',
    canal: 'EMAIL',
    tags: ['outlook', 'performance'],
    demandeur: { prenom: 'Ahmed', nom: 'Bouazizi', email: 'ahmed.bouazizi@metavoria.tn', service: 'Finance' },
    technicien: TECHNICIENS[1],
    dateCreation: ilYA(48),
    dateMaj: ilYA(3),
    slaEcheance: dans(6),
    messages: [
      {
        id: 1,
        auteur: { prenom: 'Ahmed', nom: 'Bouazizi', email: 'ahmed.bouazizi@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu:
          'Bonjour, Outlook rame énormément depuis la mise à jour de la semaine dernière, surtout sur les pièces jointes Excel. Ça ralentit toute mon équipe.',
        date: ilYA(48),
      },
      {
        id: 2,
        auteur: TECHNICIENS[1],
        role: 'TECHNICIEN',
        contenu:
          "Bonjour Ahmed, merci pour le détail. Nous avons identifié un conflit avec le complément d'archivage. Pouvez-vous me dire si le problème persiste après le redémarrage d'Outlook en mode sans échec (outlook.exe /safe) ?",
        date: ilYA(3),
      },
    ],
    ia: {
      resume:
        'Lenteurs Outlook (>30 s) à l’ouverture de pièces jointes Excel depuis une mise à jour. Piste identifiée : conflit avec le complément d’archivage.',
      sentiment: 'NEUTRE',
      confianceClassification: 0.88,
      suggestionReponse:
        "Bonjour Ahmed,\n\nLe conflit vient du complément d'archivage v2.3. Nous venons de déployer la version corrigée sur votre poste — merci de redémarrer Outlook.\n\nLe temps d'ouverture devrait revenir à la normale (<3 s).\n\nCordialement,\nL'équipe support",
      ticketsSimilaires: [
        { id: 'TK-0995', titre: 'Outlook se fige à l’envoi de gros fichiers', similarite: 0.85 },
        { id: 'TK-0611', titre: 'Lenteurs générales suite mise à jour Office', similarite: 0.78 },
      ],
    },
  },
  {
    id: 'TK-1038',
    titre: 'Écran externe non détecté après mise en veille',
    description:
      "Mon écran externe Dell n'est plus détecté quand le PC sort de veille. Je dois débrancher/rebrancher le câble HDMI à chaque fois.",
    statut: 'RESOLU',
    priorite: 'FAIBLE',
    categorie: 'Matériel',
    canal: 'PORTAIL',
    tags: ['écran', 'veille'],
    demandeur: { prenom: 'Leila', nom: 'Hamdi', email: 'leila.hamdi@metavoria.tn', service: 'RH' },
    technicien: TECHNICIENS[0],
    dateCreation: ilYA(96),
    dateMaj: ilYA(24),
    slaEcheance: ilYA(24),
    messages: [
      {
        id: 1,
        auteur: { prenom: 'Leila', nom: 'Hamdi', email: 'leila.hamdi@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu: "Bonjour, mon écran externe n'est plus détecté après chaque mise en veille. Une idée ?",
        date: ilYA(96),
      },
      {
        id: 2,
        auteur: TECHNICIENS[0],
        role: 'TECHNICIEN',
        contenu:
          'Bonjour Leila, le pilote graphique a été mis à jour et le paramètre d’économie d’énergie USB désactivé. Pouvez-vous confirmer que tout fonctionne après quelques cycles de veille ?',
        date: ilYA(26),
      },
      {
        id: 3,
        auteur: { prenom: 'Leila', nom: 'Hamdi', email: 'leila.hamdi@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu: 'Ça fonctionne parfaitement depuis hier, merci beaucoup !',
        date: ilYA(24),
      },
    ],
    ia: {
      resume:
        'Écran externe non détecté en sortie de veille. Résolu par mise à jour du pilote graphique et désactivation de l’économie d’énergie USB. Confirmation utilisatrice reçue.',
      sentiment: 'POSITIF',
      confianceClassification: 0.9,
      suggestionReponse:
        'Bonjour Leila,\n\nParfait, merci pour votre retour ! Je clôture le ticket — n’hésitez pas à nous solliciter si le problème réapparaît.\n\nCordialement,\nL’équipe support',
      ticketsSimilaires: [
        { id: 'TK-0873', titre: 'Double écran non reconnu sur station d’accueil', similarite: 0.83 },
      ],
    },
  },
  {
    id: 'TK-1037',
    titre: 'Licence Figma expirée pour l’équipe design',
    description:
      "Nos trois licences Figma ont expiré hier. L'équipe design est bloquée sur les maquettes du projet client Azura. Merci de renouveler au plus vite.",
    statut: 'NOUVEAU',
    priorite: 'HAUTE',
    categorie: 'Logiciel',
    canal: 'TEAMS',
    tags: ['licence', 'design'],
    demandeur: { prenom: 'Nour', nom: 'Chaabane', email: 'nour.chaabane@metavoria.tn', service: 'Design' },
    dateCreation: ilYA(3),
    dateMaj: ilYA(3),
    slaEcheance: dans(4),
    messages: [
      {
        id: 1,
        auteur: { prenom: 'Nour', nom: 'Chaabane', email: 'nour.chaabane@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu:
          'Bonjour, nos licences Figma ont expiré et nous avons une livraison client vendredi. Pouvez-vous traiter le renouvellement en priorité ?',
        date: ilYA(3),
      },
    ],
    ia: {
      resume:
        'Trois licences Figma expirées bloquant l’équipe design sur une livraison client (vendredi). Renouvellement à traiter en priorité — impact multi-utilisateurs.',
      sentiment: 'FRUSTRE',
      confianceClassification: 0.96,
      suggestionReponse:
        "Bonjour Nour,\n\nLe renouvellement des 3 licences vient d'être validé auprès du service achats — vos accès seront rétablis d'ici 1h. Je vous confirme dès l'activation.\n\nCordialement,\nL'équipe support",
      ticketsSimilaires: [
        { id: 'TK-0942', titre: 'Renouvellement licences Adobe Creative Cloud', similarite: 0.88 },
        { id: 'TK-0790', titre: 'Licence Jira expirée — équipe dev bloquée', similarite: 0.8 },
      ],
    },
  },
  {
    id: 'TK-1036',
    titre: 'Wi-Fi instable en salle de réunion Carthage',
    description:
      'Le Wi-Fi coupe toutes les 10 minutes en salle Carthage, ce qui rend les visioconférences impossibles. Le problème ne se produit pas dans les autres salles.',
    statut: 'CLOTURE',
    priorite: 'MOYENNE',
    categorie: 'Réseau',
    canal: 'PORTAIL',
    tags: ['wifi', 'salle de réunion'],
    demandeur: { prenom: 'Sami', nom: 'Jlassi', email: 'sami.jlassi@metavoria.tn', service: 'Commercial' },
    technicien: TECHNICIENS[0],
    dateCreation: ilYA(168),
    dateMaj: ilYA(72),
    slaEcheance: ilYA(120),
    messages: [
      {
        id: 1,
        auteur: { prenom: 'Sami', nom: 'Jlassi', email: 'sami.jlassi@metavoria.tn' },
        role: 'DEMANDEUR',
        contenu: 'Le Wi-Fi coupe sans arrêt en salle Carthage, impossible de tenir une visio correcte.',
        date: ilYA(168),
      },
      {
        id: 2,
        auteur: TECHNICIENS[0],
        role: 'TECHNICIEN',
        contenu:
          "Point d'accès défectueux identifié et remplacé. 48h d'observation : plus aucune coupure détectée. Je clôture — merci de rouvrir si besoin.",
        date: ilYA(72),
      },
    ],
    ia: {
      resume:
        'Coupures Wi-Fi récurrentes en salle Carthage. Point d’accès défectueux remplacé, stabilité confirmée sur 48h. Ticket clôturé.',
      sentiment: 'NEUTRE',
      confianceClassification: 0.93,
      suggestionReponse:
        'Bonjour Sami,\n\nLe point d’accès de la salle Carthage a été remplacé et la connexion est stable depuis 48h. N’hésitez pas à nous signaler toute récidive.\n\nCordialement,\nL’équipe support',
      ticketsSimilaires: [
        { id: 'TK-0801', titre: 'Débit Wi-Fi faible open space 1er étage', similarite: 0.79 },
      ],
    },
  },
];

export function trouverTicketDemo(id: string): TicketDemo | undefined {
  return TICKETS_DEMO.find((t) => t.id === id);
}
