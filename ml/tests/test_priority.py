"""Contrat du module de PRIORITÉ (CDC §6.3) — le scorecard est PUR (re/unicodedata/lexicon),
donc testable hors modèle/DB/Ollama, de façon déterministe.

On vérifie : les 4 niveaux CDC (FAIBLE/MOYENNE/HAUTE/CRITIQUE), les bornes de seuils exactes,
l'escalade par mots-clés forts, la désescalade, l'annulation par négation, et surtout
l'INVARIANT de contrat : la sortie est TOUJOURS l'un des 4 niveaux.
"""

import pytest

from smart_ticketing_ml.priority import lexicon as lex
from smart_ticketing_ml.priority.scorecard import Scorecard, niveau_de

NIVEAUX = {"FAIBLE", "MOYENNE", "HAUTE", "CRITIQUE"}


@pytest.mark.parametrize(
    "score,attendu",
    [
        (-5.0, "FAIBLE"),
        (0.99, "FAIBLE"),
        (1.0, "MOYENNE"),   # borne SEUIL_MOYENNE : incluse dans MOYENNE
        (2.49, "MOYENNE"),
        (2.5, "HAUTE"),     # borne SEUIL_HAUTE
        (3.99, "HAUTE"),
        (4.0, "CRITIQUE"),  # borne SEUIL_CRITIQUE
        (99.0, "CRITIQUE"),
    ],
)
def test_niveau_de_bornes(score, attendu):
    assert niveau_de(score) == attendu


def test_seuils_conformes_a_la_config_gelee():
    # Garde-fou : si les seuils changent, ce test le signale (les bornes ci-dessus en dépendent).
    assert (lex.SEUIL_MOYENNE, lex.SEUIL_HAUTE, lex.SEUIL_CRITIQUE) == (1.0, 2.5, 4.0)


def test_decalage_translate_les_seuils():
    assert niveau_de(1.0) == "MOYENNE"
    assert niveau_de(1.0, decalage=1.0) == "FAIBLE"  # seuils décalés de +1 → 1.0 repasse sous MOYENNE


def test_urgence_forte_escalade_vers_critique():
    # Réseau (1.5) + « production » (+2) + « perte de donnees » (+2, plafond urgence 4) → ≥ 4.0.
    d = Scorecard().evaluer("Serveur de production HS", "perte de donnees generalisee", "Réseau")
    assert d.niveau == "CRITIQUE"
    assert d.score >= lex.SEUIL_CRITIQUE


def test_desescalade_abaisse_vers_faible():
    d = Scorecard().evaluer("Question", "quand vous pourrez, pas urgent, petit detail", "Autre")
    assert d.niveau == "FAIBLE"


def test_negation_annule_le_mot_cle():
    # « aucune perte de donnees » : le négateur annule le mot-clé fort → pas d'escalade.
    calme = Scorecard().evaluer("RAS", "aucune perte de donnees, tout va bien", "Logiciel")
    fort = Scorecard().evaluer("Incident", "perte de donnees", "Logiciel")
    assert calme.score < fort.score
    assert calme.niveau in {"FAIBLE", "MOYENNE"}


@pytest.mark.parametrize(
    "titre,description,categorie",
    [
        ("", "", ""),                       # tout vide
        ("urgent", "asap", "Inconnue"),     # catégorie hors liste → BASE_DEFAUT
        ("Bonjour", "Merci d'avance", "Autre"),
    ],
)
def test_invariant_sortie_toujours_dans_les_4_niveaux(titre, description, categorie):
    assert Scorecard().predire(titre, description, categorie) in NIVEAUX


def test_texte_vide_donne_un_defaut_valide():
    d = Scorecard().evaluer("", "", "")
    assert d.niveau in NIVEAUX
    assert d.niveau == "MOYENNE"  # base défaut 1.0 → niveau_de(1.0)
