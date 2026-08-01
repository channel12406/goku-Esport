import { createServerFn } from "@tanstack/react-start";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

export const createNotification = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      userId: string;
      type: string;
      title: string;
      message: string;
      teamId?: string;
      relatedUserId?: string;
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.userId) throw new Error("ID utilisateur manquant");
      if (!input.type) throw new Error("Type manquant");
      if (!input.title) throw new Error("Titre manquant");
      if (!input.message) throw new Error("Message manquant");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    // Only allow creating notifications where the caller is the related user
    if (data.relatedUserId && data.relatedUserId !== uid) {
      throw new Error("Non autorisé à créer cette notification");
    }

    await addDoc(collection(serverDb, "notifications"), {
      user_id: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      team_id: data.teamId || null,
      related_user_id: data.relatedUserId || null,
      read: false,
      created_at: serverTimestamp(),
    });

    return { success: true };
  });
