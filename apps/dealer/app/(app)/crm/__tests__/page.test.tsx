import React from "react";
import { render } from "@testing-library/react";

jest.mock("@/modules/crm-pipeline-automation/ui/CrmCommandCenterPage", () => ({
  CrmCommandCenterPage: jest.fn(() => null),
}));

import { CrmCommandCenterPage } from "@/modules/crm-pipeline-automation/ui/CrmCommandCenterPage";
import Page from "../page";

describe("CRM route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the CRM command center on /crm", async () => {
    render(
      <>{(await Page({ searchParams: Promise.resolve({}) })) as unknown as React.ReactNode}</>
    );
    expect(CrmCommandCenterPage).toHaveBeenCalledTimes(1);
  });

  it("passes command-center filters from search params", async () => {
    render(
      <>{(await Page({
        searchParams: Promise.resolve({
          scope: "mine",
          ownerId: "owner-1",
          stageId: "stage-1",
          status: "OPEN",
          source: "Website",
          q: "alice",
        }),
      })) as unknown as React.ReactNode}</>
    );

    expect(CrmCommandCenterPage).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: {
          scope: "mine",
          ownerId: "owner-1",
          stageId: "stage-1",
          status: "OPEN",
          source: "Website",
          q: "alice",
        },
      }),
      undefined
    );
  });
});
