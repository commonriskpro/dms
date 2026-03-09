/** @jest-environment node */
/**
 * SMS service: sendSmsMessage validates customer, calls Twilio, logs activity.
 * Twilio and env are mocked.
 */
import { ApiError } from "@/lib/auth";
import * as customerService from "@/modules/customers/service/customer";
import * as activityService from "@/modules/customers/service/activity";

jest.mock("@/modules/customers/service/customer");
jest.mock("@/modules/customers/service/activity");

const mockGetCustomer = customerService.getCustomer as jest.MockedFunction<typeof customerService.getCustomer>;
const mockLogMessageSent = activityService.logMessageSent as jest.MockedFunction<typeof activityService.logMessageSent>;

const twilioCreate = jest.fn().mockResolvedValue({ sid: "SM123" });
jest.mock("twilio", () => ({
  __esModule: true,
  default: () => ({ messages: { create: twilioCreate } }),
}), { virtual: true });

import * as smsService from "../service/sms";

const dealerId = "d1000000-0000-0000-0000-000000000001";
const customerId = "c1000000-0000-0000-0000-000000000001";
const userId = "u1000000-0000-0000-0000-000000000001";

describe("SMS service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockGetCustomer.mockResolvedValue(undefined);
    mockLogMessageSent.mockResolvedValue({ id: "act-1" } as never);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("throws NOT_FOUND when customer does not exist", async () => {
    mockGetCustomer.mockRejectedValue(new ApiError("NOT_FOUND", "Customer not found"));
    process.env.TWILIO_ACCOUNT_SID = "sid";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";

    await expect(
      smsService.sendSmsMessage(dealerId, customerId, "+15551234567", "Hi", userId)
    ).rejects.toThrow(ApiError);

    expect(mockGetCustomer).toHaveBeenCalledWith(dealerId, customerId);
    expect(mockLogMessageSent).not.toHaveBeenCalled();
  });

  it("throws when Twilio env is not configured", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;

    await expect(
      smsService.sendSmsMessage(dealerId, customerId, "+15551234567", "Hi", userId)
    ).rejects.toThrow("SMS provider not configured");

    expect(mockGetCustomer).toHaveBeenCalledWith(dealerId, customerId);
    expect(mockLogMessageSent).not.toHaveBeenCalled();
  });

  it("calls logMessageSent with direction, contentPreview (max 80), channel after send", async () => {
    process.env.TWILIO_ACCOUNT_SID = "sid";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";

    const result = await smsService.sendSmsMessage(
      dealerId,
      customerId,
      "+15559876543",
      "Hello, this is a test message",
      userId
    );

    expect(mockGetCustomer).toHaveBeenCalledWith(dealerId, customerId);
    expect(mockLogMessageSent).toHaveBeenCalledWith(
      dealerId,
      userId,
      customerId,
      "sms_sent",
      expect.objectContaining({
        direction: "outbound",
        contentPreview: "Hello, this is a test message",
        channel: "sms",
      })
    );
    expect(result.activityId).toBe("act-1");
  });

  it("truncates contentPreview to 80 chars", async () => {
    process.env.TWILIO_ACCOUNT_SID = "sid";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";

    const longMessage = "a".repeat(120);
    await smsService.sendSmsMessage(dealerId, customerId, "+15551111111", longMessage, userId);

    expect(mockLogMessageSent).toHaveBeenCalledWith(
      dealerId,
      userId,
      customerId,
      "sms_sent",
      expect.objectContaining({
        contentPreview: "a".repeat(80),
      })
    );
  });

  it("does not call logMessageSent when Twilio send throws", async () => {
    process.env.TWILIO_ACCOUNT_SID = "sid";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_PHONE_NUMBER = "+15551234567";
    twilioCreate.mockRejectedValueOnce(new Error("Twilio error"));

    await expect(
      smsService.sendSmsMessage(dealerId, customerId, "+15551234567", "Hi", userId)
    ).rejects.toThrow("Twilio error");

    expect(mockLogMessageSent).not.toHaveBeenCalled();
  });
});
