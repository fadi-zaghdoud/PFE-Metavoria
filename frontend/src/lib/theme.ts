// Thème de l'interface — préférence « systeme » (défaut), « clair » ou « sombre ».
//
// La préférence est mémorisée dans le navigateur ; sans choix enregistré, l'interface suit
// le réglage du système, y compris s'il change en cours d'utilisation. Le thème effectif se
// traduit par la classe `dark` sur <html>, que lisent les jetons de couleur d'index.css.
//
// ⚠️ La CLÉ et les VALEURS ci-dessous sont aussi lues par le script en ligne d'index.html,
// qui applique le thème AVANT le premier rendu — sans lui, la page s'afficherait un instant
// dans le mauvais thème. Les deux doivent rester alignés.

export type PreferenceTheme = 'systeme' | 'clair' | 'sombre';
export type Theme = 'clair' | 'sombre';

export const CLE_THEME = 'smart-ticketing:theme';
const REQUETE_SOMBRE = '(prefers-color-scheme: dark)';

export function lirePreference(): PreferenceTheme {
  try {
    const valeur = localStorage.getItem(CLE_THEME);
    return valeur === 'clair' || valeur === 'sombre' ? valeur : 'systeme';
  } catch {
    // Stockage refusé (navigation privée stricte, politique d'entreprise) : on suit le système.
    return 'systeme';
  }
}

function systemeEstSombre(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REQUETE_SOMBRE).matches;
}

export function themeEffectif(preference: PreferenceTheme): Theme {
  if (preference === 'systeme') return systemeEstSombre() ? 'sombre' : 'clair';
  return preference;
}

export function appliquerTheme(preference: PreferenceTheme): void {
  const sombre = themeEffectif(preference) === 'sombre';
  const racine = document.documentElement;
  racine.classList.toggle('dark', sombre);
  // Calendriers, listes déroulantes et barres de défilement natifs suivent le thème.
  racine.style.colorScheme = sombre ? 'dark' : 'light';
}

// ── Magasin minimal, lu par `useTheme` via useSyncExternalStore ──────────────────────
let preference: PreferenceTheme = lirePreference();
const abonnes = new Set<() => void>();
const notifier = () => abonnes.forEach((rappel) => rappel());

// Instantané « préférence|thème effectif » : en mode « systeme », un changement du réglage
// du système modifie le thème effectif SANS changer la préférence — l'instantané doit donc
// porter les deux, sinon les composants qui affichent le thème effectif ne se mettraient
// pas à jour. Chaîne simple : stable d'un appel à l'autre tant que rien ne change.
export function etatTheme(): `${PreferenceTheme}|${Theme}` {
  return `${preference}|${themeEffectif(preference)}`;
}

export function sAbonnerAuTheme(rappel: () => void): () => void {
  abonnes.add(rappel);
  return () => {
    abonnes.delete(rappel);
  };
}

export function choisirTheme(nouvelle: PreferenceTheme): void {
  preference = nouvelle;
  try {
    // « Système » = aucune préférence enregistrée : le prochain chargement suit le système.
    if (nouvelle === 'systeme') localStorage.removeItem(CLE_THEME);
    else localStorage.setItem(CLE_THEME, nouvelle);
  } catch {
    // Stockage refusé : le choix vaut pour la session en cours.
  }
  appliquerTheme(nouvelle);
  notifier();
}

// Le thème est réappliqué au chargement du module : le script d'index.html l'a déjà posé,
// mais ceci rattrape le cas où il n'aurait pas pu s'exécuter.
appliquerTheme(preference);

// Préférence « systeme » : suivre le changement du réglage du système à chaud.
if (typeof window.matchMedia === 'function') {
  window.matchMedia(REQUETE_SOMBRE).addEventListener('change', () => {
    if (preference === 'systeme') {
      appliquerTheme('systeme');
      notifier();
    }
  });
}

// Choix fait dans un autre onglet : l'appliquer ici aussi.
window.addEventListener('storage', (evenement) => {
  if (evenement.key !== CLE_THEME && evenement.key !== null) return;
  preference = lirePreference();
  appliquerTheme(preference);
  notifier();
});
