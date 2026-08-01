import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Swords,
  Calendar,
  Users,
  Sparkles,
  HeadsetIcon,
  Shield,
  ChevronRight,
  Gamepad2,
  UserPlus,
  Trophy,
  MousePointerClick,
  HandCoins,
} from "lucide-react";
import { useState, useEffect } from "react";
import { SiteLayout } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAllTournaments, useBanners, tsToMs } from "@/lib/queries";
import type { Banner } from "@/lib/queries";
import { autoOpenTournaments } from "@/server-functions/auto-open-tournaments";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FireArena — L'arène e-sport 100% Free Fire" },
      {
        name: "description",
        content:
          "Tournois Free Fire, classements en temps réel, ligues saisonnières et équipes vérifiées. Bâti pour la scène africaine, ouvert au monde.",
      },
      { property: "og:title", content: "FireArena — L'arène e-sport 100% Free Fire" },
      {
        property: "og:description",
        content: "Organise, joue et gagne. Tournois vérifiés, ligues, PXP.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "FireArena" },
    ],
  }),
  component: LandingPage,
});

const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  open: { label: "Ouvert", dot: "bg-green-400" },
  approved: { label: "Ouvert", dot: "bg-green-400" },
  registration_closed: { label: "Fermé", dot: "bg-yellow-400" },
  live: { label: "En cours", dot: "bg-red-400 animate-pulse" },
  completed: { label: "Terminé", dot: "bg-muted-foreground" },
};

const FORMAT_LABELS: Record<string, string> = {
  battle_royale: "Battle Royale",
  clash_squad: "Clash Squad",
  lone_wolf: "Lone Wolf",
  custom: "Personnalisé",
};

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(
      new Date(dateStr),
    );
  } catch {
    return dateStr;
  }
}

const FALLBACK_BANNERS = [
  {
    title: "Tournois Free Fire",
    subtitle: "Battle Royale, Clash Squad & plus",
    cta: "Voir les tournois",
    link: "/tournaments",
    image_url: "",
  },
  {
    title: "Classement Saison 1",
    subtitle: "Les meilleurs joueurs s'affrontent",
    cta: "Voir le classement",
    link: "/leaderboard",
    image_url: "",
  },
  {
    title: "Crée ton équipe",
    subtitle: "Invite tes coéquipiers et dominez",
    cta: "Créer une équipe",
    link: "/teams",
    image_url: "",
  },
];

function getBannerTo(banner: Banner | ((typeof FALLBACK_BANNERS)[0] & { id: string })): string {
  return banner.link && ["/tournaments", "/leaderboard", "/teams", "/news"].includes(banner.link)
    ? banner.link
    : "/tournaments";
}

