"""
Service FastAPI — primitives ML appelées par le backend Node (frontière §3.1).

J4 a exposé `/embed` (bge-m3, 1024d) + `/sante`. J6 ajoute `/rerank`
(cross-encoder bge-reranker-v2-m3). Greffe 1 ajoute `/classify` (catégorie +
embedding) et `/priority` (scorecard glass-box).

Lancement (dév) :
    cd ml && uvicorn smart_ticketing_ml.service.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import base64
import threading
import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import config, embedder, ocr, predictors, reranker
from ..flywheel import reentrainer as flywheel_reentrainer
from ..retrieval import hybrid, suggestion
from ..summarize import resumer

app = FastAPI(
    title="Service IA — Smart Ticketing (Metavoria)",
    version="0.1.0",
    description="Embeddings bge-m3 auto-hébergés (Epic 4, J4).",
)

# ── Flywheel (Greffe 3, B.2) — état du réentraînement (fichier-based + drapeau mémoire) ──
_reent_lock = threading.Lock()
_reent_etat: dict = {"en_cours": False, "dernier_rapport": None}


class RequeteEmbed(BaseModel):
    textes: list[str] = Field(..., min_length=1, description="Textes à encoder (titre + description).")


class ReponseEmbed(BaseModel):
    modele: str
    dimension: int
    vecteurs: list[list[float]]


@app.get("/sante")
def sante() -> dict:
    """État du service — pour la supervision Node (`GET /api/ia/sante`)."""
    return {
        "statut": "ok",
        "embedding": {
            "modele": config.MODELE_EMBEDDING,
            "dimension": config.DIMENSION,
            "device": config.DEVICE,
            "modele_charge": embedder.modele_charge(),
        },
        "reranker": {
            "modele": config.MODELE_RERANKER,
            "device": config.RERANK_DEVICE,
            "max_length": config.RERANK_MAX_LENGTH,
            "modele_charge": reranker.modele_charge(),
        },
        "classifieur": {
            "modele_charge": predictors.classifieur_charge(),
            **predictors.infos_actif(),
        },
        "ocr": {
            "tesseract_disponible": ocr.tesseract_disponible(),
            "langue": config.OCR_LANGUE,
            "tesseract_cmd": config.TESSERACT_CMD,
        },
    }


@app.post("/embed", response_model=ReponseEmbed)
def embed(req: RequeteEmbed) -> ReponseEmbed:
    """Encode les textes en vecteurs 1024d L2-normalisés (similarité cosinus)."""
    if any(not t or not t.strip() for t in req.textes):
        raise HTTPException(status_code=422, detail="Texte vide dans la requête.")
    vecteurs = embedder.embed_textes(req.textes)
    return ReponseEmbed(
        modele=config.MODELE_EMBEDDING,
        dimension=config.DIMENSION,
        vecteurs=vecteurs,
    )


class RequeteRerank(BaseModel):
    requete: str = Field(..., min_length=1, description="Requête (titre + description du ticket entrant).")
    documents: list[str] = Field(..., min_length=1, description="Candidats à reranker (issus de la recherche hybride).")


class ReponseRerank(BaseModel):
    modele: str
    # Scores alignés sur l'ordre des `documents` d'entrée (non triés) : plus haut = plus pertinent.
    # Scores en (0,1), NON calibrés (le seuil calibré / l'abstention sont un travail J6b).
    scores: list[float]


@app.post("/rerank", response_model=ReponseRerank)
def rerank(req: RequeteRerank) -> ReponseRerank:
    """Score la pertinence (requête, document) de chaque candidat via le cross-encoder."""
    if not req.requete.strip():
        raise HTTPException(status_code=422, detail="Requête vide.")
    if any(not d or not d.strip() for d in req.documents):
        raise HTTPException(status_code=422, detail="Document vide dans la requête.")
    scores = reranker.scorer(req.requete, req.documents)
    return ReponseRerank(modele=config.MODELE_RERANKER, scores=scores)


# ── Greffe 1 : classification de catégorie + priorité (à la création) ────────────

class RequeteClassify(BaseModel):
    titre: str = Field(..., description="Titre du ticket entrant.")
    description: str = Field(..., description="Description du ticket entrant.")


class ReponseClassify(BaseModel):
    categorie: str                       # top-1 (nom de catégorie = classe du modèle figé)
    confiance: float                     # proba top-1 (predict_proba), NON seuillée ici
    probabilites: dict[str, float]       # proba par classe (pour l'affichage / un seuil aval)
    modele_embedding: str
    # Embedding 1024d L2-normalisé — RENVOYÉ pour que Node le persiste (le service ne
    # touche pas la DB). Un seul embed pour la prédiction et la persistance.
    embedding: list[float]


@app.post("/classify", response_model=ReponseClassify)
def classify(req: RequeteClassify) -> ReponseClassify:
    """Catégorie suggérée + confiance + embedding. L'IA SUGGÈRE : la décision revient
    au technicien (validation humaine → flywheel)."""
    if not (req.titre.strip() or req.description.strip()):
        raise HTTPException(status_code=422, detail="Titre et description vides.")
    try:
        resultat = predictors.classer(req.titre, req.description)
    except RuntimeError as exc:  # classifieur figé absent → Node dégrade (503)
        raise HTTPException(status_code=503, detail=str(exc))
    return ReponseClassify(**resultat)


class RequetePriority(BaseModel):
    titre: str = Field(..., description="Titre du ticket entrant.")
    description: str = Field(..., description="Description du ticket entrant.")
    # Nom de catégorie issu de /classify (dépendance J7 : la base de score en dépend).
    categorie: str = Field(..., description="Catégorie (nom) — issue de la classification.")


class ReponsePriority(BaseModel):
    niveau: str                          # FAIBLE | MOYENNE | HAUTE | CRITIQUE
    score: float
    plafonne: bool
    explication: str                     # « HAUTE car : production +2 · Réseau +1.5 »
    contributions: list[dict]            # décomposition facteur par facteur (glass-box §6.5)
    plafonnements: list[str]


@app.post("/priority", response_model=ReponsePriority)
def priority(req: RequetePriority) -> ReponsePriority:
    """Priorité suggérée par la scorecard glass-box (déterministe), avec sa décomposition."""
    if not (req.titre.strip() or req.description.strip()):
        raise HTTPException(status_code=422, detail="Titre et description vides.")
    return ReponsePriority(**predictors.prioriser(req.titre, req.description, req.categorie))


# ── Greffe 2 : suggestion RAG citée (à l'étape EN_COURS) ─────────────────────────
# Ce endpoint LIT la KB (tickets résolus) mais n'écrit JAMAIS — Node reste seul
# écrivain. Latence 15-30 s (génération Ollama qwen2.5:14b) → l'appelant Node
# l'invoque en ASYNCHRONE (fire-and-forget), jamais dans un chemin de réponse.

class RequeteSuggest(BaseModel):
    titre: str = Field(..., description="Titre du ticket entrant (requête RAG).")
    description: str = Field(..., description="Description du ticket entrant.")


class SourceCitee(BaseModel):
    id: int
    titre: str
    synthetique: bool = True  # provenance (K3) : False = vraie résolution d'entreprise


class DocSimilaire(BaseModel):
    id: int
    titre: str
    categorie: str | None = None
    synthetique: bool = True  # provenance (K3) : False = vraie résolution d'entreprise


class ReponseSuggest(BaseModel):
    abstenu: bool                        # True → aucune suggestion (rien d'ancré) : on n'invente pas
    texte: str                           # suggestion citée (vide si abstention)
    sources: list[SourceCitee]           # #id RÉELLEMENT cités (⊆ similaires), avec titre
    similaires: list[DocSimilaire]       # candidats RRF récupérés (affichés même en abstention)
    confiance: float | None              # score de porte top-1 si un seuil est réglé (sinon None)
    message: str                         # motif d'abstention, le cas échéant
    latence_ms: float | None


@app.post("/suggest", response_model=ReponseSuggest)
def suggest(req: RequeteSuggest) -> ReponseSuggest:
    """Suggestion de résolution RAG (recherche hybride + génération citée + abstention J6)."""
    if not (req.titre.strip() or req.description.strip()):
        raise HTTPException(status_code=422, detail="Titre et description vides.")
    requete = f"{req.titre}\n{req.description}"  # même unité que les embeddings (titre + description)
    with hybrid.connexion() as conn, conn.cursor() as cur:
        sugg = suggestion.suggerer(cur, requete)
    titres = {d["id"]: d["titre"] for d in sugg.similaires}
    # Provenance (K3) : les sources citées sont un sous-ensemble des similaires → on y retrouve
    # le drapeau `synthetique` pour badger « source réelle » ce sur quoi la réponse s'ancre.
    provenance = {d["id"]: d["synthetique"] for d in sugg.similaires}
    return ReponseSuggest(
        abstenu=sugg.abstenu,
        texte=sugg.texte,
        sources=[
            SourceCitee(id=i, titre=titres.get(i, f"#{i}"), synthetique=provenance.get(i, True))
            for i in sugg.sources
        ],
        similaires=[DocSimilaire(**d) for d in sugg.similaires],
        confiance=sugg.confiance,
        message=sugg.message,
        latence_ms=sugg.latence_ms,
    )


# ── J8 : résumé automatique du fil (à la demande, à l'étape de traitement) ───────
# Résumé FIDÈLE du fil (description + messages) : le LLM condense, n'invente rien
# (prompt strict, température 0). Texte in / JSON out, sans DB. Latence 21-55 s
# (génération Ollama) → l'appelant Node l'invoque en ASYNCHRONE, comme /suggest.

class MessageFil(BaseModel):
    auteur: str
    contenu: str


class RequeteSummarize(BaseModel):
    titre: str = Field(..., description="Titre du ticket.")
    description: str = Field(..., description="Description (message initial du demandeur).")
    messages: list[MessageFil] = Field(default_factory=list, description="Commentaires, ordre chronologique.")


class ReponseSummarize(BaseModel):
    resume: str
    latence_ms: float | None


@app.post("/summarize", response_model=ReponseSummarize)
def summarize(req: RequeteSummarize) -> ReponseSummarize:
    """Résumé fidèle et condensé du fil d'un ticket (aucune invention)."""
    if not req.description.strip() and not req.messages:
        raise HTTPException(status_code=422, detail="Fil vide (ni description ni message).")
    t0 = time.perf_counter()
    resume = resumer(
        req.titre,
        req.description,
        [{"auteur": m.auteur, "contenu": m.contenu} for m in req.messages],
    )
    return ReponseSummarize(resume=resume, latence_ms=(time.perf_counter() - t0) * 1000)


