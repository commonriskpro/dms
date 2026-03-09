import * as React from "react";
import { render, screen } from "@testing-library/react";
import { ActivityTimeline, TimelineItem } from "@/components/ui-system/timeline";

describe("activity timeline primitives", () => {
  it("renders empty state when no items are provided", () => {
    render(
      <ActivityTimeline title="History" emptyTitle="No events" emptyDescription="Nothing happened yet">
        {null}
      </ActivityTimeline>
    );

    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("No events")).toBeInTheDocument();
    expect(screen.getByText("Nothing happened yet")).toBeInTheDocument();
  });

  it("renders timeline items with title and timestamp", () => {
    render(
      <ActivityTimeline title="History">
        <TimelineItem title="DRAFT -> APPROVED" timestamp="2026-03-07 10:00 AM" detail="by user" />
      </ActivityTimeline>
    );

    expect(screen.getByText("DRAFT -> APPROVED")).toBeInTheDocument();
    expect(screen.getByText("2026-03-07 10:00 AM")).toBeInTheDocument();
    expect(screen.getByText("by user")).toBeInTheDocument();
  });
});
