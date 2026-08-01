import { createServerFn } from "@tanstack/react-start";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const adminToggleCreator = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; targetUid: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.targetUid) throw new Error("UID cible manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await assertAdmin(data.idToken);
    checkRateLimit(
      rateLimiters.adminActions,
      uid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    const profileRef = doc(serverDb, "profiles", data.targetUid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) throw new Error("Profil introuvable");

    const current = profileSnap.data().can_create_tournaments ?? false;
    await updateDoc(profileRef, { can_create_tournaments: !current });

    return { success: true, can_create_tournaments: !current };
  });
