"""
Microservice IA (Epic 4, J4) — sert les embeddings `bge-m3` (1024d).

Conforme à la thèse directrice (§1/§3 de la conception) : le modèle d'embeddings
est **auto-hébergé** ici, il n'est pas délégué à une API. Un seul pipeline
d'embeddings (`embedder`) sert à la fois le service HTTP (`/embed`) et le
backfill batch — une unique implémentation, deux points d'entrée.
"""
