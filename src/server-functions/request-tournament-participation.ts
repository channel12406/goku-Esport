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
import { assertNotBanned } from "./guards";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const requestTournamentParticipation = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; tournamentId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.tournamentId) throw new Error("ID tournoi manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    await assertNotBanned(serverDb, uid);
    checkRateLimit(
      rateLimiters.tournamentRegistration,
      `request-tournament:${data.tournamentId}:${uid}`,
    );

    const tournamentSnap = await getDoc(doc(serverDb, "tournaments", data.tournamentId));
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");

    const tournamentData = tournamentSnap.data();
    const organizerId = tournamentData.organizer_id;
    const participationMode = tournamentData.participation_mode;

    if (uid === organizerId)
      throw new Error("Tu ne peux pas demander à participer à ton propre tournoi");
    if (tournamentData.status !== "open")
      throw new Error("Les inscriptions à ce tournoi sont fermées");

    const maxParticipants = Number(tournamentData.max_participants ?? 0);
    if (maxParticipants > 0) {
      const seatsTaken = await getDocs(
        firestoreQuery(
          collection(serverDb, "tournament_requests"),
          where("tournament_id", "==", data.tournamentId),
        ),
      );
      const taken = seatsTaken.docs.filter((d) =>
        ["pending", "accepted"].includes(d.data().status),
      ).length;
      if (taken >= maxParticipants) {
        throw new Error("Ce tournoi a atteint sa capacité maximale de participants");
      }
    }

    // For duo/squad tournaments, only the team captain can request
    let teamId: string | null = null;
    if (participationMode === "duo" || participationMode === "squad") {
      const teamsQuery = firestoreQuery(
        collection(serverDb, "teams"),
        where("captain_id", "==", uid),
      );
      const teamsSnap = await getDocs(teamsQuery);
      if (teamsSnap.empty) {
        throw new Error(
          "Seul un chef d'équipe peut s'inscrire à ce tournoi. Crée d'abord une équipe.",
        );
      }
      teamId = teamsSnap.docs[0].id;
    }

    const entryFee = tournamentData.entry_fee_pxp ?? 0;
    if (entryFee > 0) {
      const profileSnap = await getDoc(doc(serverDb, "profiles", uid));
      const currentPxp = profileSnap.data()?.pxp ?? 0;
      if (currentPxp < entryFee) {
        throw new Error(
          `PXP insuffisant. Ce tournoi coûte ${entryFee} PXP (tu as ${currentPxp} PXP).`,
        );
      }
    }

    const requestRef = doc(
      collection(serverDb, "tournament_requests"),
      `${data.tournamentId}_${uid}`,
    );
    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists() && requestSnap.data()?.status === "pending") {
      throw new Error("Tu as déjà une demande en attente pour ce tournoi");
    }
    if (requestSnap.exists() && requestSnap.data()?.status === "accepted") {
      throw new Error("Tu es déjà inscrit à ce tournoi");
    }

    await setDoc(requestRef, {
      tournament_id: data.tournamentId,
      user_id: uid,
      organizer_id: organizerId,
      team_id: teamId,
      status: "pending",
      created_at: serverTimestamp(),
    });

    const requesterProfileSnap = await getDoc(doc(serverDb, "profiles", uid));
    const requesterName =
      requesterProfileSnap.data()?.display_name ||
      requesterProfileSnap.data()?.username ||
      "Un joueur";
    const tournamentName = tournamentData.name || "Tournoi";

    const modeLabel =
      participationMode === "duo" ? "en duo" : participationMode === "squad" ? "en squad" : "";

    await addDoc(collection(serverDb, "notifications"), {
      user_id: organizerId,
      type: "tournament_request",
      title: "Nouvelle demande de participation",
      message: `${requesterName} veut participer ${modeLabel} à ${tournamentName}`,
      tournament_id: data.tournamentId,
      team_id: teamId,
      related_user_id: uid,
      read: false,
      created_at: serverTimestamp(),
    });

    return { success: true };
  });
