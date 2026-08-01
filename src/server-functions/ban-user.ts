import { createServerFn } from "@tanstack/react-start";
import { doc, updateDoc, addDoc, collection, getDoc, serverTimestamp } from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const banUser = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; targetUid: string; reason?: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.targetUid?.trim()) throw new Error("ID utilisateur manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await assertAdmin(data.idToken);
    checkRateLimit(
      rateLimiters.adminActions,
      uid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    const profileRef = doc(serverDb, "profiles", data.targetUid.trim());
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) throw new Error("Utilisateur introuvable");

    await updateDoc(profileRef, {
      is_banned: true,
      ban_reason: data.reason || null,
      banned_at: serverTimestamp(),
      banned_by: uid,
    });

    await addDoc(collection(serverDb, "moderation_logs"), {
      moderator_id: uid,
      target_user_id: data.targetUid.trim(),
      action: "ban",
      notes: data.reason || null,
      created_at: serverTimestamp(),
      target_type: "user",
    });

    return { success: true };
  });
