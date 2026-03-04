"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type OnboardingStatusData = {
  applicationId: string;
  applicationStatus: string;
  platformDealershipId: string | null;
  platformDealershipStatus: string | null;
  mapping: { dealerDealershipId: string; provisionedAt: string } | null;
  ownerInvite: {
    status: string;
    invitedAt?: string;
    expiresAt?: string | null;
    acceptedAt?: string | null;
  } | null;
  ownerJoined: boolean;
  nextAction: string;
  timeline?: Array<{ eventType: string; createdAt: string; actorIdTail?: string }>;
};

export function OnboardingStatusPanel({ data }: { data: OnboardingStatusData | null }) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-[var(--text-soft)]">Application:</span>{" "}
          <span className="font-medium text-[var(--text)]">{data.applicationStatus}</span>
        </p>
        <p>
          <span className="text-[var(--text-soft)]">Dealership:</span>{" "}
          <span className="font-medium text-[var(--text)]">
            {data.platformDealershipStatus ?? "—"}
          </span>
        </p>
        <p>
          <span className="text-[var(--text-soft)]">Mapping:</span>{" "}
          {data.mapping
            ? `Provisioned ${new Date(data.mapping.provisionedAt).toLocaleString()}`
            : "—"}
        </p>
        <p>
          <span className="text-[var(--text-soft)]">Owner Invite:</span>{" "}
          <span className="font-medium text-[var(--text)]">
            {data.ownerInvite?.status ?? "—"}
          </span>
        </p>
        <p>
          <span className="text-[var(--text-soft)]">Owner Joined:</span>{" "}
          <span className="font-medium text-[var(--text)]">
            {data.ownerJoined ? "Yes" : "No"}
          </span>
        </p>
        <p>
          <span className="text-[var(--text-soft)]">Next Action:</span>{" "}
          <span className="font-medium text-[var(--accent)]">{data.nextAction}</span>
        </p>

        {data.timeline && data.timeline.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-[var(--text-soft)] font-medium mb-2">Timeline</p>
            <ul className="list-disc list-inside space-y-1 text-[var(--text-soft)]">
              {data.timeline.map((evt, i) => (
                <li key={i}>
                  <span className="text-[var(--text)]">{evt.eventType}</span>
                  {" · "}
                  {new Date(evt.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
