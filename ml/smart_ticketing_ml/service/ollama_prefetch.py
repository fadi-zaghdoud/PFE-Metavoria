"""
Provisionnement des modèles LLM dans le serveur Ollama (dockerisation, §7).

Exécuté UNE FOIS avant le service IA (conteneur one-shot `ollama-prefetch` du
compose), il garantit que le serveur Ollama détient les modèles dont dépendent
`/suggest` et `/summarize` — sans quoi la génération échoue en « model not found »
alors que tout paraît sain (le serveur répond, son healthcheck passe).

Pendant du `prefetch` des modèles Hugging Face, et même philosophie : il ne se
contente pas de télécharger, il VÉRIFIE.

  1. PROVISIONNEMENT — `POST /api/pull` par modèle, en flux pour que la progression
     reste visible dans les journaux (13 Go au premier démarrage). Idempotent : sur
     un volume déjà peuplé, l'appel se réduit à une vérification de manifeste.
  2. PRÉSENCE — `POST /api/show` par modèle.
  3. INFÉRENCE ET PRÉCHAUFFAGE — une génération de quelques dizaines de jetons sur
     le modèle principal. Elle prouve d'abord que le modèle se charge et calcule
     vraiment : un blob corrompu échoue ICI, au démarrage de la pile, et non devant
     un jury. Elle ABSORBE ensuite la pénalité du premier appel — mesurée sur les
     deux modèles, la première génération après un chargement coûte ~3× les
     suivantes (7b : 32,3 s puis 9,5 s ; 14b : 70,2 s puis 32,4 s), et un seul
     jeton ne suffit PAS à réchauffer le chemin d'inférence. Cette pénalité est
     donc payée ici, une fois, plutôt que par le premier utilisateur.

Toute défaillance rend un code de sortie NON NUL : le service `ml` en dépend par
`service_completed_successfully` et ne démarrera donc pas sur une pile incomplète.

    python -m smart_ticketing_ml.service.ollama_prefetch
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

HOTE = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
# Liste séparée par des espaces : tous les modèles dont la pile a besoin.
MODELES = os.environ.get("OLLAMA_MODELES", "qwen2.5:7b qwen2.5:14b").split()
# Modèle principal — celui sur lequel on éprouve l'inférence.
PRINCIPAL = os.environ.get("OLLAMA_MODEL", MODELES[0] if MODELES else "qwen2.5:7b")
# Longueur de la génération de préchauffage. Un seul jeton chargerait les poids
# sans réchauffer le chemin d'inférence (cf. en-tête) ; quelques dizaines suffisent.
JETONS_PRECHAUFFAGE = int(os.environ.get("OLLAMA_PREFETCH_JETONS", "32"))
# Diagnostic : vérifier l'état du volume SANS rien provisionner.
VERIFIER_SEULEMENT = os.environ.get("OLLAMA_PREFETCH_VERIFIER_SEULEMENT", "").lower() in ("1", "true", "oui")


def _poster(chemin: str, charge: dict, timeout: int = 600):
    requete = urllib.request.Request(
        f"{HOTE}{chemin}",
        data=json.dumps(charge).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    return urllib.request.urlopen(requete, timeout=timeout)


def attendre_serveur(delai: int = 120) -> None:
    """Le compose garantit déjà `ollama` healthy ; ce filet sert au lancement manuel."""
    limite = time.time() + delai
    while time.time() < limite:
        try:
            urllib.request.urlopen(f"{HOTE}/api/tags", timeout=5).read()
            return
        except Exception:
            time.sleep(2)
    raise RuntimeError(f"serveur Ollama injoignable sur {HOTE} après {delai} s")


def provisionner(modele: str) -> None:
    """`/api/pull` en flux, avec un point de progression tous les 10 %."""
    dernier = -10.0
    with _poster("/api/pull", {"model": modele, "stream": True}, timeout=3600) as reponse:
        for ligne in reponse:
            ligne = ligne.strip()
            if not ligne:
                continue
            evenement = json.loads(ligne)
            if "error" in evenement:
                raise RuntimeError(evenement["error"])
            total, fait = evenement.get("total"), evenement.get("completed")
            if total and fait:
                pourcent = 100.0 * fait / total
                if pourcent - dernier >= 10:
                    print(f"       {modele} : {pourcent:5.1f} %  ({fait / 2**30:.1f}/{total / 2**30:.1f} Go)", flush=True)
                    dernier = pourcent


def verifier_presence(modele: str) -> str:
    """`/api/show` — lève si le modèle est absent. Renvoie sa taille de paramètres."""
    with _poster("/api/show", {"model": modele}, timeout=60) as reponse:
        details = json.load(reponse)
    return (details.get("details") or {}).get("parameter_size", "?")


def verifier_inference(modele: str) -> tuple[float, int]:
    """Génère quelques dizaines de jetons : preuve d'inférence ET préchauffage.
    Renvoie (durée, nombre de jetons réellement produits)."""
    debut = time.perf_counter()
    with _poster(
        "/api/generate",
        {
            "model": modele,
            # Invite courte mais qui appelle une vraie réponse : on veut que le
            # modèle produise réellement des jetons, pas qu'il s'arrête aussitôt.
            "prompt": "Explique en deux phrases ce qu'est un ticket de support informatique.",
            "stream": False,
            "options": {"num_predict": JETONS_PRECHAUFFAGE},
        },
        timeout=900,
    ) as reponse:
        resultat = json.load(reponse)
    if not resultat.get("done"):
        raise RuntimeError(f"génération incomplète pour {modele}")
    jetons = int(resultat.get("eval_count") or 0)
    if jetons < 1:
        raise RuntimeError(f"{modele} n'a produit aucun jeton")
    return time.perf_counter() - debut, jetons


def main() -> int:
    print(f"OLLAMA_HOST = {HOTE}", flush=True)
    print(f"modèles     = {' '.join(MODELES)}  (principal : {PRINCIPAL})", flush=True)
    try:
        attendre_serveur()
    except Exception as exc:
        print(f"ECHEC  {exc}", file=sys.stderr, flush=True)
        return 1

    for modele in MODELES:
        debut = time.perf_counter()
        try:
            if not VERIFIER_SEULEMENT:
                provisionner(modele)
            taille = verifier_presence(modele)
        except urllib.error.HTTPError as exc:
            corps = exc.read().decode("utf-8", "replace")[:200]
            print(f"ECHEC  {modele} : HTTP {exc.code} — {corps}", file=sys.stderr, flush=True)
            return 1
        except Exception as exc:
            print(f"ECHEC  {modele} : {exc}", file=sys.stderr, flush=True)
            return 1
        print(f"OK     {modele:16} present ({taille}) en {time.perf_counter() - debut:6.1f} s", flush=True)

    try:
        duree, jetons = verifier_inference(PRINCIPAL)
    except Exception as exc:
        print(f"ECHEC  inference sur {PRINCIPAL} : {exc}", file=sys.stderr, flush=True)
        return 1
    print(f"OK     {PRINCIPAL:16} infere et prechauffe ({jetons} jetons) en {duree:6.1f} s", flush=True)
    print("provisionnement termine : les modeles sont presents et exploitables.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
