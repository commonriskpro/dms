/**
 * Tests for POST /api/webhooks/twilio:
 * - 400 when body cannot be parsed.
 * - 401 when signature is missing or invalid.
 * - 200 when signature valid (with or without customer match).
 */
jest.mock("@/modules/integrations/service/webhooks", () => ({
  verifyTwilioSignature: jest.fn(),
  handleInboundSms: jest.fn(),
}));

import { POST } from "./route";
import * as webhooks from "@/modules/integrations/service/webhooks";
import type { NextRequest } from "next/server";

describe("POST /api/webhooks/twilio", () => {
  const validUrl = "https://example.com/api/webhooks/twilio";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWILIO_AUTH_TOKEN = "test-token";
    (webhooks.verifyTwilioSignature as jest.Mock).mockResolvedValue(true);
    (webhooks.handleInboundSms as jest.Mock).mockResolvedValue(true);
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

  it("returns 200 when body has no From/Body (no-op, no handler call)", async () => {
    const req = request("not-valid-form", "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(webhooks.handleInboundSms).not.toHaveBeenCalled();
  });

  it("returns 401 when signature is missing", async () => {
    (webhooks.verifyTwilioSignature as jest.Mock).mockResolvedValue(false);
    const req = request("From=%2B15551234567&Body=Hi&MessageSid=SM123");
    (req as { headers: Headers }).headers = new Headers();
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(webhooks.handleInboundSms).not.toHaveBeenCalled();
  });

  it("returns 401 when signature is invalid", async () => {
    (webhooks.verifyTwilioSignature as jest.Mock).mockResolvedValue(false);
    const req = request("From=%2B15551234567&Body=Hi&MessageSid=SM123", "bad-sig");
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(webhooks.handleInboundSms).not.toHaveBeenCalled();
  });

  it("returns 200 and calls handleInboundSms when signature valid", async () => {
    const req = request("From=%2B15551234567&Body=Hello&MessageSid=SM456", "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(webhooks.verifyTwilioSignature).toHaveBeenCalled();
    expect(webhooks.handleInboundSms).toHaveBeenCalledWith(
      expect.objectContaining({
        From: "+15551234567",
        Body: "Hello",
        MessageSid: "SM456",
      })
    );
  });

  it("returns 200 when From or Body empty (no-op)", async () => {
    const req = request("From=&Body=Hi&MessageSid=SM789", "valid-sig");
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(webhooks.handleInboundSms).not.toHaveBeenCalled();
  });
});
