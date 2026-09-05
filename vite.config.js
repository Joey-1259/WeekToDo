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
        extensions: [
            ".mjs",
            ".js",
            ".mts",
            ".ts",
            ".jsx",
            ".tsx",
            ".json",
            ".vue",
        ],
    },

    define: {

      __VUE_I18N_FULL_INSTALL__: true,

      __VUE_I18N_LEGACY_API__: true,

      __INTLIFY_JIT_COMPILATION__: true,

      __INTLIFY_DROP_MESSAGE_COMPILER__: false,
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
