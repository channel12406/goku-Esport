import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Trophy,
  Users,
  Flame,
  Crown,
  Medal,
  Star,
  Shield,
  Globe,
  TrendingUp,
  Swords,
  Search,
} from "lucide-react";
import { usePlayersLeaderboard, useTeamsLeaderboard } from "@/lib/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteLayout } from "@/components/site-layout";
import { PageHeader } from "@/components/page-header";

const REGION_LABELS: Record<string, string> = {
  africa_west: "Afrique de l'Ouest",
  africa_north: "Afrique du Nord",
  africa_central: "Afrique Centrale",
  africa_east: "Afrique de l'Est",
  africa_south: "Afrique du Sud",
  europe: "Europe",
  americas: "Amériques",
  asia: "Asie",
  oceania: "Océanie",
  other: "Autre",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="h-8 w-8 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
        <Crown className="h-4 w-4 text-yellow-400" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="h-8 w-8 rounded-full bg-slate-400/20 flex items-center justify-center flex-shrink-0">
        <Medal className="h-4 w-4 text-slate-300" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="h-8 w-8 rounded-full bg-orange-700/20 flex items-center justify-center flex-shrink-0">
        <Medal className="h-4 w-4 text-orange-600" />
      </div>
    );
  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
    </div>
  );
}

