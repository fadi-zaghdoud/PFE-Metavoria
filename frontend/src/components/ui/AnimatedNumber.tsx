import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Compteur animé (count-up) de la valeur précédente → nouvelle valeur, à
// l'apparition et à chaque changement. Respecte prefers-reduced-motion en
// affichant directement la valeur finale.
export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 900,
  prefix = '',
  suffix = '',
  className,
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const displayRef = useRef(reduceMotion ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      displayRef.current = value;
      setDisplay(value);
      return;
    }
    const from = displayRef.current;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const current = from + (value - from) * easeOutCubic(progress);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduceMotion]);

  const formatted = display.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
