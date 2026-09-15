export type StatutCompte = 'EN_ATTENTE' | 'ACTIF' | 'DESACTIVE';

interface UtilisateurComplet {
  motDePasse: string | null;
  actif: boolean;
  codeReinitialisation: string | null;
  codeReinitialisationExpire: Date | null;
  codeReinitialisationEmis: Date | null;
  codeReinitialisationTentatives: number;
  tokenInvitation: string | null;
  tokenInvitationExpire: Date | null;
  photoCloudinaryId: string | null;
}

// Retire les champs sensibles (hash du mot de passe, code OTP, token d'invitation)
// avant de renvoyer un utilisateur au client, et dérive un statut de compte lisible :
// invité n'ayant pas encore choisi son mot de passe -> EN_ATTENTE.
// `photoCloudinaryId` est retiré aussi : sans être un secret, c'est une référence interne
// au stockage, inutile au client (qui n'a besoin que de `photoUrl`).
export function toPublicUser<T extends UtilisateurComplet>(user: T) {
  const {
    motDePasse,
    codeReinitialisation: _code,
    codeReinitialisationExpire: _codeExpire,
    codeReinitialisationEmis: _codeEmis,
    codeReinitialisationTentatives: _codeTentatives,
    tokenInvitation: _tokenInvitation,
    tokenInvitationExpire: _tokenInvitationExpire,
    photoCloudinaryId: _photoCloudinaryId,
    ...publicUser
  } = user;

  let statutCompte: StatutCompte = 'ACTIF';
  if (!user.actif) statutCompte = 'DESACTIVE';
  else if (!motDePasse) statutCompte = 'EN_ATTENTE';

  return { ...publicUser, statutCompte };
}
