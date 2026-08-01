import { createServerFn } from "@tanstack/react-start";
import { verifyIdToken } from "./auth";
import { isAdmin } from "./admin-auth";

// Permet au client de vérifier (côté serveur) si l'utilisateur courant est
// admin. Le gating UI repose uniquement sur cette réponse serveur.
export const verifyAdminStatus = createServerFn({ method: "POST" })
  .validator((input: { idToken: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid, email } = await verifyIdToken(data.idToken);
    return { isAdmin: isAdmin(uid, email) };
  });
