"""
Préchargement des modèles Hugging Face (dockerisation, §7).

Exécuté UNE FOIS avant le service (conteneur one-shot `ml-prefetch` du compose),
il peuple le volume `hf-cache` monté sur HF_HOME — bge-m3 et bge-reranker-v2-m3
(~4,3 Go). C'est le SEUL moment de la vie de la pile où un accès réseau est
attendu : une fois le cache peuplé, le service charge ses modèles hors-ligne
(cf. `config.source_modele`).

Ce n'est pas un simple téléchargement : les deux modèles sont réellement CHARGÉS,
par les MÊMES fonctions que la production (`embedder.charger_modele` /
`reranker.charger_modele`, source unique de vérité). Un cache corrompu, une
version incompatible ou une dimension inattendue échouent donc ICI, au démarrage
de la pile — pas au premier appel métier d'une démonstration.

Idempotent : relancé sur un cache déjà peuplé, il ne retélécharge rien et se
contente de valider en quelques secondes.

    python -m smart_ticketing_ml.service.prefetch
"""

from __future__ import annotations

import os
import sys
import time

from . import config, embedder, reranker


def main() -> int:
    print(f"HF_HOME = {os.environ.get('HF_HOME', '(défaut utilisateur)')}", flush=True)

    etapes = (
        ("embeddings", config.MODELE_EMBEDDING, embedder.charger_modele),
        ("reranker", config.MODELE_RERANKER, reranker.charger_modele),
    )
    for nom, repo, charger in etapes:
        debut = time.perf_counter()
        try:
            charger()
        except Exception as exc:
            print(f"ECHEC  {nom} ({repo}) : {exc}", file=sys.stderr, flush=True)
            return 1
        source = config.source_modele(repo)
        origine = "cache local" if source != repo else "Hub"
        print(f"OK     {nom:11} {repo:26} en {time.perf_counter() - debut:6.1f} s  [{origine}]", flush=True)

    # `charger_modele` de l'embedder vérifie déjà la dimension contre config.DIMENSION
    # (garde-fou J4 : la colonne base est un vector(1024)) — rendu explicite ici.
    print(f"OK     dimension   {config.DIMENSION} (conforme à la colonne vector)", flush=True)
    print("préchargement terminé : les deux modèles sont chargeables.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
