import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Куда проксировать в dev (должен совпадать с тем, где слушает API на машине). */
const defaultBackend = "http://localhost:3001";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_DEV_PROXY_TARGET || defaultBackend;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
      proxy: {
        "/auth": {
          target: backend,
          changeOrigin: true,
          secure: false,
        },
        "/queries": {
          target: backend,
          changeOrigin: true,
          secure: false,
          timeout: 0,
          proxyTimeout: 0,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
