import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { UGM, type StructuralOverlay } from "@g3-toolkit/core";
import { CytoscapeCanvas } from "../../views/canvas/CytoscapeCanvas";
import { useOverlayStore } from "../../state/overlay-store";
import { useOverlaySequence } from "./useOverlaySequence";
import { OverlayTransport } from "./OverlayTransport";
import type { OverlaySequenceMode } from "./overlay-sequence";

// A small graph whose nodes fall into three "phases" (an algorithm
// that grows a frontier outward from a seed), plus a path overlay that
// another part of the host owns and that the sequence must leave alone.
function buildUGM(): UGM {
  const ugm = new UGM();
  const N = 18;
  for (let i = 0; i < N; i++) {
    ugm.addNode(`n${i}`, {
      types: [i === 0 ? "Seed" : "Node"],
      properties: { name: `Node ${i}` },
    });
  }
  for (let i = 1; i < N; i++) {
    ugm.addEdge(`n${Math.floor((i - 1) / 3)}`, `n${i}`, { type: "linksTo" });
  }
  return ugm;
}

const PHASES: StructuralOverlay[] = [
  { id: "phase-1", label: "Phase 1: seed", nodeIds: ["n0"], edgeIds: [] },
  {
    id: "phase-2",
    label: "Phase 2: first ring",
    nodeIds: ["n1", "n2", "n3"],
    edgeIds: [],
    tone: "info",
  },
  {
    id: "phase-3",
    label: "Phase 3: second ring",
    nodeIds: ["n4", "n5", "n6", "n7", "n8", "n9", "n10", "n11", "n12"],
    edgeIds: [],
    tone: "warning",
  },
  {
    id: "phase-4",
    label: "Phase 4: leaves",
    nodeIds: ["n13", "n14", "n15", "n16", "n17"],
    edgeIds: [],
    tone: "danger",
  },
];
const FOREIGN: StructuralOverlay = {
  id: "path-seed-to-n17",
  label: "Path (owned elsewhere)",
  nodeIds: ["n0", "n2", "n5", "n17"],
  edgeIds: [],
};
const PHASE_IDS = PHASES.map((p) => p.id);

function Walkthrough({
  mode,
  reduced,
  foreignActive,
}: {
  mode: OverlaySequenceMode;
  reduced?: boolean;
  foreignActive?: boolean;
}) {
  const [ugm] = useState(buildUGM);
  const [speedMs, setSpeedMs] = useState(1000);
  const [loop, setLoop] = useState(false);
  // Registration is the host's job and happens BEFORE the sequence
  // takes the ids: the hook never registers anything. `ready` is read
  // from the store so the sequence mounts only once the ids exist.
  useEffect(() => {
    const store = useOverlayStore.getState();
    for (const p of PHASES) store.register(p, false);
    store.register(FOREIGN, Boolean(foreignActive));
    return () => {
      const s = useOverlayStore.getState();
      for (const p of PHASES) s.unregister(p.id);
      s.unregister(FOREIGN.id);
    };
  }, [foreignActive]);
  const activeIds = useOverlayStore((s) => s.activeIds);
  const ready = useOverlayStore((s) =>
    s.overlays.some((o) => o.id === FOREIGN.id),
  );
  return (
    <div style={{ display: "grid", gap: 8, width: 640 }}>
      <div
        style={{
          height: 400,
          border: "1px solid var(--g3t-border, #dee2e6)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--g3t-bg-primary, #fff)",
        }}
      >
        <CytoscapeCanvas ugm={ugm} layout="breadthfirst" />
      </div>
      {ready && (
        <Sequenced
          mode={mode}
          reduced={reduced}
          speedMs={speedMs}
          setSpeedMs={setSpeedMs}
          loop={loop}
          setLoop={setLoop}
        />
      )}
      <div
        style={{
          fontSize: 12,
          color: "var(--g3t-text-muted, #868e96)",
          fontFamily: "var(--g3t-font-mono, monospace)",
        }}
      >
        activeIds: [{activeIds.join(", ")}]
      </div>
    </div>
  );
}

function Sequenced({
  mode,
  reduced,
  speedMs,
  setSpeedMs,
  loop,
  setLoop,
}: {
  mode: OverlaySequenceMode;
  reduced?: boolean;
  speedMs: number;
  setSpeedMs: (ms: number) => void;
  loop: boolean;
  setLoop: (loop: boolean) => void;
}) {
  const sequence = useOverlaySequence({ ids: PHASE_IDS, mode, speedMs, loop });
  return reduced ? (
    <OverlayTransport sequence={sequence} showReadout={false} />
  ) : (
    <OverlayTransport
      sequence={sequence}
      speedMs={speedMs}
      onSpeedChange={setSpeedMs}
      loop={loop}
      onLoopChange={setLoop}
    />
  );
}

const meta: Meta<typeof OverlayTransport> = {
  title: "Molecules/OverlayTransport",
  component: OverlayTransport,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Transport controls for `useOverlaySequence`: prev / play-pause " +
          "/ next, an index readout, and optional speed and loop controls, " +
          "each suppressible through props. The sequence sets active " +
          "exactly the overlay ids it owns and leaves every other overlay " +
          "alone, so it composes with overlays registered elsewhere.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof OverlayTransport>;

export const SinglePhase: Story = {
  render: () => <Walkthrough mode="single" />,
  parameters: {
    docs: {
      description: {
        story:
          '`mode: "single"`: each step shows only its own overlay. ' +
          "Play advances once a second; the last step holds for one " +
          "interval, then playback pauses.",
      },
    },
  },
};

export const CumulativeBuildUp: Story = {
  render: () => <Walkthrough mode="cumulative" />,
  parameters: {
    docs: {
      description: {
        story:
          '`mode: "cumulative"`: step N shows its own overlay plus ' +
          "every earlier one, the frontier-growth narrative.",
      },
    },
  },
};

export const ComposesWithAForeignOverlay: Story = {
  render: () => <Walkthrough mode="single" foreignActive />,
  parameters: {
    docs: {
      description: {
        story:
          "A path overlay registered ACTIVE by another part of the host " +
          "stays active through every step: the sequence merges into " +
          "`activeIds`, it never replaces them.",
      },
    },
  },
};

export const ReducedToTransport: Story = {
  render: () => <Walkthrough mode="single" reduced />,
  parameters: {
    docs: {
      description: {
        story:
          "Prev / play / next only: speed and loop render only when " +
          "their value and setter are wired, and the readout is " +
          "suppressed with `showReadout={false}`.",
      },
    },
  },
};
