import { EmptyStatePanel } from "@/components/ui-system/feedback";
import { SignalCard, type SignalCardProps } from "./SignalCard";

export type SignalListItem = SignalCardProps & {
  id: string;
};

export function SignalList({
  items,
  emptyTitle,
  emptyDescription,
}: {
  items: SignalListItem[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return <EmptyStatePanel title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <SignalCard
            title={item.title}
            description={item.description}
            severity={item.severity}
            actionHref={item.actionHref}
            count={item.count}
          />
        </li>
      ))}
    </ul>
  );
}
