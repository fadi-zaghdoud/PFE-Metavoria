"""
Greffe 3 (flywheel) — D1.3 : réconciliation de la relecture À L'AVEUGLE vs l'auto-label.

Compare la catégorie relue à la main (a_relire.csv, remplie SANS voir l'auto) à l'auto-label
(auto_labels.csv). Produit :
  - une VALIDATION DURE (toute case vide ou libellé invalide → échec, on force une relecture
    propre avant de construire le train) ;
  - le **taux de désaccord** relu vs auto — le chiffre pour le mémoire (quantifie le bruit de
    l'auto-mapper sur un échantillon PROPRE, comparable au spot-check J5+ ~87 %) ;
  - la **matrice auto → relu** (où l'auto s'est trompé).

Usage (depuis ml/) :
    PYTHONPATH=. python -m smart_ticketing_ml.flywheel.reconcilier_relecture
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from .exporter_lot import LIBELLES_VALIDES


def _lire_csv(chemin: Path) -> list[dict]:
    return list(csv.DictReader(chemin.open(encoding="utf-8-sig")))


def _markdown(m: dict) -> str:
    L: list[str] = []
    L.append("# Flywheel D1.3 — Réconciliation relecture à l'aveugle vs auto-label\n")
    L.append(f"- **Date** : {m['date']}  |  **n** : {m['n']} tickets relus à l'aveugle")
    L.append(f"- **Taux de désaccord (relu ≠ auto)** : **{m['n_desaccords']}/{m['n']} = {m['taux']:.0%}**")
    L.append(
        f"- **Justesse de l'auto-mapper sur cet échantillon propre** : **{1 - m['taux']:.0%}** "
        "(réf. J5+ spot-check r2 ≈ 87 %)\n"
    )
    L.append("## Distribution des catégories RELUES (jugement humain)\n")
    L.append("| Catégorie | n |")
    L.append("|---|---|")
    for c in LIBELLES_VALIDES:
        L.append(f"| {c} | {m['dist_relu'].get(c, 0)} |")
    L.append("")
    L.append("## Matrice auto → relu (ligne = auto-label, colonne = relu)\n")
    cats = LIBELLES_VALIDES
    L.append("| auto \\\\ relu | " + " | ".join(cats) + " |")
    L.append("|" + "---|" * (len(cats) + 1))
    for a in cats:
        row = m["confusion"].get(a, {})
        L.append(f"| **{a}** | " + " | ".join(str(row.get(c, 0)) for c in cats) + " |")
    L.append("")
    L.append("## Désaccords (auto → relu)\n")
    if not m["desaccords"]:
        L.append("_Aucun désaccord._")
    else:
        L.append("| id | auto | relu | titre |")
        L.append("|---|---|---|---|")
        for d in m["desaccords"]:
            L.append(f"| {d['id']} | {d['auto']} | {d['relu']} | {(d['titre'] or '(sans titre)')[:60]} |")
    return "\n".join(L) + "\n"


def run(args: argparse.Namespace) -> int:
    dossier = Path(args.dir)
    relus = _lire_csv(dossier / "a_relire.csv")
    autos = {r["id"]: r["categorie_auto"] for r in _lire_csv(dossier / "auto_labels.csv")}

    # ── Validation DURE : chaque ligne doit porter un libellé valide ──
    invalides: list[tuple[str, str]] = []
    for r in relus:
        c = (r.get("categorie") or "").strip()
        if c not in LIBELLES_VALIDES:
            invalides.append((r["id"], c or "(vide)"))
    if invalides:
        print(f"❌ Relecture INCOMPLÈTE / libellés invalides ({len(invalides)}) :")
        for i, c in invalides[:20]:
            print(f"   {i} : « {c} »")
        print(f"   → corrige ces lignes. Libellés valides EXACTS : {LIBELLES_VALIDES}")
        return 2

    # ── Comparaison relu vs auto ──
    desaccords: list[dict] = []
    confusion: dict[str, Counter] = defaultdict(Counter)
    dist_relu: Counter = Counter()
    for r in relus:
        relu = r["categorie"].strip()
        auto = autos.get(r["id"], "?")
        dist_relu[relu] += 1
        confusion[auto][relu] += 1
        if relu != auto:
            desaccords.append({"id": r["id"], "titre": r["titre"], "auto": auto, "relu": relu})

    n = len(relus)
    taux = len(desaccords) / n if n else 0.0
    payload = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "n": n,
        "n_desaccords": len(desaccords),
        "taux": taux,
        "justesse_auto": round(1 - taux, 4),
        "dist_relu": dict(dist_relu),
        "confusion": {a: dict(c) for a, c in confusion.items()},
        "desaccords": desaccords,
    }

    (dossier / "relecture_rapport.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (dossier / "relecture_rapport.md").write_text(_markdown(payload), encoding="utf-8")

    print(f"✅ Réconciliation — {n} tickets relus")
    print(f"   TAUX DE DÉSACCORD (relu ≠ auto) : {len(desaccords)}/{n} = {taux:.0%}")
    print(f"   justesse auto-mapper sur échantillon propre : {1 - taux:.0%}")
    print(f"   distribution relue : {dict(dist_relu)}")
    print(f"   désaccords :")
    for d in desaccords:
        print(f"     {d['id']}  {d['auto']:9} → {d['relu']:9}  {(d['titre'] or '(sans titre)')[:50]}")
    print(f"   rapport : {dossier / 'relecture_rapport.md'}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Réconciliation relecture vs auto-label (flywheel D1.3).")
    p.add_argument("--dir", default="real/lot_v2")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
