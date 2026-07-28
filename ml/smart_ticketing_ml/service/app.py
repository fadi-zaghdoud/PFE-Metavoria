"""
Service FastAPI — primitives ML appelées par le backend Node (frontière §3.1).

J4 a exposé `/embed` (bge-m3, 1024d) + `/sante`. J6 ajoute `/rerank`
(cross-encoder bge-reranker-v2-m3). Greffe 1 ajoute `/classify` (catégorie +
embedding) et `/priority` (scorecard glass-box).

Lancement (dév) :
    cd ml && uvicorn smart_ticketing_ml.service.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import config, embedder, predictors, reranker

app = FastAPI(
    title="Service IA — Smart Ticketing (Metavoria)",
    version="0.1.0",
    description="Embeddings bge-m3 auto-hébergés (Epic 4, J4).",
)


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
