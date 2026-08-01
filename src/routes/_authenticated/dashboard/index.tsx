import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/firebase-auth-context";
import { Flame, Trophy, Users, TrendingUp, Award, Calendar, Clock } from "lucide-react";
import {
  useUserProfile,
  usePxpTransactions,
  useDailyRewards,
  useLoginStreak,
  useUserAchievements,
  tsToMs,
} from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — FireArena" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Tableau de bord — FireArena" },
      { property: "og:description", content: "Ton tableau de bord personnel sur FireArena." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError } = useUserProfile();
  const { data: pxpTransactions, isLoading: pxpLoading } = usePxpTransactions();
  const { data: dailyRewards, isLoading: rewardsLoading } = useDailyRewards();
  const { data: loginStreak, isLoading: streakLoading } = useLoginStreak();
  const { data: achievements, isLoading: achievementsLoading } = useUserAchievements();

  // Calculate stats
  const tournamentCount =
    pxpTransactions?.filter((t) => t.reason === "tournament_participation").length || 0;
  const pxpTotal = profile?.pxp || 0;
  const teamName = profile?.team_name || "—";
  const streakDays = loginStreak?.current_streak || 0;

  if (profileLoading || pxpLoading || rewardsLoading || streakLoading || achievementsLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-black">
            Bienvenue, <span className="text-sunset">{user?.email?.split("@")[0]}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Chargement du tableau de bord...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card/60 p-5">
              <Skeleton className="h-5 w-5 rounded-full mb-3" />
              <Skeleton className="h-6 w-16 mb-2" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Award className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-xl font-bold text-destructive">Erreur de chargement</h2>
        <p className="mt-2 text-muted-foreground">Impossible de charger les données du profil</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Award className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-xl font-bold">Profil en cours de création</h2>
        <p className="mt-2 text-muted-foreground">
          Votre profil est en cours d'initialisation. Veuillez patienter...
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-black">
        Bienvenue, <span className="text-sunset">{user?.email?.split("@")[0]}</span>
      </h1>
      <p className="mt-2 text-muted-foreground">Ton tableau de bord personnel sur FireArena</p>

      {/* Stats Cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <Trophy className="h-5 w-5 text-primary" />
          <div className="mt-3 font-display text-2xl font-black">{tournamentCount}</div>
          <div className="text-xs text-muted-foreground">Tournois joués</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div className="mt-3 font-display text-2xl font-black">{pxpTotal.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">PXP</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <Users className="h-5 w-5 text-primary" />
          <div className="mt-3 font-display text-2xl font-black">{teamName}</div>
          <div className="text-xs text-muted-foreground">Équipe</div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5">
          <Flame className="h-5 w-5 text-primary" />
          <div className="mt-3 font-display text-2xl font-black">{streakDays}</div>
          <div className="text-xs text-muted-foreground">Streak</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6">
        <h2 className="font-display text-xl font-black mb-4">Activité récente</h2>

        {pxpTransactions && pxpTransactions.length > 0 ? (
          <div className="space-y-3">
            {pxpTransactions.slice(0, 5).map((transaction, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset">
                    <Award className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium">
                      {transaction.reason?.replace("_", " ") ?? "Activité"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tsToMs(transaction.created_at)).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
                <div className="font-display font-black">+{transaction.amount}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Aucune activité récente</div>
        )}
      </div>

      {/* Achievements */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6">
        <h2 className="font-display text-xl font-black mb-4">Récompenses</h2>

        {achievements && achievements.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {achievements.slice(0, 8).map((achievement, index) => (
              <div key={index} className="flex flex-col items-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-sunset shadow-glow-sm">
                  <Award className="h-6 w-6 text-white" />
                </div>
                <div className="mt-2 text-xs font-medium truncate max-w-[100px]">
                  {achievement.achievements?.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(tsToMs(achievement.unlocked_at)).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Pas encore de récompense</div>
        )}
      </div>

      {/* Daily Rewards */}
      <div className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-6">
        <h2 className="font-display text-xl font-black mb-4">Récompenses quotidiennes</h2>

        {dailyRewards && dailyRewards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dailyRewards.slice(0, 6).map((reward, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-sunset">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium">Jour {reward.streak_day}</div>
                    <div className="text-sm text-muted-foreground">
                      {reward.claimed_on
                        ? new Date(tsToMs(reward.claimed_on)).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date inconnue"}
                    </div>
                  </div>
                </div>
                <div className="font-display font-black">+{reward.pxp_amount}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Aucune récompense quotidienne
          </div>
        )}
      </div>
    </div>
  );
}
