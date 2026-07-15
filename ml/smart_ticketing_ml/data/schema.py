"""
Schémas Pydantic du corpus synthétique — servent aussi de JSON schema pour la
sortie structurée d'Ollama (décodage contraint).

Mapping vers le modèle Prisma `Ticket` : titre/description/categorie/priorite/
statut ; `resolution` → un `Commentaire` du technicien ; `service_demandeur`
→ `Utilisateur.service`.

`categorie` est un `str` **libre** (et non un `Literal` figé) : la liste des
catégories est dynamique (table `categories`). Elle est validée puis écrasée
côté client contre la liste réellement en base → aucune catégorie codée en dur.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Priorité et statut restent des enums fixes (colonnes Prisma). Statut : ≈ 85%
# résolus / 15% ouverts. CHAQUE ticket porte quand même une `resolution` (paire
# problème→solution stockée au JSONL) ; pour les ouverts elle n'est pas liée en
# base (décision du loader).
Priorite = Literal["FAIBLE", "MOYENNE", "HAUTE", "CRITIQUE"]
Statut = Literal["NOUVEAU", "EN_COURS", "EN_ATTENTE", "RESOLU", "CLOTURE"]


class SyntheticTicket(BaseModel):
    titre: str = Field(description="Titre court et parlant, sans point final.")
    description: str = Field(description="Corps du ticket, écrit par le demandeur.")
    categorie: str = Field(description="Catégorie (validée contre la liste en base).")
    priorite: Priorite = Field(description="Priorité de vérité terrain (critères imposés).")
    statut: Statut
    resolution: str = Field(
        description=(
            "Compte-rendu du technicien en 3 temps — Cause / Action(s) / "
            "Vérification — concret, actionnable et techniquement cohérent avec "
            "la catégorie. Jamais de formule creuse."
        )
    )
    service_demandeur: str = Field(description="Service / poste du demandeur.")


class TicketBatch(BaseModel):
    tickets: list[SyntheticTicket]
