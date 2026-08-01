import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Search,
  SendHorizonal,
  CheckCircle2,
  AlertCircle,
  User,
  ArrowRight,
  Clock,
  Copy,
  Info,
} from "lucide-react";
import { PxpCoin } from "@/components/pxp-coin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/firebase-auth-context";
import { useUserProfile, useProfileByFireArenaId, usePxpTransactions } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { transferPxp } from "@/server-functions/transfer-pxp";

export const Route = createFileRoute("/_authenticated/dashboard/transfer")({
  head: () => ({
    meta: [{ title: "Transfert PXP — FireArena" }, { name: "robots", content: "noindex" }],
  }),
  component: TransferPage,
});

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function TransferPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: myProfile, isLoading: profileLoading } = useUserProfile();
  const { data: transactions, isLoading: txLoading } = usePxpTransactions();

  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const debouncedId = useDebounce(recipientId, 500);

  const {
    data: recipientProfile,
    isLoading: recipientLoading,
    isFetching: recipientFetching,
  } = useProfileByFireArenaId(debouncedId);

  const myPxp = (myProfile as { pxp?: number } | undefined)?.pxp ?? 0;
  const myFireArenaId =
    (myProfile as { fire_arena_id?: string } | undefined)?.fire_arena_id ?? null;
  const parsedAmount = parseInt(amount);
  const canSend =
    recipientProfile &&
    recipientProfile.id !== user?.uid &&
    !isNaN(parsedAmount) &&
    parsedAmount >= 1 &&
    parsedAmount <= myPxp &&
    confirmed;

  async function handleTransfer() {
    if (!canSend || !user?.uid || !recipientProfile) return;
    setSending(true);
    try {
      const idToken = await user.getIdToken();

      await transferPxp({
        data: {
          idToken,
          recipientFireArenaId: recipientProfile.fire_arena_id as string,
          amount: parsedAmount,
          note,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["user-profile", user.uid] });
      queryClient.invalidateQueries({ queryKey: ["pxp-transactions", user.uid] });

      toast.success("Transfert effectué ✓", {
        description: `${parsedAmount.toLocaleString("fr-FR")} PXP envoyés à ${recipientProfile.username ?? recipientProfile.display_name ?? recipientProfile.fire_arena_id}.`,
      });

      setRecipientId("");
      setAmount("");
      setNote("");
      setConfirmed(false);
    } catch (e) {
      toast.error("Erreur lors du transfert", {
        description: e instanceof Error ? e.message : "Réessaie dans quelques instants.",
      });
    } finally {
      setSending(false);
    }
  }

  function copyId() {
    if (myFireArenaId) {
      navigator.clipboard.writeText(myFireArenaId);
      toast.success("ID copié !");
    }
  }

  const recipientName =
    recipientProfile?.username ??
    recipientProfile?.display_name ??
    (recipientProfile?.fire_arena_id as string | undefined) ??
    "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-black">
          <span className="text-sunset">Transfert PXP</span>
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Envoie des PXP à n'importe quel joueur FireArena via son ID unique.
        </p>
      </div>

      {/* My balance + ID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <p className="text-xs text-muted-foreground mb-1">Ton solde PXP</p>
          {profileLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <p className="text-2xl font-black text-yellow-400">
              <PxpCoin className="inline-block h-5 w-5 mr-1.5 align-text-bottom" />
              {myPxp.toLocaleString("fr-FR")} PXP
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <p className="text-xs text-muted-foreground mb-1">Ton ID FireArena</p>
          {profileLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : myFireArenaId ? (
            <div className="flex items-center gap-2">
              <p className="text-xl font-black font-mono text-primary">{myFireArenaId}</p>
              <button
                onClick={copyId}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Copier"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/60 italic">Non défini</p>
          )}
          <p className="text-xs text-muted-foreground/50 mt-0.5">
            Partage cet ID pour recevoir des PXP
          </p>
        </div>
      </div>

      {/* Transfer Form */}
      <div className="rounded-2xl border border-border/40 bg-card/50 p-6 space-y-5">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <SendHorizonal className="h-5 w-5 text-primary" />
          Envoyer des PXP
        </h2>

        {/* Recipient ID */}
        <div>
          <Label>ID FireArena du destinataire</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ex: FA-00123"
              value={recipientId}
              onChange={(e) => {
                setRecipientId(e.target.value);
                setConfirmed(false);
              }}
              className="pl-9 bg-card/60 border-border/40 font-mono"
            />
          </div>

          {/* Recipient preview */}
          <div className="mt-2 min-h-[40px]">
            {recipientLoading || recipientFetching ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Recherche...
              </div>
            ) : debouncedId && recipientProfile === null ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Aucun joueur trouvé avec cet ID.
              </div>
            ) : recipientProfile ? (
              recipientProfile.id === user?.uid ? (
                <div className="flex items-center gap-2 text-sm text-orange-400">
                  <AlertCircle className="h-4 w-4" />
                  Tu ne peux pas te transférer des PXP à toi-même.
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-2">
                  <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-black text-primary shrink-0">
                    {recipientName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{recipientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {recipientProfile.region ?? "—"}
                      {recipientProfile.team_name ? ` · ${recipientProfile.team_name}` : ""}
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-400 ml-auto shrink-0" />
                </div>
              )
            ) : null}
          </div>
        </div>

        {/* Amount */}
        <div>
          <Label>Montant à envoyer (PXP)</Label>
          <div className="relative mt-1">
            <PxpCoin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
            <Input
              type="number"
              min={1}
              max={myPxp}
              placeholder="ex: 200"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirmed(false);
              }}
              className="pl-9 bg-card/60 border-border/40"
            />
          </div>
          {!isNaN(parsedAmount) && parsedAmount > myPxp && (
            <p className="text-xs text-destructive mt-1">
              Solde insuffisant. Tu n'as que {myPxp.toLocaleString("fr-FR")} PXP.
            </p>
          )}
          {/* Quick amounts */}
          <div className="flex flex-wrap gap-2 mt-2">
            {[50, 100, 200, 500, 1000].map((v) => (
              <button
                key={v}
                type="button"
                disabled={v > myPxp}
                onClick={() => {
                  setAmount(String(v));
                  setConfirmed(false);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                  parseInt(amount) === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : v > myPxp
                      ? "opacity-30 cursor-not-allowed border-border/30"
                      : "border-border/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {v.toLocaleString("fr-FR")}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <Label>Note (optionnel)</Label>
          <Textarea
            placeholder="Pour la victoire en tournoi, remboursement…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 bg-card/60 border-border/40 resize-none"
            maxLength={200}
          />
        </div>

        {/* Confirmation */}
        {recipientProfile &&
          recipientProfile.id !== user?.uid &&
          !isNaN(parsedAmount) &&
          parsedAmount >= 1 &&
          parsedAmount <= myPxp && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-muted-foreground">Tu envoies</span>
                <span className="font-black text-yellow-400 text-lg">
                  {parsedAmount.toLocaleString("fr-FR")} PXP
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="font-medium text-foreground truncate">
                  {myProfile?.username ?? "Toi"}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
                <span className="font-medium text-foreground truncate">{recipientName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Info className="h-3 w-3 shrink-0" />
                Ton nouveau solde :{" "}
                <span className="font-bold text-foreground">
                  {(myPxp - parsedAmount).toLocaleString("fr-FR")} PXP
                </span>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-xs text-muted-foreground">
                  Je confirme envoyer{" "}
                  <strong className="text-foreground">
                    {parsedAmount.toLocaleString("fr-FR")} PXP
                  </strong>{" "}
                  à <strong className="text-foreground">{recipientName}</strong>. Cette action est
                  irréversible.
                </span>
              </label>
            </div>
          )}

        <Button
          onClick={handleTransfer}
          disabled={!canSend || sending}
          className="w-full bg-sunset hover:bg-sunset/90 text-white font-bold h-11"
        >
          {sending ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
          ) : (
            <SendHorizonal className="h-4 w-4 mr-2" />
          )}
          {sending ? "Envoi en cours…" : "Envoyer les PXP"}
        </Button>
      </div>

      {/* Recent transfer history */}
      <div className="rounded-2xl border border-border/40 bg-card/50 p-6">
        <h2 className="font-bold text-base flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Historique des transferts
        </h2>
        {txLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {(
              transactions as
                | Array<{
                    id: string;
                    type?: string;
                    amount?: number;
                    reason?: string;
                    created_at?: string;
                  }>
                | undefined
            )
              ?.filter((tx) => tx.type === "transfer_sent" || tx.type === "transfer_received")
              .slice(0, 20)
              .map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/30 bg-card/30 text-sm"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {tx.type === "transfer_sent" ? (
                      <SendHorizonal className="h-4 w-4 text-red-400 shrink-0" />
                    ) : (
                      <PxpCoin className="h-4 w-4 shrink-0" />
                    )}
                    <span className="text-muted-foreground truncate text-xs">
                      {tx.reason ?? "Transfert"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-bold ${(tx.amount ?? 0) < 0 ? "text-red-400" : "text-green-400"}`}
                    >
                      {(tx.amount ?? 0) > 0 ? "+" : ""}
                      {(tx.amount ?? 0).toLocaleString("fr-FR")} PXP
                    </span>
                    <span className="text-xs text-muted-foreground/50 hidden sm:inline">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString("fr-FR") : ""}
                    </span>
                  </div>
                </div>
              ))}
            {!transactions ||
              ((transactions as unknown[]).filter((tx: unknown) =>
                (tx as { type?: string }).type?.startsWith("transfer"),
              ).length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Aucun transfert pour le moment.
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
