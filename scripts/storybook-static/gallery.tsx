/**
 * Static story gallery: a Storybook-equivalent built with the same
 * approach as the visual-acceptance page. It globs every story file,
 * renders each story against the workspace SOURCE (the Vite config
 * aliases the @g3t packages to their src directories, like the VA
 * build), and shows a navigable sidebar plus a one-story pane. The
 * whole thing inlines into a single self-contained HTML, so it opens
 * without the Storybook dev server (which currently cannot build while
 * `views/coverage` is missing from the react barrel).
 *
 * It reproduces what Storybook does around a story so the components
 * actually render: it runs the global theme decorator from
 * .storybook/preview.tsx (which injects the --g3t-* design tokens and
 * sets the active theme), applies any per-story decorators, and passes
 * a story context carrying the selected theme. Without the token
 * injection, components style themselves against undefined CSS
 * variables and appear blank.
 *
 * What this is NOT: the Storybook addons (Controls, Docs, a11y, MCP).
 * It renders the same story functions Storybook would, with live
 * components (canvas, charts) hydrated in the browser. Each story is
 * wrapped in an error boundary so one failing story does not blank the
 * gallery.
 */

import {
  Component,
  createElement,
  useEffect,
  useMemo,
  useState,
  type ElementType,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { injectDesignTokens } from "@g3t/core";
import { useThemeStore } from "@g3t/react";
import baseCss from "../../packages/react/src/theme/g3t-base.css?raw";

type ThemeId = "light" | "dark" | "high-contrast";
interface Globals {
  theme: ThemeId;
}
interface StoryContext {
  globals: Globals;
  args: Record<string, unknown>;
  parameters: Record<string, unknown>;
}
type Decorator = (Story: () => ReactNode, ctx: StoryContext) => ReactNode;
interface StoryMeta {
  title?: string;
  component?: ElementType;
  decorators?: Decorator[];
  parameters?: Record<string, unknown>;
}
interface StoryObj {
  name?: string;
  render?: (args: Record<string, unknown>, ctx: StoryContext) => ReactNode;
  args?: Record<string, unknown>;
  decorators?: Decorator[];
}
type StoryModule = { default?: StoryMeta } & Record<string, unknown>;

const modules = import.meta.glob("/packages/react/src/**/*.stories.tsx", {
  eager: true,
}) as Record<string, StoryModule>;

interface Entry {
  id: string;
  group: string;
  category: string;
  label: string;
  build: (globals: Globals) => ReactNode;
}

function renderStory(
  meta: StoryMeta,
  story: unknown,
  globals: Globals,
): ReactNode {
  const s = (typeof story === "object" && story ? story : {}) as StoryObj;
  const ctx: StoryContext = {
    globals,
    args: s.args ?? {},
    parameters: meta.parameters ?? {},
  };
  let el: ReactNode;
  if (typeof story === "function") {
    el = createElement(story as ElementType, {});
  } else if (typeof s.render === "function") {
    el = s.render(ctx.args, ctx);
  } else if (meta.component) {
    el = createElement(meta.component, ctx.args);
  } else {
    el = createElement(
      "div",
      { style: { color: "#888" } },
      "(this story declares neither a render function nor a meta component)",
    );
  }
  const decorators = [...(s.decorators ?? []), ...(meta.decorators ?? [])];
  for (const dec of decorators) {
    const inner = el;
    el = dec(() => inner, ctx);
  }
  return el;
}

function buildEntries(): Entry[] {
  const entries: Entry[] = [];
  for (const path in modules) {
    const mod = modules[path];
    const meta = mod.default ?? {};
    const group =
      meta.title ?? path.replace(/^.*\/([^/]+)\.stories\.tsx$/, "$1");
    const category = group.split("/")[0];
    for (const key of Object.keys(mod)) {
      if (key === "default") continue;
      const story = mod[key];
      const label =
        story && typeof story === "object" && "name" in story && story.name
          ? String((story as StoryObj).name)
          : key;
      entries.push({
        id: `${group}/${label}`,
        group,
        category,
        label,
        build: (globals) => renderStory(meta, story, globals),
      });
    }
  }
  entries.sort(
    (a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label),
  );
  return entries;
}

// Adopter-facing description of each top-level category, in plain terms
// rather than the atomic-design vocabulary. Ordered most-useful-first
// for someone evaluating the toolkit.
const CATEGORY_INFO: Record<string, string> = {
  Patterns:
    "Whole compositions. Several surfaces wired together so they behave as one system (a selection made in any view lights up in all of them). The best place to start.",
  Views:
    "Data surfaces. The ways the toolkit can display your graph: the interactive canvas, plus table, tree, map, timeline, matrix, Sankey, schema, and diff views.",
  Compounds:
    "Assembled control clusters. Ready-made groups of controls, such as the toolbar paired with the algorithm panel.",
  Molecules:
    "Individual controls. Focused widgets you drop into your own layout: search, the facet filter, the filter builder, the temporal range.",
  Atoms:
    "Primitives. The smallest building blocks: loading skeletons, empty states, port handles.",
  "UX Surface":
    "UX scaffolding. Cross-cutting surfaces like the toolbar and the visual-encoding controls.",
  Reference:
    "Reference demos. Feature and chart examples kept for reference; not part of the core component taxonomy.",
};
const CATEGORY_ORDER = [
  "Patterns",
  "Views",
  "Compounds",
  "Molecules",
  "UX Surface",
  "Atoms",
  "Reference",
];
const START_HERE = ["Patterns/Coordinated Selection", "Views/CytoscapeCanvas"];

const THEMES: { id: ThemeId; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "high-contrast", label: "Contrast" },
];

