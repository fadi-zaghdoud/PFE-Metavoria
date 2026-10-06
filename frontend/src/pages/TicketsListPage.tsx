import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Plus, RefreshCw, Search, Ticket } from 'lucide-react';
import { ticketsApi } from '../features/tickets/ticketsApi';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import { SelecteurTechnicien } from '../features/tickets/SelecteurTechnicien';
import { BoutonPropriete, PastilleVide } from '../features/tickets/ChoixPropriete';
import {
  BadgeAnciennete,
  LABEL_PRIORITE,
  LABEL_STATUT,
  PRIORITE_OPTIONS,
  PrioriteLabel,
  STATUT_OPTIONS,
  StatutBadge,
} from '../features/tickets/ticket-ui';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { tempsRelatif } from '../lib/format';
import type { FiltresTickets, PrioriteTicket, StatutTicket, TicketResume } from '../types/ticket';
import type { Utilisateur } from '../types/auth';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

type Vue = 'TOUS' | 'MES_TICKETS' | 'NON_ASSIGNES';

// Un ticket résolu ou clôturé ne peut plus être (ré)affecté : `ticketService.affecter` le
// refuse par une 400. Le miroir est ici pour ne pas proposer une action qui échouerait —
// l'autorité reste au serveur.
const STATUTS_NON_AFFECTABLES: StatutTicket[] = ['RESOLU', 'CLOTURE'];

// Taille de page. La liste entière pesait 877 Ko pour 872 tickets, rechargés à chaque
// changement de filtre ; 50 lignes couvrent un écran et son défilement immédiat.
const PAR_PAGE = 50;

const VUES: { id: Vue; label: string }[] = [
  { id: 'TOUS', label: 'Tous' },
  { id: 'MES_TICKETS', label: 'Mes tickets' },
  { id: 'NON_ASSIGNES', label: 'Non assignés' },
];

