import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentHash } from "@/lib/translations/validation";
import type { TranslationProvider } from "@/lib/translations/provider";

const mocks=vi.hoisted(()=>({db:{product:{findMany:vi.fn()},localeLanguage:{findUnique:vi.fn(),findMany:vi.fn(),upsert:vi.fn(),updateMany:vi.fn()},contentTranslation:{findUnique:vi.fn(),findMany:vi.fn(),create:vi.fn(),update:vi.fn(),upsert:vi.fn(),updateMany:vi.fn()},translationJob:{findMany:vi.fn(),count:vi.fn(),updateMany:vi.fn(),update:vi.fn(),createMany:vi.fn()},$queryRaw:vi.fn(),$transaction:vi.fn()}}));
vi.mock("@/lib/db/prisma",()=>({prisma:mocks.db}));
vi.mock("@/lib/i18n/catalogs",()=>({loadBundledMessages:vi.fn(async()=>({Messages:{test:"Test"}}))}));
import { getPublishedEntityLocales, localizePublicCollection, markPublicTranslationsStale, preparePublicBatch, refreshProviderLanguages, retryTranslationJob, runTranslationJobs, savePublicTranslation, setPublicTranslationStatus, setInterfaceCatalog, translationDashboard } from "@/lib/translations/service";
import { invalidateLanguageCache } from "@/lib/translations/languages";

