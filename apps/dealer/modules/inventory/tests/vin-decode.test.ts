/**
 * VIN decode: mock NHTSA fetch; assert request and response mapping;
 * invalid VIN or API error returns appropriate error.
 */
import { decodeVin as decodeVinFromApi } from "../service/vin";

const mockFetch = jest.fn();

describe("VIN decode", () => {
  beforeEach(() => {
    (globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;
    mockFetch.mockReset();
  });

  it("calls NHTSA DecodeVinValues URL with VIN", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Count: 1,
        Results: [
          {
            ModelYear: "2020",
            Make: "HONDA",
            Model: "Civic",
            Trim: "EX",
          },
        ],
      }),
    });
    await decodeVinFromApi("1HGBH41JXMN109186");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("DecodeVinValues");
    expect(url).toContain("1HGBH41JXMN109186");
    expect(url).toContain("format=json");
  });

  it("maps NHTSA response to flat shape (year, make, model, trim)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Count: 1,
        Results: [
          {
            ModelYear: "2021",
            Make: "TOYOTA",
            Model: "Camry",
            Trim: "LE",
            BodyClass: "Sedan",
          },
        ],
      }),
    });
    const result = await decodeVinFromApi("4T1BF1FK5MU512345");
    expect(result.year).toBe(2021);
    expect(result.make).toBe("TOYOTA");
    expect(result.model).toBe("Camry");
    expect(result.trim).toBe("LE");
    expect(result.bodyClass).toBe("Sedan");
  });

  it("returns empty object when NHTSA returns no results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Count: 0, Results: [] }),
    });
    const result = await decodeVinFromApi("INVALID00");
    expect(result).toEqual({});
  });

  it("throws when NHTSA API returns non-ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });
    await expect(decodeVinFromApi("BADVIN00000000001")).rejects.toThrow("NHTSA API error");
  });

  it("uses cache on second call with same VIN within TTL", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        Count: 1,
        Results: [{ ModelYear: "2020", Make: "FORD", Model: "F-150", Trim: "XLT" }],
      }),
    });
    const r1 = await decodeVinFromApi("1FTFW1E84LFA00001");
    const r2 = await decodeVinFromApi("1FTFW1E84LFA00001");
    expect(r1).toEqual(r2);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
