import { SignalCard } from "./SignalCard";
import type { SignalSurfaceItem } from "./types";

export function SignalInlineList({
  items,
  maxVisible,
}: {
  items: SignalSurfaceItem[];
  maxVisible?: number;
}) {
  const visible = typeof maxVisible === "number" ? items.slice(0, maxVisible) : items;
  if (visible.length === 0) return null;

  return (
    <ul className="space-y-2">
      {visible.map((item) => (
        <li key={item.key}>
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
