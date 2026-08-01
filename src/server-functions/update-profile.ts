import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  increment,
  serverTimestamp,
  addDoc,
  collection,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

const PROFILE_EDIT_COST = 500;

export const updateProfile = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      username: string;
      display_name?: string;
      bio?: string;
      free_fire_id?: string;
      region?: string;
      country?: string;
      language?: string;
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.username?.trim()) throw new Error("Pseudo manquant");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    const profileRef = doc(serverDb, "profiles", uid);

    await runTransaction(serverDb, async (transaction) => {
      const profileSnap = await transaction.get(profileRef);
      if (!profileSnap.exists()) throw new Error("Profil introuvable");

      const updateCount = profileSnap.data().profile_update_count ?? 0;
      const currentPxp = profileSnap.data().pxp ?? 0;

      if (updateCount >= 1) {
        if (currentPxp < PROFILE_EDIT_COST) {
          throw new Error(
            `PXP insuffisant. Il te faut ${PROFILE_EDIT_COST} PXP pour modifier ton profil.`,
          );
        }
        transaction.update(profileRef, { pxp: increment(-PROFILE_EDIT_COST) });
        transaction.set(doc(collection(serverDb, "pxp_transactions")), {
          user_id: uid,
          amount: -PROFILE_EDIT_COST,
          reason: "Modification du profil",
          created_by: uid,
          created_at: serverTimestamp(),
          type: "profile_edit",
        });
      }

      transaction.update(profileRef, {
        username: data.username.trim(),
        display_name: data.display_name?.trim() || null,
        bio: data.bio?.trim() || null,
        free_fire_id: data.free_fire_id?.trim() || null,
        region: data.region || null,
        country: data.country?.trim() || null,
        language: data.language || null,
        profile_update_count: increment(1),
      });
    });

    return { success: true };
  });
