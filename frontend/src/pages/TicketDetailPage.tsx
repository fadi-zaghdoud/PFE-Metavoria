import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCheck,
  Clock,
  Flag,
  Loader2,
  Lock,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Tag,
  Ticket,
  UserMinus,
  UserPlus,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { ticketsApi } from '../features/tickets/ticketsApi';
import { utilisateursApi } from '../features/utilisateurs/utilisateursApi';
import {
  LABEL_PRIORITE,
  LABEL_STATUT,
  PRIORITE_OPTIONS,
  PrioriteLabel,
  StatutBadge,
} from '../features/tickets/ticket-ui';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { tempsRelatif, dateLongue } from '../lib/format';
import type {
  Categorie,
  Commentaire,
  DetailPrioriteIA,
  DetailSolutionIA,
  EvenementTicket,
  PrioriteTicket,
  StatutTicket,
  SuggestionIA,
  TicketDetail,
  TypeEvenement,
} from '../types/ticket';
import type { Utilisateur } from '../types/auth';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Select, Textarea } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/cn';

function MessageBulle({ commentaire, estDemandeur }: { commentaire: Commentaire; estDemandeur: boolean }) {
  const { auteur } = commentaire;
  return (
    <div className="flex gap-3">
      <Avatar prenom={auteur.prenom} nom={auteur.nom} size="sm" className="mt-1" />
      <div
        className={cn(
          'min-w-0 flex-1 rounded-lg px-3.5 py-2.5',
          estDemandeur ? 'bg-slate-100' : 'border border-slate-200 bg-white shadow-xs',
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium text-slate-900">
            {auteur.prenom} {auteur.nom}
          </span>
          {!estDemandeur && <Badge variant="primary">Support</Badge>}
          <span className="text-slate-400">{tempsRelatif(commentaire.dateCreation)}</span>
        </div>
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {commentaire.contenu}
        </p>
      </div>
    </div>
  );
}

function labelStatut(v: string | null): string {
  return v && v in LABEL_STATUT ? LABEL_STATUT[v as StatutTicket] : v ?? '—';
}

function labelPriorite(v: string | null): string {
  return v && v in LABEL_PRIORITE ? LABEL_PRIORITE[v as PrioriteTicket] : v ?? '—';
}

function decrireEvenement(e: EvenementTicket): string {
  switch (e.type) {
    case 'CHANGEMENT_STATUT':
      return `a changé le statut : ${labelStatut(e.ancienneValeur)} → ${labelStatut(e.nouvelleValeur)}`;
    case 'CHANGEMENT_PRIORITE':
      return `a changé la priorité : ${labelPriorite(e.ancienneValeur)} → ${labelPriorite(e.nouvelleValeur)}`;
    case 'CHANGEMENT_CATEGORIE':
      return `a changé la catégorie : ${e.ancienneValeur ?? 'Non classé'} → ${e.nouvelleValeur ?? '—'}`;
    case 'PRISE_EN_CHARGE':
      return 'a pris le ticket en charge';
    case 'AFFECTATION':
      return `a assigné le ticket à ${e.nouvelleValeur}`;
    case 'DESAFFECTATION':
      return "a retiré l'affectation";
    case 'EVALUATION':
      return `a validé la résolution : ${e.nouvelleValeur ?? ''}`;
    default:
      return 'a mis à jour le ticket';
  }
}

const ICONE_EVENEMENT: Record<TypeEvenement, LucideIcon> = {
  CHANGEMENT_STATUT: RefreshCw,
  CHANGEMENT_PRIORITE: Flag,
  CHANGEMENT_CATEGORIE: Tag,
  AFFECTATION: UserPlus,
  DESAFFECTATION: UserMinus,
  PRISE_EN_CHARGE: Wrench,
  EVALUATION: Star,
};

// Ligne d'historique (centrée, discrète) affichée dans le fil, entre les messages.
function EvenementLigne({ evenement }: { evenement: EvenementTicket }) {
  const Icon = ICONE_EVENEMENT[evenement.type];
  return (
    <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-400">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-slate-500">
          {evenement.auteur.prenom} {evenement.auteur.nom}
        </span>{' '}
        {decrireEvenement(evenement)} · {tempsRelatif(evenement.dateCreation)}
      </span>
    </div>
  );
}

function EtoilesLecture({ note }: { note: number }) {
  return (
    <div className="flex" aria-label={`Note : ${note} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('size-5', n <= note ? 'fill-amber-400 text-amber-400' : 'text-slate-200')}
          aria-hidden
        />
      ))}
    </div>
  );
}

// Bloc de satisfaction : formulaire (note + commentaire) pour le demandeur,
// synthèse en lecture seule pour le support et après évaluation.
function BlocSatisfaction({
  ticket,
  estDemandeur,
  onEvaluer,
  enCours,
}: {
  ticket: TicketDetail;
  estDemandeur: boolean;
  onEvaluer: (note: number, commentaire: string) => void;
  enCours: boolean;
}) {
  const dejaEvalue = ticket.satisfactionNote != null;
  const [note, setNote] = useState(0);
  const [survol, setSurvol] = useState(0);
  const [commentaire, setCommentaire] = useState('');

  // Le demandeur valide UNE fois, depuis l'état RESOLU (la validation clôture le
  // ticket). Après clôture, l'évaluation est verrouillée côté serveur → lecture seule.
  const peutValider = estDemandeur && ticket.statut === 'RESOLU' && !dejaEvalue;

  if (peutValider) {
    return (
      <Card>
        <CardHeader
          title="Valider la résolution"
          description="Le problème a-t-il été résolu à votre convenance ? Votre validation clôturera le ticket."
        />
        <CardContent className="space-y-3">
          <div className="flex items-center gap-1" onMouseLeave={() => setSurvol(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={enCours}
                onMouseEnter={() => setSurvol(n)}
                onClick={() => setNote(n)}
                aria-label={`Attribuer ${n} sur 5`}
                className="rounded p-0.5 disabled:cursor-not-allowed"
              >
                <Star
                  className={cn(
                    'size-7 transition-colors',
                    n <= (survol || note)
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 hover:text-amber-300',
                  )}
                  aria-hidden
                />
              </button>
            ))}
          </div>
          <Textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Un mot sur la résolution ? (facultatif)"
            aria-label="Commentaire de satisfaction"
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              loading={enCours}
              disabled={note < 1 || enCours}
              onClick={() => onEvaluer(note, commentaire)}
            >
              Valider et clôturer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dejaEvalue) {
    return (
      <Card>
        <CardHeader title={estDemandeur ? 'Votre satisfaction' : 'Satisfaction du demandeur'} />
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <EtoilesLecture note={ticket.satisfactionNote as number} />
            <span className="text-sm font-medium text-slate-700">{ticket.satisfactionNote}/5</span>
          </div>
          {ticket.satisfactionCommentaire && (
            <p className="whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-600">
              « {ticket.satisfactionCommentaire} »
            </p>
          )}
          {ticket.satisfactionDate && (
            <p className="text-xs text-slate-400">Validé {tempsRelatif(ticket.satisfactionDate)}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Reste deux cas : RESOLU en attente de validation (vue support), ou CLOTURE sans note (clôture admin).
  return (
    <Card>
      <CardHeader title="Satisfaction du demandeur" />
      <CardContent>
        <p className="text-sm text-slate-400">
          {ticket.statut === 'RESOLU'
            ? 'En attente de la validation du demandeur.'
            : 'Ticket clôturé sans évaluation du demandeur.'}
        </p>
      </CardContent>
    </Card>
  );
}

// Liste « tickets similaires » (candidats RRF), liens vers les tickets résolus de la KB.
function TicketsSimilaires({ docs }: { docs: DetailSolutionIA['similaires'] }) {
  if (docs.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-slate-400">Tickets similaires</p>
      <ul className="mt-1 space-y-1">
        {docs.map((d) => (
          <li key={d.id}>
            <Link
              to={`/tickets/${d.id}`}
              className="text-xs text-slate-600 hover:text-primary-700 hover:underline"
            >
              <span className="font-mono">#{d.id}</span> {d.titre}
              {d.categorie && <span className="text-slate-400"> · {d.categorie}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Panneau de suggestion RAG (Greffe 2) — réservé au support. Cinq états : rien / en cours /
// prête+suggestion / prête+abstention / échec. La génération vit côté serveur (async) ;
// ici on affiche l'état de la ligne SOLUTION que le polling met à jour.
function PanneauSuggestionRAG({
  suggestion,
  peutSuggerer,
  onSuggerer,
  enCours,
}: {
  suggestion: SuggestionIA | undefined;
  peutSuggerer: boolean;
  onSuggerer: () => void;
  enCours: boolean;
}) {
  const detail = suggestion?.details as DetailSolutionIA | undefined;
  const statut = suggestion?.statut;

  const bouton = (label: string) =>
    peutSuggerer ? (
      <Button size="sm" variant="secondary" onClick={onSuggerer} loading={enCours} disabled={enCours}>
        <Sparkles className="size-3.5" aria-hidden />
        {label}
      </Button>
    ) : null;

  return (
    <Card>
      <CardHeader
        title="Suggestion de résolution (IA)"
        description="Synthèse citée des résolutions passées similaires — à valider par le technicien."
      />
      <CardContent className="space-y-3">
        {statut === 'EN_COURS' && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Génération en cours… (~15-30 s)
          </div>
        )}

        {statut === 'ECHEC' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Suggestion indisponible (service IA).</p>
            {bouton('Réessayer')}
          </div>
        )}

        {statut === 'PRETE' && detail?.abstenu && (
          <div className="space-y-2.5">
            <p className="text-sm text-slate-500">
              Aucune suggestion pertinente — les tickets retrouvés ne couvrent pas ce problème.
            </p>
            <TicketsSimilaires docs={detail.similaires} />
            {bouton('Relancer')}
          </div>
        )}

        {statut === 'PRETE' && detail && !detail.abstenu && (
          <div className="space-y-3">
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {suggestion?.contenu}
            </p>
            {detail.sources.length > 0 && (
              <div>
                <p className="text-xs text-slate-400">Sources</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {detail.sources.map((s) => (
                    <Link
                      key={s.id}
                      to={`/tickets/${s.id}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-700"
                    >
                      <span className="font-mono">#{s.id}</span>
                      <span className="max-w-[160px] truncate">{s.titre}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <TicketsSimilaires docs={detail.similaires} />
            <p className="text-[11px] leading-relaxed text-slate-400">
              Suggestion non contraignante, ancrée sur des tickets résolus — à valider par le technicien.
            </p>
            {bouton('Régénérer')}
          </div>
        )}

        {!suggestion &&
          (peutSuggerer ? (
            bouton('Suggérer une résolution')
          ) : (
            <p className="text-sm text-slate-400">
              Disponible pour le technicien assigné quand le ticket est en cours.
            </p>
          ))}
      </CardContent>
    </Card>
  );
}

export function TicketDetailPage() {
  const { id } = useParams();
  const ticketId = Number(id);
  const token = useAuthStore((state) => state.token);
  const utilisateur = useAuthStore((state) => state.utilisateur);
  const toast = useToast();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [chargement, setChargement] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);
  const [techniciens, setTechniciens] = useState<Utilisateur[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);

  const [reponse, setReponse] = useState('');
  const [envoiCommentaire, setEnvoiCommentaire] = useState(false);
  const [action, setAction] = useState(false); // transition / priorité / catégorie / affectation en cours
  const [envoiSatisfaction, setEnvoiSatisfaction] = useState(false);

  useEffect(() => {
    if (!token || !Number.isInteger(ticketId)) {
      setIntrouvable(true);
      setChargement(false);
      return;
    }
    setChargement(true);
    ticketsApi
      .detail(ticketId, token)
      .then(({ ticket: t }) => setTicket(t))
      .catch(() => setIntrouvable(true))
      .finally(() => setChargement(false));
  }, [ticketId, token]);

  // Liste des techniciens pour l'affectation (réservée à l'administrateur).
  useEffect(() => {
    if (!token || utilisateur?.role !== 'ADMINISTRATEUR') return;
    utilisateursApi
      .lister({ role: 'TECHNICIEN' }, token)
      .then(({ utilisateurs }) => setTechniciens(utilisateurs.filter((u) => u.actif)))
      .catch(() => {
        /* l'affectation reste possible manuellement plus tard */
      });
  }, [token, utilisateur?.role]);

  // Liste des catégories pour la recatégorisation (technicien assigné ou admin).
  useEffect(() => {
    if (!token) return;
    if (utilisateur?.role !== 'ADMINISTRATEUR' && utilisateur?.role !== 'TECHNICIEN') return;
    ticketsApi
      .listerCategories(token)
      .then(({ categories: cats }) => setCategories(cats))
      .catch(() => {
        /* la recatégorisation reste indisponible sans bloquer la page */
      });
  }, [token, utilisateur?.role]);

  // Polling ciblé de la suggestion RAG : tant que la ligne SOLUTION est EN_COURS, on refetch
  // le détail toutes les ~3,5 s ; dès qu'elle passe PRETE/ECHEC, on s'arrête (pas de polling
  // infini). `statutSuggestion` est une primitive → l'effet ne se relance qu'aux transitions.
  const statutSuggestion = ticket?.suggestionsIA.find((s) => s.typeSuggestion === 'SOLUTION')?.statut;
  useEffect(() => {
    if (!token || statutSuggestion !== 'EN_COURS') return;
    const timer = setInterval(() => {
      ticketsApi
        .detail(ticketId, token)
        .then(({ ticket: t }) => setTicket(t))
        .catch(() => {
          /* échec ponctuel de polling : on réessaiera au prochain tick */
        });
    }, 3500);
    return () => clearInterval(timer);
  }, [statutSuggestion, token, ticketId]);

  if (chargement) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (introuvable || !ticket) {
    return (
      <EmptyState
        icon={Ticket}
        title="Ticket introuvable"
        description="Ce ticket n'existe pas ou vous n'y avez pas accès."
        action={
          <Link to="/tickets" className="text-sm font-medium text-primary-600 hover:underline">
            Retour à la liste
          </Link>
        }
      />
    );
  }

  const estDemandeur = ticket.demandeur.id === utilisateur?.id;
  const estAdmin = utilisateur?.role === 'ADMINISTRATEUR';
  const estTechnicienAssigne = ticket.technicien?.id === utilisateur?.id;
  const estGestionnaire = Boolean(estAdmin || estTechnicienAssigne);
  const peutCommenter = estDemandeur || estGestionnaire;
  const estCloture = ticket.statut === 'CLOTURE';
  const montrerSatisfaction =
    ticket.statut === 'RESOLU' || ticket.statut === 'CLOTURE' || ticket.satisfactionNote != null;

  // Suggestions IA (Greffe 1) — affichage minimal glass-box sur le détail.
  const suggestionCategorie = ticket.suggestionsIA.find((s) => s.typeSuggestion === 'CLASSIFICATION');
  const suggestionPriorite = ticket.suggestionsIA.find((s) => s.typeSuggestion === 'PRIORISATION');
  const detailPriorite = suggestionPriorite?.details as DetailPrioriteIA | undefined;

  // Suggestion RAG (Greffe 2) — réservée au support ; déclenchable quand le ticket est en cours.
  const suggestionSolution = ticket.suggestionsIA.find((s) => s.typeSuggestion === 'SOLUTION');
  const estSupport = estAdmin || estTechnicienAssigne;
  const peutSuggerer = estSupport && ticket.statut === 'EN_COURS';

  // Fil unifié : commentaires + événements (changements), triés chronologiquement.
  type ElementFil =
    | { cle: string; date: string; kind: 'message'; commentaire: Commentaire }
    | { cle: string; date: string; kind: 'evenement'; evenement: EvenementTicket };
  const fil: ElementFil[] = [
    ...ticket.commentaires.map(
      (c): ElementFil => ({ cle: `c${c.id}`, date: c.dateCreation, kind: 'message', commentaire: c }),
    ),
    ...ticket.evenements.map(
      (e): ElementFil => ({ cle: `e${e.id}`, date: e.dateCreation, kind: 'evenement', evenement: e }),
    ),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  async function withAction<T>(fn: () => Promise<T>, echec: string): Promise<T | undefined> {
    if (!token) return undefined;
    setAction(true);
    try {
      return await fn();
    } catch (err) {
      toast.error('Action impossible', err instanceof ApiError ? err.message : echec);
      return undefined;
    } finally {
      setAction(false);
    }
  }

  async function handlePrendreEnCharge() {
    if (!token) return;
    const res = await withAction(
      () => ticketsApi.prendreEnCharge(ticket!.id, token),
      'La prise en charge a échoué',
    );
    if (res) {
      setTicket(res.ticket);
      toast.success('Ticket pris en charge', 'Le ticket est passé « En cours ».');
    }
  }

  async function handleResoudre() {
    if (!token) return;
    const res = await withAction(
      () => ticketsApi.resoudre(ticket!.id, token),
      "Le ticket n'a pas pu être marqué résolu",
    );
    if (res) {
      setTicket(res.ticket);
      toast.success('Ticket résolu', 'Le demandeur va être invité à valider la résolution.');
    }
  }

  async function handleCloturer() {
    if (!token) return;
    const res = await withAction(() => ticketsApi.cloturer(ticket!.id, token), 'La clôture a échoué');
    if (res) {
      setTicket(res.ticket);
      toast.success('Ticket clôturé', 'Le ticket est désormais clôturé.');
    }
  }

  async function handleChangerPriorite(priorite: PrioriteTicket) {
    if (!token || priorite === ticket!.priorite) return;
    const res = await withAction(
      () => ticketsApi.changerPriorite(ticket!.id, priorite, token),
      'La priorité n\'a pas pu être modifiée',
    );
    if (res) {
      setTicket(res.ticket);
      toast.success('Priorité mise à jour', `Priorité « ${LABEL_PRIORITE[priorite]} ».`);
    }
  }

  async function handleChangerCategorie(categorieId: number) {
    if (!token || categorieId === ticket!.categorie?.id) return;
    const res = await withAction(
      () => ticketsApi.changerCategorie(ticket!.id, categorieId, token),
      "La catégorie n'a pas pu être modifiée",
    );
    if (res) {
      setTicket(res.ticket);
      toast.success('Catégorie mise à jour', `Catégorie « ${res.ticket.categorie?.nom ?? '—'} ».`);
    }
  }

  async function handleDemanderSuggestion() {
    if (!token) return;
    const res = await withAction(
      () => ticketsApi.demanderSuggestion(ticket!.id, token),
      'La demande de suggestion a échoué',
    );
    if (res) setTicket(res.ticket); // ligne SOLUTION en EN_COURS → le polling prend le relais
  }

  async function handleAffecter(technicienId: number | null) {
    if (!token) return;
    const res = await withAction(
      () => ticketsApi.affecter(ticket!.id, technicienId, token),
      "L'affectation a échoué",
    );
    if (res) {
      setTicket(res.ticket);
      toast.success(
        technicienId ? 'Ticket affecté' : 'Ticket désaffecté',
        technicienId ? 'Le technicien a été notifié.' : 'Le ticket est de nouveau dans la file.',
      );
    }
  }

  async function handleEnvoyerCommentaire() {
    const contenu = reponse.trim();
    if (!contenu || !token) return;
    setEnvoiCommentaire(true);
    try {
      const { commentaire } = await ticketsApi.commenter(ticket!.id, contenu, token);
      setTicket((prev) => (prev ? { ...prev, commentaires: [...prev.commentaires, commentaire] } : prev));
      setReponse('');
    } catch (err) {
      toast.error('Envoi impossible', err instanceof ApiError ? err.message : 'Réessayez plus tard');
    } finally {
      setEnvoiCommentaire(false);
    }
  }

  async function handleEvaluer(note: number, commentaire: string) {
    if (!token) return;
    setEnvoiSatisfaction(true);
    try {
      const { ticket: t } = await ticketsApi.evaluerSatisfaction(
        ticket!.id,
        note,
        commentaire.trim() || undefined,
        token,
      );
      setTicket(t);
      toast.success('Merci !', 'Votre évaluation a bien été enregistrée.');
    } catch (err) {
      toast.error('Évaluation impossible', err instanceof ApiError ? err.message : 'Réessayez plus tard');
    } finally {
      setEnvoiSatisfaction(false);
    }
  }

  // Action principale contextuelle de l'en-tête, selon rôle × statut du cycle de vie.
  type ActionPrincipale = { label: string; icon: LucideIcon; onClick: () => void };
  let actionPrincipale: ActionPrincipale | null = null;
  if (estTechnicienAssigne && ticket.statut === 'EN_ATTENTE') {
    actionPrincipale = { label: 'Prendre en charge', icon: Wrench, onClick: handlePrendreEnCharge };
  } else if (estTechnicienAssigne && ticket.statut === 'EN_COURS') {
    actionPrincipale = { label: 'Marquer résolu', icon: CheckCheck, onClick: handleResoudre };
  } else if (estAdmin && ticket.statut === 'RESOLU') {
    actionPrincipale = { label: 'Clôturer le ticket', icon: Lock, onClick: handleCloturer };
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
              <span className="font-mono text-sm text-slate-400">#{ticket.id}</span>
              <StatutBadge statut={ticket.statut} />
              <PrioriteLabel priorite={ticket.priorite} />
            </div>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">{ticket.titre}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="size-3.5" aria-hidden />
              Créé {tempsRelatif(ticket.dateCreation)}
            </p>
          </div>
          {actionPrincipale && (
            <Button disabled={action} onClick={actionPrincipale.onClick}>
              <actionPrincipale.icon className="size-4" aria-hidden />
              {actionPrincipale.label}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        {/* Colonne centrale : description + conversation */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Demande" />
            <CardContent>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          {/* Suggestion de résolution RAG (Greffe 2) — support uniquement */}
          {estSupport && (
            <PanneauSuggestionRAG
              suggestion={suggestionSolution}
              peutSuggerer={peutSuggerer}
              onSuggerer={handleDemanderSuggestion}
              enCours={action}
            />
          )}

          <Card>
            <CardHeader
              title="Conversation"
              description={`${ticket.commentaires.length} message${ticket.commentaires.length > 1 ? 's' : ''}`}
            />
            <CardContent className="space-y-5">
              {fil.length === 0 && (
                <p className="text-sm text-slate-400">Aucun message pour l'instant.</p>
              )}
              {fil.map((el) =>
                el.kind === 'message' ? (
                  <MessageBulle
                    key={el.cle}
                    commentaire={el.commentaire}
                    estDemandeur={el.commentaire.auteur.id === ticket.demandeur.id}
                  />
                ) : (
                  <EvenementLigne key={el.cle} evenement={el.evenement} />
                ),
              )}
            </CardContent>

            {/* Composer */}
            {peutCommenter ? (
              <div className="border-t border-slate-100 p-4">
                <Textarea
                  value={reponse}
                  onChange={(e) => setReponse(e.target.value)}
                  placeholder={estDemandeur ? 'Écrire un message au support…' : 'Répondre au demandeur…'}
                  aria-label="Votre message"
                  maxLength={5000}
                />
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={handleEnvoyerCommentaire} loading={envoiCommentaire} disabled={!reponse.trim()}>
                    <Send className="size-3.5" aria-hidden />
                    Envoyer
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-100 p-4">
                <p className="text-xs text-slate-400">
                  Prenez le ticket en charge pour participer à la conversation.
                </p>
              </div>
            )}
          </Card>

          {/* Évaluation de satisfaction (formulaire pour le demandeur, synthèse pour le support) */}
          {montrerSatisfaction && (
            <BlocSatisfaction
              ticket={ticket}
              estDemandeur={estDemandeur}
              onEvaluer={handleEvaluer}
              enCours={envoiSatisfaction}
            />
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {/* Propriétés */}
          <Card>
            <CardHeader title="Propriétés" />
            <CardContent className="space-y-3.5">
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">Statut</p>
                {/* Lecture seule : le statut avance via les actions du cycle de vie (en-tête). */}
                <div>
                  <StatutBadge statut={ticket.statut} />
                </div>
              </div>

              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">Priorité</p>
                {estGestionnaire ? (
                  <Select
                    value={ticket.priorite}
                    disabled={action}
                    onChange={(e) => handleChangerPriorite(e.target.value as PrioriteTicket)}
                    aria-label="Priorité du ticket"
                  >
                    {PRIORITE_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {LABEL_PRIORITE[p]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div>
                    <PrioriteLabel priorite={ticket.priorite} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">Assigné à</p>
                {estAdmin ? (
                  <Select
                    value={ticket.technicien?.id ?? ''}
                    disabled={action}
                    onChange={(e) => handleAffecter(e.target.value ? Number(e.target.value) : null)}
                    aria-label="Technicien assigné"
                  >
                    <option value="">Non assigné</option>
                    {techniciens.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.prenom} {t.nom}
                      </option>
                    ))}
                  </Select>
                ) : ticket.technicien ? (
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

              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <p className="text-xs text-slate-400">Catégorie</p>
                {(estAdmin || estTechnicienAssigne) && !estCloture ? (
                  <Select
                    value={ticket.categorie?.id ?? ''}
                    disabled={action || categories.length === 0}
                    onChange={(e) => e.target.value && handleChangerCategorie(Number(e.target.value))}
                    aria-label="Catégorie du ticket"
                  >
                    {!ticket.categorie && (
                      <option value="" disabled>
                        Choisir une catégorie…
                      </option>
                    )}
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </Select>
                ) : ticket.categorie ? (
                  <Badge variant="neutral">{ticket.categorie.nom}</Badge>
                ) : (
                  <span className="text-sm text-slate-400">Non classé</span>
                )}
              </div>

              {ticket.dateCloture && (
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <p className="text-xs text-slate-400">Clôturé</p>
                  <span className="text-sm text-slate-600">{dateLongue(ticket.dateCloture)}</span>
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Assistant IA — suggestions à la création (Greffe 1, glass-box : montre sa confiance) */}
          <div className="relative overflow-hidden rounded-2xl border border-primary-200/70 bg-gradient-to-br from-primary-50/70 to-violet-50/50 p-4">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-gradient-to-br from-primary-400/20 to-transparent blur-2xl"
            />
            <div className="relative flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 text-white shadow-glow-sm ring-1 ring-inset ring-white/20">
                <Sparkles className="size-4" aria-hidden />
              </span>
              <h2 className="text-sm font-semibold text-slate-700">Assistant IA</h2>
              <Badge variant="primary" className="ml-auto">
                Suggestions
              </Badge>
            </div>

            {suggestionCategorie || suggestionPriorite ? (
              <div className="relative mt-3 space-y-3">
                {suggestionCategorie && (
                  <div>
                    <p className="text-xs text-slate-400">Catégorie suggérée</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="neutral">{suggestionCategorie.contenu}</Badge>
                      {suggestionCategorie.scoreConfiance != null && (
                        <span className="text-xs text-slate-500">
                          confiance {Math.round(suggestionCategorie.scoreConfiance * 100)} %
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {suggestionPriorite && (
                  <div>
                    <p className="text-xs text-slate-400">Priorité suggérée</p>
                    <div className="mt-1">
                      <PrioriteLabel priorite={suggestionPriorite.contenu as PrioriteTicket} />
                    </div>
                    {detailPriorite?.explication && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                        {detailPriorite.explication}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Suggestions non contraignantes — à valider ou corriger par le support.
                </p>
              </div>
            ) : (
              <p className="relative mt-2 text-xs leading-relaxed text-slate-500">
                Aucune suggestion IA pour ce ticket (service indisponible à la création).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
