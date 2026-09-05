import { defineConfig, loadEnv } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    main: {
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, "electron/main/index.js"),
          },
        },
      },
    },

    preload: {
      build: {
        rollupOptions: {
          input: {
            index: resolve(__dirname, "electron/preload/index.js"),
          },
        },
      },
    },

    renderer: {
      root: ".",

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
        outDir: "out/renderer",
        emptyOutDir: false,

        rollupOptions: {
          input: {
            index: resolve(__dirname, "index.html"),
          },
        },
      },

      server: {
        strictPort: true,
      },
    },
  };
});
