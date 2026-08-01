import { cn } from "@/lib/utils";

export function PxpCoin({ className }: { className?: string }) {
  return (
    <img src="/pxp-coin.png" alt="PXP" className={cn("inline-block object-contain", className)} />
  );
}
