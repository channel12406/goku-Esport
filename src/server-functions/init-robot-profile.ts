import { createServerFn } from "@tanstack/react-start";
import { doc, getDoc, runTransaction, serverTimestamp, collection } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

const ROBOT_INITIAL_PXP = 1000000; // 1 million de PXP pour le robot (suffisant pour les opérations serveur)

// Initialise le profil du robot de service avec un solde PXP élevé
// Cette fonction doit être appelée une seule fois après création du compte robot dans Firebase Auth
export const initRobotProfile = createServerFn({ method: "POST" })
  .validator((input: { idToken: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid, email } = await verifyIdToken(data.idToken);

    // Vérifie que l'utilisateur est bien le robot
    const ROBOT_EMAIL = import.meta.env.FIREBASE_ROBOT_EMAIL || process.env.FIREBASE_ROBOT_EMAIL;
    if (email !== ROBOT_EMAIL) {
      throw new Error("Seul le compte robot peut initialiser son profil");
    }

    const profileRef = doc(serverDb, "profiles", uid);
    const existing = await getDoc(profileRef);

    if (existing.exists()) {
      console.log(
        "[init-robot-profile] Le profil robot existe déjà, PXP actuel:",
        existing.data().pxp,
      );
      return { created: false, profileId: uid, pxp: existing.data().pxp };
    }

    let fireArenaId = "";
    await runTransaction(serverDb, async (transaction) => {
      const counterRef = doc(serverDb, "counters", "fire_arena_id");

      // Re-vérifie dans la transaction (idempotence)
      const profileSnap = await transaction.get(profileRef);
      if (profileSnap.exists()) return;

      const counterSnap = await transaction.get(counterRef);
      const next = (counterSnap.exists() ? (counterSnap.data().value ?? 0) : 0) + 1;
      fireArenaId = `FA-${String(next).padStart(5, "0")}`;

      transaction.set(counterRef, { value: next });
      transaction.set(profileRef, {
        username: "FireArena Robot",
        display_name: "FireArena Robot",
        email: email || null,
        avatar_url: null,
        fire_arena_id: fireArenaId,
        pxp: ROBOT_INITIAL_PXP,
        level: 99,
        reputation: 1000,
        created_at: serverTimestamp(),
        language: "fr",
        can_create_tournaments: true,
        is_banned: false,
        profile_update_count: 0,
        is_robot: true, // Marqueur spécial pour identifier le robot
      });

      transaction.set(doc(collection(serverDb, "pxp_transactions")), {
        user_id: uid,
        amount: ROBOT_INITIAL_PXP,
        reason: "Initialisation robot de service",
        created_by: uid,
        created_at: serverTimestamp(),
        type: "robot_init",
      });
    });

    console.log(`[init-robot-profile] Profil robot créé avec ${ROBOT_INITIAL_PXP} PXP`);
    return { created: true, fireArenaId, profileId: uid, pxp: ROBOT_INITIAL_PXP };
  });
