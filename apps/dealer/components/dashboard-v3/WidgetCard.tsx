import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WidgetCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border border-[var(--border)]/60 shadow-sm bg-[var(--panel)] h-full">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}
