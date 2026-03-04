"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { HttpError } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ResolveData = {
  data: {
    inviteId: string;
    dealershipName: string;
    roleName: string;
    expiresAt?: string;
    emailMasked?: string;
  };
};

type AcceptData = {
  data: {
    membershipId: string;
    dealershipId: string;
    alreadyHadMembership?: boolean;
  };
};

/** Error code from resolve/accept API for branching UI. */
type InviteErrorCode =
  | "INVITE_EXPIRED"
  | "INVITE_ALREADY_ACCEPTED"
  | "INVITE_NOT_FOUND"
  | "EMAIL_ALREADY_REGISTERED";

/** Field errors from API 400/403. Token never echoed. */
type FieldErrors = Record<string, string>;

/** Extract invite token from pasted value: full accept-invite URL or raw token. */
function parseTokenFromPaste(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    if (trimmed.includes("accept-invite") && trimmed.includes("token=")) {
      const url = trimmed.startsWith("http") ? trimmed : `https://dummy.example${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
      const parsed = new URL(url);
      return parsed.searchParams.get("token") ?? trimmed;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

function getInviteErrorCode(e: unknown): InviteErrorCode | null {
  if (e instanceof HttpError && e.code) {
    if (
      e.code === "INVITE_EXPIRED" ||
      e.code === "INVITE_ALREADY_ACCEPTED" ||
      e.code === "INVITE_NOT_FOUND" ||
      e.code === "EMAIL_ALREADY_REGISTERED"
    )
      return e.code as InviteErrorCode;
  }
  return null;
}

function getFieldErrors(e: unknown): FieldErrors | null {
  if (e instanceof HttpError && e.details && typeof e.details === "object" && "fieldErrors" in e.details) {
    const fe = (e.details as { fieldErrors?: FieldErrors }).fieldErrors;
    return fe && typeof fe === "object" ? fe : null;
  }
  return null;
}

/** Client-side password hint: min 12 chars, 3 of 4 categories. Server is source of truth. */
function passwordHintText(password: string): string | null {
  if (password.length === 0) return null;
  if (password.length < 12) return "At least 12 characters required.";
  let categories = 0;
  if (/[A-Z]/.test(password)) categories++;
  if (/[a-z]/.test(password)) categories++;
  if (/[0-9]/.test(password)) categories++;
  if (/[^A-Za-z0-9]/.test(password)) categories++;
  if (categories < 3)
    return "Use at least 3 of: uppercase, lowercase, digit, symbol.";
  return null;
}

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [pastedInput, setPastedInput] = React.useState("");
  const [pasteError, setPasteError] = React.useState("");
  const { state, refetch } = useSession();

  const [resolveState, setResolveState] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [resolveData, setResolveData] = React.useState<ResolveData["data"] | null>(null);
  /** Structured error code from resolve or accept for correct message + CTA. */
  const [errorCode, setErrorCode] = React.useState<InviteErrorCode | null>(null);
  const [genericErrorMessage, setGenericErrorMessage] = React.useState("");
  const [accepting, setAccepting] = React.useState(false);
  /** After accept 200 with alreadyHadMembership: true, show "You already have access" and CTA to dashboard. */
  const [alreadyHadMembership, setAlreadyHadMembership] = React.useState(false);

  /** Signup form (unauthenticated path) */
  const [signupEmail, setSignupEmail] = React.useState("");
  const [signupPassword, setSignupPassword] = React.useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = React.useState("");
  const [signupFullName, setSignupFullName] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors | null>(null);
  const [signupSubmitting, setSignupSubmitting] = React.useState(false);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = React.useState(false);
  const firstErrorFieldRef = React.useRef<HTMLInputElement>(null);
  const supabase = React.useMemo(() => createClient(), []);

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasteError("");
    const parsed = parseTokenFromPaste(pastedInput);
    if (!parsed) {
      setPasteError("Paste an invite link or token to continue.");
      return;
    }
    router.replace(`/accept-invite?token=${encodeURIComponent(parsed)}`);
  };

  React.useEffect(() => {
    if (!token.trim()) {
      setResolveState("idle");
      setErrorCode(null);
      setGenericErrorMessage("");
      setAlreadyHadMembership(false);
      return;
    }
    let cancelled = false;
    setResolveState("loading");
    setErrorCode(null);
    setGenericErrorMessage("");
    setAlreadyHadMembership(false);
    apiFetch<ResolveData>(`/api/invite/resolve?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!cancelled) {
          setResolveData(res.data);
          setResolveState("success");
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const code = getInviteErrorCode(e);
        if (code) {
          setErrorCode(code);
        } else {
          setGenericErrorMessage(e instanceof HttpError ? e.message : e instanceof Error ? e.message : "Failed to load invite.");
        }
        setResolveState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token.trim()) return;
    setAccepting(true);
    setErrorCode(null);
    setGenericErrorMessage("");
    try {
      const acceptRes = await apiFetch<AcceptData>("/api/invite/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      if (acceptRes.data.alreadyHadMembership) {
        setAlreadyHadMembership(true);
        setAccepting(false);
        return;
      }
      await apiFetch("/api/auth/session/switch", {
        method: "PATCH",
        body: JSON.stringify({ dealershipId: acceptRes.data.dealershipId }),
      });
      await refetch();
      router.replace("/dashboard");
      router.refresh();
    } catch (e: unknown) {
      const code = getInviteErrorCode(e);
      if (code) {
        setErrorCode(code);
      } else {
        setGenericErrorMessage(e instanceof HttpError ? e.message : e instanceof Error ? e.message : "Accept failed.");
      }
      setResolveState("error");
    } finally {
      setAccepting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setFieldErrors(null);
    setEmailAlreadyRegistered(false);
    setSignupSubmitting(true);
    setGenericErrorMessage("");
    setErrorCode(null);
    try {
      const body: {
        token: string;
        email: string;
        password: string;
        confirmPassword?: string;
        fullName?: string;
      } = {
        token,
        email: signupEmail.trim(),
        password: signupPassword,
        confirmPassword: signupConfirmPassword || undefined,
      };
      if (signupFullName.trim()) body.fullName = signupFullName.trim();

      const acceptRes = await apiFetch<AcceptData>("/api/invite/accept", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const { data } = acceptRes;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signupEmail.trim(),
        password: signupPassword,
      });
      if (signInError) {
        setGenericErrorMessage(signInError.message ?? "Account created but sign-in failed. Please sign in.");
        setSignupSubmitting(false);
        return;
      }
      // Full-page redirect so the next request sends the new session cookie; avoids
      // "Not authenticated" when calling session/switch before the server sees the cookie.
      window.location.href = `/dashboard?switchDealership=${encodeURIComponent(data.dealershipId)}`;
      return;
    } catch (err: unknown) {
      const code = getInviteErrorCode(err);
      const fe = getFieldErrors(err);
      if (fe) setFieldErrors(fe);
      if (code === "EMAIL_ALREADY_REGISTERED") setEmailAlreadyRegistered(true);
      else if (code) setErrorCode(code);
      else
        setGenericErrorMessage(
          err instanceof HttpError ? err.message : err instanceof Error ? err.message : "Something went wrong."
        );
    } finally {
      setSignupSubmitting(false);
    }
  };

  /** Focus first field with error when fieldErrors is set (accessibility). */
  React.useEffect(() => {
    if (fieldErrors && firstErrorFieldRef.current) {
      firstErrorFieldRef.current.focus();
    }
  }, [fieldErrors]);

  const isAuthenticated = state.status === "authenticated";
  const hasToken = token.trim().length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accept invite</CardTitle>
          <CardDescription>
            {!hasToken && "Paste your invite link or token below."}
            {hasToken && resolveState === "loading" && "Loading invite…"}
            {hasToken && resolveState === "error" && "Invite problem"}
            {hasToken && resolveState === "success" && !alreadyHadMembership && "You're invited to join"}
            {hasToken && resolveState === "success" && alreadyHadMembership && "You already have access"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasToken && (
            <form onSubmit={handlePasteSubmit} className="space-y-4">
              <Input
                label="Invite link or token"
                value={pastedInput}
                onChange={(e) => {
                  setPastedInput(e.target.value);
                  setPasteError("");
                }}
                placeholder="Paste full accept link or token"
                error={pasteError || undefined}
                aria-label="Paste invite link or token"
              />
              <Button type="submit" className="w-full">
                Resolve invite
              </Button>
            </form>
          )}

          {hasToken && resolveState === "loading" && (
            <div className="flex justify-center py-6" aria-busy="true">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            </div>
          )}

          {hasToken && resolveState === "error" && (
            <InviteErrorState
              errorCode={errorCode}
              genericMessage={genericErrorMessage}
              onPasteAgain={() => {
                setResolveState("idle");
                setErrorCode(null);
                setGenericErrorMessage("");
                router.replace("/accept-invite");
              }}
            />
          )}

          {hasToken && resolveState === "success" && alreadyHadMembership && (
            <div className="flex flex-col gap-3">
              <p className="text-[var(--text-soft)]">You already have access to this dealership.</p>
              <Link
                href="/dashboard"
                className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                Go to dashboard
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-slate-200"
              >
                Go to login
              </Link>
            </div>
          )}

          {hasToken && resolveState === "success" && resolveData && !alreadyHadMembership && (
            <>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">Dealership</dt>
                  <dd className="text-[var(--text)]">{resolveData.dealershipName}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">Role</dt>
                  <dd className="text-[var(--text)]">{resolveData.roleName}</dd>
                </div>
                {resolveData.expiresAt && (
                  <div>
                    <dt className="font-medium text-[var(--text-soft)]">Expires</dt>
                    <dd className="text-[var(--text)]">
                      {new Date(resolveData.expiresAt).toLocaleString()}
                    </dd>
                  </div>
                )}
                {resolveData.emailMasked && (
                  <div>
                    <dt className="sr-only">Invitation sent to</dt>
                    <dd className="text-[var(--text-soft)]">
                      Invitation sent to {resolveData.emailMasked}
                    </dd>
                  </div>
                )}
              </dl>

              {!isAuthenticated ? (
                <div className="flex flex-col gap-4 pt-2">
                  <h2 className="text-base font-semibold text-[var(--text)]">
                    Create your account
                  </h2>
                  <p className="text-sm text-[var(--text-soft)]">
                    Enter your details below to create an account and accept this invite. Use the same email the invitation was sent to.
                  </p>
                  {genericErrorMessage && (
                    <p
                      className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--danger)]"
                      role="alert"
                    >
                      {genericErrorMessage}
                    </p>
                  )}
                  {emailAlreadyRegistered && (
                    <p className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm text-[var(--text)]" role="alert">
                      An account with this email already exists. Please sign in and then accept the invite.{" "}
                      <Link
                        href={`/login?next=${encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`)}`}
                        className="font-medium text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
                      >
                        Sign in
                      </Link>
                    </p>
                  )}
                  <form onSubmit={handleSignupSubmit} className="space-y-4" noValidate>
                    <Input
                      ref={fieldErrors?.email ? firstErrorFieldRef : undefined}
                      id="accept-invite-email"
                      label="Email"
                      type="email"
                      autoComplete="email"
                      value={signupEmail}
                      onChange={(e) => {
                        setSignupEmail(e.target.value);
                        setFieldErrors((prev) => {
                          if (!prev?.email) return prev;
                          const { email: _, ...rest } = prev;
                          return Object.keys(rest).length > 0 ? rest : null;
                        });
                        setEmailAlreadyRegistered(false);
                      }}
                      error={fieldErrors?.email}
                      required
                      aria-required="true"
                    />
                    <div>
                      <Input
                        ref={
                          fieldErrors?.password && !fieldErrors?.email
                            ? firstErrorFieldRef
                            : undefined
                        }
                        id="accept-invite-password"
                        label="Password"
                        type="password"
                        autoComplete="new-password"
                        value={signupPassword}
                        onChange={(e) => {
                          setSignupPassword(e.target.value);
                          setFieldErrors((prev) => {
                            if (!prev?.password) return prev;
                            const { password: _, ...rest } = prev;
                            return Object.keys(rest).length > 0 ? rest : null;
                          });
                        }}
                        error={fieldErrors?.password}
                        required
                        aria-required="true"
                        minLength={12}
                      />
                      {passwordHintText(signupPassword) && (
                        <p
                          id="accept-invite-password-hint"
                          className="mt-1 text-xs text-[var(--text-soft)]"
                          aria-live="polite"
                        >
                          {passwordHintText(signupPassword)}
                        </p>
                      )}
                      {signupPassword.length > 0 && !passwordHintText(signupPassword) && (
                        <p
                          id="accept-invite-password-requirement"
                          className="mt-1 text-xs text-[var(--text-soft)]"
                          aria-live="polite"
                        >
                          At least 12 characters, 3 of 4: uppercase, lowercase, digit, symbol.
                        </p>
                      )}
                    </div>
                    <Input
                      id="accept-invite-confirm-password"
                      label="Confirm password"
                      type="password"
                      autoComplete="new-password"
                      value={signupConfirmPassword}
                      onChange={(e) => {
                        setSignupConfirmPassword(e.target.value);
                        setFieldErrors((prev) => {
                          if (!prev?.password) return prev;
                          const { password: _, ...rest } = prev;
                          return Object.keys(rest).length > 0 ? rest : null;
                        });
                      }}
                      error={fieldErrors?.password}
                      required
                      aria-required="true"
                    />
                    <Input
                      ref={
                        fieldErrors?.fullName &&
                        !fieldErrors?.email &&
                        !fieldErrors?.password
                          ? firstErrorFieldRef
                          : undefined
                      }
                      id="accept-invite-full-name"
                      label="Full name (optional)"
                      type="text"
                      autoComplete="name"
                      value={signupFullName}
                      onChange={(e) => {
                        setSignupFullName(e.target.value);
                        setFieldErrors((prev) => {
                          if (!prev?.fullName) return prev;
                          const { fullName: _, ...rest } = prev;
                          return Object.keys(rest).length > 0 ? rest : null;
                        });
                      }}
                      error={fieldErrors?.fullName}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={signupSubmitting}
                      isLoading={signupSubmitting}
                    >
                      {signupSubmitting ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                  <p className="text-center text-sm text-[var(--text-soft)]">
                    Already have an account?{" "}
                    <Link
                      href={`/login?next=${encodeURIComponent(`/accept-invite?token=${encodeURIComponent(token)}`)}`}
                      className="font-medium text-[var(--accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    className="w-full"
                    onClick={handleAccept}
                    disabled={accepting}
                  >
                    {accepting ? "Accepting…" : "Accept"}
                  </Button>
                  {(genericErrorMessage || errorCode) && (
                    <p className="text-sm text-[var(--danger)]" role="alert">
                      {errorCode
                        ? (errorCode === "INVITE_EXPIRED"
                          ? "This invite has expired or was cancelled."
                          : errorCode === "INVITE_ALREADY_ACCEPTED"
                            ? "This invite has already been used."
                            : "Invite not found.")
                        : genericErrorMessage}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Renders message + CTAs for each invite error code. No dead ends. */
function InviteErrorState({
  errorCode,
  genericMessage,
  onPasteAgain,
}: {
  errorCode: InviteErrorCode | null;
  genericMessage: string;
  onPasteAgain: () => void;
}) {
  if (errorCode === "INVITE_EXPIRED") {
    return (
      <>
        <p className="text-[var(--text-soft)]">This invite has expired or was cancelled.</p>
        <div className="flex flex-col gap-2">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Request a new invite
          </Link>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-slate-200"
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }
  if (errorCode === "INVITE_ALREADY_ACCEPTED") {
    return (
      <>
        <p className="text-[var(--text-soft)]">This invite has already been used.</p>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-md border border-transparent bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Go to login
        </Link>
      </>
    );
  }
  if (errorCode === "INVITE_NOT_FOUND") {
    return (
      <>
        <p className="text-[var(--text-soft)]">Invite not found.</p>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="secondary" className="w-full" onClick={onPasteAgain}>
            Paste link again
          </Button>
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-slate-200"
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <p className="text-[var(--text-soft)]">{genericMessage || "Something went wrong."}</p>
      <div className="flex flex-col gap-2">
        <Button type="button" variant="secondary" className="w-full" onClick={onPasteAgain}>
          Paste link again
        </Button>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-slate-200"
        >
          Go to login
        </Link>
      </div>
    </>
  );
}

export default function AcceptInvitePage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      }
    >
      <AcceptInviteContent />
    </React.Suspense>
  );
}
