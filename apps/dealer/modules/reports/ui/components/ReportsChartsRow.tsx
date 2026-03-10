"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import type {
  SalesSummaryResponse,
  MixResponse,
  PipelineResponse,
} from "@/lib/types/reports";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type WidgetState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

export function ReportsChartsRow({
  pipelineState,
  salesSummaryState,
  mixState,
  onRetry,
}: {
  pipelineState: WidgetState<PipelineResponse["data"]>;
  salesSummaryState: WidgetState<SalesSummaryResponse["data"]>;
  mixState: WidgetState<MixResponse["data"]>;
  onRetry: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <DealsTrendChart state={pipelineState} onRetry={onRetry} />
      <GrossBarChart state={salesSummaryState} onRetry={onRetry} />
      <MixPieChart state={mixState} onRetry={onRetry} />
    </div>
  );
}

function DealsTrendChart({
  state,
  onRetry,
}: {
  state: WidgetState<PipelineResponse["data"]>;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals trend</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deals trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message={state.message} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }
  if (state.status !== "success") return null;
  const trend = state.data.trend ?? [];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deals trend</CardTitle>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-soft)]">
            No trend data for this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <LineChart data={trend.map((t) => ({ period: t.period, count: t.contractedCount }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function GrossBarChart({
  state,
  onRetry,
}: {
  state: WidgetState<SalesSummaryResponse["data"]>;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Front gross</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Front gross</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message={state.message} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }
  if (state.status !== "success") return null;
  const cents = Number(state.data.totalFrontGrossCents);
  const barData = [{ label: "Front gross", value: cents / 100 }];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Front gross (total)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={256}>
          <BarChart data={barData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
            <Tooltip
              formatter={(v: number | undefined) => [
                `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                "Front gross",
              ]}
            />
            <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

const MIX_COLORS = ["#22c55e", "#3b82f6", "#94a3b8"];

function MixPieChart({
  state,
  onRetry,
}: {
  state: WidgetState<MixResponse["data"]>;
  onRetry: () => void;
}) {
  const pieData = React.useMemo(() => {
    const byMode = state.status === "success" ? (state.data.byMode ?? []) : [];
    return byMode.map((m) => ({ name: m.financingMode, value: m.dealCount }));
  }, [state]);
  if (state.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash vs finance mix</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash vs finance mix</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState message={state.message} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }
  if (state.status !== "success") return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cash vs finance mix</CardTitle>
      </CardHeader>
      <CardContent>
        {pieData.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-soft)]">
            No mix data for this range.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={MIX_COLORS[i % MIX_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
