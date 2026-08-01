import { createServerFn } from "@tanstack/react-start";
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const adminHandleCreatorRequest = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; targetUid: string; action: "approved" | "rejected" }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.targetUid) throw new Error("UID cible manquant");
    if (input.action !== "approved" && input.action !== "rejected")
      throw new Error("Action invalide");
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

    const requestRef = doc(serverDb, "creator_requests", data.targetUid);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error("Demande introuvable");
    if (requestSnap.data().status !== "pending") throw new Error("Demande déjà traitée");

    await updateDoc(profileRef, { can_create_tournaments: data.action === "approved" });
    await updateDoc(requestRef, { status: data.action });

    const requesterName =
      profileSnap.data().display_name || profileSnap.data().username || "Un joueur";

    await addDoc(collection(serverDb, "notifications"), {
      user_id: data.targetUid,
      type: data.action === "approved" ? "creator_request_approved" : "creator_request_rejected",
      title: data.action === "approved" ? "Statut créateur accordé ✓" : "Demande refusée",
      message:
        data.action === "approved"
          ? `Félicitations ${requesterName} ! Tu peux maintenant créer des tournois.`
          : `Ta demande de statut créateur a été refusée. Contacte l'administrateur pour plus d'informations.`,
      related_user_id: uid,
      read: false,
      created_at: serverTimestamp(),
    });

    return { success: true };
  });
