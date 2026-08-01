import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { toast } from "sonner";
import { Flame, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Connexion — FireArena" },
      {
        name: "description",
        content:
          "Connecte-toi ou crée ton compte FireArena pour participer aux tournois Free Fire.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
const signUpSchema = signInSchema.extend({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et _ uniquement"),
});

function AuthPage() {
  const { t } = useTranslation();
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const isSignUp = mode === "signup";

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (user) {
      console.log("Utilisateur déjà connecté, redirection vers dashboard");
      navigate({ to: "/dashboard/profile", search: { tab: "dashboard" } });
    }
  }, [user, navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    try {
      if (isSignUp) {
        const parsed = signUpSchema.safeParse({
          email: form.get("email"),
          password: form.get("password"),
          username: form.get("username"),
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
          setLoading(false);
          return;
        }
        await signUp(parsed.data.email, parsed.data.password, parsed.data.username);
        toast.success("Compte créé !");
        navigate({ to: "/dashboard/profile", search: { tab: "dashboard" } });
      } else {
        const parsed = signInSchema.safeParse({
          email: form.get("email"),
          password: form.get("password"),
        });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
          setLoading(false);
          return;
        }
        await signIn(parsed.data.email, parsed.data.password);
        navigate({ to: "/dashboard/profile", search: { tab: "dashboard" } });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    setLoading(true);
    try {
      console.log("Tentative de connexion avec Google...");
      await signInWithGoogle();
      console.log("Connexion Google réussie");
      // Don't navigate manually - let the auth state change handle it
    } catch (error) {
      console.error("Erreur Google:", error);
      toast.error(error instanceof Error ? error.message : "Erreur avec Google");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 bg-ember-glow" />

      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-sunset shadow-glow-sm">
            <Flame className="h-5 w-5 text-white animate-flame-pulse" />
          </span>
          <span className="font-display text-xl font-bold">
            Fire<span className="text-sunset">Arena</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur-xl shadow-glow-sm sm:p-8">
          <h1 className="font-display text-2xl font-black">
            {isSignUp ? t("auth.create_account") : t("auth.welcome_back")}
          </h1>

          <Button
            onClick={() => {
              console.log("Bouton Google cliqué, loading:", loading);
              google();
            }}
            disabled={loading}
            variant="outline"
            className="mt-6 w-full"
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            {t("auth.google")}
          </Button>

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <span className="relative bg-card px-3 text-xs text-muted-foreground">
              {t("auth.or_continue_with")}
            </span>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <Label htmlFor="username">{t("auth.username")}</Label>
                <Input
                  id="username"
                  name="username"
                  required
                  minLength={3}
                  maxLength={20}
                  placeholder="firechamp"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.password")}</Label>
                {!isSignUp && (
                  <Link to="/reset-password" className="text-xs text-primary hover:underline">
                    {t("auth.forgot_password")}
                  </Link>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-sunset text-white shadow-glow-sm hover:opacity-90"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? t("auth.submit_signup") : t("auth.submit_signin")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? t("auth.have_account") : t("auth.no_account")}{" "}
            <Link
              to="/auth"
              search={{ mode: isSignUp ? "signin" : "signup" }}
              className="font-medium text-primary hover:underline"
            >
              {isSignUp ? t("auth.sign_in") : t("auth.sign_up")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
