import { createServerFn } from "@tanstack/react-start";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  query as firestoreQuery,
  where,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { serverDb } from "./firebase";
import { verifyIdToken } from "./auth";
import { assertNotBanned } from "./guards";
import { checkRateLimit, rateLimiters } from "@/lib/rate-limiter";

export const generateTournamentBracket = createServerFn({ method: "POST" })
  .validator((input: { idToken: string; tournamentId: string }) => {
    if (!input.idToken) throw new Error("Token manquant");
    if (!input.tournamentId) throw new Error("ID tournoi manquant");
    return input;
  })
  .handler(async ({ data }) => {
    const { uid } = await verifyIdToken(data.idToken);
    await assertNotBanned(serverDb, uid);
    checkRateLimit(rateLimiters.tournamentRegistration, `generate-bracket:${uid}`);

    const tournamentSnap = await getDoc(doc(serverDb, "tournaments", data.tournamentId));
    if (!tournamentSnap.exists()) throw new Error("Tournoi introuvable");
    const tournament = tournamentSnap.data();
    if (tournament.organizer_id !== uid)
      throw new Error("Seul l'organisateur peut générer le bracket");

    const regQuery = firestoreQuery(
      collection(serverDb, "tournament_registrations"),
      where("tournament_id", "==", data.tournamentId),
      where("status", "==", "confirmed"),
    );
    const regSnap = await getDocs(regQuery);
    const registrations = regSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (registrations.length < 2)
      throw new Error("Il faut au moins 2 équipes pour générer le bracket");

    const teamIds = [
      ...new Set(
        registrations.map((r: Record<string, unknown>) => r.team_id as string).filter(Boolean),
      ),
    ];
    const teamSnaps = await Promise.all(teamIds.map((id) => getDoc(doc(serverDb, "teams", id))));
    const teamMap = Object.fromEntries(
      teamSnaps
        .filter((d) => d.exists())
        .map((d) => [d.id, { name: d.data().name, logo_url: d.data().logo_url }]),
    );

    // Shuffle teams randomly (Fisher-Yates)
    const shuffled = [...teamIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Create matches as pairs
    const matches: {
      team1_id: string;
      team2_id: string;
      team1_name: string;
      team2_name: string;
      team1_logo?: string;
      team2_logo?: string;
    }[] = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const t1 = shuffled[i];
      const t2 = shuffled[i + 1];
      const t1Data = teamMap[t1] || { name: "Équipe", logo_url: undefined };
      const t2Data = teamMap[t2] || { name: "Équipe", logo_url: undefined };
      matches.push({
        team1_id: t1,
        team2_id: t2,
        team1_name: t1Data.name,
        team2_name: t2Data.name,
        team1_logo: t1Data.logo_url,
        team2_logo: t2Data.logo_url,
      });
    }
    // If odd number, last team gets a bye
    if (shuffled.length % 2 !== 0) {
      const t = shuffled[shuffled.length - 1];
      const tData = teamMap[t] || { name: "Équipe", logo_url: undefined };
      matches.push({
        team1_id: t,
        team2_id: "",
        team1_name: tData.name,
        team2_name: "(Exempt)",
        team1_logo: tData.logo_url,
        team2_logo: undefined,
      });
    }

    // Delete existing matches for this tournament
    const existingMatchQuery = firestoreQuery(
      collection(serverDb, "matches"),
      where("tournament_id", "==", data.tournamentId),
    );
    const existingMatchSnap = await getDocs(existingMatchQuery);
    await Promise.all(existingMatchSnap.docs.map((d) => deleteDoc(doc(serverDb, "matches", d.id))));

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const rawStart = tournament.starts_at;
      const baseDate = rawStart?.toDate ? rawStart.toDate() : new Date(rawStart || Date.now());
      const scheduledAt = new Date(baseDate.getTime());
      scheduledAt.setDate(scheduledAt.getDate() + Math.floor(i / 2));
      await addDoc(collection(serverDb, "matches"), {
        tournament_id: data.tournamentId,
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        team1_name: m.team1_name,
        team2_name: m.team2_name,
        team1_logo: m.team1_logo || null,
        team2_logo: m.team2_logo || null,
        match_number: i + 1,
        status: "scheduled",
        scheduled_at: scheduledAt.toISOString(),
        created_at: serverTimestamp(),
      });
    }

    return { success: true, matchCount: matches.length };
  });
