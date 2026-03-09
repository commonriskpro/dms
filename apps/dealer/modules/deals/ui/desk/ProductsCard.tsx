"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { formatCents, centsToDollarInput, parseDollarsToCents } from "@/lib/money";
import type { DealDetail } from "../types";

const PRODUCT_TYPES: SelectOption[] = [
  { value: "GAP", label: "GAP" },
  { value: "VSC", label: "VSC" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "TIRE_WHEEL", label: "Tire & Wheel" },
  { value: "OTHER", label: "Other" },
];

export type ProductDraftItem = {
  id?: string;
  productType: string;
  name: string;
  priceCents: string;
  includedInAmountFinanced: boolean;
};

export interface ProductsCardProps {
  deal: DealDetail;
  productsDraft?: ProductDraftItem[];
  onProductsChange?: (products: ProductDraftItem[]) => void;
  disabled?: boolean;
}

export function ProductsCard({ deal, productsDraft, onProductsChange, disabled }: ProductsCardProps) {
  const finance = deal.dealFinance;
  const products = productsDraft ?? finance?.products ?? [];
  const productsTotal = finance?.productsTotalCents ?? "0";
  const backendGross = finance?.backendGrossCents ?? "0";
  const canEdit = onProductsChange != null && !disabled;

  const addProduct = () => {
    if (!onProductsChange) return;
    onProductsChange([
      ...products,
      { productType: "OTHER", name: "", priceCents: "0", includedInAmountFinanced: true },
    ]);
  };
  const removeProduct = (index: number) => {
    if (!onProductsChange) return;
    onProductsChange(products.filter((_, i) => i !== index));
  };
  const updateProduct = (index: number, patch: Partial<ProductDraftItem>) => {
    if (!onProductsChange) return;
    onProductsChange(
      products.map((p, i) => (i === index ? { ...p, ...patch } : p))
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[var(--text)]">Backend products</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {products.length === 0 && !canEdit ? (
          <p className="text-[var(--muted-text)]">None</p>
        ) : (
          <>
            <ul className="space-y-1">
              {products.map((p, i) => (
                <li key={p.id ?? i} className="flex items-center justify-between gap-2">
                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={p.productType}
                        onChange={(v) => updateProduct(i, { productType: v })}
                        options={PRODUCT_TYPES}
                        className="w-28 border-[var(--border)]"
                      />
                      <Input
                        placeholder="Name"
                        value={p.name}
                        onChange={(e) => updateProduct(i, { name: e.target.value })}
                        className="w-32 border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                      />
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Price"
                        value={centsToDollarInput(p.priceCents).replace(/^\$/, "")}
                        onChange={(e) =>
                          updateProduct(i, { priceCents: parseDollarsToCents(e.target.value) || "0" })
                        }
                        className="w-24 border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
                      />
                      <label className="flex items-center gap-1 text-[var(--muted-text)]">
                        <input
                          type="checkbox"
                          checked={p.includedInAmountFinanced}
                          onChange={(e) =>
                            updateProduct(i, { includedInAmountFinanced: e.target.checked })
                          }
                          className="rounded border-[var(--border)]"
                        />
                        Financed
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(i)}
                        className="text-[var(--muted-text)]"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-[var(--text)]">{p.name || "—"}</span>
                      <span className="text-[var(--muted-text)]">
                        {formatCents(p.priceCents)}
                        {p.includedInAmountFinanced ? " (financed)" : ""}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 border-t border-[var(--border)] pt-2">
              <dt className="text-[var(--muted-text)]">Products total:</dt>
              <dd className="text-[var(--text)]">{formatCents(productsTotal)}</dd>
              <dt className="text-[var(--muted-text)]">Backend gross:</dt>
              <dd className="text-[var(--text)]">{formatCents(backendGross)}</dd>
            </dl>
          </>
        )}
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addProduct}
            className="mt-2 border-[var(--border)] text-[var(--text)]"
          >
            Add product
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
