"""
J7 — Config GELÉE du scorecard de priorité.

╔══════════════════════════════════════════════════════════════════════════════╗
║  GELÉ le 2026-07-27, AVANT toute mesure de κ sur le gold.                      ║
║  Aucune valeur ci-dessous n'est optimisée sur le gold ni sur la validation    ║
║  externe : ce sont mes TESTS. Chaque poids vient d'une JUSTIFICATION MÉTIER    ║
║  explicite (commentée), pas d'un ajustement empirique. Toute retouche après    ║
║  lecture de κ serait une itération ÉTIQUETÉE et datée (cf. discipline J5+).    ║
║  Le réglage sur données réelles est délégué à Metavoria (paramètres admin      ║
║  §6.5) et au flywheel J9 — MOI je ne touche pas au test.                       ║
╚══════════════════════════════════════════════════════════════════════════════╝

Formule :   score = base_catégorie + urgence(mots-clés) + impact/périmètre + ancienneté(SLA)
            niveau = seuils(score)

Toutes les comparaisons se font sur un texte **replié** (minuscule + accents retirés)
et **tokenisé** : un mot-clé multi-mots est reconnu comme sous-séquence de tokens
(« serveur down »), la négation courte l'annule (« pas bloqué »).
"""

from __future__ import annotations

# ─────────────────────────────────────────────────────────────────────────────
# 1. BASE CATÉGORIE — a priori de gravité par défaut (mapping bon-sens IT).
#    NON dérivé de la distribution du train (ce serait « apprendre » sur mes
#    données et détruire la nature « règle explicite »). Valeurs rondes, posées
#    par raisonnement universel de service desk.
# ─────────────────────────────────────────────────────────────────────────────
BASE_CATEGORIE: dict[str, float] = {
    # Infrastructure PARTAGÉE → une panne touche par défaut plusieurs personnes.
    "Réseau": 1.5,
    # Compte verrouillé = personne TOTALEMENT bloquée ; voisin de la sécurité
    # (identifiants compromis) → sensible.
    "Accès": 1.5,
    # Panne d'UN poste ; contournement fréquent (prêt de matériel) → moyen.
    "Matériel": 1.0,
    # Bugs applicatifs souvent contournables → moyen.
    "Logiciel": 1.0,
    # Fourre-tout : surtout demandes / questions sans blocage → bas.
    "Autre": 0.5,
}
# Catégorie inconnue (l'admin peut en ajouter, §6.5) → neutre.
BASE_DEFAUT: float = 1.0

# ─────────────────────────────────────────────────────────────────────────────
# 2. URGENCE — lexique de mots-clés. Le poids reflète la FORCE DE PREUVE d'une
#    urgence réelle, en escomptant les mots sur-utilisés. Présence (pas fréquence) :
#    répéter un mot ne gonfle pas le score.
# ─────────────────────────────────────────────────────────────────────────────
P_FORT = 2.0        # impact large / irréversible, difficile à surjouer
P_MOYEN = 1.0       # blocage réel d'un utilisateur/tâche, borné
P_FAIBLE = 0.5      # signal réel mais faible / sur-utilisé
P_DESESCALADE = -1.0  # le demandeur lui-même abaisse l'urgence

# +2.0 — impact revenu / multi-utilisateurs / dommage irréversible.
URGENCE_FORT: list[str] = [
    "production", "prod", "en production",          # touche le revenu / beaucoup d'utilisateurs
    "serveur down", "serveur ne repond plus",       # ressource partagée à l'arrêt
    "service a l arret", "site down", "tout est bloque",
    "perte de donnees", "donnees perdues", "corrompu", "corruption",  # irréversible : attendre n'annule rien
    "securite", "piratage", "ransomware", "phishing", "compromis", "faille",  # se propage + exposition légale
]
# +1.0 — blocage réel mais typiquement circonscrit à une personne / une tâche.
URGENCE_MOYEN: list[str] = [
    "bloque", "bloquant", "impossible de travailler", "je ne peux plus",  # arrêt de travail réel
    "en panne", "ne demarre plus", "ne fonctionne plus", "plantage", "crash", "plante",
    "deadline", "echeance", "avant demain", "paie", "cloture", "livraison",  # contrainte temporelle métier
]
# +0.5 — urgence AUTO-DÉCLARÉE : sur-utilisée, faible valeur probante (tout le
# monde écrit « urgent ») → on la compte, mais peu.
URGENCE_FAIBLE: list[str] = [
    "urgent", "urgentissime", "au plus vite", "asap", "rapidement", "des que possible",
]
# −1.0 — signaux explicites de FAIBLE urgence, émis par la personne la mieux placée.
DESESCALADE: list[str] = [
    "quand vous pourrez", "quand vous aurez le temps", "pas urgent", "sans urgence",
    "a l occasion", "pas presse",                    # le demandeur relativise
    "cosmetique", "coquille", "petit detail", "amelioration", "suggestion",  # confort, zéro impact
    "question", "comment faire", "est il possible", "renseignement",  # une question n'est pas un incident
]

