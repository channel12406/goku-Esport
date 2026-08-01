import { createServerFn } from "@tanstack/react-start";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { assertNotBanned } from "./guards";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const openTournament = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; tournamentId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.tournamentId) throw new Error("ID tournoi manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    await assertNotBanned(serverDb, uid);
    checkRateLimit(rateLimiters.tournamentRegistration, `open-tournament:${uid}`);

    const tournamentRef = doc(serverDb, "tournaments", data.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");

    const tournament = tournamentSnap.data();
    if (tournament.organizer_id !== uid)
      throw new Error("Seul l'organisateur peut ouvrir le tournoi");
    if (tournament.status !== "approved") throw new Error("Le tournoi doit être approuvé d'abord");

    const approvedAt = tournament.approved_at?.toDate?.() || new Date(tournament.approved_at);
    const now = new Date();
    const FIVE_MINUTES = 5 * 60 * 1000;
    if (now.getTime() - approvedAt.getTime() < FIVE_MINUTES) {
      throw new Error("Le délai de 5 min n'est pas encore écoulé");
    }

    await updateDoc(tournamentRef, {
      status: "open",
      opened_at: new Date().toISOString(),
    });

    return { success: true };
  });
