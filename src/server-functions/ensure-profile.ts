import { createServerFn } from "@tanstack/react-start";
import { doc, getDoc, runTransaction, serverTimestamp, collection } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

const WELCOME_BONUS = 50;

// Crée le profil Firestore + crédite le bonus de bienvenue, UNIQUEMENT au
// premier appel (idempotent). Le numéro FireArena est alloué via un compteur
// transactionnel pour garantir l'unicité, le tout côté serveur.
export const ensureProfile = createServerFn({ method: "POST" })
  .validator(
    (input: { idToken: string; username?: string; display_name?: string; avatar_url?: string }) => {
      if (!input.idToken) throw new Error("Token manquant");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid, email } = await verifyIdToken(data.idToken);

    const profileRef = doc(serverDb, "profiles", uid);
    const existing = await getDoc(profileRef);
    if (existing.exists()) {
      return { created: false, profileId: uid };
    }

    const username = data.username?.trim() || `user${uid.slice(0, 6)}`;

    let fireArenaId = "";
    await runTransaction(serverDb, async (transaction) => {
      const counterRef = doc(serverDb, "counters", "fire_arena_id");

      // Re-vérifie dans la transaction (idempotence face aux appels concurrents)
      const profileSnap = await transaction.get(profileRef);
      if (profileSnap.exists()) return;

      const counterSnap = await transaction.get(counterRef);
      const next = (counterSnap.exists() ? (counterSnap.data().value ?? 0) : 0) + 1;
      fireArenaId = `FA-${String(next).padStart(5, "0")}`;

      transaction.set(counterRef, { value: next });
      transaction.set(profileRef, {
        username,
        display_name: data.display_name?.trim() || null,
        email: email || null,
        avatar_url: data.avatar_url?.trim() || null,
        fire_arena_id: fireArenaId,
        pxp: WELCOME_BONUS,
        level: 1,
        reputation: 0,
        created_at: serverTimestamp(),
        language: "fr",
        can_create_tournaments: false,
        is_banned: false,
        profile_update_count: 0,
      });

      transaction.set(doc(collection(serverDb, "pxp_transactions")), {
        user_id: uid,
        amount: WELCOME_BONUS,
        reason: "Bonus de bienvenue",
        created_by: uid,
        created_at: serverTimestamp(),
        type: "welcome_bonus",
      });
    });

    return { created: true, fireArenaId, profileId: uid };
  });
