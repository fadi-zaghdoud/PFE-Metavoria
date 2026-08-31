"""
Prédicteurs de production servis par le microservice (Greffe 1) :
  - **classifieur de catégorie** = `EmbeddingLogReg` figé (J5, LogReg non calibrée),
    chargé une fois (paresseux, comme l'embedder / le reranker) ;
  - **scorecard de priorité** = règle glass-box **déterministe** (J7), pure, sans I/O.

Frontière de service (décision Greffe 1) : le service reçoit du **TEXTE** et renvoie
du **JSON** — il ne touche **jamais** la base. L'embedding est calculé ici puis
**RENVOYÉ** à Node, qui le persiste (Node est seul à écrire la DB). Un seul bge-m3
en mémoire : le classifieur réutilise l'embedder du service.
"""

from __future__ import annotations

import glob
import json
import threading
from pathlib import Path

from ..priority.scorecard import Scorecard
from ..training.classifier import EmbeddingLogReg
from . import config, embedder

# Chargement paresseux et thread-safe du classifieur (le modèle d'embeddings, lui,
# est chargé par l'embedder au premier encode).
_clf: EmbeddingLogReg | None = None
_verrou = threading.Lock()

# La scorecard est pure (règles gelées de `lexicon`) → instanciable au chargement.
_scorecard = Scorecard()


def _texte(titre: str, description: str) -> str:
    """Unité identique à l'entraînement (`dataset.Exemple.texte`) : titre + \\n + description.
    Toute divergence ici décalerait les embeddings par rapport au modèle figé."""
    return f"{titre}\n{description}"


def _chemin_modele() -> Path:
    """Chemin du classifieur figé : override explicite, sinon le plus récent des
    `artifacts/models/classifier_*.joblib`."""
    if config.CLASSIFIER_PATH:
        return Path(config.CLASSIFIER_PATH)
    trouves = sorted(glob.glob("artifacts/models/classifier_*.joblib"))
    if not trouves:
        raise RuntimeError(
            "Aucun classifieur figé (artifacts/models/classifier_*.joblib). "
            "Entraîne-le : python -m smart_ticketing_ml.training.train_classifier"
        )
    return Path(trouves[-1])


def charger_classifieur() -> EmbeddingLogReg:
    """Charge (une fois) le classifieur figé, en réutilisant l'embedder du service."""
    global _clf
    if _clf is not None:
        return _clf
    with _verrou:
        if _clf is not None:  # un autre thread a pu charger entre-temps
            return _clf
        _clf = EmbeddingLogReg.load(_chemin_modele(), embed_fn=embedder.embed_textes)
        return _clf


def classifieur_charge() -> bool:
    """Vrai si le classifieur est déjà en mémoire (utile pour /sante)."""
    return _clf is not None


def recharger_classifieur() -> None:
    """Vide le classifieur en cache → le prochain `classer()` recharge le DERNIER
    `classifier_*.joblib`. Appelé après un déploiement flywheel : le nouveau modèle est servi
    sans redémarrer le service."""
    global _clf
    with _verrou:
        _clf = None


def infos_actif() -> dict:
    """Métadonnées du classifieur ACTIF (pour /sante + le compteur flywheel + /modele) : chemin,
    date d'entraînement, macro-F1 réel, et **classes connues** — lus du manifeste
    `classifier_*.manifest.json` s'il existe. LOAD-FREE (aucun chargement de modèle) : `/sante`
    reste léger. `classes` vaut None si le manifeste ne les porte pas (modèle flywheel antérieur
    à la Phase A) → l'appelant (/modele) retombe alors sur `classes_` du modèle chargé."""
    try:
        chemin = _chemin_modele()
    except RuntimeError:
        return {"present": False}
    infos = {
        "present": True,
        "chemin": chemin.name,
        "date_entrainement": None,
        "macro_f1_reel": None,
        "classes": None,
    }
    manifeste = chemin.parent / f"{chemin.stem}.manifest.json"
    if manifeste.exists():
        try:
            d = json.loads(manifeste.read_text(encoding="utf-8"))
            infos["date_entrainement"] = d.get("date")
            infos["macro_f1_reel"] = d.get("macro_f1_reel") or (d.get("gap_production") or {}).get("f1_reel")
            infos["classes"] = d.get("classes")
        except (ValueError, OSError):
            pass
    return infos


def classer(titre: str, description: str) -> dict:
    """Catégorie top-1 + confiance + probabilités par classe + **embedding** (pour Node).

    Un seul embed : le vecteur sert à la prédiction ET est renvoyé pour persistance.
    **Pas d'abstention appliquée ici** : le seuil n'est pas figé (J5, non-transfert) —
    on renvoie la prédiction brute + la confiance ; montrer/abstenir est un choix aval.
    """
    clf = charger_classifieur()
    vecteur = embedder.embed_textes([_texte(titre, description)])[0]  # list[float], L2-normalisé
    proba = clf.predict_proba_vectors([vecteur])[0]
    classes = clf.classes_
    i = int(proba.argmax())
    return {
        "categorie": str(classes[i]),
        "confiance": float(proba[i]),
        "probabilites": {str(c): float(p) for c, p in zip(classes, proba)},
        "modele_embedding": config.MODELE_EMBEDDING,
        "embedding": vecteur,
    }


def prioriser(titre: str, description: str, categorie: str) -> dict:
    """Décision de priorité glass-box (scorecard déterministe) + décomposition affichable.

    `categorie` vient de la classification (dépendance J7 : la base de score dépend de
    la catégorie). À la création, `age_heures=0` → aucun terme d'ancienneté.
    """
    decision = _scorecard.evaluer(titre, description, categorie)
    detail = decision.to_dict()  # niveau, score, plafonne, plafonnements, contributions
    detail["explication"] = decision.explication()  # « HAUTE car : production +2 · Réseau +1.5 »
    return detail
