import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { ServiceError } from "@/lib/services/service-error";
import { LIBRETRANSLATE_DEFAULT_URL, LibreTranslateProvider, type TranslationProvider } from "./provider";
import { PUBLIC_FIELDS, assertPublicField, translatePublicValue, type PublicEntity } from "./content";
import { assertTranslatedCatalog, canonicalLocale, contentHash, localeDirection, providerLanguageCode, sourceLanguage, translationCacheKey, validateCatalog, type MessageCatalog } from "./validation";
import { getPublishedLanguageOverrides, invalidateLanguageCache } from "./languages";
import { getLocaleDefinition, getPublishedLocales, getRegisteredLocales } from "@/lib/i18n/registry";

type Db = Prisma.TransactionClient;

export async function refreshProviderLanguages(provider: TranslationProvider = new LibreTranslateProvider()) {
  const languages = await provider.supportedLanguages();
  const now = new Date();
  const codes = new Set(languages.map(language=>language.code));
  const incoming = new Set(languages.flatMap(language=>(language.targets??[]).filter(target=>target!==language.code&&codes.has(target))));
  let pairs=0;
  // A single snapshot prevents a refresh exposing mixed or partially written pairs.
  await prisma.$transaction(async tx=>{
    await tx.localeLanguage.updateMany({where:{providerCode:{not:null}},data:{available:false,providerTargets:[],providerFetchedAt:null}});
    for(const language of languages){
      let code:string;
      try{code=canonicalLocale(language.code);}catch{continue;}
      const definition=getLocaleDefinition(code);
      const targets=[...new Set((language.targets??[]).filter(target=>codes.has(target)))];
      pairs+=targets.length;
      const data={englishName:language.name,nativeName:definition.nativeName,direction:definition.direction,providerCode:language.code,providerTargets:targets,available:incoming.has(language.code),providerFetchedAt:now};
      await tx.localeLanguage.upsert({where:{code},create:{code,...data},update:data});
    }
  },{isolationLevel:"Serializable"});
  invalidateLanguageCache();
  return {available:incoming.size,languages:languages.length,pairs,fetchedAt:now};
}

/** Target presence alone does not prove that its model translates this source. */
async function storedProviderPair(sourceLocale:string,targetLocale:string){
  const sourceProviderCode=providerLanguageCode(sourceLocale);
  const targetProviderCode=providerLanguageCode(targetLocale);
  const [source,target]=await Promise.all([
    prisma.localeLanguage.findUnique({where:{code:canonicalLocale(sourceProviderCode)}}),
    prisma.localeLanguage.findUnique({where:{code:canonicalLocale(targetProviderCode)}}),
  ]);
  if(!source?.providerFetchedAt||!target?.providerFetchedAt||!target.available||target.providerCode!==targetProviderCode||source.providerCode!==sourceProviderCode||source.providerFetchedAt.getTime()!==target.providerFetchedAt.getTime()||!Array.isArray(source.providerTargets)||!source.providerTargets.includes(targetProviderCode)){
    throw new ServiceError(400,`The installed LibreTranslate models do not provide ${sourceLocale} → ${targetLocale}. Refresh capabilities or import a reviewed manual translation.`);
  }
  return {source:sourceProviderCode,target:targetProviderCode};
}

export async function setInterfaceCatalog(input: { code: string; englishName: string; nativeName: string; catalog: MessageCatalog; source: MessageCatalog; reviewedBy?: string; fallbackLocale?: string;acknowledgeUnchanged?:boolean }) {
  const code=canonicalLocale(input.code);
  if(code==="en")throw new ServiceError(400,"English is repository-controlled. Update and validate the committed English catalogs before deployment.");
  const validated=validateCatalog(input.source,input.catalog);
  const {changedMessages,unchangedMessages}=assertTranslatedCatalog(input.source,input.catalog,code);
  if(input.reviewedBy&&unchangedMessages.length&&!input.acknowledgeUnchanged)throw new ServiceError(409,`Review ${unchangedMessages.length} unchanged source messages and explicitly acknowledge intentional shared wording before approving the catalog. Keys: ${unchangedMessages.slice(0,20).join(", ")}`);
  if(input.fallbackLocale){const fallback=new Intl.Locale(canonicalLocale(input.fallbackLocale));const target=new Intl.Locale(code);if(fallback.language!==target.language||fallback.maximize().script!==target.maximize().script)throw new ServiceError(400,"A declared fallback must share the base language and writing system.");}
  const row=await prisma.localeLanguage.upsert({where:{code},create:{code,englishName:input.englishName,nativeName:input.nativeName,direction:localeDirection(code),prepared:true,published:false,publicationOverride:true,interfaceCatalog:input.catalog as Prisma.InputJsonValue,interfaceSourceHash:validated.hash,catalogReviewedAt:input.reviewedBy?new Date():null,fallbackLocale:input.fallbackLocale?canonicalLocale(input.fallbackLocale):null},update:{englishName:input.englishName,nativeName:input.nativeName,direction:localeDirection(code),prepared:true,published:false,publicationOverride:true,interfaceCatalog:input.catalog as Prisma.InputJsonValue,interfaceSourceHash:validated.hash,catalogReviewedAt:input.reviewedBy?new Date():null,fallbackLocale:input.fallbackLocale?canonicalLocale(input.fallbackLocale):null}});
  invalidateLanguageCache(); return { language:row, messages:validated.messages,changedMessages,unchangedMessages };
}

