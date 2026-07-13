// Échappe les caractères HTML spéciaux avant insertion dans un gabarit d'e-mail
// HTML. Empêche l'injection de balises/liens (phishing) via des valeurs libres
// comme le titre d'un ticket, qui n'est pas restreint à un jeu de caractères sûr.
export function escapeHtml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
