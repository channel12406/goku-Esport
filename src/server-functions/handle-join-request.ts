import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  query as firestoreQuery,
  where,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";

export const handleJoinRequest = createServerFn({ method: "POST" })
  .validator(
    (input: { idToken: string; teamId: string; userId: string; action: "accept" | "reject" }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.teamId) throw new Error("ID équipe manquant");
      if (!input.userId) throw new Error("ID utilisateur manquant");
      if (!["accept", "reject"].includes(input.action)) throw new Error("Action invalide");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    const teamSnap = await getDoc(doc(serverDb, "teams", data.teamId));
    if (!teamSnap.exists()) throw new Error("Équipe introuvable");
    if (teamSnap.data().captain_id !== uid)
      throw new Error("Seul le capitaine peut gérer les demandes");

    const requestRef = doc(serverDb, "team_join_requests", `${data.teamId}_${data.userId}`);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error("Demande introuvable");
    if (requestSnap.data().status !== "pending")
      throw new Error("Cette demande a déjà été traitée");

    const teamName = teamSnap.data().name || "Équipe";

    if (data.action === "accept") {
      const membersSnap = await getDocs(
        firestoreQuery(collection(serverDb, "team_members"), where("team_id", "==", data.teamId)),
      );
      if (membersSnap.size >= 6) {
        throw new Error("L'équipe a déjà atteint le maximum de 6 membres.");
      }

      await setDoc(doc(serverDb, "team_members", `${data.teamId}_${data.userId}`), {
        team_id: data.teamId,
        user_id: data.userId,
        role: "member",
        joined_at: serverTimestamp(),
      });
    }

    await updateDoc(requestRef, { status: data.action === "accept" ? "accepted" : "rejected" });

    const captainProfileSnap = await getDoc(doc(serverDb, "profiles", uid));
    const captainName =
      captainProfileSnap.data()?.display_name ||
      captainProfileSnap.data()?.username ||
      "Le capitaine";

    await addDoc(collection(serverDb, "notifications"), {
      user_id: data.userId,
      type: data.action === "accept" ? "join_request_accepted" : "join_request_rejected",
      title: data.action === "accept" ? "Demande acceptée" : "Demande refusée",
      message:
        data.action === "accept"
          ? `${captainName} a accepté ta demande pour rejoindre ${teamName}`
          : `${captainName} a refusé ta demande pour rejoindre ${teamName}`,
      team_id: data.teamId,
      related_user_id: uid,
      read: false,
      created_at: serverTimestamp(),
    });

    return { success: true };
  });
