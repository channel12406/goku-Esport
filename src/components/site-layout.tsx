import { type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteSidebar } from "@/components/site-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { MobileTabBar } from "@/components/mobile-tab-bar";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1400px] items-start gap-4 px-3 py-4 sm:px-6 sm:py-6 lg:gap-8 lg:px-8">
        <SiteSidebar />
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>
      <SiteFooter />
      <MobileTabBar />
    </div>
  );
}