function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bannerIndex, setBannerIndex] = useState(0);

  const { data: tournaments } = useAllTournaments();
  const { data: bannersData } = useBanners();

  // Bascule serveur des tournois approuvés (délai de 5 min écoulé) en "open".
  useEffect(() => {
    autoOpenTournaments({ data: {} }).catch(() => {
      /* idempotent — ignoré */
    });
  }, []);

  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const featured = (tournaments ?? [])
    .filter(
      (t) =>
        t.status === "open" ||
        t.status === "live" ||
        (t.status === "approved" &&
          tsToMs(t.approved_at) > 0 &&
          Date.now() - tsToMs(t.approved_at) >= FIVE_MINUTES_MS),
    )
    .slice(0, 4);

  const activeBanners =
    (bannersData ?? []).filter((b) => b.active !== false).length > 0
      ? (bannersData ?? []).filter((b) => b.active !== false)
      : FALLBACK_BANNERS.map((fb, i) => ({
          id: `fallback-${i}`,
          ...fb,
          active: true,
          order: i,
        }));

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % activeBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  const whyUs = [
    {
      icon: Shield,
      title: "100% Sécurisé",
      desc: "Transactions protégées et données chiffrées. Ta sécurité est notre priorité absolue.",
    },
    {
      icon: HeadsetIcon,
      title: "Support 24/7",
      desc: "Notre équipe est disponible à tout moment pour t'accompagner avant, pendant et après chaque tournoi.",
    },
    {
      icon: Sparkles,
      title: "Garantie Satisfaction",
      desc: "Tournois vérifiés par nos modérateurs. Résultats garantis et prize pools distribués sans faute.",
    },
  ] as const;

  const steps = [
    {
      icon: UserPlus,
      title: t("landing.how_it_works.step1_title"),
      desc: t("landing.how_it_works.step1_desc"),
    },
    {
      icon: MousePointerClick,
      title: t("landing.how_it_works.step2_title"),
      desc: t("landing.how_it_works.step2_desc"),
    },
    {
      icon: Trophy,
      title: t("landing.how_it_works.step3_title"),
      desc: t("landing.how_it_works.step3_desc"),
    },
    {
      icon: HandCoins,
      title: t("landing.how_it_works.step4_title"),
      desc: t("landing.how_it_works.step4_desc"),
    },
  ] as const;

  return (
    <SiteLayout>
      {/* ===== BANDE D'ANNONCE (image carousel) ===== */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10">
        {activeBanners.map((b, i) => (
          <Link
            key={b.id ?? i}
            to={getBannerTo(b)}
            className={`absolute inset-0 block transition-opacity duration-700 ${i === bannerIndex ? "opacity-100" : "opacity-0"}`}
          >
            {b.image_url ? (
              <img
                src={b.image_url}
                alt={b.title ?? "Bannière"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fc0]/25 via-[#1a1b1d] to-[#121314]">
                <div className="flex flex-col items-center gap-2">
                  <Gamepad2
                    className="h-12 w-12 text-[#fc0]/70 sm:h-14 sm:w-14"
                    strokeWidth={1.2}
                  />
                  <span className="font-display text-lg font-black text-white/80 sm:text-xl">
                    {b.title ?? "FireArena"}
                  </span>
                </div>
              </div>
            )}
          </Link>
        ))}

        {/* Height container */}
        <div className="relative h-36 sm:h-48 lg:h-56" />

        {/* Carousel dots */}
        {activeBanners.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5">
            {activeBanners.map((_, i) => (
              <button
                key={i}
                onClick={() => setBannerIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === bannerIndex ? "w-6 bg-[#fc0]" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ===== 4 TOURNOIS + VOIR PLUS ===== */}
      <section className="relative py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white sm:text-2xl">
              Tournois disponibles
            </h2>
            <Link
              to="/tournaments"
              className="flex items-center gap-1 text-xs text-[#ffd740] hover:text-[#fc0] transition-colors sm:text-sm"
            >
              Voir tout <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {featured.map((t) => {
              const cfg = STATUS_CONFIG[t.status ?? ""] ?? {
                label: t.status,
                dot: "bg-muted-foreground",
              };
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  onClick={() =>
                    navigate({ to: "/tournaments/$tournamentId", params: { tournamentId: t.id } })
                  }
                  className="group cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-[#1e1f21] transition-all hover:border-[#fc0]/40 hover:shadow-[0_0_24px_-8px_rgba(255,204,0,0.3)]"
                >
                  <div className="relative flex h-24 items-center justify-center bg-gradient-to-br from-[#fc0]/20 via-[#ffd740]/10 to-transparent sm:h-28">
                    <Swords className="h-8 w-8 text-white/20 sm:h-10 sm:w-10" />
                    <span className="absolute top-2 right-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
                    </span>
                    {t.prize_pool_pxp && Number(t.prize_pool_pxp) > 0 && (
                      <span className="absolute top-2 left-2 rounded bg-[#fc0]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#ffd740]">
                        {Number(t.prize_pool_pxp).toLocaleString()} PXP
                      </span>
                    )}
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="font-display text-xs font-bold text-white truncate sm:text-sm">
                      {t.name ?? "Tournoi"}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-white/50 sm:mt-3 sm:text-xs">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {t.max_participants ?? "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(t.starts_at)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 sm:mt-3">
                      <Badge
                        variant="outline"
                        className="border-white/10 text-[10px] text-white/50 px-1.5 py-0"
                      >
                        {FORMAT_LABELS[t.format ?? ""] ?? t.format}
                      </Badge>
                      {t.status === "live" && (
                        <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] px-1.5 py-0">
                          LIVE
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-6 text-center sm:mt-8">
            <Link to="/tournaments">
              <Button
                size="lg"
                className="border-[#fc0]/40 bg-transparent text-[#ffd740] hover:bg-[#fc0]/10 hover:text-[#fc0]"
              >
                Voir plus de tournois
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ===== POURQUOI CHOISIR ===== */}
      <section className="relative py-8 sm:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,#fc0/5,transparent_70%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-lg font-bold text-white sm:text-2xl">
              Pourquoi choisir FireArena ?
            </h2>
          </div>

          <div className="mt-6 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4">
            {whyUs.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-lg border border-white/10 bg-[#1e1f21] p-4 text-center sm:p-6"
              >
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#fc0]/20 sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5 text-[#ffd740] sm:h-6 sm:w-6" />
                </div>
                <h3 className="mt-3 font-display text-sm font-bold text-white sm:mt-4 sm:text-base">
                  {title}
                </h3>
                <p className="mt-1.5 text-xs text-white/50 sm:mt-2 sm:text-sm">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ÉTAPES POUR PARTICIPER ===== */}
      <section className="relative py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-lg font-bold text-white sm:text-2xl">
              Comment participer aux tournois ?
            </h2>
          </div>

          <div className="mt-6 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative rounded-lg border border-white/10 bg-[#1e1f21] p-4 sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fc0]/20 sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5 text-[#ffd740] sm:h-6 sm:w-6" />
                </div>
                <span className="absolute top-4 right-4 font-display text-2xl font-black text-white/10 sm:text-3xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-display text-sm font-bold text-white sm:mt-4 sm:text-base">
                  {title}
                </h3>
                <p className="mt-1.5 text-xs text-white/50 sm:mt-2 sm:text-sm">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
