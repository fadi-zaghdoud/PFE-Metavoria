"""
Greffe 3 (flywheel) — D1.2 : export d'un lot de tickets Kaggle à RELIRE à l'aveugle.

Sort 50 tickets (par défaut 17 Réseau / 17 Logiciel / 16 Matériel selon l'auto-label —
les 3 catégories bien couvertes) depuis le pool des 242 réels (déjà hors test). Le CSV
de relecture `a_relire.csv` a une colonne `categorie` VIDE et ne contient NI l'auto-label
NI les signaux → **jugement humain indépendant**. L'auto-label part dans un fichier séparé
`auto_labels.csv` (à NE PAS ouvrir pendant la relecture), pour la réconciliation D1.3.

Étanchéité : `porte_etancheite(lot, test)` est jouée AVANT l'export (fail dur).

Usage (depuis ml/) :
    PYTHONPATH=. python -m smart_ticketing_ml.flywheel.exporter_lot
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from ..eval.dataset import Exemple, load_exemples, porte_etancheite

# Les 5 catégories courantes (§6.5) — orthographe EXACTE attendue à la relecture.
LIBELLES_VALIDES = ["Réseau", "Logiciel", "Matériel", "Accès", "Autre"]
SEED = 42


def _charger_pool(chemin: Path) -> list[dict]:
    return [json.loads(l) for l in chemin.open(encoding="utf-8") if l.strip()]


def selectionner(pool: list[dict], cibles: dict[str, int], seed: int) -> list[dict]:
    """Échantillon stratifié DÉTERMINISTE par auto-label (`categorie`)."""
    par_cat: dict[str, list[dict]] = defaultdict(list)
    for rec in pool:
        par_cat[rec.get("categorie")].append(rec)
    rnd = random.Random(seed)
    choisis: list[dict] = []
    for cat, k in cibles.items():
        groupe = sorted(par_cat.get(cat, []), key=lambda r: r["id"])
        if len(groupe) < k:
            raise SystemExit(f"Pool insuffisant pour {cat} : {len(groupe)} < {k} demandés.")
        choisis.extend(rnd.sample(groupe, k))
    choisis.sort(key=lambda r: r["id"])
    return choisis


def run(args: argparse.Namespace) -> int:
    pool = _charger_pool(Path(args.pool))
    test = load_exemples(args.test)
    cibles = {"Réseau": args.n_reseau, "Logiciel": args.n_logiciel, "Matériel": args.n_materiel}
    lot = selectionner(pool, cibles, args.seed)

    # ── PORTE d'étanchéité — fail dur AVANT tout export ──
    lot_ex = [
        Exemple(titre=r["titre"], description=r["description"], categorie=r["categorie"], priorite="", statut="")
        for r in lot
    ]
    jmax = porte_etancheite(lot_ex, test)  # lève RuntimeError si contamination

    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)

    # ── a_relire.csv — AVEUGLE (categorie vide, sans auto-label ni signaux), corps COMPLET ──
    f_relire = out / "a_relire.csv"
    with f_relire.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "titre", "corps", "categorie"])
        for r in lot:
            w.writerow([r["id"], r["titre"], r["description"] or "", ""])

    # ── auto_labels.csv — SÉPARÉ (ne pas ouvrir avant d'avoir fini la relecture) ──
    f_auto = out / "auto_labels.csv"
    with f_auto.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "categorie_auto", "signaux", "scores"])
        for r in lot:
            sc = " ".join(
                f"{k}:{v:g}" for k, v in sorted((r.get("mapping_scores") or {}).items(), key=lambda kv: -kv[1])
            )
            w.writerow([r["id"], r["categorie"], " ; ".join((r.get("mapping_signaux") or [])[:12]), sc])

    dist = Counter(r["categorie"] for r in lot)
    sha = hashlib.sha256(f_relire.read_bytes()).hexdigest()
    manifeste = {
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "role": "Lot à relire À L'AVEUGLE (auto-label caché) — flywheel J9",
        "libelles_valides": LIBELLES_VALIDES,
        "consigne": (
            "Remplir la colonne `categorie` de a_relire.csv avec EXACTEMENT un des "
            "libelles_valides. NE PAS ouvrir auto_labels.csv avant d'avoir terminé."
        ),
        "source_pool": str(args.pool),
        "test_ref": args.test,
        "seed": args.seed,
        "cibles": cibles,
        "distribution_auto": dict(dist),
        "n_lot": len(lot),
        "ids": [r["id"] for r in lot],
        "etancheite": {
            "porte": "porte_etancheite (exact=0 toléré, Jaccard>=0.5=0 toléré)",
            "jaccard_max_vs_test": jmax,
        },
        "sha256_a_relire": sha,
    }
    (out / "lot_manifest.json").write_text(
        json.dumps(manifeste, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"✅ Lot de {len(lot)} tickets à relire → {f_relire}")
    print(f"   distribution (auto-label, caché) : {dict(dist)}")
    print(f"   étanchéité : Jaccard max vs test = {jmax} (< 0,5) — porte franchie")
    print(f"   auto-labels (séparés)  : {f_auto}")
    print(f"   manifeste              : {out / 'lot_manifest.json'}")
    print(f"   libellés valides       : {LIBELLES_VALIDES}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Export d'un lot Kaggle à relire à l'aveugle (flywheel D1.2).")
    p.add_argument("--pool", default="real/real_train_kaggle.jsonl")
    p.add_argument("--test", default="gold/validation_externe.jsonl")
    p.add_argument("--out-dir", default="real/lot_v2")
    p.add_argument("--seed", type=int, default=SEED)
    p.add_argument("--n-reseau", type=int, default=17)
    p.add_argument("--n-logiciel", type=int, default=17)
    p.add_argument("--n-materiel", type=int, default=16)
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
