/**
 * Optional publish-triggered revalidation: call the websites app revalidate endpoint.
 * When WEBSITES_REVALIDATE_URL and WEBSITES_REVALIDATE_SECRET are set, POST after publish/rollback.
 * Fire-and-forget — does not block the response.
 */

const REVALIDATE_URL = process.env.WEBSITES_REVALIDATE_URL;
const REVALIDATE_SECRET = process.env.WEBSITES_REVALIDATE_SECRET;

export function triggerWebsitesRevalidate(): void {
  if (!REVALIDATE_URL || !REVALIDATE_SECRET) return;

  const url = REVALIDATE_URL.replace(/\/$/, "");
  const secret = REVALIDATE_SECRET;
  const revalidateUrl = url.includes("/api/revalidate") ? url : `${url}/api/revalidate`;

  fetch(revalidateUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-revalidate-secret": secret,
    },
    body: JSON.stringify({ secret }),
  }).catch((err) => {
    console.error("[websites/revalidate] Failed to trigger revalidation:", err);
  });
}
