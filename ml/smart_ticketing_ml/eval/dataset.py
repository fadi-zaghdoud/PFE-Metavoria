"""
J3 — Chargement des jeux de données pour l'évaluation + contrôle d'étanchéité.

- `load_gold`  : lit le gold set scellé (`gold/gold.jsonl`, 102 tickets relus main).
- `load_train` : lit le dernier corpus d'entraînement (`artifacts/corpus/corpus_train_*.jsonl`).
- `assert_disjoint` : garantit l'étanchéité train/gold — **le gold set est le joyau**,
  un ticket de train identique (ou quasi identique) à un gold fausse les métriques.
  Deux contrôles, deux sévérités :
    1. **Exact** (description normalisée identique) → **ERREUR bloquante** (fuite nette).
    2. **Approximatif** (similarité de surface Jaccard sur titre+description, seuil
       aligné sur le pipeline gold) → **avertissement** signalé, non bloquant.

Le texte d'entrée d'un exemple = `titre` + `description` (unité de requête choisie
en §7 de la conception) ; l'étiquette = `categorie` (catégories **dynamiques** : la
liste n'est jamais codée en dur, elle émerge des données).
"""

from __future__ import annotations

import glob
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

TOKEN_RE = re.compile(r"[0-9a-zà-ÿ]+", re.IGNORECASE)
SIM_WARN = 0.6  # seuil d'alerte « quasi-copie » — même valeur que build_gold.py (J2)

GOLD_DEFAUT = "gold/gold.jsonl"
CORPUS_GLOB = "artifacts/corpus/corpus_train_*.jsonl"


@dataclass(frozen=True)
class Exemple:
    """Un ticket, réduit à ce dont l'évaluation a besoin."""
    titre: str
    description: str
    categorie: str
    priorite: str
    statut: str
    # Priorité du LABEL D'ORIGINE (avant relecture main) : `priorite_generee` côté
    # gold synthétique, `priorite_source` côté validation externe réelle. Sert de
    # baseline « label amont brut » au J7 (à comparer au gold relu).
    priorite_source: str = ""

    @property
    def texte(self) -> str:
        return f"{self.titre}\n{self.description}"


def _norm(s) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _tokens(s) -> set[str]:
    return set(TOKEN_RE.findall(str(s).lower()))


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _to_exemple(rec: dict) -> Exemple:
    return Exemple(
        titre=rec.get("titre", ""),
        description=rec.get("description", ""),
        categorie=rec["categorie"],
        priorite=rec.get("priorite", ""),
        statut=rec.get("statut", ""),
        priorite_source=rec.get("priorite_generee") or rec.get("priorite_source") or "",
    )


