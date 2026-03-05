export function ModalErrorBody({ hint }: { hint?: string }) {
  return (
    <div className="p-6">
      <p className="text-sm text-[var(--muted-text)]">
        {hint ?? "If you think this is a mistake, contact your dealership admin."}
      </p>
    </div>
  );
}
