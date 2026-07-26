"""
Service FastAPI — primitives ML appelées par le backend Node (frontière §3.1).

J4 a exposé `/embed` (bge-m3, 1024d) + `/sante`. J6 ajoute `/rerank`
(cross-encoder bge-reranker-v2-m3). La route `/classify` viendra plus tard.

Lancement (dév) :
    cd ml && uvicorn smart_ticketing_ml.service.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import config, embedder, reranker

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
