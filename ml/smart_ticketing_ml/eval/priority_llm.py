"""
J7 — Prédicteur de priorité LLM few-shot (Ollama local) : le FOIL boîte-noire.

Pendant « décision opaque » du scorecard glass-box. Même question, deux natures :
le scorecard décide par **règles explicites**, le LLM par **jugement appris**. Les
comparer sur gold ET réel répond à la question neuve du fil rouge : *les règles
explicites transfèrent-elles mieux que l'apprentissage ?*

Principes (identiques au juge de pertinence J6, `judge.py`) :
  - **Local-first** : qwen2.5 via Ollama (aucune donnée sortante, coût nul, CDC §10).
  - **Déterministe** : temperature 0 + sortie structurée (JSON schema).
  - **Ancré sur la source unique** : les définitions de niveaux viennent de
    `taxonomy.PRIORITY_DEFINITIONS` — les MÊMES critères opérationnels que le
    scorecard et que la relecture du gold (sinon la comparaison serait biaisée).
  - **Few-shot honnête** : 4 exemples d'ancrage ÉCRITS À LA MAIN (un par niveau),
    jamais tirés du gold/réel (qui sont le TEST).
  - **Caché + reprenable** : chaque prédiction écrite dès obtenue → un run interrompu
    ne reperd rien (leçon J1).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from ..data.ollama_client import OllamaGenerator
from ..taxonomy import PRIORITY_DEFINITIONS, PRIORITY_LABELS

# Rubrique = définitions opérationnelles, source unique (taxonomy). Mot pour mot
# identiques à celles qui ont servi à la relecture du gold et au scorecard.
_RUBRIQUE = "\n".join(f"- {lab} : {PRIORITY_DEFINITIONS[lab]}" for lab in PRIORITY_LABELS)

# Exemples d'ancrage écrits à la main (PAS du gold/réel). Un par niveau, illustrant
# la rubrique — l'équivalent du « grade-1 » ancré du juge J6.
_FEW_SHOT = [
    ("Petite coquille dans le libellé du menu Aide", "Le mot « paramètres » est mal orthographié dans le menu.", "FAIBLE"),
    ("Outlook un peu lent ce matin", "La messagerie met quelques secondes à ouvrir les mails, ça finit par marcher.", "MOYENNE"),
    ("Impossible de me connecter à mon poste", "Mon ordinateur refuse mon mot de passe, je suis totalement bloqué pour travailler.", "HAUTE"),
    ("Serveur de fichiers inaccessible, tout le service à l'arrêt", "Plus personne dans la comptabilité n'accède aux dossiers partagés, production bloquée.", "CRITIQUE"),
]

_SYSTEME = (
    "Tu es un agent de support informatique interne. On te donne un TICKET ENTRANT "
    "(le problème d'un utilisateur). Ta tâche : lui attribuer une PRIORITÉ parmi "
    "FAIBLE, MOYENNE, HAUTE, CRITIQUE, selon ces critères opérationnels :\n"
    + _RUBRIQUE
    + "\n\nAppuie-toi sur la gravité (blocage, impact, irréversibilité) et le périmètre "
    "(une personne, une équipe, tout le site). Réponds en JSON : d'abord une "
    "justification d'UNE phrase, puis le niveau."
)

# Sortie structurée : justification AVANT niveau → le modèle motive avant de committer.
_SCHEMA = {
    "type": "object",
    "properties": {
        "justification": {"type": "string"},
        "niveau": {"type": "string", "enum": list(PRIORITY_LABELS)},
    },
    "required": ["justification", "niveau"],
}

RACINE = Path(__file__).resolve().parents[2]  # .../ml
CACHE_DEFAUT = RACINE / "artifacts" / "eval" / "priority_llm.jsonl"


def _prompt_user(titre: str, description: str) -> str:
    exemples = "\n".join(
        f"Exemple — TITRE : {t}\nDESCRIPTION : {d}\n→ {n}" for t, d, n in _FEW_SHOT
    )
    return (
        f"{exemples}\n\n"
        f"TICKET À CLASSER —\nTITRE : {titre}\nDESCRIPTION : {description}\n"
        "Quelle priorité ?"
    )


class PrioriteLLM:
    """Prédicteur de priorité LLM caché. nom/predire → interface prédicteur J7."""

    nom = "LLM few-shot"

    def __init__(
        self,
        host: str | None = None,
        model: str | None = None,
        cache_path: Path | str = CACHE_DEFAUT,
    ) -> None:
        self.model = model or os.environ.get("OLLAMA_MODEL", "qwen2.5:14b")
        host = host or os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        # Pas de fallback : un prédicteur de référence doit être un modèle FIXE et connu.
        self.gen = OllamaGenerator(host=host, model=self.model, fallback=None, temperature=0.0)
        self.cache_path = Path(cache_path)
        self._cache: dict[str, dict] = self._charger_cache()

    def _charger_cache(self) -> dict[str, dict]:
        cache: dict[str, dict] = {}
        if self.cache_path.exists():
            for ligne in self.cache_path.open(encoding="utf-8"):
                if not ligne.strip():
                    continue
                r = json.loads(ligne)
                if r.get("modele") == self.model:
                    cache[str(r["cle"])] = r
        return cache

    def _ecrire(self, enregistrement: dict) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        with self.cache_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(enregistrement, ensure_ascii=False) + "\n")

    def _predire_un(self, cle: str, titre: str, description: str) -> dict:
        if cle in self._cache:
            return self._cache[cle]
        reponse = self.gen.chat_json(_SYSTEME, _prompt_user(titre, description), _SCHEMA)
        niveau = str(reponse.get("niveau", "MOYENNE")).upper()
        if niveau not in PRIORITY_LABELS:
            niveau = "MOYENNE"  # garde-fou (schéma déjà contraint, ceinture + bretelles)
        rec = {
            "cle": cle,
            "niveau": niveau,
            "justification": str(reponse.get("justification", ""))[:500],
            "modele": self.model,
        }
        self._cache[cle] = rec
        self._ecrire(rec)
        return rec

    def predire(self, exemples, prefixe: str) -> list[str]:
        """Prédit le niveau de chaque exemple (clé stable = prefixe + index)."""
        sorties: list[str] = []
        for i, ex in enumerate(exemples):
            cle = f"{prefixe}:{i}"
            sorties.append(self._predire_un(cle, ex.titre, ex.description)["niveau"])
        return sorties
