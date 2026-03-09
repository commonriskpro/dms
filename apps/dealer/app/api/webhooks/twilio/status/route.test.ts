/**
 * Tests for POST /api/webhooks/twilio/status:
 * - 401 when signature invalid.
 * - 200 when signature valid and payload has MessageSid + MessageStatus.
 */
jest.mock("@/modules/integrations/service/webhooks", () => ({
  verifyTwilioSignature: jest.fn(),
  handleTwilioStatusCallback: jest.fn(),
}));

import { POST } from "./route";
import * as webhooks from "@/modules/integrations/service/webhooks";
import type { NextRequest } from "next/server";

describe("POST /api/webhooks/twilio/status", () => {
  const validUrl = "https://example.com/api/webhooks/twilio/status";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    (webhooks.verifyTwilioSignature as jest.Mock).mockResolvedValue(true);
    (webhooks.handleTwilioStatusCallback as jest.Mock).mockResolvedValue(true);
  });

  function request(body: string, signature?: string): NextRequest {
    return {
      text: () => Promise.resolve(body),
      url: validUrl,
      headers: new Headers(
        signature != null ? { "x-twilio-signature": signature } : undefined
      ),
    } as unknown as NextRequest;
  }

  it("returns 401 when signature invalid", async () => {
    (webhooks.verifyTwilioSignature as jest.Mock).mockResolvedValue(false);
    const req = request("MessageSid=SM123&MessageStatus=delivered", "bad");
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(webhooks.handleTwilioStatusCallback).not.toHaveBeenCalled();
  });

  it("returns 200 and calls handleTwilioStatusCallback when valid", async () => {
    const req = request("MessageSid=SM123&MessageStatus=delivered", "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(webhooks.handleTwilioStatusCallback).toHaveBeenCalledWith({
      MessageSid: "SM123",
      MessageStatus: "delivered",
    });
  });
});
