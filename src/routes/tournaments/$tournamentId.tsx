import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Trophy, Calendar, Users, Shield, Flame, Award, Check, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import {
  useTournament,
  useTournamentRegistrations,
  useTournamentMatches,
  useUserTeams,
  useTournamentRequests,
  useAdminStatus,
  tsToMs,
} from "@/lib/queries";
import { generateTournamentBracket } from "@/server-functions/generate-tournament-bracket";
import { registerTeamTournament } from "@/server-functions/register-team-tournament";
import { registerSoloTournament } from "@/server-functions/register-solo-tournament";
import { openTournament } from "@/server-functions/open-tournament";
import { handleTournamentRequest } from "@/server-functions/handle-tournament-request";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const gameModeLabels: Record<string, string> = {
  br_solo: "Battle Royale Solo",
  clash_squad: "Clash Squad",
  br_squad: "Battle Royale Squad",
  br_duo: "Battle Royale Duo",
  goku_esport: "Carte Goku Esport",
  room_custom: "Room personnalisée one tap",
};

const participationLabels: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  squad: "Squad",
};

const registrationSchema = z.object({
  team_id: z.string().optional(),
  user_id: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const Route = createFileRoute("/tournaments/$tournamentId")({
  head: ({ params }) => ({
    meta: [
      { title: `Tournoi ${params.tournamentId} — FireArena` },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `Tournoi ${params.tournamentId} — FireArena` },
      { property: "og:description", content: "Découvre ce tournoi Free Fire sur FireArena." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TournamentPage,
});

function TournamentPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tournamentId } = Route.useParams();

  // Tournament data
  const {
    data: tournament,
    isLoading: tournamentLoading,
    error: tournamentError,
  } = useTournament(tournamentId);

  // Registrations
  const {
    data: registrations,
    isLoading: registrationsLoading,
    error: registrationsError,
  } = useTournamentRegistrations(tournamentId);

  // Matches
  const {
    data: matches,
    isLoading: matchesLoading,
    error: matchesError,
  } = useTournamentMatches(tournamentId);

  // User teams
  const { data: userTeams } = useUserTeams();

  // Admin status (server-verified)
  const { data: isAdmin } = useAdminStatus();

  // Tournament requests (creator only)
  const { data: requests, refetch: refetchRequests } = useTournamentRequests(tournamentId);

  // Handle accept/reject request
  const [handlingRequestId, setHandlingRequestId] = useState<string | null>(null);
  async function handleRequestAction(userId: string, action: "accepted" | "rejected") {
    if (!user) return;
    setHandlingRequestId(userId);
    try {
      const idToken = await user.getIdToken();
      await handleTournamentRequest({ data: { idToken, tournamentId, userId, action } });
      toast.success(action === "accepted" ? "Demande acceptée" : "Demande refusée");
      refetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    } finally {
      setHandlingRequestId(null);
    }
  }

  // Safe check for user teams
  const hasTeams: boolean = Array.isArray(userTeams) && userTeams.length > 0;

  // Countdown timer
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!tournament || !tournament.status) return;
    const approvedAt = tsToMs(tournament.approved_at);
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const now = Date.now();
    const isApprovedNotOpen =
      tournament.status === "approved" && approvedAt > 0 && now - approvedAt < FIVE_MINUTES_MS;
    const waitEndsAt = isApprovedNotOpen ? new Date(approvedAt + FIVE_MINUTES_MS) : null;
    if (!waitEndsAt) return;
    let called = false;
    const interval = setInterval(async () => {
      const diff = waitEndsAt.getTime() - Date.now();
      if (diff <= 0) {
        if (!called) {
          called = true;
          try {
            const idToken = await user?.getIdToken();
            if (idToken) {
              await openTournament({ data: { idToken, tournamentId } });
            }
          } catch {
            /* status already updated by another tab */
          }
        }
        setCountdown("0s");
        clearInterval(interval);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [tournament, user, tournamentId]);

  // Registration form state
  const [registrationForm, setRegistrationForm] = useState({
    team_id: "",
    user_id: "",
    notes: "",
  });

  // State for registration submission
  const [isRegistering, setIsRegistering] = useState(false);

  // Handle tournament registration
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!tournament) return;
    setIsRegistering(true);

    try {
      if (!user?.uid) throw new Error("Not authenticated");

      const isTeamTournament =
        tournament.participation_mode && tournament.participation_mode !== "solo";
      if (isTeamTournament && !registrationForm.team_id) {
        throw new Error("Tu dois sélectionner une équipe pour ce tournoi.");
      }

      if (registrationForm.team_id) {
        // Team registration — server-verified
        const idToken = await user.getIdToken();
        await registerTeamTournament({
          data: { idToken, tournamentId, teamId: registrationForm.team_id },
        });
      } else {
        // Individual registration — server-verified (frai d'inscription, capacité, statut)
        const idToken = await user.getIdToken();
        await registerSoloTournament({
          data: { idToken, tournamentId, notes: registrationForm.notes || undefined },
        });
      }

      toast.success(t("tournaments.registered_successfully"));

      setRegistrationForm({
        team_id: "",
        user_id: "",
        notes: "",
      });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsRegistering(false);
    }
  }

  if (tournamentLoading || registrationsLoading || matchesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-black">Tournoi</h1>
          <p className="mt-2 text-muted-foreground">Chargement des données du tournoi...</p>
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-16 mt-2" />
                  <Skeleton className="h-6 w-12 mt-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tournamentError || registrationsError || matchesError) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Trophy className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-xl font-bold text-destructive">Erreur de chargement</h2>
        <p className="mt-2 text-muted-foreground">Impossible de charger les données du tournoi</p>
        <Button asChild className="mt-4">
          <Link to="/tournaments">Retour aux tournois</Link>
        </Button>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Trophy className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-xl font-bold text-destructive">Tournoi introuvable</h2>
        <p className="mt-2 text-muted-foreground">Impossible de trouver ce tournoi</p>
        <Button asChild className="mt-4">
          <Link to="/tournaments">Retour aux tournois</Link>
        </Button>
      </div>
    );
  }

  // Access control — non-public tournaments visible only to creator or admin
  const isAdminBool = !!isAdmin;
  const isCreator = user?.uid === tournament.organizer_id;
  const approvedAt = tsToMs(tournament.approved_at);
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const now = Date.now();
  const isApprovedPastWindow =
    tournament.status === "approved" && approvedAt > 0 && now - approvedAt >= FIVE_MINUTES_MS;
  const privateStatuses = ["pending_verification", "rejected"];
  const isPrivate =
    privateStatuses.includes(tournament.status as string) ||
    (tournament.status === "approved" && !isApprovedPastWindow);
  if (isPrivate && !isCreator && !isAdminBool) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-display text-xl font-bold">Tournoi non disponible</h2>
        <p className="mt-2 text-muted-foreground">Ce tournoi n'est pas encore public.</p>
        <Button asChild className="mt-4">
          <Link to="/tournaments">Retour aux tournois</Link>
        </Button>
      </div>
    );
  }
  const isPendingVerification = tournament.status === "pending_verification";
  const isApprovedNotOpen =
    tournament.status === "approved" && approvedAt > 0 && now - approvedAt < FIVE_MINUTES_MS;
  const isRegistrationOpen =
    (tournament.status === "approved" && approvedAt > 0 && now - approvedAt >= FIVE_MINUTES_MS) ||
    tournament.status === "open";
  const waitEndsAt = isApprovedNotOpen ? new Date(approvedAt + FIVE_MINUTES_MS) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black">{tournament.name}</h1>
        <p className="mt-2 text-muted-foreground">Détails et inscription au tournoi</p>
      </div>

      {isPendingVerification && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-orange-400 shrink-0" />
          <div>
            <p className="font-medium text-orange-300">En cours de vérification</p>
            <p className="text-sm text-orange-400/80">
              Ce tournoi est en attente de validation par un administrateur. Les inscriptions ne
              sont pas encore ouvertes.
            </p>
          </div>
        </div>
      )}

      {isApprovedNotOpen && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-center gap-3">
          <Clock className="h-5 w-5 text-blue-400 shrink-0" />
          <div>
            <p className="font-medium text-blue-300">
              Tournoi approuvé — Ouverture dans {countdown}
            </p>
            <p className="text-sm text-blue-400/80">
              Les inscriptions ouvriront automatiquement dans {countdown}.
            </p>
          </div>
        </div>
      )}

      {/* Tournament Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-lg bg-sunset shadow-glow-sm">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="font-display text-xl font-black">{tournament.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {tournament.status?.replace("_", " ") ?? "N/A"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {gameModeLabels[tournament.game_mode as string] ??
                      tournament.format?.replace("_", " ") ??
                      "N/A"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Partager
              </Button>
              <Button size="sm">Favoris</Button>
            </div>
          </div>

          <CardDescription className="mt-4">
            {tournament.description || "Pas de description pour ce tournoi."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Début le{" "}
                {new Date(tournament.starts_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {registrations?.length || 0} inscrits • {tournament.max_participants} max
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {(tournament.prize_pool_pxp ?? 0).toLocaleString()} PXP
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tournament Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">{registrations?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Inscriptions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">{matches?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Matchs</div>
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
                  {(tournament.prize_pool_pxp ?? 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Prix</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">{tournament.entry_fee_pxp}</div>
                <div className="text-xs text-muted-foreground">Frais</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className={`grid w-full ${isCreator ? "grid-cols-5" : "grid-cols-4"}`}>
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="register">S'inscrire</TabsTrigger>
          {isCreator && <TabsTrigger value="requests">Demandes</TabsTrigger>}
          <TabsTrigger value="bracket">Répartition</TabsTrigger>
          <TabsTrigger value="winners">Gagnants</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Informations du tournoi</CardTitle>
              <CardDescription>Détails complets du tournoi</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Organisateur</h3>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={tournament.organizer?.avatar_url} />
                      <AvatarFallback>{tournament.organizer?.username?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">
                        {tournament.organizer?.display_name || tournament.organizer?.username}
                      </div>
                      <div className="text-sm text-muted-foreground">Organisateur officiel</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Règles et format</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Mode:{" "}
                        {gameModeLabels[tournament.game_mode as string] ??
                          tournament.format?.replace("_", " ") ??
                          "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Participation:{" "}
                        {participationLabels[tournament.participation_mode as string] ??
                          (tournament.is_team_based ? `Équipe (${tournament.team_size})` : "Solo")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Bracket: {tournament.bracket_type?.replace("_", " ") ?? "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Région: {tournament.region?.replace("_", " ") ?? "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Calendrier</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Début:{" "}
                        {new Date(tournament.starts_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Inscriptions ouvertes:{" "}
                        {tournament.registration_opens_at
                          ? new Date(tournament.registration_opens_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                            })
                          : "Dès maintenant"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Inscriptions fermées:{" "}
                        {tournament.registration_closes_at
                          ? new Date(tournament.registration_closes_at).toLocaleDateString(
                              "fr-FR",
                              { day: "numeric", month: "short" },
                            )
                          : "Avant le début"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>S'inscrire au tournoi</CardTitle>
              <CardDescription>Rejoins la compétition et affronte d'autres joueurs</CardDescription>
            </CardHeader>

            <CardContent>
              {!isRegistrationOpen && !tournament.status?.includes("open") ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  {isPendingVerification ? (
                    <>
                      <p className="font-medium">Inscriptions fermées</p>
                      <p className="text-sm mt-1">
                        Ce tournoi est en cours de vérification par un administrateur.
                      </p>
                    </>
                  ) : isApprovedNotOpen ? (
                    <>
                      <p className="font-medium">Inscriptions pas encore ouvertes</p>
                      <p className="text-sm mt-1">
                        Elles ouvriront automatiquement dans {countdown}.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Inscriptions fermées</p>
                      <p className="text-sm mt-1">
                        Les inscriptions ne sont pas ouvertes pour ce tournoi.
                      </p>
                    </>
                  )}
                </div>
              ) : registrations &&
                registrations.some(
                  (r) => r.user_id === user?.uid || r.registered_by === user?.uid,
                ) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">Tu es déjà inscrit à ce tournoi</p>
                  <p className="text-sm mt-1">
                    Tu participes en{" "}
                    {participationLabels[tournament.participation_mode as string] ??
                      (registrations.find(
                        (r) => r.user_id === user?.uid || r.registered_by === user?.uid,
                      )?.team_id
                        ? "équipe"
                        : "solo")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  {tournament.participation_mode === "solo" || !tournament.participation_mode ? (
                    <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                      Tu participes en tant que joueur individuel (mode solo).
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="team_id">
                        Équipe <span className="text-destructive">*</span>
                      </Label>
                      {hasTeams ? (
                        <Select
                          value={registrationForm.team_id}
                          onValueChange={(value) =>
                            setRegistrationForm({ ...registrationForm, team_id: value })
                          }
                        >
                          <SelectTrigger className="mt-2">
                            <SelectValue placeholder="Sélectionne ton équipe" />
                          </SelectTrigger>
                          <SelectContent>
                            {(userTeams as Array<{ id: string; name?: string }>)?.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name ?? team.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Tu n'as pas encore d'équipe. Crée-en une avant de t'inscrire sur ton
                          profil.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="notes">Notes (optionnel)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Informations supplémentaires pour l'organisateur..."
                      value={registrationForm.notes}
                      onChange={(e) =>
                        setRegistrationForm({ ...registrationForm, notes: e.target.value })
                      }
                      maxLength={500}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      isRegistering ||
                      (!!tournament.participation_mode &&
                        tournament.participation_mode !== "solo" &&
                        !hasTeams)
                    }
                    className="w-full bg-sunset text-white shadow-glow-sm hover:opacity-90"
                  >
                    {isRegistering ? t("common.registering") : t("tournaments.register")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isCreator && (
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Demandes de participation</CardTitle>
                <CardDescription>Les joueurs qui veulent participer à ton tournoi</CardDescription>
              </CardHeader>
              <CardContent>
                {!requests || requests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-medium">Aucune demande pour le moment</p>
                    <p className="text-sm mt-1">Les demandes apparaîtront ici.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map((req) => {
                      const profile = req.user as
                        | { username?: string; display_name?: string; avatar_url?: string }
                        | undefined;
                      return (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={profile?.avatar_url} />
                              <AvatarFallback>
                                {profile?.username?.charAt(0)?.toUpperCase() ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {profile?.display_name || profile?.username || "Inconnu"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {req.status === "pending"
                                  ? "En attente"
                                  : req.status === "accepted"
                                    ? "Acceptée"
                                    : "Refusée"}
                              </p>
                            </div>
                          </div>
                          {req.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                disabled={handlingRequestId === req.user_id}
                                onClick={() => handleRequestAction(req.user_id, "accepted")}
                              >
                                {handlingRequestId === req.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Accepter"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                disabled={handlingRequestId === req.user_id}
                                onClick={() => handleRequestAction(req.user_id, "rejected")}
                              >
                                Refuser
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="winners">
          <Card>
            <CardHeader>
              <CardTitle>Gagnants du tournoi</CardTitle>
              <CardDescription>Les équipes et joueurs qui ont marqué l'histoire</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-6">
                {(matches ?? []).filter(
                  (m) => m.status === "completed" && m.results && m.results.length > 0,
                ).length > 0 ? (
                  <div className="space-y-4">
                    {(matches ?? [])
                      .filter((m) => m.status === "completed" && m.results && m.results.length > 0)
                      .map((match) => (
                        <div key={match.id} className="p-4 border rounded-lg">
                          <div className="font-medium">Match #{match.match_number}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Résultats disponibles
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium">Aucun gagnant pour le moment</p>
                    <p className="text-sm mt-1">
                      Les résultats apparaîtront ici une fois les matchs terminés.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bracket">
          <Card>
            <CardHeader>
              <CardTitle>Répartition du tournoi</CardTitle>
              <CardDescription>Équipes inscrites et matchs générés</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-6">
                {matches && matches.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Matchs du tournoi</h3>
                      <Badge variant="outline" className="text-xs">
                        {matches.length} match{matches.length > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      {matches.map((match) => (
                        <div
                          key={match.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/40 transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className="font-medium text-right">
                                {match.team1_name || "Équipe"}
                              </span>
                              {(match as Record<string, unknown>).team1_logo ? (
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={(match as Record<string, unknown>).team1_logo as string}
                                  />
                                  <AvatarFallback>
                                    {(match.team1_name || "É")?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset">
                                  <Users className="h-4 w-4 text-white" />
                                </div>
                              )}
                            </div>

                            {match.results && match.results.length > 0 ? (
                              (() => {
                                const r = match.results[0] as Record<string, unknown>;
                                const hasKills =
                                  r.team1_kills !== undefined && r.team2_kills !== undefined;
                                return hasKills ? (
                                  <div className="flex flex-col items-center gap-0.5 px-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-base font-black tabular-nums text-orange-400">
                                        {r.team1_kills as number}
                                      </span>
                                      <span className="text-xs font-bold text-muted-foreground">
                                        VS
                                      </span>
                                      <span className="text-base font-black tabular-nums text-orange-400">
                                        {r.team2_kills as number}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground/60">
                                      {r.team1_score as number}e · {r.team2_score as number}e
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2">
                                    <span className="text-lg font-black tabular-nums">
                                      {r.team1_score as number}
                                    </span>
                                    <span className="text-sm font-bold text-muted-foreground">
                                      VS
                                    </span>
                                    <span className="text-lg font-black tabular-nums">
                                      {r.team2_score as number}
                                    </span>
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="text-sm font-bold text-muted-foreground px-3">VS</div>
                            )}

                            <div className="flex items-center gap-2 flex-1">
                              {(match as Record<string, unknown>).team2_logo ? (
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={(match as Record<string, unknown>).team2_logo as string}
                                  />
                                  <AvatarFallback>
                                    {(match.team2_name || "É")?.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset">
                                  <Users className="h-4 w-4 text-white" />
                                </div>
                              )}
                              <span className="font-medium">{match.team2_name || "Équipe"}</span>
                            </div>
                          </div>

                          <Badge variant="outline" className="text-xs ml-4">
                            {match.status?.replace("_", " ") ?? "N/A"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Équipes inscrites</h3>
                      <Badge variant="outline" className="text-xs">
                        {registrations?.length || 0} équipe
                        {(registrations?.length || 0) > 1 ? "s" : ""}
                      </Badge>
                    </div>

                    {registrations && registrations.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {registrations.map((reg) => {
                          const team = (reg as Record<string, unknown>).team as
                            Record<string, unknown> | undefined;
                          return (
                            <div
                              key={reg.id}
                              className="flex items-center gap-3 p-3 border rounded-lg"
                            >
                              {team?.logo_url ? (
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={team.logo_url as string} />
                                  <AvatarFallback>
                                    {(team.name as string)?.charAt(0) || "É"}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="grid h-10 w-10 place-items-center rounded-lg bg-sunset">
                                  <Users className="h-5 w-5 text-white" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">
                                  {(team?.name as string) || "Équipe"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Inscrit
                                  {reg.created_at
                                    ? ` le ${new Date(reg.created_at).toLocaleDateString("fr-FR")}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="font-medium">Aucune équipe inscrite</p>
                        <p className="text-sm mt-1">Les équipes inscrites apparaîtront ici.</p>
                      </div>
                    )}

                    {isCreator && registrations && registrations.length >= 2 && (
                      <Button
                        onClick={async () => {
                          try {
                            const idToken = await user?.getIdToken();
                            if (!idToken) throw new Error("Non connecté");
                            const result = await generateTournamentBracket({
                              data: { idToken, tournamentId },
                            });
                            toast.success(`Bracket généré avec ${result.matchCount} matchs`);
                          } catch (err) {
                            toast.error(
                              err instanceof Error ? err.message : "Erreur lors du tirage",
                            );
                          }
                        }}
                        className="w-full bg-sunset text-white shadow-glow-sm hover:opacity-90"
                      >
                        Effectuer le tirage au sort
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
