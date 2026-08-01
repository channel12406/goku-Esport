import { verifyIdToken } from "./auth";

const ADMIN_EMAIL_DOMAIN = process.env.ADMIN_EMAIL_DOMAIN || "@firearena.gg";

// Les UIDs admin sont chargés depuis la variable d'environnement ADMIN_UIDS
// (jamais depuis le code client). Aucune donnée sensible n'est exposée ici.
export function getAdminUids(): string[] {
  return (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((uid) => uid.trim())
    .filter((uid) => uid.length > 0);
}

export function isAdminUid(uid: string | undefined | null): boolean {
  if (!uid) return false;
  return getAdminUids().includes(uid);
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.endsWith(ADMIN_EMAIL_DOMAIN);
}

export function isAdmin(
  uid: string | undefined | null,
  email?: string | undefined | null,
): boolean {
  return isAdminUid(uid) || isAdminEmail(email);
}

// Vérifie que le porteur du token est admin, sinon throw.
export async function assertAdmin(idToken: string): Promise<{ uid: string; email?: string }> {
  const identity = await verifyIdToken(idToken);
  if (!isAdmin(identity.uid, identity.email)) {
    throw new Error("Accès non autorisé");
  }
  return identity;
}
