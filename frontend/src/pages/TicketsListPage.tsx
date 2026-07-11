import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Search, Ticket } from 'lucide-react';
import { ticketsApi } from '../features/tickets/ticketsApi';
import {
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
import { PageHeader } from '../components/ui/PageHeader';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Alert } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

type Vue = 'TOUS' | 'MES_TICKETS' | 'NON_ASSIGNES';

const VUES: { id: Vue; label: string }[] = [
  { id: 'TOUS', label: 'Tous' },
  { id: 'MES_TICKETS', label: 'Mes tickets' },
  { id: 'NON_ASSIGNES', label: 'Non assignés' },
];

export function TicketsListPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const estSupport = utilisateur?.role === 'TECHNICIEN' || utilisateur?.role === 'ADMINISTRATEUR';

  const [tickets, setTickets] = useState<TicketResume[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>('TOUS');
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<StatutTicket | ''>('');
  const [filtrePriorite, setFiltrePriorite] = useState<PrioriteTicket | ''>('');

  async function chargerTickets() {
    if (!token) return;
    setChargement(true);
    setErreur(null);
    try {
      const filtres: FiltresTickets = {
        statut: filtreStatut || undefined,
        priorite: filtrePriorite || undefined,
      };
      if (estSupport && vue === 'MES_TICKETS' && utilisateur) filtres.technicienId = utilisateur.id;
      if (estSupport && vue === 'NON_ASSIGNES') filtres.nonAssignes = true;

      const { tickets: liste } = await ticketsApi.lister(filtres, token);
      setTickets(liste);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Impossible de charger les tickets');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue, filtreStatut, filtrePriorite, token]);

  // Recherche instantanée côté client (id, titre, demandeur, catégorie).
  const resultats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      `${t.id} ${t.titre} ${t.demandeur.prenom} ${t.demandeur.nom} ${t.categorie?.nom ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [tickets, recherche]);

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
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
                vue === id
                  ? 'bg-primary-600 text-white shadow-xs'
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
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher par titre, demandeur, catégorie…"
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
        <p className="ml-auto text-xs tabular-nums text-slate-400">
          {chargement ? '…' : `${resultats.length} ticket${resultats.length > 1 ? 's' : ''}`}
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

            {!chargement && resultats.length === 0 && (
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
              resultats.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="cursor-pointer transition-colors hover:bg-slate-50/70"
                >
                  <Td>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">#{t.id}</span>
                        <p className="truncate font-medium text-slate-900">{t.titre}</p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {t.categorie ? (
                          <Badge variant="neutral">{t.categorie.nom}</Badge>
                        ) : (
                          <span className="text-xs text-slate-300">Non classé</span>
                        )}
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
                        <Avatar prenom={t.demandeur.prenom} nom={t.demandeur.nom} size="sm" />
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
                  <Td className="hidden lg:table-cell">
                    {t.technicien ? (
                      <div className="flex items-center gap-2">
                        <Avatar prenom={t.technicien.prenom} nom={t.technicien.nom} size="sm" />
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
    </div>
  );
}
