"""
J7 — Orchestrateur du harnais de priorisation (CLI) + rapport.

Compare QUATRE prédicteurs de priorité sur DEUX jeux (gold synthétique 102 · externe
réel 46), métrique de tête **κ pondéré quadratique** (accord ordinal avec les labels
relus main) :

    • Classe majoritaire (MOYENNE, a priori)  — plancher (κ ≈ 0).
    • Priorité-source (label amont brut)       — borne « ce que donne le label d'origine ».
    • Scorecard glass-box (règles explicites)  — le livrable J7.
    • LLM few-shot (qwen local, temp 0)         — le foil boîte-noire.

Le chiffre-clé du fil rouge = l'**écart κ synthétique → réel** de chaque prédicteur :
les règles explicites transfèrent-elles mieux que l'apprentissage (J3/J5) ?

Rigueur : le scorecard prend la **vraie catégorie** en entrée (isole la logique de
priorité de l'erreur du classifieur J5) ; ses poids/seuils sont **gelés a priori**
(cf. `priority/lexicon.py`), jamais optimisés sur ces jeux. L'**analyse de sensibilité**
±1 sur les seuils prouve que le résultat n'est pas un artefact de seuil.

Usage (depuis `ml/`) :
    python -m smart_ticketing_ml.eval.run_priority --sans-llm        # rapide (déterministe)
    python -m smart_ticketing_ml.eval.run_priority --reference j7     # + LLM + copie versionnée
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

from ..priority.scorecard import Scorecard
from .dataset import Exemple, assert_disjoint, load_exemples, load_gold, load_train
from .priority import ORDRE_PRIORITE, MetriquePriorite, evaluer_priorite, kappa_pondere

DECALAGES_SENSIBILITE = [-1.0, -0.5, 0.0, 0.5, 1.0]


# ── Prédicteurs (interface commune : nom · predire(exemples, prefixe) -> list[str]) ──
class Constante:
    """Plancher : toujours MOYENNE (modale a priori d'un service desk, NON ajustée
    sur le test). κ d'un prédicteur constant = 0 par construction."""
    nom = "Classe majoritaire (MOYENNE)"

    def predire(self, exemples: list[Exemple], prefixe: str) -> list[str]:
        return ["MOYENNE"] * len(exemples)


class Source:
    """Priorité du label d'origine (générateur en synthétique, dataset en réel)."""
    nom = "Priorité-source"

    def predire(self, exemples: list[Exemple], prefixe: str) -> list[str]:
        return [e.priorite_source or "MOYENNE" for e in exemples]


class ScorecardPred:
    """Scorecard glass-box. Vraie catégorie en entrée, age=0 (jugement à la création)."""
    nom = "Scorecard (glass-box)"

    def __init__(self, decalage: float = 0.0) -> None:
        self._sc = Scorecard()
        self._decalage = decalage

    def predire(self, exemples: list[Exemple], prefixe: str) -> list[str]:
        return [
            self._sc.predire(e.titre, e.description, e.categorie, decalage_seuil=self._decalage)
            for e in exemples
        ]


def _plot_confusion(m: MetriquePriorite, path: Path, titre: str) -> None:
    n = len(m.labels)
    fig, ax = plt.subplots(figsize=(1.4 + 0.7 * n, 1.4 + 0.7 * n))
    im = ax.imshow(m.matrice, cmap="Oranges")
    ax.set_xticks(range(n), m.labels, rotation=45, ha="right")
    ax.set_yticks(range(n), m.labels)
    ax.set_xlabel("Prédit")
    ax.set_ylabel("Vérité (relue main)")
    ax.set_title(titre)
    seuil = max((max(r) for r in m.matrice), default=0) / 2
    for i, row in enumerate(m.matrice):
        for j, v in enumerate(row):
            ax.text(j, i, str(v), ha="center", va="center",
                    color="white" if v > seuil else "black", fontsize=9)
    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


