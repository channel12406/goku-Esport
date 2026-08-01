import { useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  collectionGroup,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/firebase-auth-context";
import { verifyAdminStatus } from "@/server-functions/verify-admin-status";

// Vérifie côté serveur si l'utilisateur courant est admin.
// Le gating UI repose sur cette réponse (jamais sur des UIDs client).
export function useAdminStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-status", user?.uid],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const idToken = await user.getIdToken();
      const res = await verifyAdminStatus({ data: { idToken } });
      return res.isAdmin;
    },
    enabled: !!user?.uid,
    staleTime: 5 * 60 * 1000,
  });
}

function docToData<T>(docSnap: { id: string; data: () => Record<string, unknown> }) {
  return { id: docSnap.id, ...docSnap.data() } as T;
}

export function tsToMs(value: unknown): number {
  if (value && typeof value === "object") {
    const obj = value as { seconds?: unknown; toMillis?: unknown; toDate?: unknown };
    if (typeof obj.seconds === "number") return obj.seconds * 1000;
    if (typeof obj.toMillis === "function") return obj.toMillis();
    if (typeof obj.toDate === "function") return obj.toDate().getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

type ProfileInfo = {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  region?: string;
  country?: string;
};

type Profile = Record<string, unknown> & {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  free_fire_id?: string;
  region?: string;
  country?: string;
  language?: string;
  pxp?: number;
  level?: number;
  reputation?: number;
  team_name?: string;
};
type Team = Record<string, unknown> & {
  id: string;
  name?: string;
  tag?: string;
  slug?: string;
  description?: string;
  region?: string;
  country?: string;
  captain_id: string;
  created_at: string;
  is_verified?: boolean;
  is_recruiting?: boolean;
  is_disbanded?: boolean;
  wins?: number;
  losses?: number;
  elo?: number;
  logo_url?: string;
};
type TeamMember = Record<string, unknown> & {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
  role?: string;
};
type TeamInvite = Record<string, unknown> & {
  id: string;
  team_id: string;
  invitee_id: string;
  invited_by: string;
  created_at: string;
  status?: string;
  message?: string;
};
type TeamJoinRequest = Record<string, unknown> & {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
  status?: string;
  message?: string;
};
type TeamVerification = Record<string, unknown> & {
  id: string;
  team_id: string;
  submitted_by: string;
  reviewed_by?: string;
  created_at: string;
  reason?: string;
  status?: string;
  supporting_url?: string;
};
type Tournament = Record<string, unknown> & {
  id: string;
  name?: string;
  description?: string;
  format?: string;
  bracket_type?: string;
  region?: string;
  is_team_based?: boolean;
  team_size?: number;
  max_participants?: number;
  entry_fee_pxp?: number;
  prize_pool_pxp?: number;
  series_id?: string;
  organizer_id: string;
  season_id?: string;
  starts_at: string;
  registration_opens_at?: string;
  registration_closes_at?: string;
  status?: string;
  approved_at?: string;
  published_at?: string;
  game_mode?: string;
  participation_mode?: string;
};
type TournamentRegistration = Record<string, unknown> & {
  id: string;
  tournament_id: string;
  user_id?: string;
  team_id?: string;
  created_at: string;
  status?: string;
  notes?: string;
  registered_by?: string;
};
type Match = Record<string, unknown> & {
  id: string;
  tournament_id: string;
  match_results?: string[];
  scheduled_at: string;
  match_number?: number;
  status?: string;
  team1_id?: string;
  team2_id?: string;
  team1_name?: string;
  team2_name?: string;
  team1_logo?: string;
  team2_logo?: string;
};
type Report = Record<string, unknown> & {
  id: string;
  reporter_id: string;
  target_user_id: string;
  handled_by?: string;
  status?: string;
  reason?: string;
  details?: string;
  created_at?: string;
};
type PxpTransaction = Record<string, unknown> & {
  id: string;
  reason?: string;
  amount?: number;
  created_at?: string;
};
type DailyReward = Record<string, unknown> & {
  id: string;
  streak_day?: number;
  claimed_on?: string;
  pxp_amount?: number;
};
type LoginStreak = Record<string, unknown> & { id: string; current_streak?: number };
type UserAchievement = Record<string, unknown> & {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
};
type ModerationLog = Record<string, unknown> & {
  id: string;
  moderator_id: string;
  target_user_id: string;
  created_at: string;
  action?: string;
  target_type?: string;
  notes?: string;
};
type OrganizerApplication = Record<string, unknown> & {
  id: string;
  user_id: string;
  created_at: string;
  status?: string;
  organization_name?: string;
  motivation?: string;
};
export type NewsArticle = Record<string, unknown> & {
  id: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  cover_url?: string;
  category?: string;
  author_name?: string;
  author_avatar?: string;
  published_at?: string;
  read_time?: number;
  is_featured?: boolean;
  views?: number;
};

// Profile queries
export function useUserProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const snap = await getDoc(doc(db, "profiles", user.uid));
      if (!snap.exists()) return null;
      return docToData<Profile>(snap);
    },
    enabled: !!user?.uid,
    refetchInterval: 300000,
  });
}