export async function publishLanguage(code: string, published: boolean, source: MessageCatalog) {
  code=canonicalLocale(code);
  if(code==="en" && !published) throw new ServiceError(400,"English must remain published as the default language.");
  const result=await prisma.$transaction(async tx=>{
  const row=await tx.localeLanguage.findUnique({where:{code}});
  if(!row && !published && getPublishedLocales().some(locale=>locale.code===code)){
    const definition=getLocaleDefinition(code);return tx.localeLanguage.create({data:{code,englishName:definition.englishName,nativeName:definition.nativeName,direction:definition.direction,providerCode:definition.providerCode,prepared:false,published:false,publicationOverride:true,available:false}});
  }
  if(!row) throw new ServiceError(404,"Import and validate the language catalog first.");
  if(published) {
    if(!row.prepared || !row.catalogReviewedAt || !row.interfaceCatalog || row.interfaceSourceHash!==contentHash(source)) throw new ServiceError(409,"A complete current catalog and explicit review are required before publication.");
    validateCatalog(source,row.interfaceCatalog as MessageCatalog);
    if(code!=="en")assertTranslatedCatalog(source,row.interfaceCatalog as MessageCatalog,code);
  }
  return tx.localeLanguage.update({where:{code,updatedAt:row.updatedAt},data:{published,publicationOverride:true}});
  },{isolationLevel:"Serializable"});
  invalidateLanguageCache(); return result;
}

async function sourceRecords(db: Db, entityType: PublicEntity, entityIds: string[]): Promise<Record<string,unknown>[]> {
  const where={id:{in:entityIds}};
  switch(entityType) {
    case "product": return db.product.findMany({where,select:{id:true,status:true,name:true,description:true,descriptionBlocks:true,seoTitle:true,metaDescription:true,productCode:true,modelNumber:true,brand:{select:{name:true}},manufacturer:{select:{name:true}}}});
    case "category": return db.category.findMany({where,select:{id:true,status:true,name:true,description:true,seoTitle:true,metaDescription:true}});
    case "brand": return db.brand.findMany({where,select:{id:true,status:true,name:true,description:true,seoTitle:true,metaDescription:true}});
    case "manufacturer": return db.manufacturer.findMany({where,select:{id:true,status:true,name:true,description:true}});
    case "banner": return db.banner.findMany({where,select:{id:true,status:true,title:true,subtitle:true,description:true,metadata:true}});
  }
}
async function sourceRecord(db: Db, entityType: PublicEntity, entityId: string): Promise<Record<string,unknown> | null> {
  return (await sourceRecords(db,entityType,[entityId]))[0]??null;
}
function sourceValue(record: Record<string,unknown>, field: string): string | null {
  const value=field.split(".").reduce<unknown>((node,key)=>node&&typeof node==="object"?(node as Record<string,unknown>)[key]:undefined,record); if(value===null || value===undefined || value==="") return null;
  return field==="descriptionBlocks" ? JSON.stringify(value) : typeof value==="string" ? value : null;
}
function protectedTerms(record: Record<string,unknown>): string[] {
  return ["SexToy",record.productCode,record.modelNumber,record.brand && (record.brand as {name:string}).name,record.manufacturer && (record.manufacturer as {name:string}).name,...(process.env.TRANSLATION_PROTECTED_TERMS??"").split("|")].filter((value):value is string=>typeof value==="string" && !!value);
}
// Keep the original empty-glossary hash shape so reviewed stored text remains usable.
function contextFor(record:Record<string,unknown>) { return contentHash({version:1,protectedTerms:protectedTerms(record),glossary:null}); }
const batchLimit=()=>Math.max(1,Math.min(100,Number(process.env.TRANSLATION_BATCH_LIMIT)||25));
const characterLimit=()=>Math.max(1,Math.min(250_000,Number(process.env.TRANSLATION_CHARACTER_LIMIT)||50_000));
const concurrencyLimit=()=>Math.max(1,Math.min(5,Number(process.env.TRANSLATION_CONCURRENCY)||1));
const JOB_LEASE_MS=600_000;
class JobLeaseLostError extends Error {
  constructor(){super("Translation job ownership changed; this worker cannot save its result.");}
}
function jobLease(job:{id:string;attempts:number},claimedAt:Date){
  let lockedAt=claimedAt;
  let lost=false;
  let pending:Promise<void>|undefined;
  const where=()=>({id:job.id,status:"running",attempts:job.attempts+1,lockedAt});
  const touch=async()=>{
    if(lost)throw new JobLeaseLostError();
    if(pending)return pending;
    pending=(async()=>{
      const next=new Date();
      try{
        const changed=await prisma.translationJob.updateMany({where:where(),data:{lockedAt:next}});
        if(!changed.count){lost=true;throw new JobLeaseLostError();}
        lockedAt=next;
      }catch(error){lost=true;throw error;}
    })();
    try{await pending;}finally{pending=undefined;}
  };
  // Every bounded HTTP call also refreshes ownership. A long sequence of calls
  // keeps its permit; a crashed process stops renewing and is recoverable.
  const timer=setInterval(()=>{void touch().catch(()=>{});},30_000);
  timer.unref?.();
  return {where,touch,isLost:()=>lost,stop:async()=>{clearInterval(timer);try{await pending;}catch{/* Lost ownership prevents all final writes. */}}};
}
function humanApproved(row:{origin:string;reviewedAt?:Date|null;reviewedBy?:string|null}|null):boolean{
  return !!row&&(row.origin==="manual"||!!row.reviewedAt||!!row.reviewedBy);
}

