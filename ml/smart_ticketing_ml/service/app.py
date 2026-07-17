"""
Service FastAPI — primitives ML appelées par le backend Node (frontière §3.1).

J4 expose la première primitive : `/embed` (bge-m3, 1024d) + `/sante`.
Les routes `/rerank` et `/classify` viendront aux jalons J6/J5.

Lancement (dév) :
    cd ml && uvicorn smart_ticketing_ml.service.app:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import config, embedder

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
        "modele": config.MODELE_EMBEDDING,
        "dimension": config.DIMENSION,
        "device": config.DEVICE,
        "modele_charge": embedder.modele_charge(),
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
