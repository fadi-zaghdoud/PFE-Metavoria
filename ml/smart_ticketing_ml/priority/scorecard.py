"""
J7 — Moteur du scorecard additif (pur, déterministe, sans I/O).

`Scorecard.evaluer(...)` renvoie une `Decision` : niveau + score + **décomposition
facteur par facteur** (l'explicabilité §6.5). Le plafonnement par famille borne le
score sans masquer la décomposition : chaque signal reste affiché, et la ligne
« (plafonné) » signale qu'une famille a atteint sa borne.

Rien ici n'est appris : les poids/seuils viennent de `lexicon.py` (gelés). Deux
passes pour l'ancienneté : on calcule un niveau *provisoire* (partie statique) pour
choisir le SLA, puis on ajoute le terme d'âge. À la création (age=0) la 2ᵉ passe
n'ajoute rien.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from . import lexicon as lex

_TOKEN_RE = re.compile(r"[0-9a-z]+")


def _fold(s: str) -> str:
    """Minuscule + accents retirés → comparaison robuste (tickets accentués ou non)."""
    decompose = unicodedata.normalize("NFD", str(s or "").lower())
    return "".join(c for c in decompose if unicodedata.category(c) != "Mn")


def _tokens(s: str) -> list[str]:
    return _TOKEN_RE.findall(_fold(s))


def _phrase_tokens(phrase: str) -> tuple[str, ...]:
    return tuple(_TOKEN_RE.findall(_fold(phrase)))


def _occurrences(toks: list[str], motif: tuple[str, ...]) -> list[int]:
    """Positions (index de début) où `motif` apparaît comme sous-séquence contiguë."""
    if not motif:
        return []
    n, m = len(toks), len(motif)
    return [i for i in range(n - m + 1) if tuple(toks[i : i + m]) == motif]


def _nie(toks: list[str], debut: int, fenetre: int = 3) -> bool:
    """Un négateur apparaît-il dans les `fenetre` tokens précédant `debut` ?"""
    for j in range(max(0, debut - fenetre), debut):
        if toks[j] in lex.NEGATEURS:
            return True
    return False


def _present(toks: list[str], phrase: str) -> bool:
    """Le mot-clé est présent au moins une fois SANS être nié."""
    motif = _phrase_tokens(phrase)
    return any(not _nie(toks, i) for i in _occurrences(toks, motif))


@dataclass
class Contribution:
    """Un facteur du score, affiché dans la décomposition."""
    famille: str      # "catégorie" | "urgence" | "impact" | "ancienneté"
    facteur: str      # étiquette lisible (ex. "Réseau", "production", "tout le service")
    points: float
    preuve: str = ""  # extrait déclencheur

    def __str__(self) -> str:
        signe = "+" if self.points >= 0 else "−"
        return f"{self.facteur} ({signe}{abs(self.points):.2f})"


@dataclass
class Decision:
    niveau: str
    score: float
    contributions: list[Contribution] = field(default_factory=list)
    plafonnements: list[str] = field(default_factory=list)  # ex. "urgence : +5.0 → +4.0"

    @property
    def plafonne(self) -> bool:
        return bool(self.plafonnements)

    def explication(self) -> str:
        """« HAUTE (plafonné) car : production (+2.00) · Réseau (+1.50) · … »"""
        actifs = [c for c in self.contributions if abs(c.points) > 1e-9]
        actifs.sort(key=lambda c: abs(c.points), reverse=True)
        corps = " · ".join(str(c) for c in actifs) or "aucun signal (base seule)"
        marque = " (plafonné)" if self.plafonne else ""
        return f"{self.niveau}{marque} car : {corps}"

    def to_dict(self) -> dict:
        return {
            "niveau": self.niveau,
            "score": round(self.score, 3),
            "plafonne": self.plafonne,
            "plafonnements": self.plafonnements,
            "contributions": [
                {"famille": c.famille, "facteur": c.facteur,
                 "points": round(c.points, 3), "preuve": c.preuve}
                for c in self.contributions
            ],
        }


def niveau_de(score: float, decalage: float = 0.0) -> str:
    """Score → niveau. `decalage` translate les 3 seuils (analyse de sensibilité)."""
    if score < lex.SEUIL_MOYENNE + decalage:
        return "FAIBLE"
    if score < lex.SEUIL_HAUTE + decalage:
        return "MOYENNE"
    if score < lex.SEUIL_CRITIQUE + decalage:
        return "HAUTE"
    return "CRITIQUE"


class Scorecard:
    """Règle explicite additive. Une instance = une config (celle de `lexicon`)."""

    def evaluer(
        self,
        titre: str,
        description: str,
        categorie: str,
        age_heures: float = 0.0,
        decalage_seuil: float = 0.0,
    ) -> Decision:
        toks = _tokens(f"{titre} {description}")
        contribs: list[Contribution] = []
        plaf: list[str] = []

        # ── Base catégorie ──────────────────────────────────────────────
        base = lex.BASE_CATEGORIE.get(categorie, lex.BASE_DEFAUT)
        contribs.append(Contribution("catégorie", categorie or "inconnue", base, categorie))

        # ── Urgence (présence, pas fréquence) ───────────────────────────
        urg_contribs: list[Contribution] = []
        for phrases, poids in (
            (lex.URGENCE_FORT, lex.P_FORT),
            (lex.URGENCE_MOYEN, lex.P_MOYEN),
            (lex.URGENCE_FAIBLE, lex.P_FAIBLE),
            (lex.DESESCALADE, lex.P_DESESCALADE),
        ):
            for ph in phrases:
                if _present(toks, ph):
                    urg_contribs.append(Contribution("urgence", ph, poids, ph))
        urg_brut = sum(c.points for c in urg_contribs)
        urg_eff = _clamp(urg_brut, *lex.CAP_URGENCE)
        if urg_eff != urg_brut:
            plaf.append(f"urgence : {urg_brut:+.1f} → {urg_eff:+.1f}")
        contribs.extend(urg_contribs)

        # ── Impact / périmètre ──────────────────────────────────────────
        imp_contribs: list[Contribution] = []
        for ph in lex.IMPACT_COLLECTIF:
            if _present(toks, ph):
                imp_contribs.append(Contribution("impact", ph, lex.P_COLLECTIF, ph))
        n_pers = _plus_grand_effectif(toks)
        if n_pers >= 3:
            imp_contribs.append(Contribution("impact", f"{n_pers} personnes", lex.P_MULTI, f"{n_pers}"))
        elif n_pers == 2:
            imp_contribs.append(Contribution("impact", "2 personnes", lex.P_DUO, "2"))
        else:
            for ph in lex.IMPACT_VAGUE:
                if _present(toks, ph):
                    imp_contribs.append(Contribution("impact", ph, lex.P_VAGUE, ph))
                    break  # un seul signal vague suffit (présence)
        imp_brut = sum(c.points for c in imp_contribs)
        imp_eff = _clamp(imp_brut, *lex.CAP_IMPACT)
        if imp_eff != imp_brut:
            plaf.append(f"impact : {imp_brut:+.1f} → {imp_eff:+.1f}")
        contribs.extend(imp_contribs)

        # ── Score statique → niveau provisoire → SLA → ancienneté ───────
        score_statique = base + urg_eff + imp_eff
        niveau_prov = niveau_de(score_statique, decalage_seuil)
        sla = lex.SLA_HEURES.get(niveau_prov, 24.0)
        anc = 0.0
        if age_heures >= 2 * sla:
            anc = lex.P_SLA_DOUBLE
        elif age_heures >= sla:
            anc = lex.P_SLA_DEPASSE
        if anc > 0:
            contribs.append(
                Contribution("ancienneté", f"SLA {niveau_prov} dépassé", anc, f"{age_heures:.0f} h")
            )

        score = score_statique + anc
        return Decision(
            niveau=niveau_de(score, decalage_seuil),
            score=score,
            contributions=contribs,
            plafonnements=plaf,
        )

    def predire(self, titre: str, description: str, categorie: str, **kw) -> str:
        return self.evaluer(titre, description, categorie, **kw).niveau


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _plus_grand_effectif(toks: list[str]) -> int:
    """Plus grand N tel que « N <unité de personnes> » apparaît (fenêtre ≤ 2 tokens)."""
    best = 0
    for i, t in enumerate(toks):
        if t.isdigit():
            for j in range(i + 1, min(len(toks), i + 3)):
                if toks[j] in lex.IMPACT_UNITES:
                    best = max(best, int(t))
                    break
    return best