export async function preparePublicBatch(input:{entityType:PublicEntity;entityIds:string[];fields:string[];targetLocale:string;sourceLocale?:string;dryRun:boolean}) {
  if(input.entityIds.length>batchLimit() || input.fields.length>10) throw new ServiceError(400,"Batch limit exceeded.");
  const target=canonicalLocale(input.targetLocale);
  const planned: Prisma.TranslationJobCreateManyInput[]=[]; let characters=0;
  const checkedSources=new Set<string>();
  for(const entityId of input.entityIds) {
    const record=await sourceRecord(prisma,input.entityType,entityId);
    if(!record || record.status!=="ACTIVE") continue;
    for(const field of input.fields) {
      assertPublicField(input.entityType,field); const value=sourceValue(record,field); if(!value) continue;
      const sourceLocale=input.sourceLocale?canonicalLocale(input.sourceLocale):sourceLanguage(value); if(sourceLocale===target) continue;
      if(sourceLocale==="und")throw new ServiceError(400,"Declare the actual source language for content outside the known English/Bengali source catalogs.");
      if(!checkedSources.has(sourceLocale)){await storedProviderPair(sourceLocale,target);checkedSources.add(sourceLocale);}
      const sourceHash=contentHash(value),contextHash=contextFor(record);
      const existing=await prisma.contentTranslation.findUnique({where:{entityType_entityId_field_targetLocale:{entityType:input.entityType,entityId,field,targetLocale:target}}});
      if(humanApproved(existing) || (existing?.sourceLocale===sourceLocale && existing.sourceHash===sourceHash && existing.contextHash===contextHash)) continue;
      const job={entityType:input.entityType,entityId,field,sourceLocale,targetLocale:target,sourceHash,contextHash};
      planned.push({...job,dedupeKey:translationCacheKey(job),characters:value.length}); characters+=value.length;
    }
  }
  if(characters>characterLimit() || planned.length>batchLimit()) throw new ServiceError(400,"Workload exceeds configured job/character limits. Use a smaller batch.");
  if(!input.dryRun) {
    await prisma.$transaction(async tx=>{
      await tx.translationJob.createMany({data:planned,skipDuplicates:true});
      for(const item of planned){
        // A revised source declaration or content revision supersedes old work,
        // including a leased worker whose result is guarded by job ownership.
        await tx.translationJob.updateMany({where:{entityType:item.entityType,entityId:item.entityId,field:item.field,targetLocale:item.targetLocale,dedupeKey:{not:item.dedupeKey},status:{in:["queued","failed","running"]}},data:{status:"stale",lockedAt:null}});
        // Returning to an earlier revision cannot be blocked forever by its
        // historical terminal dedupe row. Failed budgets still need explicit retry.
        await tx.translationJob.updateMany({where:{dedupeKey:item.dedupeKey,status:{in:["completed","stale","skipped-manual"]}},data:{status:"queued",attempts:0,lockedAt:null,lastError:null,nextAttemptAt:new Date()}});
        await tx.contentTranslation.updateMany({where:{entityType:item.entityType,entityId:item.entityId,field:item.field,targetLocale:item.targetLocale,OR:[{sourceLocale:{not:item.sourceLocale}},{sourceHash:{not:item.sourceHash}},{contextHash:{not:item.contextHash}}]},data:{status:"stale"}});
      }
    });
  }
  return {dryRun:input.dryRun,jobs:planned.length,characters,limits:{jobs:batchLimit(),characters:characterLimit()}};
}

