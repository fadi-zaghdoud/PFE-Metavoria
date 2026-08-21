"""
Greffe 3 (flywheel) — C1 : courbe d'apprentissage « macro-F1 réel vs #labels réels ».

But : mesurer PROPREMENT l'effet marginal des labels humains, ISOLÉ du confond de B
(où le candidat s'entraînait sur 852 synth alors que l'actif J5 en avait 724). Ici la
**base synthétique est FIXE** (852) pour tous les points de la courbe ; seule varie la
quantité de labels réels relus (k ∈ {0,10,20,30,40,50}). k=0 est donc la baseline
pur-synthétique ; chaque point k>0 lui ajoute k relus PROPRES.

Rigueur (mêmes garde-fous que B) :
  - **Porte d'étanchéité re-jouée** (fail dur) sur CHAQUE sous-ensemble de relus avant
    tout entraînement — un relu qui recoupe le test gelé fait tout échouer.
  - **Test GELÉ** = gold synthétique (102) + validation_externe réel (46). La métrique de
    tête = macro-F1 sur le RÉEL (externe). On ne mesure/optimise JAMAIS sur autre chose.
  - **Lissage** : pour k ∈ {10,20,30,40}, S tirages aléatoires (seeds fixes) des relus →
    moyenne + bande min/max (le bruit n=46 rendrait un tirage unique trompeur). k=0 et
    k=50 sont déterministes (aucun / tous les relus).

Règle d'interprétation PRÉ-ENREGISTRÉE (pente k=0 → k=50, mêmes seuils que B) :
    Δ = F1_moy(k=50) − F1_moy(k=0)
      > +0,05  → montée SOLIDE
      +0,02..+0,05 → montée AMBIGUË
      −0,02..+0,02 → PLAT (nul)
      < −0,02  → DESCENDANT
Verdict FIXÉ ici, avant de voir les chiffres. On ne le change pas après coup.

Diagnostic hors-AWS (clairement ÉTIQUETÉ, PAS le résultat de tête) : le test réel contient
8/46 tickets « AWS/cloud » dont le label gold est incohérent (même sujet → Accès / Réseau /
Logiciel selon l'item). Ce bruit d'étiquetage plafonne tout gain mesurable. La 2ᵉ courbe
ré-évalue sur le test PRIVÉ de ces 8 items (mots-clés fixes, transparents) pour montrer
l'effet du plafond — sans le contourner : la courbe complète reste le résultat honnête.

Sorties (VERSIONNÉES, `eval/reports/j9_flywheel/`) :
  - `courbe_apprentissage.png`  (figure : complet + diagnostic hors-AWS, bandes min/max)
  - `courbe.json` / `courbe.md`  (table + verdict pré-enregistré + provenance)

Usage (depuis ml/) :
    PYTHONPATH=. python -m smart_ticketing_ml.flywheel.courbe_apprentissage
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from ..eval.dataset import load_exemples, load_gold
from ..eval.metrics import evaluer
from ..service import config, predictors
from ..service.embedder import embed_textes
from ..training.classifier import EmbeddingLogReg
from .reentrainer import (
    GOLD_DEFAUT,
    EXTERNE_DEFAUT,
    CACHE_DIR,
    SEUIL_AMBIGU,
    SEUIL_SOLIDE,
    TRAIN_V2_GLOB,
    _rec_to_exemple,
    verifier_etancheite,
)

OUT_DIR = "eval/reports/j9_flywheel"
GRID = [0, 10, 20, 30, 40, 50]  # #labels réels ajoutés à la base fixe
N_SEEDS = 5                     # tirages par k intermédiaire (k=0 et k=50 déterministes)
SEED_MERE = 42                  # graine mère (reproductible)

# Repérage AWS/cloud du test — mots-clés FIXES et transparents (pas ajustés au résultat).
CLOUD_RE = re.compile(
    r"\b(aws|ec2|s3|rds|lambda|cloud|azure|gcp|kubernetes|k8s|docker|serverless)\b", re.I
)


def _embed_cache(nom: str, exemples, cache_dir: Path) -> np.ndarray:
    """Embeddings mis en cache par jeu de textes (sha) — mêmes clés que B pour gold/externe
    (réutilise les .npy déjà calculés). Chaque jeu est encodé UNE fois."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    cle = hashlib.sha1("\x1f".join(e.texte for e in exemples).encode("utf-8")).hexdigest()[:12]
    f = cache_dir / f"{nom}_n{len(exemples)}_{cle}.npy"
    if f.exists():
        return np.load(f)
    X = np.asarray(embed_textes([e.texte for e in exemples]), dtype=np.float32)
    np.save(f, X)
    return X


