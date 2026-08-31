"""
J8bis Lot B — Extraction de texte des pièces jointes (OCR), local-first.

Frontière de service (comme `/classify`, `/embed`) : le service reçoit des OCTETS
et renvoie du TEXTE + métadonnées en JSON. Il ne touche NI Cloudinary NI la base :
Node récupère les octets (il le fait déjà pour le proxy de téléchargement) et
persiste le `texte_extrait` si le résultat est jugé fiable.

Trois branches, auto-détectées par les *magic bytes* (pas le Content-Type du client) :
  - **PDF à couche texte** → `pdfplumber` extrait directement (aucun OCR quand le
    texte est déjà là : rapide et exact) ;
  - **PDF scanné** (couche texte quasi vide) → rasterisation page par page
    (`pdfplumber.Page.to_image`, backend pypdfium2) puis `pytesseract` ;
  - **image** (PNG/JPG) → `pytesseract` direct.

Seuil de confiance anti-bruit à DEUX étages (l'OCR d'un scan médiocre produit du
charabia — le stocker polluerait l'affichage et la ré-classification) :
  - étage **MOT** : on écarte chaque mot sous `OCR_SEUIL_MOT` (charabia isolé) ;
  - étage **DOCUMENT** : `fiable=False` si la confiance moyenne des mots retenus est
    sous `OCR_SEUIL_DOC`, ou s'il reste moins de `OCR_MIN_MOTS` mots.
Le texte d'une couche PDF (pas d'OCR) est fiable par construction.

Tout est local : aucun appel externe, aucun coût (CDC §10). Tesseract est un binaire
SYSTÈME (pack `fra`) ; son chemin est configurable (`TESSERACT_CMD`, cf. `config`).
"""

from __future__ import annotations

import io
import re
import time

from . import config

# Config paresseuse de pytesseract : le binaire est système, on ne fixe son chemin
# qu'une fois, au premier usage (comme le chargement paresseux de l'embedder).
_configure = False


def _pytesseract():
    """Importe pytesseract et fixe (une fois) le chemin du binaire Tesseract."""
    global _configure
    try:
        import pytesseract
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("Paquet `pytesseract` manquant : pip install -e ml[ocr]") from exc
    if not _configure:
        if config.TESSERACT_CMD:
            pytesseract.pytesseract.tesseract_cmd = config.TESSERACT_CMD
        _configure = True
    return pytesseract


def tesseract_disponible() -> bool:
    """Vrai si le binaire Tesseract répond (utile pour `/sante`)."""
    try:
        pt = _pytesseract()
        pt.get_tesseract_version()
        return True
    except Exception:
        return False


# ── Détection de type (magic bytes, robuste à un Content-Type erroné) ─────────

def _sniff(octets: bytes, nom_fichier: str) -> str:
    """'pdf' | 'image' | '' — signature binaire d'abord, extension en repli."""
    if octets[:4] == b"%PDF":
        return "pdf"
    if octets[:8] == b"\x89PNG\r\n\x1a\n" or octets[:3] == b"\xff\xd8\xff":
        return "image"
    ext = nom_fichier.lower().rsplit(".", 1)[-1] if "." in nom_fichier else ""
    if ext == "pdf":
        return "pdf"
    if ext in {"png", "jpg", "jpeg"}:
        return "image"
    return ""


# ── OCR d'une image (étage MOT du seuil anti-bruit) ───────────────────────────

def _ocr_image(img) -> tuple[str, float, int]:
    """OCR d'une image PIL → (texte, confiance_moyenne_0_100, n_mots_retenus).

    On lit la confiance PAR MOT (`image_to_data`) et on n'agrège que les mots au-dessus
    de `OCR_SEUIL_MOT` : le charabia isolé (faible confiance) est écarté d'emblée. Les
    numéros (bloc, paragraphe, ligne) servent à reconstituer les sauts de ligne.
    """
    pt = _pytesseract()
    from pytesseract import Output, TesseractNotFoundError

    try:
        d = pt.image_to_data(img, lang=config.OCR_LANGUE, output_type=Output.DICT)
    except TesseractNotFoundError as exc:
        raise RuntimeError(
            "Binaire Tesseract introuvable — installe-le (pack `fra`) et/ou fixe TESSERACT_CMD."
        ) from exc

    lignes: dict[tuple, list[str]] = {}
    ordre: list[tuple] = []
    confs: list[float] = []
    for i in range(len(d["text"])):
        mot = (d["text"][i] or "").strip()
        try:
            conf = float(d["conf"][i])
        except (TypeError, ValueError):
            conf = -1.0
        if not mot or conf < config.OCR_SEUIL_MOT:
            continue
        cle = (d["block_num"][i], d["par_num"][i], d["line_num"][i])
        if cle not in lignes:
            lignes[cle] = []
            ordre.append(cle)
        lignes[cle].append(mot)
        confs.append(conf)

    texte = "\n".join(" ".join(lignes[k]) for k in ordre)
    n_mots = sum(len(lignes[k]) for k in ordre)
    confiance = sum(confs) / len(confs) if confs else 0.0
    return texte, confiance, n_mots


