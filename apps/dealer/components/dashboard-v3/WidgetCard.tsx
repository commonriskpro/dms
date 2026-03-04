import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardCard, spacingTokens } from "@/lib/ui/tokens";

export function WidgetCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={dashboardCard}>
      <CardHeader className={spacingTokens.cardHeaderPad}>
        <CardTitle className="text-base font-medium text-[var(--text)]">{title}</CardTitle>
      </CardHeader>
      <CardContent className={spacingTokens.cardContentPad}>{children}</CardContent>
    </Card>
  );
}
