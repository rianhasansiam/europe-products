import { requireAdmin } from "@/lib/api/guards";
import { jsonError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  return jsonError(410, "Language management has been removed.");
}

function allowedOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(process.env.AUTH_URL ?? request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  if (!allowedOrigin(request)) return jsonError(403, "Cross-origin translation writes are not allowed.");
  return jsonError(410, "Language management has been removed.");
}