// Global theme decorator, ported from .storybook/preview.tsx: inject the
// design tokens and set the active theme so components have their CSS
// variables, then wrap the story in the themed surface.
function ThemedStory({
  theme,
  children,
}: {
  theme: ThemeId;
  children: ReactNode;
}): ReactNode {
  const setTheme = useThemeStore((s) => s.setTheme);
  useEffect(() => {
    setTheme(theme);
    injectDesignTokens(theme === "dark");
    document.documentElement.dataset["theme"] = theme;
    document.documentElement.style.colorScheme =
      theme === "dark" ? "dark" : "light";
  }, [theme, setTheme]);
  return createElement(
    "div",
    {
      style: {
        background: "var(--g3t-bg-primary, #ffffff)",
        color: "var(--g3t-text-primary, #1a1a1a)",
        fontFamily: "var(--g3t-font, system-ui, sans-serif)",
        colorScheme: theme === "dark" ? "dark" : "light",
        height: "100%",
        minHeight: "100%",
      },
    },
    children,
  );
}

// Render the story inside its own component so any hooks a story's
// render function uses belong to this fiber (keyed per story+theme),
// not to the Gallery. Calling build() directly in Gallery's JSX ran
// those hooks in Gallery and tripped "rendered more hooks than during
// the previous render" as the selection changed.
function StoryHost({
  build,
  theme,
}: {
  build: (globals: Globals) => ReactNode;
  theme: ThemeId;
}): ReactNode {
  return build({ theme });
}

class StoryBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Swallowed: the message is shown in render() so the gallery stays up.
  }
  render(): ReactNode {
    if (this.state.error) {
      return createElement(
        "div",
        {
          style: {
            padding: 16,
            color: "#b00020",
            fontFamily: "ui-monospace, monospace",
            whiteSpace: "pre-wrap",
          },
        },
        `This story threw while rendering:\n\n${this.state.error.message}`,
      );
    }
    return this.props.children;
  }
}

