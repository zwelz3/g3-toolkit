import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { injectDesignTokens } from "./theme/design-tokens";
import "./theme/g3t-base.css";

// Inject design tokens at startup
injectDesignTokens();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
