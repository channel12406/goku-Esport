import { createServerFn } from "@tanstack/react-start";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { isAdminUid } from "./admin-auth";
import { assertNotBanned } from "./guards";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

const gameModeFormatMap: Record<string, string> = {
  br_solo: "battle_royale",
  clash_squad: "clash_squad",
  br_squad: "battle_royale",
  br_duo: "battle_royale",
  goku_esport: "custom",
  room_custom: "custom",
};

const MAX_ENTRY_FEE_PXP = 2000;
const MAX_PRIZE_POOL_PXP = 50000;

export const createTournament = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      name: string;
      description?: string;
      game_mode: string;
      participation_mode: string;
      bracket_type: string;
      region: string;
      is_team_based: boolean;
      team_size: number;
      max_teams: number;
      entry_fee_pxp: number;
      prize_pool_pxp: number;
      starts_at: string;
      registration_opens_at?: string;
      registration_closes_at?: string;
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.name?.trim()) throw new Error("Nom du tournoi manquant");
      if (input.name.trim().length > 80)
        throw new Error("Nom du tournoi trop long (80 caractères max)");

      const entryFee = Number(input.entry_fee_pxp);
      const prizePool = Number(input.prize_pool_pxp);
      if (!Number.isInteger(entryFee) || entryFee < 0 || entryFee > MAX_ENTRY_FEE_PXP) {
        throw new Error(`Frais d'inscription invalides (0 à ${MAX_ENTRY_FEE_PXP} PXP)`);
      }
      if (!Number.isInteger(prizePool) || prizePool < 0 || prizePool > MAX_PRIZE_POOL_PXP) {
        throw new Error(`Cagnotte invalide (0 à ${MAX_PRIZE_POOL_PXP} PXP)`);
      }
      if (prizePool > 0 && entryFee <= 0) {
        throw new Error("Une cagnotte requiert des frais d'inscription.");
      }
      const maxParticipants = Number(input.max_teams);
      if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 1000) {
        throw new Error("Nombre de participants invalide.");
      }
      if (prizePool > entryFee * maxParticipants) {
        throw new Error("La cagnotte ne peut pas dépasser le total des frais d'inscription.");
      }
      const teamSize = Number(input.team_size);
      if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > 100) {
        throw new Error("Taille d'équipe invalide.");
      }
      if (!input.starts_at || new Date(input.starts_at).toString() === "Invalid Date") {
        throw new Error("Date de début invalide.");
      }
      return { ...input, name: input.name.trim() };
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    checkRateLimit(rateLimiters.tournamentCreation, `create-tournament:${uid}`);

    const profileRef = doc(serverDb, "profiles", uid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) throw new Error("Profil introuvable");
    await assertNotBanned(serverDb, uid);
    if (!profileSnap.data().can_create_tournaments && !isAdminUid(uid))
      throw new Error("Vous n'êtes pas autorisé à créer des tournois. Contactez l'administrateur.");

    const tournamentRef = await addDoc(collection(serverDb, "tournaments"), {
      name: data.name,
      slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description: data.description?.trim() || null,
      game_mode: data.game_mode,
      participation_mode: data.participation_mode,
      format: gameModeFormatMap[data.game_mode] || "custom",
      bracket_type: data.bracket_type,
      region: data.region,
      is_team_based: data.is_team_based,
      team_size: data.team_size,
      max_participants: data.max_teams,
      entry_fee_pxp: data.entry_fee_pxp,
      prize_pool_pxp: data.prize_pool_pxp,
      starts_at: data.starts_at,
      registration_opens_at: data.registration_opens_at || null,
      registration_closes_at: data.registration_closes_at || null,
      organizer_id: uid,
      status: "pending_verification",
      created_at: serverTimestamp(),
    });

    return { success: true, tournamentId: tournamentRef.id };
  });
