"""Contrats HTTP du microservice IA (FastAPI TestClient).

On cible les chemins de VALIDATION, qui répondent AVANT tout modèle / DB / Ollama : status codes
et forme de réponse. Les happy-paths lourds (classification réelle, génération LLM) sont couverts
ailleurs (test `slow` de /classify ; le reste par les preuves à l'écran). `TestClient(app)` sans
`with` n'exécute pas le lifespan → aucun modèle chargé ici.
"""

import base64

import pytest
from fastapi.testclient import TestClient

from smart_ticketing_ml.service import config
from smart_ticketing_ml.service.app import app

client = TestClient(app)


def test_sante_ok_et_schema():
    r = client.get("/sante")
    assert r.status_code == 200
    body = r.json()
    assert body["statut"] == "ok"
    assert {"embedding", "reranker", "classifieur", "ocr"} <= set(body)


@pytest.mark.parametrize("chemin", ["/classify", "/priority", "/suggest"])
def test_titre_et_description_vides_422(chemin):
    # titre blanc + description vide → 422 (avant tout modèle/DB).
    r = client.post(chemin, json={"titre": "   ", "description": ""})
    assert r.status_code == 422


# ── Porte d'abstention (§6.5) — le seuil VOYAGE dans la charge utile ────────────
# Ce service est SANS ÉTAT : il ne lit aucun registre, il reçoit le seuil de Node. Les
# bornes sont donc revalidées ICI, pas seulement côté backend — une charge utile forgée
# ne doit pas pouvoir ouvrir la porte sur un réglage dégénéré.

@pytest.mark.parametrize("seuil", [0, 1, -0.5, 1.5, 0.04, 0.96])
def test_suggest_seuil_hors_bornes_422(seuil):
    r = client.post("/suggest", json={"titre": "t", "description": "d", "seuil": seuil})
    assert r.status_code == 422


def test_suggest_seuil_absent_reste_valide():
    """Champ optionnel : son absence est le cas nominal (porte fermée)."""
    # 422 viendrait d'un titre/description vides, pas du seuil manquant : on vérifie donc
    # que la validation du corps passe, sans toucher à la DB (titre/description remplis
    # iraient jusqu'au retrieval, hors périmètre d'un test offline).
    r = client.post("/suggest", json={"titre": "   ", "description": ""})
    assert r.status_code == 422  # rejet dû aux champs vides, le seuil absent n'a pas gêné


def test_suggest_seuil_null_accepte_par_le_schema():
    """`null` = porte fermée — Node l'envoie tel quel quand le réglage est DESACTIVE."""
    r = client.post("/suggest", json={"titre": "   ", "description": "", "seuil": None})
    assert r.status_code == 422  # même rejet que ci-dessus : `null` n'ajoute pas d'erreur


def test_summarize_fil_vide_422():
    r = client.post("/summarize", json={"titre": "t", "description": "   ", "messages": []})
    assert r.status_code == 422


def test_extract_champ_requis_manquant_422():
    r = client.post("/extract", json={"nom_fichier": "x.png"})  # contenu_base64 requis
    assert r.status_code == 422


def test_extract_base64_invalide_422():
    r = client.post("/extract", json={"contenu_base64": "@@@ pas du base64 @@@"})
    assert r.status_code == 422


def test_extract_type_non_supporte_422():
    b64 = base64.b64encode(b"ni une image ni un pdf").decode()
    r = client.post("/extract", json={"contenu_base64": b64, "nom_fichier": "note.txt"})
    assert r.status_code == 422


def test_extract_trop_volumineux_413(monkeypatch):
    # Limite ramenée à 0 Mo → tout octet non vide dépasse (évite un payload réellement énorme).
    monkeypatch.setattr(config, "EXTRACT_TAILLE_MAX_MO", 0)
    b64 = base64.b64encode(b"x" * 32).decode()
    r = client.post("/extract", json={"contenu_base64": b64, "nom_fichier": "a.png"})
    assert r.status_code == 413
