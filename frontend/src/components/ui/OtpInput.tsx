import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';

interface OtpInputProps {
  longueur?: number;
  value: string;
  onChange: (valeur: string) => void;
  disabled?: boolean;
}

// Saisie de code OTP : 6 cases, avance automatique, retour arrière,
// et collage d'un code complet depuis l'e-mail.
export function OtpInput({ longueur = 6, value, onChange, disabled = false }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setCaractere(index: number, caractere: string) {
    const chiffres = value.padEnd(longueur, ' ').split('');
    chiffres[index] = caractere;
    onChange(chiffres.join('').trimEnd());
  }

  function handleChange(index: number, brut: string) {
    const chiffre = brut.replace(/\D/g, '').slice(-1);
    if (!chiffre) {
      setCaractere(index, ' ');
      return;
    }
    setCaractere(index, chiffre);
    refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[index]?.trim()) {
      refs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft') refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight') refs.current[index + 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const colle = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, longueur);
    if (!colle) return;
    onChange(colle);
    refs.current[Math.min(colle.length, longueur - 1)]?.focus();
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Code de vérification">
      {Array.from({ length: longueur }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={value[i]?.trim() ?? ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          aria-label={`Chiffre ${i + 1} sur ${longueur}`}
          className={cn(
            'size-11 rounded-lg border border-bordure-forte bg-surface text-center text-lg font-semibold text-texte shadow-xs transition-colors',
            'hover:border-bordure-survol focus:border-primary-500 disabled:cursor-not-allowed disabled:bg-surface-2',
          )}
        />
      ))}
    </div>
  );
}
