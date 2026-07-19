"""
Ingestion de tickets RÉELS (Kaggle) pour ENRICHIR l'entraînement — adaptation de
domaine (J5+). Distinct de `ingest_validation_externe` (qui scelle les 46 du TEST).

But : jusqu'ici l'entraînement est 100 % synthétique. On ajoute ~100-150 vrais
tickets FR pour tester si le réel à l'entraînement **réduit l'écart synthétique→réel**.

Source : Kaggle « Customer IT Support Ticket Dataset » (Tobias Bueck), CC BY 4.0,
fichier `dataset-tickets-multi-lang3-4k.csv`. Périmètre = **FR** + queues **IT**
(Technical Support + Product Support + IT Support = 291 tickets).

⚠️ ÉTANCHÉITÉ ABSOLUE vs les 46 du test (`gold/validation_externe.jsonl`) — train et
test viennent du **même CSV**, c'est le scénario le plus risqué pour une fuite. Donc :
  - exclusion **exacte** (description normalisée identique) ;
  - exclusion **approximative** au seuil **Jaccard ≥ 0.5** — volontairement **plus
    strict** que le 0.6 standard du harnais (justification : source commune) ;
  - dédup interne ; **fail dur** si un recouvrement exact subsiste après exclusion.

Étiquetage : **automatique** (tags Kaggle + **lexique d'entités produits** + mots-clés
FR/EN → nos 5 catégories), puis **spot-check** manuel avant de conclure. Le mapping est
spécifique à la taxonomie courante (5 catégories) : si l'admin change les catégories
(§6.5), il est à revoir (cohérent avec la contrainte « catégories dynamiques »).

Réglages du mapping (2ᵉ itération, après spot-check r1 à ~53-70 %) :
  - **entités produits** (Jira/Zoom/MacBook/Cisco…) pesant **autant qu'un tag** (2.0) —
    corrige le fourre-tout `Autre` sur titres courts sans mot-clé ;
  - **Hardware Failure > Software Bug** (tag matériel à poids 3.0) ;
  - **veto visioconférence** : `Login Issue`/`Account Assistance` ne déclenchent PAS
    `Accès` en contexte Zoom/Teams (connectivité) → Réseau/Logiciel ;
  - `Autre` **uniquement** si score nul (aucun signal), jamais « parce que court ».

`text` de prédiction = **Sujet + Corps** — JAMAIS `answer` (réservé au RAG J6).

Sorties versionnées :
  - `real/real_train_kaggle.jsonl`         (tickets retenus, étiquette auto)
  - `real/real_train_kaggle_manifest.json` (attribution, étanchéité, distribution)
  - `real/real_train_kaggle_spotcheck.csv` (échantillon stratifié à relire)

Usage (depuis `ml/`) :
    python -m smart_ticketing_ml.data.ingest_kaggle_train
    python -m smart_ticketing_ml.data.ingest_kaggle_train \
        --exclude real/real_train_kaggle_spotcheck_r1.csv \
        --spotcheck-out real/real_train_kaggle_spotcheck_r2.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

from ..eval.dataset import _jaccard, _norm, _tokens, load_exemples

SOURCE = "Kaggle « Customer IT Support Ticket Dataset » (Tobias Bueck), CC BY 4.0"
CSV_DEFAUT = r"C:\Users\LOQ\Downloads\archive (1)\dataset-tickets-multi-lang3-4k.csv"
QUEUES_IT = {"Technical Support", "Product Support", "IT Support"}
SIM_STRICT = 0.5  # seuil approximatif RENFORCÉ (vs 0.6 harnais) — source commune train/test
SEED = 42

# ── Mapping tags/entités/texte → nos 5 catégories ────────────────────────────
# Poids : entité produit = 2.0 (comme un tag), mot-clé générique = 1.0, tag = poids
# propre (Hardware Failure fort ; Software Bug/Login faibles). Spécifique aux 5
# catégories courantes. Départage des ex æquo : Matériel > Réseau > Accès > Logiciel
# (encode « Hardware Failure bat Software Bug » sur égalité).

TAGS: dict[str, tuple[str, float]] = {
    "Hardware Failure": ("Matériel", 3.0),   # bat un Software Bug (1.0)
    "Warranty Claim": ("Matériel", 2.0),
    "Product Replacement": ("Matériel", 2.0),
    "Network Issue": ("Réseau", 2.5),
    "Service Outage": ("Réseau", 2.0),
    "Cloud Services": ("Réseau", 2.0),
    "Video Conferencing": ("Réseau", 1.0),
    "Email Configuration": ("Réseau", 1.5),
    "Password Reset": ("Accès", 2.5),
    "Account Security": ("Accès", 2.0),
    "Login Issue": ("Accès", 1.5),            # veto en contexte visio
    "Account Assistance": ("Accès", 1.0),     # veto en contexte visio
    "Software Bug": ("Logiciel", 1.0),        # ambigu → faible
    "System Crash": ("Logiciel", 1.0),
    "Feature Request": ("Logiciel", 1.0),
    "Database Issue": ("Logiciel", 2.0),
    "Virus Removal": ("Logiciel", 2.0),
}
TAGS_VETO_VISIO = {"Login Issue", "Account Assistance"}  # ne comptent pas si visio

# Entités produits (poids 2.0). Match par mot entier (\b) — évite que « hp », « xps »,
# « sap », « lan » ne se déclenchent à l'intérieur d'un autre mot.
ENTITES: dict[str, tuple[str, ...]] = {
    "Logiciel": (
        "jira", "confluence", "zoom", "teams", "slack", "vscode", "visual studio code",
        "photoshop", "illustrator", "adobe", "office", "microsoft 365", "excel", "word",
        "powerpoint", "outlook", "chrome", "firefox", "sap", "salesforce", "notion",
        "trello", "skype", "webex", "windows", "macos", "sql server", "oracle", "sharepoint",
    ),
    "Matériel": (
        "macbook", "imac", "surface", "ipad", "iphone", "dell", "xps", "lenovo",
        "thinkpad", "ideapad", "hp", "deskjet", "epson", "ecotank", "brother", "canon",
        "imprimante", "écran", "moniteur", "clavier", "souris", "tablette", "scanner",
        "disque dur", "ssd", "batterie", "carte graphique", "webcam", "station d'accueil",
    ),
    "Réseau": (
        "cisco", "routeur", "router", "aws", "azure", "gcp", "google cloud", "vpn",
        "anyconnect", "fortinet", "fortigate", "vlan", "dns", "dhcp", "firewall",
        "pare-feu", "wifi", "wi-fi", "ethernet", "proxy", "switch",
    ),
}

MOTS_CLES: dict[str, tuple[str, ...]] = {
    # NB : « connexion » seul est volontairement ABSENT de Réseau (en FR support IT il
    # désigne le plus souvent l'ouverture de session → Accès), pour éviter les faux positifs.
    "Réseau": (
        "connectivité", "déconnexion", "déconnect", "hors ligne", "réseau lent",
        "latence", "bande passante", "internet",
    ),
    "Matériel": (
        "surchauffe", "ne démarre", "démarre pas", "ne s'allume", "bourrage",
        "matériel", "port usb", "usb", "physique",
    ),
    "Accès": (
        "mot de passe", "password", "identifiant", "authentification", "accès refusé",
        "compte verrouillé", "verrouillé", "permission", "droits d'accès", "réinitialis",
        "se connecter à", "connexion au compte", "sso", "mfa", "2fa",
    ),
    "Logiciel": (
        "logiciel", "application", "installation", "installer", "mise à jour", "update",
        "bug", "plante", "plantage", "erreur", "licence", "version", "compatibilité",
        "se ferme", "ne se lance",
    ),
}
VISIO = ("zoom", "teams", "meet", "skype", "webex", "visioconf", "vidéoconf",
         "visioconférence", "vidéoconférence")

ORDRE = ("Matériel", "Réseau", "Accès", "Logiciel")  # départage des ex æquo


def _mot_entier(terme: str, texte: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(terme)}(?!\w)", texte) is not None


def mapper_categorie(subject: str, body: str, tags: list[str]) -> tuple[str, list[str], dict]:
    """Retourne (catégorie, signaux, scores). Argmax pondéré ; 0 signal → Autre."""
    texte = f"{subject} {body}".lower()
    scores: dict[str, float] = defaultdict(float)
    signaux: list[str] = []
    visio = any(v in texte for v in VISIO)

    for cat, ents in ENTITES.items():
        for e in ents:
            if _mot_entier(e, texte):
                scores[cat] += 2.0
                signaux.append(f"ent:{e}→{cat}(+2)")
    for cat, mots in MOTS_CLES.items():
        for m in mots:
            if m in texte:
                scores[cat] += 1.0
                signaux.append(f"kw:{m}→{cat}(+1)")
    for t in tags:
        spec = TAGS.get(t)
        if not spec:
            continue
        cat, w = spec
        if t in TAGS_VETO_VISIO and visio:
            signaux.append(f"tag:{t}⊘visio")
            continue
        scores[cat] += w
        signaux.append(f"tag:{t}→{cat}(+{w:g})")

    cands = {c: s for c, s in scores.items() if s > 0}
    if not cands:
        return "Autre", signaux, {}
    meilleur = max(ORDRE, key=lambda c: (cands.get(c, -1.0), -ORDRE.index(c)))
    return meilleur, signaux, dict(scores)


PRIORITE_MAP = {"low": "FAIBLE", "medium": "MOYENNE", "high": "HAUTE"}


def _ids_a_exclure(chemins: str) -> set[str]:
    ids: set[str] = set()
    for p in [c.strip() for c in chemins.split(",") if c.strip()]:
        path = Path(p)
        if not path.exists():
            print(f"⚠️ Exclusion : fichier introuvable {path}", file=sys.stderr)
            continue
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                if row.get("id"):
                    ids.add(row["id"].strip())
    return ids


def run(args: argparse.Namespace) -> int:
    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"❌ CSV Kaggle introuvable : {csv_path}", file=sys.stderr)
        return 1
    try:
        test = load_exemples(args.test)
    except FileNotFoundError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1

    test_desc = {_norm(e.description) for e in test}
    test_tok = [_tokens(e.titre + " " + e.description) for e in test]

    with csv_path.open(encoding="utf-8") as f:
        brut = [
            x for x in csv.DictReader(f)
            if str(x.get("language", "")).lower().startswith("fr")
            and x.get("queue") in QUEUES_IT
        ]

    kept: list[dict] = []
    vus_desc: set[str] = set()
    n_exact = n_approx = n_dup = 0
    approx_exemples: list[tuple[str, float]] = []

    for x in brut:
        subject = (x.get("subject") or "").strip()
        body = (x.get("body") or "").strip()
        if not subject and not body:
            continue
        nd = _norm(body)
        if nd in test_desc:
            n_exact += 1
            continue
        if nd in vus_desc:
            n_dup += 1
            continue
        gtok = _tokens(subject + " " + body)
        sim_max = max((_jaccard(gtok, t) for t in test_tok), default=0.0)
        if sim_max >= args.sim:
            n_approx += 1
            approx_exemples.append((subject[:60], round(sim_max, 3)))
            continue

        vus_desc.add(nd)
        tags = [x.get(f"tag_{i}") for i in range(1, 9) if x.get(f"tag_{i}")]
        categorie, signaux, scores = mapper_categorie(subject, body, tags)
        kept.append({
            "id": f"kag-{len(kept) + 1:04d}",
            "titre": subject,
            "description": body,
            "categorie": categorie,
            "priorite": PRIORITE_MAP.get(str(x.get("priority", "")).lower(), "MOYENNE"),
            "statut": "RESOLU",
            "reponse_agent": (x.get("answer") or None),
            "queue_source": x.get("queue"),
            "tags_source": tags,
            "categorie_auto": categorie,
            "mapping_signaux": signaux,
            "mapping_scores": {k: round(v, 1) for k, v in scores.items()},
            "reel": True,
            "synthetique": False,
            "source": SOURCE,
        })

    if not kept:
        print("❌ Aucun ticket retenu après étanchéité.", file=sys.stderr)
        return 1

    residu = [r for r in kept if _norm(r["description"]) in test_desc]
    if residu:
        print(f"❌ ÉTANCHÉITÉ VIOLÉE : {len(residu)} exact(s) subsistant(s).", file=sys.stderr)
        return 2

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as fh:
        for rec in kept:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    dist = Counter(r["categorie"] for r in kept)
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    manifest = {
        "genere_le": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": SOURCE, "licence": "CC BY 4.0", "source_csv": str(csv_path),
        "perimetre": f"FR + queues IT {sorted(QUEUES_IT)}",
        "role": "ENRICHISSEMENT DE L'ENTRAÎNEMENT (adaptation de domaine) — jamais du test",
        "etiquetage": "automatique (entités + tags + mots-clés) → spot-check manuel",
        "n_candidats_fr_it": len(brut),
        "n_retenus": len(kept),
        "etancheite": {
            "test_ref": args.test, "n_test": len(test),
            "seuil_approx_jaccard": args.sim,
            "seuil_renforce_vs_harnais": f"{args.sim} (< 0.6 standard) — justif. : source commune train/test",
            "exclus_exact": n_exact,
            "exclus_approx": n_approx,
            "exclus_dedup_interne": n_dup,
            "exact_residuel_apres_exclusion": len(residu),
            "exemples_approx_exclus": approx_exemples[:10],
        },
        "repartition_categorie_auto": dict(dist),
        "sha256": digest,
    }
    (out.parent / "real_train_kaggle_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    # Spot-check stratifié, en excluant les ids déjà relus (contrôle honnête).
    exclus = _ids_a_exclure(args.exclude) if args.exclude else set()
    rnd = random.Random(args.seed)
    par_cat: dict[str, list[dict]] = defaultdict(list)
    for r in kept:
        if r["id"] not in exclus:
            par_cat[r["categorie"]].append(r)
    cats = [c for c in par_cat if par_cat[c]]
    echantillon: list[dict] = []
    i = 0
    while len(echantillon) < min(args.spotcheck, sum(len(v) for v in par_cat.values())):
        c = cats[i % len(cats)]
        if par_cat[c]:
            echantillon.append(par_cat[c].pop(rnd.randrange(len(par_cat[c]))))
        i += 1
        if all(not par_cat[cc] for cc in cats):
            break
    spot = Path(args.spotcheck_out)
    with spot.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "categorie_auto", "correct_O/N", "categorie_corrigee",
                    "scores", "queue", "signaux", "titre", "corps_extrait"])
        for r in echantillon:
            sc = " ".join(f"{k}:{v:g}" for k, v in sorted(
                r["mapping_scores"].items(), key=lambda kv: -kv[1]))
            w.writerow([r["id"], r["categorie_auto"], "", "", sc, r["queue_source"],
                        " ; ".join(r["mapping_signaux"][:10]),
                        r["titre"], (r["description"] or "")[:220].replace("\n", " ")])

    print(f"✅ Réel d'entraînement (Kaggle) → {out} ({len(kept)} tickets)")
    print(f"   Candidats FR-IT : {len(brut)}  |  retenus : {len(kept)}")
    print(f"   Étanchéité — exclus exact : {n_exact}  approx(J≥{args.sim}) : {n_approx}  "
          f"dédup : {n_dup}  |  exact résiduel : {len(residu)} (doit être 0)")
    print(f"   Répartition catégorie (auto) : {dict(dist)}")
    print(f"   Spot-check ({len(echantillon)}, exclus {len(exclus)} déjà vus) → {spot}")
    print(f"   SHA-256 : {digest[:16]}…")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Ingestion Kaggle pour enrichir l'entraînement (adaptation de domaine).")
    p.add_argument("--csv", default=CSV_DEFAUT)
    p.add_argument("--test", default="gold/validation_externe.jsonl")
    p.add_argument("--out", default="real/real_train_kaggle.jsonl")
    p.add_argument("--sim", type=float, default=SIM_STRICT, help="Seuil Jaccard d'exclusion approximative (renforcé).")
    p.add_argument("--spotcheck", type=int, default=30, help="Taille de l'échantillon de relecture.")
    p.add_argument("--spotcheck-out", default="real/real_train_kaggle_spotcheck.csv")
    p.add_argument("--exclude", default="", help="CSV(s) de spot-check dont exclure les ids (séparés par des virgules).")
    p.add_argument("--seed", type=int, default=SEED, help="Graine d'échantillonnage du spot-check.")
    return run(p.parse_args())


if __name__ == "__main__":
    raise SystemExit(main())
