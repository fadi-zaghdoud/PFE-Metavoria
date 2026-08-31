"""
Greffe 3 (flywheel) — D1.4 : construire le snapshot d'entraînement `train_v2`.

train_v2 = corpus **synthétique** (bootstrap) + **50 tickets réels relus à la main** (labels
PROPRES, jamais l'auto-label). La porte d'étanchéité est re-jouée sur les 50 ajouts (fail dur)
avant écriture. Snapshot gelé + reproductible.

Sorties :
  - `artifacts/flywheel/train_v2_<stamp>.jsonl`  (le snapshot — DÉRIVÉ → gitignoré)
  - `real/lot_v2/train_v2_manifest.json`         (provenance VERSIONNÉE → reproductible)

Usage (depuis ml/) :
    PYTHONPATH=. python -m smart_ticketing_ml.flywheel.construire_train_v2
"""

from __future__ import annotations

import argparse
import csv
import glob
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from ..eval.dataset import Exemple, load_exemples, porte_etancheite
from .exporter_lot import LIBELLES_VALIDES

CORPUS_GLOB = "artifacts/corpus/corpus_train_*.jsonl"


def _sha(chemin: Path) -> str:
    return hashlib.sha256(chemin.read_bytes()).hexdigest()


def _lire_relus(dossier: Path) -> list[dict]:
    rows = list(csv.DictReader((dossier / "a_relire.csv").open(encoding="utf-8-sig")))
    for r in rows:
        c = (r.get("categorie") or "").strip()
        if c not in LIBELLES_VALIDES:
            raise SystemExit(f"❌ {r['id']} : libellé invalide « {c or '(vide)'} » — lance d'abord D1.3.")
    return rows


def run(args: argparse.Namespace) -> int:
    # 1) Corpus synthétique (le plus récent)
    trouve = sorted(glob.glob(args.corpus_glob))
    if not trouve:
        raise SystemExit(f"Corpus synthétique introuvable ({args.corpus_glob}). Régénère-le (J1).")
    corpus_path = Path(trouve[-1])
    synth = [json.loads(l) for l in corpus_path.open(encoding="utf-8") if l.strip()]

    # 2) Les 50 relus (labels humains) + le test (pour la porte)
    dossier = Path(args.dir)
    relus = _lire_relus(dossier)
    test = load_exemples(args.test)

    # 3) PORTE d'étanchéité OBLIGATOIRE sur les 50 ajouts (fail dur)
    relus_ex = [
        Exemple(titre=r["titre"], description=r["corps"], categorie=r["categorie"], priorite="", statut="")
        for r in relus
    ]
    jmax = porte_etancheite(relus_ex, test)

    # 4) Écrire le snapshot (synthétique tagué + 50 relus tagués)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_snap = Path(args.out_dir)
    out_snap.mkdir(parents=True, exist_ok=True)
    snap = out_snap / f"train_v2_{stamp}.jsonl"
    with snap.open("w", encoding="utf-8") as fh:
        for rec in synth:
            fh.write(json.dumps({
                "titre": rec.get("titre", ""), "description": rec.get("description", ""),
                "categorie": rec["categorie"], "priorite": rec.get("priorite", ""),
                "statut": rec.get("statut", ""), "source": "synthetique",
            }, ensure_ascii=False) + "\n")
        for r in relus:
            fh.write(json.dumps({
                "titre": r["titre"], "description": r["corps"], "categorie": r["categorie"],
                "priorite": "", "statut": "RESOLU", "source": "flywheel_relu", "id": r["id"],
            }, ensure_ascii=False) + "\n")

    # 5) Manifeste VERSIONNÉ (reproductible sans stocker le gros jsonl)
    dist_synth = Counter(rec["categorie"] for rec in synth)
    dist_relu = Counter(r["categorie"] for r in relus)
    manifeste = {
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "snapshot": snap.name,
        "role": "train_v2 = synthétique (bootstrap) + 50 relus (labels propres flywheel)",
        "corpus_synthetique": {
            "fichier": corpus_path.name, "sha256": _sha(corpus_path),
            "n": len(synth), "distribution": dict(dist_synth),
        },
        "flywheel_relu": {
            "source": str(dossier / "a_relire.csv"), "n": len(relus),
            "distribution": dict(dist_relu), "ids": [r["id"] for r in relus],
        },
        "n_total": len(synth) + len(relus),
        "etancheite_50_vs_test": {
            "porte": "porte_etancheite (exact=0 toléré, Jaccard>=0.5=0 toléré)",
            "jaccard_max": jmax,
        },
        "sha256_snapshot": _sha(snap),
        "note": "Snapshot .jsonl DÉRIVÉ (gitignoré) ; ce manifeste versionné le rend reproductible.",
    }
    (dossier / "train_v2_manifest.json").write_text(
        json.dumps(manifeste, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"✅ train_v2 gelé → {snap}")
    print(f"   synthétique {len(synth)}  +  relus propres {len(relus)}  =  {len(synth) + len(relus)}")
    print(f"   distribution relus : {dict(dist_relu)}")
    print(f"   étanchéité 50 vs test : Jaccard max {jmax} — porte franchie")
    print(f"   manifeste (versionné) : {dossier / 'train_v2_manifest.json'}")
    print(f"   sha256 snapshot : {manifeste['sha256_snapshot'][:16]}…")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Construire train_v2 (synthétique + 50 relus) — flywheel D1.4.")
    p.add_argument("--corpus-glob", default=CORPUS_GLOB)
    p.add_argument("--dir", default="real/lot_v2")
    p.add_argument("--test", default="gold/validation_externe.jsonl")
    p.add_argument("--out-dir", default="artifacts/flywheel")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
