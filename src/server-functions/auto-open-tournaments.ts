import { createServerFn } from "@tanstack/react-start";
import { collection, getDocs, query as firestoreQuery, where, updateDoc } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// Auto-guérison : bascule en "open" tout tournoi "approved" dont le délai de
// 5 minutes est écoulé. Idempotent et sans danger (transition approved → open
// uniquement), appelé depuis les pages publiques (accueil, liste des tournois)
// pour ne plus dépendre du compte à rebours client.
export const autoOpenTournaments = createServerFn({ method: "POST" })
  .validator((input: { idToken?: string }) => {
    if (input.idToken === undefined) return {};
    if (!input.idToken) throw new Error("Token manquant");
    return input;
  })
  .handler(async ({ data }) => {
    if (data.idToken) {
      const { uid } = await verifyIdToken(data.idToken);
      checkRateLimit(rateLimiters.tournamentRegistration, `auto-open:${uid}`);
    }

    const cutoff = Date.now() - FIVE_MINUTES_MS;
    const snap = await getDocs(
      firestoreQuery(collection(serverDb, "tournaments"), where("status", "==", "approved")),
    );

    let opened = 0;
    for (const d of snap.docs) {
      const t = d.data();
      const approvedAt = t.approved_at?.toMillis ? t.approved_at.toMillis() : 0;
      if (approvedAt > 0 && approvedAt <= cutoff) {
        await updateDoc(d.ref, { status: "open", opened_at: new Date().toISOString() });
        opened++;
      }
    }

    return { opened };
  });
