import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { PaginationControl } from "./PaginationControl";

const meta: Meta<typeof PaginationControl> = {
  title: "Molecules/PaginationControl",
  component: PaginationControl,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "The shared prev/next control for views that page past a " +
          "working-set limit (issue #6). State is the caller's: pass a " +
          "zero-based `page`, the `pageSize` and the `total`; the control " +
          'derives "Page X of Y" and the "rows 1 to 200 of 350" ' +
          "summary. ArrowLeft/ArrowRight move a page and Home/End jump " +
          "from anywhere inside it. MatrixView renders one per axis.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PaginationControl>;

export const Rows: Story = {
  render: () => {
    const [page, setPage] = useState(0);
    return (
      <div style={{ width: 420 }}>
        <PaginationControl
          page={page}
          pageSize={200}
          total={350}
          noun="rows"
          onPageChange={setPage}
        />
      </div>
    );
  },
};

export const WithPageSize: Story = {
  render: () => {
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    return (
      <div style={{ width: 520 }}>
        <PaginationControl
          page={page}
          pageSize={pageSize}
          total={1_234}
          noun="rows"
          onPageChange={setPage}
          pageSizeOptions={[25, 50, 100]}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(0);
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "`pageSizeOptions` with `onPageSizeChange` adds the per-page " +
          "select; the host resets the page when the size changes.",
      },
    },
  },
};

export const EstimatedTotal: Story = {
  render: () => {
    const [page, setPage] = useState(0);
    return (
      <div style={{ width: 460 }}>
        <PaginationControl
          page={page}
          pageSize={50}
          total={12_000}
          totalExact={false}
          onPageChange={setPage}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          "`totalExact={false}` is for a backend that answers with an " +
          'estimate rather than a count; the summary says "about".',
      },
    },
  },
};
