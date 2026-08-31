"""
J6a — Validation humaine du juge de pertinence (avant tout usage du juge).

Sans validation contre des jugements humains, un juge LLM est circulaire (§10). On
construit **25 paires (requête gold, document candidat) équilibrées** couvrant les trois
niveaux 0/1/2 — la variété vient du **rang de retrieval / de la catégorie** (métadonnées
objectives), JAMAIS de la note du juge (anti-circularité). Fedi note **en aveugle** (sans
voir la note du juge ni le niveau attendu) ; on révèle ; on calcule le **κ de Cohen pondéré
quadratique** (ordinal), + accord exact brut et accord binarisé.

Construction (8 / 9 / 8) :
- **niveau 2 attendu** : requête + son meilleur candidat RRF (rang 1) ;
- **niveau 1 attendu** : requête + doc au **rang intermédiaire du dense** (~6-14) — même sujet,
  autre problème → partiel réel (le « même catégorie au hasard » donnait surtout des 0) ;
- **niveau 0 attendu** : requête + ticket KB **autre catégorie** (négatif franc).

Règle de décision PRÉ-ENREGISTRÉE (κ_w quadratique) : ≥ 0.60 → juge validé ; 0.40–0.60 →
une révision de prompt puis re-validation sur échantillon frais ; < 0.40 → juge rejeté,
repli sur le garde-fou catégorie (cf. journal J6).

Usage (depuis ml/) :
    python -m smart_ticketing_ml.eval.judge_validation exporter   # construit + juge + xlsx aveugle
    python -m smart_ticketing_ml.eval.judge_validation kappa      # après remplissage du xlsx
"""

from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path
from statistics import mean, median

import psycopg

from ..db import database_url
from ..retrieval import hybrid
from .judge import RUBRIQUE, Juge

RACINE = Path(__file__).resolve().parents[2]  # .../ml
ART = RACINE / "artifacts" / "eval"
PAIRES_PATH = ART / "j6_validation_paires.jsonl"        # avec niveau attendu + note juge (privé)
XLSX_PATH = ART / "j6_validation_juge.xlsx"             # fiche de notation AVEUGLE (pour Fedi)
CACHE_JUGE = ART / "validation_judgments.jsonl"         # cache juge séparé (hors pool)
RAPPORT_DIR = RACINE / "eval" / "reports" / "j6"

N_L2, N_L1, N_L0 = 8, 9, 8
SEED = 42


def _charger_jsonl(path: str | Path) -> list[dict]:
    return [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]


def _kb_par_categorie(cur: psycopg.Cursor) -> dict[str, list[tuple]]:
    """Tous les docs KB groupés par catégorie : {cat -> [(id, titre, desc, resolution, cat)]}."""
    cur.execute(
        """
        SELECT t.id, t.titre, t.description,
               (SELECT contenu FROM commentaires WHERE ticket_id = t.id ORDER BY id LIMIT 1),
               c.nom
        FROM tickets t LEFT JOIN categories c ON c.id = t.categorie_id
        WHERE t.synthetique AND t.statut = ANY(%s)
        """,
        (list(hybrid.config.STATUTS_KB),),
    )
    par_cat: dict[str, list[tuple]] = {}
    for tid, titre, desc, reso, cat in cur.fetchall():
        par_cat.setdefault(cat, []).append((tid, titre, desc, reso or "", cat))
    return par_cat


