import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { BrainCircuit, GaugeCircle, Sparkles } from 'lucide-react';
import { Logo } from './Logo';

const ARGUMENTS = [
  {
    icon: BrainCircuit,
    titre: 'Classification automatique',
    texte: 'Chaque ticket est catégorisé instantanément par le moteur NLP.',
  },
  {
    icon: GaugeCircle,
    titre: 'Priorisation intelligente',
    texte: "L'urgence et l'impact sont évalués dès la création.",
  },
  {
    icon: Sparkles,
    titre: 'Suggestions de résolution',
    texte: "L'IA propose des solutions issues des tickets déjà résolus.",
  },
];

interface AuthLayoutProps {
  titre: string;
  sousTitre: string;
  children: ReactNode;
  pied?: ReactNode;
}

export function AuthLayout({ titre, sousTitre, children, pied }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Panneau de marque */}
      <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.28),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.18),transparent_55%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]"
        />

        <div className="relative">
          <Logo light />
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Le support IT,
            <br />
            assisté par l'intelligence artificielle.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Centralisez vos demandes, laissez l'IA classifier et prioriser, et capitalisez sur chaque
            résolution.
          </p>

          <ul className="mt-8 space-y-5">
            {ARGUMENTS.map(({ icon: Icon, titre: t, texte }) => (
              <li key={t} className="flex gap-3.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-primary-300 ring-1 ring-inset ring-white/10">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{texte}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          © 2026 Metavoria — Projet de fin d'études
        </p>
      </div>

      {/* Formulaire */}
      <div className="flex items-center justify-center bg-slate-50 px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{titre}</h2>
          <p className="mt-1 text-sm text-slate-500">{sousTitre}</p>
          <div className="mt-7">{children}</div>
          {pied && <div className="mt-6 text-center text-sm text-slate-500">{pied}</div>}
        </motion.div>
      </div>
    </div>
  );
}
