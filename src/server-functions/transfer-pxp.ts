import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  runTransaction,
  serverTimestamp,
  increment,
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10000;
const DAILY_LIMIT = 20000;
const MAX_NOTE_LENGTH = 120;

export const transferPxp = createServerFn({ method: "POST" })
  .validator(
    (input: { idToken: string; recipientFireArenaId: string; amount: number; note?: string }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.recipientFireArenaId?.trim()) throw new Error("ID destinataire manquant");
      if (
        typeof input.amount !== "number" ||
        !Number.isFinite(input.amount) ||
        !Number.isInteger(input.amount)
      ) {
        throw new Error("Montant invalide");
      }
      if (input.amount < MIN_AMOUNT) throw new Error(`Montant minimum : ${MIN_AMOUNT} PXP`);
      if (input.amount > MAX_AMOUNT)
        throw new Error(`Montant maximum par transfert : ${MAX_AMOUNT} PXP`);
      if (input.note && input.note.length > MAX_NOTE_LENGTH) {
        throw new Error(`La note ne doit pas dépasser ${MAX_NOTE_LENGTH} caractères`);
      }
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid: senderUid } = await verifyIdToken(data.idToken);

    // Rate limiting : 10 transferts par minute par utilisateur
    checkRateLimit(
      rateLimiters.pxpTransfer,
      senderUid,
      "Trop de transferts. Réessaie dans une minute.",
    );

    const amount = data.amount;

    const recipientSnap = await getDocs(
      query(
        collection(serverDb, "profiles"),
        where("fire_arena_id", "==", data.recipientFireArenaId.trim()),
        limit(1),
      ),
    );

    if (recipientSnap.empty) throw new Error("Destinataire introuvable");
    const recipientDoc = recipientSnap.docs[0];
    const recipientUid = recipientDoc.id;

    if (recipientUid === senderUid) throw new Error("Impossible de se transférer à soi-même");

    const today = new Date().toISOString().slice(0, 10);
    const dailyLimitRef = doc(serverDb, "transfer_limits", `${senderUid}_${today}`);

    await runTransaction(serverDb, async (transaction) => {
      const senderRef = doc(serverDb, "profiles", senderUid);
      const recipientRef = doc(serverDb, "profiles", recipientUid);

      const senderSnap = await transaction.get(senderRef);
      if (!senderSnap.exists()) throw new Error("Profil expéditeur introuvable");

      const senderData = senderSnap.data();
      if (senderData.is_banned) throw new Error("Ton compte est banni, transfert impossible");

      const recipientSnap = await transaction.get(recipientRef);
      if (!recipientSnap.exists()) throw new Error("Profil destinataire introuvable");
      const recipientData = recipientSnap.data();
      if (recipientData.is_banned)
        throw new Error("Le destinataire est banni, transfert impossible");

      const senderPxp = senderData.pxp ?? 0;
      if (senderPxp < amount) throw new Error("PXP insuffisant");

      const limitSnap = await transaction.get(dailyLimitRef);
      const sentToday = limitSnap.exists() ? (limitSnap.data().total_sent ?? 0) : 0;
      if (sentToday + amount > DAILY_LIMIT) {
        throw new Error(`Limite journalière atteinte (${DAILY_LIMIT} PXP/jour)`);
      }

      const senderName =
        senderData.username ?? senderData.display_name ?? senderData.fire_arena_id ?? "Inconnu";
      const recipientName =
        recipientData.username ??
        recipientData.display_name ??
        recipientData.fire_arena_id ??
        "Inconnu";
      const note = data.note?.trim() ? ` — ${data.note.trim()}` : " — sans note";

      transaction.update(senderRef, { pxp: increment(-amount) });
      transaction.update(recipientRef, { pxp: increment(amount) });

      transaction.set(dailyLimitRef, {
        user_id: senderUid,
        date: today,
        total_sent: sentToday + amount,
      });

      transaction.set(doc(collection(serverDb, "pxp_transactions")), {
        user_id: senderUid,
        amount: -amount,
        reason: `Transfert vers ${recipientName}${note}`,
        type: "transfer_sent",
        recipient_id: recipientUid,
        created_at: serverTimestamp(),
      });

      transaction.set(doc(collection(serverDb, "pxp_transactions")), {
        user_id: recipientUid,
        amount,
        reason: `Reçu de ${senderName}${note}`,
        type: "transfer_received",
        sender_id: senderUid,
        created_at: serverTimestamp(),
      });
    });

    return { success: true };
  });
