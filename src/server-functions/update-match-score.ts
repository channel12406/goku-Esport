import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  getDoc,
  addDoc,
  updateDoc,
  setDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { assertAdmin } from "./admin-auth";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const updateMatchScore = createServerFn({ method: "POST" })
  .validator(
    (input: {
      idToken: string;
      matchId: string;
      team1Score: number;
      team2Score: number;
      team1Kills?: number;
      team2Kills?: number;
    }) => {
      if (!input.idToken) throw new Error("Token manquant");
      if (!input.matchId) throw new Error("ID match manquant");
      if (typeof input.team1Score !== "number" || input.team1Score < 0)
        throw new Error("Score équipe 1 invalide");
      if (typeof input.team2Score !== "number" || input.team2Score < 0)
        throw new Error("Score équipe 2 invalide");
      if (
        input.team1Kills !== undefined &&
        (typeof input.team1Kills !== "number" || input.team1Kills < 0)
      )
        throw new Error("Kills équipe 1 invalides");
      if (
        input.team2Kills !== undefined &&
        (typeof input.team2Kills !== "number" || input.team2Kills < 0)
      )
        throw new Error("Kills équipe 2 invalides");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { uid } = await assertAdmin(data.idToken);
    checkRateLimit(
      rateLimiters.adminActions,
      uid,
      "Trop d'actions admin. Réessaie dans une minute.",
    );

    const matchRef = doc(serverDb, "matches", data.matchId);
    const matchSnap = await getDoc(matchRef);
    if (!matchSnap.exists()) throw new Error("Match introuvable");
    const matchData = matchSnap.data();

    const tournamentSnap = await getDoc(doc(serverDb, "tournaments", matchData.tournament_id));
    const tournamentName = tournamentSnap.exists()
      ? tournamentSnap.data().name || "Tournoi"
      : "Tournoi";

    const resultData: Record<string, unknown> = {
      match_id: data.matchId,
      tournament_id: matchData.tournament_id,
      team1_id: matchData.team1_id,
      team2_id: matchData.team2_id,
      team1_score: data.team1Score,
      team2_score: data.team2Score,
      submitted_by: uid,
      submitted_at: serverTimestamp(),
    };
    if (data.team1Kills !== undefined) resultData.team1_kills = data.team1Kills;
    if (data.team2Kills !== undefined) resultData.team2_kills = data.team2Kills;

    const resultRef = await addDoc(collection(serverDb, "match_results"), resultData);

    await updateDoc(matchRef, {
      match_results: arrayUnion(resultRef.id),
      status: "completed",
    });

    const team1Name = matchData.team1_name || "Équipe 1";
    const team2Name = matchData.team2_name || "Équipe 2";
    const newsId = `match_result_${data.matchId}`;

    let excerpt = `${team1Name} ${data.team1Score} - ${data.team2Score} ${team2Name}`;
    if (data.team1Kills !== undefined && data.team2Kills !== undefined) {
      excerpt = `${team1Name} ${data.team1Kills} kills — ${data.team2Kills} kills (${data.team1Score}e - ${data.team2Score}e)`;
    }

    let content = `Match du tournoi **${tournamentName}** terminé.\n\n**${team1Name}** ${data.team1Score} - ${data.team2Score} **${team2Name}**`;
    if (data.team1Kills !== undefined && data.team2Kills !== undefined) {
      content = `Match du tournoi **${tournamentName}** terminé.\n\n**${team1Name}** — ${data.team1Kills} kills (${data.team1Score}e place)\n**${team2Name}** — ${data.team2Kills} kills (${data.team2Score}e place)`;
    }

    await setDoc(doc(serverDb, "news", newsId), {
      title: `${team1Name} vs ${team2Name}`,
      slug: `resultat-${team1Name}-${team2Name}-${data.matchId}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
      excerpt,
      content,
      category: "tournoi",
      author_name: "FireArena",
      cover_url: "",
      read_time: 1,
      is_featured: false,
      views: 0,
      published_at: serverTimestamp(),
    });

    return { success: true, resultId: resultRef.id };
  });
