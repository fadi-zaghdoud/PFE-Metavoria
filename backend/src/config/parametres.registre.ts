// Registre des paramètres applicatifs persistants (table `parametres`, clé-valeur).
//
// POURQUOI UN REGISTRE. Le stockage clé-valeur achète l'extensibilité — brancher les
// seuils IA réglables (§6.5) coûtera une ligne, pas une migration — au prix du typage :
// en base, toute valeur est du texte. Ce module est la contrepartie de ce choix, et la
// SEULE source de vérité sur les clés connues, leur défaut, leur lecture et leur écriture.
//
// CONTRAT — la lecture ne lève JAMAIS et retombe toujours sur le comportement sûr :
//   ligne absente      → défaut
//   valeur illisible   → défaut + avertissement (jamais une exception, jamais un crash)
//   clé inconnue       → rejetée explicitement, en lecture comme en écriture
// L'absence de configuration doit produire le comportement ACTUEL de l'application, pas
// une bascule silencieuse : c'est pourquoi le défaut du mode d'affectation est MANUEL.
//
// Module PUR : aucun accès base, aucun log, aucune horloge. Les diagnostics sont RENVOYÉS
// (et non journalisés) pour rester intégralement testables — voir parametres.registre.test.ts.

// ─────────────────────────────────────────────────────────────────────────────
// Mode d'affectation des tickets (§6.2)
// ─────────────────────────────────────────────────────────────────────────────

// MANUEL : les nouveaux tickets restent non assignés, l'administrateur affecte à la main
//          (comportement historique de l'application).
// AUTO   : chaque ticket créé est affecté selon la charge et la spécialité.
// L'affectation manuelle reste disponible dans LES DEUX modes — l'admin peut toujours corriger.
export const MODES_AFFECTATION = ['MANUEL', 'AUTO'] as const;
export type ModeAffectation = (typeof MODES_AFFECTATION)[number];

export const CLE_MODE_AFFECTATION = 'AFFECTATION_MODE';

// ─────────────────────────────────────────────────────────────────────────────
// Seuils de confiance du module IA (§6.5)
// ─────────────────────────────────────────────────────────────────────────────

// 1) SEUIL D'AFFICHAGE de la catégorie suggérée. N'influence QUE l'affichage : sous ce
//    seuil, l'interface grise le badge et ajoute « à préciser ». La catégorie top-1 reste
//    la même — le modèle exprime son doute par une confiance basse, pas en changeant de
//    classe. Ne touche NI à la classification NI à l'affectation automatique, qui conserve
//    son propre seuil (`SEUIL_CONFIANCE_AFFECTATION`, en dur côté backend) : découplage
//    ASSUMÉ, énoncé dans l'aide de l'écran d'administration plutôt que laissé à deviner.
export const CLE_SEUIL_AFFICHAGE = 'IA_SEUIL_AFFICHAGE';

// 2) SEUIL DE LA PORTE D'ABSTENTION du RAG. Transmis au service IA dans la charge utile de
//    `/suggest` ; celui-ci reste SANS ÉTAT et ne lit jamais ce registre.
//    `DESACTIVE` est un état du domaine, PAS un nombre magique ni un `null` déguisé : la
//    porte est fermée, le reranker n'est jamais sollicité. C'est le défaut, et il reproduit
//    exactement le comportement livré jusqu'ici.
export const CLE_SEUIL_ABSTENTION = 'IA_SEUIL_ABSTENTION';

export const ABSTENTION_DESACTIVEE = 'DESACTIVE';
export type SeuilAbstention = number | typeof ABSTENTION_DESACTIVEE;

// Bornes de la porte, volontairement EXCLUSIVES de 0 et 1 — deux réglages qui
// ressembleraient à des pannes : à 0 elle n'abstient jamais tout en payant un rerank
// (indiscernable de « désactivée », mais plus lent) ; à 1 elle abstient toujours et le
// module ne sert plus à rien. L'état `DESACTIVE` couvre déjà proprement le cas « 0 ».
export const BORNE_ABSTENTION_MIN = 0.05;
export const BORNE_ABSTENTION_MAX = 0.95;

