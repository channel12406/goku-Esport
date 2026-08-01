import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import {
  Shield,
  Users,
  AlertTriangle,
  Trophy,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Ban,
  Send,
  Activity,
  FileCheck,
  CalendarCheck,
  Swords,
  Image,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { PxpCoin } from "@/components/pxp-coin";
import {
  useReports,
  useModerationLogs,
  useOrganizerApplications,
  useAdminUsers,
  useAdminPendingTournaments,
  useAdminAllTournaments,
  useAdminPxpTransactions,
  useAdminCreatorRequests,
  useBanners,
  tsToMs,
  useAdminStatus,
} from "@/lib/queries";
import type { Banner } from "@/lib/queries";
import { useAuth } from "@/lib/firebase-auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteLayout } from "@/components/site-layout";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { adminAdjustPxp } from "@/server-functions/admin-adjust-pxp";
import { approveTournament } from "@/server-functions/approve-tournament";
import { rejectTournament as rejectTournamentFn } from "@/server-functions/reject-tournament";
import { banUser as banUserFn } from "@/server-functions/ban-user";
import { deleteTournament as deleteTournamentFn } from "@/server-functions/delete-tournament";
import { updateMatchScore } from "@/server-functions/update-match-score";
import { adminToggleCreator } from "@/server-functions/admin-toggle-creator";
import { adminHandleCreatorRequest } from "@/server-functions/admin-handle-creator-request";
import { createBanner } from "@/server-functions/create-banner";
import { deleteBanner as deleteBannerFn } from "@/server-functions/delete-banner";
import { toggleBanner } from "@/server-functions/toggle-banner";
import { useTournamentMatches } from "@/lib/queries";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — FireArena" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminGuard,
});

// ─── Guard : vérifie côté serveur que l'utilisateur est admin ────────────────
function AdminGuard() {
  const { loading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useAdminStatus();

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Shield className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-black">Accès refusé</h1>
        <p className="text-muted-foreground text-sm">
          Cette page est réservée aux administrateurs.
        </p>
        <a href="/" className="text-primary hover:underline text-sm">
          Retour à l'accueil
        </a>
      </div>
    );
  }

  return <AdminDashboard />;
}

