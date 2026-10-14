import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { couleurAvatar, initiales } from '../../lib/format';

interface AvatarProps {
  prenom: string;
  nom: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-14 text-lg',
};

export function Avatar({ prenom, nom, photoUrl, size = 'md', className }: AvatarProps) {
  // Une URL peut pointer sur une image devenue indisponible (fichier supprimé côté
  // stockage, réseau coupé) : `<img>` afficherait alors une icône cassée. On bascule
  // sur les initiales à la première erreur de chargement.
  const [erreur, setErreur] = useState(false);
  useEffect(() => setErreur(false), [photoUrl]);

  const base = cn(
    'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
    SIZES[size],
    className,
  );

  if (photoUrl && !erreur) {
    return (
      <img
        src={photoUrl}
        alt=""
        aria-hidden
        loading="lazy"
        onError={() => setErreur(true)}
        className={cn(base, 'bg-surface-3 object-cover')}
      />
    );
  }

  // Avatar par défaut : initiales sur un fond dérivé du nom (toujours la même couleur
  // pour la même personne).
  return (
    <span className={cn(base, couleurAvatar(`${prenom} ${nom}`))} aria-hidden>
      {initiales(prenom, nom)}
    </span>
  );
}
