import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  /*
   * Safety rule:
   * every ordinary Vite invocation uses staging.
   *
   * Production must be requested explicitly with:
   *   --mode mlc-production
   */
  const cloudflareConfigPath =
    mode === "mlc-production"
      ? "./wrangler.production.jsonc"
      : "./wrangler.staging.jsonc";

  return {
    plugins: [
      react(),
      tailwindcss(),
      cloudflare({
        configPath: cloudflareConfigPath,
      }),
    ],

    resolve: {
      alias: {
        "@": fileURLToPath(
          new URL(".", import.meta.url),
        ),
      },
    },
  };
});
