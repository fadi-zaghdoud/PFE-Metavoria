"""Contrat de la CLASSIFICATION (CDC §6.3) : la politique d'ABSTENTION est pure et testable
sans modèle. Un test d'intégration `/classify` (charge bge-m3) est marqué `slow` et se skippe
si le modèle figé est absent.
"""

import pytest

from smart_ticketing_ml.training.classifier import ABSTENTION, abstention, couverture_precision

CLASSES = ["Accès", "Logiciel", "Réseau"]


def test_abstention_sous_le_seuil():
    proba = [[0.20, 0.30, 0.50], [0.10, 0.85, 0.05]]
    labels, conf = abstention(proba, CLASSES, seuil=0.60)
    assert labels[0] == ABSTENTION      # top-1 = 0.50 < 0.60 → abstention
    assert labels[1] == "Logiciel"      # top-1 = 0.85 ≥ 0.60 → prédit
    assert conf[0] == pytest.approx(0.50)
    assert conf[1] == pytest.approx(0.85)


def test_aucune_abstention_si_seuil_nul():
    labels, _ = abstention([[0.34, 0.33, 0.33]], CLASSES, seuil=0.0)
    assert labels[0] in CLASSES and labels[0] != ABSTENTION


def test_abstenir_nest_pas_predire_une_classe():
    # Contrat J5 : abstenir ≠ forcer une classe fourre-tout — c'est la sentinelle ABSTENTION.
    labels, _ = abstention([[0.40, 0.35, 0.25]], CLASSES, seuil=0.90)
    assert labels[0] == ABSTENTION


def test_couverture_precision():
    proba = [[0.90, 0.05, 0.05], [0.40, 0.35, 0.25]]  # top-1 : Accès(0.90), Accès(0.40)
    y_true = ["Accès", "Réseau"]
    couverture, precision = couverture_precision(proba, CLASSES, y_true, seuil=0.5)
    assert couverture == pytest.approx(0.5)   # 1/2 au-dessus du seuil
    assert precision == pytest.approx(1.0)    # le seul couvert (Accès@0.90) est correct


@pytest.mark.slow
def test_classify_contrat_reel():
    """Charge le modèle figé + bge-m3 (lent) et vérifie le contrat de sortie de /classify."""
    from smart_ticketing_ml.service import config, predictors

    try:
        predictors._chemin_modele()
    except Exception:
        pytest.skip("modèle classifieur figé absent")

    from fastapi.testclient import TestClient

    from smart_ticketing_ml.service.app import app

    with TestClient(app) as client:
        r = client.post("/classify", json={"titre": "VPN coupé", "description": "impossible de se connecter"})
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body["categorie"], str) and body["categorie"]
    assert 0.0 <= body["confiance"] <= 1.0
    assert abs(sum(body["probabilites"].values()) - 1.0) < 1e-3   # distribution de probas
    assert len(body["embedding"]) == config.DIMENSION             # 1024 (bge-m3)
