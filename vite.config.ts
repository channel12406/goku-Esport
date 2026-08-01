import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

const isDevBuild = process.env.NODE_ENV === "development" && process.argv.includes("build");

// Injecte les variables du fichier .env dans process.env pour que le code
// serveur (qui lit process.env.FIREBASE_ROBOT_*, ADMIN_UIDS…) les trouve aussi
// hors dev. Ne concerne que le process Node du build/serveur : le bundle client
// reste limité aux variables VITE_* (voir `define` plus bas).
const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
process.env = { ...process.env, ...env };

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    nitro(),
    react(),
  ],
  // Seules les variables VITE_* sont exposées au bundle (client ET serveur).
  // Les secrets (FIREBASE_ROBOT_*, ADMIN_UIDS, ADMIN_SECRET_KEY) ne doivent
  // JAMAIS être inlinés dans le code client : ils sont lus côté serveur via
  // process.env au runtime (Nitro).
  define: Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.startsWith("VITE_"))
      .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  ),
  ...(isDevBuild
    ? {
        environments: {
          client: {
            define: { "process.env.NODE_ENV": JSON.stringify("development") },
          },
        },
        esbuild: { keepNames: true } as unknown as { keepNames: boolean },
      }
    : {}),
  css: { transformer: "lightningcss" },
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  server: {
    host: "::",
    port: 8080,
  },
});
