import {
  getPendingInviteToken,
  setPendingInviteToken,
  clearPendingInviteToken,
} from "../pending-invite";

describe("pending-invite", () => {
  beforeEach(() => {
    clearPendingInviteToken();
  });

  it("returns null when no token set", () => {
    expect(getPendingInviteToken()).toBeNull();
  });

  it("returns token after set", () => {
    setPendingInviteToken("abc123");
    expect(getPendingInviteToken()).toBe("abc123");
  });

  it("returns null after clear", () => {
    setPendingInviteToken("abc123");
    clearPendingInviteToken();
    expect(getPendingInviteToken()).toBeNull();
  });
});
