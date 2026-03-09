import { ENABLE_PUSH_NOTIFICATIONS, getPushFeatureEnabled } from "../features";
import { registerForPushIfEnabled } from "@/services/push";

describe("config/features", () => {
  it("ENABLE_PUSH_NOTIFICATIONS is false by default", () => {
    expect(ENABLE_PUSH_NOTIFICATIONS).toBe(false);
  });
  it("getPushFeatureEnabled returns false when push is disabled", () => {
    expect(getPushFeatureEnabled()).toBe(false);
  });
  it("registerForPushIfEnabled returns disabled when push is off", async () => {
    const result = await registerForPushIfEnabled();
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("disabled");
  });
});
