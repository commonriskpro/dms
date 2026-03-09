import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ApplySuccessPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <Card className="border-[var(--border)] bg-[var(--surface)]">
        <CardHeader>
          <CardTitle className="text-[var(--text)]">Application submitted</CardTitle>
          <CardDescription>
            Thank you. We&apos;ll review your application and get back to you. You can sign in or check your email for next steps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full">Sign in</Button>
          </Link>
          <p className="mt-4 text-center text-sm text-[var(--text-soft)]">
            <Link href="/apply" className="text-[var(--accent)] hover:underline">
              Start another application
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
