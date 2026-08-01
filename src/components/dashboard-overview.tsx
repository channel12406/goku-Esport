import { Flame, Trophy, Users, TrendingUp, Award } from "lucide-react";
import {
  useUserProfile,
  usePxpTransactions,
  useDailyRewards,
  useLoginStreak,
  useUserAchievements,
  tsToMs,
} from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardOverview() {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data: pxpTransactions, isLoading: pxpLoading, error: pxpError } = usePxpTransactions();
  const { data: dailyRewards, isLoading: rewardsLoading, error: rewardsError } = useDailyRewards();
  const { data: loginStreak, isLoading: streakLoading } = useLoginStreak();
  const {
    data: achievements,
    isLoading: achievementsLoading,
    error: achievementsError,
  } = useUserAchievements();

  const tournamentCount =
    pxpTransactions?.filter((t) => t.reason === "tournament_participation").length || 0;
  const pxpTotal = profile?.pxp || 0;
  const teamName = profile?.team_name || "—";
  const streakDays = loginStreak?.current_streak || 0;

  if (profileLoading || streakLoading) {
    return (
      <div className="space-y-3 sm:space-y-4">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card/60 p-1.5 sm:rounded-2xl sm:p-3"
            >
              <Skeleton className="h-3 w-3 rounded-full mb-1 sm:h-4 sm:w-4 sm:mb-2" />
              <Skeleton className="h-3.5 w-12 mb-0.5 sm:h-5 sm:w-16 sm:mb-1.5" />
              <Skeleton className="h-4 w-9 sm:h-6 sm:w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-card/60 p-1.5 sm:rounded-2xl sm:p-3">
          <Trophy className="h-3 w-3 text-primary sm:h-4 sm:w-4" />
          <div className="mt-0.5 font-display text-sm font-black sm:mt-2 sm:text-lg">
            {tournamentCount}
          </div>
          <div className="text-[9px] text-muted-foreground sm:text-[11px]">Tournois joués</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-1.5 sm:rounded-2xl sm:p-3">
          <TrendingUp className="h-3 w-3 text-primary sm:h-4 sm:w-4" />
          <div className="mt-0.5 font-display text-sm font-black sm:mt-2 sm:text-lg">
            {pxpTotal.toLocaleString()}
          </div>
          <div className="text-[9px] text-muted-foreground sm:text-[11px]">PXP</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-1.5 sm:rounded-2xl sm:p-3">
          <Users className="h-3 w-3 text-primary sm:h-4 sm:w-4" />
          <div className="mt-0.5 truncate font-display text-xs font-black sm:mt-2 sm:text-lg">
            {teamName}
          </div>
          <div className="text-[9px] text-muted-foreground sm:text-[11px]">Équipe</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card/60 p-1.5 sm:rounded-2xl sm:p-3">
          <Flame className="h-3 w-3 text-primary sm:h-4 sm:w-4" />
          <div className="mt-0.5 font-display text-sm font-black sm:mt-2 sm:text-lg">
            {streakDays}
          </div>
          <div className="text-[9px] text-muted-foreground sm:text-[11px]">Streak</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-2.5 sm:p-4">
        <h2 className="font-display text-xs font-black mb-1.5 sm:mb-3 sm:text-base">
          Activité récente
        </h2>

        {pxpTransactions && pxpTransactions.length > 0 ? (
          <div className="space-y-1 sm:space-y-2">
            {pxpTransactions.slice(0, 5).map((transaction, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-5 w-5 place-items-center rounded-md bg-sunset sm:h-7 sm:w-7 sm:rounded-lg">
                    <Award className="h-2.5 w-2.5 text-white sm:h-3.5 sm:w-3.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium sm:text-sm">
                      {transaction.reason?.replace("_", " ") ?? "Activité"}
                    </div>
                    <div className="text-[10px] text-muted-foreground sm:text-xs">
                      {transaction.created_at
                        ? new Date(tsToMs(transaction.created_at)).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date inconnue"}
                    </div>
                  </div>
                </div>
                <div className="font-display text-[11px] font-black sm:text-sm">
                  +{transaction.amount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 text-muted-foreground sm:py-4">
            Aucune activité récente
          </div>
        )}
      </div>

      {/* Daily Rewards */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-2.5 sm:p-4">
        <h2 className="font-display text-xs font-black mb-1.5 sm:mb-3 sm:text-base">
          Récompenses quotidiennes
        </h2>

        {dailyRewards && dailyRewards.length > 0 ? (
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2 lg:grid-cols-3">
            {dailyRewards.slice(0, 6).map((reward, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-1.5 border rounded-lg hover:bg-secondary/40 transition-colors sm:p-2.5"
              >
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-sunset sm:h-8 sm:w-8 sm:rounded-lg">
                    <Flame className="h-3 w-3 text-white sm:h-4 sm:w-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-medium sm:text-sm">
                      Jour {reward.streak_day}
                    </div>
                    <div className="text-[10px] text-muted-foreground sm:text-xs">
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
                <div className="font-display text-[11px] font-black sm:text-sm">
                  +{reward.pxp_amount}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-3 text-muted-foreground sm:py-4">
            Aucune récompense quotidienne
          </div>
        )}
      </div>
    </div>
  );
}
