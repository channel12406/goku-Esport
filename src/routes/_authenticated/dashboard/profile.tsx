import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import {
  Flame,
  User,
  Trophy,
  Award,
  Edit3,
  Star,
  Shield,
  CheckCircle2,
  LayoutDashboard,
  Bell,
} from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import { useUserProfile, useLoginStreak } from "@/lib/queries";
import { DashboardOverview } from "@/components/dashboard-overview";
import { NotificationsPanel } from "@/components/notifications-panel";
import { updateProfile } from "@/server-functions/update-profile";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Minimum 3 caractères")
    .max(20, "Maximum 20 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
  display_name: z.string().max(50).optional(),
  bio: z.string().max(500).optional(),
  free_fire_id: z.string().max(20).optional(),
  region: z
    .enum([
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
    ])
    .optional(),
  country: z.string().max(50).optional(),
  language: z.enum(["fr", "en"]).optional(),
});

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

function getLevelProgress(pxp: number) {
  // Each level requires 500 * level PXP — simple formula
  const level = Math.floor(pxp / 500) + 1;
  const levelStart = (level - 1) * 500;
  const levelEnd = level * 500;
  const progress = ((pxp - levelStart) / (levelEnd - levelStart)) * 100;
  return { level, progress: Math.min(progress, 100), pxpToNext: levelEnd - pxp };
}

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  validateSearch: (s): { tab?: string } => ({ tab: (s.tab ?? "dashboard") as string }),
  head: () => ({
    meta: [
      { title: "Mon profil — FireArena" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Mon profil — FireArena" },
      { property: "og:description", content: "Ton profil personnel sur FireArena." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const defaultTab =
    search.tab === "dashboard"
      ? "dashboard"
      : search.tab === "notifications"
        ? "notifications"
        : "edit";
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);
  const { data: profile, isLoading: profileLoading, error: profileError } = useUserProfile();
  const { data: loginStreak, isLoading: streakLoading } = useLoginStreak();

  const [formData, setFormData] = useState({
    username: "",
    display_name: "",
    bio: "",
    free_fire_id: "",
    region: "africa_west",
    country: "",
    language: "fr",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pre-fill form when profile data loads
  useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || "",
        display_name: profile.display_name || "",
        bio: (profile.bio as string) || "",
        free_fire_id: (profile.free_fire_id as string) || "",
        region: (profile.region as string) || "africa_west",
        country: (profile.country as string) || "",
        language: (profile.language as string) || "fr",
      });
    }
  }, [profile]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsed = profileSchema.safeParse(formData);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Données invalides");
        return;
      }
      if (!user?.uid) throw new Error("Non authentifié");
      const idToken = await user.getIdToken();
      await updateProfile({
        data: {
          idToken,
          username: parsed.data.username,
          display_name: parsed.data.display_name,
          bio: parsed.data.bio,
          free_fire_id: parsed.data.free_fire_id,
          region: parsed.data.region,
          country: parsed.data.country,
          language: parsed.data.language,
        },
      });
      toast.success("Profil mis à jour avec succès !");
      navigate({ to: "/dashboard/profile" });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-xl font-black sm:text-2xl">Mon profil</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Chargement du profil...</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-3 space-y-3 sm:p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full sm:h-20 sm:w-20" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 sm:h-6 sm:w-36" />
              <Skeleton className="h-3.5 w-40 sm:h-4 sm:w-48" />
              <Skeleton className="h-3.5 w-24 sm:w-28" />
            </div>
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20 sm:h-3.5" />
              <Skeleton className="h-8 w-full sm:h-9" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <User className="h-10 w-10 text-destructive mb-3" />
        <h2 className="font-display text-lg font-bold text-destructive">Erreur de chargement</h2>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Impossible de charger les données du profil
        </p>
        <Button size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Réessayer
        </Button>
      </div>
    );
  }

  const pxp = profile?.pxp ?? 0;
  const { level, progress: lvlProgress, pxpToNext } = getLevelProgress(pxp);
  const currentStreak = loginStreak?.current_streak ?? 0;
  const displayName = profile?.display_name || profile?.username || "Joueur";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-display text-xl font-black sm:text-2xl">Mon profil</h1>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Gère ton identité Free Fire et tes préférences
        </p>
      </div>

      {/* Hero Card */}
      <div className="rounded-2xl border border-border/60 bg-card/60 overflow-hidden">
        {/* Banner */}
        <div className="h-14 bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 relative sm:h-20">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)",
            }}
          />
        </div>

        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          {/* Avatar row */}
          <div className="flex items-end justify-between -mt-8 mb-2 sm:-mt-10 sm:mb-3">
            <div>
              <Avatar className="h-16 w-16 ring-2 ring-background shadow-lg sm:h-20 sm:w-20">
                <AvatarImage src={profile?.avatar_url as string | undefined} />
                <AvatarFallback className="text-lg font-black bg-sunset text-white sm:text-2xl">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex items-center gap-1.5 mb-1 sm:gap-2">
              {Boolean(profile?.is_verified) && (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] px-1.5 py-0.5 sm:text-xs sm:px-2">
                  <Shield className="h-2.5 w-2.5 mr-1" /> Vérifié
                </Badge>
              )}
              {currentStreak >= 7 && (
                <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] px-1.5 py-0.5 sm:text-xs sm:px-2">
                  <Flame className="h-2.5 w-2.5 mr-1" /> {currentStreak}j streak
                </Badge>
              )}
            </div>
          </div>

          {/* Name & info */}
          <div className="mb-2">
            <h2 className="font-display text-lg font-black sm:text-xl">{displayName}</h2>
            <p className="text-muted-foreground text-[11px] sm:text-xs">
              @{profile?.username}
              {profile?.free_fire_id && (
                <span className="ml-2 text-orange-400">• FF: {profile.free_fire_id as string}</span>
              )}
            </p>
            {profile?.region && (
              <p className="text-[11px] text-muted-foreground mt-0.5 sm:text-xs">
                📍 {REGION_LABELS[profile.region as string] ?? profile.region}
                {profile?.country && ` — ${profile.country as string}`}
              </p>
            )}
            {String(profile?.fire_arena_id) && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2 py-0.5 sm:px-2.5 sm:py-1">
                <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                  ID FireArena:
                </span>
                <span className="text-[11px] font-mono font-bold text-primary sm:text-xs">
                  {profile?.fire_arena_id as string}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(profile?.fire_arena_id as string);
                    toast.success("ID copié !");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Copier l'ID"
                >
                  <CheckCircle2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Level progress */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] text-muted-foreground sm:text-[11px]">
              <span className="font-semibold text-foreground">Niveau {level}</span>
              <span>
                {pxpToNext} PXP pour niveau {level + 1}
              </span>
            </div>
            <Progress value={lvlProgress} className="h-1.5" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-3">
        {[
          {
            icon: Trophy,
            label: "PXP Total",
            value: pxp.toLocaleString("fr-FR"),
            color: "text-yellow-400",
          },
          { icon: Award, label: "Niveau", value: level.toString(), color: "text-blue-400" },
          { icon: Flame, label: "Streak", value: `${currentStreak}j`, color: "text-orange-400" },
          {
            icon: Star,
            label: "Réputation",
            value: (profile?.reputation ?? 0).toString(),
            color: "text-purple-400",
          },
        ].map(({ icon: Icon, label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-border/60 bg-card/60 p-2 text-center sm:p-3"
          >
            <Icon className={`h-4 w-4 mx-auto mb-0.5 sm:h-5 sm:w-5 sm:mb-1 ${color}`} />
            <div className="font-display text-base font-black sm:text-lg">{value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 sm:text-[11px]">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs: Dashboard + Notifications + Edit */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          navigate({ to: "/dashboard/profile", search: { tab: v } });
        }}
      >
        <TabsList className="w-full h-8 p-0.5">
          <TabsTrigger value="dashboard" className="flex-1 px-2 text-[11px] sm:text-xs">
            <LayoutDashboard className="h-3 w-3 mr-1 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-1 px-2 text-[11px] sm:text-xs">
            <Bell className="h-3 w-3 mr-1 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="edit" className="flex-1 px-2 text-[11px] sm:text-xs">
            <Edit3 className="h-3 w-3 mr-1 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
            Modifier
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <DashboardOverview />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-3 sm:p-4">
            <NotificationsPanel />
          </div>
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit">
          <div className="rounded-2xl border border-border/60 bg-card/60 p-3 sm:p-4">
            <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-4">
                <div>
                  <Label htmlFor="username" className="text-xs sm:text-sm">
                    Pseudo *
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    minLength={3}
                    maxLength={20}
                    placeholder="firechamp"
                    className="mt-1 h-8 text-sm sm:h-9"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    3-20 caractères, lettres/chiffres/_
                  </p>
                </div>

                <div>
                  <Label htmlFor="display_name" className="text-xs sm:text-sm">
                    Nom d'affichage
                  </Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    maxLength={50}
                    placeholder="FireChamp"
                    className="mt-1 h-8 text-sm sm:h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="free_fire_id" className="text-xs sm:text-sm">
                    ID Free Fire
                  </Label>
                  <Input
                    id="free_fire_id"
                    value={formData.free_fire_id}
                    onChange={(e) => setFormData({ ...formData, free_fire_id: e.target.value })}
                    maxLength={20}
                    placeholder="123456789"
                    className="mt-1 h-8 text-sm sm:h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="country" className="text-xs sm:text-sm">
                    Pays
                  </Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    maxLength={50}
                    placeholder="Nigeria, Sénégal, France..."
                    className="mt-1 h-8 text-sm sm:h-9"
                  />
                </div>

                <div>
                  <Label htmlFor="region" className="text-xs sm:text-sm">
                    Région
                  </Label>
                  <Select
                    value={formData.region}
                    onValueChange={(value) => setFormData({ ...formData, region: value })}
                  >
                    <SelectTrigger className="mt-1 h-8 text-sm sm:h-9">
                      <SelectValue placeholder="Sélectionne une région" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(REGION_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="language" className="text-xs sm:text-sm">
                    Langue
                  </Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value) => setFormData({ ...formData, language: value })}
                  >
                    <SelectTrigger className="mt-1 h-8 text-sm sm:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="bio" className="text-xs sm:text-sm">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  maxLength={500}
                  placeholder="Parle-nous de toi, de ton style de jeu, ta squad..."
                  rows={2}
                  className="mt-1 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formData.bio.length}/500
                </p>
              </div>

              {(profile?.profile_update_count as number) >= 1 && (
                <p className="text-xs text-amber-500">
                  Coût : 500 PXP (première modification gratuite)
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-sunset text-white shadow-glow-sm hover:opacity-90"
                >
                  {isSubmitting ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/dashboard/profile" search={{ tab: "dashboard" }}>
                    Annuler
                  </Link>
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
