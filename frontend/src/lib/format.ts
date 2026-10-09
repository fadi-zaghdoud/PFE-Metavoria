import type { Role } from '../types/auth';

export const LABELS_ROLE: Record<Role, string> = {
  EMPLOYE: 'Employé',
  TECHNICIEN: 'Technicien',
  ADMINISTRATEUR: 'Administrateur',
};

export function initiales(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

// Couleur d'avatar stable, dérivée du nom (même personne = même couleur).
// Palette CATÉGORIELLE (une teinte par personne, sans signification d'état) : chaque
// teinte porte explicitement son pendant sombre — aplat translucide, initiales claires.
const AVATAR_PALETTE = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200',
];

export function couleurAvatar(graine: string): string {
  let hash = 0;
  for (let i = 0; i < graine.length; i++) {
    hash = (hash * 31 + graine.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// "il y a 3 h", "hier", "il y a 4 j"…
export function tempsRelatif(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  if (jours === 1) return 'hier';
  if (jours < 30) return `il y a ${jours} j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateLongue(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Taille de fichier lisible : 512 o, 24 Ko, 3,4 Mo.
export function formaterOctets(octets: number | null): string {
  if (octets == null) return '';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
