import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Bell, Check, CheckCheck, UserPlus, UserX, Mail, ArrowLeft } from "lucide-react";
import { doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import { useAuth } from "@/lib/firebase-auth-context";
import { useNotifications } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/dashboard/notifications")({
  component: NotificationsPage,
});

const TYPE_ICONS: Record<string, React.ReactNode> = {
  join_request_accepted: <UserPlus className="h-4 w-4 text-green-500" />,
  join_request_rejected: <UserX className="h-4 w-4 text-red-500" />,
  join_request_received: <UserPlus className="h-4 w-4 text-yellow-500" />,
  team_invite: <Mail className="h-4 w-4 text-blue-500" />,
};

function NotificationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
  }

  async function handleMarkRead(notificationId: string) {
    await updateDoc(doc(db, "notifications", notificationId), { read: true });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-black">{t("notifications.title")}</h1>
          </div>
        </div>
        {notifications && notifications.filter((n) => !n.read).length > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            {t("notifications.mark_all_read")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !notifications || notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bell className="mb-4 h-12 w-12" />
          <p className="text-lg font-medium">{t("notifications.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                n.read ? "opacity-60" : "bg-secondary/20"
              }`}
              onClick={() => !n.read && handleMarkRead(n.id)}
            >
              <div className="mt-1">{TYPE_ICONS[n.type] || <Bell className="h-4 w-4" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{n.title}</p>
                  {!n.read && <Badge variant="default" className="h-1.5 w-1.5 rounded-full p-0" />}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.created_at
                    ? new Date(n.created_at).toLocaleDateString("fr-FR", {
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
