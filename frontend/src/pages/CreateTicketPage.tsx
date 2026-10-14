import { useEffect, useState, type ChangeEvent, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Paperclip, Send, X } from 'lucide-react';
import { ticketsApi } from '../features/tickets/ticketsApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { useToast } from '../components/ui/Toast';
import { formaterOctets } from '../lib/format';
import { ACCEPT_PJ, MAX_PJ, validerPieceJointe } from '../features/tickets/pieceJointe';
import type { Categorie } from '../types/ticket';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { Field, Input, Select, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';

export function CreateTicketPage() {
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const toast = useToast();

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [categorieId, setCategorieId] = useState('');
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string | undefined>>({});

  function ajouterFichiers(e: ChangeEvent<HTMLInputElement>) {
    const selection = Array.from(e.target.files ?? []);
    e.target.value = ''; // autorise la re-sélection du même fichier
    const valides: File[] = [];
    for (const f of selection) {
      const err = validerPieceJointe(f);
      if (err) toast.error(f.name, err);
      else valides.push(f);
    }
    setFichiers((prev) => [...prev, ...valides].slice(0, MAX_PJ));
  }

  useEffect(() => {
    if (!token) return;
    ticketsApi
      .listerCategories(token)
      .then(({ categories: liste }) => setCategories(liste))
      .catch(() => {
        // La catégorie est facultative : un échec de chargement ne bloque pas la création.
      });
  }, [token]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setErreur(null);
    setErreursChamps({});
    setEnCours(true);
    try {
      const { ticket } = await ticketsApi.creer(
        {
          titre,
          description,
          categorieId: categorieId ? Number(categorieId) : undefined,
        },
        token,
      );

      // Upload des pièces jointes après création (séquentiel) — best-effort : un échec
      // d'envoi n'annule pas la création du ticket.
      let echecs = 0;
      for (const f of fichiers) {
        try {
          await ticketsApi.uploaderPieceJointe(ticket.id, f, token);
        } catch {
          echecs += 1;
        }
      }
      if (echecs > 0) {
        toast.error('Pièces jointes', `${echecs} fichier(s) n'ont pas pu être envoyé(s).`);
      }

      toast.success('Ticket créé', `Votre demande « ${ticket.titre} » a bien été enregistrée.`);
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setErreursChamps({
          titre: err.champ('titre'),
          description: err.champ('description'),
          categorieId: err.champ('categorieId'),
        });
      } else {
        setErreur(err instanceof ApiError ? err.message : 'Impossible de créer le ticket');
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/tickets"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-texte-4 transition-colors hover:text-texte"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tickets
      </Link>

      <PageHeader
        title="Nouveau ticket"
        description="Décrivez votre demande de support — l'équipe IT la prend en charge au plus vite."
      />

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Titre" htmlFor="titre" error={erreursChamps.titre} hint="Résumez le problème en une phrase.">
              <Input
                id="titre"
                required
                autoFocus
                maxLength={150}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Ex. Impossible de me connecter au VPN"
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              error={erreursChamps.description}
              hint="Détaillez le contexte : depuis quand, messages d'erreur, ce que vous avez déjà essayé."
            >
              <Textarea
                id="description"
                required
                maxLength={5000}
                className="min-h-40"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre problème…"
              />
            </Field>

            <Field
              label="Catégorie (facultative)"
              htmlFor="categorie"
              error={erreursChamps.categorieId}
              hint="Laissez « Non classé » si vous n'êtes pas sûr — le support ajustera."
            >
              <Select id="categorie" value={categorieId} onChange={(e) => setCategorieId(e.target.value)}>
                <option value="">Non classé</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Pièces jointes (facultatif)"
              htmlFor="pj"
              hint="Captures d'écran ou PDF (message d'erreur, log…) — PDF, PNG, JPG, 10 Mo max, 5 fichiers."
            >
              <input
                id="pj"
                type="file"
                accept={ACCEPT_PJ}
                multiple
                onChange={ajouterFichiers}
                disabled={fichiers.length >= MAX_PJ}
                className="block w-full text-sm text-texte-3 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-texte-2 hover:file:bg-surface-4 disabled:opacity-50"
              />
              {fichiers.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {fichiers.map((f, i) => (
                    <li
                      key={`${f.name}-${f.lastModified}-${i}`}
                      className="flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs"
                    >
                      <Paperclip className="size-3.5 shrink-0 text-texte-4" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-texte-2">{f.name}</span>
                      <span className="shrink-0 text-texte-4">{formaterOctets(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => setFichiers((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Retirer ${f.name}`}
                        className="shrink-0 text-texte-4 hover:text-danger-accent"
                      >
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            {erreur && <Alert variant="danger">{erreur}</Alert>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => navigate('/tickets')}>
                Annuler
              </Button>
              <Button type="submit" loading={enCours}>
                <Send className="size-3.5" aria-hidden />
                Créer le ticket
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
