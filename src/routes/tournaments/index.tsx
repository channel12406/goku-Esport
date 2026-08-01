import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/firebase-auth-context";
import { requestTournamentParticipation } from "@/server-functions/request-tournament-participation";
import { autoOpenTournaments } from "@/server-functions/auto-open-tournaments";
import {
  Search,
  Plus,
  Trophy,
  Calendar,
  Users,
  Shield,
  Flame,
  Filter,
  Clock,
  ChevronRight,
  Swords,
  Globe,
  Loader2,
  UserPlus,
} from "lucide-react";
import { useAllTournaments, useUserCanCreateTournaments } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  open: {
    label: "Inscriptions ouvertes",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    dot: "bg-green-400",
  },
  approved: {
    label: "Inscriptions ouvertes",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    dot: "bg-green-400",
  },
  registration_closed: {
    label: "Inscriptions fermées",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    dot: "bg-yellow-400",
  },
  live: {
    label: "En cours",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    dot: "bg-red-400 animate-pulse",
  },
  completed: {
    label: "Terminé",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

const FORMAT_LABELS: Record<string, string> = {
  battle_royale: "Battle Royale",
  clash_squad: "Clash Squad",
  lone_wolf: "Lone Wolf",
  custom: "Personnalisé",
};

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

const PAGE_SIZE = 9;

const searchSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().optional(),
});

