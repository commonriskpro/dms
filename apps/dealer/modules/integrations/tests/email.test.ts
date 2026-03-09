/** @jest-environment node */
/**
 * Email service: sendEmailMessage validates customer, sends via SendGrid, logs activity.
 * SendGrid and env are mocked.
 */
import { ApiError } from "@/lib/auth";
import * as customerService from "@/modules/customers/service/customer";
import * as activityService from "@/modules/customers/service/activity";

jest.mock("@/modules/customers/service/customer");
jest.mock("@/modules/customers/service/activity");

const mockGetCustomer = customerService.getCustomer as jest.MockedFunction<typeof customerService.getCustomer>;
const mockLogMessageSent = activityService.logMessageSent as jest.MockedFunction<typeof activityService.logMessageSent>;

const sendMock = jest.fn().mockResolvedValue(undefined);
jest.mock("@sendgrid/mail", () => ({
  __esModule: true,
  default: { setApiKey: jest.fn(), send: sendMock },
}), { virtual: true });

import * as emailService from "../service/email";

const dealerId = "d1000000-0000-0000-0000-000000000001";
const customerId = "c1000000-0000-0000-0000-000000000001";
const userId = "u1000000-0000-0000-0000-000000000001";

describe("Email service", () => {
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
    process.env.SENDGRID_API_KEY = "key";

    await expect(
      emailService.sendEmailMessage(
        dealerId,
        customerId,
        "cust@example.com",
        "Subject",
        "Body",
        userId
      )
    ).rejects.toThrow(ApiError);

    expect(mockGetCustomer).toHaveBeenCalledWith(dealerId, customerId);
    expect(mockLogMessageSent).not.toHaveBeenCalled();
  });

  it("throws when SendGrid API key is not configured", async () => {
    delete process.env.SENDGRID_API_KEY;

    await expect(
      emailService.sendEmailMessage(
        dealerId,
        customerId,
        "cust@example.com",
        "Subject",
        "Body",
        userId
      )
    ).rejects.toThrow("Email provider not configured");

    expect(mockGetCustomer).toHaveBeenCalledWith(dealerId, customerId);
    expect(mockLogMessageSent).not.toHaveBeenCalled();
  });

  it("calls logMessageSent with direction, contentPreview from subject, channel after send", async () => {
    process.env.SENDGRID_API_KEY = "key";

    const result = await emailService.sendEmailMessage(
      dealerId,
      customerId,
      "cust@example.com",
      "Test subject",
      "Body text",
      userId
    );

    expect(mockGetCustomer).toHaveBeenCalledWith(dealerId, customerId);
    expect(sendMock).toHaveBeenCalled();
    expect(mockLogMessageSent).toHaveBeenCalledWith(
      dealerId,
      userId,
      customerId,
      "email_sent",
      expect.objectContaining({
        direction: "outbound",
        contentPreview: "Test subject",
        channel: "email",
      })
    );
    expect(result.activityId).toBe("act-1");
  });

  it("uses body slice for contentPreview when subject is empty", async () => {
    process.env.SENDGRID_API_KEY = "key";

    await emailService.sendEmailMessage(
      dealerId,
      customerId,
      "cust@example.com",
      "   ",
      "Body only content here",
      userId
    );

    expect(mockLogMessageSent).toHaveBeenCalledWith(
      dealerId,
      userId,
      customerId,
      "email_sent",
      expect.objectContaining({
        contentPreview: "Body only content here",
      })
    );
  });

  it("does not call logMessageSent when SendGrid send throws", async () => {
    process.env.SENDGRID_API_KEY = "key";
    sendMock.mockRejectedValueOnce(new Error("SendGrid error"));

    await expect(
      emailService.sendEmailMessage(
        dealerId,
        customerId,
        "cust@example.com",
        "Subject",
        "Body",
        userId
      )
    ).rejects.toThrow("SendGrid error");

    expect(mockLogMessageSent).not.toHaveBeenCalled();
  });
});
