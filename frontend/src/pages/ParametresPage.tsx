import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, RefreshCw, Settings, Sparkles, UserCog } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { ticketsApi } from '../features/tickets/ticketsApi';
import {
  CLE_MODE_AFFECTATION,
  administrationApi,
  type ModeAffectation,
  type Parametre,
} from '../features/administration/administrationApi';

// Réglages applicatifs persistants (§6.2, et §6.5 le jour où les seuils IA y seront
// ajoutés). L'interrupteur est un ÉTAT et non une action ponctuelle : l'administrateur
// bascule en AUTO avant une absence prolongée et revient en MANUEL à son retour.

const MODES: { valeur: ModeAffectation; titre: string; detail: string }[] = [
  {
    valeur: 'MANUEL',
    titre: 'Manuel',
    detail: "Les nouveaux tickets restent non assignés. L'administrateur affecte lui-même.",
  },
  {
    valeur: 'AUTO',
    titre: 'Automatique',
    detail:
      'Chaque nouveau ticket est assigné selon la charge et la spécialité, en excluant les techniciens absents.',
  },
];

export function ParametresPage() {
  const token = useAuthStore((state) => state.token);
  const toast = useToast();

  const [parametres, setParametres] = useState<Parametre[] | null>(null);
  const [nonAssignes, setNonAssignes] = useState<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState<ModeAffectation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!token) return;
    setChargement(true);
    setErreur(null);
    try {
      // Le compteur de tickets non assignés réutilise le filtre existant de la liste :
      // aucun point d'entrée supplémentaire n'a été nécessaire.
      const [reglages, tickets] = await Promise.all([
        administrationApi.parametres(token),
        ticketsApi.lister({ nonAssignes: true }, token),
      ]);
      setParametres(reglages.parametres);
      setNonAssignes(tickets.tickets.length);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Chargement impossible');
    } finally {
      setChargement(false);
    }
  }, [token]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const modeActuel = (parametres?.find((p) => p.cle === CLE_MODE_AFFECTATION)?.valeur ??
    'MANUEL') as ModeAffectation;
  const reglage = parametres?.find((p) => p.cle === CLE_MODE_AFFECTATION);

  async function basculer(vers: ModeAffectation) {
    if (!token || vers === modeActuel) return;
    setEnregistrement(vers);
    try {
      const data = await administrationApi.reglerParametre(CLE_MODE_AFFECTATION, vers, token);
      setParametres(data.parametres);
      toast.success(
        vers === 'AUTO' ? 'Affectation automatique activée' : 'Affectation repassée en manuel',
        vers === 'AUTO'
          ? 'Les nouveaux tickets seront assignés automatiquement.'
          : 'Les nouveaux tickets resteront non assignés.',
      );
    } catch (err) {
      toast.error('Changement impossible', err instanceof ApiError ? err.message : 'Réessayez.');
    } finally {
      setEnregistrement(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Paramètres"
        description="Réglages de l'application. Conservés d'un redémarrage à l'autre."
        actions={
          <Button variant="secondary" size="sm" onClick={charger} disabled={chargement}>
            <RefreshCw className="size-3.5" aria-hidden />
            Actualiser
          </Button>
        }
      />

      {erreur && (
        <Alert variant="danger" className="mb-4">
          {erreur}
        </Alert>
      )}

      <Card className="animate-fade-up">
        <CardHeader
          title="Affectation des tickets"
          description="Comment les nouveaux tickets sont attribués aux techniciens."
        />
        <CardContent className="space-y-4">
          {chargement ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <>
              <div
                className="grid gap-3 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Mode d'affectation des tickets"
              >
                {MODES.map((mode) => {
                  const actif = modeActuel === mode.valeur;
                  return (
                    <button
                      key={mode.valeur}
                      type="button"
                      role="radio"
                      aria-checked={actif}
                      onClick={() => basculer(mode.valeur)}
                      disabled={enregistrement !== null}
                      className={[
                        'rounded-xl border p-4 text-left transition-all disabled:opacity-60',
                        actif
                          ? 'border-primary-400 bg-primary-50/60 ring-2 ring-primary-200'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        {mode.valeur === 'AUTO' ? (
                          <Sparkles className="size-4 text-primary-500" aria-hidden />
                        ) : (
                          <UserCog className="size-4 text-slate-400" aria-hidden />
                        )}
                        {mode.titre}
                        {actif && (
                          <span className="ml-auto rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Actif
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">
                        {mode.detail}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Le trou nommé au bon moment : basculer en AUTO n'affecte QUE les tickets
                  créés ensuite. Sans ce message, un administrateur partant en congé
                  croirait sa file traitée. */}
              {modeActuel === 'AUTO' && nonAssignes !== null && nonAssignes > 0 && (
                <Alert variant="warning">
                  <p className="font-medium">
                    {nonAssignes} ticket{nonAssignes > 1 ? 's' : ''} non assigné
                    {nonAssignes > 1 ? 's' : ''} — ce changement ne les affecte pas
                  </p>
                  <p className="mt-0.5 text-amber-700/90">
                    L'affectation automatique ne s'applique qu'aux tickets créés à partir de
                    maintenant. Les tickets déjà en attente doivent être{' '}
                    <Link to="/tickets?nonAssignes=true" className="font-medium underline">
                      affectés manuellement
                    </Link>
                    .
                  </p>
                </Alert>
              )}

              <p className="flex items-start gap-2 text-xs text-slate-500">
                <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden />
                <span>
                  L'affectation manuelle reste disponible dans les deux modes : un administrateur
                  peut toujours corriger l'attribution d'un ticket.
                  {reglage?.origine === 'defaut' && ' Ce réglage n’a jamais été modifié.'}
                </span>
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Le §6.5 prévoit des seuils IA réglables. La table de paramètres est prête à les
          accueillir, mais ils ne sont PAS livrés — le dire ici évite de le laisser croire. */}
      <Card className="animate-fade-up mt-4" style={{ animationDelay: '80ms' }}>
        <CardHeader
          title="Module IA"
          description="Seuils de confiance et réentraînement."
        />
        <CardContent>
          <p className="flex items-start gap-2 text-sm text-slate-500">
            <Settings className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden />
            <span>
              Le seuil de confiance utilisé pour l'affectation et l'affichage des suggestions est
              fixé à 0,5 dans le code et n'est pas encore réglable ici. Le réentraînement du modèle
              se pilote depuis{' '}
              <Link to="/administration/ia" className="font-medium text-primary-600 underline">
                Modèle IA
              </Link>
              .
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
