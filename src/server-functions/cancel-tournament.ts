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

const MAX_PAYMENTS_READ = 450;

export const cancelTournament = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; tournamentId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.tournamentId) throw new Error("ID tournoi manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    checkRateLimit(rateLimiters.adminActions, `cancel-tournament:${data.tournamentId}`);

    const tournamentRef = doc(serverDb, "tournaments", data.tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");
    const tournament = tournamentSnap.data();
    if (tournament.organizer_id !== uid && !isAdminUid(uid)) {
      throw new Error("Seul l'organisateur (ou un admin) peut annuler ce tournoi");
    }
    if (!["open", "registration_closed", "live"].includes(tournament.status)) {
      throw new Error("Ce tournoi ne peut plus être annulé");
    }
    if (tournament.settled_at) throw new Error("Ce tournoi a déjà été clôturé");

    const paymentsSnap = await getDocs(
      firestoreQuery(
        collection(serverDb, "tournament_fee_payments"),
        where("tournament_id", "==", data.tournamentId),
        where("status", "==", "held"),
      ),
    );
    if (paymentsSnap.size > MAX_PAYMENTS_READ) {
      throw new Error("Tournoi trop important pour une annulation automatique");
    }
    const payments = paymentsSnap.docs.map((d) => ({ ref: d.ref, ...d.data() }));

    const vaultUid = await getVaultUid();
    const vaultRef = vaultProfileRef(serverDb, vaultUid);
    const tournamentName = tournament.name || "Tournoi";

    await runTransaction(serverDb, async (transaction) => {
      const tournSnap = await transaction.get(tournamentRef);
      const tourn = tournSnap.data() ?? {};
      if (!["open", "registration_closed", "live"].includes(tourn.status) || tourn.settled_at) {
        throw new Error("Ce tournoi ne peut plus être annulé");
      }

      const vaultSnap = await transaction.get(vaultRef);
      if (!vaultSnap.exists()) throw new Error("Vault introuvable");

      for (const p of payments) {
        const paySnap = await transaction.get(p.ref as never);
        if (!paySnap.exists() || paySnap.data().status !== "held") {
          throw new Error("Les paiements ont déjà été traités");
        }
      }

      let totalRefund = 0;
      for (const p of payments) {
        const amount = Number(p.amount ?? 0);
        totalRefund += amount;
        const payerRef = doc(serverDb, "profiles", p.user_id as string);
        if (amount > 0) {
          transaction.update(payerRef, { pxp: increment(amount) });
          transaction.set(doc(collection(serverDb, "pxp_transactions")), {
            user_id: p.user_id as string,
            amount,
            reason: `Remboursement tournoi annulé — ${tournamentName}`,
            created_by: vaultUid,
            tournament_id: data.tournamentId,
            created_at: serverTimestamp(),
            type: "tournament_refund",
          });
        }
        transaction.update(p.ref as never, { status: "refunded", refunded_at: serverTimestamp() });
      }

      transaction.update(vaultRef, { pxp: increment(-totalRefund) });
      transaction.update(tournamentRef, {
        status: "cancelled",
        cancelled_at: serverTimestamp(),
        cancelled_by: uid,
        total_refunded_pxp: totalRefund,
      });
    });

    return { success: true };
  });
