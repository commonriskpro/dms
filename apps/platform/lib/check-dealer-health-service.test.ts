/**
 * Unit tests for dealer-health check state machine:
 * fail -> alert once (threshold) -> still fail no spam (cooldown) -> recover -> recovery alert once.
 * Mocks: fetch (health + Slack/Resend), monitoring-db.
 */

import {
  checkDealerHealth,
  fetchDealerHealth,
  type CheckDealerHealthOptions,
} from "./check-dealer-health-service";
import type { AlertStateRow } from "./monitoring-db";

const DEALER_BASE = "https://dealer.example.com";
const REQ_ID = "test-request-id";

let mockState: AlertStateRow;
const createMonitoringEventMock = jest.fn().mockResolvedValue("event-id");
const getOrCreateDealerHealthAlertStateMock = jest.fn();
const upsertDealerHealthAlertStateMock = jest.fn().mockImplementation((params) => {
  mockState = {
    id: mockState.id,
    key: mockState.key,
    lastStatus: params.lastStatus,
    lastChangeAt: params.lastChangeAt,
    consecutiveFails: params.consecutiveFails,
    lastAlertSentAt: params.lastAlertSentAt ?? mockState.lastAlertSentAt ?? null,
  };
  return Promise.resolve(mockState);
});

jest.mock("./monitoring-db", () => ({
  createMonitoringEvent: (...args: unknown[]) => createMonitoringEventMock(...args),
  getOrCreateDealerHealthAlertState: (...args: unknown[]) =>
    getOrCreateDealerHealthAlertStateMock(...args),
  upsertDealerHealthAlertState: (...args: unknown[]) => upsertDealerHealthAlertStateMock(...args),
}));

function healthOk(status = 200) {
  return new Response(
    JSON.stringify({
      ok: true,
      app: "dealer",
      time: new Date().toISOString(),
      upstreamStatus: status,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function healthFail(upstreamStatus = 502) {
  return new Response(
    JSON.stringify({ ok: false, error: "Unavailable" }),
    { status: upstreamStatus, headers: { "Content-Type": "application/json" } }
  );
}

describe("fetchDealerHealth", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns ok true when upstream returns 200 with ok true", async () => {
    fetchMock.mockResolvedValueOnce(healthOk(200));
    const result = await fetchDealerHealth(DEALER_BASE, REQ_ID, fetchMock);
    expect(result.ok).toBe(true);
    expect(result.upstreamStatus).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `${DEALER_BASE}/api/health`,
      expect.objectContaining({ method: "GET", headers: expect.objectContaining({ "x-request-id": REQ_ID }) })
    );
  });

  it("returns ok false and upstreamStatus when upstream returns 503", async () => {
    fetchMock.mockResolvedValueOnce(healthFail(503));
    const result = await fetchDealerHealth(DEALER_BASE, REQ_ID, fetchMock);
    expect(result.ok).toBe(false);
    expect(result.upstreamStatus).toBe(503);
  });

  it("returns ok false and upstreamStatus 0 when fetch throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await fetchDealerHealth(DEALER_BASE, REQ_ID, fetchMock);
    expect(result.ok).toBe(false);
    expect(result.upstreamStatus).toBe(0);
  });
});