# ── Branches d'extraction ─────────────────────────────────────────────────────

def _extraire_image(octets: bytes) -> dict:
    from PIL import Image, UnidentifiedImageError

    try:
        img = Image.open(io.BytesIO(octets))
        img.load()
    except (UnidentifiedImageError, OSError) as exc:
        raise ValueError(f"Image illisible : {exc}") from exc
    texte, conf, n_mots = _ocr_image(img)
    return {"texte": texte, "confiance": round(conf, 1), "methode": "ocr_image",
            "n_mots": n_mots, "n_pages": None}


def _extraire_pdf(octets: bytes) -> dict:
    import pdfplumber

    try:
        pdf = pdfplumber.open(io.BytesIO(octets))
    except Exception as exc:
        raise ValueError(f"PDF illisible : {exc}") from exc

    with pdf:
        n_pages = len(pdf.pages)
        # 1) Couche texte : extraction directe (aucun OCR si le texte est déjà présent).
        morceaux = [(p.extract_text() or "") for p in pdf.pages]
        texte_couche = "\n".join(m for m in morceaux if m.strip())
        if len(re.sub(r"\s", "", texte_couche)) >= config.PDF_MIN_CHARS_TEXTE:
            return {"texte": texte_couche, "confiance": 100.0, "methode": "texte_pdf",
                    "n_mots": len(texte_couche.split()), "n_pages": n_pages}

        # 2) PDF scanné : rasteriser chaque page (pypdfium2) puis OCR.
        textes: list[str] = []
        confs: list[float] = []
        n_mots = 0
        for p in pdf.pages:
            img = p.to_image(resolution=config.OCR_DPI).original
            tx, cf, nm = _ocr_image(img)
            if tx.strip():
                textes.append(tx)
                confs.append(cf)
                n_mots += nm
        confiance = sum(confs) / len(confs) if confs else 0.0
        return {"texte": "\n".join(textes), "confiance": round(confiance, 1),
                "methode": "ocr_pdf_scanne", "n_mots": n_mots, "n_pages": n_pages}


# ── Nettoyage + étage DOCUMENT du seuil anti-bruit ────────────────────────────

def _nettoyer(texte: str) -> str:
    """Espaces multiples réduits, lignes vides supprimées, trim global."""
    lignes = [re.sub(r"[ \t]+", " ", ligne).strip() for ligne in texte.splitlines()]
    return "\n".join(ligne for ligne in lignes if ligne).strip()


def _fiabilite(res: dict) -> tuple[bool, str]:
    """Étage DOCUMENT : décide `fiable` + un motif si non. Le texte de couche PDF est
    fiable par construction ; l'OCR doit franchir la confiance moyenne ET le minimum
    de mots (deux garde-fous indépendants contre le bruit)."""
    if res["methode"] == "texte_pdf":
        if len(re.sub(r"\s", "", res["texte"])) < config.PDF_MIN_CHARS_TEXTE:
            return False, "Couche texte trop courte."
        return True, ""
    if res["n_mots"] < config.OCR_MIN_MOTS:
        return False, f"Trop peu de mots lisibles ({res['n_mots']} < {config.OCR_MIN_MOTS})."
    if res["confiance"] < config.OCR_SEUIL_DOC:
        return False, (f"Confiance OCR insuffisante "
                       f"({res['confiance']:.0f} < {config.OCR_SEUIL_DOC:.0f}).")
    return True, ""


# ── Point d'entrée ────────────────────────────────────────────────────────────

def extraire(octets: bytes, nom_fichier: str = "", type_mime: str | None = None) -> dict:
    """Extrait le texte d'une pièce jointe (PDF ou image) → dict JSON-isable.

    Lève `RuntimeError` si Tesseract/pytesseract manque (→ 503 côté app, Node dégrade),
    `ValueError` si le type est inconnu ou le fichier illisible (→ 422). `type_mime` est
    purement indicatif : le type réel est déterminé par les *magic bytes*.
    """
    t0 = time.perf_counter()
    kind = _sniff(octets, nom_fichier)
    if kind == "pdf":
        res = _extraire_pdf(octets)
    elif kind == "image":
        res = _extraire_image(octets)
    else:
        raise ValueError("Type non supporté (attendu PDF, PNG ou JPEG).")

    res["texte"] = _nettoyer(res["texte"])
    res["fiable"], res["message"] = _fiabilite(res)
    res["langue"] = config.OCR_LANGUE
    res["latence_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    return res