def load_exemples(path: str) -> list[Exemple]:
    """Charge un jeu d'exemples JSONL (gold synthétique OU validation externe :
    même schéma minimal titre/description/categorie/priorite)."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Jeu d'évaluation introuvable : {p}.")
    return [_to_exemple(json.loads(l)) for l in p.open(encoding="utf-8") if l.strip()]


def load_gold(path: str = GOLD_DEFAUT) -> list[Exemple]:
    try:
        return load_exemples(path)
    except FileNotFoundError:
        raise FileNotFoundError(f"Gold set introuvable : {path} (as-tu scellé J2 ?).")


def load_train(path: str | None = None) -> list[Exemple]:
    if path is None:
        found = sorted(glob.glob(CORPUS_GLOB))
        if not found:
            raise FileNotFoundError(
                f"Corpus d'entraînement introuvable ({CORPUS_GLOB}). "
                "Régénère-le (J1) ou passe --train."
            )
        path = found[-1]
    return [_to_exemple(json.loads(l)) for l in open(path, encoding="utf-8") if l.strip()]


@dataclass
class VerdictEtancheite:
    """Résultat du contrôle train/gold."""
    n_train: int
    n_gold: int
    fuites_exactes: list[tuple[str, str]] = field(default_factory=list)   # (titre_gold, titre_train)
    proches: list[tuple[str, str, float]] = field(default_factory=list)   # (titre_gold, titre_train, sim)
    seuil_alerte: float = SIM_WARN

    @property
    def etanche(self) -> bool:
        return not self.fuites_exactes


def assert_disjoint(
    train: list[Exemple],
    gold: list[Exemple],
    sim_warn: float = SIM_WARN,
) -> VerdictEtancheite:
    """Vérifie l'étanchéité train/gold.

    - Fuite **exacte** (description normalisée présente dans le train) → `RuntimeError`.
    - Chevauchement **approximatif** (Jaccard titre+description ≥ `sim_warn`) → signalé
      dans le verdict (avertissement), sans bloquer.
    """
    train_desc = {_norm(t.description): t.titre for t in train}
    train_tok = [(_tokens(t.titre + " " + t.description), t.titre) for t in train]

    verdict = VerdictEtancheite(n_train=len(train), n_gold=len(gold), seuil_alerte=sim_warn)

    for g in gold:
        # (1) contrôle exact
        hit = train_desc.get(_norm(g.description))
        if hit is not None:
            verdict.fuites_exactes.append((g.titre, hit))

        # (2) contrôle approximatif — plus proche voisin de surface
        gtok = _tokens(g.titre + " " + g.description)
        sim_max, proche = 0.0, ""
        for tok, titre in train_tok:
            s = _jaccard(gtok, tok)
            if s > sim_max:
                sim_max, proche = s, titre
        if sim_max >= sim_warn and sim_max < 1.0:
            verdict.proches.append((g.titre, proche, round(sim_max, 3)))

    verdict.proches.sort(key=lambda p: p[2], reverse=True)

    if verdict.fuites_exactes:
        apercu = ", ".join(t for t, _ in verdict.fuites_exactes[:5])
        raise RuntimeError(
            f"Étanchéité VIOLÉE : {len(verdict.fuites_exactes)} gold identique(s) au train "
            f"(ex. : {apercu}). Le gold ne doit JAMAIS recouper le train."
        )
    return verdict


def porte_etancheite(
    candidats: list[Exemple],
    test: list[Exemple],
    seuil_jaccard: float = 0.5,
) -> float:
    """Porte DURE d'étanchéité pour les ajouts au TRAIN (flywheel J9).

    Différence avec `assert_disjoint` (où le Jaccard n'est qu'un AVERTISSEMENT, car le
    synthétique a des quasi-doublons légitimes avec le gold) : ici **toute** contamination
    est FATALE. Lève `RuntimeError` si un candidat recoupe le `test` :
      - **exact** : description normalisée identique (0 toléré) ;
      - **approx** : Jaccard(titre+description) ≥ `seuil_jaccard` (0 toléré ; défaut 0,5,
        renforcé — cohérent avec l'ingestion Kaggle, source commune train/test).

    Sur succès, retourne le **Jaccard MAX** observé (candidats × test) — pour log/manifeste.
    Porte OBLIGATOIRE : à appeler avant tout ajout d'exemples au train.
    """
    test_desc = {_norm(t.description) for t in test}
    test_tok = [(_tokens(t.titre + " " + t.description), t.titre) for t in test]

    exacts: list[str] = []
    approx: list[tuple[str, str, float]] = []
    sim_max = 0.0

    for c in candidats:
        if _norm(c.description) in test_desc:
            exacts.append(c.titre)
            continue
        ctok = _tokens(c.titre + " " + c.description)
        hit: tuple[str, float] | None = None
        for ttok, ttitre in test_tok:
            s = _jaccard(ctok, ttok)
            if s > sim_max:
                sim_max = s
            if s >= seuil_jaccard and hit is None:
                hit = (ttitre, round(s, 3))
        if hit is not None:
            approx.append((c.titre, hit[0], hit[1]))

    if exacts or approx:
        details: list[str] = []
        if exacts:
            details.append(f"{len(exacts)} EXACT(s) (ex. : {', '.join(exacts[:3])})")
        if approx:
            ex = ", ".join(f"« {a} » ~ « {b} » (J={s})" for a, b, s in approx[:3])
            details.append(f"{len(approx)} APPROX Jaccard≥{seuil_jaccard} (ex. : {ex})")
        raise RuntimeError(
            "PORTE D'ÉTANCHÉITÉ VIOLÉE — un candidat au TRAIN recoupe le TEST : "
            + " | ".join(details)
            + ". Aucun ajout au train tant que ce n'est pas 0."
        )
    return round(sim_max, 3)