export const Route = createFileRoute("/tournaments/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Tournois Free Fire — FireArena" },
      {
        name: "description",
        content:
          "Découvre tous les tournois Free Fire ouverts : Battle Royale, Clash Squad, prize pools et brackets en direct.",
      },
      { property: "og:title", content: "Tournois Free Fire — FireArena" },
      { property: "og:description", content: "Tous les tournois Free Fire ouverts sur FireArena." },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  const { user } = useAuth();
  const canCreate = useUserCanCreateTournaments();
  const { search: searchParam, page: pageParam } = Route.useSearch();
  const [searchTerm, setSearchTerm] = useState(searchParam ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [page, setPage] = useState(pageParam ?? 1);
  const [requestingTournamentId, setRequestingTournamentId] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  async function handleParticipate(tournamentId: string) {
    if (!user) return;
    setRequestingTournamentId(tournamentId);
    try {
      const idToken = await user.getIdToken();
      await requestTournamentParticipation({ data: { idToken, tournamentId } });
      setRequestedIds((prev) => new Set(prev).add(tournamentId));
      toast.success("Demande envoyée au créateur du tournoi !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la demande");
    } finally {
      setRequestingTournamentId(null);
    }
  }

  const { data: tournaments, isLoading, error } = useAllTournaments();

  // Bascule serveur des tournois approuvés (délai de 5 min écoulé) en "open".
  useEffect(() => {
    autoOpenTournaments({ data: {} }).catch(() => {
      /* idempotent — ignoré */
    });
  }, []);

  const filtered = (tournaments ?? []).filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      t.name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      (t.organizer as { username?: string })?.username?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchRegion = regionFilter === "all" || t.region === regionFilter;
    const matchFormat = formatFilter === "all" || t.format === formatFilter;
    return matchSearch && matchStatus && matchRegion && matchFormat;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: tournaments?.length ?? 0,
    open: tournaments?.filter((t) => t.status === "open").length ?? 0,
    live: tournaments?.filter((t) => t.status === "live").length ?? 0,
    totalPxp: tournaments?.reduce((s, t) => s + (t.prize_pool_pxp ?? 0), 0) ?? 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Tournois"
          title="Tournois Free Fire"
          subtitle="Chargement des tournois..."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Trophy className="h-16 w-16 text-destructive mb-4" />
        <h2 className="font-display text-xl font-bold text-destructive">Erreur de chargement</h2>
        <p className="mt-2 text-muted-foreground">Impossible de charger les tournois</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow="Tournois"
        title="Tournois Free Fire"
        subtitle="Découvre les meilleurs tournois d'Afrique et du monde entier"
        action={
          canCreate ? (
            <Button
              asChild
              className="bg-gradient-to-br from-[#fc0] to-[#ffd740] text-white shadow-[0_0_20px_-4px_rgba(255,204,0,0.5)] hover:opacity-90"
            >
              <Link to="/tournaments/create">
                <Plus className="h-4 w-4 mr-2" />
                Créer un tournoi
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/tournaments/create">
                <UserPlus className="h-4 w-4 mr-2" />
                Devenir créateur
              </Link>
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy, label: "Tournois", value: stats.total, color: "text-yellow-400" },
          {
            icon: Users,
            label: "Inscriptions ouvertes",
            value: stats.open,
            color: "text-green-400",
          },
          { icon: Shield, label: "En direct", value: stats.live, color: "text-red-400" },
          {
            icon: Flame,
            label: "PXP en jeu",
            value: `${(stats.totalPxp / 1000).toFixed(0)}K`,
            color: "text-orange-400",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-9 w-9 rounded-lg bg-card border border-border/60 flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="font-display text-xl font-black">{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un tournoi, un organisateur..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="open">Inscriptions ouvertes</SelectItem>
              <SelectItem value="registration_closed">Inscriptions fermées</SelectItem>
              <SelectItem value="live">En cours</SelectItem>
              <SelectItem value="completed">Terminés</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={regionFilter}
            onValueChange={(v) => {
              setRegionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44 h-9">
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

          <Select
            value={formatFilter}
            onValueChange={(v) => {
              setFormatFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les formats</SelectItem>
              {Object.entries(FORMAT_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(statusFilter !== "all" ||
            regionFilter !== "all" ||
            formatFilter !== "all" ||
            searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground"
              onClick={() => {
                setStatusFilter("all");
                setRegionFilter("all");
                setFormatFilter("all");
                setSearchTerm("");
                setPage(1);
              }}
            >
              Réinitialiser
            </Button>
          )}

          <span className="ml-auto text-sm text-muted-foreground">
            {filtered.length} tournoi{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Grid */}
      {paginated.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-display text-xl font-black mb-2">Aucun tournoi trouvé</h3>
          <p className="text-muted-foreground mb-6">
            Essayez d'autres filtres ou créez votre propre tournoi
          </p>
          <Button asChild>
            <Link to="/tournaments/create">Créer un tournoi</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginated.map((tournament) => {
              const statusCfg = STATUS_CONFIG[tournament.status ?? ""] ?? STATUS_CONFIG.completed;
              const organizer = tournament.organizer as
                { username?: string; display_name?: string; avatar_url?: string } | undefined;
              const isLive = tournament.status === "live";

              return (
                <Card
                  key={tournament.id}
                  className={`group flex flex-col hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 ${isLive ? "ring-1 ring-red-500/50" : ""}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 ${isLive ? "bg-red-500/20" : "bg-sunset/20"} shadow-sm`}
                        >
                          {isLive ? (
                            <Shield className="h-5 w-5 text-red-400" />
                          ) : (
                            <Trophy className="h-5 w-5 text-orange-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="font-display text-base font-black truncate group-hover:text-orange-400 transition-colors">
                            {tournament.name}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Swords className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {FORMAT_LABELS[tournament.format ?? ""] ?? tournament.format ?? "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Badge className={`flex-shrink-0 text-xs border ${statusCfg.className}`}>
                        <span
                          className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${statusCfg.dot}`}
                        />
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={organizer?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {organizer?.username?.charAt(0)?.toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="text-xs text-muted-foreground">par </span>
                        <span className="text-xs font-medium truncate">
                          {organizer?.display_name || organizer?.username || "Inconnu"}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                      {tournament.description || "Pas de description pour ce tournoi."}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                        {tournament.starts_at
                          ? new Date(tournament.starts_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Date inconnue"}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        {(tournament as { registrations_count?: number }).registrations_count ?? 0}
                        {tournament.max_participants
                          ? ` / ${tournament.max_participants}`
                          : ""}{" "}
                        inscrits
                      </div>
                      {tournament.region && (
                        <div className="flex items-center gap-1.5 col-span-2">
                          <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                          {REGION_LABELS[tournament.region] ?? tournament.region}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-3 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-orange-400">
                      <Flame className="h-4 w-4" />
                      {(tournament.prize_pool_pxp ?? 0).toLocaleString("fr-FR")} PXP
                    </div>
                    {user && user.uid !== tournament.organizer_id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={
                          requestingTournamentId === tournament.id ||
                          requestedIds.has(tournament.id)
                        }
                        onClick={() => handleParticipate(tournament.id)}
                        className="group-hover:bg-sunset group-hover:text-white transition-colors h-8"
                      >
                        {requestingTournamentId === tournament.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : requestedIds.has(tournament.id) ? (
                          "Demandé"
                        ) : (
                          <>
                            Participer <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </>
                        )}
                      </Button>
                    ) : user?.uid === tournament.organizer_id ? (
                      <Button
                        size="sm"
                        asChild
                        variant="ghost"
                        className="group-hover:bg-sunset group-hover:text-white transition-colors h-8"
                      >
                        <Link
                          to="/tournaments/$tournamentId"
                          params={{ tournamentId: tournament.id }}
                        >
                          Gérer <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        asChild
                        variant="ghost"
                        className="group-hover:bg-sunset group-hover:text-white transition-colors h-8"
                      >
                        <Link
                          to="/tournaments/$tournamentId"
                          params={{ tournamentId: tournament.id }}
                        >
                          Voir <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Précédent
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
