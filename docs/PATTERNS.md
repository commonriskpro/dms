# DMS Code Patterns

## API Route
```typescript
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "module.read");
    const query = listSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { data, total } = await service.list(ctx.dealershipId, query);
    return jsonResponse({ data, meta: { total, limit: query.limit, offset: query.offset } });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
```

## Audit Log
```typescript
await auditLog({
  actorUserId: ctx.userId, dealershipId: ctx.dealershipId,
  action: "vehicle.created", entity: "Vehicle", entityId: vehicle.id,
  metadata: { vin: vehicle.vin }, ip: meta.ip, userAgent: meta.userAgent,
});
```

## Domain Events
```typescript
emitEvent("deal.created", { dealId, dealershipId, customerId, vehicleId });
registerListener("deal.created", async (payload) => { /* idempotent handler */ });
// Known events: vehicle.created, vehicle.updated, vehicle.vin_decoded,
// deal.created, deal.status_changed, deal.sold,
// customer.created, bulk_import.requested, analytics.requested
```

## Cache
```typescript
const data = await withCache(
  cacheKeys.inventory(dealershipId, "kpis"),
  () => fetchKpis(dealershipId),
  { ttl: 20 }
);
```

## Prisma Model Template
```prisma
model Example {
  id           String    @id @default(uuid()) @db.Uuid
  dealershipId String    @map("dealership_id") @db.Uuid
  deletedAt    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  dealership   Dealership @relation(fields: [dealershipId], references: [id])
  @@index([dealershipId])
}
```