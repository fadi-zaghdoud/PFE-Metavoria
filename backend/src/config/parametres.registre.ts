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
