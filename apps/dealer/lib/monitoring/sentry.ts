/**
 * Sentry stubs (removed for now). No-op implementations so callers need not change.
 */
export function initServerSentry(): void {
  // no-op
}

export type CaptureApiExceptionOpts = {
  app: string;
  requestId?: string;
  route?: string;
  method?: string;
  platformUserId?: string;
  dealershipId?: string;
};

export function captureApiException(_err: unknown, _opts: CaptureApiExceptionOpts): void {
  // no-op
}
