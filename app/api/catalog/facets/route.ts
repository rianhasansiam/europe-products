import { jsonError, ok } from "@/lib/api/response";
import { getPublicCatalogFacets } from "@/lib/services/public-catalog-cache.service";
import { apiLocale } from "@/lib/translations/public";

export const dynamic = "force-dynamic";

export async function GET(request:Request) {
  try {
    return ok(await getPublicCatalogFacets(await apiLocale(request)));
  } catch (error) {
    console.error("[catalog.facets.GET] failed", error);
    return jsonError(500, "Failed to load catalog filters.");
  }
}