# ── Artefacts explicatifs (tickets FICTIFS — jamais le gold : aucun coup d'œil au test) ──
_DEMO_DECOMPO = [
    ("Petite coquille dans le libellé du menu", "Le mot « paramètres » est mal orthographié.", "Logiciel"),
    ("Outlook lent depuis ce matin, c'est urgent", "La messagerie rame mais finit par ouvrir.", "Logiciel"),
    ("Impossible de me connecter à mon compte", "Mon mot de passe est refusé, je suis bloqué.", "Accès"),
    ("Serveur de fichiers down, tout le service bloqué", "Plus personne n'accède aux dossiers partagés en production.", "Réseau"),
]
_DEMO_SLA = ("Imprimante d'étage en panne", "L'imprimante du 2e ne répond plus.", "Matériel")


def _sensibilite(scorecard_exemples: dict[str, list[Exemple]]) -> list[dict]:
    """κ du scorecard sur chaque jeu pour chaque décalage de seuil (robustesse)."""
    lignes = []
    for d in DECALAGES_SENSIBILITE:
        pred = ScorecardPred(decalage=d)
        entree = {"decalage": d}
        for nom, exs in scorecard_exemples.items():
            entree[nom] = kappa_pondere([e.priorite for e in exs], pred.predire(exs, nom))
        lignes.append(entree)
    return lignes


def _markdown(meta, jeux, sensibilite, decompo, sla, figs) -> str:
    L: list[str] = []
    L.append("# Harnais d'évaluation — J7 (priorisation glass-box)\n")
    L.append(f"- **Date** : {meta['date']}  |  **Déterministe** (aucun seed ; LLM temp 0)")
    for j in jeux:
        L.append(f"- **{j['nom']}** : {j['n']} tickets — source `{j['src']}`")
    L.append("- **Tâche** : priorité ordinale (FAIBLE < MOYENNE < HAUTE < CRITIQUE). "
             "Métrique de tête : **κ pondéré quadratique** (accord avec les labels relus main).\n")

    L.append("> **Pré-enregistrement (anti-contamination)** : poids ET seuils du scorecard "
             "sont **gelés a priori** (`priority/lexicon.py`), issus de justifications métier, "
             "**jamais optimisés** sur le gold ou l'externe (ce sont les TESTS). Le scorecard "
             "reçoit la **vraie catégorie** (isole la priorité de l'erreur du classifieur J5). "
             "Un κ modéré est un résultat honnête, pas une invitation à trafiquer les seuils.\n")

    # Étanchéité
    L.append("## Étanchéité train / jeux d'éval\n")
    for j in jeux:
        v = j.get("verdict")
        if v is None:
            L.append(f"- **{j['nom']}** — train indispo ici (étanchéité déjà prouvée J3/J5).")
        else:
            L.append(f"- **{j['nom']}** — fuites exactes : **{len(v.fuites_exactes)}** "
                     f"{'✅' if v.etanche else '❌'} · approx. (Jaccard ≥ {v.seuil_alerte}) : "
                     f"**{len(v.proches)}**")
    L.append("")

    # Tableau de tête κ_w
    noms = [p["nom"] for p in jeux[0]["resultats"]]
    L.append("## Tableau comparatif — κ pondéré quadratique (métrique de tête)\n")
    L.append("| Prédicteur | " + " | ".join(f"{j['nom']} (n={j['n']})" for j in jeux)
             + " | **Écart synth→réel** |")
    L.append("|" + "---|" * (len(jeux) + 2))
    for nom in noms:
        vals = [dict((p["nom"], p) for p in j["resultats"])[nom]["metrique"].kappa_w for j in jeux]
        ecart = (vals[0] - vals[1]) if len(vals) == 2 else float("nan")
        cells = " | ".join(f"**{v:.3f}**" for v in vals)
        ecart_s = f"{ecart:+.3f}" if ecart == ecart else "—"
        L.append(f"| {nom} | {cells} | {ecart_s} |")
    L.append("\n_L'écart (synthétique − réel) répond à la question du fil rouge : "
             "un prédicteur qui transfère a un écart proche de 0._\n")

    # Secondaires
    for metr, titre in (("acc_pm1", "Accuracy à ±1 cran"), ("acc_exacte", "Accuracy exacte")):
        L.append(f"### {titre} (secondaire)\n")
        L.append("| Prédicteur | " + " | ".join(j["nom"] for j in jeux) + " |")
        L.append("|" + "---|" * (len(jeux) + 1))
        for nom in noms:
            cells = " | ".join(
                f"{getattr(dict((p['nom'], p) for p in j['resultats'])[nom]['metrique'], metr):.3f}"
                for j in jeux)
            L.append(f"| {nom} | {cells} |")
        L.append("")

    # Analyse de sensibilité
    L.append("## Analyse de sensibilité — décalage des seuils (robustesse)\n")
    L.append("_Seuils gelés à `1.0 / 2.5 / 4.0`. On les translate de ±1 pour montrer que le "
             "κ du scorecard n'est pas un artefact de seuil (décalage 0.0 = config gelée)._\n")
    L.append("| Décalage seuils | " + " | ".join(j["nom"] for j in jeux) + " |")
    L.append("|" + "---|" * (len(jeux) + 1))
    for row in sensibilite:
        marque = " ← gelé" if row["decalage"] == 0.0 else ""
        cells = " | ".join(f"{row[j['nom']]:.3f}" for j in jeux)
        L.append(f"| {row['decalage']:+.1f}{marque} | {cells} |")
    L.append("")

    # Décompositions (explicabilité §6.5)
    L.append("## Décomposition explicable (exemples fictifs)\n")
    L.append("_La sortie du scorecard n'est pas qu'un niveau : c'est une justification "
             "facteur par facteur — l'exigence glass-box §6.5._\n")
    for d in decompo:
        L.append(f"- « {d['titre']} » ({d['categorie']}) → **{d['explication']}** "
                 f"— score {d['score']:.2f}")
    L.append("")

    # Démo SLA (qualitative)
    L.append("## Ancienneté / SLA — re-priorisation (démo qualitative, hors κ)\n")
    L.append("_Gold/réel = jugements à la création (age=0) → le terme SLA est **nul** à l'éval. "
             "En production, un ticket **monte** en priorité en vieillissant :_\n")
    L.append(f"- « {sla['titre']} » ({sla['categorie']}) :")
    for etat in sla["etats"]:
        L.append(f"    - à {etat['age']:>4.0f} h → **{etat['niveau']}** (score {etat['score']:.2f})")
    L.append("")

    # Figures
    if figs:
        L.append("## Matrices de confusion (vérité × prédit)\n")
        for titre, f in figs.items():
            L.append(f"### {titre}\n\n![{titre}]({f})\n")

    L.append("---")
    L.append("_Poids/seuils exposables en paramètres admin (§6.5) ; réglage sur données "
             "réelles délégué au flywheel J9. Le scorecard reste une **règle explicite**, "
             "non un classifieur appris._")
    return "\n".join(L) + "\n"