# ── J8bis Lot B : OCR des pièces jointes (extraction de texte) ───────────────────
# Node récupère les octets (il le fait déjà pour le proxy de téléchargement) et les
# POST ici en base64 : le service reste SANS ÉTAT (ni Cloudinary ni DB). Node persiste
# `texte_extrait` UNIQUEMENT si `fiable` (seuil anti-bruit), puis re-déclenche la
# classification/priorité « après OCR » (nouvelle suggestion, sans écraser la 1ʳᵉ).

class RequeteExtract(BaseModel):
    nom_fichier: str = Field("", description="Nom du fichier (aide au typage + logs).")
    contenu_base64: str = Field(..., min_length=1, description="Octets de la pièce jointe, en base64.")
    type_mime: str | None = Field(None, description="Type MIME indicatif (le type réel est sniffé).")


class ReponseExtract(BaseModel):
    texte: str                     # texte extrait, nettoyé
    fiable: bool                   # False → Node NE stocke PAS dans texte_extrait
    confiance: float               # 0–100 (moyenne OCR) ; 100.0 pour une couche texte PDF
    methode: str                   # texte_pdf | ocr_image | ocr_pdf_scanne
    n_mots: int
    n_pages: int | None            # renseigné pour les PDF
    langue: str
    message: str                   # motif si non fiable
    latence_ms: float | None


