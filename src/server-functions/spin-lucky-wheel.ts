import { createServerFn } from "@tanstack/react-start";
import { doc, runTransaction, serverTimestamp, increment, collection } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

const SPIN_COST = 10;
const MAX_SPINS_PER_DAY = 10;

// L'espérance de gain est volontairement inférieure au coût du tour
// (≈ 7.8 PXP pour 10 PXP investis) pour empêcher tout farm infini de PXP.
// Les gains 200 et 500 sont très rares (0.5% et 0.15%).
const SEGMENTS = [
  { value: 2, weight: 42 },
  { value: 4, weight: 30 },
  { value: 6, weight: 16 },
  { value: 10, weight: 8 },
  { value: 50, weight: 2 },
  { value: 100, weight: 1.2 },
  { value: 200, weight: 0.5 },
  { value: 500, weight: 0.15 },
];

function pickWeighted(segments: { value: number; weight: number }[]) {
  const total = segments.reduce((s, seg) => s + seg.weight, 0);
  let roll = Math.random() * total;
  for (const seg of segments) {
    roll -= seg.weight;
    if (roll <= 0) return seg.value;
  }
  return segments[0].value;
}

export const spinLuckyWheel = createServerFn({ method: "POST" })
  .validator((input: { idToken: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);

    // Rate limiting : 20 tours par heure par utilisateur
    checkRateLimit(rateLimiters.luckyWheel, uid, "Trop de tours. Réessaie dans une heure.");

    const win = pickWeighted(SEGMENTS);
    const net = win - SPIN_COST;

    const today = new Date().toISOString().slice(0, 10);
    const spinLimitRef = doc(serverDb, "spin_limits", `${uid}_${today}`);

    await runTransaction(serverDb, async (transaction) => {
      const profileRef = doc(serverDb, "profiles", uid);
      const profileSnap = await transaction.get(profileRef);
      if (!profileSnap.exists()) throw new Error("Profil introuvable");
      if (profileSnap.data().is_banned) throw new Error("Compte banni, action impossible");

      const limitSnap = await transaction.get(spinLimitRef);
      const spinsToday = limitSnap.exists() ? (limitSnap.data().count ?? 0) : 0;
      if (spinsToday >= MAX_SPINS_PER_DAY) {
        throw new Error(`Limite atteinte : ${MAX_SPINS_PER_DAY} tours par jour maximum`);
      }

      const pxp = profileSnap.data().pxp ?? 0;
      if (pxp < SPIN_COST) throw new Error("PXP insuffisant pour tourner la roue");

      transaction.update(profileRef, { pxp: increment(net) });
      transaction.set(spinLimitRef, {
        user_id: uid,
        date: today,
        count: spinsToday + 1,
      });
      transaction.set(doc(collection(serverDb, "pxp_transactions")), {
        user_id: uid,
        amount: net,
        reason:
          win > 0 ? `Roue de la fortune — gain +${win} PXP` : "Roue de la fortune — rien gagné",
        type: "lucky_spin",
        spin_cost: SPIN_COST,
        win: win,
        created_at: serverTimestamp(),
      });
    });

    return { win, cost: SPIN_COST, net };
  });