# Négateurs : dans une fenêtre ≤ 3 tokens AVANT un mot-clé, ils annulent sa
# contribution (« pas bloqué », « aucune perte de données »).
# ⚠️ « plus » est EXCLU : « ne fonctionne PLUS » est une panne, pas une négation.
NEGATEURS: frozenset[str] = frozenset({"pas", "aucun", "aucune", "sans", "ni", "jamais"})

# Bornes de la famille urgence : empêche un ticket d'empiler les mots forts à
# l'infini ; +4 suffit à atteindre CRITIQUE, −1 borne la désescalade.
CAP_URGENCE: tuple[float, float] = (-1.0, 4.0)

# ─────────────────────────────────────────────────────────────────────────────
# 3. IMPACT / PÉRIMÈTRE — rayon d'action (blast radius). Le nombre de personnes/
#    postes touchés échelonne la gravité.
# ─────────────────────────────────────────────────────────────────────────────
P_COLLECTIF = 2.0   # toute une équipe / un service
P_MULTI = 2.0       # N ≥ 3 personnes (compté)
P_DUO = 1.0         # exactement 2 personnes
P_VAGUE = 1.0       # « plusieurs », multi-utilisateur non chiffré

# +2.0 — productivité COLLECTIVE à l'arrêt.
IMPACT_COLLECTIF: list[str] = [
    "toute l equipe", "tout le service", "tout le bureau", "tout l etage",
    "tout le monde", "toute l entreprise", "plus personne ne peut",
]
# +1.0 — multi-utilisateur VAGUE (preuve plus faible qu'un décompte).
IMPACT_VAGUE: list[str] = [
    "plusieurs", "certains collegues", "d autres aussi", "plusieurs personnes",
    "plusieurs postes", "des collegues",
]
# Unités reconnues derrière un nombre : « 5 postes », « 3 utilisateurs »…
IMPACT_UNITES: frozenset[str] = frozenset(
    {"personnes", "postes", "utilisateurs", "employes", "collegues", "agents", "machines"}
)
CAP_IMPACT: tuple[float, float] = (0.0, 3.0)  # le périmètre ne doit pas écraser la nature du défaut

# ─────────────────────────────────────────────────────────────────────────────
# 4. ANCIENNETÉ / SLA — dynamique. Un ticket non résolu MONTE en priorité en
#    dépassant son SLA. = 0 à la création → NUL à l'éval (gold/réel = jugements
#    à la création). Validé qualitativement en démo (J7b), jamais par κ.
# ─────────────────────────────────────────────────────────────────────────────
P_SLA_DEPASSE = 1.0      # SLA franchi
P_SLA_DOUBLE = 2.0       # ≥ 2× SLA : sévèrement en retard
# Cibles standard d'un service desk (h) selon le niveau provisoire (statique).
SLA_HEURES: dict[str, float] = {
    "CRITIQUE": 4.0,
    "HAUTE": 8.0,
    "MOYENNE": 24.0,
    "FAIBLE": 72.0,
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. SEUILS DE DÉCOUPAGE — fixes, ronds, a priori. Posés par répartition IT
#    attendue (majorité MOYENNE, CRITIQUE rare), PAS par quantiles du gold.
# ─────────────────────────────────────────────────────────────────────────────
#   < 1.0        FAIBLE   : base basse ET rien ne se déclenche (ou désescalade).
#   1.0 – 2.5    MOYENNE  : le gros des tickets — base catégorie seule, éventuel « urgent ».
#   2.5 – 4.0    HAUTE    : catégorie forte OU vrai mot de blocage.
#   ≥ 4.0        CRITIQUE : preuves CONVERGENTES (gravité + périmètre) — reste rare.
SEUIL_MOYENNE: float = 1.0
SEUIL_HAUTE: float = 2.5
SEUIL_CRITIQUE: float = 4.0