@app.post("/extract", response_model=ReponseExtract)
def extract(req: RequeteExtract) -> ReponseExtract:
    """Extrait le texte d'une pièce jointe (PDF/image) — OCR local Tesseract.
    Octets in (base64) / JSON out, sans DB. `fiable=False` signale à Node un résultat
    trop bruité pour être persisté."""
    try:
        octets = base64.b64decode(req.contenu_base64, validate=True)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="contenu_base64 invalide.")
    if not octets:
        raise HTTPException(status_code=422, detail="Pièce jointe vide.")
    if len(octets) > config.EXTRACT_TAILLE_MAX_MO * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Fichier > {config.EXTRACT_TAILLE_MAX_MO} Mo.")
    try:
        resultat = ocr.extraire(octets, req.nom_fichier, req.type_mime)
    except ValueError as exc:      # type inconnu / fichier illisible
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:    # Tesseract/pytesseract absent → Node dégrade (503)
        raise HTTPException(status_code=503, detail=str(exc))
    return ReponseExtract(**resultat)


# ── Greffe 3 (flywheel B.2) : réentraînement manuel glass-box ────────────────────
# `/reentrainer` lance un CANDIDAT en arrière-plan (async) ; `/reentrainer/etat` sert le
# polling admin ; `/deployer` est l'acte ADMIN qui REFUSE un candidat non meilleur (garde
# serveur). Node passe les captures propres (labelsValides) — le service ne touche pas la DB.

