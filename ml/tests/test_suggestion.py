"""Contrat de la SUGGESTION RAG (CDC §6.3) + politique d'ABSTENTION (J6).

Le retrieval et la génération LLM sont STUBBÉS (monkeypatch) : ces tests ne touchent NI la DB
NI Ollama → déterministes et rapides. On vérifie les branches structurantes :
  - aucun candidat → abstention ;
  - candidats mais rien d'ancré → abstention (on n'invente pas) ;
  - suggestion citée : sources ⊆ similaires, drapeau de provenance présent (contrat K3) ;
  - porte de seuil : sous le seuil, abstention AVANT génération.
"""

import pytest

from smart_ticketing_ml.retrieval import generation, hybrid, suggestion
from smart_ticketing_ml.retrieval.hybrid import DocKB


def _doc(doc_id: int, titre: str = "T", synthetique: bool = True) -> DocKB:
    return DocKB(
        id=doc_id, titre=titre, description="desc", resolution="resol",
        categorie="Réseau", synthetique=synthetique, score=1.0,
    )


def test_abstention_si_aucun_candidat(monkeypatch):
    monkeypatch.setattr(hybrid, "retrieve", lambda cur, requete, variante: [])
    s = suggestion.suggerer(cur=None, requete="rien")
    assert s.abstenu is True
    assert s.message  # motif renseigné
    assert s.latence_ms is not None


def test_abstention_si_generation_sans_source(monkeypatch):
    monkeypatch.setattr(hybrid, "retrieve", lambda cur, requete, variante: [_doc(1), _doc(2)])
    monkeypatch.setattr(generation, "generer", lambda requete, docs: ("texte non ancré", []))
    s = suggestion.suggerer(cur=None, requete="x")
    assert s.abstenu is True          # rien d'ancré → on n'invente pas
    assert s.similaires               # les candidats restent exposés, même en abstention


def test_suggestion_citee_contrat(monkeypatch):
    docs = [_doc(865, "VPN coupé", synthetique=False), _doc(779, "Accès VPN", synthetique=True)]
    monkeypatch.setattr(hybrid, "retrieve", lambda cur, requete, variante: docs)
    monkeypatch.setattr(generation, "generer", lambda requete, ds: ("Renouveler le certificat #865", [865]))

    s = suggestion.suggerer(cur=None, requete="vpn coupé")
    assert s.abstenu is False
    ids_similaires = {d["id"] for d in s.similaires}
    assert set(s.sources).issubset(ids_similaires)   # sources ⊆ similaires
    assert 865 in s.sources
    # Contrat K3 : chaque similaire porte le drapeau de provenance.
    assert all("synthetique" in d for d in s.similaires)
    d865 = next(d for d in s.similaires if d["id"] == 865)
    assert d865["synthetique"] is False              # #865 = vraie résolution
    assert s.latence_ms is not None


def test_porte_abstention_sous_seuil(monkeypatch):
    monkeypatch.setattr(hybrid, "retrieve", lambda cur, requete, variante: [_doc(1), _doc(2)])
    monkeypatch.setattr(hybrid, "score_abstention", lambda requete, docs: 0.10)
    # La génération ne doit PAS être appelée si l'on abstient sur le seuil.
    monkeypatch.setattr(
        generation, "generer",
        lambda requete, docs: pytest.fail("génération appelée malgré l'abstention sur le seuil"),
    )
    s = suggestion.suggerer(cur=None, requete="x", seuil=0.5)
    assert s.abstenu is True
    assert s.confiance == pytest.approx(0.10)
