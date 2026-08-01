import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  query as firestoreQuery,
  where,
  runTransaction,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { isAdminUid } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";
import { getVaultUid, vaultProfileRef } from "./vault";

const PRIZE_SHARES: Record<number, number> = { 1: 0.5, 2: 0.3, 3: 0.2 };
const MAX_PAYMENTS_READ = 450;

export const settleTournament = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      tournamentId: string;
      winners: Array<{ user_id: string; place: number }>;
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.tournamentId) throw new Error("ID tournoi manquant");
      if (!Array.isArray(input.winners) || input.winners.length === 0)
        throw new Error("Aucun gagnant fourni");
      if (input.winners.length > 3) throw new Error("Maximum 3 gagnants");
      const places = input.winners.map((w) => Number(w.place));
      const unique = new Set(places);
      if (unique.size !== places.length || Math.min(...places) !== 1 || Math.max(...places) > 3) {
        throw new Error("Places de podium invalides (1, 2, 3 uniques)");
      }
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid, email } = await verifyIdToken(data.idToken);
    if (!isAdminUid(uid) && !email) throw new Error("Accès non autorisé");
    checkRateLimit(rateLimiters.adminActions, `settle-tournament:${data.tournamentId}`);

    const tournamentRef = doc(serverDb, "tournaments", data.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");
    const tournament = tournamentSnap.data();
    if (tournament.organizer_id !== uid && !isAdminUid(uid)) {
      throw new Error("Seul l'organisateur (ou un admin) peut clôturer ce tournoi");
    }
    if (tournament.status !== "live")
      throw new Error("Seuls les tournois en cours peuvent être clôturés");
    if (tournament.settled_at) throw new Error("Ce tournoi a déjà été clôturé");

    const prizePool = Number(tournament.prize_pool_pxp ?? 0);
    if (prizePool <= 0) throw new Error("Ce tournoi n'a pas de cagnotte à redistribuer");

    const paymentsSnap = await getDocs(
      firestoreQuery(
        collection(serverDb, "tournament_fee_payments"),
        where("tournament_id", "==", data.tournamentId),
        where("status", "==", "held"),
      ),
    );
    if (paymentsSnap.empty) throw new Error("Aucun frais collecté pour ce tournoi");
    if (paymentsSnap.size > MAX_PAYMENTS_READ) {
      throw new Error("Tournoi trop important pour une clôture automatique");
    }
    const payments = paymentsSnap.docs.map((d) => ({ ref: d.ref, ...d.data() }));
    const totalFees = payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    if (prizePool > totalFees) {
      throw new Error(
        `La cagnotte (${prizePool} PXP) dépasse les frais collectés (${totalFees} PXP)`,
      );
    }

    const winners = data.winners.map((w) => ({
      user_id: w.user_id,
      place: Number(w.place),
      prize: Math.floor(prizePool * (PRIZE_SHARES[w.place] ?? 0)),
    }));
    const distributed = winners.reduce((sum, w) => sum + w.prize, 0);
    const organizerCut = totalFees - prizePool;
    const organizerBonus = prizePool - distributed;

    const vaultUid = await getVaultUid();
    const vaultRef = vaultProfileRef(serverDb, vaultUid);
    const tournamentName = tournament.name || "Tournoi";

    await runTransaction(serverDb, async (transaction) => {
      const tournSnap = await transaction.get(tournamentRef);
      const tourn = tournSnap.data() ?? {};
      if (tourn.status !== "live" || tourn.settled_at) {
        throw new Error("Ce tournoi ne peut plus être clôturé");
      }

      const vaultSnap = await transaction.get(vaultRef);
      if (!vaultSnap.exists()) throw new Error("Vault introuvable");
      if (Number(vaultSnap.data().pxp ?? 0) < totalFees) {
        throw new Error("Fonds du vault insuffisants, contactez l'administrateur");
      }

      for (const p of payments) {
        const paySnap = await transaction.get(p.ref as never);
        if (!paySnap.exists() || paySnap.data().status !== "held") {
          throw new Error("Les paiements ont déjà été traités");
        }
      }

      for (const w of winners) {
        const winnerRef = doc(serverDb, "profiles", w.user_id);
        if (!(await transaction.get(winnerRef)).exists()) {
          throw new Error(`Gagnant introuvable (${w.user_id})`);
        }
        if (w.prize > 0) {
          transaction.update(winnerRef, { pxp: increment(w.prize) });
          transaction.set(doc(collection(serverDb, "pxp_transactions")), {
            user_id: w.user_id,
            amount: w.prize,
            reason: `Prize ${w.place}${w.place === 1 ? "er" : "ème"} place — ${tournamentName}`,
            created_by: vaultUid,
            tournament_id: data.tournamentId,
            created_at: serverTimestamp(),
            type: "tournament_prize",
          });
        }
      }

      const organizerRef = doc(serverDb, "profiles", tournament.organizer_id);
      const organizerTotal = organizerCut + organizerBonus;
      if (organizerTotal > 0) {
        transaction.update(organizerRef, { pxp: increment(organizerTotal) });
        transaction.set(doc(collection(serverDb, "pxp_transactions")), {
          user_id: tournament.organizer_id,
          amount: organizerTotal,
          reason: `Frais de tournoi reversés — ${tournamentName}`,
          created_by: vaultUid,
          tournament_id: data.tournamentId,
          created_at: serverTimestamp(),
          type: "tournament_fee",
        });
      }

      transaction.update(vaultRef, { pxp: increment(-totalFees) });

      for (const p of payments) {
        transaction.update(p.ref as never, { status: "settled", settled_at: serverTimestamp() });
      }

      transaction.update(tournamentRef, {
        status: "completed",
        settled_at: serverTimestamp(),
        settled_by: uid,
        winners: winners.map((w) => ({ user_id: w.user_id, place: w.place, prize: w.prize })),
        total_fees_collected: totalFees,
        organizer_cut: organizerTotal,
      });
    });

    return { success: true };
  });
