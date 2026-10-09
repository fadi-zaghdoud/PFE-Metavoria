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
  ABSTENTION_DESACTIVEE,
  BORNE_PORTE_MAX,
  BORNE_PORTE_MIN,
  CLE_MODE_AFFECTATION,
  CLE_SEUIL_ABSTENTION,
  CLE_SEUIL_AFFICHAGE,
  administrationApi,
  type ModeAffectation,
  type Parametre,
} from '../features/administration/administrationApi';

// Réglages applicatifs persistants : mode d'affectation (§6.2) et seuils de confiance du
// module IA (§6.5). L'interrupteur d'affectation est un ÉTAT et non une action ponctuelle :
// l'administrateur bascule en AUTO avant une absence prolongée et revient en MANUEL à son
// retour. Même esprit pour la porte d'abstention : un état explicite et réversible.

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
  const [enregistrementIA, setEnregistrementIA] = useState<string | null>(null);
  const [seuilAffichageLocal, setSeuilAffichageLocal] = useState(0.5);
  // `null` = la porte est ouverte à l'écran mais AUCUNE valeur n'est encore choisie. On ne
  // pré-remplit rien : sans calibration transférable, proposer un chiffre reviendrait à le
  // recommander. L'enregistrement reste refusé tant que l'administrateur n'a pas tranché.
  const [seuilPorteLocal, setSeuilPorteLocal] = useState<number | null>(null);
  const [porteActive, setPorteActive] = useState(false);

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

  const seuilAffichageEnregistre = Number(
    parametres?.find((p) => p.cle === CLE_SEUIL_AFFICHAGE)?.valeur ?? 0.5,
  );
  const valeurPorte = parametres?.find((p) => p.cle === CLE_SEUIL_ABSTENTION)?.valeur;
  const seuilPorteEnregistre =
    valeurPorte === undefined || valeurPorte === ABSTENTION_DESACTIVEE ? null : Number(valeurPorte);

  // Réaligne les curseurs sur le serveur après chaque chargement ou écriture : la source de
  // vérité est le registre, jamais l'état local.
  useEffect(() => {
    if (!parametres) return;
    setSeuilAffichageLocal(seuilAffichageEnregistre);
    setSeuilPorteLocal(seuilPorteEnregistre);
    setPorteActive(seuilPorteEnregistre !== null);
  }, [parametres, seuilAffichageEnregistre, seuilPorteEnregistre]);

  async function ecrireIA(cle: string, valeur: string, titre: string, detail: string) {
    if (!token) return;
    setEnregistrementIA(cle);
    try {
      const data = await administrationApi.reglerParametre(cle, valeur, token);
      setParametres(data.parametres);
      toast.success(titre, detail);
    } catch (err) {
      toast.error(
        'Enregistrement impossible',
        err instanceof ApiError ? err.message : 'Réessayez.',
      );
    } finally {
      setEnregistrementIA(null);
    }
  }

  const enregistrerSeuilAffichage = () =>
    ecrireIA(
      CLE_SEUIL_AFFICHAGE,
      String(seuilAffichageLocal),
      'Seuil d’affichage enregistré',
      `Les catégories proposées sous ${Math.round(seuilAffichageLocal * 100)} % seront marquées « à préciser ».`,
    );

  const enregistrerSeuilPorte = (valeur: number) =>
    ecrireIA(
      CLE_SEUIL_ABSTENTION,
      String(valeur),
      'Porte d’abstention active',
      `Le système s’abstiendra sous ${Math.round(valeur * 100)} % de proximité, avant de générer.`,
    );

  function basculerPorte(vers: boolean) {
    if (!vers) {
      setPorteActive(false);
      setSeuilPorteLocal(null);
      void ecrireIA(
        CLE_SEUIL_ABSTENTION,
        ABSTENTION_DESACTIVEE,
        'Porte d’abstention désactivée',
        'Le système générera toujours une suggestion.',
      );
      return;
    }
    // Ouvre le réglage SANS rien écrire ni pré-remplir : la valeur doit être choisie.
    setPorteActive(true);
    setSeuilPorteLocal(null);
  }

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
                          ? 'border-primary-400 bg-marque-fond/60 ring-2 ring-marque-bordure'
                          : 'border-bordure hover:border-bordure-forte hover:bg-surface-2',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-texte">
                        {mode.valeur === 'AUTO' ? (
                          <Sparkles className="size-4 text-primary-500" aria-hidden />
                        ) : (
                          <UserCog className="size-4 text-texte-4" aria-hidden />
                        )}
                        {mode.titre}
                        {actif && (
                          <span className="ml-auto rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Actif
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-texte-4">
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
                  <p className="mt-0.5 text-alerte-texte/90">
                    L'affectation automatique ne s'applique qu'aux tickets créés à partir de
                    maintenant. Les tickets déjà en attente doivent être{' '}
                    <Link to="/tickets?nonAssignes=true" className="font-medium underline">
                      affectés manuellement
                    </Link>
                    .
                  </p>
                </Alert>
              )}

              <p className="flex items-start gap-2 text-xs text-texte-4">
                <Info className="mt-0.5 size-3.5 shrink-0 text-texte-4" aria-hidden />
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

      {/* ── Seuils de confiance IA (§6.5) ──────────────────────────────────────
          Deux réglages INDÉPENDANTS, volontairement séparés à l'écran : l'un ne change
          que l'affichage, l'autre change le comportement du RAG. Les confondre ferait
          croire qu'abaisser l'affichage rend le système plus prudent. */}
      <Card className="animate-fade-up mt-4" style={{ animationDelay: '80ms' }}>
        <CardHeader
          title="Seuils de confiance du module IA"
          description="Deux réglages distincts : ce que l'interface montre, et quand le système s'abstient."
        />
        <CardContent className="space-y-6">
          {chargement ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              {/* ── 1. Seuil d'affichage ─────────────────────────────────────── */}
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <label
                    htmlFor="seuil-affichage"
                    className="text-sm font-semibold text-texte"
                  >
                    Affichage d'une catégorie incertaine
                  </label>
                  <span className="text-sm font-semibold tabular-nums text-marque-fort">
                    {Math.round(seuilAffichageLocal * 100)} %
                  </span>
                </div>

                <input
                  id="seuil-affichage"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={seuilAffichageLocal}
                  disabled={enregistrementIA !== null}
                  onChange={(e) => setSeuilAffichageLocal(Number(e.target.value))}
                  className="mt-3 w-full accent-primary-600 disabled:opacity-60"
                />

                <p className="mt-2 text-xs leading-relaxed text-texte-4">
                  Sous ce seuil, la catégorie proposée est grisée et marquée « à préciser ».
                  Elle reste affichée : le modèle exprime son doute par une confiance basse,
                  pas en changeant de catégorie.
                </p>

                {/* Découplage ASSUMÉ, énoncé plutôt que laissé à deviner : l'affectation
                    automatique conserve son propre seuil, en dur côté serveur. */}
                <p className="mt-1.5 flex items-start gap-2 text-xs leading-relaxed text-texte-4">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-texte-4" aria-hidden />
                  <span>
                    Ce réglage ne change <strong>que l'affichage</strong>. L'affectation
                    automatique décide avec son propre seuil, fixé à 50 % dans le code : abaisser
                    celui-ci ne fera pas affecter davantage de tickets.
                  </span>
                </p>

                {seuilAffichageLocal !== seuilAffichageEnregistre && (
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => enregistrerSeuilAffichage()}
                      disabled={enregistrementIA !== null}
                    >
                      Enregistrer {Math.round(seuilAffichageLocal * 100)} %
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSeuilAffichageLocal(seuilAffichageEnregistre)}
                      disabled={enregistrementIA !== null}
                    >
                      Annuler
                    </Button>
                  </div>
                )}
              </div>

              <hr className="border-bordure" />

              {/* ── 2. Porte d'abstention du RAG ─────────────────────────────── */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-texte">
                    Porte d'abstention des suggestions
                  </span>
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                      porteActive ? 'bg-primary-600 text-white' : 'bg-surface-4 text-texte-3',
                    ].join(' ')}
                  >
                    {!porteActive
                      ? 'Désactivée'
                      : seuilPorteEnregistre === null
                        ? 'Valeur à choisir'
                        : `Active — ${Math.round(seuilPorteEnregistre * 100)} %`}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-texte-4">
                  Avant de générer une suggestion, le système note la proximité du meilleur
                  ticket passé et s'abstient sous ce seuil.{' '}
                  <strong>Ce qu'elle fait</strong> : écarter tôt les cas sans correspondance, ce
                  qui économise le temps de génération. <strong>Ce qu'elle ne fait pas</strong> :
                  détecter une résolution thématiquement proche mais fausse — aucun composant de
                  la chaîne n'en est capable, c'est pourquoi la décision reste au technicien.
                </p>

                {/* Asymétrie réelle du mécanisme (hybrid.score_abstention note docs[0], la
                    génération reçoit les 3 documents) : un administrateur doit la connaître
                    avant de régler, elle peut faire bloquer une suggestion qui aboutissait. */}
                <p className="mt-1.5 flex items-start gap-2 text-xs leading-relaxed text-texte-4">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-texte-4" aria-hidden />
                  <span>
                    <strong>À savoir avant de régler</strong> : la porte juge sur{' '}
                    <strong>un seul candidat</strong>, le mieux classé, alors que la rédaction en
                    lit <strong>trois</strong>. Si le ticket vraiment utile n'arrive qu'en
                    deuxième ou troisième position, la porte peut bloquer une suggestion qui
                    aurait abouti. Un seuil élevé rend ce cas plus fréquent.
                  </span>
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant={porteActive ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => basculerPorte(!porteActive)}
                    disabled={enregistrementIA !== null}
                  >
                    {porteActive ? 'Désactiver la porte' : 'Activer la porte'}
                  </Button>
                  {!porteActive && (
                    <span className="text-xs text-texte-4">
                      Fermée : le système génère toujours une suggestion.
                    </span>
                  )}
                </div>

                {porteActive && (
                  <div className="mt-4 rounded-xl border border-bordure bg-surface-2/70 p-3">
                    <label
                      htmlFor="seuil-porte"
                      className="text-xs font-semibold text-texte-2"
                    >
                      Seuil d'abstention — entre 5 % et 95 %
                    </label>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <input
                        id="seuil-porte"
                        type="range"
                        min={BORNE_PORTE_MIN}
                        max={BORNE_PORTE_MAX}
                        step={0.05}
                        value={seuilPorteLocal ?? BORNE_PORTE_MIN}
                        disabled={enregistrementIA !== null}
                        onChange={(e) => setSeuilPorteLocal(Number(e.target.value))}
                        className="min-w-[12rem] flex-1 accent-primary-600 disabled:opacity-60"
                      />
                      <span className="text-sm font-semibold tabular-nums text-marque-fort">
                        {seuilPorteLocal === null ? '—' : `${Math.round(seuilPorteLocal * 100)} %`}
                      </span>
                    </div>

                    {/* AUCUNE valeur n'est recommandée, et l'écran doit le dire : nous
                        n'avons pas de calibration transférable (cf. J5). */}
                    <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-alerte-texte">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        Aucune valeur n'est recommandée : nous n'avons pas de calibration
                        transférable. Le choix vous revient, et il se règle à l'usage.
                      </span>
                    </p>

                    {seuilPorteLocal === null ? (
                      <p className="mt-3 text-xs font-medium text-texte-4">
                        Déplacez le curseur pour choisir un seuil, puis enregistrez.
                      </p>
                    ) : (
                      seuilPorteLocal !== seuilPorteEnregistre && (
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => enregistrerSeuilPorte(seuilPorteLocal)}
                            disabled={enregistrementIA !== null}
                          >
                            Enregistrer {Math.round(seuilPorteLocal * 100)} %
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSeuilPorteLocal(seuilPorteEnregistre)}
                            disabled={enregistrementIA !== null}
                          >
                            Annuler
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Coût mémoire, dit avant la bascule plutôt que découvert après. */}
                <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-texte-4">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-texte-4" aria-hidden />
                  <span>
                    Ouvrir la porte fait charger un modèle supplémentaire au premier usage :
                    environ <strong>3,5 s</strong> une fois, puis <strong>+2,4 Gio</strong> de
                    mémoire sur le service IA, jusqu'à son prochain redémarrage. Le chargement
                    a lieu hors du temps de réponse.
                  </span>
                </p>
              </div>

              <p className="flex items-start gap-2 text-xs text-texte-4">
                <Settings className="mt-0.5 size-3.5 shrink-0 text-decor" aria-hidden />
                <span>
                  Le réentraînement du modèle se pilote depuis{' '}
                  <Link to="/administration/ia" className="font-medium text-marque underline">
                    Modèle IA
                  </Link>
                  . Chaque modification de ces réglages est enregistrée au journal d'audit.
                </span>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
