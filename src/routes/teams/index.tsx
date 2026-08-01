import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, Users, Shield, Trophy, Calendar, MapPin, Flag } from "lucide-react";
import { useAllTeams } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/teams/")({
  head: () => ({
    meta: [
      { title: "Équipes Free Fire — FireArena" },
      {
        name: "description",
        content:
          "Explore les équipes Free Fire vérifiées, recrute des joueurs ou rejoins un roster.",
      },
      { property: "og:title", content: "Équipes Free Fire — FireArena" },
      { property: "og:description", content: "Toutes les équipes Free Fire sur FireArena." },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");

  const { data: teams, isLoading, error } = useAllTeams();

  const filteredTeams =
    teams?.filter((team) => {
      const matchesSearch =
        team.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (team.captain?.username &&
          team.captain.username.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRegion = regionFilter === "all" || team.region === regionFilter;

      return matchesSearch && matchesRegion;
    }) || [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Équipes"
          title="Équipes Free Fire"
          subtitle="Chargement des équipes..."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-12" />
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
      <div className="flex flex-col items-center justify-center py-16">
        <Users className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-xl font-bold text-destructive">Erreur de chargement</h2>
        <p className="mt-2 text-muted-foreground">Impossible de charger les équipes</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Équipes"
        title="Équipes Free Fire"
        subtitle="Découvre les meilleures équipes Free Fire d'Afrique et du monde entier"
        action={
          <Button
            asChild
            className="bg-gradient-to-br from-[#fc0] to-[#ffd740] text-white shadow-[0_0_20px_-4px_rgba(255,204,0,0.5)] hover:opacity-90"
          >
            <Link to="/teams/create">
              <Plus className="h-4 w-4 mr-2" />
              Créer une équipe
            </Link>
          </Button>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une équipe, un tag ou un joueur..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="all">Toutes les régions</option>
            <option value="africa_west">Afrique de l'Ouest</option>
            <option value="africa_north">Afrique du Nord</option>
            <option value="africa_central">Afrique Centrale</option>
            <option value="africa_east">Afrique de l'Est</option>
            <option value="africa_south">Afrique du Sud</option>
            <option value="europe">Europe</option>
            <option value="americas">Amériques</option>
            <option value="asia">Asie</option>
            <option value="oceania">Océanie</option>
          </select>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">{teams?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Équipes</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">
                  {teams?.filter((t) => t.is_verified).length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Vérifiées</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">
                  {teams?.reduce((sum, team) => sum + (team.wins ?? 0), 0) || 0}
                </div>
                <div className="text-xs text-muted-foreground">Victoires</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">
                  {teams?.length
                    ? (() => {
                        const dates = teams.map((t) => {
                          const d = t.created_at as unknown;
                          const date =
                            d && typeof (d as Record<string, unknown>).toDate === "function"
                              ? (d as { toDate: () => Date }).toDate()
                              : new Date(d as string);
                          return date.getTime();
                        });
                        const max = Math.max(...dates.filter((n) => !isNaN(n)));
                        return isNaN(max) ? "-" : new Date(max).getFullYear();
                      })()
                    : "-"}
                </div>
                <div className="text-xs text-muted-foreground">Créée en</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <div className="text-center py-16">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-display text-xl font-black mb-2">Aucune équipe trouvée</h3>
          <p className="text-muted-foreground mb-4">
            Essayez une recherche différente ou créez votre propre équipe
          </p>
          <Button asChild>
            <Link to="/teams/create">Créer une équipe</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <Card key={team.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-lg bg-sunset shadow-glow-sm">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="font-display text-lg font-black">{team.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{team.tag}</span>
                        {team.is_verified && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            Vérifiée
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/teams/$teamId" params={{ teamId: team.id }}>
                      Voir
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={team.captain?.avatar_url} />
                    <AvatarFallback>{team.captain?.username?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <div className="font-medium">
                      {team.captain?.display_name || team.captain?.username}
                    </div>
                    <div className="text-muted-foreground">Capitaine</div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {team.description || "Pas de description pour cette équipe."}
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3" />
                    {team.region?.replace("_", " ") ?? "Non spécifié"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Flag className="h-3 w-3" />
                    {team.country || "Non spécifié"}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2 text-xs">
                  <Trophy className="h-3 w-3" />
                  {team.wins} victoires • {team.losses} défaites
                </div>
                <div className="text-xs text-muted-foreground">
                  {(() => {
                    const d = team.created_at as unknown;
                    if (!d) return "Date inconnue";
                    const date =
                      d && typeof (d as Record<string, unknown>).toDate === "function"
                        ? (d as { toDate: () => Date }).toDate()
                        : new Date(d as string);
                    return isNaN(date.getTime())
                      ? "Date inconnue"
                      : date.toLocaleDateString("fr-FR", { year: "numeric", month: "short" });
                  })()}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
