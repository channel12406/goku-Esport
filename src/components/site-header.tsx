import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Flame, Globe, LogOut, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase-auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAdminStatus } from "@/lib/queries";

export function SiteHeader() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { data: isAdmin } = useAdminStatus();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-white/10 bg-[#151617] transition-all",
        scrolled && "shadow-lg shadow-black/30",
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo — left */}
        <Link to="/" className="group flex shrink-0 items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-[#fc0] to-[#ffd740] shadow-[0_0_12px_-2px_rgba(255,204,0,0.55)]">
            <Flame className="h-5 w-5 text-white" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Fire
            <span className="bg-gradient-to-br from-[#fc0] to-[#ffd740] bg-clip-text text-transparent">
              Arena
            </span>
          </span>
        </Link>

        {/* Right section — auth */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/60 hover:text-white"
                aria-label={t("common.language")}
              >
                <Globe className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => i18n.changeLanguage("fr")}>
                Français
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => i18n.changeLanguage("en")}>English</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden gap-2 text-white/60 hover:text-white sm:inline-flex"
                >
                  <User className="h-4 w-4" />
                  <span className="max-w-[100px] truncate">
                    {user.displayName || user.email?.split("@")[0]}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/profile">{t("nav.profile")}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/profile" search={{ tab: "notifications" }}>
                    {t("nav.notifications")}
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        window.location.href = "/admin";
                      }}
                    >
                      {t("nav.admin")}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.sign_out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }} className="hidden sm:inline-block">
                <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                  {t("nav.sign_in")}
                </Button>
              </Link>
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button
                  size="sm"
                  className="bg-gradient-to-br from-[#fc0] to-[#ffd740] text-white shadow-[0_0_20px_-4px_rgba(255,204,0,0.5)] hover:opacity-90"
                >
                  {t("nav.sign_up")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
