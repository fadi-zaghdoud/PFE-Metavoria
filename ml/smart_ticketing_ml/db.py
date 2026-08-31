"""
Accès base de données — lecture **read-only** des catégories.

Contrainte d'architecture transversale : les catégories ne sont JAMAIS codées
en dur. Elles viennent TOUJOURS de la table `categories` (gérée dynamiquement
par le module Administration §6.5). Ce module est l'unique point de lecture.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg

DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/smart_ticketing"


@dataclass(frozen=True)
class Categorie:
    id: int
    nom: str
    description: str


def _normalize_url(url: str) -> str:
    """Retire le paramètre `schema=` propre à Prisma (inconnu de libpq)."""
    parts = urlparse(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k != "schema"]
    return urlunparse(parts._replace(query=urlencode(query)))


def database_url() -> str:
    return _normalize_url(os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL))


def fetch_categories(url: str | None = None) -> list[Categorie]:
    """Renvoie les catégories seedées, triées par id. Lève si la table est vide."""
    with psycopg.connect(url or database_url()) as conn, conn.cursor() as cur:
        cur.execute("SELECT id, nom, description FROM categories ORDER BY id")
        rows = cur.fetchall()
    if not rows:
        raise RuntimeError(
            "Aucune catégorie en base. Lance le seed : `cd backend && npm run db:seed`."
        )
    return [Categorie(id=r[0], nom=r[1], description=r[2] or "") for r in rows]
