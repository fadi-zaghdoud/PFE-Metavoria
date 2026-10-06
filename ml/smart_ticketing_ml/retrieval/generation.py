"""
J6b — Génération citée de la suggestion (Ollama local, ancrage strict).

Le LLM ne décide pas et n'invente pas : il **synthétise** une résolution UNIQUEMENT à
partir des tickets résolus retrouvés, en **citant leurs #id** (traçabilité). Un contrôle
anti-hallucination ne retient que les #id réellement présents dans les documents fournis.
Local-first (Ollama, `qwen2.5:7b` par défaut — celui de la livraison) : aucune donnée
sortante, coût nul (CDC §10).
"""

from __future__ import annotations

import os

from ..data.ollama_client import OllamaGenerator
from .hybrid import DocKB

SYSTEME = (
    "Tu es un assistant de support informatique interne. On te donne un TICKET ENTRANT (le "
    "problème d'un utilisateur) et une liste de TICKETS PASSÉS DÉJÀ RÉSOLUS, chacun identifié "
    "par un #id, avec son problème et sa résolution. Rédige une suggestion de résolution pour le "
    "ticket entrant, **uniquement à partir des résolutions fournies**, en **citant les #id** que "
    "tu utilises. N'INVENTE RIEN : si les tickets fournis ne couvrent pas le problème, dis-le "
    "explicitement et ne cite aucune source. Réponds en JSON : la réponse (français, concise, "
    "actionnable), puis la liste des #id cités."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "reponse": {"type": "string"},
        "sources_citees": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["reponse", "sources_citees"],
}


def _contexte(docs: list[DocKB]) -> str:
    return "\n\n".join(
        f"#{d.id} — {d.titre}\nProblème : {d.description}\nRésolution : {d.resolution}"
        for d in docs
    )


def generer(
    requete: str,
    docs: list[DocKB],
    host: str | None = None,
    model: str | None = None,
    temperature: float = 0.0,
) -> tuple[str, list[int]]:
    """Renvoie (texte, sources_valides). `sources_valides` ⊆ ids des `docs` (anti-hallucination)."""
    gen = OllamaGenerator(
        host=host or os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
        model=model or os.environ.get("OLLAMA_MODEL", "qwen2.5:7b"),
        fallback=None,
        temperature=temperature,  # 0 → déterministe/reproductible
    )
    user = (
        f"TICKET ENTRANT :\n{requete}\n\n"
        f"TICKETS PASSÉS (déjà résolus) :\n{_contexte(docs)}\n\n"
        "Rédige la suggestion citée."
    )
    rep = gen.chat_json(SYSTEME, user, SCHEMA)
    ids_fournis = {d.id for d in docs}
    # Anti-hallucination : ne garder que les #id réellement présents dans le contexte fourni.
    sources = [int(i) for i in rep.get("sources_citees", []) if int(i) in ids_fournis]
    return str(rep.get("reponse", "")).strip(), sources
