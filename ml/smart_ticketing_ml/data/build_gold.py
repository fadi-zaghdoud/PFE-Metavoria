"""
J2 — Construction des CANDIDATS du gold set de test.

Le gold set valide le module IA sur des tickets non vus. Il doit être :
  - **étanche** : disjoint du corpus d'entraînement (852, généré au 14B) ;
  - **relu à la main** : c'est la relecture humaine qui garantit des labels
    fiables (le vrai garant de qualité).

Choix : candidats générés au **7B** (modèle différent du 14B d'entraînement) →
réduit le biais « même générateur ». Nuance : 7B et 14B restent la même famille
Qwen → biais réduit, pas éliminé.

Deux contrôles d'anti-fuite :
  1. **Dédup exacte** : tout candidat dont la description (normalisée) apparaît
     déjà dans l'entraînement est **écarté**.
  2. **Chevauchement sémantique de surface** : pour chaque candidat, similarité
     de Jaccard (mots de titre+description) avec le ticket d'entraînement le plus
     proche → **signalée** (pas supprimée) dans le CSV, pour que Fedi écarte les
     quasi-copies pendant la relecture.

Sortie (RIEN n'est scellé ici) :
  - `ml/artifacts/gold/gold_candidates_<stamp>.jsonl` : candidats retenus.
  - `ml/artifacts/gold/gold_review_<stamp>.csv` : feuille de relecture.

Usage :
    python -m smart_ticketing_ml.data.build_gold --n 150 --model qwen2.5:7b
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from ..db import fetch_categories
from ..taxonomy import RESOLVED_STATUSES
from .generate_corpus import (
    build_batch_user_prompt,
    build_system_prompt,
    sample_specs,
)
from .schema import TicketBatch

TOKEN_RE = re.compile(r"[0-9a-zà-ÿ]+", re.IGNORECASE)
SIM_FLAG = 0.6  # seuil d'alerte « quasi-copie » dans le CSV


def _tokens(s: str) -> set[str]:
    return set(TOKEN_RE.findall(s.lower()))


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _load_train() -> list[dict]:
    fichiers = sorted(glob.glob("artifacts/corpus/corpus_train_*.jsonl"))
    if not fichiers:
        raise RuntimeError("Corpus d'entraînement introuvable (artifacts/corpus/corpus_train_*.jsonl).")
    return [json.loads(l) for l in open(fichiers[-1], encoding="utf-8")]


def _desc_suspecte(description: str, service: str) -> bool:
    """Description dégénérée = uniquement le profil du demandeur (défaut du 7B),
    ex. « RH/gestionnaire paie. ». Précis : mots de la description ⊆ mots du service
    (n'attrape pas les dates type 23/09/2023)."""
    dt = _tokens(description)
    return bool(dt) and dt <= _tokens(service)


def _write_review_csv(path: Path, records: list[dict]) -> int:
    """Écrit le CSV de relecture (tri quasi-copies en tête). Renvoie le nombre de
    descriptions suspectes signalées. UTF-8 BOM + « ; » → ouverture directe Excel FR."""
    records = sorted(records, key=lambda r: r.get("similarite_max", 0.0), reverse=True)
    flags = 0
    with path.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow([
            "titre", "description", "resolution", "label_genere",
            "similarite_max", "ticket_proche", "desc_suspecte",
            "categorie_corrigee", "priorite_corrigee", "valide (O/N)", "notes",
        ])
        for r in records:
            susp = _desc_suspecte(r["description"], r.get("service_demandeur", ""))
            flags += susp
            w.writerow([
                r["titre"], r["description"], r["resolution"],
                f"{r['categorie']} / {r['priorite']} / {r['statut']}",
                r.get("similarite_max", ""), r.get("ticket_proche", ""),
                "O" if susp else "",
                "", "", "", "",
            ])
    return flags


def run(args: argparse.Namespace) -> int:
    # Régénère seulement le CSV depuis un fichier de candidats existant (sans LLM).
    if args.from_candidates:
        recs = [json.loads(l) for l in open(args.from_candidates, encoding="utf-8")]
        out = Path(str(args.from_candidates).replace("gold_candidates_", "gold_review_").replace(".jsonl", ".csv"))
        susp = _write_review_csv(out, recs)
        print(f"CSV régénéré → {out} ({len(recs)} lignes, {susp} descriptions suspectes)")
        return 0

    rng = random.Random(args.seed)
    try:
        categories = fetch_categories()
        train = _load_train()
    except Exception as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    specs = sample_specs(args.n, rng, categories)
    print(f"Génération de {args.n} candidats gold (7B, seed={args.seed}, ≠ train)…")

    if args.dry_run:
        print("[dry-run] pas d'appel LLM.")
        return 0

    from .ollama_client import OllamaGenerator

    gen = OllamaGenerator(host=args.host, model=args.model, fallback="", temperature=args.temperature)
    system = build_system_prompt(categories)
    schema = TicketBatch.model_json_schema()

    out_dir = Path("artifacts/gold")
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    raw_path = out_dir / f"gold_raw_{stamp}.jsonl"

    produced: list = []
    batches = [specs[i : i + args.batch_size] for i in range(0, len(specs), args.batch_size)]
    with raw_path.open("w", encoding="utf-8") as fh:
        for bi, bs in enumerate(batches, 1):
            try:
                batch = TicketBatch.model_validate(gen.chat_json(system, build_batch_user_prompt(bs), schema))
            except Exception as exc:
                print(f"  ⚠️ Lot {bi}/{len(batches)} échoué ({exc}). Ignoré.", file=sys.stderr)
                continue
            if len(batch.tickets) != len(bs):
                print(f"  ⚠️ Lot {bi}/{len(batches)} : compte incohérent. Ignoré.", file=sys.stderr)
                continue
            for t, spec in zip(batch.tickets, bs):
                t.categorie = spec.categorie
                t.priorite = spec.priorite  # type: ignore[assignment]
                t.statut = spec.statut  # type: ignore[assignment]
                produced.append(t)
                fh.write(json.dumps(t.model_dump(), ensure_ascii=False) + "\n")
            fh.flush()
            print(f"  Lot {bi}/{len(batches)} ok — {len(produced)} candidats.")

    if not produced:
        print("❌ Aucun candidat généré.", file=sys.stderr)
        return 1

    # ── Anti-fuite : dédup exacte + similarité de surface ────────────────────
    train_desc = {_norm(t["description"]) for t in train}
    train_tok = [(_tokens(t["titre"] + " " + t["description"]), t["titre"]) for t in train]

    retenus = []
    ecartes_exacts = 0
    for t in produced:
        if _norm(t.description) in train_desc:
            ecartes_exacts += 1
            continue
        ctok = _tokens(t.titre + " " + t.description)
        sim_max, proche = 0.0, ""
        for tok, titre in train_tok:
            s = _jaccard(ctok, tok)
            if s > sim_max:
                sim_max, proche = s, titre
        retenus.append((t, sim_max, proche))

    # Tri par similarité décroissante → les quasi-copies remontent en tête du CSV.
    retenus.sort(key=lambda r: r[1], reverse=True)

    candidates_path = out_dir / f"gold_candidates_{stamp}.jsonl"
    review_path = out_dir / f"gold_review_{stamp}.csv"

    with candidates_path.open("w", encoding="utf-8") as fh:
        for t, sim, proche in retenus:
            rec = t.model_dump()
            rec["synthetique"] = True
            rec["resolution_a_lier"] = t.statut in RESOLVED_STATUSES
            rec["similarite_max"] = round(sim, 3)
            rec["ticket_proche"] = proche
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    records = [
        {**t.model_dump(), "similarite_max": round(sim, 3), "ticket_proche": proche}
        for t, sim, proche in retenus
    ]
    susp = _write_review_csv(review_path, records)

    quasi = sum(1 for _, sim, _ in retenus if sim >= SIM_FLAG)
    print(f"\n✅ {len(retenus)} candidats retenus → {candidates_path}")
    print(f"   Feuille de relecture → {review_path}")
    print(
        f"   Écartés (dédup exacte) : {ecartes_exacts} ; « quasi-copie » (Jaccard ≥ "
        f"{SIM_FLAG}) : {quasi} ; descriptions suspectes : {susp}"
    )
    print("   ⚠️ RIEN n'est scellé — relis/corrige le CSV avant l'ingestion (J2, étape suivante).")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Génère les candidats du gold set (J2).")
    p.add_argument("--n", type=int, default=150)
    p.add_argument("--batch-size", type=int, default=6)
    p.add_argument("--seed", type=int, default=2026, help="≠ 42 (seed du train) → étanchéité.")
    p.add_argument("--host", default=os.environ.get("OLLAMA_HOST", "http://localhost:11434"))
    p.add_argument("--model", default="qwen2.5:7b")
    p.add_argument("--temperature", type=float, default=0.8)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--from-candidates",
        default=None,
        help="Régénère seulement le CSV depuis un gold_candidates_*.jsonl existant (sans LLM).",
    )
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