describe("checkDealerHealth state machine", () => {
  const slackFetchMock = jest.fn().mockResolvedValue({ ok: true });
  let healthFetchMock: ReturnType<typeof jest.fn>;

  function createFetchMock(healthResponses: Response[]) {
    let healthIndex = 0;
    return jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("api/health")) {
        return Promise.resolve(healthResponses[healthIndex++] ?? healthFail(502));
      }
      if (typeof url === "string" && (url.includes("slack") || url.includes("hooks"))) {
        return slackFetchMock(url, init);
      }
      if (typeof url === "string" && url.includes("resend.com")) {
        return Promise.resolve({ ok: true });
      }
      return Promise.reject(new Error("Unexpected fetch"));
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    slackFetchMock.mockClear();
    mockState = {
      id: "state-id",
      key: "dealer_health",
      lastStatus: "OK",
      lastChangeAt: new Date(),
      consecutiveFails: 0,
      lastAlertSentAt: null,
    };
    getOrCreateDealerHealthAlertStateMock.mockImplementation(() => Promise.resolve(mockState));
  });

  afterEach(() => {
    delete process.env.PLATFORM_SLACK_WEBHOOK_URL;
  });

  it("first fail: creates FAIL event, no alert (threshold not met)", async () => {
    process.env.PLATFORM_SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    healthFetchMock = createFetchMock([healthFail(502)]);

    const result = await checkDealerHealth({
      requestId: REQ_ID,
      dealerBaseUrl: DEALER_BASE,
      fetchFn: healthFetchMock,
    });

    expect(result.ok).toBe(false);
    expect(result.eventCreated).toBe("DEALER_HEALTH_FAIL");
    expect(result.alertSent).toBe(false);
    expect(createMonitoringEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DEALER_HEALTH_FAIL",
        dealerBaseUrl: DEALER_BASE,
        upstreamStatus: 502,
        requestId: REQ_ID,
      })
    );
    expect(slackFetchMock).not.toHaveBeenCalled();
  });

  it("threshold met (5 min since first fail): sends Slack alert once", async () => {
    process.env.PLATFORM_SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    mockState = {
      ...mockState,
      lastStatus: "FAIL",
      lastChangeAt: sixMinutesAgo,
      consecutiveFails: 1,
      lastAlertSentAt: null,
    };
    getOrCreateDealerHealthAlertStateMock.mockImplementation(() => Promise.resolve(mockState));
    healthFetchMock = createFetchMock([healthFail(502)]);

    const result = await checkDealerHealth({
      requestId: REQ_ID,
      dealerBaseUrl: DEALER_BASE,
      fetchFn: healthFetchMock,
    });

    expect(result.ok).toBe(false);
    expect(result.alertSent).toBe(true);
    expect(slackFetchMock).toHaveBeenCalledTimes(1);
    const slackBody = JSON.parse(slackFetchMock.mock.calls[0][1].body as string);
    expect(slackBody.status).toBe("outage");
    expect(slackBody.upstreamStatus).toBe(502);
    expect(slackBody.requestId).toBe(REQ_ID);
  });

  it("still failing after alert: no second Slack (cooldown)", async () => {
    process.env.PLATFORM_SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    mockState = {
      ...mockState,
      lastStatus: "FAIL",
      lastChangeAt: sixMinutesAgo,
      consecutiveFails: 2,
      lastAlertSentAt: twoMinutesAgo,
    };
    getOrCreateDealerHealthAlertStateMock.mockImplementation(() => Promise.resolve(mockState));
    healthFetchMock = createFetchMock([healthFail(502)]);

    const result = await checkDealerHealth({
      requestId: REQ_ID,
      dealerBaseUrl: DEALER_BASE,
      fetchFn: healthFetchMock,
    });

    expect(result.ok).toBe(false);
    expect(result.alertSent).toBe(false);
    expect(slackFetchMock).not.toHaveBeenCalled();
  });

  it("recovery after fail: creates RECOVER event and sends recovery alert once", async () => {
    process.env.PLATFORM_SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    mockState = {
      ...mockState,
      lastStatus: "FAIL",
      lastChangeAt: new Date(Date.now() - 10 * 60 * 1000),
      consecutiveFails: 3,
      lastAlertSentAt: new Date(Date.now() - 5 * 60 * 1000),
    };
    getOrCreateDealerHealthAlertStateMock.mockImplementation(() => Promise.resolve(mockState));
    healthFetchMock = createFetchMock([healthOk(200)]);

    const result = await checkDealerHealth({
      requestId: REQ_ID,
      dealerBaseUrl: DEALER_BASE,
      fetchFn: healthFetchMock,
    });

    expect(result.ok).toBe(true);
    expect(result.eventCreated).toBe("DEALER_HEALTH_RECOVER");
    expect(result.alertSent).toBe(true);
    expect(createMonitoringEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DEALER_HEALTH_RECOVER",
        dealerBaseUrl: DEALER_BASE,
        upstreamStatus: 200,
        requestId: REQ_ID,
      })
    );
    expect(slackFetchMock).toHaveBeenCalledTimes(1);
    const slackBody = JSON.parse(slackFetchMock.mock.calls[0][1].body as string);
    expect(slackBody.status).toBe("recovered");
    expect(slackBody.upstreamStatus).toBe(200);
  });

  it("health ok when state already OK: no event, no alert", async () => {
    healthFetchMock = createFetchMock([healthOk(200)]);

    const result = await checkDealerHealth({
      requestId: REQ_ID,
      dealerBaseUrl: DEALER_BASE,
      fetchFn: healthFetchMock,
    });

    expect(result.ok).toBe(true);
    expect(result.eventCreated).toBe(null);
    expect(result.alertSent).toBe(false);
    expect(createMonitoringEventMock).not.toHaveBeenCalled();
    expect(slackFetchMock).not.toHaveBeenCalled();
  });
});
