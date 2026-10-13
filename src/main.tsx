import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { injectDesignTokens } from "@g3-toolkit/react";
import "@g3-toolkit/react";
// PROD-ONLY BUG FIX (G3L Round 50, owner report "almost seems like
// a css thing"): the barrel's g3t-base.css side-effect import was
// TREE-SHAKEN out of production builds (dev serves it, so only
// preview broke: the unstyled toolbar). Widening the package's
// sideEffects glob did not restore it under rolldown-vite, so the
// stylesheet is imported EXPLICITLY at the app entry: an app-level
// css import is not shakeable.
import "@g3-toolkit/react/theme/g3t-base.css";
// The page reset and body typography are OPT-IN for adopters (issue
// #24: style.css must not restyle the host page) and the playground
// opts in: it is an application built on the toolkit, so the page
// should read in the toolkit face. Published as
// "@g3-toolkit/react/style.base.css".
import "@g3-toolkit/react/theme/g3t-page.css";

// Inject design tokens at startup
injectDesignTokens();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
