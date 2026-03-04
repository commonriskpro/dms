import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WidgetCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-xl border border-[var(--border)]/40 bg-[var(--panel)] shadow-sm hover:shadow-md transition-shadow h-full">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium text-[var(--text)]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}
