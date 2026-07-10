import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';
import { cn } from '../../lib/cn';

// Champ mot de passe avec bascule de visibilité.
export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-600"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

// ── Jauge de force ───────────────────────────────────────────────────────────

interface Niveau {
  label: string;
  barres: number;
  couleur: string;
  texte: string;
}

const NIVEAUX: Niveau[] = [
  { label: 'Très faible', barres: 1, couleur: 'bg-rose-500', texte: 'text-rose-600' },
  { label: 'Faible', barres: 2, couleur: 'bg-amber-500', texte: 'text-amber-600' },
  { label: 'Bon', barres: 3, couleur: 'bg-sky-500', texte: 'text-sky-600' },
  { label: 'Excellent', barres: 4, couleur: 'bg-emerald-500', texte: 'text-emerald-600' },
];

// Score aligné sur la politique backend : minuscule + majuscule + chiffre + longueur.
export function scoreMotDePasse(motDePasse: string): number {
  if (!motDePasse) return 0;
  let score = 0;
  if (motDePasse.length >= 8) score++;
  if (/[a-z]/.test(motDePasse) && /[A-Z]/.test(motDePasse)) score++;
  if (/\d/.test(motDePasse)) score++;
  if (motDePasse.length >= 12 && /[^a-zA-Z0-9]/.test(motDePasse)) score++;
  return score;
}

export function PasswordStrength({ motDePasse }: { motDePasse: string }) {
  if (!motDePasse) return null;
  const niveau = NIVEAUX[Math.max(0, scoreMotDePasse(motDePasse) - 1)];

  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {NIVEAUX.map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-200',
              i < niveau.barres ? niveau.couleur : 'bg-slate-200',
            )}
            aria-hidden
          />
        ))}
        <span className={cn('ml-1 text-xs font-medium', niveau.texte)}>{niveau.label}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        8 caractères minimum, avec au moins une majuscule, une minuscule et un chiffre.
      </p>
    </div>
  );
}