def _masque_cloud(externe) -> np.ndarray:
    """Vecteur booléen : True = item du test touché par un mot-clé AWS/cloud."""
    return np.array([bool(CLOUD_RE.search(f"{e.titre} {e.description}")) for e in externe])


def _f1(model: EmbeddingLogReg, X: np.ndarray, y: list[str], labels: list[str]) -> float:
    return round(evaluer(y, model.predict_vectors(X), labels).macro_f1, 4)


def construire(train_v2_path: str, gold_path: str, externe_path: str) -> dict:
    # 1) Snapshot train_v2 → base synthétique FIXE (852) + relus réels (50)
    recs = [json.loads(l) for l in open(train_v2_path, encoding="utf-8") if l.strip()]
    base_ex = [_rec_to_exemple(r) for r in recs if r.get("source") == "synthetique"]
    relus_ex = [_rec_to_exemple(r) for r in recs if r.get("source") == "flywheel_relu"]
    n_relus = len(relus_ex)
    if n_relus < max(GRID):
        raise SystemExit(f"train_v2 n'a que {n_relus} relus (< {max(GRID)}) — relance D1.4.")

    # 2) Test GELÉ (gold + externe réel) + sous-test hors-AWS
    gold = load_gold(gold_path)
    externe = load_exemples(externe_path)
    masque_cloud = _masque_cloud(externe)
    idx_hors = np.where(~masque_cloud)[0]

    # 3) Ordre de classes (dynamique) — commun à tous les entraînements/évals
    labels = sorted(
        {e.categorie for e in base_ex} | {e.categorie for e in relus_ex}
        | {e.categorie for e in gold} | {e.categorie for e in externe}
    )

    # 4) Embeddings encodés UNE fois (base, relus, gold, externe)
    cache = Path(CACHE_DIR)
    Xbase = _embed_cache("courbe_base", base_ex, cache)
    Xrelus = _embed_cache("courbe_relus", relus_ex, cache)
    Xg = _embed_cache("gold", gold, cache)
    Xe = _embed_cache("externe", externe, cache)
    ybase = [e.categorie for e in base_ex]
    yg = [e.categorie for e in gold]
    ye = [e.categorie for e in externe]
    Xe_hors, ye_hors = Xe[idx_hors], [ye[i] for i in idx_hors]

    # 5) Modèle ACTIF (référence, base 724 synth — HORS courbe, pour contexte défense)
    actif = EmbeddingLogReg.load(predictors._chemin_modele(), embed_fn=embed_textes)
    f1_actif_reel = _f1(actif, Xe, ye, labels)
    f1_actif_hors = _f1(actif, Xe_hors, ye_hors, labels)

    def _entrainer_evaluer(idx: np.ndarray) -> dict:
        """Porte re-jouée (fail dur) sur ce sous-ensemble → entraînement base+relus → F1."""
        sous = [relus_ex[i] for i in idx]
        etanch = verifier_etancheite(sous, gold, externe) if len(sous) else {
            "jaccard_max_vs_reel": 0.0, "jaccard_max_vs_gold": 0.0
        }
        if len(sous):
            Xtr = np.vstack([Xbase, Xrelus[idx]])
            ytr = ybase + [relus_ex[i].categorie for i in idx]
        else:
            Xtr, ytr = Xbase, ybase
        m = EmbeddingLogReg().fit_vectors(Xtr, ytr)
        return {
            "reel": _f1(m, Xe, ye, labels),
            "reel_hors_aws": _f1(m, Xe_hors, ye_hors, labels),
            "synth": _f1(m, Xg, yg, labels),
            "jaccard_max": max(etanch["jaccard_max_vs_reel"], etanch["jaccard_max_vs_gold"]),
        }

    # 6) Boucle sur la grille — lissage par seeds pour les k intermédiaires
    points = []
    for k in GRID:
        if k == 0:
            tirages = [np.array([], dtype=int)]
        elif k == n_relus:
            tirages = [np.arange(n_relus)]
        else:
            tirages = [
                np.random.default_rng([SEED_MERE, k, s]).choice(n_relus, k, replace=False)
                for s in range(N_SEEDS)
            ]
        mesures = [_entrainer_evaluer(idx) for idx in tirages]
        reel = [m["reel"] for m in mesures]
        hors = [m["reel_hors_aws"] for m in mesures]
        points.append({
            "k": k,
            "n_seeds": len(tirages),
            "reel_moy": round(float(np.mean(reel)), 4),
            "reel_min": round(float(np.min(reel)), 4),
            "reel_max": round(float(np.max(reel)), 4),
            "hors_aws_moy": round(float(np.mean(hors)), 4),
            "hors_aws_min": round(float(np.min(hors)), 4),
            "hors_aws_max": round(float(np.max(hors)), 4),
            "synth_moy": round(float(np.mean([m["synth"] for m in mesures])), 4),
            "jaccard_max": round(float(max(m["jaccard_max"] for m in mesures)), 3),
        })

    # 7) Verdict PRÉ-ENREGISTRÉ sur la pente k=0 → k=50 (test complet)
    d = round(points[-1]["reel_moy"] - points[0]["reel_moy"], 4)
    if d > SEUIL_SOLIDE:
        verdict = f"montée SOLIDE (>+{SEUIL_SOLIDE})"
    elif d >= SEUIL_AMBIGU:
        verdict = f"montée AMBIGUË (+{SEUIL_AMBIGU}..+{SEUIL_SOLIDE})"
    elif d >= -SEUIL_AMBIGU:
        verdict = f"PLAT / nul (|Δ|<{SEUIL_AMBIGU})"
    else:
        verdict = f"DESCENDANT (<−{SEUIL_AMBIGU})"
    d_hors = round(points[-1]["hors_aws_moy"] - points[0]["hors_aws_moy"], 4)

    cloud_items = [
        {"categorie": e.categorie, "titre": e.titre}
        for e, m in zip(externe, masque_cloud) if m
    ]
    return {
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "modele_embedding": config.MODELE_EMBEDDING,
        "base_synthetique_fixe": len(base_ex),
        "relus_disponibles": n_relus,
        "grille_k": GRID,
        "n_seeds_intermediaires": N_SEEDS,
        "test_gele": {"gold": len(gold), "externe_reel": len(externe),
                      "externe_hors_aws": int(len(idx_hors))},
        "actif_reference": {
            "chemin": Path(predictors._chemin_modele()).name,
            "note": "base 724 synth (J5) — HORS courbe, référence contexte seulement",
            "macro_f1_reel": f1_actif_reel,
            "macro_f1_reel_hors_aws": f1_actif_hors,
        },
        "points": points,
        "delta_pente_reel": d,
        "verdict_pre_enregistre": verdict,
        "regle": f"Δ pente > {SEUIL_SOLIDE} solide / {SEUIL_AMBIGU}..{SEUIL_SOLIDE} ambigu / "
                 f"|Δ|<{SEUIL_AMBIGU} plat / <−{SEUIL_AMBIGU} descendant",
        "diagnostic_hors_aws": {
            "delta_pente": d_hors,
            "mots_cles": CLOUD_RE.pattern,
            "n_items_retires": len(cloud_items),
            "items": cloud_items,
            "note": "diagnostic ÉTIQUETÉ — isole l'effet du plafond d'étiquetage AWS, "
                    "PAS le résultat de tête",
        },
        "provenance": {
            "train_v2": Path(train_v2_path).name,
            "sha256_train_v2": hashlib.sha256(Path(train_v2_path).read_bytes()).hexdigest(),
        },
    }


