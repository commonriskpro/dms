"use client";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
        <div
          className="max-w-md rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6 text-center"
          role="region"
          aria-label="Pending approval"
        >
          <h1 className="text-xl font-semibold text-[var(--text)]">
            Your account is pending approval
          </h1>
          <p className="mt-2 text-[var(--text-soft)]">
            A platform administrator will link you to a dealership shortly. You don’t have access to
            any dealership data until then.
          </p>
          <p className="mt-4 text-sm text-[var(--text-soft)]">
            You can sign out using the button above.
          </p>
        </div>
      </div>
  );
}
