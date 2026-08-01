import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Trophy, Calendar, Clock, Flame } from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import { useUserCanCreateTournaments, useMyCreatorRequest } from "@/lib/queries";
import { createTournament } from "@/server-functions/create-tournament";
import { requestCreatorStatus } from "@/server-functions/request-creator-status";
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

const participationModes = ["solo", "duo", "squad"] as const;
const gameModes = [
  "br_solo",
  "clash_squad",
  "br_squad",
  "br_duo",
  "goku_esport",
  "room_custom",
] as const;

const participationModeLabels: Record<string, string> = {
  solo: "Solo",
  duo: "Duo",
  squad: "Squad",
};

const gameModeLabels: Record<string, string> = {
  br_solo: "Battle Royale Solo",
  clash_squad: "Clash Squad",
  br_squad: "Battle Royale Squad",
  br_duo: "Battle Royale Duo",
  goku_esport: "Carte Goku Esport",
  room_custom: "Room personnalisée one tap",
};

const teamSizeMap: Record<string, number> = { solo: 1, duo: 2, squad: 4 };

const tournamentSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  game_mode: z.enum(gameModes),
  participation_mode: z.enum(participationModes),
  bracket_type: z.enum(["single_elim", "double_elim", "round_robin", "points_bo_multi", "swiss"]),
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
  max_participants: z.number().min(1).max(256),
  entry_fee_pxp: z.number().min(0),
  prize_pool_pxp: z.number().min(0),
  starts_at: z.string(),
  registration_opens_at: z.string().optional(),
  registration_closes_at: z.string().optional(),
});

