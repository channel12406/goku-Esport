import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Home, Trophy, Newspaper, ShieldCheck, User, Dices } from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import { useAdminStatus } from "@/lib/queries";

export function SiteSidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: isAdmin } = useAdminStatus();

  const mainNav = [
    { to: "/", label: t("nav.home"), icon: Home },
    { to: "/lucky", label: t("nav.lucky_pxp"), icon: Dices },
    { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
    { to: "/news", label: t("nav.news"), icon: Newspaper },
    { to: "/dashboard/profile", label: t("nav.profile"), icon: User },
  ] as const;

  return (
    <aside className="hidden w-[240px] shrink-0 lg:block">
      <nav className="sticky top-[118px] max-h-[calc(100vh-140px)] overflow-y-auto pb-8">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/30">
          Navigation
        </p>
        <ul className="space-y-1">
          {mainNav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                activeProps={{ className: "bg-white/5 text-white" }}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/5 bg-white/5 text-white/60 transition-colors group-hover:border-[#fc0]/30 group-hover:text-[#ffd740]">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/admin";
                }}
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#fc0]/30 bg-[#fc0]/10 text-[#ffd740]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                {t("nav.admin")}
              </button>
            </li>
          )}
        </ul>

        <div className="mt-6 hidden rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-4 lg:block">
          <p className="font-display text-sm font-bold text-white">FireArena</p>
          <p className="mt-1 text-xs text-white/40">{t("footer.tagline")}</p>
        </div>
      </nav>
    </aside>
  );
}
