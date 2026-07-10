import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Search, Ticket, UserPlus, X } from 'lucide-react';
import { TICKETS_DEMO, type StatutTicket, type PrioriteTicket } from '../features/tickets/demo-data';
import { CanalIcone, PrioriteLabel, SlaPill, StatutBadge } from '../features/tickets/ticket-ui';
import { tempsRelatif } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Table, TableContainer, Td, Th } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

type Vue = 'TOUS' | 'NON_ASSIGNES' | 'URGENTS' | 'EN_RETARD';

const VUES: { id: Vue; label: string }[] = [
  { id: 'TOUS', label: 'Tous' },
  { id: 'NON_ASSIGNES', label: 'Non assignés' },
  { id: 'URGENTS', label: 'Urgents' },
  { id: 'EN_RETARD', label: 'SLA dépassé' },
];

const STATUTS: { value: StatutTicket; label: string }[] = [
  { value: 'NOUVEAU', label: 'Nouveau' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'RESOLU', label: 'Résolu' },
  { value: 'CLOTURE', label: 'Clôturé' },
];

const PRIORITES: { value: PrioriteTicket; label: string }[] = [
  { value: 'CRITIQUE', label: 'Critique' },
  { value: 'HAUTE', label: 'Haute' },
  { value: 'MOYENNE', label: 'Moyenne' },
  { value: 'FAIBLE', label: 'Faible' },
];

export function TicketsListPage() {
  const navigate = useNavigate();
  const [vue, setVue] = useState<Vue>('TOUS');
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<StatutTicket | ''>('');
  const [filtrePriorite, setFiltrePriorite] = useState<PrioriteTicket | ''>('');
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const resultats = useMemo(() => {
    let liste = TICKETS_DEMO;
    if (vue === 'NON_ASSIGNES') liste = liste.filter((t) => !t.technicien);
    if (vue === 'URGENTS') liste = liste.filter((t) => t.priorite === 'CRITIQUE' || t.priorite === 'HAUTE');
    if (vue === 'EN_RETARD')
      liste = liste.filter(
        (t) => t.slaEcheance.getTime() < Date.now() && t.statut !== 'RESOLU' && t.statut !== 'CLOTURE',
      );
    if (filtreStatut) liste = liste.filter((t) => t.statut === filtreStatut);
    if (filtrePriorite) liste = liste.filter((t) => t.priorite === filtrePriorite);
    const q = recherche.trim().toLowerCase();
    if (q) {
      liste = liste.filter((t) =>
        `${t.id} ${t.titre} ${t.demandeur.prenom} ${t.demandeur.nom} ${t.categorie} ${t.tags.join(' ')}`
          .toLowerCase()
          .includes(q),
      );
    }
    return liste;
  }, [vue, recherche, filtreStatut, filtrePriorite]);

  function basculerSelection(id: string) {
    setSelection((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  function basculerTout() {
    setSelection((prev) =>
      prev.size === resultats.length ? new Set() : new Set(resultats.map((t) => t.id)),
    );
  }

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="File d'attente du support — recherche, filtres et vues enregistrées."
        actions={
          <Button disabled title="Disponible en Phase 3 (module Gestion des tickets)">
            Nouveau ticket
          </Button>
        }
      />

      <Alert variant="info" className="mb-5">
        <strong className="font-semibold">Aperçu du module Tickets.</strong> Données de démonstration —
        cette interface sera connectée à l'API réelle lors de la Phase 3, puis enrichie par l'IA en
        Phase 5.
      </Alert>

      {/* Vues enregistrées */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Vues enregistrées">
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
            placeholder="Rechercher par titre, demandeur, tag…"
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
          {STATUTS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
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
          {PRIORITES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <p className="ml-auto text-xs tabular-nums text-slate-400">
          {resultats.length} ticket{resultats.length > 1 ? 's' : ''}
        </p>
      </div>

      <TableContainer className="max-h-[calc(100dvh-22rem)]">
        <Table>
          <thead>
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={resultats.length > 0 && selection.size === resultats.length}
                  onChange={basculerTout}
                  className="size-4 rounded border-slate-300 accent-primary-600"
                />
              </Th>
              <Th>Ticket</Th>
              <Th className="hidden lg:table-cell">Demandeur</Th>
              <Th>Statut</Th>
              <Th className="hidden md:table-cell">Priorité</Th>
              <Th className="hidden xl:table-cell">SLA</Th>
              <Th className="hidden lg:table-cell">Assigné à</Th>
              <Th className="hidden md:table-cell">Mise à jour</Th>
            </tr>
          </thead>
          <tbody>
            {resultats.length === 0 && (
              <tr>
                <Td colSpan={8} className="p-0">
                  <EmptyState
                    icon={Ticket}
                    title="Aucun ticket ne correspond"
                    description="Essayez d'élargir la vue ou de modifier vos filtres."
                  />
                </Td>
              </tr>
            )}
            {resultats.map((t) => (
              <tr
                key={t.id}
                onClick={() => navigate(`/tickets/${t.id}`)}
                className="cursor-pointer transition-colors hover:bg-slate-50/70"
              >
                <Td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${t.id}`}
                    checked={selection.has(t.id)}
                    onChange={() => basculerSelection(t.id)}
                    className="size-4 rounded border-slate-300 accent-primary-600"
                  />
                </Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <CanalIcone canal={t.canal} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{t.id}</span>
                        <p className="truncate font-medium text-slate-900">{t.titre}</p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge variant="neutral">{t.categorie}</Badge>
                        {t.tags.map((tag) => (
                          <span key={tag} className="hidden text-xs text-slate-400 sm:inline">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Td>
                <Td className="hidden lg:table-cell">
                  <div className="flex items-center gap-2">
                    <Avatar prenom={t.demandeur.prenom} nom={t.demandeur.nom} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-700">
                        {t.demandeur.prenom} {t.demandeur.nom}
                      </p>
                      <p className="truncate text-xs text-slate-400">{t.demandeur.service}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <StatutBadge statut={t.statut} />
                </Td>
                <Td className="hidden md:table-cell">
                  <PrioriteLabel priorite={t.priorite} />
                </Td>
                <Td className="hidden xl:table-cell">
                  <SlaPill echeance={t.slaEcheance} statut={t.statut} />
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
                <Td className="hidden text-xs text-slate-400 md:table-cell">{tempsRelatif(t.dateMaj)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableContainer>

      {/* Barre d'actions groupées */}
      <AnimatePresence>
        {selection.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg"
          >
            <p className="text-sm font-medium text-slate-700">
              {selection.size} sélectionné{selection.size > 1 ? 's' : ''}
            </p>
            <div className="h-5 w-px bg-slate-200" aria-hidden />
            <Button variant="secondary" size="sm" disabled title="Disponible en Phase 3">
              <UserPlus className="size-3.5" aria-hidden />
              Assigner
            </Button>
            <Button variant="secondary" size="sm" disabled title="Disponible en Phase 3">
              Marquer résolu
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelection(new Set())}
              aria-label="Effacer la sélection"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