// ─── Dashboard Admin ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reports, isLoading: repLoading } = useReports();
  const { data: moderationLogs, isLoading: logLoading } = useModerationLogs();
  const { data: applications, isLoading: appLoading } = useOrganizerApplications();
  const { data: pendingTournaments, isLoading: tourLoading } = useAdminPendingTournaments();
  const { data: allTournaments } = useAdminAllTournaments();
  const { data: pxpTransactions } = useAdminPxpTransactions();
  const { data: creatorRequests } = useAdminCreatorRequests();

  const [userSearch, setUserSearch] = useState("");
  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useAdminUsers(userSearch);

  // PXP Admin form
  const [pxpTargetId, setPxpTargetId] = useState("");
  const [pxpAmount, setPxpAmount] = useState("");
  const [pxpReason, setPxpReason] = useState("");
  const [pxpLoading, setPxpLoading] = useState(false);

  // Match scores
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [matchScores, setMatchScores] = useState<
    Record<string, { team1: string; team2: string; team1Kills?: string; team2Kills?: string }>
  >({});
  const [submittingMatchId, setSubmittingMatchId] = useState<string | null>(null);
  const { data: matches } = useTournamentMatches(selectedTournamentId);

  // Tournament publish
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Creator toggle
  const [togglingCreatorId, setTogglingCreatorId] = useState<string | null>(null);

  // Creator requests
  const [handlingCreatorRequestId, setHandlingCreatorRequestId] = useState<string | null>(null);

  async function handleCreatorRequest(targetUid: string, action: "approved" | "rejected") {
    if (!user) return;
    setHandlingCreatorRequestId(targetUid);
    try {
      const idToken = await user.getIdToken();
      await adminHandleCreatorRequest({ data: { idToken, targetUid, action } });
      queryClient.invalidateQueries({ queryKey: ["admin-creator-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(action === "approved" ? "Créateur activé ✓" : "Demande refusée");
    } catch {
      toast.error("Erreur lors du traitement de la demande");
    } finally {
      setHandlingCreatorRequestId(null);
    }
  }

  // ── Valider un tournoi ──────────────────────────────────────────────────────
  async function publishTournament(id: string) {
    setPublishingId(id);
    try {
      if (!user) throw new Error("Non connecté");
      const idToken = await user.getIdToken();
      await approveTournament({ data: { idToken, tournamentId: id } });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournoi approuvé ✓", {
        description: "Le tournoi sera ouvert aux inscriptions dans 5 min.",
      });
    } catch {
      toast.error("Erreur", { description: "Impossible d'approuver le tournoi." });
    } finally {
      setPublishingId(null);
    }
  }

  async function rejectTournament(id: string) {
    setRejectingId(id);
    try {
      if (!user) throw new Error("Non connecté");
      const idToken = await user.getIdToken();
      await rejectTournamentFn({ data: { idToken, tournamentId: id } });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-tournaments"] });
      toast.success("Tournoi rejeté", { description: "Le tournoi a été rejeté et masqué." });
    } catch {
      toast.error("Erreur", { description: "Impossible de rejeter le tournoi." });
    } finally {
      setRejectingId(null);
    }
  }

  // ── Supprimer un tournoi ─────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function deleteTournament(id: string) {
    if (!window.confirm("Supprimer ce tournoi définitivement ?")) return;
    setDeletingId(id);
    try {
      if (!user) throw new Error("Non connecté");
      const idToken = await user.getIdToken();
      await deleteTournamentFn({ data: { idToken, tournamentId: id } });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournoi supprimé", {
        description: "Le tournoi et ses données ont été supprimés.",
      });
    } catch {
      toast.error("Erreur", { description: "Impossible de supprimer le tournoi." });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Créditer / débiter PXP ──────────────────────────────────────────────────
  async function handlePxpAction(type: "credit" | "debit") {
    const amt = parseInt(pxpAmount);
    if (!pxpTargetId.trim() || isNaN(amt) || amt <= 0) {
      toast.error("Champs invalides");
      return;
    }
    setPxpLoading(true);
    try {
      if (!user) throw new Error("Non connecté");
      const idToken = await user.getIdToken();

      await adminAdjustPxp({
        data: {
          idToken,
          targetId: pxpTargetId.trim(),
          amount: amt,
          reason: pxpReason || undefined,
          type,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pxp-transactions"] });
      toast.success(`${type === "credit" ? "Crédit" : "Débit"} effectué ✓`, {
        description: `${amt} PXP ${type === "credit" ? "crédités" : "débités"}.`,
      });
      setPxpAmount("");
      setPxpReason("");
      setPxpTargetId("");
    } catch (e) {
      toast.error("Erreur Firebase", { description: String(e) });
    } finally {
      setPxpLoading(false);
    }
  }

  // ── Enregistrer score match ───────────────────────────────────────────────────
  async function handleSubmitScore(matchId: string) {
    const scores = matchScores[matchId];
    if (!scores || scores.team1 === "" || scores.team2 === "") {
      toast.error("Veuillez remplir les deux scores");
      return;
    }
    const t1 = parseInt(scores.team1);
    const t2 = parseInt(scores.team2);
    if (isNaN(t1) || isNaN(t2) || t1 < 0 || t2 < 0) {
      toast.error("Scores invalides");
      return;
    }
    const selectedTournament = allTournaments?.find((t) => t.id === selectedTournamentId);
    const gameMode = (selectedTournament as Record<string, unknown>)?.game_mode as
      string | undefined;
    const isBrWithKills =
      gameMode &&
      (gameMode === "br_squad" || gameMode === "br_duo") &&
      scores.team1Kills !== undefined &&
      scores.team2Kills !== undefined;
    if (isBrWithKills && (scores.team1Kills === "" || scores.team2Kills === "")) {
      toast.error("Veuillez remplir les kills des deux équipes");
      return;
    }
    setSubmittingMatchId(matchId);
    try {
      if (!user) throw new Error("Non connecté");
      const idToken = await user.getIdToken();
      const payload: {
        idToken: string;
        matchId: string;
        team1Score: number;
        team2Score: number;
        team1Kills?: number;
        team2Kills?: number;
      } = { idToken, matchId, team1Score: t1, team2Score: t2 };
      if (isBrWithKills) {
        payload.team1Kills = parseInt(scores.team1Kills!);
        payload.team2Kills = parseInt(scores.team2Kills!);
      }
      await updateMatchScore({ data: payload });
      queryClient.invalidateQueries({ queryKey: ["tournament-matches", selectedTournamentId] });
      toast.success("Score enregistré !");
    } catch (e) {
      toast.error("Erreur", { description: String(e) });
    } finally {
      setSubmittingMatchId(null);
    }
  }

  // ── Bannir un utilisateur ───────────────────────────────────────────────────
  const [banUid, setBanUid] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  async function handleBan() {
    if (!banUid.trim()) return;
    setBanLoading(true);
    try {
      if (!user) throw new Error("Non connecté");
      const idToken = await user.getIdToken();
      await banUserFn({
        data: { idToken, targetUid: banUid.trim(), reason: banReason || undefined },
      });
      toast.success("Utilisateur banni ✓");
      setBanUid("");
      setBanReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch {
      toast.error("Erreur");
    } finally {
      setBanLoading(false);
    }
  }

  // ── Activer/désactiver créateur ──────────────────────────────────────────────
  async function handleToggleCreator(targetUid: string) {
    if (!user) return;
    setTogglingCreatorId(targetUid);
    try {
      const idToken = await user.getIdToken();
      const result = await adminToggleCreator({ data: { idToken, targetUid } });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(result.can_create_tournaments ? "Créateur activé ✓" : "Créateur désactivé");
    } catch {
      toast.error("Erreur lors de la modification");
    } finally {
      setTogglingCreatorId(null);
    }
  }

  const pendingReports = reports?.filter((r) => r.status === "pending").length ?? 0;
  const pendingTour = pendingTournaments?.length ?? 0;
  const pendingApps = applications?.filter((a) => a.status === "pending").length ?? 0;
  const pendingCreatorRequests = creatorRequests?.length ?? 0;

  return (
    <SiteLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-500/10 p-2.5">
            <Shield className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-black">Panel Administrateur</h1>
            <p className="text-sm text-muted-foreground">Accès restreint — FireArena HQ</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            {
              label: "Tournois à valider",
              value: pendingTour,
              icon: FileCheck,
              color: "text-orange-400",
            },
            {
              label: "Rapports en attente",
              value: pendingReports,
              icon: AlertTriangle,
              color: "text-red-400",
            },
            { label: "Demandes orga.", value: pendingApps, icon: Users, color: "text-blue-400" },
            {
              label: "Demandes créateurs",
              value: pendingCreatorRequests,
              icon: UserCheck,
              color: "text-green-400",
            },
            {
              label: "Total tournois",
              value: allTournaments?.length ?? 0,
              icon: Trophy,
              color: "text-yellow-400",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-card/50 border-border/40">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`rounded-lg bg-card p-2 ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className={`text-2xl font-black ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tournaments" className="w-full">
          <div className="overflow-x-auto pb-2 scrollbar-none">
            <TabsList className="inline-flex w-max min-w-full gap-0.5 bg-transparent p-0">
              <TabsTrigger
                value="tournaments"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <Trophy className="h-4 w-4 mr-1.5 hidden sm:inline" /> Tournois
              </TabsTrigger>
              <TabsTrigger
                value="matches"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <Swords className="h-4 w-4 mr-1.5 hidden sm:inline" /> Matchs
              </TabsTrigger>
              <TabsTrigger
                value="pxp"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <PxpCoin className="h-4 w-4 mr-1.5 hidden sm:inline" /> PXP
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <Users className="h-4 w-4 mr-1.5 hidden sm:inline" /> Joueurs
              </TabsTrigger>
              <TabsTrigger
                value="creators"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <UserCheck className="h-4 w-4 mr-1.5 hidden sm:inline" /> Créateurs
              </TabsTrigger>
              <TabsTrigger
                value="creator-requests"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <Clock className="h-4 w-4 mr-1.5 hidden sm:inline" /> Demandes
                {pendingCreatorRequests > 0 && (
                  <Badge className="ml-1.5 bg-green-600 text-white">{pendingCreatorRequests}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="transfers"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <Send className="h-4 w-4 mr-1.5 hidden sm:inline" /> Transferts
              </TabsTrigger>
              <TabsTrigger
                value="banners"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <Image className="h-4 w-4 mr-1.5 hidden sm:inline" /> Bannières
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <AlertTriangle className="h-4 w-4 mr-1.5 hidden sm:inline" /> Rapports
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="text-xs sm:text-sm rounded-lg px-3 py-1.5 data-[state=active]:bg-[#fc0] data-[state=active]:text-black"
              >
                <Activity className="h-4 w-4 mr-1.5 hidden sm:inline" /> Logs
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── TOURNOIS ── */}
          <TabsContent value="tournaments" className="space-y-4 mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-orange-400" />
                  Tournois en attente de validation
                  {pendingTour > 0 && (
                    <Badge className="bg-orange-500 text-white">{pendingTour}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Valide ou rejette les tournois créés par les organisateurs avant publication.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tourLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </div>
                ) : !pendingTournaments || pendingTournaments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-400/50" />
                    <p>Aucun tournoi en attente.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTournaments.map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border/40 bg-card/40"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold truncate">{t.name ?? "Sans nom"}</span>
                            <Badge variant="outline" className="text-xs">
                              {t.format ?? "—"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {t.region ?? "—"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Début :{" "}
                            {t.starts_at ? new Date(t.starts_at).toLocaleString("fr-FR") : "—"}
                            {t.prize_pool_pxp
                              ? ` · Prize : ${t.prize_pool_pxp.toLocaleString("fr-FR")} PXP`
                              : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Organisateur ID : <code className="text-xs">{t.organizer_id}</code>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={publishingId === t.id}
                            onClick={() => publishTournament(t.id)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {publishingId === t.id ? "..." : "Publier"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={rejectingId === t.id}
                            onClick={() => rejectTournament(t.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {rejectingId === t.id ? "..." : "Rejeter"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All tournaments */}
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle>Tous les tournois</CardTitle>
                <CardDescription>Vue globale avec statuts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {allTournaments?.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/30 text-sm"
                    >
                      <span className="font-medium truncate flex-1">{t.name ?? "Sans nom"}</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            t.status === "registration_open" || t.status === "open"
                              ? "bg-green-500/20 text-green-400"
                              : t.status === "approved"
                                ? "bg-blue-500/20 text-blue-400"
                                : t.status === "pending_verification"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : t.status === "rejected"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-zinc-500/20 text-zinc-400"
                          }
                        >
                          {t.status === "pending_verification"
                            ? "En attente"
                            : t.status === "approved"
                              ? "Approuvé (5 min d'attente)"
                              : t.status === "registration_open" || t.status === "open"
                                ? "Ouvert"
                                : t.status === "rejected"
                                  ? "Rejeté"
                                  : (t.status ?? "inconnu")}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:bg-destructive/10"
                          disabled={deletingId === t.id}
                          onClick={() => deleteTournament(t.id)}
                        >
                          {deletingId === t.id ? "..." : "Suppr"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── MATCHS ── */}
          <TabsContent value="matches" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-5 w-5 text-orange-400" />
                  Gestion des scores
                </CardTitle>
                <CardDescription>
                  Sélectionne un tournoi pour mettre à jour les scores des matchs en direct.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Tournoi</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-border/40 bg-card/60 px-3 py-2 text-sm mt-1"
                      value={selectedTournamentId}
                      onChange={(e) => {
                        setSelectedTournamentId(e.target.value);
                        setMatchScores({});
                      }}
                    >
                      <option value="">Sélectionner un tournoi...</option>
                      {allTournaments?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name ?? "Sans nom"} —{" "}
                          {new Date(t.starts_at).toLocaleDateString("fr-FR")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedTournamentId && (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {!matches || matches.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Aucun match pour ce tournoi.
                        </div>
                      ) : (
                        (() => {
                          const selectedTournament = allTournaments?.find(
                            (t) => t.id === selectedTournamentId,
                          );
                          const gameMode = (selectedTournament as Record<string, unknown>)
                            ?.game_mode as string | undefined;
                          const isBrKills = gameMode === "br_squad" || gameMode === "br_duo";
                          const isSimpleScore = gameMode === "clash_squad" || !gameMode;

                          return matches.map((m) => {
                            const existingResult = (m.results ?? [])[0] as
                              Record<string, unknown> | undefined;
                            const hasExistingScore =
                              existingResult && existingResult.team1_score !== undefined;
                            const currentScores = matchScores[m.id] ?? {
                              team1: hasExistingScore ? String(existingResult!.team1_score) : "",
                              team2: hasExistingScore ? String(existingResult!.team2_score) : "",
                              team1Kills: hasExistingScore
                                ? String(existingResult!.team1_kills ?? "")
                                : "",
                              team2Kills: hasExistingScore
                                ? String(existingResult!.team2_kills ?? "")
                                : "",
                            };

                            return (
                              <div
                                key={m.id}
                                className="p-4 rounded-xl border border-border/40 bg-card/30"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2 font-medium text-sm">
                                    <span className="truncate max-w-[120px]">
                                      {m.team1_name ?? "?"}
                                    </span>
                                    <span className="text-muted-foreground">vs</span>
                                    <span className="truncate max-w-[120px]">
                                      {m.team2_name ?? "?"}
                                    </span>
                                  </div>
                                  <Badge
                                    className={
                                      m.status === "completed"
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-blue-500/20 text-blue-400"
                                    }
                                  >
                                    {m.status === "completed" ? "Terminé" : "Planifié"}
                                  </Badge>
                                </div>

                                {isSimpleScore && (
                                  <div className="flex items-end gap-3">
                                    <div>
                                      <Label className="text-xs">
                                        {m.team1_name ?? "Équipe 1"}
                                      </Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={currentScores.team1}
                                        onChange={(e) =>
                                          setMatchScores((prev) => ({
                                            ...prev,
                                            [m.id]: {
                                              ...(prev[m.id] ?? { team2: "" }),
                                              team1: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-20 mt-1 bg-card/60 border-border/40"
                                      />
                                    </div>
                                    <span className="text-muted-foreground pb-2">:</span>
                                    <div>
                                      <Label className="text-xs">
                                        {m.team2_name ?? "Équipe 2"}
                                      </Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={currentScores.team2}
                                        onChange={(e) =>
                                          setMatchScores((prev) => ({
                                            ...prev,
                                            [m.id]: {
                                              ...(prev[m.id] ?? { team1: "" }),
                                              team2: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-20 mt-1 bg-card/60 border-border/40"
                                      />
                                    </div>
                                    <Button
                                      onClick={() => handleSubmitScore(m.id)}
                                      disabled={submittingMatchId === m.id}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      {submittingMatchId === m.id
                                        ? "..."
                                        : hasExistingScore
                                          ? "Mettre à jour"
                                          : "Valider"}
                                    </Button>
                                  </div>
                                )}

                                {isBrKills && (
                                  <div className="flex items-end gap-3">
                                    <div>
                                      <Label className="text-xs">
                                        {m.team1_name ?? "Équipe 1"} — Kills
                                      </Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={currentScores.team1Kills ?? ""}
                                        onChange={(e) =>
                                          setMatchScores((prev) => ({
                                            ...prev,
                                            [m.id]: {
                                              ...(prev[m.id] ?? {
                                                team1: "",
                                                team2: "",
                                                team1Kills: "",
                                                team2Kills: "",
                                              }),
                                              team1Kills: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-20 mt-1 bg-card/60 border-border/40"
                                      />
                                    </div>
                                    <span className="text-muted-foreground pb-2">kills</span>
                                    <div>
                                      <Label className="text-xs">
                                        {m.team2_name ?? "Équipe 2"} — Kills
                                      </Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={currentScores.team2Kills ?? ""}
                                        onChange={(e) =>
                                          setMatchScores((prev) => ({
                                            ...prev,
                                            [m.id]: {
                                              ...(prev[m.id] ?? {
                                                team1: "",
                                                team2: "",
                                                team1Kills: "",
                                                team2Kills: "",
                                              }),
                                              team2Kills: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-20 mt-1 bg-card/60 border-border/40"
                                      />
                                    </div>
                                    <div className="border-l border-border/30 pl-3 flex items-end gap-3">
                                      <div>
                                        <Label className="text-xs">Place</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          placeholder="0"
                                          value={currentScores.team1}
                                          onChange={(e) =>
                                            setMatchScores((prev) => ({
                                              ...prev,
                                              [m.id]: {
                                                ...(prev[m.id] ?? {
                                                  team2: "",
                                                  team1Kills: "",
                                                  team2Kills: "",
                                                }),
                                                team1: e.target.value,
                                              },
                                            }))
                                          }
                                          className="w-16 mt-1 bg-card/60 border-border/40"
                                        />
                                      </div>
                                      <span className="text-muted-foreground pb-2">/</span>
                                      <div>
                                        <Label className="text-xs">Place</Label>
                                        <Input
                                          type="number"
                                          min="0"
                                          placeholder="0"
                                          value={currentScores.team2}
                                          onChange={(e) =>
                                            setMatchScores((prev) => ({
                                              ...prev,
                                              [m.id]: {
                                                ...(prev[m.id] ?? {
                                                  team1: "",
                                                  team1Kills: "",
                                                  team2Kills: "",
                                                }),
                                                team2: e.target.value,
                                              },
                                            }))
                                          }
                                          className="w-16 mt-1 bg-card/60 border-border/40"
                                        />
                                      </div>
                                      <Button
                                        onClick={() => handleSubmitScore(m.id)}
                                        disabled={submittingMatchId === m.id}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                      >
                                        {submittingMatchId === m.id
                                          ? "..."
                                          : hasExistingScore
                                            ? "Mettre à jour"
                                            : "Valider"}
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {!isSimpleScore && !isBrKills && (
                                  <div className="flex items-end gap-3">
                                    <div>
                                      <Label className="text-xs">
                                        {m.team1_name ?? "Équipe 1"}
                                      </Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={currentScores.team1}
                                        onChange={(e) =>
                                          setMatchScores((prev) => ({
                                            ...prev,
                                            [m.id]: {
                                              ...(prev[m.id] ?? { team2: "" }),
                                              team1: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-20 mt-1 bg-card/60 border-border/40"
                                      />
                                    </div>
                                    <span className="text-muted-foreground pb-2">:</span>
                                    <div>
                                      <Label className="text-xs">
                                        {m.team2_name ?? "Équipe 2"}
                                      </Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={currentScores.team2}
                                        onChange={(e) =>
                                          setMatchScores((prev) => ({
                                            ...prev,
                                            [m.id]: {
                                              ...(prev[m.id] ?? { team1: "" }),
                                              team2: e.target.value,
                                            },
                                          }))
                                        }
                                        className="w-20 mt-1 bg-card/60 border-border/40"
                                      />
                                    </div>
                                    <Button
                                      onClick={() => handleSubmitScore(m.id)}
                                      disabled={submittingMatchId === m.id}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      {submittingMatchId === m.id
                                        ? "..."
                                        : hasExistingScore
                                          ? "Mettre à jour"
                                          : "Valider"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PXP ADMIN ── */}
          <TabsContent value="pxp" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PxpCoin className="h-5 w-5" />
                  Gestion PXP
                </CardTitle>
                <CardDescription>
                  Crédite ou débite des PXP à n'importe quel joueur via son ID FireArena ou UID.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-w-md space-y-4">
                  <div>
                    <Label>ID FireArena ou UID joueur</Label>
                    <Input
                      placeholder="ex: FA-00123 ou uid Firebase"
                      value={pxpTargetId}
                      onChange={(e) => setPxpTargetId(e.target.value)}
                      className="mt-1 bg-card/60 border-border/40"
                    />
                  </div>
                  <div>
                    <Label>Montant PXP</Label>
                    <Input
                      type="number"
                      placeholder="ex: 500"
                      value={pxpAmount}
                      onChange={(e) => setPxpAmount(e.target.value)}
                      className="mt-1 bg-card/60 border-border/40"
                    />
                  </div>
                  <div>
                    <Label>Raison (optionnel)</Label>
                    <Textarea
                      placeholder="Bonus tournoi, correction, récompense…"
                      value={pxpReason}
                      onChange={(e) => setPxpReason(e.target.value)}
                      rows={2}
                      className="mt-1 bg-card/60 border-border/40"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handlePxpAction("credit")}
                      disabled={pxpLoading}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1"
                    >
                      <PxpCoin className="h-4 w-4 mr-2" />
                      {pxpLoading ? "..." : "Créditer"}
                    </Button>
                    <Button
                      onClick={() => handlePxpAction("debit")}
                      disabled={pxpLoading}
                      variant="destructive"
                      className="flex-1"
                    >
                      <PxpCoin className="h-4 w-4 mr-2" />
                      {pxpLoading ? "..." : "Débiter"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── JOUEURS ── */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  Joueurs inscrits
                </CardTitle>
                <CardDescription>Recherche par pseudo, ID FireArena ou UID</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Pseudo, ID FireArena, UID…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 bg-card/60 border-border/40"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => refetchUsers()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {usersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {users?.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-card/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                            {(u.username ?? u.display_name ?? "?")[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {u.username ?? u.display_name ?? "Sans pseudo"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {String(u.fire_arena_id) ? (
                                <span className="text-yellow-400 font-mono">
                                  {String(u.fire_arena_id)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">Pas d'ID</span>
                              )}
                              {" · "}
                              {Number(u.pxp ?? 0).toLocaleString("fr-FR")} PXP
                              {Boolean(u.is_banned) && (
                                <span className="ml-2 text-red-400">[BANNI]</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs hidden sm:flex">
                            Niv. {Math.floor(Number(u.pxp ?? 0) / 500) + 1}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {users?.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Aucun joueur trouvé.
                      </div>
                    )}
                  </div>
                )}

                {/* Ban section */}
                <div className="mt-4 border-t border-border/30 pt-4">
                  <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-400" /> Bannir un joueur
                  </p>
                  <div className="flex flex-col gap-2 max-w-md">
                    <Input
                      placeholder="UID Firebase du joueur"
                      value={banUid}
                      onChange={(e) => setBanUid(e.target.value)}
                      className="bg-card/60 border-border/40"
                    />
                    <Input
                      placeholder="Raison du ban"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      className="bg-card/60 border-border/40"
                    />
                    <Button
                      variant="destructive"
                      disabled={banLoading || !banUid.trim()}
                      onClick={handleBan}
                      className="w-full"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      {banLoading ? "..." : "Bannir"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CRÉATEURS ── */}
          <TabsContent value="creators" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-green-400" />
                  Gestion des créateurs de tournois
                </CardTitle>
                <CardDescription>
                  Active ou désactive la permission de créer des tournois pour un joueur.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un joueur..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 bg-card/60 border-border/40"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => refetchUsers()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {usersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {users?.map((u) => {
                      const canCreate = !!(u as Record<string, unknown>).can_create_tournaments;
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-card/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                              {(u.username ?? u.display_name ?? "?")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {u.username ?? u.display_name ?? "Sans pseudo"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {String(u.fire_arena_id) ? (
                                  <span className="text-yellow-400 font-mono">
                                    {String(u.fire_arena_id)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/50">Pas d'ID</span>
                                )}
                                {" · "}
                                {Number(u.pxp ?? 0).toLocaleString("fr-FR")} PXP
                                {Boolean(u.is_banned) && (
                                  <span className="ml-2 text-red-400">[BANNI]</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant={canCreate ? "default" : "outline"}
                            disabled={togglingCreatorId === u.id}
                            onClick={() => handleToggleCreator(u.id)}
                            className={
                              canCreate ? "bg-green-600 hover:bg-green-700 text-white" : ""
                            }
                          >
                            {togglingCreatorId === u.id ? "..." : canCreate ? "Actif" : "Activer"}
                          </Button>
                        </div>
                      );
                    })}
                    {users?.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Aucun joueur trouvé.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DEMANDES CRÉATEURS ── */}
          <TabsContent value="creator-requests" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-green-400" />
                  Demandes de statut créateur
                  {pendingCreatorRequests > 0 && (
                    <Badge className="bg-green-600 text-white">{pendingCreatorRequests}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Valide ou refuse les joueurs qui veulent créer des tournois. Ils sont prévenus par
                  notification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {creatorRequests === undefined ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                  </div>
                ) : creatorRequests.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-400/50" />
                    <p>Aucune demande en attente.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {creatorRequests.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border/30 bg-card/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                            {(r.user?.username ?? r.user?.display_name ?? "?")[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {r.user?.username ?? r.user?.display_name ?? "Utilisateur inconnu"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(r.user as Record<string, unknown>)?.fire_arena_id ? (
                                <span className="text-yellow-400 font-mono">
                                  {String((r.user as Record<string, unknown>).fire_arena_id)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">Pas d'ID</span>
                              )}
                              {" · "}
                              {r.created_at
                                ? new Date(tsToMs(r.created_at)).toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Date inconnue"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={handlingCreatorRequestId === r.user_id}
                            onClick={() => handleCreatorRequest(r.user_id, "approved")}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            {handlingCreatorRequestId === r.user_id ? "..." : "Valider"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={handlingCreatorRequestId === r.user_id}
                            onClick={() => handleCreatorRequest(r.user_id, "rejected")}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Refuser
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TRANSFERTS PXP ── */}
          <TabsContent value="transfers" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-green-400" />
                  Historique des transferts PXP
                </CardTitle>
                <CardDescription>Surveille tous les transferts entre joueurs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {pxpTransactions?.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-card/30 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{tx.reason || "Transfert"}</div>
                        <div className="text-xs text-muted-foreground">
                          {tx.type === "transfer_sent"
                            ? "Envoyé"
                            : tx.type === "transfer_received"
                              ? "Reçu"
                              : tx.type || "Transaction"}
                          {tx.sender_id && (
                            <span className="ml-2">De: {tx.sender_id.slice(0, 8)}...</span>
                          )}
                          {tx.recipient_id && (
                            <span className="ml-2">À: {tx.recipient_id.slice(0, 8)}...</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground/50">
                          UID: {tx.user_id} ·{" "}
                          {tx.created_at ? new Date(tx.created_at).toLocaleString("fr-FR") : ""}
                        </div>
                      </div>
                      <Badge
                        className={
                          (tx.amount ?? 0) > 0
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }
                      >
                        {(tx.amount ?? 0) > 0 ? "+" : ""}
                        {(tx.amount ?? 0).toLocaleString("fr-FR")} PXP
                      </Badge>
                    </div>
                  ))}
                  {!pxpTransactions ||
                    (pxpTransactions.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Aucun transfert enregistré.
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── BANNIÈRES ── */}
          <TabsContent value="banners" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5 text-[#fc0]" />
                  Bannières de l'accueil
                </CardTitle>
                <CardDescription>
                  Gérez les bannières du carousel en page d'accueil (ratio YouTube ~ 2560×1440
                  recommandé)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BannersManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RAPPORTS ── */}
          <TabsContent value="reports" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle>Rapports utilisateurs</CardTitle>
                <CardDescription>{pendingReports} en attente</CardDescription>
              </CardHeader>
              <CardContent>
                {repLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : reports?.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400/50" />
                    Aucun rapport.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {reports?.map((r) => (
                      <div key={r.id} className="p-4 rounded-xl border border-border/40 bg-card/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{r.reason ?? "Sans raison"}</span>
                          <Badge
                            className={
                              r.status === "pending"
                                ? "bg-orange-500/20 text-orange-400"
                                : r.status === "actioned"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-zinc-500/20 text-zinc-400"
                            }
                          >
                            {r.status ?? "—"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.details ?? "—"}</p>
                        <p className="text-xs text-muted-foreground/50 mt-1">
                          {r.created_at ? new Date(r.created_at).toLocaleString("fr-FR") : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── LOGS ── */}
          <TabsContent value="logs" className="mt-4">
            <Card className="bg-card/50 border-border/40">
              <CardHeader>
                <CardTitle>Journal de modération</CardTitle>
                <CardDescription>Toutes les actions des admins</CardDescription>
              </CardHeader>
              <CardContent>
                {logLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : moderationLogs?.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    Aucune action.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {moderationLogs?.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-card/30 text-sm"
                      >
                        <div>
                          <span className="font-medium">{l.action ?? "—"}</span>
                          <span className="text-muted-foreground"> · {l.notes ?? ""}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {l.created_at ? new Date(l.created_at).toLocaleDateString("fr-FR") : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}

// ─── Bannières Manager ─────────────────────────────────────────────────────────
function BannersManager() {
  const queryClient = useQueryClient();
  const { data: banners, isLoading } = useBanners();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [cta, setCta] = useState("");
  const [link, setLink] = useState("/tournaments");
  const [order, setOrder] = useState(1);
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!imageUrl.trim() || !title.trim()) {
      toast.error("Ajoute un lien d'image et un titre");
      return;
    }
    setUploading(true);
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error("Non connecté");

      await createBanner({
        data: {
          idToken,
          image_url: imageUrl.trim(),
          title: title.trim(),
          subtitle: subtitle.trim(),
          cta: cta.trim(),
          link: link.trim() || "/tournaments",
          order,
        },
      });

      toast.success("Bannière ajoutée");
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      setTitle("");
      setSubtitle("");
      setCta("");
      setLink("/tournaments");
      setOrder(1);
      setImageUrl("");
    } catch (e) {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Impossible d'uploader",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(bannerId: string) {
    if (!window.confirm("Supprimer cette bannière ?")) return;
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error("Non connecté");

      await deleteBannerFn({ data: { idToken, bannerId } });

      toast.success("Bannière supprimée");
      queryClient.invalidateQueries({ queryKey: ["banners"] });
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  }

  async function handleToggleActive(banner: Banner) {
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error("Non connecté");

      await toggleBanner({ data: { idToken, bannerId: banner.id, active: !banner.active } });

      toast.success(banner.active !== false ? "Bannière désactivée" : "Bannière activée");
      queryClient.invalidateQueries({ queryKey: ["banners"] });
    } catch {
      toast.error("Erreur");
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="rounded-lg border border-border/30 bg-card/30 p-4 space-y-4">
        <h4 className="font-medium text-sm">Ajouter une bannière</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Titre</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tournois Free Fire"
            />
          </div>
          <div className="space-y-2">
            <Label>Sous-titre</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Battle Royale, Clash Squad & plus"
            />
          </div>
          <div className="space-y-2">
            <Label>Texte du bouton</Label>
            <Input
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="Voir les tournois"
            />
          </div>
          <div className="space-y-2">
            <Label>Lien</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/tournaments"
            />
          </div>
          <div className="space-y-2">
            <Label>Ordre</Label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label>Image (lien URL, format YouTube 2560×1440)</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://exemple.com/banniere.jpg"
            />
          </div>
        </div>
        {imageUrl.trim() && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/30 bg-black/50">
            <img
              src={imageUrl.trim()}
              alt="Aperçu"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.opacity = "0.2";
              }}
            />
          </div>
        )}
        <Button onClick={handleUpload} disabled={uploading || !imageUrl.trim() || !title.trim()}>
          {uploading ? "Ajout..." : "Ajouter la bannière"}
        </Button>
      </div>

      {/* Existing banners */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Bannières existantes</h4>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !banners || banners.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            Aucune bannière. Ajoute ta première bannière ci-dessus.
          </div>
        ) : (
          banners.map((b) => (
            <div
              key={b.id}
              className="rounded-lg border border-border/30 bg-card/30 overflow-hidden"
            >
              {b.image_url && (
                <div className="relative aspect-video w-full bg-black/50">
                  <img
                    src={b.image_url}
                    alt={b.title ?? ""}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="p-3 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{b.title || "Sans titre"}</p>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${b.active !== false ? "bg-green-400" : "bg-muted-foreground"}`}
                    />
                  </div>
                  {b.subtitle && (
                    <p className="text-xs text-muted-foreground truncate">{b.subtitle}</p>
                  )}
                  <p className="text-xs text-muted-foreground/50">
                    Ordre: {b.order ?? "—"} · {b.link ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => handleToggleActive(b)}>
                    {b.active !== false ? "Désactiver" : "Activer"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(b.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
