import * as React from "react";
import { render, screen } from "@testing-library/react";
import { QueueKpiStrip, QueueLayout, QueueTable } from "@/components/ui-system/queues";

describe("queue primitives", () => {
  it("renders queue layout shell with title and table content", () => {
    render(
      <QueueLayout
        title="Funding queue"
        description="Queue description"
        kpis={<QueueKpiStrip items={[{ label: "Open", value: 12 }]} />}
        table={<QueueTable state="default"><div>rows</div></QueueTable>}
      />
    );

    expect(screen.getByText("Funding queue")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("rows")).toBeInTheDocument();
  });

  it("renders shared empty state through queue table", () => {
    render(
      <QueueTable state="empty" emptyTitle="No queue items" emptyDescription="Queue is clear">
        <div>hidden</div>
      </QueueTable>
    );

    expect(screen.getByText("No queue items")).toBeInTheDocument();
    expect(screen.getByText("Queue is clear")).toBeInTheDocument();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });
});