function PlayerRow({
  player,
  rank,
}: {
  player: Record<string, unknown> & {
    id: string;
    username?: string;
    display_name?: string;
    avatar_url?: string;
    pxp?: number;
    level?: number;
    region?: string;
    country?: string;
  };
  rank: number;
}) {
  const isTop3 = rank <= 3;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
        isTop3
          ? "bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/20"
          : "bg-card/40 border border-border/40 hover:bg-card/60"
      }`}
    >
      <RankBadge rank={rank} />
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={player.avatar_url as string} />
        <AvatarFallback className="bg-sunset text-white text-sm font-bold">
          {(player.display_name || player.username || "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">
          {player.display_name || player.username || "Joueur inconnu"}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {player.username && <span className="truncate">@{player.username}</span>}
          {player.region && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {REGION_LABELS[player.region as string]?.split(" ")[0] ?? player.region}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {player.pxp != null && (
          <Badge variant="outline" className="text-xs hidden sm:flex">
            <Star className="h-3 w-3 mr-1 text-blue-400" />
            Niv. {Math.floor((player.pxp as number) / 500) + 1}
          </Badge>
        )}
        <div className="text-right">
          <div className="font-display font-black text-sm text-orange-400">
            {(player.pxp ?? 0).toLocaleString("fr-FR")}
          </div>
          <div className="text-xs text-muted-foreground">PXP</div>
        </div>
      </div>
    </div>
  );
}

function TeamRow({
  team,
  rank,
}: {
  team: Record<string, unknown> & {
    id: string;
    name?: string;
    tag?: string;
    elo?: number;
    wins?: number;
    losses?: number;
    region?: string;
    is_verified?: boolean;
    captain?: { username?: string; avatar_url?: string };
  };
  rank: number;
}) {
  const isTop3 = rank <= 3;
  const winRate =
    (team.wins ?? 0) + (team.losses ?? 0) > 0
      ? Math.round(((team.wins ?? 0) / ((team.wins ?? 0) + (team.losses ?? 0))) * 100)
      : null;

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
        isTop3
          ? "bg-gradient-to-r from-orange-500/5 to-transparent border border-orange-500/20"
          : "bg-card/40 border border-border/40 hover:bg-card/60"
      }`}
    >
      <RankBadge rank={rank} />
      <div className="h-9 w-9 rounded-xl bg-sunset/20 flex items-center justify-center flex-shrink-0">
        <Swords className="h-4 w-4 text-orange-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{team.name || "Équipe"}</span>
          {team.tag && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono flex-shrink-0">
              [{team.tag}]
            </span>
          )}
          {team.is_verified && <Shield className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {team.captain?.username && <span>Cap: @{team.captain.username}</span>}
          {team.region && (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {REGION_LABELS[team.region as string]?.split(" ")[0] ?? team.region}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {winRate !== null && (
          <div className="text-center hidden sm:block">
            <div
              className={`font-display font-black text-sm ${winRate >= 60 ? "text-green-400" : winRate >= 40 ? "text-yellow-400" : "text-red-400"}`}
            >
              {winRate}%
            </div>
            <div className="text-xs text-muted-foreground">Win</div>
          </div>
        )}
        <div className="text-right">
          <div className="font-display font-black text-sm text-purple-400">
            {(team.elo ?? 1000).toLocaleString("fr-FR")}
          </div>
          <div className="text-xs text-muted-foreground">ELO</div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Classement — FireArena" },
      {
        name: "description",
        content:
          "Classement PXP et ligues des meilleurs joueurs et équipes Free Fire de la saison.",
      },
      { property: "og:title", content: "Classement Free Fire — FireArena" },
      { property: "og:description", content: "Les meilleurs joueurs et équipes de la saison." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const [region, setRegion] = useState("all");
  const [search, setSearch] = useState("");

  const { data: players, isLoading: playersLoading } = usePlayersLeaderboard(region);
  const { data: teams, isLoading: teamsLoading } = useTeamsLeaderboard(region);

  const filteredPlayers = (players ?? []).filter((p) => {
    const q = search.toLowerCase();
    return !q || p.username?.toLowerCase().includes(q) || p.display_name?.toLowerCase().includes(q);
  });

  const filteredTeams = (teams ?? []).filter((t) => {
    const q = search.toLowerCase();
    const team = t as { name?: string; tag?: string };
    return !q || team.name?.toLowerCase().includes(q) || team.tag?.toLowerCase().includes(q);
  });

  const top3Players = filteredPlayers.slice(0, 3);
  const restPlayers = filteredPlayers.slice(3);

  return (
    <SiteLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="Classement"
          title="Classement"
          subtitle="Les meilleurs joueurs et équipes Free Fire, mis à jour en direct"
          center
        />

        {/* Top 3 podium — players only, decorative */}
        {!playersLoading && top3Players.length === 3 && (
          <div className="grid grid-cols-3 gap-3 max-w-xl mx-auto">
            {[
              { player: top3Players[1], place: 2, height: "pt-6" },
              { player: top3Players[0], place: 1, height: "pt-0" },
              { player: top3Players[2], place: 3, height: "pt-10" },
            ].map(({ player, place, height }) => (
              <div key={player.id} className={`flex flex-col items-center ${height}`}>
                <div className="relative mb-2">
                  <Avatar
                    className={`ring-4 ${place === 1 ? "h-16 w-16 ring-yellow-400" : place === 2 ? "h-14 w-14 ring-slate-400" : "h-12 w-12 ring-orange-600"}`}
                  >
                    <AvatarImage src={player.avatar_url as string} />
                    <AvatarFallback className="bg-sunset text-white font-black">
                      {(player.display_name || player.username || "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute -top-2 -right-1 h-6 w-6 rounded-full flex items-center justify-center text-xs font-black ${place === 1 ? "bg-yellow-400 text-yellow-900" : place === 2 ? "bg-slate-400 text-slate-900" : "bg-orange-600 text-white"}`}
                  >
                    {place}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold truncate max-w-[80px]">
                    {player.display_name || player.username}
                  </div>
                  <div className="text-xs text-orange-400 font-bold">
                    {(player.pxp ?? 0).toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un joueur ou une équipe..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-48">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Région" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les régions</SelectItem>
              {Object.entries(REGION_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="players">
          <TabsList className="w-full">
            <TabsTrigger value="players" className="flex-1">
              <TrendingUp className="h-4 w-4 mr-2" />
              Joueurs ({filteredPlayers.length})
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex-1">
              <Users className="h-4 w-4 mr-2" />
              Équipes ({filteredTeams.length})
            </TabsTrigger>
          </TabsList>

          {/* Players Tab */}
          <TabsContent value="players" className="space-y-2 mt-4">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-1 text-xs text-muted-foreground">
              <div className="w-8 flex-shrink-0">Rang</div>
              <div className="w-9 flex-shrink-0" />
              <div className="flex-1">Joueur</div>
              <div className="flex-shrink-0 hidden sm:block w-16 text-center">Niveau</div>
              <div className="flex-shrink-0 w-16 text-right">PXP</div>
            </div>

            {playersLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-border/40 px-4 py-3"
                  >
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="text-center py-16">
                <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-display text-lg font-bold">Aucun joueur trouvé</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Essayez une autre région ou recherche
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPlayers.map((player, idx) => (
                  <PlayerRow key={player.id} player={player} rank={idx + 1} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-2 mt-4">
            <div className="flex items-center gap-3 px-4 py-1 text-xs text-muted-foreground">
              <div className="w-8 flex-shrink-0">Rang</div>
              <div className="w-9 flex-shrink-0" />
              <div className="flex-1">Équipe</div>
              <div className="flex-shrink-0 hidden sm:block w-12 text-center">Winrate</div>
              <div className="flex-shrink-0 w-12 text-right">ELO</div>
            </div>

            {teamsLoading ? (
              <div className="space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl border border-border/40 px-4 py-3"
                  >
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : filteredTeams.length === 0 ? (
              <div className="text-center py-16">
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="font-display text-lg font-bold">Aucune équipe trouvée</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Essayez une autre région ou recherche
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTeams.map((team, idx) => (
                  <TeamRow
                    key={team.id}
                    team={
                      team as Record<string, unknown> & {
                        id: string;
                        name?: string;
                        tag?: string;
                        elo?: number;
                        wins?: number;
                        losses?: number;
                        region?: string;
                        is_verified?: boolean;
                        captain?: { username?: string; avatar_url?: string };
                      }
                    }
                    rank={idx + 1}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 justify-center text-xs text-muted-foreground pt-2 border-t border-border/40">
          <div className="flex items-center gap-1.5">
            <Crown className="h-3.5 w-3.5 text-yellow-400" /> 1er place
          </div>
          <div className="flex items-center gap-1.5">
            <Medal className="h-3.5 w-3.5 text-slate-300" /> 2ème place
          </div>
          <div className="flex items-center gap-1.5">
            <Medal className="h-3.5 w-3.5 text-orange-600" /> 3ème place
          </div>
          <div className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-400" /> PXP = Points d'expérience
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-purple-400" /> ELO = Classement compétitif
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
