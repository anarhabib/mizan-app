import path from "path";
import { defineConfig, loadEnv } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, "../.."));
  const webEnv = loadEnv(mode, import.meta.dirname);
  return {
    define: Object.fromEntries(
      Object.entries(rootEnv)
        .filter(([key]) => !(key in webEnv))
        .map(([key, value]) => [
          `import.meta.env.${key}`,
          JSON.stringify(value),
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
