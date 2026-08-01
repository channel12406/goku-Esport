import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  query as firestoreQuery,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

export const createTeam = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      name: string;
      tag: string;
      description?: string;
      region: string;
      country?: string;
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.name?.trim()) throw new Error("Nom d'équipe manquant");
      if (!input.tag?.trim()) throw new Error("Tag manquant");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    const existingTeams = firestoreQuery(
      collection(serverDb, "teams"),
      where("captain_id", "==", uid),
    );
    const existingSnap = await getDocs(existingTeams);
    if (!existingSnap.empty) {
      throw new Error("Tu as déjà une équipe. Tu ne peux en créer qu'une seule.");
    }

    const memberTeams = firestoreQuery(
      collection(serverDb, "team_members"),
      where("user_id", "==", uid),
    );
    const memberSnap = await getDocs(memberTeams);
    if (!memberSnap.empty) {
      throw new Error("Tu es déjà dans une équipe. Quitte-la avant d'en créer une nouvelle.");
    }

    const teamRef = await addDoc(collection(serverDb, "teams"), {
      name: data.name.trim(),
      tag: data.tag.trim().toUpperCase(),
      description: data.description?.trim() || null,
      region: data.region,
      country: data.country?.trim() || null,
      captain_id: uid,
      created_at: serverTimestamp(),
      elo: 1000,
      wins: 0,
      losses: 0,
      is_verified: false,
      is_recruiting: false,
      is_disbanded: false,
    });

    await addDoc(collection(serverDb, "team_members"), {
      team_id: teamRef.id,
      user_id: uid,
      role: "captain",
      joined_at: serverTimestamp(),
    });

    return { success: true, teamId: teamRef.id };
  });