export const Route = createFileRoute("/tournaments/create")({
  head: () => ({
    meta: [
      { title: "Créer un tournoi — FireArena" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Créer un tournoi — FireArena" },
      { property: "og:description", content: "Crée ton propre tournoi Free Fire sur FireArena." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TournamentCreatePage,
});

function TournamentCreatePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreate = useUserCanCreateTournaments();
  const { data: creatorRequest, refetch: refetchCreatorRequest } = useMyCreatorRequest();
  const [requestingCreator, setRequestingCreator] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    game_mode: "br_solo" as (typeof gameModes)[number],
    participation_mode: "solo" as (typeof participationModes)[number],
    bracket_type: "single_elim" as
      "single_elim" | "double_elim" | "round_robin" | "points_bo_multi" | "swiss",
    region: "africa_west" as
      | "africa_west"
      | "africa_north"
      | "africa_central"
      | "africa_east"
      | "africa_south"
      | "europe"
      | "americas"
      | "asia"
      | "oceania"
      | "other",
    max_participants: 32,
    entry_fee_pxp: 0,
    prize_pool_pxp: 0,
    starts_at: "",
    registration_opens_at: "",
    registration_closes_at: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const parsed = tournamentSchema.safeParse(formData);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Données invalides");
        return;
      }

      const { entry_fee_pxp: fee, prize_pool_pxp: prize, max_participants: max } = parsed.data;
      if (!Number.isInteger(fee) || fee < 0 || fee > 2000) {
        toast.error("Frais d'inscription invalides (0 à 2000 PXP)");
        return;
      }
      if (!Number.isInteger(prize) || prize < 0 || prize > 50000) {
        toast.error("Cagnotte invalide (0 à 50000 PXP)");
        return;
      }
      if (prize > 0 && fee <= 0) {
        toast.error("Une cagnotte requiert des frais d'inscription.");
        return;
      }
      if (prize > fee * max) {
        toast.error("La cagnotte ne peut pas dépasser le total des frais d'inscription.");
        return;
      }

      if (!user?.uid) throw new Error("Not authenticated");

      const pm = parsed.data.participation_mode;
      const idToken = await user.getIdToken();
      const result = await createTournament({
        data: {
          idToken,
          name: parsed.data.name,
          description: parsed.data.description,
          game_mode: parsed.data.game_mode,
          participation_mode: pm,
          bracket_type: parsed.data.bracket_type,
          region: parsed.data.region,
          is_team_based: pm !== "solo",
          team_size: teamSizeMap[pm],
          max_teams: parsed.data.max_participants,
          entry_fee_pxp: parsed.data.entry_fee_pxp,
          prize_pool_pxp: parsed.data.prize_pool_pxp,
          starts_at: parsed.data.starts_at,
          registration_opens_at: parsed.data.registration_opens_at,
          registration_closes_at: parsed.data.registration_closes_at,
        },
      });

      toast.success(t("tournaments.created_successfully"));

      window.location.href = `/tournaments/${result.tournamentId}`;
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black">Créer un tournoi</h1>
        <p className="mt-2 text-muted-foreground">
          Crée ton propre tournoi Free Fire et organise la compétition
        </p>
      </div>

      {!canCreate && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-semibold">Accès créateur requis</p>
          <p className="mt-1 text-amber-200/70">
            Seuls les créateurs vérifiés par l'administrateur peuvent créer des tournois. Envoie une
            demande, l'administrateur la traitera dans son panel.
          </p>
          <div className="mt-3">
            {creatorRequest?.status === "pending" ? (
              <div className="inline-flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
                <Clock className="h-3.5 w-3.5" />
                Demande envoyée — en attente de validation
              </div>
            ) : creatorRequest?.status === "rejected" ? (
              <div className="inline-flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">
                <Calendar className="h-3.5 w-3.5" />
                Demande refusée — tu peux renvoyer une demande
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={requestingCreator}
                onClick={async () => {
                  if (!user?.uid) {
                    toast.error("Connecte-toi d'abord pour envoyer une demande");
                    navigate({ to: "/auth", search: { mode: "signin" } });
                    return;
                  }
                  setRequestingCreator(true);
                  try {
                    const idToken = await user.getIdToken();
                    await requestCreatorStatus({ data: { idToken } });
                    toast.success("Demande envoyée à l'admin ✓");
                    refetchCreatorRequest();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi");
                  } finally {
                    setRequestingCreator(false);
                  }
                }}
              >
                {requestingCreator ? "Envoi..." : "Demander le statut créateur"}
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Informations du tournoi</CardTitle>
          <CardDescription>Remplis les détails de ton tournoi</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Nom du tournoi</Label>
              <Input
                id="name"
                placeholder="Ex: FireArena Cup"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                minLength={3}
                maxLength={100}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Décris ton tournoi, les règles, le format..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                maxLength={1000}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="game_mode">Mode de jeu</Label>
                <Select
                  value={formData.game_mode}
                  onValueChange={(value) =>
                    setFormData({ ...formData, game_mode: value as (typeof gameModes)[number] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionne un mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {gameModes.map((gm) => (
                      <SelectItem key={gm} value={gm}>
                        {gameModeLabels[gm]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="participation_mode">Mode de participation</Label>
                <Select
                  value={formData.participation_mode}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      participation_mode: value as (typeof participationModes)[number],
                      max_participants: value === "squad" ? 16 : value === "duo" ? 24 : 48,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionne le mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {participationModes.map((pm) => (
                      <SelectItem key={pm} value={pm}>
                        {participationModeLabels[pm]}
                        {pm !== "solo" && " (inscription chef d'équipe)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="bracket_type">Type de bracket</Label>
                <Select
                  value={formData.bracket_type}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      bracket_type: value as z.infer<typeof tournamentSchema>["bracket_type"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionne un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_elim">Élimination simple</SelectItem>
                    <SelectItem value="double_elim">Élimination double</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                    <SelectItem value="points_bo_multi">Points BO Multi</SelectItem>
                    <SelectItem value="swiss">Suisse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="region">Région</Label>
                <Select
                  value={formData.region}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      region: value as z.infer<typeof tournamentSchema>["region"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionne une région" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="africa_west">Afrique de l'Ouest</SelectItem>
                    <SelectItem value="africa_north">Afrique du Nord</SelectItem>
                    <SelectItem value="africa_central">Afrique Centrale</SelectItem>
                    <SelectItem value="africa_east">Afrique de l'Est</SelectItem>
                    <SelectItem value="africa_south">Afrique du Sud</SelectItem>
                    <SelectItem value="europe">Europe</SelectItem>
                    <SelectItem value="americas">Amériques</SelectItem>
                    <SelectItem value="asia">Asie</SelectItem>
                    <SelectItem value="oceania">Océanie</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="starts_at">Date de début</Label>
                <Input
                  id="starts_at"
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="registration_opens_at">Inscriptions ouvertes</Label>
                <Input
                  id="registration_opens_at"
                  type="datetime-local"
                  value={formData.registration_opens_at}
                  onChange={(e) =>
                    setFormData({ ...formData, registration_opens_at: e.target.value })
                  }
                />
              </div>

              <div>
                <Label htmlFor="registration_closes_at">Inscriptions fermées</Label>
                <Input
                  id="registration_closes_at"
                  type="datetime-local"
                  value={formData.registration_closes_at}
                  onChange={(e) =>
                    setFormData({ ...formData, registration_closes_at: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="max_participants">
                  {formData.participation_mode === "solo" ? "Joueurs max" : "Équipes max"}
                </Label>
                <Input
                  id="max_participants"
                  type="number"
                  min="1"
                  max="256"
                  value={formData.max_participants}
                  onChange={(e) =>
                    setFormData({ ...formData, max_participants: parseInt(e.target.value) || 1 })
                  }
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {formData.participation_mode === "solo"
                    ? "Nombre de joueurs"
                    : `Nombre d'équipes (${teamSizeMap[formData.participation_mode]} joueurs par équipe)`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="entry_fee_pxp">Frais d'inscription (PXP)</Label>
                <Input
                  id="entry_fee_pxp"
                  type="number"
                  min="0"
                  value={formData.entry_fee_pxp}
                  onChange={(e) =>
                    setFormData({ ...formData, entry_fee_pxp: parseInt(e.target.value) || 0 })
                  }
                />
              </div>

              <div>
                <Label htmlFor="prize_pool_pxp">Cagnotte (PXP)</Label>
                <Input
                  id="prize_pool_pxp"
                  type="number"
                  min="0"
                  value={formData.prize_pool_pxp}
                  onChange={(e) =>
                    setFormData({ ...formData, prize_pool_pxp: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !canCreate}
                className="bg-sunset text-white shadow-glow-sm hover:opacity-90"
              >
                {isSubmitting ? t("common.creating") : t("tournaments.create_tournament")}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/tournaments">Annuler</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pourquoi créer un tournoi ?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset mt-0.5">
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Organise ta communauté</h3>
                <p className="text-sm text-muted-foreground">
                  Crée des événements pour rassembler les joueurs de ta région
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset mt-0.5">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Calendrier officiel</h3>
                <p className="text-sm text-muted-foreground">
                  Ajoute ton tournoi au calendrier officiel de FireArena
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset mt-0.5">
                <Flame className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Récompenses PXP</h3>
                <p className="text-sm text-muted-foreground">
                  Offre des récompenses PXP aux participants et gagnants
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
