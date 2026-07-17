"""
Backfill des embeddings — peuple `tickets.embedding` pour tout ticket qui n'a pas
(encore) de vecteur produit par le modèle courant.

- **Idempotent** : ne ré-encode que les tickets à `embedding IS NULL` ou dont
  `embedding_modele` diffère du modèle courant (changement de modèle → re-backfill).
- Unité encodée : **titre + description** (même unité que la requête RAG, §7, et le
  `text` des jeux d'éval J2/J3).
- Écrit un **manifeste** de run (provenance, comptes, latence unitaire) sous
  `artifacts/embeddings/` — régénérable, non versionné.

Usage :
    cd ml && python -m smart_ticketing_ml.service.backfill
    cd ml && python -m smart_ticketing_ml.service.backfill --dry-run
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import psycopg

from ..db import database_url
from . import config, embedder

RACINE = Path(__file__).resolve().parents[2]  # .../ml
DOSSIER_ARTEFACTS = RACINE / "artifacts" / "embeddings"


def _vecteur_en_litteral(vecteur: list[float]) -> str:
    """Sérialise un vecteur au format littéral pgvector : '[v1,v2,...]'."""
    return "[" + ",".join(repr(float(x)) for x in vecteur) + "]"


def selectionner_a_traiter(conn: psycopg.Connection, modele: str) -> list[tuple[int, str, str]]:
    """Tickets sans vecteur courant : (id, titre, description)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, titre, description
            FROM tickets
            WHERE embedding IS NULL
               OR embedding_modele IS DISTINCT FROM %s
            ORDER BY id
            """,
            (modele,),
        )
        return cur.fetchall()


def backfill(dry_run: bool = False) -> dict:
    modele = config.MODELE_EMBEDDING
    horodatage = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM tickets")
            total = cur.fetchone()[0]

        a_traiter = selectionner_a_traiter(conn, modele)
        print(f"Tickets en base : {total} — à (ré)encoder : {len(a_traiter)}")

        if dry_run:
            return {"total": total, "a_traiter": len(a_traiter), "dry_run": True}

        if not a_traiter:
            print("Rien à faire — tous les tickets ont déjà un vecteur du modèle courant.")
            return {"total": total, "traites": 0, "modele": modele}

        # 1) Encodage (chargement du modèle inclus dans ce temps).
        textes = [f"{titre}\n{description}" for _id, titre, description in a_traiter]
        t0 = time.perf_counter()
        vecteurs = embedder.embed_textes(textes)
        secondes_encodage = time.perf_counter() - t0

        # 2) Écriture pgvector (une transaction).
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE tickets SET embedding = %s::vector, embedding_modele = %s WHERE id = %s",
                [
                    (_vecteur_en_litteral(vec), modele, ticket[0])
                    for ticket, vec in zip(a_traiter, vecteurs)
                ],
            )
        conn.commit()

        # 3) Contrôles + mesure de latence unitaire (modèle chaud).
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM tickets WHERE embedding IS NOT NULL")
            peuples = cur.fetchone()[0]
        latence_ms = embedder.mesurer_latence_unitaire()

    manifeste = {
        "horodatage": horodatage,
        "modele": modele,
        "dimension": config.DIMENSION,
        "device": config.DEVICE,
        "tickets_total": total,
        "tickets_traites": len(a_traiter),
        "tickets_peuples_apres": peuples,
        "secondes_encodage": round(secondes_encodage, 2),
        "debit_tickets_par_s": round(len(a_traiter) / secondes_encodage, 2) if secondes_encodage else None,
        "latence_unitaire_ms": round(latence_ms, 1),
    }
    DOSSIER_ARTEFACTS.mkdir(parents=True, exist_ok=True)
    chemin = DOSSIER_ARTEFACTS / f"backfill_{horodatage}.json"
    chemin.write_text(json.dumps(manifeste, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        f"OK — {len(a_traiter)} encodés en {secondes_encodage:.1f}s "
        f"({manifeste['debit_tickets_par_s']} tickets/s), "
        f"{peuples}/{total} peuplés. Latence unitaire ≈ {latence_ms:.1f} ms."
    )
    print(f"Manifeste : {chemin}")
    return manifeste


def main() -> None:
    parseur = argparse.ArgumentParser(description="Backfill des embeddings des tickets.")
    parseur.add_argument("--dry-run", action="store_true", help="Compte sans écrire.")
    args = parseur.parse_args()
    backfill(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
