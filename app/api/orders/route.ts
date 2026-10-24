import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/guards";
import { POST as checkout } from "@/app/api/checkout/route";

/** Signed-in compatibility endpoint sharing the complete Airwallex checkout flow. */
export async function POST(request: NextRequest) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;
  return checkout(request);
}
