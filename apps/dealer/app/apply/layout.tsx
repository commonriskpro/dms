/**
 * Public apply flow: no auth, no AppShell. Uses Dealer OS tokens (bg, surface, text).
 */
export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {children}
    </div>
  );
}