export async function runTranslationJobs(limit=5,provider:TranslationProvider=new LibreTranslateProvider()) {
  limit=Math.min(Math.max(1,limit),batchLimit());
  const candidates=await prisma.translationJob.findMany({where:{status:{in:["queued","failed"]},attempts:{lt:3},nextAttemptAt:{lte:new Date()}},orderBy:{createdAt:"asc"},take:limit});
  const results:{id:string;status:string}[]=[];
  // Serializable predicate reads prevent two workers claiming different jobs
  // from racing past the global permit count. No DB connection is held during HTTP.
  for(const job of candidates) {
    const claimedAt=new Date();
    const claimed=await claimTranslationJob(job,claimedAt);
    if(claimed==="busy"){results.push({id:job.id,status:"busy"});break;}
    if(claimed!=="claimed") continue;
    const lease=jobLease(job,claimedAt);
    const finish=async(data:Prisma.TranslationJobUpdateManyMutationInput)=>{
      await lease.stop();
      const changed=await prisma.translationJob.updateMany({where:lease.where(),data});
      return changed.count>0;
    };
    try {
      assertPublicField(job.entityType,job.field);
      const record=await sourceRecord(prisma,job.entityType,job.entityId); const value=record&&sourceValue(record,job.field);
      if(!record || record.status!=="ACTIVE" || !value || contentHash(value)!==job.sourceHash || contextFor(record)!==job.contextHash) { const owned=await finish({status:"stale",lockedAt:null}); results.push({id:job.id,status:owned?"stale":"lease-lost"}); continue; }
      const existing=await prisma.contentTranslation.findUnique({where:{entityType_entityId_field_targetLocale:{entityType:job.entityType,entityId:job.entityId,field:job.field,targetLocale:job.targetLocale}}});
      if(humanApproved(existing)){
        const owned=await finish({status:"skipped-manual",lockedAt:null,lastError:null});
        results.push({id:job.id,status:owned?"skipped-manual":"lease-lost"});continue;
      }
      const pair=await storedProviderPair(job.sourceLocale,job.targetLocale);
      const ownedProvider:TranslationProvider={name:provider.name,supportedLanguages:()=>provider.supportedLanguages(),translate:async(...args)=>{
        await lease.touch();
        const values=await provider.translate(...args);
        if(lease.isLost())throw new JobLeaseLostError();
        return values;
      }};
      const translated=await translatePublicValue(ownedProvider,job.field,value,pair.source,pair.target,protectedTerms(record));
      await lease.stop();
      if(lease.isLost())throw new JobLeaseLostError();
      const status=await prisma.$transaction(async tx=>{
        // Lock the current lease inside the same transaction as the result.
        // An old worker cannot write after an operator has recovered its job.
        const owned=await tx.translationJob.updateMany({where:lease.where(),data:{lockedAt:lease.where().lockedAt}});
        if(!owned.count)return "lease-lost";
        const current=await sourceRecord(tx,job.entityType as PublicEntity,job.entityId); const currentValue=current&&sourceValue(current,job.field);
        if(!current || current.status!=="ACTIVE" || !currentValue || contentHash(currentValue)!==job.sourceHash || contextFor(current)!==job.contextHash) return "stale";
        const key={entityType:job.entityType,entityId:job.entityId,field:job.field,targetLocale:job.targetLocale};
        const existing=await tx.contentTranslation.findUnique({where:{entityType_entityId_field_targetLocale:key}});
        if(humanApproved(existing)) return "skipped-manual";
        if(existing){
          const changed=await tx.contentTranslation.updateMany({where:{id:existing.id,origin:{not:"manual"},reviewedAt:null,reviewedBy:null},data:{sourceLocale:job.sourceLocale,sourceHash:job.sourceHash,contextHash:job.contextHash,value:translated,origin:"machine",status:"draft",reviewedAt:null,reviewedBy:null}});
          if(!changed.count)return "skipped-manual";
        }
        else await tx.contentTranslation.create({data:{...key,sourceLocale:job.sourceLocale,sourceHash:job.sourceHash,contextHash:job.contextHash,value:translated,origin:"machine",status:"draft"}});
        return "completed";
      },{isolationLevel:"Serializable"});
      const owned=status!=="lease-lost"&&await finish({status,lockedAt:null,lastError:null}); results.push({id:job.id,status:owned?status:"lease-lost"});
    } catch(error) {
      await lease.stop();
      if(lease.isLost()||error instanceof JobLeaseLostError){results.push({id:job.id,status:"lease-lost"});continue;}
      const message=error instanceof Error?error.message:"Translation failed.";
      const owned=await finish({status:"failed",lockedAt:null,lastError:message.slice(0,500),nextAttemptAt:new Date(Date.now()+Math.pow(2,job.attempts+1)*30_000)}); results.push({id:job.id,status:owned?"failed":"lease-lost"});
    } finally {
      await lease.stop();
    }
  }
  return results;
}

