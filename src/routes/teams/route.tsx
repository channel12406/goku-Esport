import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";

export const Route = createFileRoute("/teams")({
  component: () => (
    <SiteLayout>
      <Outlet />
    </SiteLayout>
  ),
});