class Capture(BaseModel):
    titre: str = ""
    description: str = ""
    texteExtrait: str | None = None
    categorie: str


class RequeteReentrainer(BaseModel):
    captures: list[Capture] = Field(default_factory=list, description="Labels propres (captures DB) passés par Node.")


@app.post("/reentrainer", status_code=202)
def reentrainer_endpoint(req: RequeteReentrainer) -> dict:
    """Lance un réentraînement CANDIDAT en arrière-plan (minutes) ; renvoie 202 tout de suite.
    Le candidat n'est JAMAIS déployé ici (voir /deployer)."""
    with _reent_lock:
        if _reent_etat["en_cours"]:
            raise HTTPException(status_code=409, detail="Un réentraînement est déjà en cours.")
        _reent_etat["en_cours"] = True
        _reent_etat["dernier_rapport"] = None

    captures = [c.model_dump() for c in req.captures]

    def _tache() -> None:
        try:
            _reent_etat["dernier_rapport"] = flywheel_reentrainer.reentrainer(captures=captures)
        except Exception as exc:  # on remonte l'erreur dans l'état, jamais de crash du service
            _reent_etat["dernier_rapport"] = {"erreur": str(exc)}
        finally:
            _reent_etat["en_cours"] = False

    threading.Thread(target=_tache, daemon=True).start()
    return {"demarre": True}


@app.get("/reentrainer/etat")
def reentrainer_etat() -> dict:
    """État du dernier réentraînement (polling admin) : en cours + rapport comparatif."""
    return {"en_cours": _reent_etat["en_cours"], "dernier_rapport": _reent_etat["dernier_rapport"]}


class RequeteDeployer(BaseModel):
    stamp: str = Field(..., description="Horodatage du candidat à déployer.")


@app.post("/deployer")
def deployer_endpoint(req: RequeteDeployer) -> dict:
    """Déploie un candidat — REFUSE (409) s'il n'est pas meilleur sur le réel. Recharge le
    classifieur servi, sans redémarrage."""
    try:
        return flywheel_reentrainer.deployer(req.stamp)
    except ValueError as exc:      # candidat non meilleur → refus glass-box
        raise HTTPException(status_code=409, detail=str(exc))
    except RuntimeError as exc:    # candidat introuvable
        raise HTTPException(status_code=404, detail=str(exc))
