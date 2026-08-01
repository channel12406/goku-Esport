import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  updateDoc,
  query as firestoreQuery,
  where,
  runTransaction,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { assertNotBanned } from "./guards";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";
import { getVaultUid, creditVault } from "./vault";

const MAX_NOTE_LENGTH = 200;

export const registerSoloTournament = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; tournamentId: string; notes?: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.tournamentId) throw new Error("ID tournoi manquant");
    if (input.notes && input.notes.length > MAX_NOTE_LENGTH) {
      throw new Error(`La note ne doit pas dépasser ${MAX_NOTE_LENGTH} caractères`);
    }
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    await assertNotBanned(serverDb, uid);
    checkRateLimit(
      rateLimiters.tournamentRegistration,
      `register-solo:${data.tournamentId}:${uid}`,
    );

    const tournamentRef = doc(serverDb, "tournaments", data.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");

    const tournament = tournamentSnap.data();
    if (tournament.organizer_id === uid)
      throw new Error("Tu ne peux pas t'inscrire à ton propre tournoi");
    if (tournament.status !== "open") throw new Error("Les inscriptions à ce tournoi sont fermées");
    if (tournament.participation_mode && tournament.participation_mode !== "solo") {
      throw new Error("Ce tournoi est en équipe, inscris-toi via ton équipe");
    }

    const existingReq = await getDocs(
      firestoreQuery(
        collection(serverDb, "tournament_requests"),
        where("tournament_id", "==", data.tournamentId),
        where("user_id", "==", uid),
      ),
    );
    if (!existingReq.empty && ["pending", "accepted"].includes(existingReq.docs[0].data().status)) {
      throw new Error("Tu as déjà une demande en attente pour ce tournoi");
    }

    // Migration best-effort : initialise le compteur d'inscriptions si absent.
    if (tournament.registration_count == null) {
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

    const entryFee = Number(tournament.entry_fee_pxp ?? 0);
    const tournamentName = tournament.name || "Tournoi";
    const maxParticipants = Number(tournament.max_participants ?? 0);
    const vaultUid = await getVaultUid();
    const registrationId = `${data.tournamentId}_${uid}`;

    await runTransaction(serverDb, async (transaction) => {
      const playerRef = doc(serverDb, "profiles", uid);
      const playerSnap = await transaction.get(playerRef);
      if (!playerSnap.exists()) throw new Error("Profil introuvable");
      const playerPxp = Number(playerSnap.data().pxp ?? 0);

      const regRef = doc(serverDb, "tournament_registrations", registrationId);
      if ((await transaction.get(regRef)).exists()) {
        throw new Error("Tu es déjà inscrit à ce tournoi");
      }

      const tournSnap = await transaction.get(tournamentRef);
      const tourn = tournSnap.data() ?? {};
      if (tourn.status !== "open") throw new Error("Les inscriptions à ce tournoi sont fermées");
      const count = Number(tourn.registration_count ?? 0);
      if (maxParticipants > 0 && count >= maxParticipants) {
        throw new Error("Ce tournoi a atteint sa capacité maximale de participants");
      }

      if (entryFee > 0) {
        if (playerPxp < entryFee) {
          throw new Error(
            `PXP insuffisant. Ce tournoi coûte ${entryFee} PXP (tu as ${playerPxp} PXP).`,
          );
        }
        transaction.update(playerRef, { pxp: increment(-entryFee) });
        creditVault(transaction, serverDb, vaultUid, entryFee);
        transaction.set(doc(collection(serverDb, "pxp_transactions")), {
          user_id: uid,
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
          doc(collection(serverDb, "tournament_fee_payments"), `${data.tournamentId}_${uid}`),
          {
            tournament_id: data.tournamentId,
            user_id: uid,
            amount: entryFee,
            paid_by: uid,
            created_at: serverTimestamp(),
            status: "held",
          },
        );
      }

      transaction.set(regRef, {
        tournament_id: data.tournamentId,
        user_id: uid,
        registered_by: uid,
        notes: data.notes?.trim() || null,
        status: "pending",
        created_at: serverTimestamp(),
      });
      transaction.update(tournamentRef, { registration_count: count + 1 });
    });

    return { success: true };
  });