export function useUserCanCreateTournaments() {
  const { user } = useAuth();
  const profile = useUserProfile();
  const { data: isAdmin } = useAdminStatus();
  return !!isAdmin || !!profile.data?.can_create_tournaments;
}

// PXP transactions
export function usePxpTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pxp-transactions", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(
        collection(db, "pxp_transactions"),
        where("user_id", "==", user.uid),
      );
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => docToData<PxpTransaction>(d))
        .sort((a, b) => tsToMs(b.created_at) - tsToMs(a.created_at))
        .slice(0, 10);
    },
    enabled: !!user?.uid,
  });
}

// Daily rewards
export function useDailyRewards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["daily-rewards", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(collection(db, "daily_rewards"), where("user_id", "==", user.uid));
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => docToData<DailyReward>(d))
        .sort((a, b) => tsToMs(b.claimed_on) - tsToMs(a.claimed_on))
        .slice(0, 7);
    },
    enabled: !!user?.uid,
  });
}

// Login streaks
export function useLoginStreak() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["login-streak", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const snap = await getDoc(doc(db, "login_streaks", user.uid));
      if (!snap.exists()) return null;
      return docToData<LoginStreak>(snap);
    },
    enabled: !!user?.uid,
  });
}

// User achievements
export function useUserAchievements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-achievements", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(
        collection(db, "user_achievements"),
        where("user_id", "==", user.uid),
      );
      const snap = await getDocs(q);
      const achievements = snap.docs
        .map((d) => docToData<UserAchievement>(d))
        .sort((a, b) => tsToMs(b.unlocked_at) - tsToMs(a.unlocked_at));
      const achievementIds = [...new Set(achievements.map((a) => a.achievement_id))];
      const achievementDocs = await Promise.all(
        achievementIds.map((id) => getDoc(doc(db, "achievements", id))),
      );
      const achievementMap = Object.fromEntries(
        achievementDocs.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, { id: string; name?: string; description?: string; icon_url?: string }>;
      return achievements.map((a) => ({ ...a, achievements: achievementMap[a.achievement_id] }));
    },
    enabled: !!user?.uid,
  });
}

// Teams
export function useUserTeams() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-teams", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(collection(db, "teams"), where("captain_id", "==", user.uid));
      const snap = await getDocs(q);
      const teams = snap.docs.map((d) => docToData<Team>(d));
      teams.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      const captainIds = [...new Set(teams.map((t) => t.captain_id))];
      const profileSnaps = await Promise.all(
        captainIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return teams.map((t) => ({ ...t, captain: profileMap[t.captain_id] }));
    },
    enabled: !!user?.uid,
  });
}

// Single team by ID (anyone can view)
export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ["team", teamId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "teams", teamId));
      if (!snap.exists()) throw new Error("Team not found");
      const team = docToData<Team>(snap);
      const captainSnap = await getDoc(doc(db, "profiles", team.captain_id));
      const captain = captainSnap.exists()
        ? ({ id: captainSnap.id, ...captainSnap.data() } as ProfileInfo)
        : undefined;
      return { ...team, captain };
    },
    enabled: !!teamId,
  });
}

