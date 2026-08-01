import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site-layout";

export const Route = createFileRoute("/tournaments")({
  component: () => (
    <SiteLayout>
      <Outlet />
    </SiteLayout>
  ),
});
