export const ADMIN_EMAIL_DOMAIN = "@firearena.gg";

// Vérifie si un email est admin (pour les domaines autorisés).
// Uniquement côté client (gating UI). L'autorisation réelle est toujours
// revérifiée côté serveur via admin-auth.ts.
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.endsWith(ADMIN_EMAIL_DOMAIN);
}
