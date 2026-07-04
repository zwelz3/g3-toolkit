import type { Meta, StoryObj } from "@storybook/react-vite";
import { EmptyState } from "./EmptyState";

/**
 * Atoms-layer story (provisional "Atoms/" title pending the nav reshape).
 * EmptyState is a pure presentational primitive: it owns no state and
 * takes only a title, an optional description, an icon, a variant, and an
 * optional `action` element supplied by the parent. Every field below is a
 * real prop, driven from the Controls panel.
 */
const meta: Meta<typeof EmptyState> = {
  title: "Atoms/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Presentational placeholder for a view with no data to show, or " +
          "one that failed to load. An atom: stateless, configured entirely " +
          "by props. The host supplies any action element; the atom only " +
          "renders the slot.",
      },
    },
  },
  argTypes: {
    title: {
      control: "text",
      description: "One-line summary of the situation.",
    },
    description: {
      control: "text",
      description: "Why it is empty and what would fill it.",
    },
    variant: {
      control: { type: "inline-radio" },
      options: ["empty", "error"],
      description: "`empty` for an informational state, `error` for a failure.",
    },
    icon: {
      control: "text",
      description: "Registry icon name; defaults are chosen by variant.",
    },
    // An action is a JSX element, not a controllable scalar; the stories
    // that need one inject it in render.
    action: { table: { disable: true } },
  },
  args: {
    title: "No results found",
    description: "Try widening your filters or clearing the search.",
    variant: "empty",
  },
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Empty: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The default informational state. Edit title, description, icon, " +
          "and variant in the Controls panel.",
      },
    },
  },
};

export const WithAction: Story = {
  args: {
    title: "No saved views yet",
    description: "Create a view to pin a layout and filter set.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Same atom with an `action` element supplied by the parent. The " +
          "atom renders the slot; the behavior belongs to the host.",
      },
    },
  },
  render: (args) => (
    <EmptyState
      {...args}
      action={<button className="g3t-button">Create view</button>}
    />
  ),
};

export const ErrorState: Story = {
  name: "Error variant",
  args: {
    variant: "error",
    title: "Couldn't load the graph",
    description: "The request failed. Check the connection and retry.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "The `error` variant, for a failed load rather than an empty " +
          "result. Note the icon and emphasis change with the variant.",
      },
    },
  },
  render: (args) => (
    <EmptyState
      {...args}
      action={<button className="g3t-button">Retry</button>}
    />
  ),
};
