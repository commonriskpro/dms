# Dealer API helpers

## Request logging and correlation (Step 7 – Operational Maturity)

- **withApiLogging**: Wraps an API handler to ensure request ID (from `X-Request-Id` or generated), one JSON log line per request (ts, level, app, env, requestId, route, method, status, durationMs), and `X-Request-Id` set on the response.
- **Usage**: For `/api/*` and `/api/internal/*` routes, wrap the handler so every response is logged and correlated:
  ```ts
  import { withApiLogging } from "@/lib/api/with-api-logging";
  export const GET = withApiLogging(async (request: NextRequest, context?) => { ... });
  export const POST = withApiLogging(async (request: NextRequest, context?) => { ... });
  ```
- **Representative route**: `app/api/health/route.ts` uses this pattern. Other dealer API routes can use `withApiLogging` for consistent correlation IDs and structured logging.
