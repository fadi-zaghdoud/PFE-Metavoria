"""
J6a — Juge de pertinence LLM (Ollama local) pour l'évaluation du retrieval.

Le corpus n'a pas de structure de récurrence (99 % de descriptions uniques) → aucune
vérité-terrain de pertinence naturelle. On juge donc la pertinence gradée (0/1/2) de
chaque paire (requête entrante, document KB résolu) par LLM local, **validé contre des
jugements humains** (κ pondéré ; cf. `judge_validation.py`) avant tout usage — sans quoi
c'est circulaire (conception §10).

- **Local-first** : qwen2.5:14b via Ollama (aucune donnée sortante, coût nul, CDC §10) —
  cohérent avec le report du baseline Claude en J5.
- **Déterministe** : temperature 0 (décodage glouton) + sortie **structurée** (JSON schema).
- **Caché + reprenable** : chaque jugement (query_id, doc_id) est écrit dès qu'obtenu →
  un run interrompu (≈ plusieurs heures) ne reperd rien (leçon J1).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from ..data.ollama_client import OllamaGenerator

# Barème gradé — jugé sur le FOND (la résolution aide-t-elle ?), pas la ressemblance de surface.
# `RUBRIQUE` est la SOURCE UNIQUE des définitions de niveaux : le prompt du juge (ci-dessous)
# ET la fiche de notation humaine (judge_validation.py) l'utilisent → identiques mot pour mot,
# condition pour que le κ ait un sens.
RUBRIQUE = (
    "- 2 (pertinent) : même problème, ou très proche ; la résolution s'applique directement "
    "ou est clairement réutilisable.\n"
    "- 1 (partiellement pertinent) : problème lié (même composant / même catégorie) mais "
    "différent ; la résolution pourrait aider en partie ou indirectement.\n"
    "- 0 (non pertinent) : problème différent ; la résolution n'aide pas, même si des mots "
    "se ressemblent.\n"
    "Exemple d'ancrage du niveau 1 (le plus délicat) : requête « le VPN ne se connecte pas » "
    "et ticket passé « VPN lent » → grade 1 (même composant, le VPN, mais problème DIFFÉRENT : "
    "la résolution de la lenteur n'aide qu'en partie, pas directement).\n"
    "Juge le FOND technique, jamais la simple ressemblance de surface des mots."
)

SYSTEME = (
    "Tu es un évaluateur de pertinence pour un système de suggestion de solutions (RAG) "
    "d'un support informatique interne. On te donne un TICKET ENTRANT (le problème d'un "
    "utilisateur) et un TICKET PASSÉ DÉJÀ RÉSOLU (un problème et sa résolution). Ta tâche : "
    "juger si la RÉSOLUTION du ticket passé aiderait un technicien à résoudre le ticket "
    "entrant. Note de 0 à 2 :\n"
    + RUBRIQUE
    + "\nRéponds en JSON : d'abord une justification d'UNE phrase, puis le grade."
)

# Sortie structurée. `justification` avant `grade` → le modèle motive avant de committer la note.
SCHEMA = {
    "type": "object",
    "properties": {
        "justification": {"type": "string"},
        "grade": {"type": "integer", "enum": [0, 1, 2]},
    },
    "required": ["justification", "grade"],
}

RACINE = Path(__file__).resolve().parents[2]  # .../ml
CACHE_DEFAUT = RACINE / "artifacts" / "eval" / "judgments.jsonl"


def _prompt_user(requete: str, document: str) -> str:
    return (
        f"TICKET ENTRANT :\n{requete}\n\n"
        f"TICKET PASSÉ (déjà résolu) :\n{document}\n\n"
        "La résolution du ticket passé aide-t-elle à résoudre le ticket entrant ?"
    )


class Juge:
    """Juge de pertinence caché. Une instance = un modèle ; changer de modèle réévalue."""

    def __init__(
        self,
        host: str | None = None,
        model: str | None = None,
        cache_path: Path | str = CACHE_DEFAUT,
    ) -> None:
        self.model = model or os.environ.get("OLLAMA_MODEL", "qwen2.5:14b")
        host = host or os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        # Pas de fallback : un juge doit être un modèle FIXE et connu (sinon κ ininterprétable).
        # temperature 0 → déterministe/reproductible.
        self.gen = OllamaGenerator(host=host, model=self.model, fallback=None, temperature=0.0)
        self.cache_path = Path(cache_path)
        self._cache: dict[tuple[str, str], dict] = self._charger_cache()

    def _charger_cache(self) -> dict[tuple[str, str], dict]:
        cache: dict[tuple[str, str], dict] = {}
        if self.cache_path.exists():
            for ligne in self.cache_path.open(encoding="utf-8"):
                if not ligne.strip():
                    continue
                r = json.loads(ligne)
                if r.get("modele") == self.model:  # n'accepte que les jugements du modèle courant
                    cache[(r["query_id"], str(r["doc_id"]))] = r
        return cache

    def _ecrire(self, enregistrement: dict) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        with self.cache_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(enregistrement, ensure_ascii=False) + "\n")

    def juger(self, query_id: str, requete: str, doc_id: int | str, document: str) -> dict:
        """Renvoie {query_id, doc_id, grade, justification, modele}. Utilise/écrit le cache."""
        cle = (query_id, str(doc_id))
        if cle in self._cache:
            return self._cache[cle]
        reponse = self.gen.chat_json(SYSTEME, _prompt_user(requete, document), SCHEMA)
        grade = max(0, min(2, int(reponse.get("grade", 0))))  # garde-fou : borne à [0, 2]
        enregistrement = {
            "query_id": query_id,
            "doc_id": doc_id,
            "grade": grade,
            "justification": str(reponse.get("justification", ""))[:500],
            "modele": self.model,
        }
        self._cache[cle] = enregistrement
        self._ecrire(enregistrement)
        return enregistrement

    def en_cache(self, query_id: str, doc_id: int | str) -> bool:
        return (query_id, str(doc_id)) in self._cache
