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
  addDoc,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const adminAdjustPxp = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      targetId: string;
      amount: number;
      reason?: string;
      type: "credit" | "debit";
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.targetId?.trim()) throw new Error("ID cible manquant");
      if (
        typeof input.amount !== "number" ||
        !Number.isFinite(input.amount) ||
        !Number.isInteger(input.amount) ||
        input.amount <= 0
      ) {
        throw new Error("Montant invalide");
      }
      if (input.amount > 1000000) throw new Error("Montant trop élevé");
      if (input.reason && input.reason.length > 200) throw new Error("Raison trop longue");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid: adminUid } = await assertAdmin(data.idToken);

    checkRateLimit(
      rateLimiters.adminActions,
      adminUid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    let targetUid = data.targetId.trim();

    const byFaid = await getDocs(
      query(
        collection(serverDb, "profiles"),
        where("fire_arena_id", "==", data.targetId.trim()),
        limit(1),
      ),
    );

    if (!byFaid.empty) {
      targetUid = byFaid.docs[0].id;
    }

    const delta = data.type === "credit" ? data.amount : -data.amount;

    await runTransaction(serverDb, async (transaction) => {
      const profileRef = doc(serverDb, "profiles", targetUid);
      const profileSnap = await transaction.get(profileRef);
      if (!profileSnap.exists()) throw new Error("Profil cible introuvable");
      if (data.type === "debit") {
        const current = profileSnap.data().pxp ?? 0;
        if (current < data.amount) {
          throw new Error(`Le joueur n'a que ${current} PXP, impossible de débiter ${data.amount}`);
        }
      }

      transaction.update(profileRef, { pxp: increment(delta) });

      transaction.set(doc(collection(serverDb, "pxp_transactions")), {
        user_id: targetUid,
        amount: delta,
        reason: data.reason?.trim() || (data.type === "credit" ? "Crédit admin" : "Débit admin"),
        created_by: adminUid,
        created_at: serverTimestamp(),
        type: "admin",
      });
    });

    await addDoc(collection(serverDb, "moderation_logs"), {
      moderator_id: adminUid,
      target_user_id: targetUid,
      action: `pxp_${data.type}`,
      notes: `${delta} PXP — ${data.reason?.trim() || "Ajustement admin"}`,
      created_at: serverTimestamp(),
      target_type: "pxp",
    });

    return { success: true, delta };
  });
