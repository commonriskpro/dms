import { listPayload } from "./list-response";

describe("listPayload", () => {
  it("builds canonical list response shape", () => {
    const out = listPayload([{ id: "1" }, { id: "2" }], 42, 25, 0);

    expect(out).toEqual({
      data: [{ id: "1" }, { id: "2" }],
      meta: { total: 42, limit: 25, offset: 0 },
    });
  });
});

