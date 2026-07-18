"""
J5 — Gel du classifieur + rapport de référence (le comparatif synthétique→réel,
niveau classification + calibration + abstention).

Ce que fait le script (tout via le harnais `eval/`, aucune duplication de métrique) :
  1. charge train + gold synthétique + validation externe réelle, vérifie l'étanchéité ;
  2. embeddings `bge-m3` (source unique = `service.embedder`), mis en cache `.npy` ;
  3. **split dev stratifié** (~15 %) depuis le train — le gold et l'externe restent
     du TEST PUR (règle d'or : on ne mesure jamais sur ce qui a servi à régler) ;
  4. entraîne l'échelle : majoritaire, TF-IDF+SVM (réf. J3), SVM-embeddings (contrôle),
     **LogReg-embeddings (le choix)**, + LogReg+Platt et LogReg+isotonique (preuve de
     calibration, calibrées sur le dev) ;
  5. évalue sur les deux jeux → macro-F1 + **écart** ; ECE + reliability diagram ;
     courbe couverture/précision d'**abstention** (seuil réglé sur dev) ;
  6. **fige le modèle de production = LogReg NON calibrée** (joblib + manifeste) —
     cf. `classifier.py` pour la justification du non-transfert de la calibration ;
  7. écrit le rapport versionné `ml/eval/reports/j5/` (+ copie datée `artifacts/eval/`).

Usage (depuis `ml/`) :
    python -m smart_ticketing_ml.training.train_classifier
    python -m smart_ticketing_ml.training.train_classifier --reference j5
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.svm import LinearSVC

from ..service import config
from ..service.embedder import embed_textes
from .classifier import EmbeddingLogReg, couverture_precision

# Le harnais : réutilisé tel quel (métriques) + fonctions de figure.
from ..eval import baselines as bl
from ..eval.dataset import (
    Exemple,
    assert_disjoint,
    load_exemples,
    load_gold,
    load_train,
)
from ..eval.metrics import confiances_correct, courbe_fiabilite, ece, evaluer
from ..eval.report import _ordre_labels, _plot_confusion, _slug, plot_reliability

SEED = 42
CIBLE_PRECISION = 0.80  # cible d'abstention (§7/§8) — précision visée sur le couvert


# ── Embeddings avec cache (même schéma que le notebook d'exploration) ────────
def _cle(exemples: list[Exemple]) -> str:
    h = hashlib.sha1("\x1f".join(e.texte for e in exemples).encode("utf-8")).hexdigest()[:12]
    return f"n{len(exemples)}_{h}"


def embed_cache(nom: str, exemples: list[Exemple], cache_dir: Path) -> np.ndarray:
    cache_dir.mkdir(parents=True, exist_ok=True)
    f = cache_dir / f"{nom}_{_cle(exemples)}.npy"
    if f.exists():
        return np.load(f)
    t = time.perf_counter()
    X = np.asarray(embed_textes([e.texte for e in exemples]), dtype=np.float32)
    np.save(f, X)
    print(f"  embed {nom:8}: {X.shape} en {time.perf_counter() - t:.1f}s", file=sys.stderr)
    return X


# ── Rapport ──────────────────────────────────────────────────────────────────
def _fig_confusion(res_gold, res_ext, dest: Path, prefix: str) -> dict[str, str]:
    figs = {}
    for res, jeu in [(res_gold, "Gold synthétique"), (res_ext, "Validation externe réelle")]:
        fname = f"{prefix}_confusion_{_slug(jeu)}.png"
        _plot_confusion(res, dest / fname, f"LogReg-embeddings · {jeu}")
        figs[jeu] = fname
    return figs


def _fig_reliability(courbes_ext, courbes_gold, dest: Path, prefix: str) -> dict[str, str]:
    figs = {}
    for courbes, jeu in [(courbes_ext, "Validation externe réelle"), (courbes_gold, "Gold synthétique")]:
        fname = f"{prefix}_reliability_{_slug(jeu)}.png"
        plot_reliability(courbes, dest / fname, f"Reliability diagram — {jeu}")
        figs[jeu] = fname
    return figs


def _fig_abstention(grille, covs, precs, point, dest: Path, prefix: str) -> str:
    fname = f"{prefix}_abstention_externe.png"
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.plot(covs, precs, "o-", color="#2563eb")
    ax.axhline(CIBLE_PRECISION, ls="--", color="gray", label=f"cible précision {CIBLE_PRECISION:.0%}")
    ax.scatter([point[0]], [point[1]], color="red", zorder=5, label=f"seuil dev={point[2]:.2f}")
    ax.set_xlabel("couverture")
    ax.set_ylabel("précision sur le couvert")
    ax.set_title("Abstention — compromis couverture/précision (externe réel)")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(dest / fname, dpi=120)
    plt.close(fig)
    return fname


def _markdown(payload: dict, figs: dict) -> str:
    m = payload["meta"]
    L: list[str] = []
    L.append("# Harnais d'évaluation — J5 (classification embeddings + calibration)\n")
    L.append(f"- **Date** : {m['date']}  |  **Seed** : {m['seed']}  |  "
             f"**Embeddings** : `{m['embedding_modele']}` ({config.DIMENSION}d, device {m['device']})")
    L.append(f"- **Train** : {m['n_train']} tickets → split dev stratifié "
             f"**{m['n_train_fit']} train' / {m['n_dev']} dev** (test_size={m['dev_size']})")
    L.append(f"- **Gold synthétique** : {m['n_gold']} · **Validation externe réelle** : {m['n_externe']}")
    L.append("- **Modèle de production figé** : **LogReg-embeddings NON calibrée** "
             "(la calibration sur dev synthétique ne transfère pas — voir §Calibration).\n")

    # Étanchéité
    L.append("## Étanchéité train / jeux d'éval (règle d'or)\n")
    for jeu, v in payload["etancheite"].items():
        ok = "✅" if v["exactes"] == 0 else "❌"
        L.append(f"- **{jeu}** — fuites exactes : **{v['exactes']}** {ok} · "
                 f"chevauchements approx. (Jaccard ≥ {v['seuil']}) : **{v['approx']}**")
    L.append("")

    # Tableau d'écart
    L.append("## Écart synthétique → réel — macro-F1 (métrique de tête)\n")
    L.append("| Modèle | Gold synth. | Externe réel | **écart** | acc réel |")
    L.append("|---|---|---|---|---|")
    for r in payload["gap"]:
        L.append(f"| {r['modele']} | {r['f1_synth']:.3f} | {r['f1_reel']:.3f} "
                 f"| **{r['ecart']:.3f}** | {r['acc_reel']:.3f} |")
    L.append("\n> **Cible J5** : réduire l'écart (réf. TF-IDF+SVM = 0,556), en remontant "
             "le réel via le sémantique multilingue. Le synthétique reste un plafond trompeur.\n")

    # Par classe (réel)
    L.append("## Détail par classe — LogReg-embeddings · Validation externe réelle\n")
    L.append("| Catégorie | P | R | F1 | support |")
    L.append("|---|---|---|---|---|")
    pc = payload["par_classe_reel"]
    for lab in pc["labels"]:
        c = pc["par_classe"][lab]
        L.append(f"| {lab} | {c['precision']:.3f} | {c['recall']:.3f} | {c['f1']:.3f} | {c['support']} |")
    L.append("")

    # Calibration
    L.append("## Calibration — ECE (la calibration synthétique ne transfère pas)\n")
    L.append("| Variante | ECE synth. | ECE réel |")
    L.append("|---|---|---|")
    for r in payload["ece"]:
        L.append(f"| {r['variante']} | {r['ece_synth']:.3f} | {r['ece_reel']:.3f} |")
    L.append("\n_Calibrer sur le dev **synthétique** améliore l'ECE synthétique mais **dégrade** "
             "l'ECE réel : la variante **non calibrée** est la mieux calibrée sur le vrai. "
             "→ modèle de production non calibré ; vraie calibration = flywheel J9 (dev réel)._\n")
    for jeu, f in figs["reliability"].items():
        L.append(f"![Reliability {jeu}]({f})\n")

    # Abstention
    a = payload["abstention"]
    L.append("## Abstention — seuil réglé sur dev, appliqué au test\n")
    L.append(f"- Seuil qui atteint précision ≥ {CIBLE_PRECISION:.0%} **sur le dev** : "
             f"**{a['seuil']:.3f}** (dev : couverture {a['cov_dev']:.0%}, précision {a['prec_dev']:.0%}).")
    L.append(f"- Appliqué au **gold synth.** : couverture {a['cov_gold']:.0%}, précision {a['prec_gold']:.0%}.")
    L.append(f"- Appliqué à l'**externe réel** : couverture {a['cov_ext']:.0%}, précision {a['prec_ext']:.0%}.")
    L.append(f"\n_Le dev synthétique est trop facile (précision {a['prec_dev']:.0%}) → le seuil "
             "descend au plancher → **~0 abstention utile** sur le réel. Le mécanisme existe "
             "(§6.5, seuil admin paramétrable) mais **n'est pas figé** : son réglage exige un "
             "dev réel (J9)._\n")
    L.append(f"![Abstention externe]({figs['abstention']})\n")

    # Confusion
    L.append("## Matrices de confusion — LogReg-embeddings\n")
    for jeu, f in figs["confusion"].items():
        L.append(f"### {jeu}\n\n![Confusion {jeu}]({f})\n")

    # Fil rouge
    L.append("---")
    L.append("## Fil rouge — la limite synthétique→réel se propage à trois niveaux\n")
    L.append("1. **Classification** (J3) : 0,944 → 0,388.")
    L.append("2. **Calibration** (J5) : calibrer sur synthétique dégrade l'ECE réel "
             f"({payload['ece'][0]['ece_reel']:.3f} → {payload['ece'][1]['ece_reel']:.3f}).")
    L.append("3. **Abstention** (J5) : un seuil réglé sur synthétique = ~0 abstention utile sur le réel.\n")
    L.append("Les embeddings sémantiques **réduisent** l'écart de classification "
             "(0,556 → " + f"{payload['gap_logreg']['ecart']:.3f}" + ", accuracy réelle "
             "0,391 → " + f"{payload['gap_logreg']['acc_reel']:.3f}" + ", repasse au-dessus du "
             "plancher) mais **ne le comblent pas**. Enseignement central : le corpus synthétique "
             "est un plafond trompeur à tous les niveaux ; seul le flywheel sur données réelles "
             "(J9) peut combler l'écart.\n")
    L.append("_À venir : retrieval Recall@k/nDCG (J6), priorité kappa pondéré (J7), abstention "
             "calibrée sur dev réel (J8/J9)._")
    return "\n".join(L) + "\n"


def _ecrire(dest: Path, prefix: str, payload: dict,
            res_gold, res_ext, courbes_ext, courbes_gold, absten) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    figs = {
        "confusion": _fig_confusion(res_gold, res_ext, dest, prefix),
        "reliability": _fig_reliability(courbes_ext, courbes_gold, dest, prefix),
        "abstention": _fig_abstention(*absten, dest, prefix),
    }
    (dest / f"{prefix}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md = dest / f"{prefix}.md"
    md.write_text(_markdown(payload, figs), encoding="utf-8")
    return md


# ── Orchestration ─────────────────────────────────────────────────────────────
def run(args: argparse.Namespace) -> int:
    try:
        train = load_train(args.train)
        gold = load_gold(args.gold)
        externe = load_exemples(args.externe) if Path(args.externe).exists() else []
    except FileNotFoundError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1
    if not externe:
        print(f"❌ Validation externe requise en J5 ({args.externe}).", file=sys.stderr)
        return 1

    # Étanchéité (fail dur sur fuite exacte).
    try:
        v_gold = assert_disjoint(train, gold)
        v_ext = assert_disjoint(train, externe)
    except RuntimeError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 2

    labels = _ordre_labels(train + gold + externe)
    cache = Path(args.cache_dir)
    Xtr = embed_cache("train", train, cache)
    Xg = embed_cache("gold", gold, cache)
    Xe = embed_cache("externe", externe, cache)
    ytr = np.array([e.categorie for e in train])
    yg = [e.categorie for e in gold]
    ye = [e.categorie for e in externe]

    # Split dev stratifié — gold/externe jamais touchés.
    Xtr_fit, Xdev, ytr_fit, ydev = train_test_split(
        Xtr, ytr, test_size=args.dev_size, stratify=ytr, random_state=SEED)

    # Production : LogReg NON calibrée, sur train'.
    prod = EmbeddingLogReg().fit_vectors(Xtr_fit, ytr_fit)

    # Preuve de calibration : Platt / isotonique calibrées sur le dev (cv=prefit).
    cal_sig = CalibratedClassifierCV(prod.estimateur, method="sigmoid", cv="prefit").fit(Xdev, ydev)
    cal_iso = CalibratedClassifierCV(prod.estimateur, method="isotonic", cv="prefit").fit(Xdev, ydev)

    # Contrôle + baselines J3 (texte brut, sur tout le train comme en J3).
    svm_emb = LinearSVC(random_state=SEED, dual=True).fit(Xtr_fit, ytr_fit)  # dual : 1024d > n
    Xtr_text = [e.texte for e in train]
    maj = bl.Majoritaire().fit(Xtr_text, list(ytr))
    tfidf = bl.TfidfSvm().fit(Xtr_text, list(ytr))
    gold_text, ext_text = [e.texte for e in gold], [e.texte for e in externe]

    # Échelle de prédictions (gold, externe).
    ladder = [
        ("Classe majoritaire (plancher)", maj.predict(gold_text), maj.predict(ext_text)),
        ("TF-IDF + SVM (J3, réf.)", tfidf.predict(gold_text), tfidf.predict(ext_text)),
        ("SVM-embeddings (contrôle)", list(svm_emb.predict(Xg)), list(svm_emb.predict(Xe))),
        (EmbeddingLogReg.nom, prod.predict_vectors(Xg), prod.predict_vectors(Xe)),
        ("LogReg + Platt (preuve)", list(cal_sig.predict(Xg)), list(cal_sig.predict(Xe))),
        ("LogReg + isotonique (preuve)", list(cal_iso.predict(Xg)), list(cal_iso.predict(Xe))),
    ]
    gap = []
    res_gold_lr = res_ext_lr = None
    for nom, pg, pe in ladder:
        rg, re_ = evaluer(yg, pg, labels), evaluer(ye, pe, labels)
        gap.append({"modele": nom, "f1_synth": rg.macro_f1, "f1_reel": re_.macro_f1,
                    "ecart": rg.macro_f1 - re_.macro_f1,
                    "acc_synth": rg.accuracy, "acc_reel": re_.accuracy})
        if nom == EmbeddingLogReg.nom:
            res_gold_lr, res_ext_lr = rg, re_

    # ECE + reliability (non calibré vs Platt vs isotonique).
    variantes = [
        ("Non calibré", prod.predict_proba_vectors(Xg), prod.predict_proba_vectors(Xe), prod.classes_),
        ("Platt", cal_sig.predict_proba(Xg), cal_sig.predict_proba(Xe), list(cal_sig.classes_)),
        ("Isotonique", cal_iso.predict_proba(Xg), cal_iso.predict_proba(Xe), list(cal_iso.classes_)),
    ]
    ece_rows, courbes_gold, courbes_ext = [], {}, {}
    for nom, pg, pe, cls in variantes:
        cg, corg = confiances_correct(pg, cls, yg)
        ceh, core = confiances_correct(pe, cls, ye)
        e_s, e_r = ece(cg, corg), ece(ceh, core)
        ece_rows.append({"variante": nom, "ece_synth": round(e_s, 4), "ece_reel": round(e_r, 4)})
        xg, ag, _ = courbe_fiabilite(cg, corg)
        xe, ae, _ = courbe_fiabilite(ceh, core)
        courbes_gold[nom] = (xg, ag, e_s)
        courbes_ext[nom] = (xe, ae, e_r)

    # Abstention : seuil réglé sur dev (proba de production, non calibrée).
    pdev = prod.predict_proba_vectors(Xdev)
    grille = np.linspace(0.30, 0.95, 66)
    seuil = None
    for s in grille:
        cov, prec = couverture_precision(pdev, prod.classes_, list(ydev), s)
        if cov > 0 and prec >= CIBLE_PRECISION:
            seuil = float(s)
            break
    seuil = seuil if seuil is not None else 0.5
    cov_dev, prec_dev = couverture_precision(pdev, prod.classes_, list(ydev), seuil)
    cov_g, prec_g = couverture_precision(prod.predict_proba_vectors(Xg), prod.classes_, yg, seuil)
    cov_e, prec_e = couverture_precision(prod.predict_proba_vectors(Xe), prod.classes_, ye, seuil)
    pe_all = prod.predict_proba_vectors(Xe)
    covs = [couverture_precision(pe_all, prod.classes_, ye, s)[0] for s in grille]
    precs = [couverture_precision(pe_all, prod.classes_, ye, s)[1] for s in grille]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    gap_lr = next(r for r in gap if r["modele"] == EmbeddingLogReg.nom)
    payload = {
        "meta": {
            "jalon": "J5",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "seed": SEED, "embedding_modele": config.MODELE_EMBEDDING, "device": config.DEVICE,
            "n_train": len(train), "n_train_fit": len(ytr_fit), "n_dev": len(ydev),
            "dev_size": args.dev_size, "n_gold": len(gold), "n_externe": len(externe),
        },
        "etancheite": {
            "Gold synthétique": {"exactes": len(v_gold.fuites_exactes),
                                 "approx": len(v_gold.proches), "seuil": v_gold.seuil_alerte},
            "Validation externe réelle": {"exactes": len(v_ext.fuites_exactes),
                                          "approx": len(v_ext.proches), "seuil": v_ext.seuil_alerte},
        },
        "gap": gap,
        "gap_logreg": gap_lr,
        "par_classe_reel": {"labels": res_ext_lr.labels, "par_classe": res_ext_lr.par_classe},
        "ece": ece_rows,
        "abstention": {
            "cible_precision": CIBLE_PRECISION, "seuil": seuil,
            "cov_dev": cov_dev, "prec_dev": prec_dev,
            "cov_gold": cov_g, "prec_gold": prec_g,
            "cov_ext": cov_e, "prec_ext": prec_e,
        },
    }

    # Fige le modèle de production + manifeste (repro).
    models_dir = Path(args.models_dir)
    models_dir.mkdir(parents=True, exist_ok=True)
    model_path = models_dir / f"classifier_{stamp}.joblib"
    prod.save(model_path)
    manifeste = {
        **payload["meta"],
        "modele_production": "EmbeddingLogReg (LogReg non calibrée)",
        "artefact": model_path.name,
        "classes": prod.classes_,
        "gap_production": gap_lr,
        "ece_production": ece_rows[0],
        "abstention": payload["abstention"],
        "note_calibration": "NON calibrée en prod : calibrer sur dev synthétique dégrade l'ECE réel.",
        "note_abstention": "Seuil paramétrable NON figé : réglage sur dev synthétique inopérant (J9 = dev réel).",
    }
    (models_dir / f"classifier_{stamp}.manifest.json").write_text(
        json.dumps(manifeste, ensure_ascii=False, indent=2), encoding="utf-8")

    absten = (grille, covs, precs, (cov_e, prec_e, seuil))

    # Rapport daté (gitignored) + référence versionnée.
    dated = Path(args.out_dir) / f"j5_{stamp}"
    md_dated = _ecrire(dated, "eval", payload, res_gold_lr, res_ext_lr,
                       courbes_ext, courbes_gold, absten)
    ref_path = None
    if args.reference:
        ref_dir = Path("eval/reports") / args.reference
        if ref_dir.exists():
            shutil.rmtree(ref_dir)
        shutil.copytree(dated, ref_dir)
        ref_path = ref_dir / "eval.md"

    # Résumé console.
    print("── Écart synthétique→réel (macro-F1) ───────────────────")
    for r in gap:
        print(f"  {r['modele']:<32} synth={r['f1_synth']:.3f}  réel={r['f1_reel']:.3f}  écart={r['ecart']:.3f}")
    print("── ECE ─────────────────────────────────────────────────")
    for r in ece_rows:
        print(f"  {r['variante']:<14} synth={r['ece_synth']:.3f}  réel={r['ece_reel']:.3f}")
    print("── Abstention (seuil dev) ──────────────────────────────")
    print(f"  seuil={seuil:.3f}  dev: couverture={cov_dev:.0%} précision={prec_dev:.0%}")
    print(f"  externe réel: couverture={cov_e:.0%} précision={prec_e:.0%}")
    print(f"  modèle figé → {model_path}")
    print(f"  rapport daté → {md_dated}")
    if ref_path:
        print(f"  référence versionnée → {ref_path}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="J5 — gel du classifieur embeddings+LogReg + rapport.")
    p.add_argument("--train", default=None, help="Défaut : dernier artifacts/corpus/corpus_train_*.jsonl.")
    p.add_argument("--gold", default="gold/gold.jsonl")
    p.add_argument("--externe", default="gold/validation_externe.jsonl")
    p.add_argument("--dev-size", type=float, default=0.15, help="Part du train réservée au dev (calibration/seuil).")
    p.add_argument("--out-dir", default="artifacts/eval", help="Rapports datés (gitignored).")
    p.add_argument("--models-dir", default="artifacts/models", help="Modèles figés (gitignored).")
    p.add_argument("--cache-dir", default="artifacts/eval/j5_cache", help="Cache d'embeddings (gitignored).")
    p.add_argument("--reference", default="j5", help="Label → copie versionnée sous ml/eval/reports/<label>/.")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
