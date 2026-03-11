"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
}

export function Pagination({
  meta,
  onPageChange,
  className = "",
}: {
  meta: PaginationMeta;
  onPageChange: (offset: number) => void;
  className?: string;
}) {
  const { total, limit, offset } = meta;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div
      className={`flex items-center justify-between gap-4 ${className}`}
      role="navigation"
      aria-label="Pagination"
    >
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="flex items-center px-2 text-sm text-[var(--text-soft)]">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(offset + limit)}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