async function claimTranslationJob(job:{id:string;attempts:number},claimedAt:Date):Promise<"claimed"|"busy"|"already-claimed">{
  for(let retry=0;retry<3;retry++){
    try{
      return await prisma.$transaction(async tx=>{
        const active=await tx.translationJob.count({where:{status:"running",lockedAt:{gte:new Date(Date.now()-JOB_LEASE_MS)}}});
        if(active>=concurrencyLimit())return "busy" as const;
        const claimed=await tx.translationJob.updateMany({where:{id:job.id,status:{in:["queued","failed"]},attempts:job.attempts,nextAttemptAt:{lte:new Date()}},data:{status:"running",lockedAt:claimedAt,attempts:{increment:1}}});
        return claimed.count?"claimed" as const:"already-claimed" as const;
      },{isolationLevel:"Serializable"});
    }catch(error){if(!(error&&typeof error==="object"&&"code" in error&&error.code==="P2034"))throw error;}
  }
  return "busy";
}

/** Explicit retry also recovers interrupted jobs after a conservative 10-minute lease. */
export async function retryTranslationJob(id:string) {
  return prisma.translationJob.updateMany({where:{id,OR:[{status:"failed"},{status:"running",lockedAt:{lt:new Date(Date.now()-JOB_LEASE_MS)}}]},data:{status:"queued",attempts:0,lockedAt:null,nextAttemptAt:new Date(),lastError:null}});
}

export async function savePublicTranslation(input:{entityType:PublicEntity;entityId:string;field:string;targetLocale:string;value:string;publish:boolean;reviewedBy:string;sourceLocale?:string;expectedSourceHash?:string;expectedContextHash?:string;expectedUpdatedAt?:string}) {
  assertPublicField(input.entityType,input.field); const targetLocale=canonicalLocale(input.targetLocale);
  return prisma.$transaction(async tx=>{
  const record=await sourceRecord(tx,input.entityType,input.entityId); const source=record&&sourceValue(record,input.field);
  if(!record || record.status!=="ACTIVE" || !source) throw new ServiceError(404,"Published public source content was not found.");
  if(input.expectedSourceHash&&input.expectedSourceHash!==contentHash(source)||input.expectedContextHash&&input.expectedContextHash!==contextFor(record))throw new ServiceError(409,"Source content changed; reload the current source before saving this translation.");
  if(!input.value.trim()) throw new ServiceError(400,"Translation cannot be empty.");
  // Manual rich content must preserve the structural schema and non-text attributes.
  if(input.field==="descriptionBlocks") {
    const {validateStructuredTranslation}=await import("./content"); validateStructuredTranslation(source,input.value,protectedTerms(record));
  } else {
    const {assertProtectedText}=await import("./content");
    if(/<[a-z][\s\S]*>/i.test(input.value)) throw new ServiceError(400,"Use structural description blocks for rich content.");
    assertProtectedText(source,input.value,protectedTerms(record));
  }
  const key={entityType:input.entityType,entityId:input.entityId,field:input.field,targetLocale};
  if(input.expectedUpdatedAt){
    const existing=await tx.contentTranslation.findUnique({where:{entityType_entityId_field_targetLocale:key}});
    if(!existing||existing.updatedAt.toISOString()!==input.expectedUpdatedAt)throw new ServiceError(409,"Translation changed; reload it before applying this edit.");
  }
  const data={sourceLocale:input.sourceLocale?canonicalLocale(input.sourceLocale):sourceLanguage(source),sourceHash:contentHash(source),contextHash:contextFor(record),value:input.value,origin:"manual",status:input.publish?"published":"reviewed",reviewedBy:input.reviewedBy,reviewedAt:new Date()};
  return tx.contentTranslation.upsert({where:{entityType_entityId_field_targetLocale:key},create:{...key,...data},update:data});
  },{isolationLevel:"Serializable"});
}

export async function setPublicTranslationStatus(id:string,published:boolean,reviewedBy:string,expectedUpdatedAt?:string) {
  return prisma.$transaction(async tx=>{
  const row=await tx.contentTranslation.findUnique({where:{id}});
  if(!row) throw new ServiceError(404,"Translation not found.");
  if(expectedUpdatedAt&&row.updatedAt.toISOString()!==expectedUpdatedAt)throw new ServiceError(409,"Translation changed; reload it before approving this wording.");
  assertPublicField(row.entityType,row.field);
  const record=await sourceRecord(tx,row.entityType,row.entityId); const value=record&&sourceValue(record,row.field);
  if(published && (!record || record.status!=="ACTIVE" || !value || contentHash(value)!==row.sourceHash || contextFor(record)!==row.contextHash)) {
    throw new ServiceError(409,"Source content changed; review a new translation before publication.");
  }
  if(published&&value){
    const {assertProtectedText,validateStructuredTranslation}=await import("./content");
    if(row.field==="descriptionBlocks")validateStructuredTranslation(value,row.value,protectedTerms(record!));
    else assertProtectedText(value,row.value,protectedTerms(record!));
  }
  return tx.contentTranslation.update({where:{id,updatedAt:row.updatedAt},data:{status:published?"published":"reviewed",reviewedBy,reviewedAt:new Date()}});
  },{isolationLevel:"Serializable"});
}

