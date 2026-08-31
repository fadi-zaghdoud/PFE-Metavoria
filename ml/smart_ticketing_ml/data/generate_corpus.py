"""
J1 — Générateur de corpus synthétique de tickets de support (via Ollama, local).

Chaîne : lecture des catégories EN BASE → échantillonnage de spécifications
(distribution déséquilibrée, longueurs/tons variés, statuts ≈ 85/15) →
génération LLM locale à sortie structurée → JSONL versionné + manifeste.

Principes clés :
- Catégories JAMAIS codées en dur : lues depuis la table `categories` (§6.5).
- Labels de vérité terrain (catégorie/priorité/statut) échantillonnés côté
  client PUIS imposés au modèle et ré-écrasés à la réception → labels propres.
- Diversité via variation du prompt (graines + axes) + température locale.
- CHAQUE ticket porte une résolution (paire problème→solution pour le RAG).
- Aucun appel externe, aucun coût (conforme CDC §10).

Usage :
    # Plan seul (lit les catégories en base, aucun appel LLM) :
    python -m smart_ticketing_ml.data.generate_corpus --n 900 --dry-run

    # Génération réelle (nécessite Ollama + un modèle : `ollama pull qwen2.5:14b`) :
    python -m smart_ticketing_ml.data.generate_corpus --n 900 --out artifacts/corpus

⚠️ Le gold set de test (J2) est produit et relu SÉPARÉMENT ; ce corpus est
réservé à l'entraînement/à la base RAG et ne doit jamais servir de test.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

from ..db import Categorie, fetch_categories
from ..taxonomy import (
    PRIORITY_DEFINITIONS,
    RESOLVED_STATUSES,
    STATUS_WEIGHTS,
    category_weights,
    priority_prior,
)
from .schema import TicketBatch
from .seeds import (
    AUTHOR_PROFILES,
    COMPLETENESS,
    COMPLETENESS_WEIGHTS,
    LENGTH_BANDS,
    LENGTH_WEIGHTS,
    TONE_WEIGHTS,
    TONES,
    scenario_for,
)

PROMPT_VERSION = "j1-v2"
SYNTHETIC_FLAG = True  # marque de bootstrap (exclu des KPI réels §6.4)


@dataclass
class TicketSpec:
    categorie: str
    priorite: str
    statut: str
    scenario: str
    longueur: str
    completude: str
    ton: str
    profil: str


# ─────────────────────────────────────────────────────────────────────────────
# Échantillonnage (reproductible via `seed`)
# ─────────────────────────────────────────────────────────────────────────────


def _weighted_choice(rng: random.Random, weights: dict[str, float]) -> str:
    labels = list(weights)
    return rng.choices(labels, weights=[weights[k] for k in labels], k=1)[0]


def _quota(rng: random.Random, weights: dict[str, float], n: int) -> list[str]:
    """Liste de longueur n dont les effectifs suivent EXACTEMENT `weights`
    (arrondi au plus fort reste), puis mélangée. Rend la répartition
    déterministe — indépendante de la chance du tirage, à tout n."""
    labels = list(weights)
    exact = {k: weights[k] * n for k in labels}
    counts = {k: int(v) for k, v in exact.items()}
    reste = n - sum(counts.values())
    for k in sorted(labels, key=lambda k: exact[k] - counts[k], reverse=True)[:reste]:
        counts[k] += 1
    seq = [k for k in labels for _ in range(counts[k])]
    rng.shuffle(seq)
    return seq


def sample_specs(n: int, rng: random.Random, categories: list[Categorie]) -> list[TicketSpec]:
    desc = {c.nom: c.description for c in categories}
    # Quotas déterministes sur les dimensions structurantes → distributions
    # EXACTES : catégorie (déséquilibre), statut (85/15), complétude (~30% indigente).
    cats = _quota(rng, category_weights([c.nom for c in categories]), n)
    statuts = _quota(rng, STATUS_WEIGHTS, n)
    completudes = _quota(rng, COMPLETENESS_WEIGHTS, n)
    specs: list[TicketSpec] = []
    for i in range(n):
        nom = cats[i]
        completude = completudes[i]
        # Un ticket « indigent » est forcément une ligne → longueur courte.
        longueur = "courte" if completude == "indigente" else _weighted_choice(rng, LENGTH_WEIGHTS)
        specs.append(
            TicketSpec(
                categorie=nom,
                priorite=_weighted_choice(rng, priority_prior(nom)),
                statut=statuts[i],
                scenario=scenario_for(rng, nom, desc[nom]),
                longueur=longueur,
                completude=completude,
                ton=_weighted_choice(rng, TONE_WEIGHTS),
                profil=rng.choice(AUTHOR_PROFILES),
            )
        )
    return specs


# ─────────────────────────────────────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────────────────────────────────────


def build_system_prompt(categories: list[Categorie]) -> str:
    cats = "\n".join(f"- {c.nom} : {c.description}" for c in categories)
    prios = "\n".join(f"- {k} : {v}" for k, v in PRIORITY_DEFINITIONS.items())
    return (
        "Tu génères des tickets de support IT RÉALISTES pour une PME/DSI "
        "tunisienne (société de services informatiques), écrits du point de vue "
        "du DEMANDEUR.\n\n"
        "LANGUE : français + termes techniques anglais courants (VPN, timeout, "
        "update, driver, login, error code…). JAMAIS d'arabizi ni d'arabe. "
        "Écris comme un vrai employé : imperfections, tournures orales, parfois "
        "vague — pas un texte lisse. Inclure quand c'est pertinent des messages "
        "d'erreur exacts, des codes et des noms de produits.\n\n"
        f"CATÉGORIES POSSIBLES :\n{cats}\n\n"
        f"CRITÈRES DE PRIORITÉ (la description doit être COHÉRENTE avec la "
        f"priorité imposée) :\n{prios}\n\n"
        "CONSIGNES :\n"
        "- Respecte STRICTEMENT la catégorie et la priorité imposées par ticket. "
        "Chaque ticket décrit un cas RÉSOLU → tu fournis TOUJOURS la résolution "
        "(le statut réel est fixé ensuite, hors de ta responsabilité).\n"
        "- Si tu cites un chemin de fichier, utilise des slashes « / » (JAMAIS de "
        "backslash « \\ », qui casse le JSON).\n"
        "- TITRE : résumé du problème en 4 à 8 mots, incluant le SYMPTÔME concret. "
        "Ni un simple mot-clé (« Wi-Fi », « application »), ni une phrase complète. "
        "Bon : « Outlook plante au démarrage (runtime error) ». Sans point final.\n"
        "- DESCRIPTION : conforme à la longueur, la complétude et le ton demandés. "
        "Quand la complétude est « indigente », la description est VRAIMENT pauvre "
        "(une ligne, aucun symptôme) — c'est volontaire, ne l'enrichis pas.\n"
        "- RÉSOLUTION (point CRITIQUE — c'est la matière du moteur de suggestion) : "
        "rédige TOUJOURS `resolution` comme un vrai compte-rendu de technicien, en "
        "3 temps :\n"
        "    • Cause : le diagnostic racine.\n"
        "    • Action(s) : les étapes concrètes réellement appliquées.\n"
        "    • Vérification : comment la résolution a été confirmée.\n"
        "  Elle doit être TECHNIQUEMENT COHÉRENTE avec la catégorie et le problème "
        "(ex. un « runtime error » applicatif ne se corrige PAS par un driver "
        "graphique). INTERDIT : formules creuses type « problème résolu », "
        "« serveurs recalibrés/décongestionnés », « contactez-moi si ça persiste ». "
        "Une résolution vague est inutilisable.\n"
        "  Exemple du niveau attendu : « Cause : saturation du pool DHCP sur le "
        "VLAN 20. Action : étendu la plage à /23, redémarré le service dhcpd. "
        "Vérification : connectivité testée OK sur 3 postes. »\n"
        "- Varie fortement les formulations d'un ticket à l'autre.\n"
        "- Réponds dans l'ordre exact des spécifications reçues."
    )


def build_batch_user_prompt(specs: list[TicketSpec]) -> str:
    lignes = [
        f"{i}. catégorie={s.categorie} | priorité={s.priorite}\n"
        f"   scénario de départ : {s.scenario}\n"
        f"   longueur : {LENGTH_BANDS[s.longueur]}\n"
        f"   complétude : {COMPLETENESS[s.completude]}\n"
        f"   ton : {TONES[s.ton]}\n"
        f"   demandeur : {s.profil}"
        for i, s in enumerate(specs, 1)
    ]
    return f"Génère {len(specs)} tickets, un par spécification, dans l'ordre :\n\n" + "\n\n".join(
        lignes
    )


# ─────────────────────────────────────────────────────────────────────────────
# Orchestration
# ─────────────────────────────────────────────────────────────────────────────


def _distribution(items) -> dict[str, int]:
    return dict(sorted(Counter(items).items()))


def run(args: argparse.Namespace) -> int:
    rng = random.Random(args.seed)
    try:
        categories = fetch_categories()
    except Exception as exc:
        print(f"❌ Lecture des catégories impossible : {exc}", file=sys.stderr)
        return 1

    specs = sample_specs(args.n, rng, categories)
    plan = {
        "categorie": _distribution(s.categorie for s in specs),
        "priorite": _distribution(s.priorite for s in specs),
        "statut": _distribution(s.statut for s in specs),
        "completude": _distribution(s.completude for s in specs),
        "longueur": _distribution(s.longueur for s in specs),
    }
    print(f"Catégories en base : {[c.nom for c in categories]}")
    print(f"Plan d'échantillonnage ({args.n} tickets, seed={args.seed}) :")
    print(json.dumps(plan, ensure_ascii=False, indent=2))

    if args.dry_run:
        print("\n[dry-run] Aucun appel LLM. Plan seul.")
        return 0

    try:
        from .ollama_client import OllamaGenerator
    except Exception as exc:  # pragma: no cover
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    gen = OllamaGenerator(
        host=args.host, model=args.model, fallback=args.fallback, temperature=args.temperature
    )

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    corpus_path = out_dir / f"corpus_train_{stamp}.jsonl"
    system = build_system_prompt(categories)
    schema = TicketBatch.model_json_schema()
    batches = [specs[i : i + args.batch_size] for i in range(0, len(specs), args.batch_size)]

    # Compteurs (pas de rétention en mémoire de tous les tickets) + écriture
    # incrémentale flushée à chaque lot → un crash à H+8 conserve H+8 de travail.
    produced = 0
    defects = 0
    cat_c: Counter = Counter()
    prio_c: Counter = Counter()
    stat_c: Counter = Counter()

    with corpus_path.open("w", encoding="utf-8") as fh:
        for bi, batch_specs in enumerate(batches, 1):
            try:
                raw = gen.chat_json(system, build_batch_user_prompt(batch_specs), schema)
                batch = TicketBatch.model_validate(raw)
            except Exception as exc:  # lot en échec : on continue, on ne perd pas le reste
                print(f"  ⚠️ Lot {bi}/{len(batches)} échoué ({exc}). Ignoré.", file=sys.stderr)
                continue
            if len(batch.tickets) != len(batch_specs):
                print(
                    f"  ⚠️ Lot {bi}/{len(batches)} : {len(batch.tickets)} pour "
                    f"{len(batch_specs)} attendus. Ignoré.",
                    file=sys.stderr,
                )
                continue
            for ticket, spec in zip(batch.tickets, batch_specs):
                # Labels de vérité terrain imposés → propres par construction.
                ticket.categorie = spec.categorie
                ticket.priorite = spec.priorite  # type: ignore[assignment]
                ticket.statut = spec.statut  # type: ignore[assignment]
                if not ticket.resolution.strip():
                    defects += 1
                record = ticket.model_dump()
                record["synthetique"] = SYNTHETIC_FLAG
                # true = résolu → le loader liera la résolution ; false = ouvert
                # → résolution gardée au JSONL sans lien (fermable à la demande).
                record["resolution_a_lier"] = ticket.statut in RESOLVED_STATUSES
                fh.write(json.dumps(record, ensure_ascii=False) + "\n")
                produced += 1
                cat_c[ticket.categorie] += 1
                prio_c[ticket.priorite] += 1
                stat_c[ticket.statut] += 1
            fh.flush()  # persistance sur disque après chaque lot
            print(f"  Lot {bi}/{len(batches)} ok — {produced} tickets cumulés.")

    if produced == 0:
        print("❌ Aucun ticket généré (Ollama accessible ? modèle récupéré ?).", file=sys.stderr)
        corpus_path.unlink(missing_ok=True)
        return 1

    manifest = {
        "prompt_version": PROMPT_VERSION,
        "modele_demande": args.model,
        "modele_utilise": gen.model_used,
        "ollama_host": args.host,
        "seed": args.seed,
        "genere_le": stamp,
        "demandes": args.n,
        "produits": produced,
        "defauts_resolution_vide": defects,
        "categories_base": [c.nom for c in categories],
        "corpus_fichier": corpus_path.name,
        "distribution": {
            "categorie": dict(sorted(cat_c.items())),
            "priorite": dict(sorted(prio_c.items())),
            "statut": dict(sorted(stat_c.items())),
        },
    }
    (out_dir / f"manifest_{stamp}.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\n✅ {produced}/{args.n} tickets → {corpus_path}")
    print(f"   Manifeste → {out_dir / f'manifest_{stamp}.json'}")
    if defects:
        print(f"   ⚠️ {defects} tickets sans résolution (défaut de génération à revoir).")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Génère un corpus synthétique de tickets (J1).")
    p.add_argument("--n", type=int, default=900, help="Nombre total de tickets (~800-1000).")
    p.add_argument("--batch-size", type=int, default=6, help="Tickets par appel LLM.")
    p.add_argument("--out", default="artifacts/corpus", help="Répertoire de sortie.")
    p.add_argument("--seed", type=int, default=42, help="Graine RNG (reproductibilité).")
    p.add_argument("--host", default=os.environ.get("OLLAMA_HOST", "http://localhost:11434"))
    p.add_argument("--model", default=os.environ.get("OLLAMA_MODEL", "qwen2.5:14b"))
    p.add_argument("--fallback", default=os.environ.get("OLLAMA_MODEL_FALLBACK", "qwen2.5:7b"))
    p.add_argument("--temperature", type=float, default=0.8)
    p.add_argument("--dry-run", action="store_true", help="Plan seul, sans appel LLM.")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
