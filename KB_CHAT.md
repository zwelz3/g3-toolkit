# KB_CHAT.md — g3_toolkit kb chat directive (for-kb-chat only; not for humans)
#
# kb chat is a DIFFERENT TOOL from the Claude Code CLI. This file is the directive
# kb chat assembles into its system prompt (via directives_loader.assemble_system_prompt,
# which walks cwd → parents collecting every KB_CHAT.md it finds). It is NOT loaded
# by the CLI — CLAUDE.md is the CLI's. The two files may diverge freely.
#
# This file was copied in from the canonical default (templates/KB_CHAT.default.md
# in the specter_spindle/twill toolkit) at `kb init` time, with project-specific
# values substituted. Future projects do NOT have access to ./twill/, so everything
# kb chat needs is INLINED here — no cross-repo path references.
#
# Format: compressed yaml/k-v.

```yaml
project:      g3_toolkit
repo:         spindle_g3_toolkit            # GraphDB repo
graphdb:      https://forge.tail515200.ts.net:3030/repositories/spindle_g3_toolkit
iri_segment:  g3_toolkit     # IRI scope segment (…/ontology/kb/g3_toolkit/graph/…)
path:         /GSystems/src/g3-toolkit
```

## Response style (Jake-specific)

```yaml
# NOTE: no reply-length cap. Answer at whatever length the work needs — lead with
# the finding, then give full context (what was before / what is now / why it
# matters); Jake splits attention across screens and does not retain prior-message
# context. Detail goes into the WORK specifics, not meta-narration of process.
suppress_code_diffs:   true   # don't echo before/after blocks or unified diffs after edit_file
suppress_file_dumps:   true   # don't paste file contents back; trust read_file/edit_file success
on_questions:          up to 4 via a single AskUserQuestion; default + proceed when Jake is away
```

## Handle discipline (P9 — also enforced in directives_loader)

```yaml
# Every assistant reply MUST open with `**A<n>**` where <n> is the current turn
# id (the REPL allocates qN/AN pairs; grep the transcript by handle to find a
# specific answer).
open_handle:    "**A<n>**"

# When a reply ASKS Jake a question, that question needs its OWN handle so Jake
# can reply to the exact question — the turn-level `**A<n>**` is not enough. Tag
# each question with `<handle>:q<n>)` where <handle> is a short topical mnemonic
# and q<n> is THIS turn's q-counter. Jake then answers `<handle>:q3) ...`.
# `<handle>` is the PATTERN — substitute a real mnemonic, don't write "handle".
#   • One question:        <handle>:q3) <the question text>
#   • Multiple questions:   <handle>:q3a) … / <other-handle>:q3b) …  (suffix a/b/c on the same q<n>)
question_handle:  "<handle>:q<n>)"

# A PLAN and any questions ABOUT that plan share the SAME handle (the same q<n>).
# So the plan footer's q<n> and the plan's open-question handles line up under
# one number — `/do q<n>` dispatches the plan, `<handle>:q<n>)` answers its
# questions, all keyed to the same turn.
plan_footer:    "[plan → <path-or-iri> · /do q<n>]"
plan_footer_when:  "only on turns that produce a dispatchable artifact"
```

## Service addresses (kb chat hits these directly)

```yaml
# Source of truth = the Caddyfile reverse-proxy block on the Tailscale host.
# ALL code/tests/scripts/docs MUST use these stable hostnames — never hard-code a
# 172.18.* / 172.17.* docker bridge IP or a bare container hostname for HTTP
# (docker-network DNS isn't reachable from the host or from sibling networks).
# Container-name references ARE legitimate as a `docker exec` arg; only URL-style
# references must hostname-ify.
service_addresses:
  fuseki:     https://forge.tail515200.ts.net:3030      # ghost-fuseki — sole SPARQL store (kb_sparql target)
  kb_namespace: https://forge.tail515200.ts.net/ontology/kb/   # KB_V2_NS; env KB_V2_NS overrides
  ollama:     https://forge.tail515200.ts.net:11434     # ghost-ollama — local fallback transport
  ontology:   https://forge.tail515200.ts.net:443/ontology/<tier>/<repo_id>/<file>  # file-server

# Runtime resolution chain:
#   1. env var (per-service: KB_GRAPHDB_URL / OLLAMA_HOST / KB_V2_NS)
#   2. kb:Config atom in site/graph/config  (operator-overrideable)
#   3. this KB_CHAT.md service_addresses block
#   4. fail loud — no silent hardcoded fallback in code
# Code consumers: kb_config.KB_GRAPHDB_URL / kb_config.lookup_config(<key>).
```

## Environment variables (read by kb chat / its transports)

