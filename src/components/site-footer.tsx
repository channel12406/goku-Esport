import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Flame, HeadsetIcon, Mail } from "lucide-react";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-white/10 bg-[#151617] pb-16 lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#fc0] to-[#ffd740] shadow-[0_0_12px_-2px_rgba(255,204,0,0.55)]">
              <Flame className="h-4 w-4 text-white" />
            </span>
            <span className="font-display text-base font-bold text-white">
              Fire
              <span className="bg-gradient-to-br from-[#fc0] to-[#ffd740] bg-clip-text text-transparent">
                Arena
              </span>
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-white/40">{t("footer.tagline")}</p>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold text-white/70">
            {t("footer.product")}
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-white/40">
            <li>
              <Link to="/tournaments" className="transition-colors hover:text-white">
                {t("nav.tournaments")}
              </Link>
            </li>
            <li>
              <Link to="/teams" className="transition-colors hover:text-white">
                {t("nav.teams")}
              </Link>
            </li>
            <li>
              <Link to="/leaderboard" className="transition-colors hover:text-white">
                {t("nav.leaderboard")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold text-white/70">
            {t("footer.community")}
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-white/40">
            <li>
              <Link to="/news" className="transition-colors hover:text-white">
                {t("nav.news")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold text-white/70">Support</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/40">
            <li className="flex items-center gap-2">
              <HeadsetIcon className="h-3.5 w-3.5" />
              24/7 Assistance
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" />
              support@firearena.gg
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} FireArena. {t("footer.rights")}
          </p>
          <p className="max-w-md text-right">{t("footer.disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
