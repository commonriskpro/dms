"use client";

import * as React from "react";
import { PageHeader } from "@/components/ui/page-shell";
import { typography } from "@/lib/ui/tokens";
import { sectionStack } from "@/lib/ui/recipes/layout";
import { AuctionSearchBar } from "./AuctionSearchBar";
import { AuctionResults } from "./AuctionResults";

export type AuctionsPageClientProps = {
  canCreateAppraisal: boolean;
};

export type AuctionListingRow = {
  id: string;
  provider: string;
  auctionLotId: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  currentBidCents: string | null;
  buyNowCents: string | null;
  auctionEndAt: string | null;
  location: string | null;
};

export function AuctionsPageClient({ canCreateAppraisal }: AuctionsPageClientProps) {
  const [results, setResults] = React.useState<AuctionListingRow[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  return (
    <div className={sectionStack}>
      <PageHeader title={<h1 className={typography.pageTitle}>Auctions</h1>} />
      <AuctionSearchBar
        onSearch={(listings) => {
          setResults(listings);
          setSearching(false);
          setSearched(true);
        }}
        onSearchStart={() => setSearching(true)}
      />
      <AuctionResults
        results={results}
        searching={searching}
        searched={searched}
        canCreateAppraisal={canCreateAppraisal}
      />
    </div>
  );
}
