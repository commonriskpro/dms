<<<<<<< HEAD
import { DMSCard, DMSCardHeader, DMSCardTitle, DMSCardContent } from "@/components/ui/dms-card";
=======
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083

export function WidgetCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
<<<<<<< HEAD
    <DMSCard>
      <DMSCardHeader className="gap-2 mb-3">
        <DMSCardTitle>{title}</DMSCardTitle>
      </DMSCardHeader>
      <DMSCardContent>{children}</DMSCardContent>
    </DMSCard>
=======
    <Card className="rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-card)] transition-shadow duration-150 hover:shadow-[0_6px_18px_rgba(16,24,40,0.10)]">
      <CardContent className="px-4 pb-4 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold leading-[1.2] text-[var(--text)]">
            {title}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-0 h-8 w-8 shrink-0 rounded-full p-0 transition-all duration-150 hover:bg-[var(--surface-2)] hover:brightness-[1.05] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </Button>
        </div>
        {children}
      </CardContent>
    </Card>
>>>>>>> b6f3f0c3e03764d58a87dbe9a8ca709be7fc1083
  );
}
