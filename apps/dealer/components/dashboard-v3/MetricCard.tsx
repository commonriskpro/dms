import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export type MetricCardProps = {
  title: string;
  value: number;
  delta?: { value: number; trend: "up" | "down" };
  href: string;
};

export function MetricCard({ title, value, delta, href }: MetricCardProps) {
  return (
    <Link href={href} className="block focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl">
      <Card className="rounded-xl border border-[var(--border)]/60 shadow-sm bg-[var(--panel)] hover:bg-[var(--muted)]/30 transition-colors h-full">
        <CardContent className="p-4">
          <p className="text-sm text-[var(--text-soft)]">{title}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--text)]">{value.toLocaleString()}</span>
            {delta != null && (
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  delta.trend === "up"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {delta.trend === "up" ? "+" : ""}{delta.value}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
