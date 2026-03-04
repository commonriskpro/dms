/**
 * Platform users UI helpers: invite button is only visible for PLATFORM_OWNER.
 */
import { isInviteButtonVisible } from "./platform-users-ui";

describe("platform-users-ui", () => {
  describe("isInviteButtonVisible", () => {
    it("returns false for non-OWNER roles (e.g. PLATFORM_SUPPORT)", () => {
      expect(isInviteButtonVisible("PLATFORM_SUPPORT")).toBe(false);
      expect(isInviteButtonVisible("PLATFORM_COMPLIANCE")).toBe(false);
    });

    it("returns false when role is null", () => {
      expect(isInviteButtonVisible(null)).toBe(false);
    });

    it("returns true only for PLATFORM_OWNER", () => {
      expect(isInviteButtonVisible("PLATFORM_OWNER")).toBe(true);
    });
  });
});
