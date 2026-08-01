import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  query as firestoreQuery,
  where,
  getDocs,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const deleteTournament = createServerFn({ method: "POST" })
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

    // Un tournoi qui a collecté des frais ne peut pas être supprimé en l'état :
    // il faut d'abord l'annuler (cancel-tournament) pour rembourser les joueurs.
    const tournamentSnap = await getDoc(doc(serverDb, "tournaments", data.tournamentId));
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");
    const feesCollected = tournamentSnap.data()?.fees_collected ?? 0;
    if (feesCollected > 0) {
      throw new Error(
        "Impossible de supprimer : des frais ont été collectés. Annule d'abord le tournoi pour rembourser les joueurs.",
      );
    }

    const batch = writeBatch(serverDb);

    batch.delete(doc(serverDb, "tournaments", data.tournamentId));

    const requestsSnap = await getDocs(
      firestoreQuery(
        collection(serverDb, "tournament_requests"),
        where("tournament_id", "==", data.tournamentId),
      ),
    );
    requestsSnap.docs.forEach((d) => batch.delete(d.ref));

    const registrationsSnap = await getDocs(
      firestoreQuery(
        collection(serverDb, "tournament_registrations"),
        where("tournament_id", "==", data.tournamentId),
      ),
    );
    registrationsSnap.docs.forEach((d) => batch.delete(d.ref));

    const matchesSnap = await getDocs(
      firestoreQuery(
        collection(serverDb, "matches"),
        where("tournament_id", "==", data.tournamentId),
      ),
    );
    matchesSnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();

    return { success: true };
  });
