/**
 * XSS safety: activity metadata and untrusted strings are rendered as text, not HTML.
 */
import React from "react";
import { render } from "@testing-library/react";

const MALICIOUS = '<img src=x onerror=alert(1)>';

function ActivityItem({ metadata }: { metadata: Record<string, unknown> | null }) {
  return (
    <li className="rounded border p-2 text-sm">
      {metadata && Object.keys(metadata).length > 0 && (
        <pre className="mt-1 overflow-auto text-xs">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </li>
  );
}

describe("XSS safety: activity metadata", () => {
  it("metadata containing script-like string is rendered as literal text and creates no img/script elements", () => {
    const metadata = { note: MALICIOUS };
    const { container: div } = render(<ActivityItem metadata={metadata} />);
    const text = div.textContent ?? "";
    expect(text).toContain(MALICIOUS);
    const imgs = div.querySelectorAll("img");
    const scripts = div.querySelectorAll("script");
    expect(imgs.length).toBe(0);
    expect(scripts.length).toBe(0);
  });

  it("metadata with JSON.stringify is safe (no dangerouslySetInnerHTML)", () => {
    const metadata = { x: "<script>alert(1)</script>" };
    const { container: div } = render(<ActivityItem metadata={metadata} />);
    expect(div.textContent).toContain("<script>");
    expect(div.querySelector("script")).toBeNull();
  });
});
