import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";

export function WidgetCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DMSCard>
      <DMSCardHeader className="gap-2 mb-3">
        <DMSCardTitle>{title}</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent>{children}</DMSCardContent>
    </DMSCard>
  );
}