export async function resolvePublicContent<T extends Record<string,unknown>>(entityType:PublicEntity,entityId:string,fields:T,locale:string):Promise<{fields:T;available:boolean;sourceLocale:string;translatedFields:string[]}> {
  const keys=Object.keys(fields).filter(key=>(PUBLIC_FIELDS[entityType] as readonly string[]).includes(key));
  const sourceLocale=sourceLanguage(keys.map(key=>typeof fields[key]==="string"?fields[key]:JSON.stringify(fields[key])).join(" "));
  if(!keys.length || keys.every(key=>fields[key]===null || fields[key]===undefined || fields[key]==="" || sourceLanguage(typeof fields[key]==="string"?fields[key] as string:JSON.stringify(fields[key]))===locale)) return {fields,available:true,sourceLocale,translatedFields:[]};
  try {
    const compatible=await compatiblePublishedFallback(locale);
    const [rows,current]=await Promise.all([prisma.contentTranslation.findMany({where:{entityType,entityId,targetLocale:{in:[locale,...(compatible?[compatible]:[])]},status:"published"}}),sourceRecord(prisma,entityType,entityId)]);
    const output={...fields}; const translatedFields:string[]=[];
    for(const field of keys) {
      const original=fields[field]; if(original===null || original===undefined || original==="") continue;
      const value=field==="descriptionBlocks"?JSON.stringify(original):String(original);
      if(sourceLanguage(value)===locale) {translatedFields.push(field);continue;}
      const row=rows.find(row=>row.field===field && row.targetLocale===locale && row.sourceHash===contentHash(value) && current && row.contextHash===contextFor(current)) ?? rows.find(row=>row.field===field && row.targetLocale===compatible && row.sourceHash===contentHash(value) && current && row.contextHash===contextFor(current));
      if(row) { (output as Record<string,unknown>)[field]=field==="descriptionBlocks"?JSON.parse(row.value):row.value;translatedFields.push(field); }
    }
    const required=keys.filter(field=>fields[field]!==null && fields[field]!==undefined && fields[field]!=="");
    return {fields:output,available:required.every(field=>translatedFields.includes(field)),sourceLocale,translatedFields};
  } catch { return {fields,available:false,sourceLocale,translatedFields:[]}; }
}

/** Batch query plus current-revision checks for sitemap/hreflang readiness. */
export async function getPublishedEntityLocales(entityType:PublicEntity,entityIds:string[],requiredFields:string[]):Promise<Map<string,string[]>> {
  const result=new Map<string,string[]>();
  if(!entityIds.length) return result;
  requiredFields.forEach(field=>assertPublicField(entityType,field));
  {
    const [rows,records]=await Promise.all([prisma.contentTranslation.findMany({where:{entityType,entityId:{in:entityIds},field:{in:requiredFields},status:"published"}}).catch(()=>[]),sourceRecords(prisma,entityType,entityIds)]);
    const recordsById=new Map(records.map(record=>[record.id,record]));
    const translationsById=new Map<string,Map<string,Map<string,(typeof rows)[number]>>>();
    for(const row of rows){let languages=translationsById.get(row.entityId);if(!languages){languages=new Map();translationsById.set(row.entityId,languages);}let fields=languages.get(row.targetLocale);if(!fields){fields=new Map();languages.set(row.targetLocale,fields);}fields.set(row.field,row);}
    for(const entityId of entityIds) {
      const record=recordsById.get(entityId); if(!record || record.status!=="ACTIVE") continue;
      const required=requiredFields.filter(field=>!!sourceValue(record,field));
      if(!required.length){result.set(entityId,["en"]);continue;}
      const translations=translationsById.get(entityId);
      const values=Object.fromEntries(required.map(field=>[field,{locale:sourceLanguage(sourceValue(record,field)!),hash:contentHash(sourceValue(record,field))}]));
      const contextHash=contextFor(record);
      const locales=[...new Set([...required.map(field=>values[field].locale),...(translations?.keys()??[])])].filter(locale=>locale!=="und");
      result.set(entityId,locales.filter(locale=>required.every(field=>{const row=translations?.get(locale)?.get(field);return values[field].locale===locale || !!row&&row.sourceHash===values[field].hash&&row.contextHash===contextHash;})));
    }
  }
  return result;
}

export type LocalizedPublic<T> = T & {translationAvailable:boolean;contentAvailable:boolean;sourceLocale:string;contentLocale:string;fieldLocales:Record<string,string>};

