# syntax=docker/dockerfile:1
# =============================================================================
#  Service IA (Epic 4) — microservice FastAPI du module IA :
#  embeddings bge-m3, reranker, classification, priorité, RAG, OCR.
#
#  ÉTAPES 1-2 du plan Docker : socle Python + dépendances figées (CPU) + OCR
#  système. Arrivent ensuite : utilisateur non-root + CMD + healthcheck (3),
#  modèles HF et montages (4).
# =============================================================================

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Le paquet n'est PAS installé en éditable (`pip install -e .`) : python:3.12-slim
# ne fournit pas setuptools, et un éditable déclencherait une build isolée qui
# téléchargerait setuptools>=68 — non épinglé, donc HORS du lock — uniquement pour
# écrire des métadonnées dont le runtime n'a aucun usage. PYTHONPATH est
# déterministe et suffit à importer `smart_ticketing_ml`.
ENV PYTHONPATH=/app

# WORKDIR /app est STRUCTURANT, pas cosmétique : service/predictors.py résout
# `artifacts/models/classifier_*.joblib` et flywheel/reentrainer.py
# `gold/gold.jsonl` en RELATIF du répertoire courant. Démarrer ailleurs casserait
# /classify et /reentrainer.
WORKDIR /app

# ── Couche système : OCR (J8bis Lot B) ──────────────────────────────────────
# Tesseract est un binaire SYSTÈME, hors pip. Le pack `fra` est requis :
# service/config.py fixe OCR_LANGUE=fra (FR + termes techniques EN, même parti
# que les embeddings). Sans ce pack, Tesseract échoue à l'exécution, pas au build.
# Placée AVANT pip : c'est la couche la plus stable du fichier.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr \
      tesseract-ocr-fra \
 && rm -rf /var/lib/apt/lists/*

# ── Utilisateur non-root ────────────────────────────────────────────────────
# Créé ici (couche stable) mais activé seulement à la fin : pip et apt ont besoin
# de root. UID fixe 10001 pour que les droits du bind-mount `artifacts/` soient
# prévisibles d'une machine à l'autre.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin ia

# ── Couche dépendances ──────────────────────────────────────────────────────
# La plus lourde (torch CPU) : placée AVANT le code pour ne pas être invalidée à
# chaque modification Python. Le cache BuildKit conserve les wheels même quand la
# couche est invalidée (l'ajout de la couche système ci-dessus, par exemple).
COPY requirements.lock ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.lock \
 && rm -rf /usr/local/lib/python3.12/site-packages/torch/include \
           /usr/local/lib/python3.12/site-packages/torch/test

# La purge est DANS le même RUN que l'installation, et ce n'est pas du style :
# un `rm` placé dans une couche ultérieure laisserait les fichiers dans la couche
# inférieure — l'image ne maigrirait pas d'un octet. On retire les en-têtes C++
# (49 Mo) et les binaires de test (72 Mo) de torch : nécessaires pour COMPILER
# des extensions, inutiles pour en INFÉRER (vérifié : 0 usage de
# torch.utils.cpp_extension dans le projet). Les .pyc sont en revanche CONSERVÉS
# — PYTHONDONTWRITEBYTECODE=1 les empêcherait d'être régénérés, et torch se
# recompilerait à chaque démarrage du conteneur.

# ── Garde-fou de build ──────────────────────────────────────────────────────
# Le classifieur figé J5 est picklé en scikit-learn 1.4.0 ; torch doit être la
# build CPU ; l'OCR exige le pack `fra`. Si l'un dérive, le build ÉCHOUE ici —
# bruyamment — au lieu de livrer une image qui tombe en 503 au premier appel.
RUN python - <<'PY'
import subprocess, sklearn, torch
assert sklearn.__version__ == "1.4.0", f"sklearn {sklearn.__version__} != 1.4.0 (pickle du .joblib J5)"
assert torch.__version__.endswith("+cpu"), f"torch {torch.__version__} n'est pas la build CPU"
langs = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True).stdout
assert "fra" in langs.split(), f"pack Tesseract 'fra' absent (OCR_LANGUE=fra) — langues : {langs.split()}"
print(f"garde-fou OK — sklearn {sklearn.__version__}, torch {torch.__version__}, tesseract fra")
PY

# ── Couche source ───────────────────────────────────────────────────────────
# En dernier : change à chaque commit, n'invalide donc rien en amont.
# `artifacts/` en est exclu (.dockerignore) — il sera MONTÉ au runtime.
COPY --chown=ia:ia . .

# `/app` reste la propriété de ROOT : le service tourne en `ia` et ne peut donc PAS
# réécrire son propre code — durcissement délibéré. Seul `artifacts/` lui appartient,
# parce que /reentrainer doit y écrire ses candidats. Effet de bord assumé : pytest
# ne peut pas créer /app/.pytest_cache (avertissement bénin) → lancer les tests avec
# `-p no:cacheprovider` dans le conteneur.
RUN mkdir -p /app/artifacts && chown ia:ia /app/artifacts

# ── Cache des modèles Hugging Face ──────────────────────────────────────────
# HF_HOME sort le cache de $HOME pour en faire un point de montage explicite :
# le volume nommé `hf-cache` y est monté (bge-m3 + reranker ≈ 4,3 Go), ce qui
# garde l'image légère ET conserve les modèles d'un rebuild à l'autre.
# Le dossier est créé et attribué à `ia` AVANT le montage : Docker recopie
# l'appartenance du répertoire de l'image sur un volume neuf — sans ça, le
# volume naîtrait root et le service, non-root, ne pourrait pas y écrire.
ENV HF_HOME=/cache/huggingface
RUN mkdir -p /cache/huggingface && chown -R ia:ia /cache

USER ia
EXPOSE 8000

# ── Supervision ─────────────────────────────────────────────────────────────
# `/sante` est DÉLIBÉRÉMENT léger : il ne charge aucun modèle, il rapporte leur
# état (`modele_charge`). Le healthcheck reste donc rapide et ne déclenche pas
# un chargement de 2,3 Go. Pas de curl dans python:slim → urllib.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request as u,sys; sys.exit(0 if u.urlopen('http://127.0.0.1:8000/sante', timeout=4).status == 200 else 1)"

# --host 0.0.0.0 est OBLIGATOIRE : le défaut du projet (EMBED_HOTE=127.0.0.1,
# service/config.py) n'écoute que la boucle locale du conteneur et rendrait le
# service injoignable depuis `backend`. Un SEUL worker : chaque worker chargerait
# sa propre copie de bge-m3 (~2,3 Go) et du reranker.
CMD ["uvicorn", "smart_ticketing_ml.service.app:app", "--host", "0.0.0.0", "--port", "8000"]
