import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  query as firestoreQuery,
  where,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

export const sendJoinRequest = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; teamId: string; message?: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.teamId) throw new Error("ID équipe manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    const teamSnap = await getDoc(doc(serverDb, "teams", data.teamId));
    if (!teamSnap.exists()) throw new Error("Équipe introuvable");

    const captainId = teamSnap.data().captain_id;

    const memberQuery = firestoreQuery(
      collection(serverDb, "team_members"),
      where("user_id", "==", uid),
    );
    const memberSnap = await getDocs(memberQuery);
    const isMember = memberSnap.docs.some((d) => d.data().team_id === data.teamId);
    if (isMember) throw new Error("Tu es déjà membre de cette équipe");
    if (memberSnap.size > 0)
      throw new Error("Tu es déjà dans une équipe. Quitte-la avant d'en rejoindre une autre.");

    const requestRef = doc(serverDb, "team_join_requests", `${data.teamId}_${uid}`);
    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists() && requestSnap.data()?.status === "pending") {
      throw new Error("Tu as déjà une demande en attente pour cette équipe");
    }

    await setDoc(requestRef, {
      team_id: data.teamId,
      user_id: uid,
      message: data.message ?? "",
      status: "pending",
      created_at: serverTimestamp(),
    });

    // Notify the captain
    const requesterProfileSnap = await getDoc(doc(serverDb, "profiles", uid));
    const requesterName =
      requesterProfileSnap.data()?.display_name ||
      requesterProfileSnap.data()?.username ||
      "Un joueur";
    const teamName = teamSnap.data().name || "Équipe";

    await addDoc(collection(serverDb, "notifications"), {
      user_id: captainId,
      type: "join_request_received",
      title: "Nouvelle demande",
      message: `${requesterName} veut rejoindre ${teamName}`,
      team_id: data.teamId,
      related_user_id: uid,
      read: false,
      created_at: serverTimestamp(),
    });

    return { success: true };
  });
