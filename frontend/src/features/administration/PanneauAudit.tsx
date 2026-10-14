import { ArrowRight, History, Info } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { Badge } from '../../components/ui/Badge';
import { LABEL_ACTION, LABEL_CIBLE, type EntreeAudit } from './auditApi';
import { formaterDetails, qualifierActeur, qualifierIpAbsente } from './auditFormat';

// Panneau de consultation d'une entrée du journal. Réutilise le `Dialog` du reste de
// l'interface dans sa variante latérale : on consulte le contexte complet d'une action
// SANS quitter la liste qu'on est en train de parcourir — le cas d'usage étant d'enquêter
// en enchaînant plusieurs lignes.
//
// Principe de l'écran : tout dire d'un coup, et QUALIFIER ce qui manque. Une valeur
// absente est expliquée (« aucune IP d'utilisateur » ≠ « non enregistré à l'époque »)
// plutôt que laissée vide, sans quoi l'administrateur devrait deviner.

interface PanneauAuditProps {
  entree: EntreeAudit | null;
  onClose: () => void;
  nomUtilisateur: (id: number) => string | undefined;
  nomCategorie: (id: number) => string | undefined;
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-3 py-1.5">
      <dt className="text-xs font-medium text-texte-4">{label}</dt>
      <dd className="min-w-0 text-sm text-texte-2">{children}</dd>
    </div>
  );
}

export function PanneauAudit({ entree, onClose, nomUtilisateur, nomCategorie }: PanneauAuditProps) {
  if (!entree) return <Dialog open={false} onClose={onClose} title="" variant="lateral" />;

  const acteur = qualifierActeur(entree);
  const lignes = formaterDetails(entree, { nomUtilisateur, nomCategorie });
  const importee = entree.details?.importeDeLHistorique === true;

  // Nom de la cible quand la page le connaît — un identifiant seul n'apprend rien.
  const nomCible =
    entree.cibleId === null
      ? null
      : entree.cibleType === 'UTILISATEUR'
        ? nomUtilisateur(entree.cibleId)
        : entree.cibleType === 'CATEGORIE'
          ? nomCategorie(entree.cibleId)
          : null;

  return (
    <Dialog
      open
      onClose={onClose}
      variant="lateral"
      title={LABEL_ACTION[entree.action] ?? entree.action}
      description={new Date(entree.dateCreation).toLocaleString('fr-FR', {
        dateStyle: 'full',
        timeStyle: 'medium',
      })}
    >
      <div className="space-y-5">
        {importee && (
          <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-texte-4">
            <History className="mt-0.5 size-3.5 shrink-0 text-texte-4" aria-hidden />
            <span>
              <span className="font-medium text-texte-3">Repris de l'historique des tickets.</span>{' '}
              Cette action est antérieure à la mise en service du journal : son contexte de requête
              (adresse, navigateur) n'était pas enregistré à l'époque.
            </span>
          </p>
        )}

        <dl className="divide-y divide-bordure-faible">
          <Champ label="Résultat">
            <Badge variant={entree.resultat === 'ECHEC' ? 'danger' : 'success'}>
              {entree.resultat === 'ECHEC' ? 'Échec' : 'Succès'}
            </Badge>
          </Champ>

          <Champ label="Acteur">
            <span className="font-medium text-texte">
              {entree.acteurId ? (nomUtilisateur(entree.acteurId) ?? entree.acteurNom) : entree.acteurNom}
            </span>
            <span className="mt-0.5 flex items-start gap-1.5 text-xs text-texte-4">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{acteur.libelle}</span> — {acteur.explication}
              </span>
            </span>
          </Champ>

          <Champ label="Cible">
            {entree.cibleType ? (
              <>
                {LABEL_CIBLE[entree.cibleType] ?? entree.cibleType}
                {entree.cibleId !== null && (
                  <span className="text-texte-4"> #{entree.cibleId}</span>
                )}
                {nomCible && <span className="block text-xs text-texte-4">{nomCible}</span>}
              </>
            ) : (
              <span className="text-texte-4">Aucune — action sans objet visé</span>
            )}
          </Champ>

          <Champ label="Adresse IP">
            {entree.ip ? (
              <span className="tabular-nums">{entree.ip}</span>
            ) : (
              <span className="text-texte-4">{qualifierIpAbsente(entree)}</span>
            )}
          </Champ>

          <Champ label="Navigateur">
            {entree.userAgent ? (
              // Complet et non tronqué : c'est ici qu'on vient le lire en entier.
              <span className="block break-all font-mono text-[11px] leading-relaxed text-texte-3">
                {entree.userAgent}
              </span>
            ) : (
              <span className="text-texte-4">Non enregistré</span>
            )}
          </Champ>
        </dl>

        {lignes.length > 0 && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-texte-4">
              Détail
            </h3>
            <dl className="divide-y divide-bordure-faible">
              {lignes.map((l) => (
                <Champ key={l.label} label={l.label}>
                  {l.avant !== undefined ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs text-texte-4">
                        {l.avant}
                      </span>
                      <ArrowRight className="size-3 shrink-0 text-decor" aria-hidden />
                      <span className="rounded bg-marque-fond px-1.5 py-0.5 text-xs font-medium text-marque-fort">
                        {l.valeur}
                      </span>
                    </span>
                  ) : (
                    <span className="break-words">{l.valeur}</span>
                  )}
                </Champ>
              ))}
            </dl>
          </div>
        )}

        <p className="text-[11px] text-texte-4">Entrée n° {entree.id}</p>
      </div>
    </Dialog>
  );
}
