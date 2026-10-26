import { jsonError } from "@/lib/api/response";

export async function POST() {
  return jsonError(410, "Language switching is no longer available.");
}
