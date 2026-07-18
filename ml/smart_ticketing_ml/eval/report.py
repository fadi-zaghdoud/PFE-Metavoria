"""
J3 — Orchestrateur du harnais d'évaluation (CLI).

Charge le train + **plusieurs jeux d'évaluation**, vérifie l'étanchéité, entraîne
chaque baseline UNE fois sur le train, puis l'évalue sur chaque jeu et produit un
**tableau comparatif** :

    • « Gold synthétique »          — 102 tickets, même distribution que le train.
    • « Validation externe réelle » — 46 vrais e-mails FR (Kaggle, CC BY 4.0).

Le comparatif synthétique vs réel est le résultat le plus honnête du projet : il
mesure la **chute de généralisation** quand on passe du synthétique au réel.

Sorties :
  - Toujours : `artifacts/eval/eval_<stamp>.{md,json}` + figures (gitignored).
  - Avec `--reference <label>` : COPIE versionnée sous `ml/eval/reports/<label>/`
    (un score daté est une preuve historique de progression — rapport/soutenance/J9).

Usage (depuis `ml/`) :
    python -m smart_ticketing_ml.eval.report
    python -m smart_ticketing_ml.eval.report --reference j3
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # rendu fichier, pas d'affichage
import matplotlib.pyplot as plt

from ..taxonomy import CATEGORY_WEIGHT_HINTS
from . import baselines as bl
from .dataset import (
    Exemple,
    VerdictEtancheite,
    assert_disjoint,
    load_exemples,
    load_gold,
    load_train,
)
from .metrics import ResultatMetrique, evaluer


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _ordre_labels(exemples: list[Exemple]) -> list[str]:
    """Ordre des catégories : ordre métier connu (hints taxonomie) puis extras
    triés. Dérivé des données — jamais figé (catégories dynamiques)."""
    presentes = {e.categorie for e in exemples}
    connues = [c for c in CATEGORY_WEIGHT_HINTS if c in presentes]
    return connues + sorted(presentes - set(connues))


def _plot_confusion(res: ResultatMetrique, path: Path, titre: str) -> None:
    n = len(res.labels)
    fig, ax = plt.subplots(figsize=(1.4 + 0.7 * n, 1.4 + 0.7 * n))
    im = ax.imshow(res.matrice, cmap="Blues")
    ax.set_xticks(range(n), res.labels, rotation=45, ha="right")
    ax.set_yticks(range(n), res.labels)
    ax.set_xlabel("Prédit")
    ax.set_ylabel("Vérité")
    ax.set_title(titre)
    seuil = max((max(r) for r in res.matrice), default=0) / 2
    for i, row in enumerate(res.matrice):
        for j, v in enumerate(row):
            ax.text(j, i, str(v), ha="center", va="center",
                    color="white" if v > seuil else "black", fontsize=9)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def plot_reliability(
    courbes: dict[str, tuple[list[float], list[float], float]],
    path: Path,
    titre: str,
) -> None:
    """Reliability diagram (J5) — confiance moyenne (x) vs justesse empirique (y).

    `courbes` : {label -> (confiances_moy, justesses_moy, ece)}. La diagonale est
    le calibrage parfait. Sert à prouver visuellement que la calibration apprise
    sur le synthétique s'écarte de la diagonale sur le réel.
    """
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.plot([0, 1], [0, 1], "--", color="gray", label="parfait")
    for label, (xs, ys, e) in courbes.items():
        ax.plot(xs, ys, "o-", label=f"{label} (ECE={e:.3f})")
    ax.set_xlabel("confiance moyenne (top-1)")
    ax.set_ylabel("justesse empirique")
    ax.set_title(titre)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.legend(loc="upper left")
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def _markdown(meta: dict, jeux: list[dict], figs: dict[str, str]) -> str:
    L: list[str] = []
    L.append("# Harnais d'évaluation — J3 (baselines de classification)\n")
    L.append(f"- **Date** : {meta['date']}  |  **Seed** : {meta['seed']}  "
             f"|  **Train** : {meta['n_train']} tickets")
    for j in jeux:
        L.append(f"- **{j['nom']}** : {j['n']} tickets — source `{j['src']}`")
    L.append("- **Tâche** : classification de catégorie (catégories dynamiques). "
             "Modèles SANS apprentissage (J3) — embeddings+LogReg au J5.\n")

    # Étanchéité
    L.append("## Étanchéité train / jeux d'éval\n")
    for j in jeux:
        v = j["verdict"]
        L.append(f"- **{j['nom']}** — fuites exactes : **{len(v.fuites_exactes)}** "
                 f"{'✅' if v.etanche else '❌'} · chevauchements approx. "
                 f"(Jaccard ≥ {v.seuil_alerte}) : **{len(v.proches)}**")
    L.append("")

    # Tableau comparatif macro-F1
    noms_baselines = [b[0] for b in jeux[0]["resultats"]]
    L.append("## Tableau comparatif — macro-F1 (métrique de tête)\n")
    entete = "| Baseline | " + " | ".join(f"{j['nom']} (n={j['n']})" for j in jeux) + " |"
    L.append(entete)
    L.append("|" + "---|" * (len(jeux) + 1))
    for bnom in noms_baselines:
        cells = []
        for j in jeux:
            res = dict(j["resultats"])[bnom]
            cells.append(f"**{res.macro_f1:.3f}**")
        L.append(f"| {bnom} | " + " | ".join(cells) + " |")
    L.append("\n_(accuracy et détail par classe ci-dessous ; matrices de confusion en figures.)_\n")

    # accuracy comparatif
    L.append("### Accuracy (secondaire)\n")
    L.append("| Baseline | " + " | ".join(j["nom"] for j in jeux) + " |")
    L.append("|" + "---|" * (len(jeux) + 1))
    for bnom in noms_baselines:
        cells = [f"{dict(j['resultats'])[bnom].accuracy:.3f}" for j in jeux]
        L.append(f"| {bnom} | " + " | ".join(cells) + " |")
    L.append("")

    # Détail par classe (baseline la plus forte = dernière) pour chaque jeu
    for j in jeux:
        bnom, res = j["resultats"][-1]
        L.append(f"## Détail par classe — {bnom} · {j['nom']}\n")
        L.append("| Catégorie | P | R | F1 | support |")
        L.append("|---|---|---|---|---|")
        for lab in res.labels:
            c = res.par_classe[lab]
            L.append(f"| {lab} | {c['precision']:.3f} | {c['recall']:.3f} "
                     f"| {c['f1']:.3f} | {c['support']} |")
        L.append("")

    # Figures
    if figs:
        L.append("## Matrices de confusion\n")
        for titre, f in figs.items():
            L.append(f"### {titre}\n\n![{titre}]({f})\n")

    L.append("---")
    L.append("_À venir : retrieval Recall@k/nDCG (J6), priorité kappa pondéré (J7), "
             "latence p95 & coût (J4+). Stubs en place dans `eval/`._")
    return "\n".join(L) + "\n"


def _ecrire(dest: Path, prefix: str, meta: dict, jeux: list[dict]) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    figs: dict[str, str] = {}
    for j in jeux:
        for bnom, res in j["resultats"]:
            titre = f"{bnom} · {j['nom']}"
            fname = f"{prefix}_confusion_{_slug(j['nom'])}_{_slug(bnom)}.png"
            _plot_confusion(res, dest / fname, titre)
            figs[titre] = fname

    payload = {
        **meta,
        "jeux": [
            {
                "nom": j["nom"], "n": j["n"], "source": j["src"],
                "etancheite": {
                    "fuites_exactes": j["verdict"].fuites_exactes,
                    "chevauchements_approximatifs": j["verdict"].proches,
                    "seuil_alerte": j["verdict"].seuil_alerte,
                },
                "baselines": {bnom: res.to_dict() for bnom, res in j["resultats"]},
            }
            for j in jeux
        ],
    }
    (dest / f"{prefix}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md = dest / f"{prefix}.md"
    md.write_text(_markdown(meta, jeux, figs), encoding="utf-8")
    return md


def run(args: argparse.Namespace) -> int:
    try:
        train = load_train(args.train)
        eval_sets: list[tuple[str, str, list[Exemple]]] = [
            ("Gold synthétique", args.gold, load_gold(args.gold)),
        ]
        if Path(args.externe).exists():
            eval_sets.append(
                ("Validation externe réelle", args.externe, load_exemples(args.externe)))
        else:
            print(f"ℹ️ Pas de validation externe ({args.externe}) — comparatif sur le gold seul.",
                  file=sys.stderr)
    except FileNotFoundError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    # Étanchéité de CHAQUE jeu vs train (fail dur sur fuite exacte).
    try:
        verdicts = {nom: assert_disjoint(train, data) for nom, _, data in eval_sets}
    except RuntimeError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 2

    tous = train + [e for _, _, d in eval_sets for e in d]
    labels = _ordre_labels(tous)
    Xtr, ytr = [e.texte for e in train], [e.categorie for e in train]

    models = [m.fit(Xtr, ytr) for m in bl.baselines_defaut()]

    jeux: list[dict] = []
    for nom, src, data in eval_sets:
        Xe, ye = [e.texte for e in data], [e.categorie for e in data]
        resultats = [(m.nom, evaluer(ye, m.predict(Xe), labels)) for m in models]
        jeux.append({"nom": nom, "src": src, "n": len(data),
                     "verdict": verdicts[nom], "resultats": resultats})

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    meta = {
        "jalon": "J3",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "seed": bl.SEED,
        "n_train": len(train),
        "train_src": args.train or "artifacts/corpus/corpus_train_*.jsonl (dernier)",
    }

    md_path = _ecrire(Path(args.out_dir), f"eval_{stamp}", meta, jeux)
    ref_path = _ecrire(Path("eval/reports") / args.reference, "eval", meta, jeux) \
        if args.reference else None

    # Résumé console — le tableau comparatif
    largeur = max(len(b) for b, _ in jeux[0]["resultats"])
    entete = "  " + " " * largeur + "   " + "   ".join(f"{j['nom']:>26}" for j in jeux)
    print("── Comparatif macro-F1 ─────────────────────────────────")
    print(entete)
    for bnom, _ in jeux[0]["resultats"]:
        vals = "   ".join(f"{dict(j['resultats'])[bnom].macro_f1:>26.3f}" for j in jeux)
        print(f"  {bnom:<{largeur}}   {vals}")
    print("── Étanchéité ──────────────────────────────────────────")
    for j in jeux:
        v = j["verdict"]
        print(f"  {j['nom']:<26} exactes={len(v.fuites_exactes)}  approx={len(v.proches)}")
    print("────────────────────────────────────────────────────────")
    print(f"Rapport → {md_path}")
    if ref_path:
        print(f"Référence versionnée → {ref_path}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Harnais d'évaluation J3 (baselines, comparatif synthétique/réel).")
    p.add_argument("--gold", default="gold/gold.jsonl")
    p.add_argument("--externe", default="gold/validation_externe.jsonl",
                   help="Jeu de validation externe réel (ignoré s'il n'existe pas).")
    p.add_argument("--train", default=None, help="Défaut : dernier artifacts/corpus/corpus_train_*.jsonl.")
    p.add_argument("--out-dir", default="artifacts/eval", help="Sorties datées (gitignored).")
    p.add_argument("--reference", default=None,
                   help="Label de jalon (ex. j3) → copie versionnée sous ml/eval/reports/<label>/.")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
