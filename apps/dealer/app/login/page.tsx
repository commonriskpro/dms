"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { SignInPage, type Testimonial } from "@/components/ui/sign-in";
import { createClient } from "@/lib/supabase/browser";
import { useSession } from "@/contexts/session-context";

function getRedirectPath(next: string | null): string {
  if (!next || typeof next !== "string") return "/";
  const path = next.startsWith("/") ? next : `/${next}`;
  if (path.includes("//") || path.startsWith("/\\")) return "/";
  return path;
}

const TESTIMONIALS: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
    name: "Sarah Chen",
    handle: "@sarahdigital",
    text: "The command surfaces are clear enough that our store can move from leads to deal handoff without losing context.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
    name: "Marcus Johnson",
    handle: "@marcustech",
    text: "Inventory, CRM, and ops all finally feel connected. The system helps my team act faster instead of hunting for screens.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "David Martinez",
    handle: "@davidcreates",
    text: "DealerOS gives managers the pressure points first and the underlying workflow right below it. That is the right model.",
  },
];

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = React.useMemo(() => getRedirectPath(next), [next]);
  const { refetch } = useSession();
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const supabase = React.useMemo(() => createClient(), []);

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message ?? "Invalid email or password");
        return;
      }

      await refetch();
      router.replace(redirectTo);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(formData: FormData) {
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const email = String(formData.get("email") ?? "").trim();
      if (!email) {
        setError("Enter your email address first.");
        return;
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (typeof window !== "undefined" ? window.location.origin : "");
      const emailRedirectTo = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/`
        : `${typeof window !== "undefined" ? window.location.origin : ""}/`;

      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      if (err) {
        setError(err.message ?? "Failed to send magic link");
        return;
      }

      setNotice("Magic link sent. Check your inbox for a sign-in link.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (searchParams.get("error") === "invalid_link") {
      setNotice("This link has expired or is invalid. Please try again or sign in.");
    }
  }, [searchParams]);

  return (
    <SignInPage
      title={
        <>
          <span className="block font-light tracking-tight text-[var(--text)]">DealerOS</span>
          <span className="block text-balance text-[0.82em] font-semibold text-[var(--text)]">
            Sign in to your dealership workspace
          </span>
        </>
      }
      description="Work across inventory, CRM, deals, funding, and ops from one system without losing dealership context."
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      testimonials={TESTIMONIALS}
      onSignIn={handlePasswordSubmit}
      onSecondaryAction={handleMagicLink}
      secondaryActionLabel="Send magic link"
      secondaryActionIcon={<Mail className="h-5 w-5" />}
      onResetPassword={() => router.push("/forgot-password")}
      onCreateAccount={() => router.push("/accept-invite")}
      createAccountLabel="Accept invite"
      error={error || undefined}
      notice={notice || undefined}
      isLoading={loading}
    />
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      }
    >
      <LoginContent />
    </React.Suspense>
  );
}
