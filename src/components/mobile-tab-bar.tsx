import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Home, Trophy, Newspaper, User, Dices } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileTabBar() {
  const { t } = useTranslation();

  const tabs = [
    { to: "/", label: t("nav.home"), icon: Home },
    { to: "/lucky", label: t("nav.lucky_pxp"), icon: Dices },
    { to: "/leaderboard", label: t("nav.leaderboard"), icon: Trophy },
    { to: "/news", label: t("nav.news"), icon: Newspaper },
    { to: "/dashboard/profile", label: t("nav.profile"), icon: User },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#151617]/95 backdrop-blur lg:hidden">
      <div className="flex items-stretch justify-around">
        {tabs.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-2 text-[10px] font-medium text-white/50 transition-colors hover:text-white",
            )}
            activeProps={{ className: "text-[#ffd740]" }}
          >
            <Icon className="h-5 w-5" />
            <span className="w-full truncate text-center">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
