"""
J8 — Résumé automatique du fil d'un ticket (description + messages), local-first.

Le LLM **CONDENSE**, il **n'AJOUTE JAMAIS** : le prompt lui interdit explicitement
d'inventer, d'extrapoler ou de proposer une solution absente du fil. Un résumé infidèle
induirait le technicien en erreur — pire qu'inutile. Génération Ollama (`qwen2.5:7b`
par défaut, celui de la livraison) à **température 0** (déterministe, fidèle). Sortie
contrainte au schéma JSON `{resume}`.
"""

from __future__ import annotations

import os

from .data.ollama_client import OllamaGenerator

SYSTEME = (
    "Tu es un assistant de support informatique interne. On te donne le FIL d'un ticket : sa "
    "description, puis les messages échangés dans l'ordre chronologique (avec leur auteur). "
    "Rédige un RÉSUMÉ FIDÈLE et concis de l'état du ticket, UNIQUEMENT à partir du contenu "
    "fourni.\n"
    "Règles STRICTES :\n"
    "- Tu CONDENSES, tu n'AJOUTES RIEN : n'invente pas, n'extrapole pas, ne déduis aucune "
    "cause, diagnostic, action ou solution absente du fil.\n"
    "- Ne propose aucune recommandation ni étape suivante de ton cru.\n"
    "- Reste factuel et neutre ; attribue propos et actions à leur auteur (demandeur / "
    "technicien) quand c'est utile.\n"
    "- Si le fil est trop maigre pour un résumé utile, dis-le simplement.\n"
    "- Réponds en FRANÇAIS.\n"
    "Réponds en JSON : un champ `resume`."
)

SCHEMA = {
    "type": "object",
    "properties": {"resume": {"type": "string"}},
    "required": ["resume"],
}


def _formater_fil(titre: str, description: str, messages: list[dict]) -> str:
    """Assemble le fil chronologique : titre + description (demandeur) + messages (auteur : contenu)."""
    lignes = [f"TITRE : {titre}", f"DESCRIPTION (demandeur) : {description}", ""]
    lignes += [f"{m['auteur']} : {m['contenu']}" for m in messages]
    return "\n".join(lignes)


def resumer(
    titre: str,
    description: str,
    messages: list[dict],
    host: str | None = None,
    model: str | None = None,
    temperature: float = 0.0,
) -> str:
    """Résumé fidèle du fil (titre + description + messages). Renvoie le texte seul."""
    gen = OllamaGenerator(
        host=host or os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
        model=model or os.environ.get("OLLAMA_MODEL", "qwen2.5:7b"),
        fallback=None,
        temperature=temperature,  # 0 → déterministe / fidèle (pas de dérive créative)
    )
    rep = gen.chat_json(SYSTEME, _formater_fil(titre, description, messages), SCHEMA)
    return str(rep.get("resume", "")).strip()
