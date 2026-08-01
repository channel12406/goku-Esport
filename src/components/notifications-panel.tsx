import { useTranslation } from "react-i18next";
import { Bell, CheckCheck, UserPlus, UserX, Mail, BadgeCheck, UserCheck } from "lucide-react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { Link } from "@tanstack/react-router";
import { db } from "@/integrations/firebase/config";
import { useNotifications, tsToMs } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  join_request_accepted: <UserPlus className="h-4 w-4 text-green-500" />,
  join_request_rejected: <UserX className="h-4 w-4 text-red-500" />,
  join_request_received: <UserPlus className="h-4 w-4 text-yellow-500" />,
  team_invite: <Mail className="h-4 w-4 text-blue-500" />,
  creator_request: <UserCheck className="h-4 w-4 text-yellow-500" />,
  creator_request_approved: <BadgeCheck className="h-4 w-4 text-green-500" />,
  creator_request_rejected: <UserX className="h-4 w-4 text-red-500" />,
};

export function NotificationsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useNotifications();

  async function handleMarkAllRead() {
    if (!notifications || notifications.length === 0) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, "notifications", n.id), { read: true });
    }
    await batch.commit();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  async function handleMarkRead(notificationId: string) {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  }

  return (
    <div className="space-y-3">
      {notifications && notifications.filter((n) => !n.read).length > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            {t("notifications.mark_all_read")}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg sm:h-16" />
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground sm:py-12">
          <Bell className="mb-2 h-8 w-8 sm:h-10 sm:w-10" />
          <p className="text-sm font-medium sm:text-base">{t("notifications.empty")}</p>
        </div>
      ) : (
        <div className="space-y-1.5 sm:space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors sm:gap-3 sm:p-3 ${
                n.read ? "opacity-60" : "bg-secondary/20"
              }`}
              onClick={() => !n.read && handleMarkRead(n.id)}
            >
              <div className="mt-0.5">{TYPE_ICONS[n.type] || <Bell className="h-3.5 w-3.5" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-xs sm:text-sm">{n.title}</p>
                  {!n.read && <Badge variant="default" className="h-1.5 w-1.5 rounded-full p-0" />}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 sm:text-xs">
                  {n.message}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {n.created_at
                    ? new Date(tsToMs(n.created_at)).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>
              </div>
              {n.team_id && (
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                  <Link to="/teams/$teamId" params={{ teamId: n.team_id ?? "" }}>
                    Voir
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
