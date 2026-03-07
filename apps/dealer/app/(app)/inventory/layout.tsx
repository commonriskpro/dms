import { InventorySubNav } from "./InventorySubNav";

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InventorySubNav />
      {children}
    </>
  );
}
