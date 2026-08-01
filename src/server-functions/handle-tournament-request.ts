import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  collection,
  query as firestoreQuery,
  where,
  getDocs,
  runTransaction,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { assertNotBanned } from "./guards";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";
import { getVaultUid, creditVault } from "./vault";

export const handleTournamentRequest = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      tournamentId: string;
      userId: string;
      action: "accepted" | "rejected";
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.tournamentId) throw new Error("ID tournoi manquant");
      if (!input.userId) throw new Error("ID utilisateur manquant");
      if (!["accepted", "rejected"].includes(input.action)) throw new Error("Action invalide");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    await assertNotBanned(serverDb, uid);
    checkRateLimit(
      rateLimiters.tournamentRegistration,
      `handle-request:${data.tournamentId}:${uid}`,
    );

    const tournamentRef = doc(serverDb, "tournaments", data.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");
    if (tournamentSnap.data().organizer_id !== uid)
      throw new Error("Seul le créateur peut gérer les demandes");
    const tournamentStatus = tournamentSnap.data().status;
    if (!["open", "registration_closed", "live"].includes(tournamentStatus)) {
      throw new Error("Ce tournoi ne peut plus accepter d'inscriptions");
    }

    const requestRef = doc(serverDb, "tournament_requests", `${data.tournamentId}_${data.userId}`);
    const requestSnap = await getDoc(requestRef);
    if (!requestSnap.exists()) throw new Error("Demande introuvable");
    if (requestSnap.data().status !== "pending")
      throw new Error("Cette demande a déjà été traitée");

    const requestData = requestSnap.data();
    const teamId = requestData.team_id ?? null;
    const entryFee = Number(tournamentSnap.data().entry_fee_pxp ?? 0);
    const tournamentName = tournamentSnap.data().name || "Tournoi";
    const maxParticipants = Number(tournamentSnap.data().max_participants ?? 0);

    // Membres concernés par l'acceptation (1 joueur en solo, l'équipe entière sinon).
    let memberUserIds: string[] = [data.userId];
    if (teamId) {
      const membersSnap = await getDocs(
        firestoreQuery(collection(serverDb, "team_members"), where("team_id", "==", teamId)),
      );
      memberUserIds = membersSnap.docs.map((d) => d.data().user_id as string);
    }

    // Migration best-effort : initialise le compteur d'inscriptions si absent.
    if (tournamentSnap.data().registration_count == null) {
      const existing = await getDocs(
        firestoreQuery(
          collection(serverDb, "tournament_registrations"),
          where("tournament_id", "==", data.tournamentId),
        ),
      );
      await updateDoc(tournamentRef, {
        registration_count: existing.docs.filter((d) =>
          ["pending", "confirmed", "approved"].includes(d.data().status),
        ).length,
      });
    }

    const vaultUid = await getVaultUid();

    await runTransaction(serverDb, async (transaction) => {
      const reqSnap = await transaction.get(requestRef);
      if (!reqSnap.exists() || reqSnap.data().status !== "pending") {
        throw new Error("Cette demande a déjà été traitée");
      }

      const tournSnap = await transaction.get(tournamentRef);
      const tourn = tournSnap.data() ?? {};
      if (!["open", "registration_closed", "live"].includes(tourn.status)) {
        throw new Error("Ce tournoi ne peut plus accepter d'inscriptions");
      }

      if (data.action === "accepted") {
        const count = Number(tourn.registration_count ?? 0);
        if (maxParticipants > 0 && count + memberUserIds.length > maxParticipants) {
          throw new Error("Ce tournoi a atteint sa capacité maximale de participants");
        }

        if (entryFee > 0) {
          const profileRef = doc(serverDb, "profiles", data.userId);
          const profileSnap = await transaction.get(profileRef);
          if (!profileSnap.exists()) throw new Error("Profil du joueur introuvable");
          const currentPxp = Number(profileSnap.data().pxp ?? 0);
          if (currentPxp < entryFee) {
            throw new Error(`Le joueur n'a pas assez de PXP (${currentPxp}/${entryFee})`);
          }
          transaction.update(profileRef, { pxp: increment(-entryFee) });
          creditVault(transaction, serverDb, vaultUid, entryFee);
          transaction.set(doc(collection(serverDb, "pxp_transactions")), {
            user_id: data.userId,
            amount: -entryFee,
            reason: `Frais d'inscription au tournoi: ${tournamentName}`,
            created_by: uid,
            tournament_id: data.tournamentId,
            created_at: serverTimestamp(),
            type: "tournament_fee",
          });
          transaction.set(doc(collection(serverDb, "pxp_transactions")), {
            user_id: vaultUid,
            amount: entryFee,
            reason: `Escrow frais d'inscription au tournoi: ${tournamentName}`,
            created_by: uid,
            tournament_id: data.tournamentId,
            created_at: serverTimestamp(),
            type: "tournament_escrow",
          });
          transaction.set(
            doc(
              collection(serverDb, "tournament_fee_payments"),
              `${data.tournamentId}_${data.userId}`,
            ),
            {
              tournament_id: data.tournamentId,
              user_id: data.userId,
              amount: entryFee,
              paid_by: data.userId,
              created_at: serverTimestamp(),
              status: "held",
            },
          );
        }

        for (const memberId of memberUserIds) {
          transaction.set(
            doc(serverDb, "tournament_registrations", `${data.tournamentId}_${memberId}`),
            {
              tournament_id: data.tournamentId,
              user_id: memberId,
              team_id: teamId ?? null,
              registered_by: uid,
              status: "approved",
              notes: null,
              created_at: serverTimestamp(),
            },
          );
        }
        transaction.update(tournamentRef, { registration_count: count + memberUserIds.length });
      }

      transaction.update(requestRef, {
        status: data.action,
        handled_at: serverTimestamp(),
        handled_by: uid,
      });
    });

    await addDoc(collection(serverDb, "notifications"), {
      user_id: data.userId,
      type:
        data.action === "accepted" ? "tournament_request_accepted" : "tournament_request_rejected",
      title: data.action === "accepted" ? "Demande acceptée" : "Demande refusée",
      message:
        data.action === "accepted"
          ? `Ta demande pour ${tournamentName} a été acceptée !${entryFee > 0 ? ` (${entryFee} PXP débités)` : ""}`
          : `Ta demande pour ${tournamentName} a été refusée.`,
      tournament_id: data.tournamentId,
      related_user_id: uid,
      read: false,
      created_at: serverTimestamp(),
    });

    return { success: true };
  });
