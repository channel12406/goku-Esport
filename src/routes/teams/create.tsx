import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Shield, Users, Calendar } from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import { createTeam } from "@/server-functions/create-team";
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

export const Route = createFileRoute("/teams/create")({
  head: () => ({
    meta: [
      { title: "Créer une équipe — FireArena" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Créer une équipe — FireArena" },
      { property: "og:description", content: "Crée ton équipe Free Fire sur FireArena." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TeamCreatePage,
});

function TeamCreatePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [userTeam, setUserTeam] = useState<{ id: string; name?: string } | null | "loading">(
    "loading",
  );

  useEffect(() => {
    if (!user) {
      setUserTeam(null);
      return;
    }
    (async () => {
      try {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/integrations/firebase/config");

        const capSnap = await getDocs(
          query(collection(db, "teams"), where("captain_id", "==", user.uid)),
        );
        if (!capSnap.empty) {
          const d = capSnap.docs[0].data();
          setUserTeam({ id: capSnap.docs[0].id, name: d.name });
          return;
        }

        const memSnap = await getDocs(
          query(collection(db, "team_members"), where("user_id", "==", user.uid)),
        );
        if (!memSnap.empty) {
          const teamId = memSnap.docs[0].data().team_id;
          const { getDoc, doc } = await import("firebase/firestore");
          const teamSnap = await getDoc(doc(db, "teams", teamId));
          setUserTeam({ id: teamId, name: teamSnap.data()?.name });
          return;
        }

        setUserTeam(null);
      } catch {
        setUserTeam(null);
      }
    })();
  }, [user]);

  const [formData, setFormData] = useState({
    name: "",
    tag: "",
    description: "",
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
    country: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const parsed = teamSchema.safeParse(formData);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? "Données invalides");
        return;
      }

      if (!user?.uid) throw new Error("Not authenticated");

      const idToken = await user.getIdToken();
      const result = await createTeam({
        data: {
          idToken,
          name: parsed.data.name,
          tag: parsed.data.tag,
          description: parsed.data.description,
          region: parsed.data.region,
          country: parsed.data.country,
        },
      });

      toast.success(t("teams.created_successfully"));

      window.location.href = `/teams/${result.teamId}`;
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
        <h1 className="font-display text-3xl font-black">Créer une équipe</h1>
        <p className="mt-2 text-muted-foreground">
          Crée ta propre équipe Free Fire et commence à recruter des joueurs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l'équipe</CardTitle>
          <CardDescription>Remplis les détails de ton équipe</CardDescription>
        </CardHeader>

        <CardContent>
          {userTeam === "loading" ? (
            <div className="py-8 text-center text-muted-foreground">
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
          ) : userTeam ? (
            <div className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
              <p className="font-medium">Tu es déjà dans une équipe</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {userTeam.name
                  ? `Tu fais partie de ${userTeam.name}.`
                  : "Tu es déjà membre d'une équipe."}
              </p>
              <Button asChild>
                <Link to="/teams/$teamId" params={{ teamId: userTeam.id }}>
                  Voir mon équipe
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="name">Nom de l'équipe</Label>
                  <Input
                    id="name"
                    placeholder="Ex: FireChampions"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    minLength={3}
                    maxLength={50}
                  />
                </div>

                <div>
                  <Label htmlFor="tag">Tag d'équipe</Label>
                  <Input
                    id="tag"
                    placeholder="FC"
                    value={formData.tag}
                    onChange={(e) =>
                      setFormData({ ...formData, tag: e.target.value.toUpperCase() })
                    }
                    required
                    minLength={2}
                    maxLength={6}
                    pattern="[A-Z0-9]+"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Majuscules et chiffres uniquement (ex: FC, FIRE, GG)
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Parle-nous de ton équipe, de votre style de jeu..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="region">Région</Label>
                  <Select
                    value={formData.region}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        region: value as z.infer<typeof teamSchema>["region"],
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
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    placeholder="Nigeria, Sénégal, France..."
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    maxLength={50}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-sunset text-white shadow-glow-sm hover:opacity-90"
                >
                  {isSubmitting ? t("common.creating") : t("teams.create_team")}
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/teams">Annuler</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pourquoi créer une équipe ?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset mt-0.5">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Équipe vérifiée</h3>
                <p className="text-sm text-muted-foreground">
                  Obtiens le badge vérifié pour gagner en crédibilité
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset mt-0.5">
                <Users className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Recrutement organisé</h3>
                <p className="text-sm text-muted-foreground">
                  Gère facilement les membres et les invitations
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-sunset mt-0.5">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-medium">Tournois exclusifs</h3>
                <p className="text-sm text-muted-foreground">
                  Accès aux tournois réservés aux équipes vérifiées
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
