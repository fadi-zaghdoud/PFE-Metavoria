"""Endpoint /modele + `infos_actif` : classes du modèle ACTIF (Phase A — statut des catégories).

On vérifie que les classes remontent du MANIFESTE (LOAD-FREE : aucun modèle chargé — `TestClient`
sans `with` n'exécute pas le lifespan), et que l'absence de `classes` au manifeste (cas d'un modèle
flywheel antérieur à la Phase A) DÉGRADE proprement (`classes=None`) sans crash.
"""

import json

from fastapi.testclient import TestClient

from smart_ticketing_ml.service import config, predictors
from smart_ticketing_ml.service.app import app

client = TestClient(app)

# Les 5 classes figées du modèle de production (manifeste J5), dans l'ordre sklearn (trié).
CLASSES_ATTENDUES = ["Accès", "Autre", "Logiciel", "Matériel", "Réseau"]


def test_infos_actif_classes_du_manifeste():
    """`infos_actif` lit les classes du manifeste du modèle actif — sans charger le modèle."""
    infos = predictors.infos_actif()
    assert infos["present"] is True
    assert infos["classes"] == CLASSES_ATTENDUES


def test_modele_endpoint_renvoie_les_classes():
    """GET /modele → 200 + les 5 classes connues (source du statut « active » côté admin)."""
    r = client.get("/modele")
    assert r.status_code == 200
    body = r.json()
    assert body["present"] is True
    assert body["classes"] == CLASSES_ATTENDUES


def test_infos_actif_manifeste_sans_classes_degrade(tmp_path, monkeypatch):
    """Manifeste SANS `classes` (modèle flywheel antérieur) → classes=None, aucun crash."""
    faux = tmp_path / "classifier_20260101T000000Z.joblib"  # n'a pas besoin d'exister (load-free)
    (tmp_path / "classifier_20260101T000000Z.manifest.json").write_text(
        json.dumps({"date": "2026-01-01T00:00:00Z", "macro_f1_reel": 0.5}), encoding="utf-8"
    )
    monkeypatch.setattr(config, "CLASSIFIER_PATH", str(faux))
    infos = predictors.infos_actif()
    assert infos["present"] is True
    assert infos["classes"] is None
