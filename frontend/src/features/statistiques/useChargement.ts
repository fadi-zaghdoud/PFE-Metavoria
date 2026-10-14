import { useEffect, useState } from 'react';

// Charge une ressource du tableau de bord pour des paramètres donnés. Tant que la réponse à
// de nouveaux paramètres n'est pas arrivée, le dernier résultat reste affiché (`enChargement`
// permet de l'atténuer) : ni squelette, ni saut de mise en page. `essai` relance après une
// erreur. `charger` doit être une fonction stable (définie hors du composant).
export function useChargement<P, T>(
  params: P,
  token: string | null,
  essai: number,
  charger: (params: P, token: string) => Promise<T>,
) {
  const parametres = JSON.stringify(params);
  const cle = `${parametres}#${essai}`;
  const [etat, setEtat] = useState<{ cle: string; donnees: T | null; erreur: boolean } | null>(null);

  useEffect(() => {
    if (!token) return;
    let actif = true;
    charger(JSON.parse(parametres) as P, token)
      .then((donnees) => actif && setEtat({ cle, donnees, erreur: false }))
      .catch(() => actif && setEtat({ cle, donnees: null, erreur: true }));
    return () => {
      actif = false;
    };
  }, [cle, parametres, token, charger]);

  return {
    donnees: etat?.donnees ?? null,
    erreur: etat?.erreur === true && etat.cle === cle,
    enChargement: etat === null || etat.cle !== cle,
  };
}
