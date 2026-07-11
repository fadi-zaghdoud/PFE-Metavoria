import { useEffect, useState, type SubmitEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { ticketsApi } from '../features/tickets/ticketsApi';
import { useAuthStore } from '../store/authStore';
import { ApiError } from '../lib/apiClient';
import { useToast } from '../components/ui/Toast';
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
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreursChamps, setErreursChamps] = useState<Record<string, string | undefined>>({});

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
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
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
