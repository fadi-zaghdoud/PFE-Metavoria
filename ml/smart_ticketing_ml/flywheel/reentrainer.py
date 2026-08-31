"""
Greffe 3 (flywheel) — B.1 : moteur de réentraînement (candidat glass-box, SANS déploiement).

Chaîne : assemble `train_v2` (snapshot D1 = synthétique + 50 relus) **+ captures** propres
(passées par Node) → **PORTE d'étanchéité** re-jouée sur les ajouts réels (fail dur) →
entraîne un **CANDIDAT** (`EmbeddingLogReg`) → évalue candidat ET modèle **ACTIF** sur le
**test gelé** (gold synth + validation_externe réel) → **rapport comparatif** + verdict selon
la règle PRÉ-ENREGISTRÉE.

Le candidat est écrit sous `artifacts/models/candidates/` (sous-dossier NON récursif → jamais
servi par accident). **Aucun déploiement ici** : c'est un acte admin séparé (voir /deployer).
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from ..eval.dataset import Exemple, load_exemples, load_gold, porte_etancheite
from ..eval.metrics import evaluer
from ..service import config, predictors
from ..service.embedder import embed_textes
from ..training.classifier import EmbeddingLogReg

TRAIN_V2_GLOB = "artifacts/flywheel/train_v2_*.jsonl"
GOLD_DEFAUT = "gold/gold.jsonl"
EXTERNE_DEFAUT = "gold/validation_externe.jsonl"
MODELS_DIR = "artifacts/models"
CANDIDATS_DIR = "artifacts/models/candidates"
CACHE_DIR = "artifacts/flywheel/embed_cache"

# Règle d'interprétation PRÉ-ENREGISTRÉE (macro-F1 réel candidat − actif), alignée sur J5+.
SEUIL_SOLIDE = 0.05
SEUIL_AMBIGU = 0.02


def _rec_to_exemple(r: dict) -> Exemple:
    return Exemple(
        titre=r.get("titre", ""), description=r.get("description", ""),
        categorie=r["categorie"], priorite=r.get("priorite", ""), statut=r.get("statut", ""),
    )


def _capture_to_exemple(c: dict) -> Exemple:
    """Capture DB → Exemple. Texte = titre + description (+ texte_extrait OCR si présent,
    cohérent avec l'embedding enrichi stocké côté serving)."""
    desc = c.get("description") or ""
    if c.get("texteExtrait"):
        desc = f"{desc}\n{c['texteExtrait']}"
    return Exemple(titre=c.get("titre", ""), description=desc,
                   categorie=c["categorie"], priorite="", statut="RESOLU")


def verifier_etancheite(reels: list[Exemple], gold: list[Exemple], externe: list[Exemple]) -> dict:
    """PORTE re-jouée dans B : les ajouts RÉELS au train ne recoupent NI le réel NI le gold
    (fail dur). Retourne les Jaccard max. Extraite pour être testée seule (anti-triche B)."""
    jmax_reel = porte_etancheite(reels, externe)
    jmax_gold = porte_etancheite(reels, gold)
    return {"jaccard_max_vs_reel": jmax_reel, "jaccard_max_vs_gold": jmax_gold}


def _embed_cache(nom: str, exemples: list[Exemple], cache_dir: Path) -> np.ndarray:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cle = hashlib.sha1("\x1f".join(e.texte for e in exemples).encode("utf-8")).hexdigest()[:12]
    f = cache_dir / f"{nom}_n{len(exemples)}_{cle}.npy"
    if f.exists():
        return np.load(f)
    X = np.asarray(embed_textes([e.texte for e in exemples]), dtype=np.float32)
    np.save(f, X)
    return X


def reentrainer(
    captures: list[dict] | None = None,
    train_v2_path: str | None = None,
    gold_path: str = GOLD_DEFAUT,
    externe_path: str = EXTERNE_DEFAUT,
) -> dict:
    """Réentraîne un CANDIDAT et le compare au modèle ACTIF sur le test gelé. Ne déploie pas."""
    captures = captures or []

    # 1) train_v2 (le plus récent) + captures
    if train_v2_path is None:
        trouve = sorted(glob.glob(TRAIN_V2_GLOB))
        if not trouve:
            raise RuntimeError(f"Snapshot train_v2 introuvable ({TRAIN_V2_GLOB}) — lance D1.4.")
        train_v2_path = trouve[-1]
    recs = [json.loads(l) for l in open(train_v2_path, encoding="utf-8") if l.strip()]
    train_ex = [_rec_to_exemple(r) for r in recs]
    captures_ex = [_capture_to_exemple(c) for c in captures]
    train_ex += captures_ex

    # Ajouts RÉELS (non synthétiques) = les seuls soumis à la porte dure.
    reels = [_rec_to_exemple(r) for r in recs if r.get("source") != "synthetique"] + captures_ex

    # 2) Test GELÉ
    gold = load_gold(gold_path)
    externe = load_exemples(externe_path)

    # 3) PORTE d'étanchéité (fail dur) — avant tout entraînement
    etancheite = verifier_etancheite(reels, gold, externe)

    # 4) Ordre de classes (dynamique, jamais codé en dur)
    labels = sorted(
        {e.categorie for e in train_ex} | {e.categorie for e in gold} | {e.categorie for e in externe}
    )

    # 5) Embeddings + entraînement du CANDIDAT
    cache = Path(CACHE_DIR)
    Xtr = _embed_cache("train_v2", train_ex, cache)
    ytr = [e.categorie for e in train_ex]
    candidat = EmbeddingLogReg().fit_vectors(Xtr, ytr)

    # 6) Modèle ACTIF (le classifier_*.joblib courant), chargé à part
    chemin_actif = predictors._chemin_modele()
    actif = EmbeddingLogReg.load(chemin_actif, embed_fn=embed_textes)

    # 7) Éval des DEUX sur le test gelé
    Xg = _embed_cache("gold", gold, cache)
    yg = [e.categorie for e in gold]
    Xe = _embed_cache("externe", externe, cache)
    ye = [e.categorie for e in externe]

    def _ev(model: EmbeddingLogReg) -> dict:
        return {
            "gold": evaluer(yg, model.predict_vectors(Xg), labels).to_dict(),
            "reel": evaluer(ye, model.predict_vectors(Xe), labels).to_dict(),
        }

    r_actif, r_cand = _ev(actif), _ev(candidat)
    delta_reel = r_cand["reel"]["macro_f1"] - r_actif["reel"]["macro_f1"]
    if delta_reel > SEUIL_SOLIDE:
        verdict = f"SOLIDE (>+{SEUIL_SOLIDE})"
    elif delta_reel >= SEUIL_AMBIGU:
        verdict = f"AMBIGU (+{SEUIL_AMBIGU}..+{SEUIL_SOLIDE})"
    else:
        verdict = f"NUL (<+{SEUIL_AMBIGU})"
    # Garde de déploiement ALIGNÉE sur la règle pré-enregistrée : déployable seulement si le gain
    # réel est AU MOINS AMBIGU (Δ ≥ +0,02). Un Δ « NUL » (< +0,02) est dans le bruit (n=46) — on
    # ne déploie JAMAIS dans le bruit, sinon on contredirait la règle qui sert à LIRE la courbe.
    # L'admin voit le verdict (AMBIGU vs SOLIDE) et tranche : glass-box préservé.
    meilleur = delta_reel >= SEUIL_AMBIGU

    # 8) Écrire le CANDIDAT + le rapport (candidates/, JAMAIS déployé)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    cand_dir = Path(CANDIDATS_DIR)
    cand_dir.mkdir(parents=True, exist_ok=True)
    cand_path = cand_dir / f"classifier_{stamp}.joblib"
    candidat.save(cand_path)

    rapport = {
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "stamp": stamp,
        "train": {
            "train_v2": Path(train_v2_path).name,
            "n_synthetique": sum(1 for r in recs if r.get("source") == "synthetique"),
            "n_flywheel_relu": sum(1 for r in recs if r.get("source") == "flywheel_relu"),
            "n_captures": len(captures),
            "n_total": len(train_ex),
        },
        "etancheite": {**etancheite, "n_ajouts_reels_gardes": len(reels), "porte": "exact=0, Jaccard>=0.5=0"},
        "modele_embedding": config.MODELE_EMBEDDING,
        # Classes APPRISES par le candidat (dérivées des labels, jamais codées en dur) : recopiées
        # au manifeste au déploiement → le service les expose (/modele) pour le statut des catégories.
        "classes": [str(c) for c in candidat.classes_],
        "actif": {"chemin": Path(chemin_actif).name, **r_actif},
        "candidat": {"chemin": cand_path.name, **r_cand},
        "delta_macro_f1_reel": round(delta_reel, 4),
        "verdict_pre_enregistre": verdict,
        "candidat_meilleur": meilleur,
        "regle": f"delta réel > {SEUIL_SOLIDE} solide / {SEUIL_AMBIGU}..{SEUIL_SOLIDE} ambigu / < {SEUIL_AMBIGU} nul",
        "deploye": False,
    }
    (cand_dir / f"rapport_{stamp}.json").write_text(
        json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return rapport


def deployer(stamp: str) -> dict:
    """Déploie un CANDIDAT (acte ADMIN) : REFUSE si non meilleur sur le réel ; sinon copie le
    `.joblib` dans `artifacts/models/` (servi comme le plus récent), écrit son manifeste et
    recharge le classifieur du serving. Double garde : ce refus SERVEUR + le bouton UI conditionnel."""
    cand_dir = Path(CANDIDATS_DIR)
    rapport_path = cand_dir / f"rapport_{stamp}.json"
    joblib_path = cand_dir / f"classifier_{stamp}.joblib"
    if not (rapport_path.exists() and joblib_path.exists()):
        raise RuntimeError(f"Candidat introuvable pour stamp « {stamp} ».")
    rapport = json.loads(rapport_path.read_text(encoding="utf-8"))
    if not rapport.get("candidat_meilleur"):
        raise ValueError(
            f"Déploiement REFUSÉ : candidat non meilleur sur le réel "
            f"(Δ={rapport.get('delta_macro_f1_reel')}, verdict {rapport.get('verdict_pre_enregistre')})."
        )
    dest_dir = Path(MODELS_DIR)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"classifier_{stamp}.joblib"
    shutil.copy2(joblib_path, dest)
    (dest_dir / f"classifier_{stamp}.manifest.json").write_text(json.dumps({
        "date": rapport["genere_le"],
        "source": "flywheel_candidat",
        "stamp": stamp,
        # Classes du modèle déployé (exposées par /modele pour le statut des catégories, Phase A).
        # Legacy : un manifeste sans ce champ → /modele retombe sur classes_ du modèle chargé.
        "classes": rapport.get("classes"),
        "macro_f1_reel": rapport["candidat"]["reel"]["macro_f1"],
        "macro_f1_synth": rapport["candidat"]["gold"]["macro_f1"],
        "delta_macro_f1_reel": rapport["delta_macro_f1_reel"],
        "train": rapport["train"],
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    predictors.recharger_classifieur()
    return {"deploye": True, "chemin": dest.name, "macro_f1_reel": rapport["candidat"]["reel"]["macro_f1"]}


def _afficher(rapport: dict) -> None:
    t = rapport["train"]
    print("\n=== Réentraînement — CANDIDAT vs ACTIF (test gelé) ===")
    print(f"train : {t['n_synthetique']} synth + {t['n_flywheel_relu']} relus + {t['n_captures']} captures = {t['n_total']}")
    e = rapport["etancheite"]
    print(f"étanchéité ajouts réels ({e['n_ajouts_reels_gardes']}) : Jaccard max réel {e['jaccard_max_vs_reel']} / gold {e['jaccard_max_vs_gold']} — porte franchie")
    print(f"{'':16}{'macro-F1 réel':>16}{'macro-F1 synth':>16}")
    print(f"{'ACTIF':16}{rapport['actif']['reel']['macro_f1']:>16}{rapport['actif']['gold']['macro_f1']:>16}")
    print(f"{'CANDIDAT':16}{rapport['candidat']['reel']['macro_f1']:>16}{rapport['candidat']['gold']['macro_f1']:>16}")
    print(f"delta réel : {rapport['delta_macro_f1_reel']:+.4f}  →  verdict : {rapport['verdict_pre_enregistre']}")
    print(f"candidat meilleur (déployable) : {rapport['candidat_meilleur']}")
    print(f"candidat (NON déployé) : {CANDIDATS_DIR}/{rapport['candidat']['chemin']}\n")


def main() -> int:
    p = argparse.ArgumentParser(description="Réentraînement candidat vs actif (flywheel B.1).")
    p.add_argument("--train-v2", default=None)
    p.add_argument("--gold", default=GOLD_DEFAUT)
    p.add_argument("--externe", default=EXTERNE_DEFAUT)
    args = p.parse_args()
    _afficher(reentrainer(captures=[], train_v2_path=args.train_v2, gold_path=args.gold, externe_path=args.externe))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