// Team members
export function useTeamMembers(teamId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team-members", teamId],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(collection(db, "team_members"), where("team_id", "==", teamId));
      const snap = await getDocs(q);
      const members = snap.docs.map((d) => docToData<TeamMember>(d));
      members.sort((a, b) => {
        const da = a.joined_at ? new Date(a.joined_at).getTime() : 0;
        const db = b.joined_at ? new Date(b.joined_at).getTime() : 0;
        return db - da;
      });
      const userIds = [...new Set(members.map((m) => m.user_id))];
      const [userSnaps, teamSnaps] = await Promise.all([
        Promise.all(userIds.map((id) => getDoc(doc(db, "profiles", id)))),
        Promise.all([getDoc(doc(db, "teams", teamId))]),
      ]);
      const userMap = Object.fromEntries(
        userSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      const teamMap = Object.fromEntries(
        teamSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      );
      return members.map((m) => ({
        ...m,
        user: userMap[m.user_id],
        teams: teamMap[teamId],
      }));
    },
    enabled: !!teamId && !!user?.uid,
    refetchInterval: 15000,
  });
}

// Team invites
export function useTeamInvites(teamId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team-invites", teamId],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(collection(db, "team_invites"), where("team_id", "==", teamId));
      const snap = await getDocs(q);
      const invites = snap.docs.map((d) => docToData<TeamInvite>(d));
      invites.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      const profileIds = [...new Set(invites.flatMap((i) => [i.invitee_id, i.invited_by]))];
      const profileSnaps = await Promise.all(
        profileIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return invites.map((i) => ({
        ...i,
        invitee: profileMap[i.invitee_id],
        invited_by: profileMap[i.invited_by],
      }));
    },
    enabled: !!teamId && !!user?.uid,
    refetchInterval: 15000,
  });
}

// All teams
export function useAllTeams() {
  return useQuery({
    queryKey: ["all-teams"],
    queryFn: async () => {
      const q = firestoreQuery(collection(db, "teams"), orderBy("created_at", "desc"), limit(20));
      const snap = await getDocs(q);
      const teams = snap.docs.map((d) => docToData<Team>(d));
      const captainIds = [...new Set(teams.map((t) => t.captain_id))];
      const profileSnaps = await Promise.all(
        captainIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return Promise.all(
        teams.map(async (t) => {
          const memberQ = firestoreQuery(
            collection(db, "team_members"),
            where("team_id", "==", t.id),
          );
          const memberSnap = await getDocs(memberQ);
          return {
            ...t,
            captain: profileMap[t.captain_id],
            members_count: memberSnap.size,
          };
        }),
      );
    },
  });
}

// Team verification requests
export function useTeamVerifications(teamId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team-verifications", teamId],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(
        collection(db, "team_verifications"),
        where("team_id", "==", teamId),
      );
      const snap = await getDocs(q);
      const verifications = snap.docs.map((d) => docToData<TeamVerification>(d));
      verifications.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      const profileIds = [
        ...new Set(
          verifications.flatMap((v) =>
            [v.submitted_by, v.reviewed_by].filter((x): x is string => !!x),
          ),
        ),
      ] as string[];
      const profileSnaps = await Promise.all(
        profileIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return verifications.map((v) => ({
        ...v,
        submitted_by: profileMap[v.submitted_by],
        reviewed_by: v.reviewed_by ? profileMap[v.reviewed_by] : undefined,
      }));
    },
    enabled: !!teamId && !!user?.uid,
    refetchInterval: 15000,
  });
}

// Team join requests
export function useTeamJoinRequests(teamId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["team-join-requests", teamId],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(
        collection(db, "team_join_requests"),
        where("team_id", "==", teamId),
      );
      const snap = await getDocs(q);
      const requests = snap.docs.map((d) => docToData<TeamJoinRequest>(d));
      requests.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      const userIds = [...new Set(requests.map((r) => r.user_id))];
      const profileSnaps = await Promise.all(userIds.map((id) => getDoc(doc(db, "profiles", id))));
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return requests.map((r) => ({
        ...r,
        user: profileMap[r.user_id],
      }));
    },
    enabled: !!teamId && !!user?.uid,
    refetchInterval: 15000,
  });
}

