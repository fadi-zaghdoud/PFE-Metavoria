import { parametreRepository } from '../repositories/parametre.repository';
import {
  ABSTENTION_DESACTIVEE,
  CLES_CONNUES,
  CLE_MODE_AFFECTATION,
  CLE_SEUIL_ABSTENTION,
  CLE_SEUIL_AFFICHAGE,
  definitionDe,
  interpreter,
  validerEcriture,
  type CleParametre,
  type ModeAffectation,
  type ValeurParametre,
} from '../config/parametres.registre';
import { ValidationError } from '../utils/AppError';
import { logAudit } from '../utils/logger';

// Couche d'accès aux paramètres persistants. Toute la logique de décision (défaut,
// tolérance, validation) vit dans le REGISTRE, qui est pur et testé ; ce service ne fait
// que l'I/O et la journalisation.
//
// PAS DE CACHE, volontairement. Une lecture par clé primaire est négligeable devant une
// création de ticket, alors qu'un cache rendrait l'interrupteur paresseux : l'admin
// basculerait le mode et l'application continuerait un moment sur l'ancien. La justesse
// du réglage prime sur une micro-optimisation.
export const parametreService = {
  // Lecture NON BLOQUANTE : ni une base indisponible ni une valeur corrompue ne doivent
  // faire échouer l'action métier appelante (la création d'un ticket, notamment).
  // Toute anomalie retombe sur le défaut du registre — donc sur le comportement actuel.
  async lire<K extends CleParametre>(cle: K): Promise<ValeurParametre<K>> {
    let brut: string | null;
    try {
      brut = (await parametreRepository.findByCle(cle))?.valeur ?? null;
    } catch (err) {
      // R7 — lecture impossible (base injoignable) : repli sur le défaut, jamais d'exception.
      console.warn(
        `[PARAM] lecture de « ${cle} » impossible — repli sur le défaut :`,
        err instanceof Error ? err.message : err,
      );
      return definitionDe(cle).defaut;
    }

    const { valeur, avertissement } = interpreter(cle, brut);
    if (avertissement) console.warn(`[PARAM] ${avertissement}`);
    return valeur;
  },

  // Raccourcis typés des paramètres exploités (§6.2, §6.5).
  modeAffectation(): Promise<ModeAffectation> {
    return parametreService.lire(CLE_MODE_AFFECTATION);
  },

  seuilAffichage(): Promise<number> {
    return parametreService.lire(CLE_SEUIL_AFFICHAGE);
  },

  // Porte d'abstention du RAG. Traduit l'état métier `DESACTIVE` en `null`, qui est ce que
  // le service IA comprend comme « pas de porte » — il retombe alors sur son propre défaut.
  // Le service IA reste SANS ÉTAT : il reçoit ce seuil, il ne le lit jamais.
  async seuilAbstention(): Promise<number | null> {
    const valeur = await parametreService.lire(CLE_SEUIL_ABSTENTION);
    return valeur === ABSTENTION_DESACTIVEE ? null : valeur;
  },

  // Sous-ensemble LISIBLE PAR TOUT UTILISATEUR AUTHENTIFIÉ : uniquement ce dont l'interface
  // a besoin pour rendre un ticket. Le panneau de suggestion est visible du technicien
  // assigné, qui n'a pas accès au registre complet (réservé à l'administrateur) — d'où ce
  // point d'entrée étroit plutôt qu'un élargissement des droits sur `/parametres`.
  async lireAffichage(): Promise<{ seuilAffichage: number }> {
    return { seuilAffichage: await parametreService.seuilAffichage() };
  },

  // Vue d'administration : TOUTES les clés du registre, y compris celles qui n'ont pas
  // encore de ligne en base — sinon l'écran n'afficherait rien tant que rien n'a été réglé.
  async lireTous() {
    const lignes = await parametreRepository.findMany();
    const parCle = new Map(lignes.map((l) => [l.cle, l]));

    return CLES_CONNUES.map((cle) => {
      const ligne = parCle.get(cle);
      const definition = definitionDe(cle);
      const { valeur, origine } = interpreter(cle, ligne?.valeur ?? null);
      return {
        cle,
        valeur,
        description: definition.description,
        // Permet à l'interface de distinguer « réglé par un humain » de « valeur par défaut ».
        origine,
        dateMaj: ligne?.dateMaj ?? null,
        majParId: ligne?.majParId ?? null,
      };
    });
  },

  // Écriture STRICTE (là où la lecture est permissive) : clé hors registre ou valeur hors
  // domaine → refus, pour que l'admin ne croie jamais avoir réglé autre chose que le stocké.
  // Modifier un paramètre est une action critique au sens du §7 : elle est journalisée.
  async ecrire(acteurId: number, cle: string, valeur: unknown) {
    const validation = validerEcriture(cle, valeur);
    if (!validation.ok) throw new ValidationError(validation.message);

    const ancien = await parametreService.lire(validation.cle);
    const ligne = await parametreRepository.upsert(
      validation.cle,
      validation.valeurSerialisee,
      definitionDe(validation.cle).description,
      acteurId,
    );

    logAudit('PARAMETRE_MODIFIE', {
      cle: validation.cle,
      de: ancien,
      vers: validation.valeurSerialisee,
      parUtilisateur: acteurId,
    });

    return ligne;
  },
};
