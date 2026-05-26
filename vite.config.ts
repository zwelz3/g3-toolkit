import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@g3t/core": resolve(__dirname, "packages/core/src"),
      "@g3t/react": resolve(__dirname, "packages/react/src"),
      "@g3t/charts": resolve(__dirname, "packages/charts/src"),
    },
  },
});