const galleryCss = `
.g3tg, .g3tg * { box-sizing: border-box; }
.g3tg {
  --fs: 14px; --side: 280px; --pad: 14px; --ipy: 10px; --hfs: 16px;
  display: flex; flex-direction: column;
  height: 100vh; height: 100dvh; overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  color: #1a1a1a; background: #fff; font-size: var(--fs);
}
.g3tg-bar {
  display: flex; align-items: center; gap: 10px; flex: 0 0 auto;
  padding: 6px 10px; border-bottom: 1px solid #e0e0e0; background: #fff; z-index: 30;
}
.g3tg-burger {
  font: inherit; font-size: 20px; line-height: 1;
  min-width: 44px; min-height: 44px;
  border: 1px solid #ddd; border-radius: 8px; background: #fafafa; color: #333; cursor: pointer;
}
.g3tg-burger:active { background: #eee; }
.g3tg-bartitle { font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g3tg-body { position: relative; display: flex; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.g3tg-side {
  position: absolute; top: 0; bottom: 0; left: 0;
  width: min(86vw, 330px); z-index: 20;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
  background: #fafafa; border-right: 1px solid #e0e0e0; padding: 12px 0;
  transform: translateX(-100%); transition: transform 0.2s ease;
  box-shadow: 2px 0 14px rgba(0, 0, 0, 0.14);
}
.g3tg-side.open { transform: translateX(0); }
.g3tg-backdrop {
  position: absolute; inset: 0; z-index: 15; background: rgba(0, 0, 0, 0.36);
  opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
}
.g3tg-backdrop.show { opacity: 1; pointer-events: auto; }
.g3tg-head { padding: 0 var(--pad) 8px; font-weight: 700; font-size: var(--hfs); }
.g3tg-count { color: #888; font-weight: 400; }
.g3tg-themes { display: flex; gap: 4px; padding: 0 var(--pad) 12px; flex-wrap: wrap; }
.g3tg-themebtn {
  font: inherit; font-size: calc(var(--fs) - 2px);
  padding: 4px 9px; border: 1px solid #ccc; border-radius: 999px;
  background: #fff; color: #333; cursor: pointer;
}
.g3tg-themebtn.on { background: #0072b2; border-color: #0072b2; color: #fff; }
.g3tg-startlink {
  display: block; width: 100%; text-align: left; margin: 0 0 2px;
  padding: 5px var(--pad); border: none; background: transparent;
  color: #0072b2; cursor: pointer; font: inherit; font-size: calc(var(--fs) - 1px);
}
.g3tg-startlink:hover { background: #eef2f7; }
.g3tg-side-note { padding: 4px var(--pad) 8px; color: #999; font-size: calc(var(--fs) - 3px); }
.g3tg-group { margin-bottom: 6px; }
.g3tg-grouph {
  padding: 4px var(--pad); font-size: calc(var(--fs) - 3px);
  text-transform: uppercase; letter-spacing: 0.5px; color: #777;
}
.g3tg-item {
  display: block; width: 100%; text-align: left;
  padding: var(--ipy) calc(var(--pad) + 8px);
  border: none; background: transparent; color: #222; cursor: pointer;
  font: inherit; font-size: calc(var(--fs) - 1px); line-height: 1.3;
}
.g3tg-item:hover { background: #eef2f7; }
.g3tg-item.sel { background: #e6f0fb; color: #0072b2; font-weight: 600; }
.g3tg-main { flex: 1 1 auto; min-width: 0; overflow: auto; -webkit-overflow-scrolling: touch; padding: var(--pad); }
.g3tg-crumb { font-size: calc(var(--fs) - 2px); color: #888; margin-bottom: 4px; }
.g3tg-crumb strong { color: #222; }
.g3tg-blurb {
  font-size: calc(var(--fs) - 1px); color: #444; line-height: 1.5;
  background: #f4f7fb; border-left: 3px solid #b9d4ec; border-radius: 0 6px 6px 0;
  padding: 8px 12px; margin: 0 0 14px; max-width: 60em;
}
.g3tg-storyhost { border: 1px solid #ececec; border-radius: 8px; overflow: auto; height: clamp(360px, 70vh, 820px); }
.g3tg-welcome { max-width: 44em; padding: 8px 4px 32px; line-height: 1.6; }
.g3tg-welcome h2 { margin: 0 0 6px; font-size: calc(var(--fs) + 8px); }
.g3tg-welcome .lede { color: #444; margin: 0 0 18px; }
.g3tg-welcome h3 { font-size: calc(var(--fs) + 1px); margin: 22px 0 8px; }
.g3tg-legend { display: grid; gap: 10px; margin: 0; }
.g3tg-legrow { display: grid; grid-template-columns: 8.5em 1fr; gap: 12px; align-items: start; }
.g3tg-legname {
  font-weight: 600; font-size: calc(var(--fs) - 1px); color: #0a4d77;
  text-align: left; background: none; border: none; padding: 2px 0; cursor: pointer;
}
.g3tg-legname:hover { text-decoration: underline; }
.g3tg-legdesc { color: #444; font-size: calc(var(--fs) - 1px); }
.g3tg-startrow { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 0; }
.g3tg-startbig {
  font: inherit; font-size: calc(var(--fs) - 1px); padding: 7px 14px;
  border: 1px solid #0072b2; border-radius: 8px; background: #0072b2; color: #fff; cursor: pointer;
}
.g3tg-startbig.alt { background: #fff; color: #0072b2; }
@media (min-width: 1px) and (max-width: 759px) {
  .g3tg-legrow { grid-template-columns: 1fr; gap: 2px; }
}
@media (min-width: 760px) {
  .g3tg { --ipy: 5px; }
  .g3tg-bar { display: none; }
  .g3tg-side {
    position: relative; width: var(--side); min-width: var(--side);
    transform: none; box-shadow: none; flex: 0 0 auto;
  }
  .g3tg-backdrop { display: none; }
}
@media (min-width: 2560px) { .g3tg { --fs: 17px; --side: 360px; --pad: 22px; --ipy: 7px; --hfs: 20px; } }
@media (min-width: 3840px) { .g3tg { --fs: 21px; --side: 460px; --pad: 32px; --ipy: 9px; --hfs: 25px; } }
`;

