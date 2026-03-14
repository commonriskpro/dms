/**
 * Tests that dealer-editable website schemas reject raw HTML, script, and arbitrary markup.
 * Dealer side = template/configuration only; platform controls template code.
 *
 * @jest-environment node
 */

import {
  updateWebsitePageBodySchema,
  updateWebsiteSiteBodySchema,
  updateVehicleWebsiteSettingsBodySchema,
  updateWebsiteLeadFormBodySchema,
  websiteSectionConfigSchema,
  isSafeContentString,
} from "@dms/contracts";

describe("isSafeContentString", () => {
  it("allows plain text", () => {
    expect(isSafeContentString("Hello world")).toBe(true);
    expect(isSafeContentString("Open Sans")).toBe(true);
  });

  it("rejects angle brackets (HTML)", () => {
    expect(isSafeContentString("<div>")).toBe(false);
    expect(isSafeContentString(">")).toBe(false);
    expect(isSafeContentString("a<b")).toBe(false);
  });

  it("rejects script tags", () => {
    expect(isSafeContentString("<script>alert(1)</script>")).toBe(false);
    expect(isSafeContentString("</script>")).toBe(false);
  });

  it("rejects javascript: URLs", () => {
    expect(isSafeContentString("javascript:alert(1)")).toBe(false);
  });

  it("rejects event handlers", () => {
    expect(isSafeContentString("onerror=alert(1)")).toBe(false);
    expect(isSafeContentString("onload=evil()")).toBe(false);
  });
});

describe("updateWebsitePageBodySchema — no raw markup", () => {
  it("accepts safe seoTitle and seoDescription", () => {
    const r = updateWebsitePageBodySchema.safeParse({
      seoTitle: "Best Cars in Town",
      seoDescription: "Find your next vehicle.",
    });
    expect(r.success).toBe(true);
  });

  it("rejects seoTitle with HTML", () => {
    const r = updateWebsitePageBodySchema.safeParse({
      seoTitle: "<script>alert(1)</script>",
    });
    expect(r.success).toBe(false);
  });

  it("rejects seoDescription with script", () => {
    const r = updateWebsitePageBodySchema.safeParse({
      seoDescription: "Welcome. javascript:void(0)",
    });
    expect(r.success).toBe(false);
  });

  it("accepts valid sectionsConfigJson (allowlisted shape)", () => {
    const r = updateWebsitePageBodySchema.safeParse({
      sectionsConfigJson: { show_hero: true, section_order: 1 },
    });
    expect(r.success).toBe(true);
  });

  it("rejects sectionsConfigJson with HTML in string value", () => {
    const r = updateWebsitePageBodySchema.safeParse({
      sectionsConfigJson: { heading: "<img onerror=alert(1)>" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects sectionsConfigJson with invalid key (hyphen)", () => {
    const r = updateWebsitePageBodySchema.safeParse({
      sectionsConfigJson: { "section-name": true },
    });
    expect(r.success).toBe(false);
  });
});

describe("updateWebsiteSiteBodySchema — safe name and template", () => {
  it("rejects name with HTML", () => {
    const r = updateWebsiteSiteBodySchema.safeParse({
      name: "Acme <b>Motors</b>",
    });
    expect(r.success).toBe(false);
  });

  it("accepts safe name", () => {
    const r = updateWebsiteSiteBodySchema.safeParse({ name: "Acme Motors" });
    expect(r.success).toBe(true);
  });
});

describe("updateVehicleWebsiteSettingsBodySchema — safe custom text", () => {
  it("rejects customHeadline with script", () => {
    const r = updateVehicleWebsiteSettingsBodySchema.safeParse({
      customHeadline: "<script>alert(1)</script>",
    });
    expect(r.success).toBe(false);
  });

  it("rejects customDescription with HTML", () => {
    const r = updateVehicleWebsiteSettingsBodySchema.safeParse({
      customDescription: "Great car. <iframe src='evil.com'>",
    });
    expect(r.success).toBe(false);
  });

  it("accepts safe customHeadline and customDescription", () => {
    const r = updateVehicleWebsiteSettingsBodySchema.safeParse({
      customHeadline: "Low miles",
      customDescription: "One owner. Clean title.",
    });
    expect(r.success).toBe(true);
  });
});

describe("updateWebsiteLeadFormBodySchema — allowlisted routing only", () => {
  it("accepts routingConfigJson with notificationEmail and assignToUserId only", () => {
    const r = updateWebsiteLeadFormBodySchema.safeParse({
      routingConfigJson: {
        notificationEmail: "sales@dealer.com",
        assignToUserId: "00000000-0000-0000-0000-000000000001",
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects routingConfigJson with unknown keys (strict)", () => {
    const r = updateWebsiteLeadFormBodySchema.safeParse({
      routingConfigJson: {
        notificationEmail: "a@b.com",
        rawHtml: "<script>evil</script>",
      },
    });
    expect(r.success).toBe(false);
  });
});

describe("websiteSectionConfigSchema — primitive values only", () => {
  it("accepts boolean and number values", () => {
    const r = websiteSectionConfigSchema.safeParse({
      show_hero: true,
      order: 2,
    });
    expect(r.success).toBe(true);
  });

  it("rejects nested objects in section config", () => {
    const r = websiteSectionConfigSchema.safeParse({
      section: { nested: "value" },
    });
    expect(r.success).toBe(false);
  });
});
