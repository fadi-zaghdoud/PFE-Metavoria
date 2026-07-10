import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Clock,
  Lock,
  Paperclip,
  Send,
  Sparkles,
  Ticket,
} from 'lucide-react';
import {
  trouverTicketDemo,
  type MessageDemo,
  type StatutTicket,
  type PrioriteTicket,
} from '../features/tickets/demo-data';
import { PrioriteLabel, SentimentBadge, SlaPill, StatutBadge } from '../features/tickets/ticket-ui';
import { useAuthStore } from '../store/authStore';
import { tempsRelatif } from '../lib/format';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Alert } from '../components/ui/Alert';
import { Select, Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/cn';

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

function MessageBulle({ message }: { message: MessageDemo }) {
  const estTechnicien = message.role === 'TECHNICIEN';

  if (message.noteInterne) {
    return (
      <div className="flex gap-3">
        <Avatar prenom={message.auteur.prenom} nom={message.auteur.nom} size="sm" className="mt-1" />
        <div className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <Lock className="size-3 text-amber-600" aria-hidden />
            <span className="font-medium text-amber-800">
              Note interne — {message.auteur.prenom} {message.auteur.nom}
            </span>
            <span className="text-amber-600/70">{tempsRelatif(message.date)}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-amber-900">
            {message.contenu}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar prenom={message.auteur.prenom} nom={message.auteur.nom} size="sm" className="mt-1" />
      <div
        className={cn(
          'min-w-0 flex-1 rounded-lg px-3.5 py-2.5',
          estTechnicien ? 'border border-slate-200 bg-white shadow-xs' : 'bg-slate-100',
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-900">
            {message.auteur.prenom} {message.auteur.nom}
          </span>
          {estTechnicien && <Badge variant="primary">Support</Badge>}
          <span className="text-slate-400">{tempsRelatif(message.date)}</span>
        </div>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {message.contenu}
        </p>
      </div>
    </div>
  );
}

export function TicketDetailPage() {
  const { id } = useParams();
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const ticket = useMemo(() => (id ? trouverTicketDemo(id) : undefined), [id]);

  const [reponse, setReponse] = useState('');
  const [messagesLocaux, setMessagesLocaux] = useState<MessageDemo[]>([]);
  const [statut, setStatut] = useState<StatutTicket | undefined>(ticket?.statut);
  const [priorite, setPriorite] = useState<PrioriteTicket | undefined>(ticket?.priorite);

  if (!ticket) {
    return (
      <EmptyState
        icon={Ticket}
        title="Ticket introuvable"
        description="Ce ticket n'existe pas dans le jeu de données de démonstration."
        action={
          <Link to="/tickets" className="text-sm font-medium text-primary-600 hover:underline">
            Retour à la liste
          </Link>
        }
      />
    );
  }

  const messages = [...ticket.messages, ...messagesLocaux];

  function envoyerReponse() {
    const contenu = reponse.trim();
    if (!contenu || !utilisateur) return;
    setMessagesLocaux((prev) => [
      ...prev,
      {
        id: 1000 + prev.length,
        auteur: { prenom: utilisateur.prenom, nom: utilisateur.nom, email: utilisateur.email },
        role: 'TECHNICIEN',
        contenu,
        date: new Date(),
      },
    ]);
    setReponse('');
  }

  return (
    <div>
      {/* En-tête */}
      <div className="mb-6">
        <Link
          to="/tickets"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Tickets
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-sm text-slate-400">{ticket.id}</span>
              <StatutBadge statut={statut ?? ticket.statut} />
              <PrioriteLabel priorite={priorite ?? ticket.priorite} />
            </div>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">{ticket.titre}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="size-3.5" aria-hidden />
              Créé {tempsRelatif(ticket.dateCreation)} · via {ticket.canal.toLowerCase()}
            </p>
          </div>
          <Button variant="secondary" disabled title="Disponible en Phase 3">
            <CheckCheck className="size-4" aria-hidden />
            Marquer résolu
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        {/* Colonne centrale : conversation */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Conversation" description={`${messages.length} message${messages.length > 1 ? 's' : ''}`} />
            <CardContent className="space-y-5">
              {messages.map((m) => (
                <MessageBulle key={m.id} message={m} />
              ))}
            </CardContent>

            {/* Composer */}
            <div className="border-t border-slate-100 p-4">
              <Textarea
                value={reponse}
                onChange={(e) => setReponse(e.target.value)}
                placeholder="Écrire une réponse au demandeur…"
                aria-label="Votre réponse"
              />
              <div className="mt-3 flex items-center justify-between">
                <Button variant="ghost" size="sm" disabled title="Pièces jointes — disponible en Phase 3">
                  <Paperclip className="size-4" aria-hidden />
                  Joindre
                </Button>
                <Button size="sm" onClick={envoyerReponse} disabled={!reponse.trim()}>
                  <Send className="size-3.5" aria-hidden />
                  Envoyer
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {/* Assistant IA */}
          <div className="rounded-xl bg-gradient-to-br from-primary-400 via-violet-400 to-primary-400 p-px shadow-xs">
            <div className="rounded-[calc(0.75rem-1px)] bg-white">
              <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
                <span className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary-500 to-violet-600 text-white">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                <h2 className="text-sm font-semibold text-slate-900">Assistant IA</h2>
                <Badge variant="primary" className="ml-auto">
                  Aperçu
                </Badge>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Résumé</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{ticket.ia.resume}</p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sentiment</p>
                  <SentimentBadge sentiment={ticket.ia.sentiment} />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Classification · {ticket.categorie}
                    </p>
                    <span className="text-xs font-semibold tabular-nums text-slate-600">
                      {Math.round(ticket.ia.confianceClassification * 100)} %
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
                    role="meter"
                    aria-label="Confiance de la classification"
                    aria-valuenow={Math.round(ticket.ia.confianceClassification * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-500 to-violet-500"
                      style={{ width: `${ticket.ia.confianceClassification * 100}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Suggestion de réponse
                  </p>
                  <p className="mt-1.5 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                    {ticket.ia.suggestionReponse}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2.5 w-full"
                    onClick={() => setReponse(ticket.ia.suggestionReponse)}
                  >
                    <Sparkles className="size-3.5 text-primary-500" aria-hidden />
                    Utiliser cette réponse
                  </Button>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-400">
                  Validation humaine obligatoire — l'IA assiste, le technicien décide.
                </p>
              </div>
            </div>
          </div>

          {/* Demandeur */}
          <Card>
            <CardHeader title="Demandeur" />
            <CardContent className="flex items-center gap-3">
              <Avatar prenom={ticket.demandeur.prenom} nom={ticket.demandeur.nom} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {ticket.demandeur.prenom} {ticket.demandeur.nom}
                </p>
                <p className="truncate text-xs text-slate-400">{ticket.demandeur.email}</p>
                {ticket.demandeur.service && (
                  <p className="mt-0.5 text-xs text-slate-500">{ticket.demandeur.service}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Propriétés */}
          <Card>
            <CardHeader title="Propriétés" />
            <CardContent className="space-y-3.5">
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">Statut</p>
                <Select
                  value={statut ?? ticket.statut}
                  onChange={(e) => setStatut(e.target.value as StatutTicket)}
                  aria-label="Statut du ticket"
                >
                  {STATUTS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">Priorité</p>
                <Select
                  value={priorite ?? ticket.priorite}
                  onChange={(e) => setPriorite(e.target.value as PrioriteTicket)}
                  aria-label="Priorité du ticket"
                >
                  {PRIORITES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">SLA</p>
                <div>
                  <SlaPill echeance={ticket.slaEcheance} statut={statut ?? ticket.statut} />
                </div>
              </div>
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">Assigné à</p>
                {ticket.technicien ? (
                  <div className="flex items-center gap-2">
                    <Avatar prenom={ticket.technicien.prenom} nom={ticket.technicien.nom} size="sm" />
                    <span className="truncate text-sm text-slate-700">
                      {ticket.technicien.prenom} {ticket.technicien.nom}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400">Non assigné</span>
                )}
              </div>
              <div className="grid grid-cols-[90px_1fr] items-start gap-2">
                <p className="pt-0.5 text-xs text-slate-400">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="neutral">{ticket.categorie}</Badge>
                  {ticket.tags.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tickets similaires */}
          <Card>
            <CardHeader title="Tickets similaires" description="Recherche vectorielle (RAG) — aperçu" />
            <CardContent className="p-2">
              <ul className="divide-y divide-slate-100">
                {ticket.ia.ticketsSimilaires.map((similaire) => (
                  <li key={similaire.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="font-mono text-xs text-slate-400">{similaire.id}</span>
                    <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{similaire.titre}</p>
                    <Badge variant="primary">{Math.round(similaire.similarite * 100)} %</Badge>
                    <ArrowRight className="size-3.5 text-slate-300" aria-hidden />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Alert variant="info">
            Données de démonstration — ce panneau sera alimenté par le moteur IA (Phase 5).
          </Alert>
        </div>
      </div>
    </div>
  );
}
