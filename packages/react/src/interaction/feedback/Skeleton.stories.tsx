import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "./Skeleton";

/**
 * Atoms-layer story (provisional "Atoms/" title pending the nav reshape).
 * Skeleton is a stateless loading placeholder: `text` renders shimmering
 * line bars, `block` a single filled rectangle. Size it with `lines` (text)
 * or `height`/`width` (block).
 */
const meta: Meta<typeof Skeleton> = {
  title: "Atoms/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Loading placeholder primitive. Stateless and presentational; " +
          "shown while a view's data is in flight.",
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: "inline-radio" },
      options: ["text", "block"],
      description: "`text` for line bars, `block` for a filled rectangle.",
    },
    lines: {
      control: { type: "number", min: 1, max: 8 },
      description: "Line count (text variant).",
    },
    height: {
      control: { type: "number", min: 16, max: 400, step: 4 },
      description: "Block height in px (block variant).",
    },
    width: {
      control: "text",
      description: 'Width as a CSS value (e.g. "100%" or "240").',
    },
    className: { table: { disable: true } },
  },
  args: { variant: "text", lines: 3, height: 96, width: "100%" },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Text: Story = {
  args: { variant: "text", lines: 3 },
  parameters: {
    docs: {
      description: {
        story:
          "Line-bar placeholder for text content; set the line count in Controls.",
      },
    },
  },
};

export const Block: Story = {
  args: { variant: "block", height: 120 },
  parameters: {
    docs: {
      description: {
        story:
          "Filled-rectangle placeholder for an image, chart, or panel; set " +
          "height and width in Controls.",
      },
    },
  },
};