export function TicketsListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const token = useAuthStore((state) => state.token);
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const estSupport = utilisateur?.role === 'TECHNICIEN' || utilisateur?.role === 'ADMINISTRATEUR';
  const estAdmin = utilisateur?.role === 'ADMINISTRATEUR';

  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketResume[]>([]);
  const [chargement, setChargement] = useState(true);
  const [chargementSuite, setChargementSuite] = useState(false);
  const [curseurSuivant, setCurseurSuivant] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Ouverture depuis le tableau de bord : « ?vue=non-assignes » pré-sélectionne la vue.
  // Ignoré pour un employé, qui ne dispose pas de cette vue. Lu une seule fois, à
  // l'initialisation : l'utilisateur reste ensuite libre de changer d'onglet.
  const [vue, setVue] = useState<Vue>(
    searchParams.get('vue') === 'non-assignes' && estSupport ? 'NON_ASSIGNES' : 'TOUS',
  );
  const [techniciens, setTechniciens] = useState<Utilisateur[]>([]);
  // Identifiant du ticket dont l'affectation est en cours, pour ne bloquer QUE sa ligne.
  const [affectationEnCours, setAffectationEnCours] = useState<number | null>(null);
  // Ticket dont on choisit le technicien. UN SEUL sélecteur pour toute la table : le
  // monter par ligne en ferait cinquante, tous inertes sauf un.
  const [ticketAAffecter, setTicketAAffecter] = useState<TicketResume | null>(null);
  const [recherche, setRecherche] = useState('');
  // Terme réellement envoyé au serveur, temporisé : sans cela chaque frappe déclencherait
  // une requête paginée. 300 ms est en dessous du seuil de perception d'une saisie fluide.
  const [rechercheEnvoyee, setRechercheEnvoyee] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<StatutTicket | ''>('');
  const [filtrePriorite, setFiltrePriorite] = useState<PrioriteTicket | ''>('');

  useEffect(() => {
    const minuteur = setTimeout(() => setRechercheEnvoyee(recherche.trim()), 300);
    return () => clearTimeout(minuteur);
  }, [recherche]);

  // Techniciens affectables — chargés une seule fois, et seulement pour l'administrateur :
  // lui seul peut affecter (`ticketService.affecter` refuse tout autre rôle). Un échec est
  // silencieux : la colonne retombe alors sur l'affichage simple, la liste reste utilisable.
  useEffect(() => {
    if (!token || !estAdmin) return;
    utilisateursApi
      .lister({ role: 'TECHNICIEN', actif: true }, token)
      .then(({ utilisateurs }) => setTechniciens(utilisateurs))
      .catch(() => {});
  }, [token, estAdmin]);

  async function chargerTickets() {
    if (!token) return;
    setChargement(true);
    setErreur(null);
    try {
      const filtres: FiltresTickets = {
        statut: filtreStatut || undefined,
        priorite: filtrePriorite || undefined,
        q: rechercheEnvoyee || undefined,
        limite: PAR_PAGE,
      };
      if (estSupport && vue === 'MES_TICKETS' && utilisateur) filtres.technicienId = utilisateur.id;
      if (estSupport && vue === 'NON_ASSIGNES') filtres.nonAssignes = true;

      const { tickets: liste, curseurSuivant: suite } = await ticketsApi.lister(filtres, token);
      setTickets(liste);
      setCurseurSuivant(suite);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les tickets');
    } finally {
      setChargement(false);
    }
  }

  // « Charger plus » : on repart du dernier identifiant affiché. Le serveur poursuit dans
  // l'ordre ANTÉCHRONOLOGIQUE, pas dans celui des identifiants — les deux divergent sur
  // 858 des 872 tickets, le corpus ayant été inséré avec des dates antérieures à son
  // ordre d'insertion.
  async function chargerSuite() {
    if (!token || !curseurSuivant) return;
    setChargementSuite(true);
    try {
      const filtres: FiltresTickets = {
        statut: filtreStatut || undefined,
        priorite: filtrePriorite || undefined,
        q: rechercheEnvoyee || undefined,
        limite: PAR_PAGE,
        avantId: curseurSuivant,
      };
      if (estSupport && vue === 'MES_TICKETS' && utilisateur) filtres.technicienId = utilisateur.id;
      if (estSupport && vue === 'NON_ASSIGNES') filtres.nonAssignes = true;

      const suite = await ticketsApi.lister(filtres, token);
      setTickets((actuels) => [...actuels, ...suite.tickets]);
      setCurseurSuivant(suite.curseurSuivant);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger la suite');
    } finally {
      setChargementSuite(false);
    }
  }

  // Affectation depuis la liste. Le ticket revient complet : on remplace la ligne par ce
  // que le SERVEUR dit d'elle, plutôt que de deviner — l'affectation change aussi le
  // statut (NOUVEAU devient EN_ATTENTE), et le recopier à la main aurait fini par diverger.
  async function affecter(ticket: TicketResume, technicienId: number | null) {
    if (!token) return;
    setAffectationEnCours(ticket.id);
    try {
      const { ticket: misAJour } = await ticketsApi.affecter(ticket.id, technicienId, token);
      setTickets((actuels) =>
        actuels.map((t) =>
          t.id === ticket.id
            ? { ...t, technicien: misAJour.technicien, technicienId: misAJour.technicienId, statut: misAJour.statut }
            : t,
        ),
      );
      setTicketAAffecter(null);
      toast.success(
        technicienId ? 'Ticket affecté' : 'Affectation retirée',
        misAJour.technicien
          ? `#${ticket.id} confié à ${misAJour.technicien.prenom} ${misAJour.technicien.nom}.`
          : `#${ticket.id} n'a plus de technicien.`,
      );
    } catch (err) {
      toast.error(
        'Affectation impossible',
        err instanceof ApiError ? err.message : 'Réessayez dans un instant.',
      );
    } finally {
      setAffectationEnCours(null);
    }
  }

  useEffect(() => {
    chargerTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue, filtreStatut, filtrePriorite, rechercheEnvoyee, token]);

  // La recherche est passée CÔTÉ SERVEUR. Filtrer ici ne portait que sur les pages déjà
  // chargées : exhaustif tant que la liste entière tenait en mémoire, faux dès qu'elle est
  // paginée — « aucun résultat » aurait pu signifier « pas dans les 50 premières lignes ».
  return (
    <div>
      <PageHeader
        title="Tickets"
        description={
          estSupport
            ? "File d'attente du support — filtres et vues."
            : 'Vos demandes de support et leur suivi.'
        }
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={chargerTickets} disabled={chargement}>
              <RefreshCw className="size-3.5" aria-hidden />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => navigate('/tickets/nouveau')}>
              <Plus className="size-3.5" aria-hidden />
              Nouveau ticket
            </Button>
          </>
        }
      />

      {/* Vues réservées au support (l'employé ne voit que ses propres tickets). */}
      {estSupport && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Vues">
          {VUES.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={vue === id}
              onClick={() => setVue(id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
                vue === id
                  ? 'bg-primary-600 text-white shadow-glow-sm ring-1 ring-inset ring-white/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Barre d'outils */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Un peu plus large qu'avant : le champ annonce desormais cinq cibles de
            recherche, et « sm:max-w-sm » tronquait l'indication. */}
        <div className="relative min-w-56 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="N°, titre, description, demandeur, catégorie…"
            aria-label="Rechercher un ticket"
            className="pl-9"
          />
        </div>
        <Select
          value={filtreStatut}
          onChange={(e) => setFiltreStatut(e.target.value as StatutTicket | '')}
          aria-label="Filtrer par statut"
          className="w-40"
        >
          <option value="">Tous statuts</option>
          {STATUT_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {LABEL_STATUT[s]}
            </option>
          ))}
        </Select>
        <Select
          value={filtrePriorite}
          onChange={(e) => setFiltrePriorite(e.target.value as PrioriteTicket | '')}
          aria-label="Filtrer par priorité"
          className="w-40"
        >
          <option value="">Toutes priorités</option>
          {PRIORITE_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {LABEL_PRIORITE[p]}
            </option>
          ))}
        </Select>
        {/* « chargés » et non « trouvés » : la liste est paginée, ce nombre est celui des
            lignes en main, pas celui des tickets correspondant aux filtres. Le dire évite
            de laisser lire « 50 tickets » comme un total. */}
        <p className="ml-auto text-xs tabular-nums text-slate-400">
          {chargement
            ? '…'
            : `${tickets.length} ticket${tickets.length > 1 ? 's' : ''} chargé${
                tickets.length > 1 ? 's' : ''
              }${curseurSuivant !== null ? ' — il en reste' : ''}`}
        </p>
      </div>

      {erreur && (
        <Alert variant="danger" className="mb-4">
          {erreur}
        </Alert>
      )}

      <TableContainer className="max-h-[calc(100dvh-20rem)]">
        <Table>
          <thead>
            <tr>
              <Th>Ticket</Th>
              {estSupport && <Th className="hidden lg:table-cell">Demandeur</Th>}
              <Th>Statut</Th>
              <Th className="hidden md:table-cell">Priorité</Th>
              <Th className="hidden lg:table-cell">Assigné à</Th>
              <Th className="hidden md:table-cell">Créé</Th>
            </tr>
          </thead>
          <tbody>
            {chargement &&
              ['sq1', 'sq2', 'sq3', 'sq4', 'sq5'].map((cle) => (
                <tr key={cle}>
                  <Td colSpan={6}>
                    <Skeleton className="h-9" />
                  </Td>
                </tr>
              ))}

            {!chargement && tickets.length === 0 && (
              <tr>
                <Td colSpan={6} className="p-0">
                  <EmptyState
                    icon={Ticket}
                    title="Aucun ticket"
                    description={
                      recherche
                        ? "Aucun ticket ne correspond à votre recherche."
                        : 'Créez un ticket pour démarrer une demande de support.'
                    }
                  />
                </Td>
              </tr>
            )}

            {!chargement &&
              tickets.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/70"
                  tabIndex={0}
                  role="button"
                  aria-label={`Ouvrir le ticket ${t.id} : ${t.titre}`}
                  onKeyDown={(ev) => {
                    // LA LIGNE NE RÉAGIT QUE SI ELLE EST ELLE-MÊME LA CIBLE. Elle contient
                    // le menu d'affectation, pour lequel Espace ouvre la liste et Entrée
                    // valide : sans ce garde, ces touches remonteraient jusqu'ici et
                    // quitteraient la page au lieu de piloter le menu. La page d'audit n'a
                    // pas ce garde parce que ses lignes ne contiennent aucun contrôle.
                    if (ev.target !== ev.currentTarget) return;
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      navigate(`/tickets/${t.id}`);
                    }
                  }}
                >
                  <Td>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">#{t.id}</span>
                        <p className="truncate font-medium text-slate-900">{t.titre}</p>
                      </div>
                      {/* L'ancienneté est posée ICI, dans la première colonne, et non à
                          côté de « Créé » : cette dernière disparaît sous md, et c'est
                          justement sur petit écran qu'un ticket oublié doit rester
                          visible. */}
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        {t.categorie ? (
                          <Badge variant="neutral">{t.categorie.nom}</Badge>
                        ) : (
                          <span className="text-xs text-slate-300">Non classé</span>
                        )}
                        <BadgeAnciennete statut={t.statut} dateCreation={t.dateCreation} />
                        {t._count.commentaires > 0 && (
                          <span className="text-xs text-slate-400">
                            {t._count.commentaires} message{t._count.commentaires > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </Td>
                  {estSupport && (
                    <Td className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Avatar prenom={t.demandeur.prenom} nom={t.demandeur.nom} photoUrl={t.demandeur.photoUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-700">
                            {t.demandeur.prenom} {t.demandeur.nom}
                          </p>
                          <p className="truncate text-xs text-slate-400">{t.demandeur.service ?? '—'}</p>
                        </div>
                      </div>
                    </Td>
                  )}
                  <Td>
                    <StatutBadge statut={t.statut} />
                  </Td>
                  <Td className="hidden md:table-cell">
                    <PrioriteLabel priorite={t.priorite} />
                  </Td>
                  {/* Affectation SUR PLACE pour l'administrateur : 53 tickets sans
                      technicien demandaient jusqu'ici 53 allers-retours par la page de
                      détail. Même contrôle que le panneau Propriétés du détail — un
                      <option> natif ne peut pas porter la photo du technicien.
                      `stopPropagation` est indispensable : la ligne entière est cliquable
                      et ouvrirait le ticket au premier clic sur le bouton.
                      Largeur w-52 et non w-44 : avec la pastille de 32 px et le chevron,
                      44 ne laissait qu'une centaine de pixels au nom et coupait
                      « Karim Trabelsi ». */}
                  <Td className="hidden lg:table-cell">
                    {estAdmin && !STATUTS_NON_AFFECTABLES.includes(t.statut) ? (
                      <div className="w-52" onClick={(e) => e.stopPropagation()}>
                        <BoutonPropriete
                          visuel={
                            t.technicien ? (
                              <Avatar
                                prenom={t.technicien.prenom}
                                nom={t.technicien.nom}
                                photoUrl={t.technicien.photoUrl}
                              />
                            ) : (
                              <PastilleVide />
                            )
                          }
                          libelle={
                            t.technicien
                              ? `${t.technicien.prenom} ${t.technicien.nom}`
                              : 'Non assigné'
                          }
                          vide={!t.technicien}
                          disabled={affectationEnCours === t.id}
                          ariaLabel={
                            t.technicien
                              ? `Changer le technicien du ticket ${t.id} (actuellement ${t.technicien.prenom} ${t.technicien.nom})`
                              : `Affecter le ticket ${t.id}`
                          }
                          onClick={() => setTicketAAffecter(t)}
                        />
                      </div>
                    ) : t.technicien ? (
                      <div className="flex items-center gap-2">
                        <Avatar prenom={t.technicien.prenom} nom={t.technicien.nom} photoUrl={t.technicien.photoUrl} size="sm" />
                        <span className="truncate text-sm text-slate-700">
                          {t.technicien.prenom} {t.technicien.nom}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Non assigné</span>
                    )}
                  </Td>
                  <Td className="hidden text-xs text-slate-400 md:table-cell">
                    {tempsRelatif(t.dateCreation)}
                  </Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </TableContainer>

      <SelecteurTechnicien
        ticket={ticketAAffecter}
        techniciens={techniciens}
        enCours={affectationEnCours !== null}
        onChoisir={(technicienId) => {
          if (ticketAAffecter) affecter(ticketAAffecter, technicienId);
        }}
        onClose={() => setTicketAAffecter(null)}
      />

      {!chargement && curseurSuivant !== null && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={chargerSuite} loading={chargementSuite}>
            <ChevronDown className="size-3.5" aria-hidden />
            Charger plus
          </Button>
        </div>
      )}
    </div>
  );
}