/** Publication must be current and explicit; writing systems never cross via fallback. */
async function compatiblePublishedFallback(locale:string):Promise<string|undefined>{
  const languages=await getPublishedLanguageOverrides();const requested=languages?.find(row=>row.code===locale);
  const fallback=requested?.fallbackLocale;if(!fallback||fallback===locale)return undefined;
  const canonical=canonicalLocale(fallback);
  const fallbackLanguage=new Intl.Locale(canonical),requestedLanguage=new Intl.Locale(locale);
  if(fallbackLanguage.language!==requestedLanguage.language||fallbackLanguage.maximize().script!==requestedLanguage.maximize().script)return undefined;
  const bundled=getPublishedLocales().some(row=>row.code===canonical);
  const row=languages?.find(row=>row.code===canonical);
  if(bundled&&(!row||!row.publicationOverride))return canonical;
  if(!row?.published||!row.prepared||!row.catalogReviewedAt||!row.hasInterfaceCatalog)return undefined;
  const {loadBundledMessages}=await import("@/lib/i18n/catalogs");
  return row.interfaceSourceHash===contentHash(await loadBundledMessages("en"))?canonical:undefined;
}
/** Stored translations only; source and translation lookups are batched per collection. */
export async function localizePublicCollection<T extends {id:string}>(entityType:PublicEntity,items:T[],locale:string):Promise<LocalizedPublic<T>[]> {
  if(!items.length)return [];
  const snapshots=items.map(item=>({item,keys:(PUBLIC_FIELDS[entityType] as readonly string[]).filter(field=>sourceValue(item as Record<string,unknown>,field)!==null)}));
  const metadata=(item:T,available:boolean)=>({translationAvailable:available,contentAvailable:available,sourceLocale:sourceLanguage((PUBLIC_FIELDS[entityType] as readonly string[]).map(field=>sourceValue(item as Record<string,unknown>,field)??"").join(" ")),contentLocale:available?locale:sourceLanguage((PUBLIC_FIELDS[entityType] as readonly string[]).map(field=>sourceValue(item as Record<string,unknown>,field)??"").join(" ")),fieldLocales:Object.fromEntries((PUBLIC_FIELDS[entityType] as readonly string[]).filter(field=>sourceValue(item as Record<string,unknown>,field)!==null).map(field=>[field,sourceLanguage(sourceValue(item as Record<string,unknown>,field)!)]))});
  if(snapshots.every(({item,keys})=>keys.every(field=>sourceLanguage(sourceValue(item as Record<string,unknown>,field)!)===locale)))return items.map(item=>({...item,...metadata(item,true)}));
  try {
    const fallback=await compatiblePublishedFallback(locale);
    const [records,rows]=await Promise.all([sourceRecords(prisma,entityType,items.map(item=>item.id)),prisma.contentTranslation.findMany({where:{entityType,entityId:{in:items.map(item=>item.id)},targetLocale:{in:[locale,...(fallback?[fallback]:[])]},status:"published"}})]);
    return snapshots.map(({item,keys})=>{
      const source=records.find(record=>record.id===item.id);const output={...item} as T;let available=true,contentAvailable=true;const fieldLocales=metadata(item,true).fieldLocales;
      for(const field of keys){
        const value=sourceValue(item as Record<string,unknown>,field)!;if(sourceLanguage(value)===locale)continue;
        const matching=rows.filter(row=>row.entityId===item.id && row.field===field && row.sourceHash===contentHash(value) && source && row.contextHash===contextFor(source));
        const row=matching.find(row=>row.targetLocale===locale)??matching.find(row=>row.targetLocale===fallback);
        if(!row){available=false;if(sourceLanguage(value)!==fallback)contentAvailable=false;continue;}
        if(row.targetLocale!==locale)available=false;
        fieldLocales[field]=row.targetLocale;
        const path=field.split(".");
        if(path.length===1)(output as Record<string,unknown>)[field]=field==="descriptionBlocks"?JSON.parse(row.value):row.value;
        else {const first=path.shift()!;(output as Record<string,unknown>)[first]={...((output as Record<string,unknown>)[first] as object)};const parent=path.slice(0,-1).reduce<Record<string,unknown>>((node,key)=>node[key] as Record<string,unknown>,(output as Record<string,unknown>)[first] as Record<string,unknown>);parent[path[path.length-1]]=row.value;}
      }
      const writtenLocales=[...new Set(Object.values(fieldLocales))];
      return {...output,...metadata(item,available),contentAvailable,contentLocale:writtenLocales.length===1?writtenLocales[0]:contentAvailable?locale:metadata(item,false).sourceLocale,fieldLocales};
    });
  }catch{return items.map(item=>({...item,...metadata(item,false)}));}
}

