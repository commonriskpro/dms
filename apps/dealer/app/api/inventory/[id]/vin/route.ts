import { NextRequest } from "next/server";
import { z } from "zod";
import * as vinDecodeService from "@/modules/inventory/service/vin-decode";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { idParamSchema, vinGetQuerySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const query = vinGetQuerySchema.parse(
      getQueryObject(request)
    );
    const result = await vinDecodeService.getVin(ctx.dealershipId, id, {
      latestOnly: query.latestOnly,
      limit: query.limit,
      offset: query.offset,
    });
    if ("decoded" in result) {
      return jsonResponse({
        data: {
          vin: result.vin,
          decoded: result.decoded
            ? {
                id: result.decoded.id,
                decodedAt: result.decoded.decodedAt,
                vin: result.decoded.vin,
                make: result.decoded.make,
                model: result.decoded.model,
                year: result.decoded.year,
                trim: result.decoded.trim,
                bodyStyle: result.decoded.bodyStyle,
                engine: result.decoded.engine,
                drivetrain: result.decoded.drivetrain,
                transmission: result.decoded.transmission,
                fuelType: result.decoded.fuelType,
                manufacturedIn: result.decoded.manufacturedIn,
                rawJson: result.decoded.rawJson,
              }
            : null,
        },
      });
    }
    return jsonResponse({
      data: result.data.map((d) => ({
        id: d.id,
        decodedAt: d.decodedAt,
        vin: d.vin,
        make: d.make,
        model: d.model,
        year: d.year,
        trim: d.trim,
        bodyStyle: d.bodyStyle,
        engine: d.engine,
        drivetrain: d.drivetrain,
        transmission: d.transmission,
        fuelType: d.fuelType,
        manufacturedIn: d.manufacturedIn,
        rawJson: d.rawJson,
      })),
      meta: result.meta,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