// All tournaments — only show public (validated) tournaments
export function useAllTournaments() {
  return useQuery({
    queryKey: ["all-tournaments"],
    queryFn: async () => {
      const q = firestoreQuery(
        collection(db, "tournaments"),
        where("status", "in", ["open", "registration_closed", "live", "completed", "approved"]),
      );
      const snap = await getDocs(q);
      const FIVE_MINUTES_MS = 5 * 60 * 1000;
      const now = Date.now();
      const tournaments = snap.docs
        .map((d) => docToData<Tournament>(d))
        // Un tournoi "approved" n'est public qu'après le délai de 5 min
        // (avant, il est encore dans sa fenêtre de vérification).
        .filter((t) => {
          if (t.status !== "approved") return true;
          const approvedMs = tsToMs(t.approved_at);
          return approvedMs > 0 && now - approvedMs >= FIVE_MINUTES_MS;
        })
        .sort((a, b) => {
          const da = a.starts_at ? new Date(a.starts_at).getTime() : 0;
          const db = b.starts_at ? new Date(b.starts_at).getTime() : 0;
          return da - db;
        });
      const organizerIds = [...new Set(tournaments.map((t) => t.organizer_id))];
      const profileSnaps = await Promise.all(
        organizerIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return Promise.all(
        tournaments.map(async (t) => {
          const regQ = firestoreQuery(
            collection(db, "tournament_registrations"),
            where("tournament_id", "==", t.id),
          );
          const regSnap = await getDocs(regQ);
          return {
            ...t,
            organizer: profileMap[t.organizer_id],
            registrations_count: regSnap.size,
          };
        }),
      );
    },
  });
}

// Tournament details
export function useTournament(tournamentId: string) {
  return useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "tournaments", tournamentId));
      if (!snap.exists()) throw new Error("Tournament not found");
      const tournament = docToData<Tournament>(snap);
      const organizerSnap = await getDoc(doc(db, "profiles", tournament.organizer_id));
      const matchQ = firestoreQuery(
        collection(db, "matches"),
        where("tournament_id", "==", tournamentId),
      );
      const matchSnap = await getDocs(matchQ);
      const regQ = firestoreQuery(
        collection(db, "tournament_registrations"),
        where("tournament_id", "==", tournamentId),
      );
      const regSnap = await getDocs(regQ);
      const result = {
        ...tournament,
        organizer: organizerSnap.exists()
          ? ({ id: organizerSnap.id, ...organizerSnap.data() } as ProfileInfo)
          : undefined,
        matches_count: matchSnap.size,
        registrations_count: regSnap.size,
      } as Tournament & {
        organizer?: ProfileInfo;
        season?: Record<string, unknown>;
        matches_count: number;
        registrations_count: number;
      };
      if (tournament.season_id) {
        const seasonSnap = await getDoc(doc(db, "seasons", tournament.season_id));
        result.season = seasonSnap.exists()
          ? { id: seasonSnap.id, ...seasonSnap.data() }
          : undefined;
      }
      return result;
    },
    enabled: !!tournamentId,
  });
}