def construire_paires(cur: psycopg.Cursor, seed: int = SEED) -> list[dict]:
    """25 paires équilibrées. Niveau attendu = signal rang/catégorie (jamais la note du juge)."""
    gold = _charger_jsonl(RACINE / "gold" / "gold.jsonl")
    kb = _kb_par_categorie(cur)
    rng = random.Random(seed)
    rng.shuffle(gold)

    niveaux = ["L2"] * N_L2 + ["L1"] * N_L1 + ["L0"] * N_L0
    rng.shuffle(niveaux)  # ordre mélangé → le xlsx n'est pas groupé par niveau

    paires: list[dict] = []
    for r, niveau in zip(gold, niveaux):
        qid, qcat = r["id"], r["categorie"]
        qtext = f"{r['titre']}\n{r['description']}"

        if niveau == "L2":
            rrf = hybrid.retrieve(cur, qtext, "rrf")
            if not rrf:
                continue
            d = rrf[0]
            doc = (d.id, d.titre, d.description, d.resolution, d.categorie)
        elif niveau == "L1":
            # Rang INTERMÉDIAIRE du dense (~6-14) : topiquement proche mais PAS le match
            # exact → problème lié mais différent = grade 1 plausible. (« Même catégorie »
            # au hasard donnait surtout des 0 : trop grossier.) Signal = rang de retrieval,
            # jamais la note du juge (anti-circularité).
            dense = hybrid.retrieve(cur, qtext, "dense")
            if len(dense) < 7:
                continue
            d = dense[rng.randint(6, min(14, len(dense) - 1))]
            doc = (d.id, d.titre, d.description, d.resolution, d.categorie)
        else:  # L0
            autres = [x for cat, docs in kb.items() if cat != qcat for x in docs]
            doc = rng.choice(autres)

        did, dt, dd, dr, dcat = doc
        paires.append({
            "n": len(paires) + 1, "niveau_attendu": niveau,
            "query_id": qid, "requete": qtext, "requete_cat": qcat,
            "doc_id": did, "doc": f"{dt}\n{dd}\n{dr}", "doc_cat": dcat,
        })
        if len(paires) == N_L2 + N_L1 + N_L0:
            break
    return paires


