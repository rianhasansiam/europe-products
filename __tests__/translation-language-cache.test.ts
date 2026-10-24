import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({query:vi.fn(),catalog:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{$queryRaw:mocks.query,localeLanguage:{findUnique:mocks.catalog}}}));
import { getPublishedLanguageOverrides, getStoredInterfaceCatalog, invalidateLanguageCache, LanguageRegistryUnavailableError } from "@/lib/translations/languages";

function metadata(code="ar"){
  return {code,englishName:"Arabic",nativeName:"العربية",direction:"rtl",fallbackLocale:null,providerCode:code,available:true,prepared:true,published:true,publicationOverride:true,interfaceSourceHash:"current-source",catalogReviewedAt:new Date("2026-10-12T00:00:00Z"),providerFetchedAt:null,createdAt:new Date("2026-10-12T00:00:00Z"),updatedAt:new Date("2026-10-12T00:00:00Z"),hasInterfaceCatalog:true};
}
const catalog={Messages:{hello:"مرحبا"}};
beforeEach(()=>{vi.clearAllMocks();invalidateLanguageCache();mocks.query.mockResolvedValue([metadata(),metadata("de")]);mocks.catalog.mockResolvedValue({interfaceCatalog:catalog,interfaceSourceHash:"current-source",prepared:true,published:true,catalogReviewedAt:new Date()});});
afterEach(()=>vi.useRealTimers());

describe("publication metadata and active-locale catalog caches",()=>{
  it("projects metadata and catalog existence without selecting catalog JSON",async()=>{
    const rows=await getPublishedLanguageOverrides();
    expect(rows?.[0]).toMatchObject({code:"ar",hasInterfaceCatalog:true});expect(rows?.[0]).not.toHaveProperty("interfaceCatalog");
    const query=mocks.query.mock.calls[0][0].sql as string;
    expect(query).toContain('AS "hasInterfaceCatalog"');
    expect(query).not.toMatch(/SELECT[\s\S]*[\s,]"interfaceCatalog"\s*,/);
    expect(mocks.catalog).not.toHaveBeenCalled();
    await getPublishedLanguageOverrides();expect(mocks.query).toHaveBeenCalledOnce();
  });
  it("loads only the active locale and caches its current source revision",async()=>{
    expect(await getStoredInterfaceCatalog("ar","current-source")).toEqual(catalog);
    expect(await getStoredInterfaceCatalog("ar","current-source")).toEqual(catalog);
    expect(mocks.catalog).toHaveBeenCalledOnce();expect(mocks.catalog.mock.calls[0][0]).toMatchObject({where:{code:"ar"},select:{interfaceCatalog:true}});
    expect(await getStoredInterfaceCatalog("ar","obsolete-source")).toBeNull();expect(mocks.catalog).toHaveBeenCalledOnce();
  });
  it("rechecks publication and source hashes when a catalog changes during a metadata cache window",async()=>{
    mocks.catalog.mockResolvedValueOnce({interfaceCatalog:catalog,interfaceSourceHash:"new-source",prepared:true,published:true,catalogReviewedAt:new Date()});
    expect(await getStoredInterfaceCatalog("ar","current-source")).toBeNull();
    invalidateLanguageCache();mocks.catalog.mockResolvedValueOnce({interfaceCatalog:catalog,interfaceSourceHash:"current-source",prepared:true,published:false,catalogReviewedAt:new Date()});
    expect(await getStoredInterfaceCatalog("ar","current-source")).toBeNull();
  });
  it("explicit invalidation and 30-second expiry refresh active cached catalogs",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));
    await getStoredInterfaceCatalog("ar","current-source");
    invalidateLanguageCache();await getStoredInterfaceCatalog("ar","current-source");expect(mocks.catalog).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30_001);await getStoredInterfaceCatalog("ar","current-source");expect(mocks.catalog).toHaveBeenCalledTimes(3);expect(mocks.query).toHaveBeenCalledTimes(3);
  });
  it("bounds the catalog cache rather than retaining every published language",async()=>{
    const languages=Array.from({length:9},(_,index)=>metadata(`locale-${index}`));mocks.query.mockResolvedValue(languages);
    for(const language of languages)await getStoredInterfaceCatalog(language.code,"current-source");
    expect(mocks.catalog).toHaveBeenCalledTimes(9);
    await getStoredInterfaceCatalog(languages[0].code,"current-source");expect(mocks.catalog).toHaveBeenCalledTimes(10);
  });
  it.each([{code:"P2010",meta:{code:"42P01"}},{code:"P2021"},{code:"P2010",meta:{driverAdapterError:{name:"DriverAdapterError",cause:{kind:"TableDoesNotExist",originalCode:"42P01"}}}}])("negative-caches a confirmed missing additive table without loading any catalog (%j)",async error=>{
    mocks.query.mockRejectedValue(error);
    expect(await getPublishedLanguageOverrides()).toBeNull();expect(await getPublishedLanguageOverrides()).toBeNull();expect(await getStoredInterfaceCatalog("ar","current-source")).toBeNull();expect(mocks.query).toHaveBeenCalledOnce();expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it("preserves the last known administrator disable during a transient outage",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date("2026-10-12T00:00:00Z"));const disabled={...metadata("bn"),published:false,prepared:false,hasInterfaceCatalog:false};
    mocks.query.mockResolvedValueOnce([disabled]);expect((await getPublishedLanguageOverrides())?.[0]).toMatchObject({code:"bn",published:false});
    vi.advanceTimersByTime(30_001);mocks.query.mockRejectedValue(new Error("Database network unavailable"));
    expect((await getPublishedLanguageOverrides())?.[0]).toMatchObject({code:"bn",published:false,publicationOverride:true});
    expect((await getPublishedLanguageOverrides())?.[0].published).toBe(false);expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it("fails closed on a cold unknown outage with one sanitized cached exception",async()=>{
    mocks.query.mockRejectedValue(new Error("Could not connect to postgres://user:supersecret@db.test/catalog"));
    const first=await getPublishedLanguageOverrides().catch(error=>error);const second=await getPublishedLanguageOverrides().catch(error=>error);
    expect(first).toBeInstanceOf(LanguageRegistryUnavailableError);expect(second).toBe(first);expect(first.message).toContain("English remains available");expect(first.message).not.toContain("supersecret");expect(first).not.toHaveProperty("cause");expect(mocks.query).toHaveBeenCalledOnce();expect(mocks.catalog).not.toHaveBeenCalled();
    await expect(getStoredInterfaceCatalog("ar","current-source")).rejects.toBe(first);
  });
  it("does not fall back to stale publication state after explicit management invalidation",async()=>{
    await getPublishedLanguageOverrides();invalidateLanguageCache();mocks.query.mockRejectedValue(new Error("Database network unavailable"));
    await expect(getPublishedLanguageOverrides()).rejects.toBeInstanceOf(LanguageRegistryUnavailableError);
  });
  it.each(["ECONNREFUSED","42703"])("does not mistake Prisma adapter error %s for a missing table",async originalCode=>{
    mocks.query.mockRejectedValue({code:"P2010",meta:{driverAdapterError:{cause:{originalCode}}}});
    await expect(getPublishedLanguageOverrides()).rejects.toBeInstanceOf(LanguageRegistryUnavailableError);
  });
});
