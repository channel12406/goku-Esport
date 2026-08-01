import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  addDoc,
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

export const registerTeamTournament = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; tournamentId: string; teamId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.tournamentId) throw new Error("ID tournoi manquant");
    if (!input.teamId) throw new Error("ID équipe manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    await assertNotBanned(serverDb, uid);
    checkRateLimit(
      rateLimiters.tournamentRegistration,
      `register-team:${data.tournamentId}:${uid}`,
    );

    const teamRef = doc(serverDb, "teams", data.teamId);
    const teamSnap = await getDoc(teamRef);
    if (!teamSnap.exists()) throw new Error("Équipe introuvable");
    if (teamSnap.data().captain_id !== uid)
      throw new Error("Seul le capitaine peut inscrire l'équipe");

    const tournamentRef = doc(serverDb, "tournaments", data.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");
    const tournament = tournamentSnap.data();
    if (!tournament.is_team_based) throw new Error("Ce tournoi n'accepte pas les équipes");
    if (tournament.status !== "open")
      throw new Error("Ce tournoi ne peut plus accepter d'inscriptions");
    if (tournament.organizer_id === uid)
      throw new Error("Tu ne peux pas inscrire ton équipe à ton propre tournoi");

    const memberQuery = firestoreQuery(
      collection(serverDb, "team_members"),
      where("team_id", "==", data.teamId),
    );
    const memberSnap = await getDocs(memberQuery);
    const members = memberSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (members.length > (tournament.team_size || 4)) {
      throw new Error(
        `L'équipe a ${members.length} membres, maximum ${tournament.team_size || 4} requis`,
      );
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

    const teamName = teamSnap.data().name || "Équipe";
    const tournamentName = tournament.name || "Tournoi";
    const entryFee = Number(tournament.entry_fee_pxp ?? 0);
    const maxParticipants = Number(tournament.max_participants ?? 0);
    const vaultUid = await getVaultUid();
    const registrationId = `${data.tournamentId}_${data.teamId}`;

    await runTransaction(serverDb, async (transaction) => {
      const captainRef = doc(serverDb, "profiles", uid);
      const captainSnap = await transaction.get(captainRef);
      if (!captainSnap.exists()) throw new Error("Profil du capitaine introuvable");
      const captainPxp = Number(captainSnap.data().pxp ?? 0);

      const regRef = doc(serverDb, "tournament_registrations", registrationId);
      if ((await transaction.get(regRef)).exists()) {
        throw new Error("Cette équipe est déjà inscrite à ce tournoi");
      }

      const tournSnap = await transaction.get(tournamentRef);
      const tourn = tournSnap.data() ?? {};
      if (tourn.status !== "open")
        throw new Error("Ce tournoi ne peut plus accepter d'inscriptions");
      const count = Number(tourn.registration_count ?? 0);
      if (maxParticipants > 0 && count >= maxParticipants) {
        throw new Error("Ce tournoi a atteint sa capacité maximale de participants");
      }

      if (entryFee > 0) {
        if (captainPxp < entryFee) {
          throw new Error(
            `PXP insuffisant pour les frais d'inscription (${entryFee} PXP requis, tu as ${captainPxp} PXP)`,
          );
        }
        transaction.update(captainRef, { pxp: increment(-entryFee) });
        creditVault(transaction, serverDb, vaultUid, entryFee);
        transaction.set(doc(collection(serverDb, "pxp_transactions")), {
          user_id: uid,
          amount: -entryFee,
          reason: `Frais d'inscription de l'équipe ${teamName} au tournoi: ${tournamentName}`,
          created_by: uid,
          tournament_id: data.tournamentId,
          created_at: serverTimestamp(),
          type: "tournament_fee",
        });
        transaction.set(doc(collection(serverDb, "pxp_transactions")), {
          user_id: vaultUid,
          amount: entryFee,
          reason: `Escrow frais d'inscription de l'équipe ${teamName} au tournoi: ${tournamentName}`,
          created_by: uid,
          tournament_id: data.tournamentId,
          created_at: serverTimestamp(),
          type: "tournament_escrow",
        });
        transaction.set(
          doc(
            collection(serverDb, "tournament_fee_payments"),
            `${data.tournamentId}_${data.teamId}`,
          ),
          {
            tournament_id: data.tournamentId,
            user_id: uid,
            team_id: data.teamId,
            amount: entryFee,
            paid_by: uid,
            created_at: serverTimestamp(),
            status: "held",
          },
        );
      }

      transaction.set(regRef, {
        tournament_id: data.tournamentId,
        team_id: data.teamId,
        registered_by: uid,
        status: "confirmed",
        created_at: serverTimestamp(),
      });
      transaction.update(tournamentRef, { registration_count: count + 1 });
    });

    // Notify all team members
    const memberIds = members
      .map((m: Record<string, unknown>) => m.user_id as string)
      .filter((id: string) => id !== uid);
    for (const memberId of memberIds) {
      await addDoc(collection(serverDb, "notifications"), {
        user_id: memberId,
        type: "team_registered_tournament",
        title: "Inscription à un tournoi",
        message: `Ton capitaine a inscrit ${teamName} au tournoi ${tournamentName}`,
        team_id: data.teamId,
        related_user_id: uid,
        read: false,
        created_at: serverTimestamp(),
      });
    }

    return { success: true, memberCount: memberIds.length + 1 };
  });