const record={id:"p1",status:"ACTIVE",name:"Pump",productCode:"AB-123",modelNumber:null,brand:null,manufacturer:null};
const contextHash=contentHash({version:1,protectedTerms:["SexToy","AB-123"],glossary:null});
const job={id:"j1",entityType:"product",entityId:"p1",field:"name",sourceLocale:"en",targetLocale:"bn",sourceHash:contentHash("Pump"),contextHash,status:"queued",attempts:0};
const provider:TranslationProvider={name:"mock",supportedLanguages:async()=>[],translate:vi.fn(async values=>values.map(()=>"পাম্প"))};
beforeEach(()=>{vi.clearAllMocks();invalidateLanguageCache();mocks.db.$queryRaw.mockResolvedValue([]);mocks.db.product.findMany.mockResolvedValue([record]);mocks.db.localeLanguage.findUnique.mockImplementation(async({where:{code}})=>({code,available:true,providerCode:code,providerTargets:code==="en"?["bn"]:["en"],providerFetchedAt:new Date("2026-10-12T00:00:00Z")}));mocks.db.localeLanguage.findMany.mockResolvedValue([]);mocks.db.localeLanguage.updateMany.mockResolvedValue({count:1});mocks.db.contentTranslation.findUnique.mockResolvedValue(null);mocks.db.contentTranslation.findMany.mockResolvedValue([]);mocks.db.contentTranslation.updateMany.mockResolvedValue({count:1});mocks.db.translationJob.findMany.mockResolvedValue([job]);mocks.db.translationJob.count.mockResolvedValue(0);mocks.db.translationJob.updateMany.mockResolvedValue({count:1});mocks.db.$transaction.mockImplementation(async callback=>callback(mocks.db));mocks.db.contentTranslation.create.mockResolvedValue({});});
afterEach(()=>{vi.useRealTimers();});
describe("bounded translation jobs",()=>{
  it("allows an operator to restart an exhausted failure with a fresh bounded attempt budget",async()=>{
    expect(await retryTranslationJob("failed-job")).toEqual({count:1});
    expect(mocks.db.translationJob.updateMany).toHaveBeenCalledWith({where:{id:"failed-job",OR:[{status:"failed"},{status:"running",lockedAt:{lt:expect.any(Date)}}]},data:{status:"queued",attempts:0,lockedAt:null,nextAttemptAt:expect.any(Date),lastError:null}});
  });
  it("regenerates an unreviewed draft after correcting its declared source locale",async()=>{
    mocks.db.contentTranslation.findUnique.mockResolvedValue({...job,id:"t1",sourceLocale:"fr",origin:"machine",status:"draft"});
    expect(await preparePublicBatch({entityType:"product",entityIds:["p1"],fields:["name"],sourceLocale:"en",targetLocale:"bn",dryRun:false})).toMatchObject({jobs:1});
    expect(mocks.db.translationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({dedupeKey:{not:expect.any(String)},status:{in:["queued","failed","running"]}}),data:{status:"stale",lockedAt:null}}));
  });
  it("can regenerate a returned source revision without duplicating its historical job key",async()=>{
    mocks.db.contentTranslation.findUnique.mockResolvedValue({...job,id:"t1",sourceHash:contentHash("Newer pump"),origin:"machine",status:"draft"});
    await preparePublicBatch({entityType:"product",entityIds:["p1"],fields:["name"],targetLocale:"bn",dryRun:false});
    expect(mocks.db.translationJob.createMany).toHaveBeenCalledWith(expect.objectContaining({skipDuplicates:true}));
    expect(mocks.db.translationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:{dedupeKey:expect.any(String),status:{in:["completed","stale","skipped-manual"]}},data:expect.objectContaining({status:"queued",attempts:0})}));
  });
  it("uses the actual Portuguese model for a regional job while retaining its target identity",async()=>{
    mocks.db.localeLanguage.findUnique.mockImplementation(async({where:{code}})=>({code,available:true,providerCode:code,providerTargets:code==="en"?["pt"]:["en"],providerFetchedAt:new Date("2026-10-12T00:00:00Z")}));
    await preparePublicBatch({entityType:"product",entityIds:["p1"],fields:["name"],targetLocale:"pt-PT",dryRun:false});
    expect(mocks.db.translationJob.createMany).toHaveBeenCalledWith(expect.objectContaining({data:[expect.objectContaining({targetLocale:"pt-PT"})]}));
    mocks.db.translationJob.findMany.mockResolvedValue([{...job,targetLocale:"pt-PT"}]);
    expect(await runTranslationJobs(1,provider)).toEqual([{id:"j1",status:"completed"}]);
    expect(provider.translate).toHaveBeenCalledWith(["Pump"],"en","pt");
    expect(mocks.db.contentTranslation.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({targetLocale:"pt-PT"})}));
    expect(mocks.db.localeLanguage.findUnique).not.toHaveBeenCalledWith({where:{code:"pt-PT"}});
  });
  it("queues the latest source after two edits while an earlier translation remains stale",async()=>{
    let current={...record,name:"Water pump"};
    const old={...job,id:"t1",origin:"machine",value:"পুরোনো",status:"stale",reviewedAt:null,reviewedBy:null};
    mocks.db.product.findMany.mockImplementation(async()=>[current]);
    mocks.db.contentTranslation.findMany.mockResolvedValue([old]);
    mocks.db.contentTranslation.findUnique.mockResolvedValue(old);
    await markPublicTranslationsStale("product",["p1"]);
    current={...record,name:"Updated water pump"};
    await markPublicTranslationsStale("product",["p1"]);
    const revisions=mocks.db.translationJob.createMany.mock.calls.flatMap(([call])=>call.data.map((row:{sourceHash:string})=>row.sourceHash));
    expect(revisions).toEqual([contentHash("Water pump"),contentHash("Updated water pump")]);
    expect(mocks.db.contentTranslation.findMany).toHaveBeenCalledWith({where:{entityType:"product",entityId:{in:["p1"]}}});
  });
  it("renews a long-running job lease so a second worker cannot bypass its global permit",async()=>{
    vi.useFakeTimers();
    let leaseDate:Date|undefined;let entered!:()=>void;let release!:()=>void;
    const hasEntered=new Promise<void>(resolve=>{entered=resolve;});const held=new Promise<void>(resolve=>{release=resolve;});
    mocks.db.translationJob.count.mockImplementation(async()=>leaseDate&&leaseDate.getTime()>=Date.now()-600_000?1:0);
    mocks.db.translationJob.updateMany.mockImplementation(async({where,data})=>{
      if(data.status==="running"||data.lockedAt instanceof Date){
        if(where.status==="running"&&leaseDate?.getTime()!==where.lockedAt.getTime())return {count:0};
        leaseDate=data.lockedAt;
      }
      return {count:1};
    });
    mocks.db.translationJob.findMany.mockResolvedValueOnce([job]).mockResolvedValueOnce([{...job,id:"j2"}]);
    const slow={...provider,translate:vi.fn(async()=>{entered();await held;return ["পাম্প"];})};
    const first=runTranslationJobs(1,slow);await hasEntered;
    await vi.advanceTimersByTimeAsync(660_000);
    expect(await runTranslationJobs(1,slow)).toEqual([{id:"j2",status:"busy"}]);
    expect(slow.translate).toHaveBeenCalledTimes(1);release();
    expect(await first).toEqual([{id:"j1",status:"completed"}]);
  });
  it("discards a provider result after its job ownership changes",async()=>{
    let owned=true;
    mocks.db.translationJob.updateMany.mockImplementation(async()=>({count:owned?1:0}));
    const interrupted={...provider,translate:vi.fn(async()=>{owned=false;return ["পাম্প"];})};
    expect(await runTranslationJobs(1,interrupted)).toEqual([{id:"j1",status:"lease-lost"}]);
    expect(mocks.db.contentTranslation.create).not.toHaveBeenCalled();
    expect(mocks.db.contentTranslation.updateMany).not.toHaveBeenCalled();
  });
  it("rejects manual wording prepared against an obsolete source revision",async()=>{
    await expect(savePublicTranslation({entityType:"product",entityId:"p1",field:"name",targetLocale:"bn",value:"পাম্প",publish:false,reviewedBy:"admin",expectedSourceHash:contentHash("Older pump")})).rejects.toThrow("Source content changed");
    expect(mocks.db.contentTranslation.upsert).not.toHaveBeenCalled();
  });
  it("rejects approval of a draft that changed since the reviewer loaded it",async()=>{
    mocks.db.contentTranslation.findUnique.mockResolvedValue({...job,id:"t1",value:"পাম্প",updatedAt:new Date("2026-10-12T01:00:00Z")});
    await expect(setPublicTranslationStatus("t1",true,"admin","2026-10-12T00:00:00.000Z")).rejects.toThrow("Translation changed");
    expect(mocks.db.contentTranslation.update).not.toHaveBeenCalled();
  });
  it("deduplicates queued revisions at the database unique-key boundary",async()=>{await preparePublicBatch({entityType:"product",entityIds:["p1"],fields:["name"],targetLocale:"bn",dryRun:false});expect(mocks.db.translationJob.createMany).toHaveBeenCalledWith(expect.objectContaining({skipDuplicates:true,data:[expect.objectContaining({sourceHash:contentHash("Pump"),contextHash})]}));});
  it("does not infer a directed pair from independent source and target presence",async()=>{
    mocks.db.localeLanguage.findUnique.mockImplementation(async({where:{code}})=>({code,available:true,providerCode:code,providerTargets:code==="en"?["fr"]:["en"],providerFetchedAt:new Date("2026-10-12T00:00:00Z")}));
    await expect(preparePublicBatch({entityType:"product",entityIds:["p1"],fields:["name"],targetLocale:"bn",dryRun:false})).rejects.toThrow("do not provide en → bn");
    expect(mocks.db.translationJob.createMany).not.toHaveBeenCalled();
    expect(await runTranslationJobs(1,provider)).toEqual([{id:"j1",status:"failed"}]);expect(provider.translate).not.toHaveBeenCalled();
  });
  it("requires an exact current pair snapshot rather than legacy target booleans",async()=>{
    mocks.db.localeLanguage.findUnique.mockResolvedValue({code:"bn",available:true,providerCode:"bn"});
    await expect(preparePublicBatch({entityType:"product",entityIds:["p1"],fields:["name"],targetLocale:"bn",dryRun:true})).rejects.toThrow("Refresh capabilities");
    expect(mocks.db.translationJob.createMany).not.toHaveBeenCalled();
  });
  it("refreshes source-only rows and directed pairs without altering reviewed publication",async()=>{
    const discovered:TranslationProvider={...provider,supportedLanguages:async()=>[{code:"en",name:"English",supportsSource:true,supportsTarget:false,targets:["fr"]},{code:"fr",name:"French",supportsSource:false,supportsTarget:true,targets:[]}]};
    expect(await refreshProviderLanguages(discovered)).toMatchObject({available:1,languages:2,pairs:1});
    expect(mocks.db.localeLanguage.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{code:"en"},update:expect.objectContaining({available:false,providerTargets:["fr"]})}));
    expect(mocks.db.localeLanguage.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{code:"fr"},update:expect.objectContaining({available:true,providerTargets:[]})}));
    for(const [call] of mocks.db.localeLanguage.upsert.mock.calls){expect(call.update).not.toHaveProperty("published");expect(call.update).not.toHaveProperty("catalogReviewedAt");}
    expect(mocks.db.localeLanguage.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{available:false,providerTargets:[],providerFetchedAt:null}}));
  });
  it("preserves the last successful capability snapshot when discovery is offline",async()=>{
    await expect(refreshProviderLanguages({...provider,supportedLanguages:vi.fn().mockRejectedValue(new Error("LibreTranslate offline"))})).rejects.toThrow("offline");
    expect(mocks.db.$transaction).not.toHaveBeenCalled();expect(mocks.db.localeLanguage.upsert).not.toHaveBeenCalled();
  });
  it("invalidates stale terminology context when scheduling regeneration",async()=>{
    await preparePublicBatch({entityType:"product",entityIds:["p1"],fields:["name"],targetLocale:"bn",dryRun:false});
    expect(mocks.db.contentTranslation.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({OR:[{sourceLocale:{not:job.sourceLocale}},{sourceHash:{not:job.sourceHash}},{contextHash:{not:job.contextHash}}]})}));
  });
  it("only one concurrent worker can claim a revision",async()=>{mocks.db.translationJob.updateMany.mockResolvedValueOnce({count:1}).mockResolvedValueOnce({count:0});await Promise.all([runTranslationJobs(1,provider),runTranslationJobs(1,provider)]);expect(provider.translate).toHaveBeenCalledTimes(1);});
  it("enforces a global permit for concurrent workers claiming different revisions",async()=>{
    let running=0;let tail=Promise.resolve();let entered!:()=>void;let release!:()=>void;
    const hasEntered=new Promise<void>(resolve=>{entered=resolve;});const pending=new Promise<void>(resolve=>{release=resolve;});
    mocks.db.$transaction.mockImplementation(callback=>{const turn=tail.then(()=>callback(mocks.db));tail=turn.then(()=>undefined);return turn;});
    mocks.db.translationJob.count.mockImplementation(async()=>running);
    mocks.db.translationJob.updateMany.mockImplementation(async()=>{running++;return {count:1};});
    mocks.db.translationJob.findMany.mockResolvedValueOnce([job]).mockResolvedValueOnce([{...job,id:"j2",entityId:"p2"}]);
    const held={...provider,translate:vi.fn(async()=>{entered();await pending;return ["পাম্প"];})};
    const first=runTranslationJobs(1,held);await hasEntered;
    expect(await runTranslationJobs(1,held)).toEqual([{id:"j2",status:"busy"}]);
    expect(held.translate).toHaveBeenCalledTimes(1);release();await first;
  });
  it("rejects obsolete jobs before any provider call",async()=>{mocks.db.product.findMany.mockResolvedValue([{...record,name:"Updated pump"}]);expect(await runTranslationJobs(1,provider)).toEqual([{id:"j1",status:"stale"}]);expect(provider.translate).not.toHaveBeenCalled();expect(mocks.db.contentTranslation.create).not.toHaveBeenCalled();});
  it("rejects a source revision that changed while the provider was running",async()=>{mocks.db.product.findMany.mockResolvedValueOnce([record]).mockResolvedValueOnce([{...record,name:"Updated pump"}]);expect(await runTranslationJobs(1,provider)).toEqual([{id:"j1",status:"stale"}]);expect(mocks.db.contentTranslation.create).not.toHaveBeenCalled();});
  it("never overwrites a manual override created while a job was running",async()=>{mocks.db.contentTranslation.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({id:"t1",origin:"manual"});expect(await runTranslationJobs(1,provider)).toEqual([{id:"j1",status:"skipped-manual"}]);expect(mocks.db.contentTranslation.updateMany).not.toHaveBeenCalled();expect(mocks.db.contentTranslation.create).not.toHaveBeenCalled();});
  it.each([{origin:"manual"},{origin:"machine",reviewedAt:new Date(),reviewedBy:"admin"}])("skips a human-approved translation before contacting the engine (%j)",async approved=>{
    mocks.db.contentTranslation.findUnique.mockResolvedValue({id:"t1",...approved});
    expect(await runTranslationJobs(1,provider)).toEqual([{id:"j1",status:"skipped-manual"}]);expect(provider.translate).not.toHaveBeenCalled();
    expect(mocks.db.contentTranslation.updateMany).not.toHaveBeenCalled();
  });
  it("bounds provider retry failures and schedules backoff without publishing content",async()=>{const failed={...provider,translate:vi.fn().mockRejectedValue(new Error("Temporary failure"))};expect(await runTranslationJobs(1,failed)).toEqual([{id:"j1",status:"failed"}]);expect(mocks.db.translationJob.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:"running",attempts:1,lockedAt:expect.any(Date)}),data:expect.objectContaining({status:"failed",lockedAt:null,nextAttemptAt:expect.any(Date)})}));expect(mocks.db.contentTranslation.create).not.toHaveBeenCalled();});
  it("keeps original English SEO readiness when the additive table is not deployed",async()=>{mocks.db.contentTranslation.findMany.mockRejectedValue(new Error("Table does not exist"));expect((await getPublishedEntityLocales("product",["p1"],["name"])).get("p1")).toEqual(["en"]);expect(mocks.db.product.findMany).toHaveBeenCalledTimes(1);});
  it("does not advertise source or context obsolete translated SEO variants",async()=>{mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,contextHash:"obsolete-glossary",value:"পাম্প",status:"published"}]);expect((await getPublishedEntityLocales("product",["p1"],["name"])).get("p1")).toEqual(["en"]);});
  it("propagates source query failure rather than caching an incomplete sitemap",async()=>{mocks.db.product.findMany.mockRejectedValue(new Error("Canonical source unavailable"));await expect(getPublishedEntityLocales("product",["p1"],["name"])).rejects.toThrow("Canonical source unavailable");});
  it("renders stored public translations and preserves prices with source fallback metadata",async()=>{mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,value:"পাম্প",status:"published"}]);const [localized]=await localizePublicCollection("product",[{...record,salePrice:12345}],"bn");expect(localized).toMatchObject({name:"পাম্প",salePrice:12345,translationAvailable:true,sourceLocale:"en",contentLocale:"bn",fieldLocales:{name:"bn"}});mocks.db.contentTranslation.findMany.mockResolvedValue([]);const [fallback]=await localizePublicCollection("product",[{...record,salePrice:12345}],"bn");expect(fallback).toMatchObject({name:"Pump",salePrice:12345,translationAvailable:false,contentLocale:"en"});});
  it("source mutation marks a manual override stale without changing its text or origin",async()=>{mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,id:"t1",origin:"manual",sourceHash:"old-source",value:"ম্যানুয়াল",status:"published"}]);expect(await markPublicTranslationsStale("product",["p1"])).toBe(1);expect(mocks.db.contentTranslation.updateMany).toHaveBeenCalledWith({where:{id:{in:["t1"]}},data:{status:"stale"}});});
  it("source mutation queues a changed unreviewed machine draft without contacting the engine",async()=>{
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,id:"t1",origin:"machine",sourceHash:"old-source",value:"পুরোনো",status:"draft",reviewedAt:null,reviewedBy:null}]);
    expect(await markPublicTranslationsStale("product",["p1"])).toBe(1);
    expect(mocks.db.translationJob.createMany).toHaveBeenCalledWith(expect.objectContaining({skipDuplicates:true,data:[expect.objectContaining({sourceHash:job.sourceHash,targetLocale:"bn"})]}));expect(provider.translate).not.toHaveBeenCalled();
  });
  it("marks a reviewed machine translation stale while preserving its approved wording",async()=>{
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,id:"t1",origin:"machine",sourceHash:"old-source",value:"অনুমোদিত",status:"published",reviewedAt:new Date(),reviewedBy:"admin"}]);
    expect(await markPublicTranslationsStale("product",["p1"])).toBe(1);
    expect(mocks.db.contentTranslation.updateMany).toHaveBeenCalledWith({where:{id:{in:["t1"]}},data:{status:"stale"}});expect(mocks.db.translationJob.createMany).not.toHaveBeenCalled();
  });
  it("provider discovery keeps Bengali unprepared and unpublished without a human review",async()=>{mocks.db.localeLanguage.findMany.mockResolvedValue([{code:"bn",englishName:"Bengali",nativeName:"বাংলা",providerCode:"bn",providerTargets:["en"],providerFetchedAt:new Date(),available:true,prepared:false,published:false,publicationOverride:false,interfaceCatalog:null,catalogReviewedAt:null}]);expect((await translationDashboard()).languages.find(language=>language.code==="bn")).toMatchObject({available:true,prepared:false,published:false,catalogReviewedAt:null});});
  it("an explicit administrator override can disable a bundled language",async()=>{mocks.db.localeLanguage.findMany.mockResolvedValue([{code:"bn",englishName:"Bengali",nativeName:"বাংলা",providerCode:"bn",providerTargets:["en"],providerFetchedAt:new Date(),available:true,prepared:false,published:false,publicationOverride:true,interfaceCatalog:null,catalogReviewedAt:null}]);expect((await translationDashboard()).languages.find(language=>language.code==="bn")).toMatchObject({available:true,prepared:false,published:false});});
  it("uses a current published same-script fallback without claiming the target is ready",async()=>{
    const current={published:true,prepared:true,publicationOverride:true,catalogReviewedAt:new Date(),hasInterfaceCatalog:true,interfaceSourceHash:contentHash({Messages:{test:"Test"}})};
    mocks.db.$queryRaw.mockResolvedValue([{...current,code:"ar-EG",fallbackLocale:"ar"},{...current,code:"ar"}]);
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,targetLocale:"ar",value:"مضخة",status:"published"}]);
    const [localized]=await localizePublicCollection("product",[{...record,salePrice:12345}],"ar-EG");
    expect(localized).toMatchObject({name:"مضخة",salePrice:12345,translationAvailable:false,contentAvailable:true,sourceLocale:"en",contentLocale:"ar",fieldLocales:{name:"ar"}});
    expect(mocks.db.contentTranslation.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({targetLocale:{in:["ar-EG","ar"]}})}));
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,targetLocale:"ar",value:"مضخة",status:"published"},{...job,targetLocale:"ar-EG",value:"المضخة",status:"published"}]);
    expect((await localizePublicCollection("product",[record],"ar-EG"))[0]).toMatchObject({name:"المضخة",translationAvailable:true,contentAvailable:true,fieldLocales:{name:"ar-EG"}});
  });
  it.each(["disabled","outdated"])("rejects a %s fallback and preserves original source markers",async condition=>{
    mocks.db.$queryRaw.mockResolvedValue([{code:"ar-EG",fallbackLocale:"ar"},{code:"ar",published:condition!=="disabled",prepared:true,publicationOverride:true,catalogReviewedAt:new Date(),hasInterfaceCatalog:true,interfaceSourceHash:condition==="outdated"?"old-source":contentHash({Messages:{test:"Test"}})}]);
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,targetLocale:"ar",value:"مضخة",status:"published"}]);
    expect((await localizePublicCollection("product",[record],"ar-EG"))[0]).toMatchObject({name:"Pump",translationAvailable:false,contentAvailable:false,contentLocale:"en",fieldLocales:{name:"en"}});
  });
  it("never substitutes Simplified Chinese for Traditional Chinese",async()=>{
    mocks.db.$queryRaw.mockResolvedValue([{code:"zh-Hant",fallbackLocale:"zh-Hans"},{code:"zh-Hans",published:true,prepared:true,publicationOverride:true,catalogReviewedAt:new Date(),hasInterfaceCatalog:true,interfaceSourceHash:contentHash({Messages:{test:"Test"}})}]);
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,targetLocale:"zh-Hans",value:"泵",status:"published"}]);
    expect((await localizePublicCollection("product",[record],"zh-Hant"))[0]).toMatchObject({name:"Pump",translationAvailable:false,fieldLocales:{name:"en"}});
    expect(mocks.db.contentTranslation.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({targetLocale:{in:["zh-Hant"]}})}));
  });
  it("preserves the actual source locale when a published compatible source fallback is used",async()=>{
    mocks.db.$queryRaw.mockResolvedValue([{code:"en-GB",fallbackLocale:"en"}]);
    expect((await localizePublicCollection("product",[record],"en-GB"))[0]).toMatchObject({name:"Pump",translationAvailable:false,contentAvailable:true,contentLocale:"en",fieldLocales:{name:"en"}});
  });
  it.each([["fr","en"],["ur","ar"]])("does not treat %s to %s as a compatible fallback merely because scripts match",async(locale,fallback)=>{
    mocks.db.$queryRaw.mockResolvedValue([{code:locale,fallbackLocale:fallback},{code:fallback,published:true,prepared:true,publicationOverride:true,catalogReviewedAt:new Date(),hasInterfaceCatalog:true,interfaceSourceHash:contentHash({Messages:{test:"Test"}})}]);
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,targetLocale:fallback,value:"Fallback translation",status:"published"}]);
    expect((await localizePublicCollection("product",[record],locale))[0]).toMatchObject({name:"Pump",translationAvailable:false,contentAvailable:false,fieldLocales:{name:"en"}});
    expect(mocks.db.contentTranslation.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({targetLocale:{in:[locale]}})}));
  });
  it("rejects English source overrides and wholly unchanged non-English imports before any database write",async()=>{
    const source={Hello:"Hello {name}",Brand:"SexToy"};
    await expect(setInterfaceCatalog({code:"en",englishName:"English",nativeName:"English",source,catalog:source,reviewedBy:"admin"})).rejects.toThrow("repository-controlled");
    await expect(setInterfaceCatalog({code:"ar",englishName:"Arabic",nativeName:"العربية",source,catalog:source,reviewedBy:"admin"})).rejects.toThrow("unchanged English");
    expect(mocks.db.localeLanguage.upsert).not.toHaveBeenCalled();
  });
  it("prepares a genuinely translated catalog while preserving protected brand names",async()=>{
    const source={Hello:"Hello {name}",Brand:"SexToy"};mocks.db.localeLanguage.upsert.mockResolvedValue({code:"bn",prepared:true,published:false});
    const result=await setInterfaceCatalog({code:"bn",englishName:"Bengali",nativeName:"বাংলা",source,catalog:{Hello:"হ্যালো {name}",Brand:"SexToy"},reviewedBy:"admin"});
    expect(result).toMatchObject({messages:2,changedMessages:1,language:{code:"bn",prepared:true,published:false}});
  });
  it("requires explicit unchanged-prose review before accepting a catalog approval",async()=>{
    const source={Hello:"Hello world",Shared:"Contact us",Brand:"SexToy"};
    const catalog={Hello:"Bonjour le monde",Shared:"Contact us",Brand:"SexToy"};
    const input={code:"fr",englishName:"French",nativeName:"Français",source,catalog,reviewedBy:"admin"};
    await expect(setInterfaceCatalog(input)).rejects.toThrow("unchanged source messages");
    expect(mocks.db.localeLanguage.upsert).not.toHaveBeenCalled();
    mocks.db.localeLanguage.upsert.mockResolvedValue({code:"fr",catalogReviewedAt:new Date()});
    expect(await setInterfaceCatalog({...input,acknowledgeUnchanged:true})).toMatchObject({changedMessages:1,unchangedMessages:["Shared"]});
  });
  it("reports unchanged source prose for an imported draft without granting human review",async()=>{
    mocks.db.localeLanguage.upsert.mockResolvedValue({code:"fr",catalogReviewedAt:null});
    const result=await setInterfaceCatalog({code:"fr",englishName:"French",nativeName:"Français",source:{Translated:"Buy pump",Shared:"Contact us"},catalog:{Translated:"Acheter une pompe",Shared:"Contact us"}});
    expect(result).toMatchObject({unchangedMessages:["Shared"],language:{catalogReviewedAt:null}});
    expect(mocks.db.localeLanguage.upsert.mock.calls[0][0].create.catalogReviewedAt).toBeNull();
  });
  it("shows regional model capabilities and the current source snapshot in management",async()=>{
    mocks.db.localeLanguage.findMany.mockResolvedValue([{code:"pt",englishName:"Portuguese",providerCode:"pt",providerTargets:["en","pt"],providerFetchedAt:new Date(),available:true,publicationOverride:false},{code:"pt-PT",englishName:"Portuguese (Portugal)",providerCode:null,publicationOverride:true,prepared:true,published:false}]);
    mocks.db.contentTranslation.findMany.mockResolvedValue([{...job,id:"t1",sourceHash:"old-revision",value:"পুরোনো",origin:"machine"}]);
    const dashboard=await translationDashboard();
    expect(dashboard.languages.find(row=>row.code==="pt-PT")).toMatchObject({providerCode:"pt",providerTargets:["en","pt"],available:true});
    expect(dashboard.translations[0]).toMatchObject({currentSourceValue:"Pump",currentSourceHash:job.sourceHash,currentContextHash:job.contextHash});
  });
});
