"""
Ingestion du 3ᵉ jeu d'évaluation : VALIDATION EXTERNE (tickets réels).

But : sortir du corpus 100 % synthétique. Ces 46 tickets sont de **vrais e-mails
de support FR**, ré-étiquetés à la main dans notre taxonomie. Ils constituent une
**validation externe** — le test le plus honnête du module IA.

Source : Kaggle « Customer IT Support Ticket Dataset » (Tobias Bueck), **CC BY 4.0**.
46 tickets FR sélectionnés et ré-étiquetés (catégorie + priorité) à la main.

Entrée : `artifacts/gold/validation_externe_complet.xlsx`. Colonnes :
    Sujet | Corps | Réponse agent | Catég. suggérée | Prio. source |
    Catégorie corrigée | Priorité corrigée | Valider (O/N) | Notes

Règles de scellement :
  1. On ne garde QUE les lignes validées « O » **avec un sujet non vide**
     (les lignes « O » sans sujet — corps seul — sont écartées ; c'est le
     périmètre relu = 46 tickets).
  2. Étiquette d'or = correction si renseignée, sinon la valeur suggérée
     (catégorie / priorité).
  3. `text` de prédiction = **Sujet + Corps** — **JAMAIS** la réponse de l'agent
     (elle n'existe pas au moment de la prédiction en production). La réponse est
     conservée à part (`reponse_agent`) pour valider le RAG au J6.

Sortie (versionnée, JAMAIS utilisée à l'entraînement) :
  - `gold/validation_externe.jsonl`
  - `gold/validation_externe_manifest.json`

Usage (depuis `ml/`) :
    python -m smart_ticketing_ml.data.ingest_validation_externe
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from ..taxonomy import PRIORITY_LABELS

SOURCE = "Kaggle « Customer IT Support Ticket Dataset » (Tobias Bueck), CC BY 4.0"


def _strip_accents(s: str) -> str:
    return s.lower().translate(str.maketrans("àâäéèêëîïôöùûüç", "aaaeeeeiioouuuc"))


def _cell(v):
    return v.strip() if isinstance(v, str) else v


def _find_header(rows: list[tuple]) -> tuple[int, dict[str, int]]:
    """Repère la ligne d'en-tête (Sujet + Valider) et mappe clé_interne → colonne."""
    for i, row in enumerate(rows):
        h = [_strip_accents(c) if isinstance(c, str) else "" for c in row]
        m: dict[str, int] = {}
        for j, c in enumerate(h):
            if "valider" in c:
                m.setdefault("valider", j)
            elif "notes" in c:
                m.setdefault("notes", j)
            elif "sujet" in c:
                m.setdefault("subject", j)
            elif "corps" in c:
                m.setdefault("body", j)
            elif "reponse" in c:
                m.setdefault("answer", j)
            elif "sugg" in c:
                m.setdefault("cat_sugg", j)
            elif c.startswith("categorie corrig"):
                m.setdefault("cat_corr", j)
            elif "prio" in c and "source" in c:
                m.setdefault("prio_source", j)
            elif "priorite corrig" in c:
                m.setdefault("prio_corr", j)
        if {"subject", "body", "valider", "cat_sugg"} <= m.keys():
            return i, m
    raise RuntimeError("En-tête introuvable (colonnes Sujet/Corps/Catég. suggérée/Valider attendues).")


def run(args: argparse.Namespace) -> int:
    try:
        import openpyxl
    except ImportError:
        print("❌ openpyxl manquant. Installe : pip install openpyxl", file=sys.stderr)
        return 1

    xlsx = Path(args.xlsx)
    if not xlsx.exists():
        print(f"❌ Introuvable : {xlsx}", file=sys.stderr)
        return 1

    ws = openpyxl.load_workbook(xlsx, read_only=True, data_only=True).active
    rows = list(ws.iter_rows(values_only=True))
    hdr, col = _find_header(rows)

    kept: list[dict] = []
    n_o = n_o_sans_sujet = 0
    n_cat_corr = n_prio_corr = 0
    warnings: list[str] = []

    for row in rows[hdr + 1:]:
        if not any(c is not None for c in row):
            continue
        get = lambda k: _cell(row[col[k]]) if k in col and col[k] < len(row) else None

        if str(get("valider") or "").strip().upper() != "O":
            continue
        n_o += 1

        subject = get("subject")
        if not subject:  # « O » mais sujet vide → hors périmètre relu (46)
            n_o_sans_sujet += 1
            continue

        body = get("body") or ""
        cat_sugg, prio_sugg = get("cat_sugg"), get("prio_source")
        cat_corr, prio_corr = get("cat_corr"), get("prio_corr")
        categorie = cat_corr or cat_sugg
        priorite = prio_corr or prio_sugg

        if cat_corr and cat_corr != cat_sugg:
            n_cat_corr += 1
        if prio_corr and prio_corr != prio_sugg:
            n_prio_corr += 1
        if priorite not in PRIORITY_LABELS:
            warnings.append(f"Priorité hors enum : {priorite!r} (sujet {subject!r}).")

        kept.append({
            "id": f"ext-{len(kept) + 1:04d}",
            "titre": subject,
            "description": body,
            "categorie": categorie,
            "priorite": priorite,
            "categorie_source": cat_sugg,
            "priorite_source": prio_sugg,
            "corrige_categorie": bool(cat_corr and cat_corr != cat_sugg),
            "corrige_priorite": bool(prio_corr and prio_corr != prio_sugg),
            "reponse_agent": get("answer") or None,   # gardée à part (RAG J6) — jamais dans `text`
            "reel": True,
            "synthetique": False,
            "source": SOURCE,
            "notes": get("notes") or None,
        })

    if not kept:
        print("❌ Aucun ticket retenu.", file=sys.stderr)
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for rec in kept:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    dist_cat = Counter(r["categorie"] for r in kept)
    dist_prio = Counter(r["priorite"] for r in kept)
    manifest = {
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE,
        "licence": "CC BY 4.0",
        "source_xlsx": str(xlsx),
        "n_tickets": len(kept),
        "regle_perimetre": "Valider = O ET sujet non vide",
        "o_total": n_o,
        "o_sans_sujet_ecartes": n_o_sans_sujet,
        "corrections_categorie": n_cat_corr,
        "corrections_priorite": n_prio_corr,
        "repartition_categorie": dict(dist_cat),
        "repartition_priorite": dict(dist_prio),
        "sha256": digest,
        "avertissements": warnings,
        "regle": "validation externe réelle — JAMAIS utilisée à l'entraînement ; "
                 "`text` = sujet + corps (jamais la réponse de l'agent).",
    }
    (out.parent / "validation_externe_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ Validation externe scellée → {out} ({len(kept)} tickets réels)")
    print(f"   « O » total : {n_o}  |  écartés (O sans sujet) : {n_o_sans_sujet}")
    print(f"   Corrections catégorie : {n_cat_corr}  |  priorité : {n_prio_corr}")
    print(f"   Répartition catégorie : {dict(dist_cat)}")
    print(f"   Répartition priorité  : {dict(dist_prio)}")
    print(f"   Source : {SOURCE}")
    print(f"   SHA-256 : {digest[:16]}…")
    if warnings:
        print(f"   ⚠️ {len(warnings)} avertissement(s).", file=sys.stderr)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Scelle le jeu de validation externe réel (.xlsx).")
    p.add_argument("--xlsx", default="artifacts/gold/validation_externe_complet.xlsx")
    p.add_argument("--out", default="gold/validation_externe.jsonl")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
