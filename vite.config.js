import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/", // root-domain deploy (rtbnetworkbd.com) — change only for a subpath deploy
  build: {
    rollupOptions: {
      output: {
        // Split heavy, admin-only libraries into their own chunks so a
        // public-site visitor's initial bundle stays small — these only
        // load once someone actually opens the admin dashboard.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-xlsx": ["xlsx"],
          "vendor-supabase": ["@supabase/supabase-js"],
        },
      },
    },
  },
});
