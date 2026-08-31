"""Contrat de l'OCR (CDC §6.3, J8bis) : détection de type par *magic bytes* + seuil anti-bruit.

Les fonctions pures (`_sniff`, `_fiabilite`) sont testées sans Tesseract. Un test d'intégration
OCR réel (rendu PIL → extraction) est marqué `slow` et se SKIPPE si Tesseract est absent.
"""

import io

import pytest

from smart_ticketing_ml.service import config, ocr


# ── Détection de type (magic bytes, robuste à un Content-Type erroné) ───────────
def test_sniff_pdf_par_signature():
    assert ocr._sniff(b"%PDF-1.7\n%\xe2\xe3", "sans-extension") == "pdf"


def test_sniff_png_par_signature():
    assert ocr._sniff(b"\x89PNG\r\n\x1a\n\x00\x00", "x") == "image"


def test_sniff_jpeg_par_signature():
    assert ocr._sniff(b"\xff\xd8\xff\xe0\x00\x10JFIF", "x") == "image"


def test_sniff_repli_sur_extension():
    assert ocr._sniff(b"contenu quelconque", "document.pdf") == "pdf"
    assert ocr._sniff(b"contenu quelconque", "capture.PNG") == "image"


def test_sniff_type_inconnu():
    assert ocr._sniff(b"ni image ni pdf", "note.txt") == ""


# ── Étage DOCUMENT du seuil anti-bruit (`_fiabilite`) ───────────────────────────
def test_fiabilite_couche_texte_pdf_fiable():
    res = {"methode": "texte_pdf", "texte": "x" * (config.PDF_MIN_CHARS_TEXTE + 5)}
    fiable, motif = ocr._fiabilite(res)
    assert fiable is True and motif == ""


def test_fiabilite_couche_texte_trop_courte():
    res = {"methode": "texte_pdf", "texte": "ab"}
    assert ocr._fiabilite(res)[0] is False


def test_fiabilite_ocr_trop_peu_de_mots():
    res = {"methode": "ocr_image", "n_mots": config.OCR_MIN_MOTS - 1,
           "confiance": 95.0, "texte": "a b"}
    assert ocr._fiabilite(res)[0] is False


def test_fiabilite_ocr_confiance_insuffisante():
    res = {"methode": "ocr_image", "n_mots": config.OCR_MIN_MOTS + 5,
           "confiance": config.OCR_SEUIL_DOC - 10, "texte": "du texte"}
    assert ocr._fiabilite(res)[0] is False


def test_fiabilite_ocr_fiable():
    res = {"methode": "ocr_image", "n_mots": config.OCR_MIN_MOTS + 5,
           "confiance": config.OCR_SEUIL_DOC + 10, "texte": "du texte lisible"}
    assert ocr._fiabilite(res)[0] is True


# ── Point d'entrée : type inconnu → ValueError (→ 422 côté service) ─────────────
def test_extraire_type_inconnu_leve_valueerror():
    with pytest.raises(ValueError):
        ocr.extraire(b"ni une image ni un pdf", "note.txt")


# ── OCR réel (skippé proprement si Tesseract absent) ────────────────────────────
@pytest.mark.slow
@pytest.mark.skipif(not ocr.tesseract_disponible(), reason="Tesseract non installé")
def test_ocr_image_reelle():
    from PIL import Image, ImageDraw, ImageFont

    try:
        police = ImageFont.truetype("arial.ttf", 34)
    except OSError:
        police = ImageFont.load_default()
    img = Image.new("RGB", (640, 120), "white")
    ImageDraw.Draw(img).text((20, 40), "Connexion VPN impossible", fill="black", font=police)
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    res = ocr.extraire(buf.getvalue(), "capture.png")
    assert res["methode"] == "ocr_image"
    assert {"texte", "fiable", "confiance", "n_mots", "langue"} <= set(res)
    assert isinstance(res["texte"], str)
    assert res["n_mots"] >= 1  # Tesseract a lu au moins un mot du rendu net
