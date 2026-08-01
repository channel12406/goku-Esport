import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { type ReactNode } from "react";

import appCss from "../styles.css?url";
import i18n from "@/lib/i18n";
import { I18nextProvider } from "react-i18next";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/firebase-auth-context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-black text-sunset">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-sunset px-4 py-2 text-sm font-semibold text-white shadow-glow-sm"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un problème est survenu. Réessaie ou reviens à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-sunset px-4 py-2 text-sm font-medium text-white shadow-glow-sm"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FireArena — L'arène e-sport 100% Free Fire" },
      {
        name: "description",
        content:
          "Tournois Free Fire, classements en temps réel, ligues saisonnières et équipes vérifiées. Bâti pour la scène africaine, ouvert au monde.",
      },
      { name: "author", content: "FireArena" },
      { name: "theme-color", content: "#1a0f1f" },
      { property: "og:title", content: "FireArena — L'arène e-sport 100% Free Fire" },
      {
        property: "og:description",
        content: "Organise, joue et gagne. Tournois vérifiés, ligues, PXP.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "FireArena" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@FireArena" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const BGD_STYLE = {
  backgroundImage: `
    radial-gradient(ellipse at 20% 50%, oklch(0.83 0.15 85 / 0.04) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, oklch(0.76 0.17 75 / 0.03) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, oklch(0.87 0.14 90 / 0.02) 0%, transparent 50%),
    radial-gradient(ellipse at 100% 50%, transparent 0%, oklch(0.11 0.015 270) 100%)
  `,
};

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <div style={BGD_STYLE} className="pointer-events-none fixed inset-0 -z-10" />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <AuthProvider>
            <Outlet />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
