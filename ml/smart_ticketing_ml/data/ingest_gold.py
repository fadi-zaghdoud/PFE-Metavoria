"""
J2 — Scellement du GOLD SET à partir de la feuille de relecture manuelle.

Entrée : `artifacts/gold/gold_final.xlsx` — la feuille de relecture **relue et
corrigée à la main par Fedi** (c'est la relecture humaine qui fait la valeur du
gold set). Colonnes utiles :
    Titre | Description | Résolution (extrait) | Label généré |
    Catégorie corrigée | Priorité corrigée | Valider (O/N) | Notes

Règles de scellement :
  1. On ne garde QUE les lignes validées (« Valider » = O).
  2. Le label d'or = correction si renseignée, sinon le label généré.
     - catégorie  : `Catégorie corrigée` sinon la catégorie du « Label généré ».
     - priorité   : `Priorité corrigée`  sinon la priorité du « Label généré ».
     - statut     : toujours celui du « Label généré » (pas de colonne de correction).
  3. La colonne « Résolution (extrait) » du xlsx est **tronquée** (aperçu). On
     récupère la résolution INTÉGRALE depuis `gold_candidates_*.jsonl` (même
     source, jointure exacte titre+description) — sinon le gold RAG serait amputé.

Sortie (versionnée et committée, JAMAIS utilisée à l'entraînement) :
  - `gold/gold.jsonl`          : un ticket d'or par ligne.
  - `gold/gold_manifest.json`  : provenance + comptes (reproductibilité).

Usage (depuis le dossier `ml/`) :
    python -m smart_ticketing_ml.data.ingest_gold
    python -m smart_ticketing_ml.data.ingest_gold --xlsx artifacts/gold/gold_final.xlsx
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from ..taxonomy import OPEN_STATUSES, PRIORITY_LABELS, RESOLVED_STATUSES

STATUSES = set(RESOLVED_STATUSES) | set(OPEN_STATUSES)

# En-têtes de colonnes attendues (comparées en minuscules, sans accents) → clé interne.
_HEADER_MAP = {
    "titre": "titre",
    "description": "description",
    "resolution": "resolution",       # « Résolution (extrait) »
    "label genere": "label",
    "categorie corrigee": "cat_corr",
    "priorite corrigee": "prio_corr",
    "valider": "valider",             # « Valider (O/N) »
    "notes": "notes",
}


def _strip_accents(s: str) -> str:
    table = str.maketrans("àâäéèêëîïôöùûüç", "aaaeeeeiioouuuc")
    return s.lower().translate(table)


def _norm(s) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _cell(v):
    return v.strip() if isinstance(v, str) else v


def _find_header(rows: list[tuple]) -> tuple[int, dict[str, int]]:
    """Repère la ligne d'en-tête (celle qui contient Titre + Valider) et renvoie
    (index, mapping clé_interne → index de colonne). Robuste à un décalage de
    lignes de titre/consignes en tête de feuille."""
    for i, row in enumerate(rows):
        norm_cells = [_strip_accents(c) if isinstance(c, str) else "" for c in row]
        mapping: dict[str, int] = {}
        for j, nc in enumerate(norm_cells):
            for prefix, key in _HEADER_MAP.items():
                if nc.startswith(prefix):
                    mapping.setdefault(key, j)
        if "titre" in mapping and "valider" in mapping and "label" in mapping:
            return i, mapping
    raise RuntimeError("En-tête introuvable (colonnes Titre/Label généré/Valider attendues).")


def _parse_label(label: str) -> tuple[str, str, str]:
    """« Logiciel / CRITIQUE / RESOLU » → (categorie, priorite, statut)."""
    parts = [p.strip() for p in str(label).split("/")]
    if len(parts) != 3:
        raise ValueError(f"Label généré inattendu : {label!r} (attendu 'cat / prio / statut').")
    return parts[0], parts[1], parts[2]


def _load_candidates(path: str | None) -> tuple[dict[tuple[str, str], dict], str | None]:
    """Index (titre normalisé, description normalisée) → candidat, pour récupérer
    la résolution intégrale (le xlsx n'en contient qu'un extrait tronqué).
    Renvoie (index, chemin_source) ; index vide si aucun fichier de candidats."""
    if path is None:
        found = sorted(glob.glob("artifacts/gold/gold_candidates_*.jsonl"))
        if not found:
            return {}, None
        path = found[-1]
    idx: dict[tuple[str, str], dict] = {}
    for line in open(path, encoding="utf-8"):
        c = json.loads(line)
        idx[(_norm(c["titre"]), _norm(c["description"]))] = c
    return idx, path


def run(args: argparse.Namespace) -> int:
    try:
        import openpyxl
    except ImportError:
        print("❌ openpyxl manquant. Installe : pip install openpyxl", file=sys.stderr)
        return 1

    xlsx_path = Path(args.xlsx)
    if not xlsx_path.exists():
        print(f"❌ Introuvable : {xlsx_path}", file=sys.stderr)
        return 1

    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb[args.sheet] if args.sheet else wb.active
    rows = list(ws.iter_rows(values_only=True))
    hdr_idx, col = _find_header(rows)

    cand_idx, cand_path = _load_candidates(args.candidates)
    if not cand_idx:
        print("⚠️ Aucun gold_candidates_*.jsonl trouvé → résolutions limitées à l'extrait du xlsx.",
              file=sys.stderr)

    kept: list[dict] = []
    seen_valider = Counter()
    n_cat_corr = n_prio_corr = 0        # cellules de correction renseignées
    n_cat_change = n_prio_change = 0    # corrections qui changent réellement la valeur
    n_resol_recuperee = n_resol_manquante = 0
    warnings: list[str] = []

    for row in rows[hdr_idx + 1:]:
        if not any(c is not None for c in row):
            continue
        get = lambda key: _cell(row[col[key]]) if key in col and col[key] < len(row) else None

        valider = str(get("valider") or "").strip().upper()
        seen_valider[valider or "∅"] += 1
        if valider != "O":
            continue

        titre = get("titre")
        description = get("description")
        if not titre or not description:
            warnings.append(f"Ligne validée sans titre/description : {titre!r} — ignorée.")
            continue

        cat_gen, prio_gen, statut = _parse_label(get("label"))

        cat_corr = get("cat_corr")
        prio_corr = get("prio_corr")
        categorie = cat_corr or cat_gen
        priorite = prio_corr or prio_gen

        if cat_corr:
            n_cat_corr += 1
            n_cat_change += cat_corr != cat_gen
        if prio_corr:
            n_prio_corr += 1
            n_prio_change += prio_corr != prio_gen

        if priorite not in PRIORITY_LABELS:
            warnings.append(f"Priorité hors enum : {priorite!r} (ticket {titre!r}).")
        if statut not in STATUSES:
            warnings.append(f"Statut hors enum : {statut!r} (ticket {titre!r}).")

        # Résolution intégrale depuis les candidats (le xlsx est tronqué).
        cand = cand_idx.get((_norm(titre), _norm(description)))
        resolution = get("resolution")
        if cand and cand.get("resolution"):
            if resolution and str(resolution).rstrip().endswith(("…", "...")):
                n_resol_recuperee += 1
            resolution = cand["resolution"]
        else:
            n_resol_manquante += 1

        kept.append({
            "id": f"gold-{len(kept) + 1:04d}",
            "titre": titre,
            "description": description,
            "resolution": resolution,
            "categorie": categorie,
            "priorite": priorite,
            "statut": statut,
            "categorie_generee": cat_gen,
            "priorite_generee": prio_gen,
            "corrige_categorie": bool(cat_corr and cat_corr != cat_gen),
            "corrige_priorite": bool(prio_corr and prio_corr != prio_gen),
            "synthetique": True,
            "notes": get("notes") or None,
        })

    if not kept:
        print("❌ Aucune ligne validée (O) — rien à sceller.", file=sys.stderr)
        return 1

    out_dir = Path(args.out).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out)
    with out_path.open("w", encoding="utf-8") as fh:
        for rec in kept:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    digest = hashlib.sha256(out_path.read_bytes()).hexdigest()
    dist_cat = Counter(r["categorie"] for r in kept)
    dist_prio = Counter(r["priorite"] for r in kept)
    dist_statut = Counter(r["statut"] for r in kept)

    manifest = {
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_xlsx": str(xlsx_path),
        "source_candidats": cand_path,
        "n_gold": len(kept),
        "n_candidats_lus": sum(seen_valider.values()),
        "repartition_valider": dict(seen_valider),
        "corrections_categorie_cellules": n_cat_corr,
        "corrections_categorie_effectives": n_cat_change,
        "corrections_priorite_cellules": n_prio_corr,
        "corrections_priorite_effectives": n_prio_change,
        "resolutions_integrales_recuperees": n_resol_recuperee,
        "resolutions_non_appariees": n_resol_manquante,
        "repartition_categorie": dict(dist_cat),
        "repartition_priorite": dict(dist_prio),
        "repartition_statut": dict(dist_statut),
        "sha256_gold_jsonl": digest,
        "avertissements": warnings,
        "regle": "gold set relu à la main — JAMAIS utilisé à l'entraînement.",
    }
    (out_dir / "gold_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"✅ Gold set scellé → {out_path} ({len(kept)} tickets)")
    print(f"   Rejetés (Valider≠O) : {sum(v for k, v in seen_valider.items() if k != 'O')}"
          f"  |  lus : {sum(seen_valider.values())}")
    print(f"   Corrections catégorie : {n_cat_corr} cellules ({n_cat_change} changements réels)")
    print(f"   Corrections priorité  : {n_prio_corr} cellules ({n_prio_change} changements réels)")
    print(f"   Résolutions intégrales récupérées : {n_resol_recuperee}"
          f"  |  non appariées : {n_resol_manquante}")
    print(f"   Répartition catégorie : {dict(dist_cat)}")
    print(f"   Répartition priorité  : {dict(dist_prio)}")
    print(f"   Répartition statut    : {dict(dist_statut)}")
    print(f"   SHA-256 : {digest[:16]}…  |  manifeste → {out_dir / 'gold_manifest.json'}")
    if warnings:
        print(f"   ⚠️ {len(warnings)} avertissement(s) :", file=sys.stderr)
        for w in warnings:
            print(f"      - {w}", file=sys.stderr)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Scelle le gold set depuis la feuille de relecture (.xlsx).")
    p.add_argument("--xlsx", default="artifacts/gold/gold_final.xlsx")
    p.add_argument("--sheet", default=None, help="Nom de la feuille (défaut : active).")
    p.add_argument("--candidates", default=None,
                   help="gold_candidates_*.jsonl pour la résolution intégrale (défaut : le plus récent).")
    p.add_argument("--out", default="gold/gold.jsonl")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
