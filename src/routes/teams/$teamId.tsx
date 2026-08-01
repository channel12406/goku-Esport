import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import {
  Users,
  Trophy,
  MapPin,
  Flag,
  Calendar,
  Shield,
  Plus,
  X,
  Check,
  Verified,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/firebase-auth-context";
import {
  useTeam,
  useTeamMembers,
  useTeamInvites,
  useTeamVerifications,
  useTeamJoinRequests,
} from "@/lib/queries";
import { createNotification } from "@/server-functions/create-notification";
import { sendJoinRequest as sendJoinRequestFn } from "@/server-functions/send-join-request";
import { handleJoinRequest as handleJoinRequestFn } from "@/server-functions/handle-join-request";
import { removeTeamMember as removeTeamMemberFn } from "@/server-functions/remove-team-member";
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

const teamSchema = z.object({
  name: z.string().min(3).max(50),
  tag: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Z0-9]+$/, "Majuscules et chiffres uniquement"),
  description: z.string().max(500).optional(),
  region: z.enum([
    "africa_west",
    "africa_north",
    "africa_central",
    "africa_east",
    "africa_south",
    "europe",
    "americas",
    "asia",
    "oceania",
    "other",
  ]),
  country: z.string().max(50).optional(),
});

export const Route = createFileRoute("/teams/$teamId")({
  head: ({ params }) => ({
    meta: [
      { title: `Équipe ${params.teamId} — FireArena` },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `Équipe ${params.teamId} — FireArena` },
      { property: "og:description", content: "Découvre cette équipe Free Fire sur FireArena." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { teamId } = Route.useParams();

  // Team data
  const { data: currentTeam, isLoading: teamLoading, error: teamError } = useTeam(teamId);
  const { data: members, isLoading: membersLoading, error: membersError } = useTeamMembers(teamId);
  const { data: invites, isLoading: invitesLoading, error: invitesError } = useTeamInvites(teamId);
  const {
    data: verifications,
    isLoading: verificationsLoading,
    error: verificationsError,
  } = useTeamVerifications(teamId);
  const { data: joinRequests, isLoading: requestsLoading } = useTeamJoinRequests(teamId);

  const isCaptain = user && currentTeam?.captain_id === user.uid;
  const isMember = user && members?.some((m) => m.user_id === user.uid);

  // State for join request
  const [sendingRequest, setSendingRequest] = useState(false);
  const [handlingRequestId, setHandlingRequestId] = useState<string | null>(null);

  // State for verification form
  const [verificationForm, setVerificationForm] = useState({
    reason: "",
    supporting_url: "",
  });

  // State for invite form
  const [inviteForm, setInviteForm] = useState({
    invitee_id: "",
    message: "",
  });

  // State for member management
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  // Handle verification submission
  async function handleVerificationSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (!user?.uid) throw new Error("Not authenticated");
      await addDoc(collection(db, "team_verifications"), {
        team_id: teamId,
        reason: verificationForm.reason,
        supporting_url: verificationForm.supporting_url || null,
        status: "pending",
        submitted_by: user.uid,
        created_at: new Date().toISOString(),
      });

      toast.success(t("teams.verification_submitted"));
      setVerificationForm({ reason: "", supporting_url: "" });
    } catch (error) {
      console.error(error);
      toast.error(t("common.error"));
    }
  }

  // Handle invite submission
  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (!user?.uid) throw new Error("Not authenticated");
      const idToken = await user.getIdToken();
      await addDoc(collection(db, "team_invites"), {
        team_id: teamId,
        invitee_id: inviteForm.invitee_id,
        invited_by: user.uid,
        message: inviteForm.message || null,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      // Notify the invited user
      try {
        await createNotification({
          data: {
            idToken,
            userId: inviteForm.invitee_id,
            type: "team_invite",
            title: t("notifications.team_invite"),
            message: `${t("notifications.team_invite_msg")} ${currentTeam?.name || ""}`,
            teamId,
            relatedUserId: user.uid,
          },
        });
      } catch {
        // Notification is best-effort
      }

      toast.success(t("teams.invite_sent"));
      setInviteForm({ invitee_id: "", message: "" });
    } catch (error) {
      console.error(error);
      toast.error(t("common.error"));
    }
  }

  // Handle member removal
  async function handleRemoveMember(memberId: string) {
    try {
      if (!user) throw new Error("Not authenticated");
      const idToken = await user.getIdToken();
      await removeTeamMemberFn({ data: { idToken, teamId, memberId } });

      toast.success(t("teams.member_removed"));
      setRemovingMemberId(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("common.error"));
    }
  }

  // Handle join request
  async function handleSendJoinRequest() {
    if (!user) {
      toast.error("Connecte-toi pour rejoindre une équipe");
      return;
    }
    setSendingRequest(true);
    try {
      const idToken = await user.getIdToken();
      await sendJoinRequestFn({ data: { idToken, teamId } });
      toast.success("Demande envoyée au capitaine !");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi de la demande");
    } finally {
      setSendingRequest(false);
    }
  }

  // Handle accept/reject join request
  async function handleRequestAction(requestUserId: string, action: "accept" | "reject") {
    if (!user) return;
    setHandlingRequestId(requestUserId);
    try {
      const idToken = await user.getIdToken();
      await handleJoinRequestFn({ data: { idToken, teamId, userId: requestUserId, action } });
      toast.success(action === "accept" ? "Membre ajouté !" : "Demande refusée");
      setHandlingRequestId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setHandlingRequestId(null);
    }
  }

  if (teamLoading || membersLoading || invitesLoading || verificationsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-black">Équipe</h1>
          <p className="mt-2 text-muted-foreground">Chargement des données de l'équipe...</p>
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

  if (!currentTeam) {
    if (teamLoading) return <></>;
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Shield className="h-12 w-12 text-destructive mb-4" />
        <h2 className="font-display text-xl font-bold text-destructive">
          {teamError ? "Erreur de chargement" : "Équipe introuvable"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {teamError
            ? "Impossible de charger les données de l'équipe"
            : "Impossible de trouver cette équipe"}
        </p>
        <Button asChild className="mt-4">
          <Link to="/teams">Retour aux équipes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black">{currentTeam.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {isCaptain
            ? "Gère ton équipe Free Fire et développe ta communauté"
            : "Découvre cette équipe Free Fire"}
        </p>
      </div>

      {/* Team Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-lg bg-sunset shadow-glow-sm overflow-hidden">
                {currentTeam.logo_url ? (
                  <img
                    src={currentTeam.logo_url}
                    alt="Logo équipe"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Shield className="h-8 w-8 text-white" />
                )}
              </div>
              <div>
                <h2 className="font-display text-xl font-black">{currentTeam.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium">{currentTeam.tag}</span>
                  {currentTeam.is_verified && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Verified className="h-3 w-3" />
                      Vérifiée
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {isCaptain && (
                <Button variant="outline" size="sm">
                  Modifier
                </Button>
              )}
              {user && !isCaptain && !isMember && (
                <Button size="sm" onClick={handleSendJoinRequest} disabled={sendingRequest}>
                  <UserPlus className="h-4 w-4 mr-1" />
                  {sendingRequest ? "Envoi..." : "Demander à rejoindre"}
                </Button>
              )}
              {isMember && (
                <span className="flex items-center gap-1 text-sm text-green-400 font-medium">
                  <Check className="h-4 w-4" /> Membre
                </span>
              )}
              <Button size="sm">Partager</Button>
            </div>
          </div>

          <CardDescription className="mt-4">
            {currentTeam.description || "Pas de description pour cette équipe."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {currentTeam.region?.replace("_", " ") ?? "Non spécifié"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{currentTeam.country || "Non spécifié"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {currentTeam.wins} victoires • {currentTeam.losses} défaites
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">{members?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Membres</div>
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
                  {(() => {
                    const d = currentTeam.created_at as unknown;
                    const date =
                      d && typeof (d as Record<string, unknown>).toDate === "function"
                        ? (d as { toDate: () => Date }).toDate()
                        : new Date(d as string);
                    return isNaN(date.getTime()) ? "-" : date.getFullYear();
                  })()}
                </div>
                <div className="text-xs text-muted-foreground">Créée en</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-2xl font-black">{currentTeam.elo}</div>
                <div className="text-xs text-muted-foreground">ELO</div>
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
                  {currentTeam.is_recruiting ? "Oui" : "Non"}
                </div>
                <div className="text-xs text-muted-foreground">Recrute</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className={`grid w-full ${isCaptain ? "grid-cols-5" : "grid-cols-3"}`}>
          <TabsTrigger value="members">Membres</TabsTrigger>
          {isCaptain && <TabsTrigger value="invites">Invitations</TabsTrigger>}
          {isCaptain && (
            <TabsTrigger value="requests">
              Demandes ({joinRequests?.filter((r) => r.status === "pending").length ?? 0})
            </TabsTrigger>
          )}
          <TabsTrigger value="verifications">Vérification</TabsTrigger>
          {isCaptain && <TabsTrigger value="settings">Paramètres</TabsTrigger>}
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Membres de l'équipe</CardTitle>
              <CardDescription>Gère les membres de ton équipe</CardDescription>
            </CardHeader>

            <CardContent>
              {members && members.length > 0 ? (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.user?.avatar_url} />
                          <AvatarFallback>{member.user?.username?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {member.user?.display_name || member.user?.username}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {member.role?.replace("_", " ") ?? "membre"} •{" "}
                            {member.user?.region?.replace("_", " ") || "Région non définie"}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isCaptain && member.role !== "captain" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRemovingMemberId(member.id)}
                            disabled={removingMemberId === member.id}
                          >
                            {removingMemberId === member.id ? "Suppression..." : "Supprimer"}
                          </Button>
                        )}

                        {removingMemberId === member.id && (
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRemovingMemberId(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p>Aucun membre dans cette équipe</p>
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-medium mb-2">Ajouter un membre</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Invitez d'autres joueurs à rejoindre votre équipe
                </p>

                <div className="space-y-4">
                  {user && currentTeam?.captain_id === user.uid && (
                    <form onSubmit={handleInviteSubmit} className="space-y-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Entrer l'UID Firebase du joueur..."
                          value={inviteForm.invitee_id}
                          onChange={(e) =>
                            setInviteForm({ ...inviteForm, invitee_id: e.target.value })
                          }
                        />
                        <Button type="submit">Inviter</Button>
                      </div>
                      <Textarea
                        placeholder="Message personnalisé (optionnel)"
                        value={inviteForm.message}
                        onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                      />
                    </form>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isCaptain && (
          <TabsContent value="invites">
            <Card>
              <CardHeader>
                <CardTitle>Invitations envoyées</CardTitle>
                <CardDescription>
                  Les invitations que tu as envoyées à d'autres joueurs
                </CardDescription>
              </CardHeader>

              <CardContent>
                {invites && invites.length > 0 ? (
                  <div className="space-y-4">
                    {invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={invite.invitee?.avatar_url} />
                            <AvatarFallback>{invite.invitee?.username?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {invite.invitee?.display_name || invite.invitee?.username}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {invite.status} •{" "}
                              {(() => {
                                const d = invite.created_at as unknown;
                                const date =
                                  d && typeof (d as Record<string, unknown>).toDate === "function"
                                    ? (d as { toDate: () => Date }).toDate()
                                    : new Date(d as string);
                                return isNaN(date.getTime())
                                  ? "—"
                                  : date.toLocaleDateString("fr-FR");
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Badge
                            variant={
                              invite.status === "pending"
                                ? "default"
                                : invite.status === "accepted"
                                  ? "success"
                                  : "destructive"
                            }
                          >
                            {invite.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p>Aucune invitation envoyée</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isCaptain && (
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Demandes pour rejoindre</CardTitle>
                <CardDescription>Les joueurs qui veulent rejoindre ton équipe</CardDescription>
              </CardHeader>
              <CardContent>
                {!joinRequests ||
                joinRequests.filter((r) => r.status === "pending").length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p>Aucune demande en attente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {joinRequests
                      .filter((r) => r.status === "pending")
                      .map((req) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={req.user?.avatar_url} />
                              <AvatarFallback>{req.user?.username?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {req.user?.display_name || req.user?.username || "Inconnu"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Demande envoyée le{" "}
                                {(() => {
                                  const d = req.created_at as unknown;
                                  if (!d) return "—";
                                  const date =
                                    d && typeof (d as Record<string, unknown>).toDate === "function"
                                      ? (d as { toDate: () => Date }).toDate()
                                      : new Date(d as string);
                                  return isNaN(date.getTime())
                                    ? "—"
                                    : date.toLocaleDateString("fr-FR");
                                })()}
                              </div>
                              {req.message && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  Message : {req.message}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleRequestAction(req.user_id, "accept")}
                              disabled={handlingRequestId === req.user_id}
                            >
                              {handlingRequestId === req.user_id ? (
                                "..."
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                              Accepter
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRequestAction(req.user_id, "reject")}
                              disabled={handlingRequestId === req.user_id}
                            >
                              <X className="h-4 w-4" />
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
        )}

        <TabsContent value="verifications">
          <Card>
            <CardHeader>
              <CardTitle>Demande de vérification</CardTitle>
              <CardDescription>Obtiens le badge vérifié pour ton équipe</CardDescription>
            </CardHeader>

            <CardContent>
              {verifications && verifications.length > 0 ? (
                <div className="space-y-4">
                  {verifications.map((verification) => (
                    <div key={verification.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{verification.reason}</div>
                          <div className="text-sm text-muted-foreground">
                            {verification.status} •{" "}
                            {(() => {
                              const d = verification.created_at as unknown;
                              const date =
                                d && typeof (d as Record<string, unknown>).toDate === "function"
                                  ? (d as { toDate: () => Date }).toDate()
                                  : new Date(d as string);
                              return isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
                            })()}
                          </div>
                        </div>
                        <Badge
                          variant={
                            verification.status === "pending"
                              ? "default"
                              : verification.status === "approved"
                                ? "success"
                                : "destructive"
                          }
                        >
                          {verification.status}
                        </Badge>
                      </div>
                      {verification.supporting_url && (
                        <div className="mt-2 text-sm">
                          <a
                            href={verification.supporting_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            {verification.supporting_url}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p>Aucune demande de vérification</p>
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-medium mb-2">Soumettre une demande</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Pour obtenir le badge vérifié, fournissez une preuve de votre équipe
                </p>

                <form onSubmit={handleVerificationSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="reason">Raison de la demande</Label>
                    <Select
                      value={verificationForm.reason}
                      onValueChange={(value) =>
                        setVerificationForm({ ...verificationForm, reason: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionne une raison" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="official_team">Équipe officielle</SelectItem>
                        <SelectItem value="tournament_participation">
                          Participation à des tournois
                        </SelectItem>
                        <SelectItem value="social_media">
                          Présence sur les réseaux sociaux
                        </SelectItem>
                        <SelectItem value="streaming">Activité de streaming</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="supporting_url">Lien de preuve (optionnel)</Label>
                    <Input
                      id="supporting_url"
                      placeholder="https://example.com"
                      value={verificationForm.supporting_url}
                      onChange={(e) =>
                        setVerificationForm({ ...verificationForm, supporting_url: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Fournissez un lien vers une preuve vérifiable (site web, réseaux sociaux,
                      etc.)
                    </p>
                  </div>

                  <div className="flex items-start gap-2">
                    <input type="checkbox" id="terms" required className="mt-1" />
                    <label htmlFor="terms" className="text-sm text-muted-foreground">
                      J'accepte que FireArena puisse vérifier les informations fournies et que le
                      processus de vérification peut prendre jusqu'à 7 jours.
                    </label>
                  </div>

                  <Button type="submit" className="w-full">
                    Soumettre la demande
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isCaptain && (
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de l'équipe</CardTitle>
                <CardDescription>Gère les paramètres de ton équipe</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Statut de recrutement</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant={currentTeam.is_recruiting ? "default" : "outline"} size="sm">
                        Actif
                      </Button>
                      <Button
                        variant={!currentTeam.is_recruiting ? "default" : "outline"}
                        size="sm"
                      >
                        Inactif
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Statut de désactivation</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Button variant={!currentTeam.is_disbanded ? "default" : "outline"} size="sm">
                        Actif
                      </Button>
                      <Button variant={currentTeam.is_disbanded ? "default" : "outline"} size="sm">
                        Désactivé
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Décris ton équipe..."
                      defaultValue={currentTeam.description || ""}
                    />
                  </div>

                  <Button className="w-full">Enregistrer les modifications</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
