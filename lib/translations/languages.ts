import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Prisma, type LocaleLanguage } from "@/app/generated/prisma/client";
import type { MessageCatalog } from "./validation";

export type LocaleLanguageMetadata = Omit<LocaleLanguage,"interfaceCatalog"> & {hasInterfaceCatalog:boolean};
const CACHE_MS=30_000;
const MAX_ACTIVE_CATALOGS=8;
export class LanguageRegistryUnavailableError extends Error{
  constructor(){super("The language registry is temporarily unavailable. English remains available.");this.name="LanguageRegistryUnavailableError";}
}
let languageCache: { at: number; rows: LocaleLanguageMetadata[] | null;error?:LanguageRegistryUnavailableError } | undefined;
let lastSuccessfulRows:LocaleLanguageMetadata[]|undefined;
const catalogCache=new Map<string,{at:number;catalog:MessageCatalog|null}>();
export function invalidateLanguageCache() { languageCache = undefined;lastSuccessfulRows=undefined;catalogCache.clear(); }
function missingLocaleTable(error:unknown):boolean{
  if(!error||typeof error!=="object"||!("code" in error))return false;
  if(error.code==="P2021")return true;
  const meta="meta" in error?error.meta:null;
  if(error.code!=="P2010"||!meta||typeof meta!=="object")return false;
  if("code" in meta&&meta.code==="42P01")return true;
  // Prisma 7's pg adapter preserves PostgreSQL SQLSTATE under the adapter
  // cause rather than meta.code. Only the confirmed undefined-table code is safe.
  const driver="driverAdapterError" in meta?meta.driverAdapterError:null;
  const cause=driver&&typeof driver==="object"&&"cause" in driver?driver.cause:null;
  return !!cause&&typeof cause==="object"&&"originalCode" in cause&&cause.originalCode==="42P01";
}
export async function getPublishedLanguageOverrides(): Promise<LocaleLanguageMetadata[] | null> {
  if (languageCache && Date.now() - languageCache.at < CACHE_MS){if(languageCache.error)throw languageCache.error;return languageCache.rows;}
  try {
    // Fixed SQL projects capability/publication metadata only. The large JSON
    // catalogs never enter proxy/layout language-list reads or their cache.
    const rows = await prisma.$queryRaw<LocaleLanguageMetadata[]>(Prisma.sql`
      SELECT "code", "englishName", "nativeName", "direction", "fallbackLocale",
             "providerCode", "providerTargets", "available", "prepared", "published", "publicationOverride",
             "interfaceSourceHash", "catalogReviewedAt", "providerFetchedAt", "createdAt", "updatedAt",
             ("interfaceCatalog" IS NOT NULL AND jsonb_typeof("interfaceCatalog") = 'object') AS "hasInterfaceCatalog"
      FROM "LocaleLanguage" ORDER BY "englishName" ASC
    `);
    lastSuccessfulRows=rows;languageCache = { at: Date.now(), rows }; return rows;
  } catch(error) {
    // A known disable must never be discarded merely because the database is
    // temporarily unreachable. Explicit management invalidation drops this
    // snapshot because a successful write may have changed publication state.
    if(lastSuccessfulRows!==undefined){languageCache={at:Date.now(),rows:lastSuccessfulRows};return lastSuccessfulRows;}
    if(missingLocaleTable(error)){languageCache={at:Date.now(),rows:null};return null;}
    const unavailable=new LanguageRegistryUnavailableError();languageCache={at:Date.now(),rows:null,error:unavailable};throw unavailable;
  }
}
export async function getStoredInterfaceCatalog(locale: string,expectedSourceHash?:string): Promise<MessageCatalog | null> {
  const row = (await getPublishedLanguageOverrides())?.find(item=>item.code===locale);
  if(!row?.prepared||!row.published||!row.catalogReviewedAt||!row.hasInterfaceCatalog||(expectedSourceHash&&row.interfaceSourceHash!==expectedSourceHash))return null;
  const key=`${locale}:${expectedSourceHash??row.interfaceSourceHash}:${row.updatedAt?.getTime()??""}`;
  const cached=catalogCache.get(key);
  if(cached&&Date.now()-cached.at<CACHE_MS){catalogCache.delete(key);catalogCache.set(key,cached);return cached.catalog;}
  let catalog:MessageCatalog|null=null;
  try{
    const stored=await prisma.localeLanguage.findUnique({where:{code:locale},select:{interfaceCatalog:true,interfaceSourceHash:true,prepared:true,published:true,catalogReviewedAt:true}});
    if(stored?.prepared&&stored.published&&stored.catalogReviewedAt&&(!expectedSourceHash||stored.interfaceSourceHash===expectedSourceHash)&&stored.interfaceCatalog&&typeof stored.interfaceCatalog==="object"&&!Array.isArray(stored.interfaceCatalog))catalog=stored.interfaceCatalog as MessageCatalog;
  }catch{/* Missing migration or storage failure keeps bundled catalogs available. */}
  catalogCache.delete(key);catalogCache.set(key,{at:Date.now(),catalog});
  while(catalogCache.size>MAX_ACTIVE_CATALOGS)catalogCache.delete(catalogCache.keys().next().value!);
  return catalog;
}
