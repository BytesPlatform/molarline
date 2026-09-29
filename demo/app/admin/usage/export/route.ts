/** The usage table as CSV, one row per customer, for invoicing. */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { usageCsv, usageForMonth } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requirePlatformAdmin();
  const monthsBack = Math.min(11, Math.max(0, Number(request.nextUrl.searchParams.get("m")) || 0));
  const { label, rows } = await usageForMonth(monthsBack);
  return new NextResponse(usageCsv(label, rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="usage-${label.replace(/\s+/g, "-").toLowerCase()}.csv"`,
    },
  });
}
