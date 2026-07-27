"""
J6a — Ablation retrieval : le tableau final qui manquait pour clore J6.

Compare les **4 variantes** de recherche (`dense`, `lexical`, `rrf`, `rrf_rerank`)
sur **2 jeux de requêtes** (gold synthétique 102 · externe réel 46), contre la
pertinence **gradée** jugée par LLM local validé (κ_w 0,954 vs humain, cf.
`judge_validation.py`) et **déjà en cache** (`artifacts/eval/judgments.jsonl`,
1486 paires). Métriques (`eval/retrieval.py`, pooling façon TREC) : Recall@k, nDCG@k,
MRR @{1,3,5} — profondeur ≤ pool (min 5).

Question de tête : **le rerank aide-t-il ou nuit-il, et où ?** (hypothèse pré-jugée au
journal J6 : l'ordre fin du rerank aide le synthétique mais NUIT au réel → à confirmer
ICI sur la mesure). + contribution de chaque arm (dense vs lexical vs RRF).

Le retrieval est **re-lancé** (les jugements ne portent pas le classement par variante),
mais les classements sont **cachés** (`retrieval_rankings.jsonl`) → régénération du
rapport instantanée, run reprenable (leçon J1). Aucune donnée ne sort ; anti-contamination
identique à J6 (config gelée `retrieval/config.py`, jamais réglée sur le gold).

Usage (depuis `ml/`) :
    python -m smart_ticketing_ml.eval.run_retrieval --reference j6
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

from ..retrieval import hybrid
from . import retrieval as R

RACINE = Path(__file__).resolve().parents[2]  # .../ml
JUDGMENTS = RACINE / "artifacts" / "eval" / "judgments.jsonl"
RANKINGS = RACINE / "artifacts" / "eval" / "retrieval_rankings.jsonl"

JEUX = [
    ("Gold synthétique", "gold/gold.jsonl"),
    ("Validation externe réelle", "gold/validation_externe.jsonl"),
]
KS = (1, 3, 5)
PROFONDEUR_STOCK = 10  # on garde le top-10 par variante (couvre @5 + marge de diagnostic)


def load_queries(path: str) -> list[dict]:
    """Requêtes brutes (id, texte, titre, description) — id = query_id du cache juge."""
    out = []
    for l in open(path, encoding="utf-8"):
        if l.strip():
            r = json.loads(l)
            out.append({"id": str(r["id"]), "texte": f"{r['titre']}\n{r['description']}",
                        "titre": r.get("titre", ""), "description": r.get("description", "")})
    return out


def load_pertinences() -> dict[str, dict[int, int]]:
    pert: dict[str, dict[int, int]] = {}
    for l in open(JUDGMENTS, encoding="utf-8"):
        if l.strip():
            r = json.loads(l)
            pert.setdefault(str(r["query_id"]), {})[int(r["doc_id"])] = int(r["grade"])
    return pert


def _load_rankings() -> dict[tuple[str, str], list[int]]:
    cache: dict[tuple[str, str], list[int]] = {}
    if RANKINGS.exists():
        for l in RANKINGS.open(encoding="utf-8"):
            if l.strip():
                r = json.loads(l)
                cache[(str(r["query_id"]), r["variante"])] = [int(x) for x in r["ids"]]
    return cache


def _save_ranking(qid: str, variante: str, ids: list[int]) -> None:
    RANKINGS.parent.mkdir(parents=True, exist_ok=True)
    with RANKINGS.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"query_id": qid, "variante": variante, "ids": ids}, ensure_ascii=False) + "\n")


def collecter_classements(queries: list[dict]) -> tuple[dict, dict]:
    """Pour chaque requête × variante : top-N classé (caché). Renvoie (rankings, anti_fuite)."""
    cache = _load_rankings()
    anti_fuite = {"exactes": 0, "proches": 0}
    manquants = [(q, v) for q in queries for v in hybrid.VARIANTES if (q["id"], v) not in cache]
    if manquants:
        print(f"  {len(manquants)} classements à calculer (retrieval)…", file=sys.stderr)
        with hybrid.connexion() as conn, conn.cursor() as cur:
            for i, q in enumerate(queries, 1):
                for v in hybrid.VARIANTES:
                    cle = (q["id"], v)
                    if cle in cache:
                        continue
                    docs = hybrid.retrieve(cur, q["texte"], v)
                    ids = [d.id for d in docs[:PROFONDEUR_STOCK]]
                    cache[cle] = ids
                    _save_ranking(q["id"], v, ids)
                    if v == "rrf":  # anti-fuite mesuré une fois par requête (représentatif)
                        ex, pr = hybrid.garde_anti_fuite(q["titre"], q["description"], docs)
                        anti_fuite["exactes"] += len(ex)
                        anti_fuite["proches"] += len(pr)
                if i % 20 == 0:
                    print(f"    …{i}/{len(queries)} requêtes", file=sys.stderr)
    return cache, anti_fuite


def evaluer_jeu(queries, pert, rankings, seuil) -> dict[str, dict]:
    """Agrège les métriques par variante pour un jeu de requêtes."""
    res: dict[str, dict] = {}
    for v in hybrid.VARIANTES:
        pertinences = [pert.get(q["id"], {}) for q in queries]
        classements = [rankings[(q["id"], v)] for q in queries]
        res[v] = R.agreger(pertinences, classements, ks=KS, seuil=seuil)
    return res


def _couverture_pool(queries, pert, rankings) -> float:
    """Fraction moyenne du top-5 (toutes variantes) qui est jugée (contrôle de pooling)."""
    total, juges = 0, 0
    for q in queries:
        p = pert.get(q["id"], {})
        for v in hybrid.VARIANTES:
            for d in rankings[(q["id"], v)][:5]:
                total += 1
                juges += 1 if d in p else 0
    return juges / total if total else 0.0


def _plot_ndcg(jeux: list[dict], path: Path) -> None:
    variantes = hybrid.VARIANTES
    x = range(len(variantes))
    largeur = 0.38
    fig, ax = plt.subplots(figsize=(7, 4.2))
    for i, j in enumerate(jeux):
        vals = [j["metrics_s1"][v]["ndcg@5"] for v in variantes]
        ax.bar([xi + (i - 0.5) * largeur for xi in x], vals, largeur, label=j["nom"])
    ax.set_xticks(list(x), variantes, rotation=15)
    ax.set_ylabel("nDCG@5 (gradé)")
    ax.set_title("Ablation retrieval — nDCG@5 par variante × jeu")
    ax.set_ylim(0, 1)
    ax.legend()
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def _markdown(meta, jeux, anti_fuite, couvertures, fig) -> str:
    L: list[str] = []
    L.append("# Ablation retrieval — clôture J6 (dense / lexical / RRF / +rerank)\n")
    L.append(f"- **Date** : {meta['date']}  |  **Juge** : {meta['modele_juge']} "
             f"(validé κ_w 0,954 vs humain)  |  **Jugements** : {meta['n_jugements']} (cache)")
    for j in jeux:
        L.append(f"- **{j['nom']}** : {j['n']} requêtes — pool jugé profond {j['pool_min']}–{j['pool_max']} "
                 f"(couverture top-5 = {couvertures[j['nom']]:.1%})")
    L.append("- **Métriques** : pooling façon TREC, pertinent = grade ≥ 1 (strict grade = 2 en second). "
             "Config retrieval **gelée** (`retrieval/config.py`), jamais réglée sur le gold.\n")

    L.append(f"- **Anti-fuite** (le doc retrouvé ≠ la requête) : **{anti_fuite['exactes']}** fuite(s) "
             f"exacte(s), {anti_fuite['proches']} proche(s) signalé(s).\n")

    for metr, titre in (("ndcg@5", "nDCG@5 (ordre gradé — métrique de tête pour le rerank)"),
                        ("recall@5", "Recall@5"), ("mrr", "MRR")):
        L.append(f"## {titre}\n")
        L.append("| Variante | " + " | ".join(f"{j['nom']} (n={j['n']})" for j in jeux) + " |")
        L.append("|" + "---|" * (len(jeux) + 1))
        for v in hybrid.VARIANTES:
            cells = " | ".join(f"**{j['metrics_s1'][v][metr]:.3f}**" for j in jeux)
            L.append(f"| {v} | {cells} |")
        L.append("")

    # Le verdict rerank : Δ = rrf_rerank − rrf
    L.append("## Verdict — le rerank réordonne-t-il pour le mieux ? (Δ = rrf_rerank − rrf)\n")
    L.append("| Métrique | " + " | ".join(j["nom"] for j in jeux) + " |")
    L.append("|" + "---|" * (len(jeux) + 1))
    for metr in ("ndcg@5", "recall@5", "mrr"):
        cells = []
        for j in jeux:
            d = j["metrics_s1"]["rrf_rerank"][metr] - j["metrics_s1"]["rrf"][metr]
            cells.append(f"{d:+.3f}")
        L.append(f"| {metr} | " + " | ".join(cells) + " |")
    L.append("\n_Un Δ positif = le rerank améliore l'ordre ; négatif = il le dégrade._\n")

    if fig:
        L.append(f"## Figure\n\n![nDCG@5]({fig})\n")

    L.append("---")
    L.append("_Décision de production (`retrieval/config.py`) : `RERANK_ACTIF_DEFAUT=False` — "
             "l'ordre d'affichage reste **RRF** ; le reranker ne sert qu'au **score** de la porte "
             "d'abstention (top-1). Le réentraînement du reranker attend le flywheel J9._")
    return "\n".join(L) + "\n"


def _ecrire(dest: Path, prefix: str, meta, jeux, anti_fuite, couvertures) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    fig = f"{prefix}_ndcg5.png"
    _plot_ndcg(jeux, dest / fig)
    payload = {
        **meta,
        "anti_fuite": anti_fuite,
        "couverture_pool_top5": couvertures,
        "jeux": [
            {"nom": j["nom"], "n": j["n"], "pool_min": j["pool_min"], "pool_max": j["pool_max"],
             "seuil_1": j["metrics_s1"], "seuil_2": j["metrics_s2"]}
            for j in jeux
        ],
    }
    (dest / f"{prefix}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md = dest / f"{prefix}.md"
    md.write_text(_markdown(meta, jeux, anti_fuite, couvertures, fig), encoding="utf-8")
    return md


def run(args: argparse.Namespace) -> int:
    if not JUDGMENTS.exists():
        print(f"❌ Cache de jugements introuvable ({JUDGMENTS}). Lance le juge d'abord.", file=sys.stderr)
        return 1
    pert = load_pertinences()

    jeux_data = []
    all_queries = []
    for nom, path in JEUX:
        if not Path(path).exists():
            print(f"ℹ️ Jeu absent : {path} — ignoré.", file=sys.stderr)
            continue
        qs = load_queries(path)
        # ne garde que les requêtes ayant un pool jugé (sinon rien à mesurer)
        qs = [q for q in qs if q["id"] in pert]
        jeux_data.append({"nom": nom, "queries": qs})
        all_queries.extend(qs)

    rankings, anti_fuite = collecter_classements(all_queries)

    couvertures = {}
    for jd in jeux_data:
        qs = jd["queries"]
        m1 = evaluer_jeu(qs, pert, rankings, seuil=1)
        m2 = evaluer_jeu(qs, pert, rankings, seuil=2)
        pools = [len(pert.get(q["id"], {})) for q in qs]
        jd.update({"n": len(qs), "metrics_s1": m1, "metrics_s2": m2,
                   "pool_min": min(pools), "pool_max": max(pools)})
        couvertures[jd["nom"]] = _couverture_pool(qs, pert, rankings)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    meta = {
        "jalon": "J6a (ablation retrieval)",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "modele_juge": "qwen2.5:14b",
        "n_jugements": sum(len(v) for v in pert.values()),
    }
    md = _ecrire(Path(args.out_dir), f"retrieval_ablation_{stamp}", meta, jeux_data, anti_fuite, couvertures)
    ref = _ecrire(Path("eval/reports") / args.reference, "retrieval_ablation",
                  meta, jeux_data, anti_fuite, couvertures) if args.reference else None

    # Console
    print("── Ablation retrieval — nDCG@5 / Recall@5 / MRR (grade ≥ 1) ──────────")
    entete = f"  {'variante':<12}" + "".join(f"{jd['nom'][:22]:>24}" for jd in jeux_data)
    print(entete)
    for metr in ("ndcg@5", "recall@5", "mrr"):
        print(f"  [{metr}]")
        for v in hybrid.VARIANTES:
            vals = "".join(f"{jd['metrics_s1'][v][metr]:>24.3f}" for jd in jeux_data)
            print(f"    {v:<10}{vals}")
    print("── Δ rerank (rrf_rerank − rrf) ──────────────────────────────────────")
    for metr in ("ndcg@5", "recall@5", "mrr"):
        vals = "".join(f"{jd['metrics_s1']['rrf_rerank'][metr]-jd['metrics_s1']['rrf'][metr]:>+24.3f}" for jd in jeux_data)
        print(f"    {metr:<10}{vals}")
    print("─────────────────────────────────────────────────────────────────────")
    print(f"Rapport → {md}")
    if ref:
        print(f"Référence versionnée → {ref}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="J6a — ablation retrieval (dense/lexical/rrf/+rerank).")
    p.add_argument("--out-dir", default="artifacts/eval")
    p.add_argument("--reference", default=None, help="Label (ex. j6) → copie versionnée sous ml/eval/reports/<label>/.")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