// Tournament registrations
export function useTournamentRegistrations(tournamentId: string) {
  return useQuery({
    queryKey: ["tournament-registrations", tournamentId],
    queryFn: async () => {
      const q = firestoreQuery(
        collection(db, "tournament_registrations"),
        where("tournament_id", "==", tournamentId),
      );
      const snap = await getDocs(q);
      const registrations = snap.docs.map((d) => docToData<TournamentRegistration>(d));
      registrations.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      const userIds = [...new Set(registrations.map((r) => r.user_id).filter(Boolean))] as string[];
      const teamIds = [...new Set(registrations.map((r) => r.team_id).filter(Boolean))] as string[];
      const [userSnaps, teamSnaps] = await Promise.all([
        Promise.all(userIds.map((id) => getDoc(doc(db, "profiles", id)))),
        Promise.all(teamIds.map((id) => getDoc(doc(db, "teams", id)))),
      ]);
      const userMap = Object.fromEntries(
        userSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      const teamMap = Object.fromEntries(
        teamSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      );
      return registrations.map((r) => {
        const team = r.team_id ? (teamMap[r.team_id] as Record<string, unknown>) : undefined;
        let captain;
        if (team?.captain_id) {
          captain = userMap[team.captain_id as string];
        }
        return {
          ...r,
          user: r.user_id ? userMap[r.user_id] : undefined,
          team,
          captain,
        };
      });
    },
    enabled: !!tournamentId,
  });
}

// Tournament matches
export function useTournamentMatches(tournamentId: string) {
  return useQuery({
    queryKey: ["tournament-matches", tournamentId],
    queryFn: async () => {
      const q = firestoreQuery(
        collection(db, "matches"),
        where("tournament_id", "==", tournamentId),
      );
      const snap = await getDocs(q);
      const matches = snap.docs.map((d) => docToData<Match>(d));
      matches.sort((a, b) => {
        const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return da - db;
      });
      const resultIds = matches
        .map((m) => m.match_results ?? [])
        .flat()
        .filter(Boolean) as string[];
      const resultDocs = await Promise.all(
        resultIds.map((id) => getDoc(doc(db, "match_results", id))),
      );
      const resultMap = Object.fromEntries(
        resultDocs.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      );
      const tournamentSnap = await getDoc(doc(db, "tournaments", tournamentId));
      const tournamentData = tournamentSnap.exists()
        ? {
            id: tournamentSnap.id,
            name: tournamentSnap.data().name,
            slug: tournamentSnap.data().slug,
          }
        : undefined;
      return matches.map((m) => ({
        ...m,
        results: (m.match_results?.map((r) => resultMap[r]).filter(Boolean) ?? []) as Record<
          string,
          unknown
        >[],
        tournament: tournamentData,
      }));
    },
    enabled: !!tournamentId,
  });
}

// Reports
export function useReports() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(collection(db, "reports"), orderBy("created_at", "desc"));
      const snap = await getDocs(q);
      const reports = snap.docs.map((d) => docToData<Report>(d));
      const profileIds = [
        ...new Set(
          reports.flatMap((r) =>
            [r.reporter_id, r.target_user_id, r.handled_by].filter((x): x is string => !!x),
          ),
        ),
      ] as string[];
      const profileSnaps = await Promise.all(
        profileIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return reports.map((r) => ({
        ...r,
        reporter: profileMap[r.reporter_id],
        target_user: profileMap[r.target_user_id],
        handled_by: r.handled_by ? profileMap[r.handled_by] : undefined,
      }));
    },
    enabled: !!user?.uid,
  });
}

// Moderation logs
export function useModerationLogs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["moderation-logs"],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(
        collection(db, "moderation_logs"),
        orderBy("created_at", "desc"),
        limit(20),
      );
      const snap = await getDocs(q);
      const logs = snap.docs.map((d) => docToData<ModerationLog>(d));
      const profileIds = [
        ...new Set(logs.flatMap((l) => [l.moderator_id, l.target_user_id].filter(Boolean))),
      ];
      const profileSnaps = await Promise.all(
        profileIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return logs.map((l) => ({
        ...l,
        moderator: profileMap[l.moderator_id],
        target_user: profileMap[l.target_user_id],
      }));
    },
    enabled: !!user?.uid,
  });
}

// Organizer applications
export function useOrganizerApplications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["organizer-applications"],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(
        collection(db, "organizer_applications"),
        orderBy("created_at", "desc"),
      );
      const snap = await getDocs(q);
      const apps = snap.docs.map((d) => docToData<OrganizerApplication>(d));
      const userIds = [...new Set(apps.map((a) => a.user_id))];
      const userSnaps = await Promise.all(userIds.map((id) => getDoc(doc(db, "profiles", id))));
      const userMap = Object.fromEntries(
        userSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return apps.map((a) => ({ ...a, user: userMap[a.user_id] }));
    },
    enabled: !!user?.uid,
  });
}

// News articles
export function useNews(category?: string) {
  return useQuery({
    queryKey: ["news", category],
    queryFn: async () => {
      let q = firestoreQuery(collection(db, "news"), orderBy("published_at", "desc"), limit(50));
      if (category && category !== "all") {
        q = firestoreQuery(
          collection(db, "news"),
          where("category", "==", category),
          orderBy("published_at", "desc"),
          limit(50),
        );
      }
      const snap = await getDocs(q);
      return snap.docs.map((d) => docToData<NewsArticle>(d));
    },
    staleTime: 30000,
  });
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────

// All users (admin)
export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      const snap = await getDocs(
        firestoreQuery(collection(db, "profiles"), orderBy("pxp", "desc"), limit(200)),
      );
      let users = snap.docs.map((d) => docToData<Profile>(d));
      if (search?.trim()) {
        const q = search.toLowerCase();
        users = users.filter(
          (u) =>
            u.username?.toLowerCase().includes(q) ||
            u.display_name?.toLowerCase().includes(q) ||
            u.fire_arena_id?.toString().includes(q) ||
            u.id.includes(q),
        );
      }
      return users;
    },
    staleTime: 30000,
  });
}

