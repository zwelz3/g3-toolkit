import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "src/core"),
      "@views": resolve(__dirname, "src/views"),
      "@state": resolve(__dirname, "src/state"),
      "@interaction": resolve(__dirname, "src/interaction"),
      "@a11y": resolve(__dirname, "src/a11y"),
    },
  },
});
