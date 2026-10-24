import { z } from "zod";
import { requireAdmin } from "@/lib/api/guards";
import { jsonError, ok } from "@/lib/api/response";
import { handleServiceError, ServiceError } from "@/lib/services/service-error";
import { loadBundledMessages } from "@/lib/i18n/catalogs";
import { preparePublicBatch, publishLanguage, refreshProviderLanguages, retryTranslationJob, runTranslationJobs, savePublicTranslation, setInterfaceCatalog, setPublicTranslationStatus, translationDashboard } from "@/lib/translations/service";
import { assertTranslatedCatalog, canonicalLocale, contentHash, flattenCatalog, type MessageCatalog } from "@/lib/translations/validation";
import { invalidateCatalogEntries } from "@/lib/cache/catalog-invalidation";
import { catalogCacheTags } from "@/lib/cache/catalog-tags";
import { getPublishedLocales } from "@/lib/i18n/registry";

const locale=z.string().min(2).max(35).refine(value=>{try{return !!canonicalLocale(value);}catch{return false;}},"Invalid language code.");
const entityType=z.enum(["product","category","brand","manufacturer","banner"]);
const id=z.string().min(1).max(128);
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("refreshProviderLanguages")}),
  z.object({action:z.literal("importCatalog"),code:locale,englishName:z.string().min(1).max(120),nativeName:z.string().min(1).max(120),catalog:z.record(z.string(),z.unknown()),reviewed:z.boolean().default(false),fallbackLocale:locale.optional(),acknowledgeUnchanged:z.boolean().default(false)}),
  z.object({action:z.literal("publishLanguage"),code:locale,published:z.boolean()}),
  z.object({action:z.literal("prepareBatch"),entityType,entityIds:z.array(id).min(1).max(100),fields:z.array(z.string().min(1).max(40)).min(1).max(10),targetLocale:locale,sourceLocale:locale.optional(),dryRun:z.boolean().default(true)}),
  z.object({action:z.literal("runJobs"),limit:z.number().int().min(1).max(25).default(5)}),
  z.object({action:z.literal("retryJob"),id}),
  z.object({action:z.literal("saveTranslation"),entityType,entityId:id,field:z.string().min(1).max(40),targetLocale:locale,sourceLocale:locale.optional(),value:z.string().min(1).max(100_000),publish:z.boolean().default(false),expectedSourceHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),expectedContextHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),expectedUpdatedAt:z.iso.datetime().optional()}),
  z.object({action:z.literal("publishTranslation"),id,published:z.boolean(),expectedUpdatedAt:z.iso.datetime().optional()}),
]);
export const runtime="nodejs";

export async function GET() {
  const guard=await requireAdmin(); if(!guard.ok)return guard.response;
  try{
    const dashboard=await translationDashboard();
    const bundled=getPublishedLocales();
    const source=await loadBundledMessages("en");const sourceKeys=Object.keys(flattenCatalog(source));
    const languages=await Promise.all(dashboard.languages.map(async row=>{
      const catalog=row.interfaceCatalog??(bundled.some(locale=>locale.code===row.code)?await loadBundledMessages(row.code):null);
      const keys=catalog&&typeof catalog==="object"?Object.keys(flattenCatalog(catalog as MessageCatalog)):[];
      const stale=!!row.interfaceSourceHash&&row.interfaceSourceHash!==contentHash(source);
      let unchangedMessages:string[]=[];
      if(catalog&&row.code!=="en"){try{unchangedMessages=assertTranslatedCatalog(source,catalog as MessageCatalog,row.code).unchangedMessages;}catch{/* Stale/invalid catalogs remain unpublishable through the service. */}}
      return {...row,interfaceCatalog:catalog,unchangedMessages,prepared:row.prepared&&!stale,published:row.published&&!stale,coverage:{required:sourceKeys.length,present:keys.length,missing:sourceKeys.filter(key=>!keys.includes(key)).length,stale:stale?sourceKeys.length:0}};
    }));
    return ok({...dashboard,languages});
  }catch(error){return handleServiceError("admin.translations.GET",error);}
}

function allowedOrigin(request:Request) {
  if(request.headers.get("sec-fetch-site")==="cross-site") return false;
  const origin=request.headers.get("origin"); if(!origin)return true;
  try{return new URL(origin).origin===new URL(process.env.AUTH_URL??request.url).origin;}catch{return false;}
}
async function boundedJson(request:Request):Promise<unknown> {
  if(!request.headers.get("content-type")?.includes("application/json"))throw new ServiceError(415,"Content-Type must be application/json.");
  if(!request.body)throw new ServiceError(400,"JSON body is required.");
  const reader=request.body.getReader(); const chunks:Uint8Array[]=[];let length=0;
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>2_000_000){await reader.cancel();throw new ServiceError(413,"Translation import exceeds 2 MB.");}chunks.push(part.value);}
  const output=new Uint8Array(length);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(output));}catch{throw new ServiceError(400,"Invalid JSON payload.");}
}

export async function POST(request:Request) {
  const guard=await requireAdmin(); if(!guard.ok)return guard.response;
  if(!allowedOrigin(request))return jsonError(403,"Cross-origin translation writes are not allowed.");
  try {
    const parsed=schema.safeParse(await boundedJson(request));if(!parsed.success)return jsonError(400,"Invalid translation-management request.",{issues:parsed.error.issues.map(row=>row.message)});
    const body=parsed.data;let result:unknown;
    switch(body.action){
      case "refreshProviderLanguages": result=await refreshProviderLanguages();break;
      case "importCatalog": result=await setInterfaceCatalog({...body,catalog:body.catalog as MessageCatalog,source:await loadBundledMessages("en"),reviewedBy:body.reviewed?guard.session.user.id:undefined});break;
      case "publishLanguage": result=await publishLanguage(body.code,body.published,await loadBundledMessages("en"));break;
      case "prepareBatch": result=await preparePublicBatch(body);break;
      case "runJobs": result=await runTranslationJobs(body.limit);break;
      case "retryJob": result=await retryTranslationJob(body.id);break;
      case "saveTranslation": result=await savePublicTranslation({...body,reviewedBy:guard.session.user.id});break;
      case "publishTranslation": result=await setPublicTranslationStatus(body.id,body.published,guard.session.user.id,body.expectedUpdatedAt);break;
    }
    if(["importCatalog","publishLanguage","saveTranslation","publishTranslation"].includes(body.action))invalidateCatalogEntries({tags:[catalogCacheTags.sitemap,catalogCacheTags.catalog],paths:["/sitemap.xml"],reason:"translation publication changed"});
    return ok(result);
  } catch(error) {
    if(error instanceof ServiceError)return handleServiceError("admin.translations.POST",error);
    // Validation/provider setup failures are actionable, without exposing credentials.
    if(error instanceof Error && !error.message.includes("prisma"))return jsonError(400,error.message);
    return handleServiceError("admin.translations.POST",error);
  }
}
