import { createServerFn } from "@tanstack/react-start";
import { doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const approveTournament = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; tournamentId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.tournamentId) throw new Error("ID tournoi manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await assertAdmin(data.idToken);
    checkRateLimit(
      rateLimiters.adminActions,
      uid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    const tournamentRef = doc(serverDb, "tournaments", data.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");

    await updateDoc(tournamentRef, {
      status: "approved",
      approved_at: serverTimestamp(),
      reviewed_by: uid,
    });

    return { success: true };
  });