export function Gallery(): ReactNode {
  const entries = useMemo(buildEntries, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [theme, setThemeId] = useState<ThemeId>("light");

  // Make sure the design tokens exist app-wide from first paint, even
  // before any themed story mounts.
  useEffect(() => {
    injectDesignTokens(theme === "dark");
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  const groups = useMemo(() => {
    const byCat = new Map<string, Map<string, Entry[]>>();
    for (const entry of entries) {
      let cat = byCat.get(entry.category);
      if (!cat) {
        cat = new Map();
        byCat.set(entry.category, cat);
      }
      const arr = cat.get(entry.group);
      if (arr) arr.push(entry);
      else cat.set(entry.group, [entry]);
    }
    const cats = [...byCat.keys()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return cats.map((cat) => ({ cat, groups: [...byCat.get(cat)!.entries()] }));
  }, [entries]);

  const current = entries.find((entry) => entry.id === selected) ?? null;

  function jumpTo(group: string): void {
    const hit = entries.find((entry) => entry.group === group) ?? null;
    if (hit) {
      setSelected(hit.id);
      setOpen(false);
    }
  }

  return (
    <>
      <style>{baseCss}</style>
      <style>{galleryCss}</style>
      <div className="g3tg">
        <div className="g3tg-bar">
          <button
            type="button"
            className="g3tg-burger"
            aria-label={open ? "Close story list" : "Open story list"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {"\u2630"}
          </button>
          <span className="g3tg-bartitle">
            {current ? current.label : "Browse stories"}
          </span>
        </div>
        <div className="g3tg-body">
          <nav className={open ? "g3tg-side open" : "g3tg-side"}>
            <div className="g3tg-head">
              g3-toolkit stories{" "}
              <span className="g3tg-count">({entries.length})</span>
            </div>
            <div className="g3tg-themes" role="group" aria-label="Theme">
              {THEMES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={
                    t.id === theme ? "g3tg-themebtn on" : "g3tg-themebtn"
                  }
                  onClick={() => setThemeId(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="g3tg-startlink"
              onClick={() => {
                setSelected(null);
                setOpen(false);
              }}
            >
              {"\u2190"} Overview &amp; how to read this
            </button>
            {groups.map(({ cat, groups: catGroups }) => (
              <div className="g3tg-group" key={cat}>
                <div className="g3tg-grouph" title={CATEGORY_INFO[cat]}>
                  {cat}
                </div>
                {catGroups.map(([group, items]) =>
                  items.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      className={
                        entry.id === selected ? "g3tg-item sel" : "g3tg-item"
                      }
                      title={group}
                      onClick={() => {
                        setSelected(entry.id);
                        setOpen(false);
                      }}
                    >
                      {entry.group === entry.category
                        ? entry.label
                        : `${entry.group.slice(entry.category.length + 1)} \u00b7 ${entry.label}`}
                    </button>
                  )),
                )}
              </div>
            ))}
          </nav>
          <div
            className={open ? "g3tg-backdrop show" : "g3tg-backdrop"}
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <main className="g3tg-main">
            {current ? (
              <div key={current.id}>
                <div className="g3tg-crumb">
                  {current.group} / <strong>{current.label}</strong>
                </div>
                {CATEGORY_INFO[current.category] && (
                  <p className="g3tg-blurb">
                    <strong>{current.category}.</strong>{" "}
                    {CATEGORY_INFO[current.category].replace(/^[^.]+\.\s*/, "")}
                  </p>
                )}
                <div className="g3tg-storyhost">
                  <StoryBoundary key={`${current.id}:${theme}`}>
                    <ThemedStory theme={theme}>
                      <StoryHost build={current.build} theme={theme} />
                    </ThemedStory>
                  </StoryBoundary>
                </div>
              </div>
            ) : (
              <div className="g3tg-welcome">
                <h2>g3-toolkit component gallery</h2>
                <p className="lede">
                  Every story below is a real piece of the toolkit, rendered
                  against the library source. The toolkit is a composable
                  graph-visualization library: you assemble these surfaces and
                  controls into your own app. This gallery is for seeing each
                  piece on its own and judging whether it fits.
                </p>
                <p>
                  Pick a story from the list. The categories run from whole
                  systems at the top down to single primitives at the bottom.
                  Use the theme buttons to see light, dark, and high-contrast.
                </p>
                <h3>Start here</h3>
                <div className="g3tg-startrow">
                  {START_HERE.map((g, i) => (
                    <button
                      type="button"
                      key={g}
                      className={
                        i === 0 ? "g3tg-startbig" : "g3tg-startbig alt"
                      }
                      onClick={() => jumpTo(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <h3>What the categories mean</h3>
                <div className="g3tg-legend">
                  {CATEGORY_ORDER.filter((c) =>
                    groups.some((g) => g.cat === c),
                  ).map((cat) => (
                    <div className="g3tg-legrow" key={cat}>
                      <button
                        type="button"
                        className="g3tg-legname"
                        onClick={() => {
                          const first = entries.find((e) => e.category === cat);
                          if (first) setSelected(first.id);
                        }}
                      >
                        {cat}
                      </button>
                      <div className="g3tg-legdesc">
                        {CATEGORY_INFO[cat].replace(/^[^.]+\.\s*/, "")}
                      </div>
                    </div>
                  ))}
                </div>
                <h3>What this is not</h3>
                <p>
                  This is a static gallery, not the full Storybook: there are no
                  Controls or Docs panels and no addon toolbar. Interactive
                  components such as the canvas and charts render live in the
                  browser. For the full experience, run the real Storybook once
                  the react barrel resolves.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
