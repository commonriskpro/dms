import * as React from "react";

export function DealWorkspace({
  main,
  rail,
}: {
  main: React.ReactNode;
  rail?: React.ReactNode;
}) {
  if (!rail) {
    return <div className="space-y-6">{main}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">{main}</div>
      <aside className="space-y-4 lg:col-span-1">{rail}</aside>
    </div>
  );
}
