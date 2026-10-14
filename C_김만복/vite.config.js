import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/ai-promo-studio/",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