```yaml
kb_chat_runtime:
  KB_CHAT_TUI:               ""           # "0" = force classic stdin; "1" = force TUI; unset = auto
  KB_CHAT_SESSION_ID:        ""           # pin a session id (default: derived from --session)
  KB_CHAT_GROUNDING:         "1"          # "0" = disable Gemini grounding tool-loop
  KB_CHAT_GROUNDING_ROOT:    "/GSystems/src"   # root the grounding tools can read under

assistant_model_selection:
  KB_ASSISTANT_MODEL:        "sonnet"     # the assistant kb chat USES (sonnet / opus / fable)
  KB_DEFAULT_WORKER_MODEL:   "sonnet"     # default model for /bg + /dispatch spawns

inline_transport:
  # Tier-bounded inline tool-loop budget (NOT a single hard 3/60 cap):
  #   cheap (flash / flash-lite): KB_CHAT_INLINE_ITERS (3) / KB_CHAT_INLINE_WALL_S (60)
  #   pro tier:                   KB_CHAT_INLINE_ITERS_PRO (24) / KB_CHAT_INLINE_WALL_PRO_S (= dispatch_timeout_s)
  # Deep fan-out reads still belong in /bg workers.

service_url_overrides:
  KB_GRAPHDB_URL:            ""           # overrides graphdb canonical
  OLLAMA_HOST:               ""           # overrides ollama canonical
  KB_V2_NS:                  ""           # overrides kb_namespace canonical
```

## Graph layout (kb chat queries these)

```yaml
g3_toolkit:    # GraphDB repo spindle_g3_toolkit; IRI segment = g3_toolkit
  statements:  ...kb/g3_toolkit/graph/statements    # typed atoms; the curated log
  global:      ...kb/g3_toolkit/graph/global        # project-local Topic / HeadPointer
  jobs:        ...kb/g3_toolkit/graph/jobs          # weaverd Job + JobEvent
  usage:       ...kb/g3_toolkit/graph/usage         # UsageSession + UsageDaily
  drift:       ...kb/g3_toolkit/graph/drift         # kb verify findings
  code:        ...kb/g3_toolkit/graph/code          # File + Symbol projections
  workblock:   ...kb/g3_toolkit/graph/workblock     # WorkBlocks (queried for /attach context)
  ontology:    ...kb/g3_toolkit/graph/ontology      # TBox

site:            # shared cross-project tier
  statements:  ...kb/site/graph/statements       # standing UserNotes + RolePrompt (kb chat reads here)
  config:      ...kb/site/graph/config           # kb:Config atoms (operator URL overrides)
  projects:    ...kb/site/graph/projects-registry
```

## What kb chat does NOT auto-do

```yaml
# kb chat is INTERACTIVE. It does not silently dispatch on every non-trivial turn.
# Dispatch is opt-in via /bg, /dispatch, /orchestrate, or /do. Default behavior:
# investigate with tools, answer in-thread, only dispatch when the user explicitly
# asks or the orchestrator budget gate triggers.
no_default_dispatch:    true
```

## Essentials (inlined — future projects have no ./twill/ to point at)

```yaml
# These are the load-bearing operating rules a project-local kb chat needs even
# with no access to the twill toolkit's docs/. Distilled, not exhaustive.

knowledge_capture:
  # Emit atoms at the MOMENT of decision so the graph is the audit trail:
  #   kb log decision  "<what + why>"      # a choice made
  #   kb log gotcha    "<the trap>"        # a footgun discovered
  #   kb log discovery "<what was found>"  # a finding about the system
  #   kb log failure   "<what broke>"      # a bug observed before fixing
  # WorkBlock for anything spanning >1 atom: kb workblock create <slug> --goal "..."

idd_lite_decision_rule:
  # Use the heavyweight IDD (Vision .md → review → distill → dispatch) ONLY when:
  #   (1) it's a NEW capability (not a bug-fix / tweak / doctrine change);
  #   (2) it spans multiple modules / new ontology / new external dependency;
  #   (3) it might be substrate-incompatible (needs reframe); OR
  #   (4) the user wants negotiation BEFORE commitment.
  # Otherwise IDD-lite: inline reproduce→diagnose→patch→test, emit Failure+Decision.
  # Tiny tweaks (rename a flag, change a default): just do it + commit, 0 atoms.
  # Doctrine changes: mint a kb:Doctrine atom directly (supersede prior if it conflicts).

model_routing_guardrails:
  # Gemini is BANNED from code/debug/mutation work — it has write_file only, no
  # precise edit. Code edits across 2+ files, test-and-iterate loops, and
  # character-exact string-replace stay on Claude. Route Gemini for writing-heavy
  # briefs, summaries, orchestration, and pure SPARQL probes (~5-6x cheaper).
  # Opus = architecture/design/refactor; Sonnet = precise code-edit; Haiku = trivial.

question_convention:
  # When posing a question to Jake, prefix the question line with '❓ :question:' so
  # it stands out. Give each question its own `<handle>:q<n>)` handle (see P9 above).
```