def _exporter_xlsx(paires: list[dict]) -> None:
    """Fiche de notation AVEUGLE : consignes (rubrique identique au juge) + 25 paires,
    SANS niveau attendu ni note du juge. Fedi remplit la colonne « Votre note (0/1/2) »."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font

    wb = Workbook()
    consignes = wb.active
    consignes.title = "Consignes"
    consignes["A1"] = "Notation aveugle du juge de pertinence — rubrique 0/1/2 (identique au juge)"
    consignes["A1"].font = Font(bold=True, size=12)
    consignes["A3"] = (
        "Pour chaque paire (TICKET ENTRANT, TICKET PASSÉ RÉSOLU), juge si la RÉSOLUTION du "
        "ticket passé aiderait à résoudre le ticket entrant. Note 0, 1 ou 2 :"
    )
    for i, ligne in enumerate(RUBRIQUE.split("\n"), start=5):
        consignes[f"A{i}"] = ligne
    consignes["A12"] = "→ Remplis la colonne « Votre note (0/1/2) » de l'onglet « Notation », puis sauvegarde."
    consignes["A12"].font = Font(bold=True)
    consignes.column_dimensions["A"].width = 120

    ws = wb.create_sheet("Notation")
    entetes = ["n", "TICKET ENTRANT (requête)", "TICKET PASSÉ RÉSOLU (candidat)", "Votre note (0/1/2)"]
    ws.append(entetes)
    for c in ws[1]:
        c.font = Font(bold=True)
    for p in paires:
        ws.append([p["n"], p["requete"], p["doc"], ""])
    ws.column_dimensions["A"].width = 5
    ws.column_dimensions["B"].width = 60
    ws.column_dimensions["C"].width = 80
    ws.column_dimensions["D"].width = 16
    for row in ws.iter_rows(min_row=2):
        row[1].alignment = Alignment(wrap_text=True, vertical="top")
        row[2].alignment = Alignment(wrap_text=True, vertical="top")
    ART.mkdir(parents=True, exist_ok=True)
    wb.save(XLSX_PATH)


def exporter() -> None:
    """Construit les 25 paires, les fait juger (chronométré), écrit le xlsx aveugle + le jsonl privé."""
    with psycopg.connect(database_url()) as conn, conn.cursor() as cur:
        paires = construire_paires(cur)

    juge = Juge(cache_path=CACHE_JUGE)
    print(f"Juge = {juge.model}. {len(paires)} paires à juger (chronométré)…", flush=True)
    durees: list[float] = []
    for i, p in enumerate(paires):
        t = time.perf_counter()
        res = juge.juger(p["query_id"], p["requete"], p["doc_id"], p["doc"])
        dt = time.perf_counter() - t
        durees.append(dt)
        p["grade_juge"] = res["grade"]
        p["justif_juge"] = res["justification"]
        if i == 0:
            print(f"  1er jugement (chargement modèle inclus) : {dt:.1f}s", flush=True)

    ART.mkdir(parents=True, exist_ok=True)
    with PAIRES_PATH.open("w", encoding="utf-8") as f:
        for p in paires:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    _exporter_xlsx(paires)

    chauds = durees[1:] or durees
    dist = {niv: sum(1 for p in paires if p["niveau_attendu"] == niv) for niv in ("L2", "L1", "L0")}
    print(f"\nPaires écrites → {PAIRES_PATH}")
    print(f"Fiche AVEUGLE  → {XLSX_PATH}")
    print(f"Construction (niveaux attendus, NON montrés) : {dist}")
    print(f"Jugement chaud : médiane={median(chauds):.1f}s  moyenne={mean(chauds):.1f}s  "
          f"(sur {len(chauds)}) → estimation par-jugement pour le run complet.")


def _lire_notes_humaines(path: Path = XLSX_PATH) -> dict[int, int]:
    from openpyxl import load_workbook
    wb = load_workbook(path, data_only=True)
    ws = wb["Notation"]
    notes: dict[int, int] = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        n, _, _, note = row[0], row[1], row[2], row[3]
        if n is None or note is None or str(note).strip() == "":
            continue
        notes[int(n)] = int(note)
    return notes


def kappa(notes_path: Path = XLSX_PATH) -> int:
    """Après remplissage du xlsx : κ_w quadratique + accords, applique la règle par bandes."""
    from sklearn.metrics import cohen_kappa_score

    paires = _charger_jsonl(PAIRES_PATH)
    notes = _lire_notes_humaines(notes_path)
    manquants = [p["n"] for p in paires if p["n"] not in notes]
    if manquants:
        print(f"❌ {len(manquants)} note(s) humaine(s) manquante(s) : {manquants[:10]}. Remplis le xlsx.")
        return 1

    y_h = [notes[p["n"]] for p in paires]
    y_j = [p["grade_juge"] for p in paires]
    kw = cohen_kappa_score(y_h, y_j, weights="quadratic")
    accord_exact = mean(1.0 if h == j else 0.0 for h, j in zip(y_h, y_j))
    bh = [1 if x >= 1 else 0 for x in y_h]
    bj = [1 if x >= 1 else 0 for x in y_j]
    k_bin = cohen_kappa_score(bh, bj)
    accord_bin = mean(1.0 if h == j else 0.0 for h, j in zip(bh, bj))

    if kw >= 0.60:
        verdict = "VALIDÉ (κ_w ≥ 0.60) → juge utilisé pour les métriques de retrieval"
    elif kw >= 0.40:
        verdict = "MODÉRÉ (0.40–0.60) → une révision de prompt puis re-validation sur échantillon frais"
    else:
        verdict = "REJETÉ (κ_w < 0.40) → repli sur le garde-fou catégorie"

    modele_juge = next((r.get("modele") for r in _charger_jsonl(CACHE_JUGE)), None) if CACHE_JUGE.exists() else None
    payload = {
        "n_paires": len(paires), "modele_juge": modele_juge,
        "kappa_w_quadratique": round(kw, 4), "kappa_binaire": round(k_bin, 4),
        "accord_exact": round(accord_exact, 4), "accord_binarise": round(accord_bin, 4),
        "seuil_pre_enregistre": 0.60, "verdict": verdict,
        "notes_humaines": y_h, "notes_juge": y_j,
        "niveaux_attendus": [p["niveau_attendu"] for p in paires],
    }
    RAPPORT_DIR.mkdir(parents=True, exist_ok=True)
    (RAPPORT_DIR / "judge_validation.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    _ecrire_rapport_md(payload, paires)

    from collections import Counter
    dh = dict(sorted(Counter(y_h).items()))
    dj = dict(sorted(Counter(y_j).items()))
    print(f"\n── Validation du juge ({len(paires)} paires) ─────────────────")
    print(f"  distribution humaine : {dh}   |  juge : {dj}")
    print(f"  κ_w quadratique (ordinal) : {kw:.3f}   [seuil pré-enregistré 0.60]")
    print(f"  κ binaire (pertinent≥1)   : {k_bin:.3f}")
    print(f"  accord exact              : {accord_exact:.3f}  ({sum(1 for h,j in zip(y_h,y_j) if h==j)}/{len(paires)})")
    print(f"  accord binarisé           : {accord_bin:.3f}")
    print(f"  → {verdict}")

    desaccords = [(p, h, j) for p, h, j in zip(paires, y_h, y_j) if h != j]
    print(f"\n── Désaccords ({len(desaccords)}/{len(paires)}) ─────────────────")
    for p, h, j in sorted(desaccords, key=lambda x: -abs(x[1] - x[2])):
        req = p["requete"].splitlines()[0][:40]
        doc = p["doc"].splitlines()[0][:40]
        print(f"  n{p['n']:>2} [{p['niveau_attendu']}] humain={h} juge={j} (écart {abs(h-j)})  "
              f"«{req}» vs «{doc}»")
    print(f"\nRapport → {RAPPORT_DIR / 'judge_validation.md'}")
    return 0


def _ecrire_rapport_md(payload: dict, paires: list[dict]) -> None:
    L = ["# J6a — Validation humaine du juge de pertinence\n"]
    L.append(f"- **Paires** : {payload['n_paires']} (construction équilibrée {N_L2}/{N_L1}/{N_L0}, "
             "niveaux attendus par rang/catégorie, non montrés à la notation).")
    L.append(f"- **κ_w quadratique** : **{payload['kappa_w_quadratique']}** "
             f"(seuil pré-enregistré {payload['seuil_pre_enregistre']}) → {payload['verdict']}")
    L.append(f"- κ binaire : {payload['kappa_binaire']} · accord exact : {payload['accord_exact']} · "
             f"accord binarisé : {payload['accord_binarise']}\n")
    L.append("| n | niveau attendu | note humaine | note juge |")
    L.append("|---|---|---|---|")
    for p, h, j in zip(paires, payload["notes_humaines"], payload["notes_juge"]):
        L.append(f"| {p['n']} | {p['niveau_attendu']} | {h} | {j} |")
    from collections import Counter
    dh = dict(sorted(Counter(payload["notes_humaines"]).items()))
    L.append(f"\n> Limite (échantillonnage) : distribution humaine {dh} — seulement **{dh.get(1, 0)} "
             f"grade-1** → le κ mesure surtout la distinction **pertinent / non-pertinent** "
             f"(κ binaire = {payload['kappa_binaire']}, accord binarisé = {payload['accord_binarise']}) ; "
             "la nuance grade-1 est **peu échantillonnée**. Les 2 seuls désaccords sont des 1-vs-2 sur "
             "des quasi-doublons (le juge est légèrement plus conservateur que l'humain).")
    L.append("\n> Limite (portée) : κ validé sur requêtes **internes courtes** (gold). L'extrapolation "
             "aux requêtes-emails longues suppose une capacité de jugement stable, non re-vérifiée "
             "formellement ; garde-fou = quelques paires externes relues pendant le run complet.")
    (RAPPORT_DIR / "judge_validation.md").write_text("\n".join(L) + "\n", encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(description="Validation humaine du juge de pertinence (J6a).")
    p.add_argument("mode", choices=["exporter", "kappa"])
    p.add_argument("--notes", default=None, help="Chemin du xlsx rempli (défaut : j6_validation_juge.xlsx).")
    args = p.parse_args()
    if args.mode == "exporter":
        exporter()
        return 0
    return kappa(Path(args.notes) if args.notes else XLSX_PATH)


if __name__ == "__main__":
    raise SystemExit(main())
