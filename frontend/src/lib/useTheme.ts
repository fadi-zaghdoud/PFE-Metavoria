import { useSyncExternalStore } from 'react';
import {
  choisirTheme,
  etatTheme,
  sAbonnerAuTheme,
  type PreferenceTheme,
  type Theme,
} from './theme';

// Préférence de thème et thème effectif, à jour quand l'un ou l'autre change (bascule,
// réglage du système, autre onglet).
export function useTheme(): {
  preference: PreferenceTheme;
  effectif: Theme;
  choisir: (preference: PreferenceTheme) => void;
} {
  const [preference, effectif] = useSyncExternalStore(sAbonnerAuTheme, etatTheme).split('|') as [
    PreferenceTheme,
    Theme,
  ];
  return { preference, effectif, choisir: choisirTheme };
}
