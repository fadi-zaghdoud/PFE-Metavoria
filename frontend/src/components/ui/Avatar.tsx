import { cn } from '../../lib/cn';
import { couleurAvatar, initiales } from '../../lib/format';

interface AvatarProps {
  prenom: string;
  nom: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-14 text-lg',
};

export function Avatar({ prenom, nom, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        SIZES[size],
        couleurAvatar(`${prenom} ${nom}`),
        className,
      )}
      aria-hidden
    >
      {initiales(prenom, nom)}
    </span>
  );
}
