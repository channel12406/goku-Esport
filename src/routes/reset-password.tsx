import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Flame, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import { verifyPasswordResetCode, updatePassword as firebaseUpdatePassword } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Réinitialiser le mot de passe — FireArena" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get("mode");
    const oobCode = urlParams.get("oobCode");

    if (mode === "resetPassword" && oobCode) {
      setIsRecovery(true);
      setOobCode(oobCode);
    }
  }, []);

  async function requestLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email") as string;
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success(t("auth.reset_sent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'envoi");
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password") as string;
    if (password.length < 6) {
      toast.error("Min 6 caractères");
      return;
    }
    if (!oobCode) {
      toast.error("Code de réinitialisation invalide");
      return;
    }
    setLoading(true);
    try {
      await verifyPasswordResetCode(auth, oobCode);
      await firebaseUpdatePassword(auth.currentUser!, password);
      toast.success(t("auth.password_updated"));
      window.location.href = "/dashboard/profile?tab=dashboard";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la mise à jour");
    } finally {
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

        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur-xl sm:p-8">
          <h1 className="font-display text-2xl font-black">{t("auth.reset_title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.reset_desc")}</p>

          {isRecovery ? (
            <form onSubmit={updatePassword} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password">{t("auth.new_password")}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-sunset text-white">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.update_password")}
              </Button>
            </form>
          ) : (
            <form onSubmit={requestLink} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-sunset text-white">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.reset_submit")}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm">
            <a href="/auth" className="text-primary hover:underline">
              ← {t("auth.sign_in")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
