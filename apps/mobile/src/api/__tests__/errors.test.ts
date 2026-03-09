import {
  isApiErrorBody,
  parseErrorResponse,
  DealerApiError,
} from "../errors";

describe("api/errors", () => {
  describe("isApiErrorBody", () => {
    it("returns true for valid error payload", () => {
      expect(isApiErrorBody({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } })).toBe(true);
    });
    it("returns false for null", () => {
      expect(isApiErrorBody(null)).toBe(false);
    });
    it("returns false for object without error", () => {
      expect(isApiErrorBody({ data: {} })).toBe(false);
    });
    it("returns false for error with missing code", () => {
      expect(isApiErrorBody({ error: { message: "x" } })).toBe(false);
    });
  });

  describe("parseErrorResponse", () => {
    it("parses server error body", () => {
      const body = { error: { code: "FORBIDDEN", message: "Insufficient permission" } };
      const err = parseErrorResponse(403, body);
      expect(err).toBeInstanceOf(DealerApiError);
      expect(err.code).toBe("FORBIDDEN");
      expect(err.message).toBe("Insufficient permission");
      expect(err.status).toBe(403);
    });
    it("returns generic message for 401 when body is not error shape", () => {
      const err = parseErrorResponse(401, null);
      expect(err.code).toBe("UNKNOWN");
      expect(err.message).toBe("Unauthorized");
      expect(err.status).toBe(401);
    });
    it("returns generic message for non-2xx when body is invalid", () => {
      const err = parseErrorResponse(500, {});
      expect(err.code).toBe("UNKNOWN");
      expect(err.message).toBe("Request failed");
    });
  });
});
