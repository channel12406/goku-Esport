import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/integrations/firebase/config";
import { SiteLayout } from "@/components/site-layout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const firebaseUser = await new Promise<User | null>((resolve) => {
      const unsub = onAuthStateChanged(auth, (u) => {
        unsub();
        resolve(u);
      });
    });
    if (!firebaseUser) throw redirect({ to: "/auth", search: { mode: "signin" } });
    return { user: firebaseUser };
  },
  component: () => (
    <SiteLayout>
      <Outlet />
    </SiteLayout>
  ),
});