// Analyse un nombre borné. Renvoie null — donc « illisible, repli sur le défaut » — pour
// toute entrée hors domaine. Tolérant à la virgule décimale et aux espaces en LECTURE ;
// c'est `validerEcriture` qui refusera en écriture. Arrondi à 2 décimales : un seuil se
// règle au centième, et cela évite de stocker les bavures du binaire flottant.
function analyserNombreBorne(brut: string, min: number, max: number): number | null {
  const normalise = brut.trim().replace(',', '.');
  if (normalise === '') return null; // `Number('')` vaut 0 : à écarter explicitement
  const valeur = Number(normalise);
  if (!Number.isFinite(valeur)) return null;
  if (valeur < min || valeur > max) return null;
  return Math.round(valeur * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Définition d'un paramètre
// ─────────────────────────────────────────────────────────────────────────────

interface DefinitionParametre<T> {
  defaut: T;
  description: string;
  // Convertit la valeur stockée (texte) en valeur métier. Renvoie null si illisible :
  // c'est le signal « retombe sur le défaut », jamais une exception.
  analyser: (brut: string) => T | null;
  // Conversion inverse, pour l'écriture. Le stockage reste du texte.
  serialiser: (valeur: T) => string;
}

const REGISTRE = {
  [CLE_MODE_AFFECTATION]: {
    defaut: 'MANUEL',
    description:
      "Mode d'affectation des nouveaux tickets : MANUEL (l'administrateur affecte) ou AUTO (affectation selon la charge et la spécialité).",
    // Tolérant à la casse et aux espaces parasites en LECTURE (une valeur posée à la main
    // en base ne doit pas faire basculer le comportement), strict en ÉCRITURE via l'API.
    analyser: (brut) => {
      const normalise = brut.trim().toUpperCase();
      return (MODES_AFFECTATION as readonly string[]).includes(normalise)
        ? (normalise as ModeAffectation)
        : null;
    },
    serialiser: (valeur) => valeur,
  } satisfies DefinitionParametre<ModeAffectation>,

  [CLE_SEUIL_AFFICHAGE]: {
    // 0,5 = la valeur qui était en dur dans le frontend : régler devient possible sans
    // que le comportement change pour qui ne règle rien.
    defaut: 0.5,
    description:
      "Seuil de confiance sous lequel la catégorie suggérée par l'IA est présentée comme incertaine (badge grisé, « à préciser »). N'affecte que l'affichage : ni la classification, ni l'affectation automatique.",
    analyser: (brut) => analyserNombreBorne(brut, 0, 1),
    serialiser: (valeur) => String(valeur),
  } satisfies DefinitionParametre<number>,

  [CLE_SEUIL_ABSTENTION]: {
    // Porte FERMÉE par défaut : l'absence de configuration doit reproduire le
    // comportement actuel, jamais faire basculer l'application (même règle que MANUEL).
    defaut: ABSTENTION_DESACTIVEE as SeuilAbstention,
    description:
      "Seuil de la porte d'abstention du RAG : sous ce score de proximité, le système s'abstient AVANT de générer. « DESACTIVE » ferme la porte (défaut). Aucune valeur n'est recommandée : nous n'avons pas de calibration transférable.",
    analyser: (brut) => {
      const normalise = brut.trim();
      if (normalise.toUpperCase() === ABSTENTION_DESACTIVEE) return ABSTENTION_DESACTIVEE;
      return analyserNombreBorne(normalise, BORNE_ABSTENTION_MIN, BORNE_ABSTENTION_MAX);
    },
    serialiser: (valeur) => String(valeur),
  } satisfies DefinitionParametre<SeuilAbstention>,
} as const;

export type CleParametre = keyof typeof REGISTRE;
export type ValeurParametre<K extends CleParametre> = (typeof REGISTRE)[K]['defaut'];

export const CLES_CONNUES = Object.keys(REGISTRE) as CleParametre[];

// Garde d'exécution : les clés venant du réseau ou de la base sont des `string` quelconques.
export function estCleConnue(cle: string): cle is CleParametre {
  return Object.prototype.hasOwnProperty.call(REGISTRE, cle);
}

export function definitionDe<K extends CleParametre>(cle: K): DefinitionParametre<ValeurParametre<K>> {
  return REGISTRE[cle] as DefinitionParametre<ValeurParametre<K>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture — pure, ne lève jamais
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultatLecture<T> {
  valeur: T;
  // 'stocke' : la valeur en base a été comprise et utilisée.
  // 'defaut' : aucune ligne en base — cas nominal d'une application jamais configurée.
  // 'defaut_apres_erreur' : une valeur EXISTE en base mais est illisible → repli + avertissement.
  origine: 'stocke' | 'defaut' | 'defaut_apres_erreur';
  // Message destiné aux logs de l'appelant. Non nul uniquement en cas de repli anormal :
  // une base non configurée est un état normal, elle n'a pas à polluer les journaux.
  avertissement: string | null;
}

// `brut` = valeur lue en base (null/undefined si la ligne n'existe pas).
export function interpreter<K extends CleParametre>(
  cle: K,
  brut: string | null | undefined,
): ResultatLecture<ValeurParametre<K>> {
  const definition = definitionDe(cle);

  if (brut === null || brut === undefined) {
    return { valeur: definition.defaut, origine: 'defaut', avertissement: null };
  }

  const analysee = definition.analyser(brut);
  if (analysee === null) {
    return {
      valeur: definition.defaut,
      origine: 'defaut_apres_erreur',
      avertissement: `Paramètre « ${cle} » : valeur stockée « ${brut} » illisible — repli sur « ${String(definition.defaut)} ».`,
    };
  }

  return { valeur: analysee, origine: 'stocke', avertissement: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Écriture — validation stricte, clé inconnue rejetée
// ─────────────────────────────────────────────────────────────────────────────

export type ResultatValidation =
  | { ok: true; cle: CleParametre; valeurSerialisee: string }
  | { ok: false; message: string };

// Valide un couple (clé, valeur) venant de l'API avant écriture. Contrairement à la
// lecture — permissive par sécurité — l'écriture REJETTE : une clé hors registre ou une
// valeur hors domaine est une erreur de l'appelant, elle doit remonter en 400.
export function validerEcriture(cle: string, valeur: unknown): ResultatValidation {
  if (!estCleConnue(cle)) {
    return { ok: false, message: `Paramètre inconnu : « ${cle} ».` };
  }
  if (typeof valeur !== 'string') {
    return { ok: false, message: `Paramètre « ${cle} » : une valeur textuelle est attendue.` };
  }

  const definition = definitionDe(cle);
  const analysee = definition.analyser(valeur);
  if (analysee === null) {
    return { ok: false, message: `Paramètre « ${cle} » : valeur « ${valeur} » invalide.` };
  }

  return { ok: true, cle, valeurSerialisee: definition.serialiser(analysee) };
}
