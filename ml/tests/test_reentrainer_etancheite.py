"""
Test versionné — l'étanchéité est RE-JOUÉE au réentraînement (flywheel Brique B).

Garantit, relançable, qu'une « capture » contaminée (un ticket du test glissé dans les ajouts)
fait ÉCHOUER DUR l'assemblage du train, AVANT tout entraînement. La triche est ainsi bloquée à
DEUX niveaux : D1 (construction du lot) ET B (réentraînement) — prouvée aux deux.

Lancer (depuis ml/) :
    PYTHONPATH=. python tests/test_reentrainer_etancheite.py
"""

from smart_ticketing_ml.eval.dataset import Exemple
from smart_ticketing_ml.flywheel.reentrainer import verifier_etancheite


def _ex(titre: str, desc: str, cat: str = "Réseau") -> Exemple:
    return Exemple(titre=titre, description=desc, categorie=cat, priorite="", statut="")


EXTERNE = [_ex("Panne VPN", "Le VPN AnyConnect refuse la connexion depuis ce matin")]
GOLD = [_ex("Erreur applicative", "L'application plante au démarrage", "Logiciel")]


def test_capture_contaminee_abort() -> None:
    """Une capture identique à un ticket du test → RuntimeError (abort avant entraînement)."""
    capture = _ex("Autre titre", "Le VPN AnyConnect refuse la connexion depuis ce matin")
    try:
        verifier_etancheite([capture], GOLD, EXTERNE)
        raise AssertionError("le réentraînement aurait dû être bloqué (capture contaminée)")
    except RuntimeError as e:
        assert "ÉTANCHÉITÉ" in str(e) or "EXACT" in str(e)


def test_captures_propres_passent() -> None:
    """Des captures sans recoupement passent la porte du réentraînement."""
    capture = _ex("Imprimante", "Le toner est vide sur la HP du 2e étage", "Matériel")
    etat = verifier_etancheite([capture], GOLD, EXTERNE)
    assert etat["jaccard_max_vs_reel"] < 0.5 and etat["jaccard_max_vs_gold"] < 0.5


if __name__ == "__main__":
    for _nom, _fn in list(globals().items()):
        if _nom.startswith("test_") and callable(_fn):
            _fn()
            print(f"[OK] {_nom}")
    print("Étanchéité du réentraînement (B) : la triche est bloquée avant tout entraînement.")