export async function translationDashboard() {
  const [languages,jobs,translations]=await Promise.all([prisma.localeLanguage.findMany({orderBy:{englishName:"asc"}}),prisma.translationJob.findMany({orderBy:{createdAt:"desc"},take:50}),prisma.contentTranslation.findMany({orderBy:{updatedAt:"desc"},take:100})]);
  const entities=new Map<PublicEntity,string[]>();
  for(const row of translations){
    if(!(row.entityType in PUBLIC_FIELDS))continue;
    const type=row.entityType as PublicEntity;
    entities.set(type,[...(entities.get(type)??[]),row.entityId]);
  }
  const sources=new Map<string,Record<string,unknown>>();
  await Promise.all([...entities].map(async([type,ids])=>{
    for(const record of await sourceRecords(prisma,type,[...new Set(ids)]).catch(()=>[]))sources.set(`${type}:${record.id}`,record);
  }));
  const reviewTranslations=translations.map(row=>{
    const source=sources.get(`${row.entityType}:${row.entityId}`);
    const approved=row.entityType in PUBLIC_FIELDS&&(PUBLIC_FIELDS[row.entityType as PublicEntity] as readonly string[]).includes(row.field);
    const value=source?.status==="ACTIVE"&&approved?sourceValue(source,row.field):null;
    return {...row,currentSourceValue:value,currentSourceHash:value?contentHash(value):null,currentContextHash:source&&value?contextFor(source):null};
  });
  const merged=new Map<string,{code:string;englishName:string;nativeName:string;available:boolean;prepared:boolean;published:boolean;interfaceCatalog:unknown;interfaceSourceHash?:string|null;catalogReviewedAt:Date|null}>(getRegisteredLocales().map(row=>[row.code,{...row,available:false,providerTargets:[],interfaceCatalog:null,catalogReviewedAt:null}]));
  for(const row of languages){const bundled=merged.get(row.code);merged.set(row.code,bundled&&!row.publicationOverride?{...row,prepared:bundled.prepared,published:bundled.published}:row);}
  const english=merged.get("en");if(english)merged.set("en",{...english,prepared:true,published:true});
  // The provider has a safe loopback default; configuration is distinct from
  // connectivity, which is checked only during explicit capability refresh.
  let providerConfigured=true;
  try { const url=new URL(process.env.LIBRETRANSLATE_URL??LIBRETRANSLATE_DEFAULT_URL); providerConfigured=["http:","https:"].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash; } catch { providerConfigured=false; }
  const capabilities=new Map(languages.filter(row=>row.providerFetchedAt&&row.providerCode).map(row=>[row.providerCode,row]));
  const languageRows=[...merged.values()].map(row=>{
    const model=capabilities.get(providerLanguageCode(row.code));
    return {...row,providerCode:model?.providerCode??null,providerTargets:Array.isArray(model?.providerTargets)?model.providerTargets as string[]:[],available:model?.available??false};
  });
  return {languages:languageRows.sort((a,b)=>a.englishName.localeCompare(b.englishName)),jobs,translations:reviewTranslations,providerConfigured,limits:{jobs:batchLimit(),characters:characterLimit(),concurrency:concurrencyLimit()}};
}

/** Source hooks invalidate stored text and queue a bounded existing machine workload. */
export async function markPublicTranslationsStale(entityType:PublicEntity,entityIds:readonly string[]):Promise<number>{
  const ids=[...new Set(entityIds.filter(Boolean))];if(!ids.length)return 0;
  try{
    const [records,translations]=await Promise.all([sourceRecords(prisma,entityType,ids),prisma.contentTranslation.findMany({where:{entityType,entityId:{in:ids}}})]);
    const byId=new Map(records.map(record=>[record.id,record]));
    const stale=translations.filter(row=>{const source=byId.get(row.entityId);const value=source&&sourceValue(source,row.field);return !source||source.status!=="ACTIVE"||!value||row.sourceHash!==contentHash(value)||row.contextHash!==contextFor(source);});
    if(!stale.length)return 0;
    const result=await prisma.contentTranslation.updateMany({where:{id:{in:stale.map(row=>row.id)}},data:{status:"stale"}});
    for(const row of stale.filter(row=>row.origin==="machine"&&!humanApproved(row)).slice(0,batchLimit())){
      const record=byId.get(row.entityId);const source=record&&sourceValue(record,row.field);
      if(!record||record.status!=="ACTIVE"||!source)continue;
      const detected=sourceLanguage(source);
      try{await preparePublicBatch({entityType,entityIds:[row.entityId],fields:[row.field],targetLocale:row.targetLocale,sourceLocale:detected==="und"?row.sourceLocale:detected,dryRun:false});}
      catch{/* Unsupported pairs and bounded workloads remain stale for manual management. */}
    }
    return result.count;
  }catch{return 0;} // Missing additive migration must not undo a successful canonical content mutation.
}
