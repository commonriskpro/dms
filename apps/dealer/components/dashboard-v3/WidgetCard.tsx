import { Widget } from "@/components/ui-system/widgets/Widget";

export function WidgetCard({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Widget title={title} subtitle={subtitle} action={action} className={className}>
      {children}
    </Widget>
  );
}
