import { getQueryObject } from "./query";

describe("getQueryObject", () => {
  it("returns a plain object from request search params", () => {
    const request = {
      nextUrl: {
        searchParams: new URLSearchParams("limit=25&offset=0&status=ACTIVE"),
      },
    } as Parameters<typeof getQueryObject>[0];

    expect(getQueryObject(request)).toEqual({
      limit: "25",
      offset: "0",
      status: "ACTIVE",
    });
  });
});

