import { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, Gauge, RefreshCw, Rocket, ShieldCheck, Tag } from 'lucide-react';
import { iaApi, estRapportValide, type EtatFlywheel, type RapportReentrainement } from '../features/ia/iaApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { dateLongue } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';

const POLL_MS = 2000; // cadence du polling pendant un réentraînement (async côté Python)

function f3(n: number | null | undefined): string {
  return n == null ? '—' : n.toFixed(3);
}

function signe(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(4)}`;
}

// Le verdict pré-enregistré du service ("SOLIDE…" / "AMBIGU…" / "NUL…") → couleur du badge.
function varianteVerdict(verdict: string): BadgeVariant {
  if (verdict.startsWith('SOLIDE')) return 'success';
  if (verdict.startsWith('AMBIGU')) return 'warning';
  return 'neutral';
}

export function FlywheelPage() {
  const token = useAuthStore((s) => s.token);
  const toast = useToast();

  const [etat, setEtat] = useState<EtatFlywheel | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reentrainementEnCours, setReentrainementEnCours] = useState(false);
  const [deploiementEnCours, setDeploiementEnCours] = useState(false);
  const pollRef = useRef<number | null>(null);

  const chargerEtat = useCallback(async (): Promise<EtatFlywheel | null> => {
    if (!token) return null;
    const e = await iaApi.etatFlywheel(token);
    setEtat(e);
    return e;
  }, [token]);

  // Chargement initial : si un entraînement tourne déjà (démarré ailleurs), on reprend le polling.
  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const e = await chargerEtat();
        if (!annule && e?.etat.en_cours) setReentrainementEnCours(true);
      } catch (err) {
        if (!annule) setErreur(err instanceof ApiError ? err.message : 'Chargement impossible.');
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [chargerEtat]);

  // Polling tant qu'un réentraînement est en cours : interroge /flywheel jusqu'à en_cours=false.
  useEffect(() => {
    if (!reentrainementEnCours || !token) return;
    let annule = false;
    const tick = async () => {
      try {
        const e = await iaApi.etatFlywheel(token);
        if (annule) return;
        setEtat(e);
        if (e.etat.en_cours) {
          pollRef.current = window.setTimeout(tick, POLL_MS);
        } else {
          setReentrainementEnCours(false);
          const r = e.etat.dernier_rapport;
          if (estRapportValide(r)) {
            toast.success(
              'Réentraînement terminé',
              `Candidat ${r.candidat_meilleur ? 'MEILLEUR' : 'non meilleur'} — ${r.verdict_pre_enregistre}.`,
            );
          } else if (r && 'erreur' in r) {
            toast.error('Réentraînement échoué', r.erreur);
          }
        }
      } catch {
        if (!annule) {
          setReentrainementEnCours(false);
          setErreur('Le service IA est devenu injoignable pendant le réentraînement.');
        }
      }
    };
    pollRef.current = window.setTimeout(tick, POLL_MS);
    return () => {
      annule = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [reentrainementEnCours, token, toast]);

  async function handleReentrainer() {
    if (!token) return;
    setErreur(null);
    try {
      const r = await iaApi.reentrainer(token);
      toast.info('Réentraînement lancé', `${r.nbCaptures} label(s) réel(s) au total intégré(s) au candidat.`);
      setReentrainementEnCours(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.info('Déjà en cours', 'Un réentraînement est déjà en cours — suivi repris.');
        setReentrainementEnCours(true);
      } else {
        setErreur(err instanceof ApiError ? err.message : 'Déclenchement impossible.');
      }
    }
  }

  async function handleDeployer(stamp: string) {
    if (!token) return;
    setErreur(null);
    setDeploiementEnCours(true);
    try {
      const r = await iaApi.deployer(stamp, token);
      toast.success('Candidat déployé', `Nouveau modèle servi — macro-F1 réel ${f3(r.macro_f1_reel)}.`);
      await chargerEtat();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Déploiement refusé', err.message); // refus glass-box, non contournable
      } else {
        setErreur(err instanceof ApiError ? err.message : 'Déploiement impossible.');
      }
    } finally {
      setDeploiementEnCours(false);
    }
  }

  const rapportBrut = etat?.etat.dernier_rapport ?? null;
  const rapport: RapportReentrainement | null = estRapportValide(rapportBrut) ? rapportBrut : null;
  const rapportErreur = rapportBrut && 'erreur' in rapportBrut ? rapportBrut.erreur : null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Administration"
        title="Modèle IA — flywheel"
        description="Le système propose un candidat à partir des corrections validées ; l'admin ne le déploie que s'il est meilleur sur le test gelé."
      />

      {erreur && (
        <Alert variant="danger" className="mb-5">
          {erreur}
        </Alert>
      )}

      {/* ── Bloc 1 : compteur ─────────────────────────────────────────────── */}
      {chargement ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Nouvelles corrections validées"
            value={etat?.nbLabelsDepuis ?? 0}
            icon={Tag}
            tone="primary"
            hint="depuis le modèle actif servi"
            index={0}
          />
          <StatCard
            label="macro-F1 réel du modèle actif"
            value={etat?.macroF1ReelActif ?? 0}
            icon={Gauge}
            tone="neutral"
            decimals={3}
            hint="sur le test réel gelé"
            index={1}
          />
          <StatCard
            label="Modèle actif entraîné le"
            value={etat?.dateActif ? dateLongue(etat.dateActif) : '—'}
            icon={ShieldCheck}
            tone="neutral"
            index={2}
          />
        </div>
      )}

      {/* ── Bloc 2 : réentraîner ──────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader
          title="Réentraîner un candidat"
          description="Assemble le corpus + les corrections validées, vérifie l'étanchéité (fail dur), entraîne un candidat et le compare à l'actif sur le test gelé. Aucun déploiement ici."
          actions={
            <Button onClick={handleReentrainer} loading={reentrainementEnCours} disabled={chargement}>
              {!reentrainementEnCours && <RefreshCw className="size-4" aria-hidden />}
              {reentrainementEnCours ? 'Entraînement en cours…' : 'Réentraîner'}
            </Button>
          }
        />
        {reentrainementEnCours && (
          <CardContent>
            <p className="text-sm text-slate-500">
              Le candidat s'entraîne côté service (asynchrone). Suivi automatique toutes les 2 s…
            </p>
          </CardContent>
        )}
      </Card>

      {/* ── Bloc 3 : comparatif candidat vs actif ─────────────────────────── */}
      {rapportErreur && (
        <Alert variant="danger" className="mt-6">
          Dernier réentraînement en échec : {rapportErreur}
        </Alert>
      )}

      {rapport && (
        <Card className="mt-6">
          <CardHeader
            title="Comparatif — candidat vs actif (test gelé)"
            description={rapport.regle}
            actions={
              <Badge variant={varianteVerdict(rapport.verdict_pre_enregistre)}>
                {rapport.verdict_pre_enregistre}
              </Badge>
            }
          />
          <CardContent className="space-y-5">
            {/* Synthèse macro-F1 */}
            <TableContainer>
              <Table>
                <thead>
                  <tr>
                    <Th>Modèle</Th>
                    <Th className="text-right">macro-F1 réel</Th>
                    <Th className="text-right">macro-F1 synth</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td>Actif (servi)</Td>
                    <Td className="text-right tabular-nums">{f3(rapport.actif.reel.macro_f1)}</Td>
                    <Td className="text-right tabular-nums text-slate-400">{f3(rapport.actif.gold.macro_f1)}</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium">Candidat</Td>
                    <Td className="text-right font-medium tabular-nums">{f3(rapport.candidat.reel.macro_f1)}</Td>
                    <Td className="text-right tabular-nums text-slate-400">{f3(rapport.candidat.gold.macro_f1)}</Td>
                  </tr>
                </tbody>
              </Table>
            </TableContainer>

            <p className="text-sm text-slate-600">
              Δ macro-F1 réel :{' '}
              {/* Vert seulement si DÉPLOYABLE (Δ≥+0.02) ; ambre pour un positif NUL (bruit,
                  refusé) ; rouge si négatif — la couleur suit la décision, pas juste le signe. */}
              <span
                className={`font-semibold tabular-nums ${
                  rapport.candidat_meilleur
                    ? 'text-emerald-600'
                    : rapport.delta_macro_f1_reel >= 0
                      ? 'text-amber-600'
                      : 'text-rose-600'
                }`}
              >
                {signe(rapport.delta_macro_f1_reel)}
              </span>{' '}
              — {rapport.candidat_meilleur ? 'candidat meilleur' : 'candidat non meilleur'} sur le réel.
            </p>

            {/* Détail par classe (glass-box) : rend visible l'histoire de la courbe */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">F1 réel par classe</h3>
              <TableContainer>
                <Table>
                  <thead>
                    <tr>
                      <Th>Classe</Th>
                      <Th className="text-right">Actif</Th>
                      <Th className="text-right">Candidat</Th>
                      <Th className="text-right">Δ</Th>
                      <Th className="text-right">Support</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapport.actif.reel.labels.map((c) => {
                      const a = rapport.actif.reel.par_classe[c]?.f1 ?? 0;
                      const cand = rapport.candidat.reel.par_classe[c]?.f1 ?? 0;
                      const d = cand - a;
                      const sup = rapport.candidat.reel.par_classe[c]?.support ?? 0;
                      return (
                        <tr key={c}>
                          <Td className="font-medium">{c}</Td>
                          <Td className="text-right tabular-nums">{f3(a)}</Td>
                          <Td className="text-right tabular-nums">{f3(cand)}</Td>
                          <Td className={`text-right tabular-nums ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {d === 0 ? '—' : signe(d)}
                          </Td>
                          <Td className="text-right tabular-nums text-slate-400">{sup}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Bloc 4 : déployer (conditionnel) ──────────────────────────────── */}
      {rapport && (
        <Card className="mt-6">
          <CardHeader
            title="Déployer le candidat"
            description="Le déploiement remplace le modèle servi. Le service le REFUSE si le candidat n'est pas meilleur sur le test gelé — garde non contournable."
          />
          <CardContent>
            {rapport.candidat_meilleur ? (
              <Button
                onClick={() => handleDeployer(rapport.stamp)}
                loading={deploiementEnCours}
              >
                <Rocket className="size-4" aria-hidden />
                Déployer le candidat
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button disabled>
                  <Rocket className="size-4" aria-hidden />
                  Déployer le candidat
                </Button>
                <p className="text-sm text-slate-500">
                  Déploiement indisponible : candidat non meilleur sur le test gelé
                  (Δ {signe(rapport.delta_macro_f1_reel)}, verdict {rapport.verdict_pre_enregistre}).
                  Le système refuse de déployer un modèle qui n'améliore pas le réel.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!chargement && !rapport && !rapportErreur && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-slate-500">
          <Brain className="size-5 shrink-0 text-slate-400" aria-hidden />
          Aucun candidat encore évalué. Lance un réentraînement pour comparer un candidat au modèle actif.
        </div>
      )}
    </div>
  );
}