// Creator status requests (admin)
export function useAdminCreatorRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-creator-requests"],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(
        collection(db, "creator_requests"),
        where("status", "==", "pending"),
      );
      const snap = await getDocs(q);
      const requests = snap.docs.map((d) =>
        docToData<{ id: string; user_id: string; status: string; created_at: string }>(d),
      );
      requests.sort((a, b) => {
        const da = a.created_at ? new Date(tsToMs(a.created_at)).getTime() : 0;
        const db = b.created_at ? new Date(tsToMs(b.created_at)).getTime() : 0;
        return da - db;
      });
      const userIds = [...new Set(requests.map((r) => r.user_id))];
      const userSnaps = await Promise.all(userIds.map((id) => getDoc(doc(db, "profiles", id))));
      const userMap = Object.fromEntries(
        userSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return requests.map((r) => ({ ...r, user: userMap[r.user_id] }));
    },
    enabled: !!user?.uid,
  });
}

// My creator status request
export function useMyCreatorRequest() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-creator-request", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const snap = await getDoc(doc(db, "creator_requests", user.uid));
      if (!snap.exists()) return null;
      return docToData<{ id: string; user_id: string; status: string; created_at: string }>(snap);
    },
    enabled: !!user?.uid,
    refetchInterval: 30000,
  });
}

// Pending tournaments (admin)
export function useAdminPendingTournaments() {
  return useQuery({
    queryKey: ["admin-pending-tournaments"],
    queryFn: async () => {
      const snap = await getDocs(
        firestoreQuery(
          collection(db, "tournaments"),
          where("status", "==", "pending_verification"),
        ),
      );
      const tournaments = snap.docs.map((d) => docToData<Tournament>(d));
      tournaments.sort((a, b) => {
        const da = a.starts_at ? new Date(a.starts_at).getTime() : 0;
        const db = b.starts_at ? new Date(b.starts_at).getTime() : 0;
        return da - db;
      });
      return tournaments;
    },
    staleTime: 15000,
  });
}

// All tournaments (admin)
export function useAdminAllTournaments() {
  return useQuery({
    queryKey: ["admin-all-tournaments"],
    queryFn: async () => {
      const snap = await getDocs(
        firestoreQuery(collection(db, "tournaments"), orderBy("starts_at", "desc"), limit(200)),
      );
      return snap.docs.map((d) => docToData<Tournament>(d));
    },
    staleTime: 15000,
  });
}

// PXP transactions (admin — all users)
export function useAdminPxpTransactions() {
  return useQuery({
    queryKey: ["admin-pxp-transactions"],
    queryFn: async () => {
      const snap = await getDocs(
        firestoreQuery(
          collectionGroup(db, "pxp_transactions"),
          orderBy("created_at", "desc"),
          limit(200),
        ),
      );
      return snap.docs.map(
        (d) =>
          ({ id: d.id, ...d.data() }) as PxpTransaction & {
            user_id?: string;
            type?: string;
            reason?: string;
            created_at?: string;
            sender_id?: string;
            recipient_id?: string;
          },
      );
    },
    staleTime: 15000,
  });
}

// Lookup profile by fire_arena_id (for PXP transfer)
export function useProfileByFireArenaId(fireArenaId: string) {
  return useQuery({
    queryKey: ["profile-by-faid", fireArenaId],
    queryFn: async () => {
      if (!fireArenaId.trim()) return null;
      const snap = await getDocs(
        firestoreQuery(
          collection(db, "profiles"),
          where("fire_arena_id", "==", fireArenaId.trim()),
          limit(1),
        ),
      );
      if (snap.empty) return null;
      return docToData<Profile>(snap.docs[0]);
    },
    enabled: fireArenaId.trim().length > 0,
    staleTime: 10000,
  });
}