def _decompositions() -> list[dict]:
    sc = Scorecard()
    out = []
    for titre, desc, cat in _DEMO_DECOMPO:
        dec = sc.evaluer(titre, desc, cat)
        out.append({"titre": titre, "categorie": cat, "score": dec.score,
                    "explication": dec.explication()})
    return out


def _demo_sla() -> dict:
    sc = Scorecard()
    titre, desc, cat = _DEMO_SLA
    etats = []
    for age in (0, 30, 60):
        dec = sc.evaluer(titre, desc, cat, age_heures=age)
        etats.append({"age": age, "niveau": dec.niveau, "score": dec.score})
    return {"titre": titre, "categorie": cat, "etats": etats}


def _ecrire(dest: Path, prefix: str, meta, jeux, sensibilite, decompo, sla) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    figs: dict[str, str] = {}
    for j in jeux:
        for p in j["resultats"]:
            titre = f"{p['nom']} · {j['nom']}"
            fname = f"{prefix}_confusion_{_slug(j['nom'])}_{_slug(p['nom'])}.png"
            _plot_confusion(p["metrique"], dest / fname, titre)
            figs[titre] = fname

    payload = {
        **meta,
        "sensibilite": sensibilite,
        "decompositions": decompo,
        "demo_sla": sla,
        "jeux": [
            {"nom": j["nom"], "n": j["n"], "source": j["src"],
             "predicteurs": {p["nom"]: p["metrique"].to_dict() for p in j["resultats"]}}
            for j in jeux
        ],
    }
    (dest / f"{prefix}.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md = dest / f"{prefix}.md"
    md.write_text(_markdown(meta, jeux, sensibilite, decompo, sla, figs), encoding="utf-8")
    return md


def _slug(s: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def run(args: argparse.Namespace) -> int:
    try:
        eval_sets: list[tuple[str, str, list[Exemple]]] = [
            ("Gold synthétique", args.gold, load_gold(args.gold)),
        ]
        if Path(args.externe).exists():
            eval_sets.append(("Validation externe réelle", args.externe, load_exemples(args.externe)))
        else:
            print(f"ℹ️ Pas de validation externe ({args.externe}).", file=sys.stderr)
    except FileNotFoundError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    # Étanchéité (non entraînant, mais on prouve la disjonction — cohérence J3/J5).
    verdicts: dict[str, object] = {}
    try:
        train = load_train(args.train)
        for nom, _, data in eval_sets:
            verdicts[nom] = assert_disjoint(train, data)
    except FileNotFoundError:
        print("ℹ️ Train indispo — étanchéité déjà prouvée J3/J5, on continue.", file=sys.stderr)
    except RuntimeError as exc:
        print(f"❌ Étanchéité violée : {exc}", file=sys.stderr)
        return 2

    # Prédicteurs
    predicteurs = [Constante(), Source(), ScorecardPred()]
    if not args.sans_llm:
        from .priority_llm import PrioriteLLM
        predicteurs.append(PrioriteLLM(model=args.modele_llm))

    jeux: list[dict] = []
    for nom, src, data in eval_sets:
        y_true = [e.priorite for e in data]
        resultats = []
        for p in predicteurs:
            y_pred = p.predire(data, _slug(nom))
            resultats.append({"nom": p.nom, "metrique": evaluer_priorite(y_true, y_pred)})
        jeux.append({"nom": nom, "src": src, "n": len(data),
                     "verdict": verdicts.get(nom), "resultats": resultats})

    sensibilite = _sensibilite({nom: data for nom, _, data in eval_sets})
    decompo = _decompositions()
    sla = _demo_sla()

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    meta = {
        "jalon": "J7",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "modele_llm": None if args.sans_llm else args.modele_llm,
        "seuils_gelés": {"MOYENNE": 1.0, "HAUTE": 2.5, "CRITIQUE": 4.0},
    }

    md_path = _ecrire(Path(args.out_dir), f"priority_{stamp}", meta, jeux, sensibilite, decompo, sla)
    ref_path = _ecrire(Path("eval/reports") / args.reference, "priority",
                       meta, jeux, sensibilite, decompo, sla) if args.reference else None

    # Résumé console
    largeur = max(len(p["nom"]) for p in jeux[0]["resultats"])
    print("── Comparatif κ pondéré quadratique ────────────────────────────")
    entete = "  " + " " * largeur + "   " + "   ".join(f"{j['nom']:>26}" for j in jeux) + "     écart"
    print(entete)
    for p in jeux[0]["resultats"]:
        vals = [dict((q["nom"], q) for q in j["resultats"])[p["nom"]]["metrique"].kappa_w for j in jeux]
        cellules = "   ".join(f"{v:>26.3f}" for v in vals)
        ecart = f"{vals[0] - vals[1]:+.3f}" if len(vals) == 2 else "—"
        print(f"  {p['nom']:<{largeur}}   {cellules}   {ecart}")
    print("── Sensibilité seuils (κ scorecard) ────────────────────────────")
    for row in sensibilite:
        cellules = "   ".join(f"{row[j['nom']]:.3f}" for j in jeux)
        print(f"  décalage {row['decalage']:+.1f}   {cellules}")
    print("────────────────────────────────────────────────────────────────")
    print(f"Rapport → {md_path}")
    if ref_path:
        print(f"Référence versionnée → {ref_path}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Harnais J7 — priorisation glass-box (κ pondéré).")
    p.add_argument("--gold", default="gold/gold.jsonl")
    p.add_argument("--externe", default="gold/validation_externe.jsonl")
    p.add_argument("--train", default=None, help="Défaut : dernier artifacts/corpus/corpus_train_*.jsonl.")
    p.add_argument("--out-dir", default="artifacts/eval")
    p.add_argument("--reference", default=None, help="Label (ex. j7) → copie versionnée sous ml/eval/reports/<label>/.")
    p.add_argument("--sans-llm", action="store_true", help="Saute le foil LLM (itération rapide déterministe).")
    p.add_argument("--modele-llm", default="qwen2.5:14b", help="Modèle Ollama du foil few-shot.")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
