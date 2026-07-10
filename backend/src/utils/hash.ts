import { createHash } from 'node:crypto';

// Hash SHA-256 (hex) des secrets à usage unique (codes OTP, tokens d'invitation) :
// seul le hash est stocké en base, le secret en clair ne transite que par e-mail.
export function sha256Hex(valeur: string): string {
  return createHash('sha256').update(valeur).digest('hex');
}
