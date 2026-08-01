import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  query as firestoreQuery,
  where,
  getDocs,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

export const removeTeamMember = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; teamId: string; memberId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.teamId) throw new Error("ID équipe manquant");
    if (!input.memberId) throw new Error("ID membre manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    const teamSnap = await getDoc(doc(serverDb, "teams", data.teamId));
    if (!teamSnap.exists()) throw new Error("Équipe introuvable");
    if (teamSnap.data().captain_id !== uid)
      throw new Error("Seul le capitaine peut supprimer des membres");

    const memberRef = doc(serverDb, "team_members", data.memberId);
    const memberSnap = await getDoc(memberRef);
    if (!memberSnap.exists()) throw new Error("Membre introuvable");
    if (memberSnap.data().role === "captain")
      throw new Error("Impossible de supprimer le capitaine");

    await deleteDoc(memberRef);

    return { success: true };
  });
