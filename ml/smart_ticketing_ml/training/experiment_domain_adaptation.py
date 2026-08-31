"""
J5+ — Expérience d'ADAPTATION DE DOMAINE : ajouter du RÉEL à l'entraînement aide-t-il
le transfert synthétique→réel ?

Deux axes, comparés sur les MÊMES jeux de test intouchés (gold synthétique 102 +
validation externe réelle 46), métrique de tête = macro-F1, colonne clé = écart.

  AXE 1 — réel à l'entraînement : train synthétique (724 train') + réel Kaggle (242,
          étiquettes auto ~73/87 %, étanchéité J≥0.5 vs les 46 du test).
  AXE 2 — réglages (sur le DEV synthétique UNIQUEMENT, jamais gold/externe) :
          class_weight ∈ {None, balanced} × C ∈ {0.1, 0.3, 1.0}, sélection au dev.

Quatre configurations :
  (réf)    synth seul, LogReg défaut (C=1.0)              → doit retrouver J5 (réel 0.438)
  (AXE1)   synth + réel, LogReg défaut
  (AXE2)   synth seul, meilleurs (C, class_weight) au dev
  (AXE1+2) synth + réel, meilleurs (C, class_weight) au dev

RÈGLE D'INTERPRÉTATION **pré-enregistrée** (avant de voir les résultats) — gain réel =
macro-F1 réel(config) − macro-F1 réel(réf) :
  > +0.05  → effet solide malgré le bruit d'étiquetage → AXE1 = production + section adaptation
  +0.02..+0.05 → ambigu (bruit plausible) → perspective, production inchangée
  < +0.02 ou négatif → pas d'effet exploitable → J5 conservé, AXE1 en perspective

Le modèle NON calibré reste la règle (cf. `classifier.py` : calibration ne transfère pas).

Usage (depuis `ml/`) :
    python -m smart_ticketing_ml.training.experiment_domain_adaptation
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.linear_model import LogisticRegression

from ..eval.dataset import assert_disjoint, load_exemples, load_gold, load_train
from ..eval.metrics import evaluer
from ..eval.report import _ordre_labels
from ..service import config
from .train_classifier import SEED, embed_cache
from sklearn.model_selection import train_test_split

# Bandes de décision pré-enregistrées (gain macro-F1 réel vs référence).
SEUIL_SOLIDE = 0.05
SEUIL_AMBIGU = 0.02

GRILLE_C = [0.1, 0.3, 1.0]
GRILLE_CW = [None, "balanced"]


def _fit(X, y, C: float, class_weight):
    return LogisticRegression(
        max_iter=2000, C=C, class_weight=class_weight, random_state=SEED
    ).fit(X, y)


def _selection_dev(Xfit, yfit, Xdev, ydev, labels) -> tuple[dict, float, list[dict]]:
    """Grille class_weight × C, sélection au macro-F1 sur le DEV (synthétique).

    Dev synthétique = sélecteur imparfait (souvent saturé) mais SEUL légitime.
    Départage des ex æquo : C plus bas (plus régularisé) puis class_weight='balanced'.
    """
    table: list[dict] = []
    for cw in GRILLE_CW:
        for C in GRILLE_C:
            m = _fit(Xfit, yfit, C, cw)
            f1 = evaluer(list(ydev), list(m.predict(Xdev)), labels).macro_f1
            table.append({"C": C, "class_weight": cw or "none", "dev_macro_f1": round(f1, 4)})
    # tri : macro-F1 dev desc, puis C asc (régularisation), puis balanced d'abord
    best = max(table, key=lambda r: (r["dev_macro_f1"], -r["C"], r["class_weight"] == "balanced"))
    params = {"C": best["C"], "class_weight": None if best["class_weight"] == "none" else "balanced"}
    return params, best["dev_macro_f1"], table


def _evalue(model, Xg, yg, Xe, ye, labels) -> dict:
    rg = evaluer(list(yg), list(model.predict(Xg)), labels)
    re_ = evaluer(list(ye), list(model.predict(Xe)), labels)
    return {"f1_synth": rg.macro_f1, "f1_reel": re_.macro_f1,
            "ecart": rg.macro_f1 - re_.macro_f1,
            "acc_synth": rg.accuracy, "acc_reel": re_.accuracy}


def _bande(gain: float) -> str:
    if gain > SEUIL_SOLIDE:
        return "SOLIDE (>+0.05) → AXE1 = production + section adaptation de domaine"
    if gain >= SEUIL_AMBIGU:
        return "AMBIGU (+0.02..+0.05) → perspective, production inchangée"
    return "NUL/NÉGATIF (<+0.02) → J5 conservé, AXE1 en perspective"


def run(args: argparse.Namespace) -> int:
    try:
        train = load_train(args.train)
        gold = load_gold(args.gold)
        externe = load_exemples(args.externe)
        reel = load_exemples(args.reel)
    except FileNotFoundError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    labels = _ordre_labels(train + gold + externe + reel)

    # Étanchéité du réel d'entraînement vs LES DEUX jeux de test (fail dur sur exact).
    try:
        v_re = assert_disjoint(reel, externe)   # réel-train vs 46 test réel
        v_rg = assert_disjoint(reel, gold)       # réel-train vs gold synthétique
    except RuntimeError as exc:
        print(f"❌ ÉTANCHÉITÉ : {exc}", file=sys.stderr)
        return 2

    cache = Path(args.cache_dir)
    Xtr = embed_cache("train", train, cache)
    Xg = embed_cache("gold", gold, cache)
    Xe = embed_cache("externe", externe, cache)
    Xr = embed_cache("real_kaggle", reel, cache)
    ytr = np.array([e.categorie for e in train])
    yr = np.array([e.categorie for e in reel])
    yg = [e.categorie for e in gold]
    ye = [e.categorie for e in externe]

    # Split dev synthétique — identique à J5 (gold/externe jamais touchés).
    Xtr_fit, Xdev, ytr_fit, ydev = train_test_split(
        Xtr, ytr, test_size=args.dev_size, stratify=ytr, random_state=SEED)

    # Jeux d'entraînement : synth seul vs synth + réel.
    Xsr = np.vstack([Xtr_fit, Xr])
    ysr = np.concatenate([ytr_fit, yr])

    # AXE2 : sélection d'hyperparamètres au dev, pour chaque jeu d'entraînement.
    params_synth, dev_synth, grille_synth = _selection_dev(Xtr_fit, ytr_fit, Xdev, ydev, labels)
    params_sr, dev_sr, grille_sr = _selection_dev(Xsr, ysr, Xdev, ydev, labels)

    # Quatre configurations.
    ref = _fit(Xtr_fit, ytr_fit, 1.0, None)
    axe1 = _fit(Xsr, ysr, 1.0, None)
    axe2 = _fit(Xtr_fit, ytr_fit, **params_synth)
    axe12 = _fit(Xsr, ysr, **params_sr)

    configs = [
        ("Référence J5 (synth, C=1.0)", ref, "synthétique 724", {"C": 1.0, "class_weight": None}),
        ("AXE1 (synth + réel)", axe1, "synth 724 + réel 242", {"C": 1.0, "class_weight": None}),
        (f"AXE2 (synth, {_p(params_synth)})", axe2, "synthétique 724", params_synth),
        (f"AXE1+2 (synth + réel, {_p(params_sr)})", axe12, "synth 724 + réel 242", params_sr),
    ]

    rows = []
    ref_reel = None
    for nom, m, entrainement, params in configs:
        res = _evalue(m, Xg, yg, Xe, ye, labels)
        if ref_reel is None:
            ref_reel = res["f1_reel"]
        res.update({"config": nom, "entrainement": entrainement, "params": params,
                    "gain_reel": round(res["f1_reel"] - ref_reel, 4)})
        rows.append(res)

    gain_axe1 = rows[1]["gain_reel"]
    gain_axe12 = rows[3]["gain_reel"]
    verdict = _bande(gain_axe1)

    # ── Sorties ────────────────────────────────────────────────────────────
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    payload = {
        "jalon": "J5+ (adaptation de domaine)",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "seed": SEED, "embedding_modele": config.MODELE_EMBEDDING,
        "n_train_synth": len(train), "n_train_fit": len(ytr_fit), "n_dev": len(ydev),
        "n_reel_ajoute": len(reel), "n_gold": len(gold), "n_externe": len(externe),
        "etancheite_reel": {
            "vs_externe_exact": len(v_re.fuites_exactes), "vs_externe_approx": len(v_re.proches),
            "vs_gold_exact": len(v_rg.fuites_exactes), "vs_gold_approx": len(v_rg.proches),
        },
        "regle_preenregistree": {"solide": f">+{SEUIL_SOLIDE}", "ambigu": f"+{SEUIL_AMBIGU}..+{SEUIL_SOLIDE}",
                                 "nul": f"<+{SEUIL_AMBIGU}"},
        "selection_dev": {"synth": {"params": params_synth, "dev_macro_f1": dev_synth, "grille": grille_synth},
                          "synth_reel": {"params": params_sr, "dev_macro_f1": dev_sr, "grille": grille_sr}},
        "resultats": rows,
        "gain_reel_axe1": gain_axe1, "gain_reel_axe1_2": gain_axe12,
        "verdict": verdict,
    }

    dated = Path(args.out_dir) / f"j5_adaptation_{stamp}"
    ref_dir = Path("eval/reports") / args.reference if args.reference else None
    for dest in filter(None, [dated, ref_dir]):
        dest.mkdir(parents=True, exist_ok=True)
        _figure(rows, dest / "adaptation_bars.png")
        (dest / "adaptation.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        (dest / "adaptation.md").write_text(_markdown(payload), encoding="utf-8")

    # Console.
    print("── Adaptation de domaine — macro-F1 (métrique de tête) ──────────────")
    print(f"  {'config':<40} {'synth':>7} {'réel':>7} {'écart':>7} {'Δréel':>7}")
    for r in rows:
        print(f"  {r['config']:<40} {r['f1_synth']:>7.3f} {r['f1_reel']:>7.3f} "
              f"{r['ecart']:>7.3f} {r['gain_reel']:>+7.3f}")
    print("── Étanchéité réel-train ────────────────────────────────────────────")
    print(f"  vs externe : exact={len(v_re.fuites_exactes)} approx={len(v_re.proches)}  |  "
          f"vs gold : exact={len(v_rg.fuites_exactes)} approx={len(v_rg.proches)}")
    print("── Verdict (règle pré-enregistrée) ──────────────────────────────────")
    print(f"  gain réel AXE1 = {gain_axe1:+.3f}  |  AXE1+2 = {gain_axe12:+.3f}")
    print(f"  → {verdict}")
    print(f"  rapport → {(ref_dir or dated) / 'adaptation.md'}")
    return 0


def _p(params: dict) -> str:
    cw = params["class_weight"] or "none"
    return f"C={params['C']}, cw={cw}"


def _figure(rows: list[dict], path: Path) -> None:
    noms = [r["config"].split(" (")[0] for r in rows]
    fs = [r["f1_synth"] for r in rows]
    fr = [r["f1_reel"] for r in rows]
    y = np.arange(len(noms))
    h = 0.38
    fig, ax = plt.subplots(figsize=(9, 0.8 * len(noms) + 1))
    ax.barh(y + h / 2, fs, h, label="Gold synthétique", color="#94a3b8")
    ax.barh(y - h / 2, fr, h, label="Validation externe réelle", color="#2563eb")
    ax.set_yticks(y, noms)
    ax.invert_yaxis()
    ax.set_xlim(0, 1)
    ax.set_xlabel("macro-F1")
    ax.set_title("Adaptation de domaine : ajout de réel + réglages (J5+)")
    ax.legend(loc="lower right")
    ax.grid(axis="x", alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def _markdown(p: dict) -> str:
    L = ["# J5+ — Adaptation de domaine (réel à l'entraînement + réglages)\n"]
    L.append(f"- **Date** : {p['date']}  |  **Seed** : {p['seed']}  |  "
             f"**Embeddings** : `{p['embedding_modele']}`")
    L.append(f"- **Train synth.** : {p['n_train_synth']} → {p['n_train_fit']} train' / {p['n_dev']} dev  |  "
             f"**Réel ajouté** : {p['n_reel_ajoute']}  |  Test : gold {p['n_gold']} + externe {p['n_externe']}")
    e = p["etancheite_reel"]
    L.append(f"- **Étanchéité réel-train** — vs externe : exact **{e['vs_externe_exact']}** / approx {e['vs_externe_approx']} · "
             f"vs gold : exact **{e['vs_gold_exact']}** / approx {e['vs_gold_approx']}\n")

    L.append("## Règle d'interprétation (pré-enregistrée, avant résultats)\n")
    L.append(f"- gain réel **> +{SEUIL_SOLIDE}** → effet solide → AXE1 production + section adaptation")
    L.append(f"- **+{SEUIL_AMBIGU} .. +{SEUIL_SOLIDE}** → ambigu → perspective, production inchangée")
    L.append(f"- **< +{SEUIL_AMBIGU}** ou négatif → pas d'effet exploitable → J5 conservé\n")

    L.append("## Tableau comparatif — macro-F1\n")
    L.append("| Configuration | Entraînement | Gold synth. | Externe réel | écart | Δréel vs réf. |")
    L.append("|---|---|---|---|---|---|")
    for r in p["resultats"]:
        L.append(f"| {r['config']} | {r['entrainement']} | {r['f1_synth']:.3f} | "
                 f"{r['f1_reel']:.3f} | {r['ecart']:.3f} | {r['gain_reel']:+.3f} |")
    L.append("\n![Adaptation](adaptation_bars.png)\n")

    s = p["selection_dev"]
    L.append("## Sélection d'hyperparamètres au dev synthétique (AXE2)\n")
    L.append(f"- **synth seul** → {_p(s['synth']['params'])} (dev macro-F1 {s['synth']['dev_macro_f1']:.3f})")
    L.append(f"- **synth + réel** → {_p(s['synth_reel']['params'])} (dev macro-F1 {s['synth_reel']['dev_macro_f1']:.3f})")
    L.append("\n_Dev synthétique = sélecteur imparfait (souvent saturé), mais seul légitime "
             "(gold/externe = test pur)._\n")

    L.append("## Verdict\n")
    L.append(f"- **gain réel AXE1** = **{p['gain_reel_axe1']:+.3f}**  |  AXE1+2 = {p['gain_reel_axe1_2']:+.3f}")
    L.append(f"- **{p['verdict']}**\n")
    L.append("> Étiquetage réel : automatique (entités + tags + mots-clés), qualité mesurée par "
             "spot-check r1 53/70 % → r2 (après corrections) **73/87 %**. Erreur résiduelle : les "
             "tags `Account*` sur-déclenchent `Accès` sur cloud/facturation (corrigeable, non corrigée "
             "— itération unique convenue). Étanchéité renforcée Jaccard **0.5** (< 0.6 standard), "
             "justif. : source commune train/test.")
    return "\n".join(L) + "\n"


def main() -> int:
    p = argparse.ArgumentParser(description="Expérience d'adaptation de domaine (réel à l'entraînement + réglages).")
    p.add_argument("--train", default=None)
    p.add_argument("--gold", default="gold/gold.jsonl")
    p.add_argument("--externe", default="gold/validation_externe.jsonl")
    p.add_argument("--reel", default="real/real_train_kaggle.jsonl")
    p.add_argument("--dev-size", type=float, default=0.15)
    p.add_argument("--out-dir", default="artifacts/eval")
    p.add_argument("--cache-dir", default="artifacts/eval/j5_cache")
    p.add_argument("--reference", default="j5_adaptation")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
