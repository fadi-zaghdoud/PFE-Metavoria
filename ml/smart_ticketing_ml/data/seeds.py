"""
Banque de graines de scénarios + axes de diversité.

Pourquoi des graines et non un prompt libre : sur `claude-opus-4-8`, les
paramètres d'échantillonnage (`temperature`/`top_p`) sont **supprimés** (400).
La diversité ne peut donc PAS venir du sampling — elle vient de la variation du
prompt : chaque ticket est construit à partir d'une graine concrète + des axes
échantillonnés (longueur, complétude, ton, profil d'auteur). Cela évite aussi
la « monoculture LLM » (corpus trop propre et homogène).

Registre : français + termes techniques anglais uniquement. **Pas d'arabizi**
(hors périmètre, cf. doc de conception §Périmètre confirmé).
"""

from __future__ import annotations

# ─────────────────────────────────────────────────────────────────────────────
# Graines de scénarios par catégorie (archétypes d'incidents réels d'une DSI)
# ─────────────────────────────────────────────────────────────────────────────

SCENARIO_SEEDS: dict[str, list[str]] = {
    "Réseau": [
        "VPN Cisco AnyConnect se déconnecte toutes les 5 minutes en télétravail",
        "Wi-Fi du 2e étage introuvable depuis ce matin",
        "accès au serveur de fichiers partagé impossible (timeout)",
        "Internet très lent sur tout l'open space",
        "impossible de joindre l'ERP, erreur « connection refused »",
        "coupure réseau totale sur le site de Sfax",
        "le proxy bloque un site nécessaire au travail",
        "latence élevée sur les visioconférences Teams",
        "adresse IP en conflit sur le poste après un redémarrage",
        "port réseau de la salle de réunion inactif",
        "DNS ne résout plus les adresses internes",
        "VPN refuse la connexion : « authentication failed »",
    ],
    "Matériel": [
        "le PC portable ne s'allume plus, aucune LED",
        "imprimante HP de l'étage affiche « bourrage papier » persistant",
        "écran secondaire non détecté après changement de dock",
        "clavier dont plusieurs touches ne répondent plus",
        "batterie du laptop se décharge en 30 minutes",
        "disque dur qui fait un bruit de clic, poste très lent",
        "webcam non reconnue pour les réunions",
        "scanner du service RH ne numérise plus",
        "surchauffe et arrêts intempestifs du poste fixe",
        "casque USB grésille pendant les appels",
        "souris sans fil qui saute et se fige",
        "station d'accueil qui ne charge plus le portable",
    ],
    "Logiciel": [
        "Outlook plante à l'ouverture après la dernière mise à jour",
        "Excel se ferme tout seul en ouvrant un gros classeur",
        "licence Adobe expirée, impossible d'ouvrir les PDF",
        "l'application métier affiche « runtime error » au démarrage",
        "Windows Update échoue avec le code 0x80070005",
        "Chrome extrêmement lent, onglets qui freezent",
        "installation d'un logiciel de comptabilité demandée",
        "SAP GUI ne se lance plus après migration",
        "macro VBA qui ne s'exécute plus depuis la mise à jour Office",
        "message « fichier corrompu » à l'ouverture d'un document Word",
        "antivirus bloque un exécutable interne légitime",
        "mise à jour d'un pilote d'imprimante à déployer",
    ],
    "Accès": [
        "compte Active Directory verrouillé après trop de tentatives",
        "demande d'accès au dossier partagé du service Finance",
        "réinitialisation de mot de passe pour un nouveau collaborateur",
        "droits insuffisants pour modifier un fichier sur le NAS",
        "MFA ne reçoit plus les codes par SMS",
        "création de compte pour un stagiaire arrivant lundi",
        "accès à la boîte mail partagée du support à ouvrir",
        "badge d'accès qui ne fonctionne plus sur la porte serveurs",
        "compte désactivé par erreur après un départ",
        "impossible de se connecter au portail RH (SSO)",
        "élévation de droits admin local demandée pour un test",
        "accès VPN à provisionner pour un prestataire externe",
    ],
    "Autre": [
        "demande d'un second écran pour le nouveau poste",
        "question sur la procédure de sauvegarde des fichiers",
        "commande de fournitures : toner pour l'imprimante",
        "demande de formation sur l'outil de ticketing",
        "coquille dans le libellé d'un menu de l'intranet",
        "changement du fond d'écran d'entreprise demandé",
        "renseignement sur la politique de télétravail IT",
        "déménagement de poste vers un autre bureau à planifier",
        "demande d'un logiciel optionnel de prise de notes",
        "question sur la compatibilité d'un fichier reçu",
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Axes de diversité (échantillonnés par ticket)
# ─────────────────────────────────────────────────────────────────────────────

# Longueur de la description.
LENGTH_BANDS: dict[str, str] = {
    "courte": "1 phrase, très brève (parfois vague/incomplète, comme un vrai ticket rapide)",
    "moyenne": "2 à 4 phrases avec quelques détails de contexte",
    "longue": "5 à 8 phrases : contexte, ce qui a été tenté, impact, urgence ressentie",
}
LENGTH_WEIGHTS = {"courte": 0.35, "moyenne": 0.45, "longue": 0.20}

# Niveau de complétude de l'information fournie par le demandeur.
# « indigente » ≈ 30% : tickets tels qu'ils arrivent VRAIMENT en support — une
# ligne, aucun symptôme — le classifieur (J5) doit apprendre à les gérer.
COMPLETENESS: dict[str, str] = {
    "indigente": (
        "une seule phrase télégraphique, AUCUN contexte ni symptôme précis "
        "(ex. « ça marche pas », « le PC bug », « erreur », « ça rame »)"
    ),
    "vague": "manque des détails clés (pas de message d'erreur exact, contexte flou)",
    "correcte": "donne les informations utiles sans être exhaustif",
    "detaillee": "fournit message d'erreur exact, étapes de reproduction et contexte matériel/logiciel",
}
COMPLETENESS_WEIGHTS = {"indigente": 0.30, "vague": 0.25, "correcte": 0.30, "detaillee": 0.15}

# Ton du demandeur.
TONES: dict[str, str] = {
    "neutre": "factuel et poli",
    "presse": "pressé, sous contrainte de temps",
    "frustre": "agacé, l'incident dure depuis un moment",
    "hesitant": "peu à l'aise techniquement, s'excuse presque",
}
TONE_WEIGHTS = {"neutre": 0.45, "presse": 0.25, "frustre": 0.15, "hesitant": 0.15}

# Profils d'auteur (service / poste) — cohérent avec Utilisateur.service.
AUTHOR_PROFILES: list[str] = [
    "Comptabilité / comptable",
    "RH / gestionnaire de paie",
    "Commercial / chargé d'affaires",
    "Direction / assistant(e) de direction",
    "Production / technicien atelier",
    "Marketing / community manager",
    "Juridique / juriste",
    "Logistique / responsable stock",
    "Support IT interne / technicien N1",
    "Bureau d'études / ingénieur",
]


def scenario_for(rng, nom: str, description: str) -> str:
    """Graine de scénario pour une catégorie.

    Si la catégorie a des graines dédiées, on en tire une au hasard. Sinon
    (catégorie ajoutée dynamiquement par l'admin §6.5), on retombe sur un
    scénario dérivé de la description en base — le corpus reste généralisable.
    """
    graines = SCENARIO_SEEDS.get(nom)
    if graines:
        return rng.choice(graines)
    return f"un incident concret et courant relevant de « {nom} » ({description})"