def _figure(rapport: dict, out_png: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    pts = rapport["points"]
    ks = [p["k"] for p in pts]
    reel = [p["reel_moy"] for p in pts]
    reel_lo = [p["reel_min"] for p in pts]
    reel_hi = [p["reel_max"] for p in pts]
    hors = [p["hors_aws_moy"] for p in pts]
    hors_lo = [p["hors_aws_min"] for p in pts]
    hors_hi = [p["hors_aws_max"] for p in pts]

    fig, ax = plt.subplots(figsize=(8.2, 5.2))
    ax.plot(ks, reel, "-o", color="#1f77b4", label="Test réel complet (46)")
    ax.fill_between(ks, reel_lo, reel_hi, color="#1f77b4", alpha=0.15)
    ax.plot(ks, hors, "--s", color="#2ca02c",
            label="Diagnostic — hors AWS/cloud (38)")
    ax.fill_between(ks, hors_lo, hors_hi, color="#2ca02c", alpha=0.12)
    ax.axhline(rapport["actif_reference"]["macro_f1_reel"], color="#999999",
               ls=":", lw=1, label="Actif J5 (base 724, réf.)")

    ax.set_xlabel("Nombre de labels réels ajoutés à la base synthétique fixe (852)")
    ax.set_ylabel("macro-F1 sur le test réel gelé")
    ax.set_title("Courbe d'apprentissage flywheel — effet des labels réels\n"
                 f"verdict pré-enregistré : {rapport['verdict_pre_enregistre']} "
                 f"(Δ={rapport['delta_pente_reel']:+.4f})")
    ax.set_xticks(ks)
    ax.grid(True, alpha=0.3)
    ax.legend(loc="best", fontsize=9)
    fig.tight_layout()
    fig.savefig(out_png, dpi=130)
    plt.close(fig)


def _markdown(rapport: dict) -> str:
    L = []
    L.append("# Flywheel C1 — Courbe d'apprentissage (macro-F1 réel vs #labels réels)\n")
    L.append(f"_Généré le {rapport['genere_le']}. Embeddings : `{rapport['modele_embedding']}`._\n")
    L.append("## Protocole\n")
    L.append(f"- **Base synthétique FIXE** : {rapport['base_synthetique_fixe']} exemples "
             "(identique à tous les points → seuls les labels réels varient ; règle le "
             "confond de B).")
    t = rapport["test_gele"]
    L.append(f"- **Test GELÉ** : gold {t['gold']} + externe réel {t['externe_reel']} "
             f"(métrique de tête = macro-F1 sur l'externe réel).")
    L.append(f"- **Lissage** : {rapport['n_seeds_intermediaires']} tirages/k pour "
             "k∈{10,20,30,40} → moyenne + bande min/max ; k=0 et k=50 déterministes.")
    L.append("- **Porte d'étanchéité re-jouée** (fail dur) sur chaque sous-ensemble avant "
             "entraînement.\n")
    L.append("## Règle d'interprétation PRÉ-ENREGISTRÉE\n")
    L.append(f"`{rapport['regle']}` — fixée AVANT de voir les chiffres.\n")
    L.append("## Résultats\n")
    L.append("| k labels | seeds | macro-F1 réel (moy) | min–max | hors-AWS (moy) | synth (moy) | Jaccard max |")
    L.append("|---:|---:|---:|:---:|---:|---:|---:|")
    for p in rapport["points"]:
        L.append(f"| {p['k']} | {p['n_seeds']} | **{p['reel_moy']}** | "
                 f"{p['reel_min']}–{p['reel_max']} | {p['hors_aws_moy']} | "
                 f"{p['synth_moy']} | {p['jaccard_max']} |")
    a = rapport["actif_reference"]
    L.append(f"\n_Référence (hors courbe) — modèle actif J5 `{a['chemin']}` (base 724 synth) : "
             f"macro-F1 réel **{a['macro_f1_reel']}**, hors-AWS {a['macro_f1_reel_hors_aws']}._\n")
    L.append("## Verdict\n")
    L.append(f"- Pente k=0 → k=50 (test complet) : **Δ = {rapport['delta_pente_reel']:+.4f}** "
             f"→ **{rapport['verdict_pre_enregistre']}**.")
    dg = rapport["diagnostic_hors_aws"]
    L.append(f"- Diagnostic hors-AWS : Δ = {dg['delta_pente']:+.4f} sur le test privé des "
             f"{dg['n_items_retires']} items AWS/cloud.\n")
    L.append("## Diagnostic hors-AWS — items retirés (étiquetés, PAS le résultat de tête)\n")
    L.append(f"Mots-clés fixes : `{dg['mots_cles']}`. {dg['note']}.\n")
    L.append("| catégorie gold | titre |")
    L.append("|:--|:--|")
    for it in dg["items"]:
        L.append(f"| {it['categorie']} | {it['titre']} |")
    L.append("\n> Ces 8 items « AWS/cloud » portent des labels gold **incohérents** entre eux "
             "(Accès / Réseau / Logiciel pour un sujet quasi identique). Ce bruit d'étiquetage "
             "du TEST plafonne mécaniquement tout gain mesurable — la courbe complète le "
             "reflète honnêtement ; la courbe diagnostique l'isole sans le contourner.\n")
    pr = rapport["provenance"]
    L.append(f"---\n_Provenance : `{pr['train_v2']}` (sha256 `{pr['sha256_train_v2'][:16]}…`)._")
    return "\n".join(L)


def _afficher(rapport: dict) -> None:
    print("\n=== Flywheel C1 — Courbe d'apprentissage ===")
    print(f"base synth FIXE {rapport['base_synthetique_fixe']}  |  relus {rapport['relus_disponibles']}  |  "
          f"test gelé gold {rapport['test_gele']['gold']} + externe {rapport['test_gele']['externe_reel']}")
    print(f"{'k':>4}{'seeds':>7}{'F1 réel moy':>14}{'min-max':>16}{'hors-AWS moy':>14}{'synth moy':>12}")
    for p in rapport["points"]:
        print(f"{p['k']:>4}{p['n_seeds']:>7}{p['reel_moy']:>14}"
              f"{p['reel_min']:>8}-{p['reel_max']:<7}{p['hors_aws_moy']:>14}{p['synth_moy']:>12}")
    a = rapport["actif_reference"]
    print(f"réf. actif J5 (base 724, hors courbe) : réel {a['macro_f1_reel']}  hors-AWS {a['macro_f1_reel_hors_aws']}")
    print(f"Δ pente k0→k50 (complet) : {rapport['delta_pente_reel']:+.4f}  →  {rapport['verdict_pre_enregistre']}")
    print(f"Δ pente hors-AWS         : {rapport['diagnostic_hors_aws']['delta_pente']:+.4f}\n")


def run(args: argparse.Namespace) -> int:
    train_v2 = args.train_v2
    if train_v2 is None:
        trouve = sorted(glob.glob(TRAIN_V2_GLOB))
        if not trouve:
            raise SystemExit(f"Snapshot train_v2 introuvable ({TRAIN_V2_GLOB}) — lance D1.4.")
        train_v2 = trouve[-1]

    rapport = construire(train_v2, args.gold, args.externe)

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "courbe.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=2), encoding="utf-8")
    (out / "courbe.md").write_text(_markdown(rapport), encoding="utf-8")
    _figure(rapport, out / "courbe_apprentissage.png")

    _afficher(rapport)
    print(f"écrit : {out / 'courbe.json'}")
    print(f"écrit : {out / 'courbe.md'}")
    print(f"écrit : {out / 'courbe_apprentissage.png'}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Courbe d'apprentissage flywheel (C1).")
    p.add_argument("--train-v2", default=None)
    p.add_argument("--gold", default=GOLD_DEFAUT)
    p.add_argument("--externe", default=EXTERNE_DEFAUT)
    p.add_argument("--out-dir", default=OUT_DIR)
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
