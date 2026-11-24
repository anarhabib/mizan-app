import path from "path";
import { defineConfig, loadEnv } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const publicEnvKeys = [
  "VITE_API_BASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(
    mode,
    path.resolve(import.meta.dirname, "../.."),
    publicEnvKeys,
  );
  const webEnv = loadEnv(mode, import.meta.dirname, publicEnvKeys);
  const publicEnv = { ...rootEnv, ...webEnv };
  return {
    // Only the exact keys below are public, even when other keys start with VITE_.
    envPrefix: [],
    define: Object.fromEntries(
      publicEnvKeys
        .filter((key) => publicEnv[key] !== undefined)
        .map((key) => [
          `import.meta.env.${key}`,
          JSON.stringify(publicEnv[key]),
        ]),
    ),
    plugins: [
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    server: {
      host: "127.0.0.1",
      port: 3000,
      strictPort: true,
      proxy: { "/api": process.env.MIZAN_API_URL ?? "http://127.0.0.1:3001" },
    },
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
  };
});
