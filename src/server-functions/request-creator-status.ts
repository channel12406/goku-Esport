import { createServerFn } from "@tanstack/react-start";
import { collection, addDoc, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { getAdminUids } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const requestCreatorStatus = createServerFn({ method: "POST" })
  .validator((input: { idToken: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    checkRateLimit(rateLimiters.creatorRequest, uid, "Trop de demandes. Réessaie dans une heure.");

    const profileRef = doc(serverDb, "profiles", uid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) throw new Error("Profil introuvable");
    if (profileSnap.data().can_create_tournaments) {
      throw new Error("Tu as déjà le statut créateur");
    }

    const requestRef = doc(serverDb, "creator_requests", uid);
    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists() && requestSnap.data().status === "pending") {
      throw new Error("Demande déjà envoyée, patiente la réponse de l'admin");
    }

    await setDoc(requestRef, {
      user_id: uid,
      status: "pending",
      created_at: serverTimestamp(),
    });

    const displayName =
      profileSnap.data().display_name || profileSnap.data().username || "Un joueur";

    for (const adminUid of getAdminUids()) {
      await addDoc(collection(serverDb, "notifications"), {
        user_id: adminUid,
        type: "creator_request",
        title: "Demande de statut créateur",
        message: `${displayName} demande à créer des tournois. Traite-la dans le panel admin.`,
        related_user_id: uid,
        read: false,
        created_at: serverTimestamp(),
      });
    }

    return { success: true };
  });
