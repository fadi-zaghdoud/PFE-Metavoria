"""
Test versionné de la PORTE d'étanchéité train/test (flywheel J9, Greffe 3).

Garantit — de façon RELANÇABLE et citable au mémoire — que **toute contamination du
train par le test échoue DUR** : copie exacte comme quasi-doublon (Jaccard ≥ seuil).
C'est la preuve active de l'intégrité méthodologique (on ne mesure jamais sur ce qui a
servi à entraîner), pas une simple promesse.

Lancer (depuis ml/) :
    PYTHONPATH=. python tests/test_porte_etancheite.py     # sans dépendance
    PYTHONPATH=. python -m pytest tests/test_porte_etancheite.py   # si pytest présent
"""

from pathlib import Path

from smart_ticketing_ml.eval.dataset import Exemple, load_exemples, porte_etancheite


def _ex(titre: str, desc: str, cat: str = "Réseau") -> Exemple:
    return Exemple(titre=titre, description=desc, categorie=cat, priorite="", statut="")


# Un « test » minimal (le jeu qu'on protège).
TEST = [_ex("Panne VPN", "Le VPN AnyConnect refuse la connexion depuis ce matin")]


def test_candidats_disjoints_passent() -> None:
    """Des candidats sans recoupement passent et renvoient un Jaccard max < seuil."""
    cand = [_ex("Imprimante HS", "La HP DeskJet ne répond plus au bureau", "Matériel")]
    jmax = porte_etancheite(cand, TEST)
    assert isinstance(jmax, float) and jmax < 0.5


def test_contamination_exacte_echoue_dur() -> None:
    """Une description identique à un ticket du test → RuntimeError (0 toléré)."""
    cand = [_ex("Autre titre", "Le VPN AnyConnect refuse la connexion depuis ce matin")]
    try:
        porte_etancheite(cand, TEST)
        raise AssertionError("la porte aurait dû lever (contamination exacte)")
    except RuntimeError as e:
        assert "EXACT" in str(e)


def test_quasi_doublon_echoue_dur() -> None:
    """Un quasi-doublon (non exact, Jaccard ≥ 0,5) → RuntimeError (0 toléré)."""
    cand = [_ex("Panne VPN", "Le VPN AnyConnect refuse la connexion depuis ce matin, aidez-moi svp")]
    try:
        porte_etancheite(cand, TEST)
        raise AssertionError("la porte aurait dû lever (quasi-doublon)")
    except RuntimeError as e:
        assert "APPROX" in str(e)


def test_donnees_reelles_242_disjointes() -> None:
    """Intégration : les 242 candidats Kaggle sont disjoints des 46 du test (ignoré si absents)."""
    racine = Path(__file__).resolve().parents[1]  # ml/
    f_train = racine / "real" / "real_train_kaggle.jsonl"
    f_test = racine / "gold" / "validation_externe.jsonl"
    if not (f_train.exists() and f_test.exists()):
        print("  (données réelles absentes — test d'intégration ignoré)")
        return
    jmax = porte_etancheite(load_exemples(str(f_train)), load_exemples(str(f_test)))
    assert jmax < 0.5


if __name__ == "__main__":
    for _nom, _fn in list(globals().items()):
        if _nom.startswith("test_") and callable(_fn):
            _fn()
            print(f"[OK] {_nom}")
    print("Tous les tests de la porte d'étanchéité passent.")