// Leaderboard — top players by PXP
export function usePlayersLeaderboard(region?: string) {
  return useQuery({
    queryKey: ["players-leaderboard", region],
    queryFn: async () => {
      let q = firestoreQuery(collection(db, "profiles"), orderBy("pxp", "desc"), limit(101));
      if (region && region !== "all") {
        q = firestoreQuery(
          collection(db, "profiles"),
          where("region", "==", region),
          orderBy("pxp", "desc"),
          limit(101),
        );
      }
      const snap = await getDocs(q);
      return snap.docs
        .map((d) => docToData<Profile>(d))
        .filter((p) => p.is_robot !== true)
        .slice(0, 100);
    },
    staleTime: 60000,
  });
}

// Leaderboard — top teams by ELO
export function useTeamsLeaderboard(region?: string) {
  return useQuery({
    queryKey: ["teams-leaderboard", region],
    queryFn: async () => {
      let q = firestoreQuery(
        collection(db, "teams"),
        where("is_disbanded", "!=", true),
        orderBy("is_disbanded"),
        orderBy("elo", "desc"),
        limit(100),
      );
      if (region && region !== "all") {
        q = firestoreQuery(
          collection(db, "teams"),
          where("is_disbanded", "!=", true),
          where("region", "==", region),
          orderBy("is_disbanded"),
          orderBy("elo", "desc"),
          limit(100),
        );
      }
      const snap = await getDocs(q);
      const teams = snap.docs.map((d) => docToData<Team>(d));
      const captainIds = [...new Set(teams.map((t) => t.captain_id))];
      const profileSnaps = await Promise.all(
        captainIds.map((id) => getDoc(doc(db, "profiles", id))),
      );
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;
      return teams.map((t) => ({ ...t, captain: profileMap[t.captain_id] }));
    },
    staleTime: 60000,
  });
}

// Notifications
type Notification = Record<string, unknown> & {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  team_id?: string;
  related_user_id?: string;
  read: boolean;
  created_at: string;
};

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications", user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error("Not authenticated");
      const q = firestoreQuery(collection(db, "notifications"), where("user_id", "==", user.uid));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => docToData<Notification>(d));
      items.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
      return items.slice(0, 50);
    },
    enabled: !!user?.uid,
    refetchInterval: 30000,
  });
}

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications-unread", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return 0;
      const q = firestoreQuery(collection(db, "notifications"), where("user_id", "==", user.uid));
      const snap = await getDocs(q);
      return snap.docs.filter((d) => d.data().read === false).length;
    },
    enabled: !!user?.uid,
    refetchInterval: 30000,
  });
}

// Tournament participation requests
type TournamentRequest = Record<string, unknown> & {
  id: string;
  tournament_id: string;
  user_id: string;
  status: string;
  created_at: string;
  handled_at?: string;
  handled_by?: string;
};

export function useTournamentRequests(tournamentId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tournament-requests", tournamentId, user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const q = firestoreQuery(
        collection(db, "tournament_requests"),
        where("organizer_id", "==", user.uid),
        where("tournament_id", "==", tournamentId),
      );
      const snap = await getDocs(q);
      const requests = snap.docs.map((d) => docToData<TournamentRequest>(d));

      const userIds = [...new Set(requests.map((r) => r.user_id))];
      const profileSnaps = await Promise.all(userIds.map((id) => getDoc(doc(db, "profiles", id))));
      const profileMap = Object.fromEntries(
        profileSnaps.filter((d) => d.exists()).map((d) => [d.id, { id: d.id, ...d.data() }]),
      ) as Record<string, ProfileInfo>;

      return requests.map((r) => ({
        ...r,
        user: profileMap[r.user_id],
      }));
    },
    enabled: !!tournamentId && !!user?.uid,
  });
}

export type Banner = Record<string, unknown> & {
  id: string;
  image_url?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  link?: string;
  active?: boolean;
  order?: number;
  created_at?: string;
};

export function useBanners() {
  return useQuery({
    queryKey: ["banners"],
    queryFn: async () => {
      const q = firestoreQuery(collection(db, "banners"), orderBy("order", "asc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => docToData<Banner>(d));
    },
    staleTime: 30000,
  });
}
