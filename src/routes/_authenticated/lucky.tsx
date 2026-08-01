import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { toast } from "sonner";
import { Loader2, RotateCw } from "lucide-react";
import { useAuth } from "@/lib/firebase-auth-context";
import { useUserProfile } from "@/lib/queries";
import { spinLuckyWheel } from "@/server-functions/spin-lucky-wheel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PxpCoin } from "@/components/pxp-coin";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/lucky")({
  component: LuckyPage,
});

const SEGMENTS = [
  { value: 2, label: "2", color: "#5c4a10" },
  { value: 4, label: "4", color: "#8a6d1f" },
  { value: 6, label: "6", color: "#5c4a10" },
  { value: 10, label: "10", color: "#8a6d1f" },
  { value: 50, label: "50", color: "#b8860b" },
  { value: 100, label: "100", color: "#e8b423" },
  { value: 200, label: "200", color: "#ffd740" },
  { value: 500, label: "500", color: "#ffd740" },
] as const;

const SEGMENT_ANGLE = 360 / SEGMENTS.length;
const SPIN_COST = 10;

function LuckyPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useUserProfile();
  const controls = useAnimationControls();
  const rotationRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ win: number; cost: number; net: number } | null>(null);

  const pxp = profile?.pxp ?? 0;

  async function handleSpin() {
    if (!user) return;
    if (spinning) return;

    setSpinning(true);
    setResult(null);

    try {
      const idToken = await user.getIdToken();
      const result = await spinLuckyWheel({ data: { idToken } });
      setResult(result);

      // Winning index in the SEGMENTS array (aligned with server order)
      const winIndex = SEGMENTS.findIndex((s) => s.value === result.win);
      const index = winIndex === -1 ? 0 : winIndex;

      // Le centre du segment gagnant (index*angle + angle/2, sens horaire depuis
      // 12h) doit finir sous le pointeur (0° monde) : rotation finale ≡ 360 - centre.
      const center = index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2;
      const landing = (((360 - center) % 360) + 360) % 360;

      // Rotation cumulée : la cible avance toujours (≥ 6 tours + au moins 1°),
      // sinon une cible absolue identique ne déclencherait aucune animation.
      const currentMod = ((rotationRef.current % 360) + 360) % 360;
      const adjust = ((landing - currentMod + 359) % 360) + 1;
      const target = rotationRef.current + 360 * 6 + adjust;
      rotationRef.current = target;

      await controls.start({
        rotate: target,
        transition: { duration: 4, ease: [0.1, 0.7, 0.2, 1] },
      });

      queryClient.invalidateQueries({ queryKey: ["profile", user.uid] });

      if (result.win > 0) {
        toast.success(`${t("lucky.win_amount")} +${result.win} PXP`);
      } else {
        toast.info(t("lucky.lose_amount"));
      }
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSpinning(false);
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <RotateCw className="h-12 w-12 text-white/20" />
        <p className="mt-4 text-white/60">{t("lucky.not_authenticated")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lucky PXP"
        title={t("lucky.title")}
        subtitle={t("lucky.subtitle")}
        center
      />

      {/* Balance */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 rounded-full border border-[#fc0]/30 bg-[#fc0]/10 px-4 py-2">
          <PxpCoin className="h-5 w-5" />
          <span className="text-sm text-white/60">{t("lucky.balance")} :</span>
          <span className="font-display text-lg font-black text-[#ffd740]">
            {pxp.toLocaleString("fr-FR")}
          </span>
        </div>
      </div>

      {/* Wheel */}
      <div className="relative mx-auto flex h-[300px] w-[300px] items-center justify-center sm:h-[360px] sm:w-[360px]">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 z-20 -translate-x-1/2">
          <svg
            width="28"
            height="40"
            viewBox="0 0 28 40"
            className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
          >
            <polygon points="14,40 0,0 28,0" fill="#fc0" />
          </svg>
        </div>

        <motion.div
          animate={controls}
          className="relative h-full w-full rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #5c4a10, #8a6d1f, #5c4a10, #8a6d1f, #b8860b, #e8b423, #ffd740, #ffd740)",
          }}
        >
          {SEGMENTS.map((seg, i) => {
            const start = i * SEGMENT_ANGLE;
            const mid = start + SEGMENT_ANGLE / 2;
            return (
              <div key={i} className="absolute inset-0">
                {/* Label */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ transform: `rotate(${mid}deg)` }}
                >
                  <span
                    className="mt-[-96px] sm:mt-[-118px] font-display text-sm font-black text-white sm:text-base"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                  >
                    {seg.value > 0 ? `${seg.value}` : "0"}
                  </span>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Center hub */}
        <div className="absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white/20 bg-[#151617]">
          <PxpCoin className="h-7 w-7" />
        </div>
      </div>

      {/* Spin button */}
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          disabled={spinning || pxp < SPIN_COST}
          onClick={handleSpin}
          className="bg-gradient-to-br from-[#fc0] to-[#ffd740] font-bold text-white shadow-[0_0_30px_-6px_rgba(255,204,0,0.5)] hover:opacity-90"
        >
          {spinning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("lucky.spinning")}
            </>
          ) : (
            <>
              <RotateCw className="mr-2 h-4 w-4" />
              {t("lucky.spin")}
            </>
          )}
        </Button>
        <p className="text-xs text-white/40">{t("lucky.cost")}</p>
      </div>

      {/* Result overlay */}
      {result && (
        <div className="flex justify-center">
          <div className="w-full max-w-md rounded-xl border border-[#fc0]/30 bg-gradient-to-br from-[#1e1f21] to-[#151617] p-6 text-center">
            {result.win > 0 ? (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#fc0]/20">
                  <PxpCoin className="h-8 w-8" />
                </div>
                <h3 className="mt-4 font-display text-xl font-black text-white">
                  {t("lucky.win_title")}
                </h3>
                <p className="mt-1 text-sm text-white/50">{t("lucky.win_amount")}</p>
                <p className="mt-1 font-display text-3xl font-black text-[#ffd740]">
                  +{result.win.toLocaleString("fr-FR")} PXP
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/5">
                  <RotateCw className="h-7 w-7 text-white/30" />
                </div>
                <h3 className="mt-4 font-display text-xl font-black text-white">
                  {t("lucky.lose_title")}
                </h3>
                <p className="mt-1 text-sm text-white/50">{t("lucky.lose_amount")}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
