import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Load the shared local environment file. Vite only exposes VITE_ prefixed
// values to browser code, so API-only secrets remain private.
const apiEnvDirectory = fileURLToPath(new URL("../api", import.meta.url));

export default defineConfig({
  envDir: apiEnvDirectory,
  plugins: [react()],
  server: { port: 5173 },
});
