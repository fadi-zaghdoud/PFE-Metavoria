"""
Wrapper Ollama — génération LLM locale avec sortie structurée (JSON schema).

Aucune donnée ne sort de la machine (confidentialité), aucun coût API.
`temperature` est disponible en local (contrairement à l'API Claude) : on
l'utilise pour renforcer la diversité, en complément des graines de scénarios.
"""

from __future__ import annotations

import json
from typing import Any


class OllamaError(RuntimeError):
    pass


class OllamaGenerator:
    def __init__(
        self,
        host: str,
        model: str,
        fallback: str | None = None,
        temperature: float = 0.8,
        timeout: int = 600,
    ) -> None:
        try:
            import ollama
        except ImportError as exc:  # pragma: no cover
            raise OllamaError("Paquet `ollama` manquant : pip install ollama") from exc

        self._ollama = ollama
        self.client = ollama.Client(host=host, timeout=timeout)
        self.model = model
        self.fallback = fallback
        self.temperature = temperature
        # Modèle effectivement utilisé (renseigné après le 1er appel réussi).
        self.model_used: str | None = None

    def chat_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any]:
        """Renvoie la réponse JSON parsée, en tentant le fallback si besoin."""
        last_exc: Exception | None = None
        for modele in [self.model, self.fallback]:
            if not modele:
                continue
            try:
                resp = self.client.chat(
                    model=modele,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    format=schema,  # décodage contraint au JSON schema
                    options={"temperature": self.temperature},
                )
                self.model_used = modele
                return json.loads(resp["message"]["content"])
            except Exception as exc:  # modèle absent, timeout, JSON invalide…
                last_exc = exc
                continue
        raise OllamaError(f"Échec de génération Ollama : {last_exc}") from last_exc
