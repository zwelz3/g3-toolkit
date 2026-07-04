/** Client entry for the static story gallery (inlined into one HTML). */
import { createRoot } from "react-dom/client";
import { Gallery } from "./gallery";

const el = document.getElementById("root");
if (el) createRoot(el).render(<Gallery />);
console.info("G3T_STORY_GALLERY_MOUNTED");
