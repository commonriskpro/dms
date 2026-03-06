/** Shown when user is authenticated in Supabase but has no platform_users row (forbidden). */
export default function PlatformForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] p-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-6 py-8 text-center max-w-md">
        <h1 className="text-xl font-semibold text-[var(--text)]">Not authorized</h1>
        <p className="mt-2 text-sm text-[var(--text-soft)]">
          Your account is not authorized to access the platform admin. Contact your administrator.
        </p>
        <a
          href="/api/platform/auth/logout"
          className="mt-4 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          Sign out
        </a>
      </div>
    </div>
  );
}
