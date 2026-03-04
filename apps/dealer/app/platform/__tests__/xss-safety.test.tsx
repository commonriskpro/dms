/**
 * XSS safety: user-controlled content (dealership name, email) is rendered as text,
 * not executed. Assert that script/img payloads appear escaped and no script runs.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import PlatformDealershipsPage from "../dealerships/page";

const mockApiFetch = vi.fn();
const mockAddToast = vi.fn();
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: "authenticated" as const },
    platformAdmin: { isAdmin: true },
  }),
}));

vi.mock("@/lib/client/http", () => ({
  apiFetch: (url: string, init?: RequestInit) => mockApiFetch(url, init),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

describe("Platform page XSS safety", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockAddToast.mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
  });

  it("renders user-controlled dealership name as text (script payload not executed)", async () => {
    const xssPayload = "<script>alert(1)</script>";
    mockApiFetch.mockResolvedValue({
      data: [
        {
          id: "d1",
          name: xssPayload,
          slug: "xss",
          isActive: true,
          createdAt: new Date().toISOString(),
          locationsCount: 0,
          membersCount: 0,
        },
      ],
      meta: { total: 1, limit: 20, offset: 0 },
    });

    render(<PlatformDealershipsPage />);

    const nameCell = await screen.findByText(xssPayload);
    expect(nameCell).toBeInTheDocument();
    expect(nameCell.tagName).not.toBe("SCRIPT");
    const scripts = document.querySelectorAll("script");
    const dangerousScripts = Array.from(scripts).filter(
      (s) => s.textContent?.includes("alert(1)") ?? false
    );
    expect(dangerousScripts).toHaveLength(0);
  });

  it("renders img onerror payload as text (not executed)", async () => {
    const imgPayload = '<img onerror="alert(1)" src="x">';
    mockApiFetch.mockResolvedValue({
      data: [
        {
          id: "d2",
          name: imgPayload,
          slug: "img",
          isActive: true,
          createdAt: new Date().toISOString(),
          locationsCount: 0,
          membersCount: 0,
        },
      ],
      meta: { total: 1, limit: 20, offset: 0 },
    });

    render(<PlatformDealershipsPage />);

    const nameCell = await screen.findByText(imgPayload);
    expect(nameCell).toBeInTheDocument();
    const imgs = document.querySelectorAll('img[onerror]');
    expect(imgs).toHaveLength(0);
  });
});
