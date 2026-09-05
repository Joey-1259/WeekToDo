import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: "/",

    publicDir: "public",

    plugins: [vue()],

    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },

    define: {
      "process.env": JSON.stringify({
        VUE_APP_SENTRY_DNS:
          env.VITE_SENTRY_DSN ||
          env.VUE_APP_SENTRY_DNS ||
          "",
      }),
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
    },

    server: {
      strictPort: true,
    },
  };
});
