/**
 * Unit tests for SegmentedJourneyBar: segment states, signals, next best action, permission gating.
 */
import React from "react";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import { SegmentedJourneyBar } from "../SegmentedJourneyBar";
import type { JourneyBarStage, JourneyBarSignals } from "../types";

const mockStages: JourneyBarStage[] = [
  { id: "s1", name: "Lead", order: 0, colorKey: "blue" },
  { id: "s2", name: "Qualified", order: 1, colorKey: "green" },
  { id: "s3", name: "Proposal", order: 2, colorKey: null },
];

describe("SegmentedJourneyBar", () => {
  afterEach(() => cleanup());

  it("renders segments with completed, current, and upcoming states", () => {
    render(
      <SegmentedJourneyBar
        stages={mockStages}
        currentStageId="s2"
        currentIndex={1}
        canChangeStage={false}
      />
    );
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("Proposal")).toBeInTheDocument();
  });

  it("shows signals when provided", () => {
    const signals: JourneyBarSignals = {
      overdueTaskCount: 3,
      nextAppointment: { id: "a1", start: "2025-06-01T10:00:00Z" },
      lastActivityAt: "2025-01-01T00:00:00Z",
    };
    render(
      <SegmentedJourneyBar
        stages={mockStages}
        currentStageId="s1"
        signals={signals}
        canChangeStage={false}
      />
    );
    expect(screen.getByText(/3 overdue task/)).toBeInTheDocument();
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
  });

  it("shows next best action when nextBestActionKey is provided", () => {
    render(
      <SegmentedJourneyBar
        stages={mockStages}
        currentStageId="s1"
        nextBestActionKey="schedule_appointment"
        canChangeStage={false}
      />
    );
    expect(screen.getByText(/Next: Schedule appointment/)).toBeInTheDocument();
  });

  it("does not show transition popover when canChangeStage is false", () => {
    render(
      <SegmentedJourneyBar
        stages={mockStages}
        currentStageId="s2"
        canChangeStage={false}
      />
    );
    const progressbars = screen.getAllByRole("progressbar");
    const progressbar = progressbars[0];
    const buttons = within(progressbar).queryAllByRole("button");
    expect(buttons.length).toBe(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows clickable segments and popover when canChangeStage is true", async () => {
    const onStageChange = jest.fn().mockResolvedValue(undefined);
    render(
      <SegmentedJourneyBar
        stages={mockStages}
        currentStageId="s2"
        canChangeStage={true}
        onStageChange={onStageChange}
      />
    );
    const currentButton = screen.getByRole("button", { name: /Qualified/ });
    fireEvent.click(currentButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    const proposalButton = within(dialog).getByRole("button", { name: /^Proposal$/ });
    fireEvent.click(proposalButton);
    expect(onStageChange).toHaveBeenCalledWith("s3");
  });

  it("renders empty state when stages array is empty", () => {
    render(
      <SegmentedJourneyBar
        stages={[]}
        currentStageId={null}
        canChangeStage={false}
      />
    );
    expect(screen.getByText(/No stages in pipeline/)).toBeInTheDocument();
  });
});
