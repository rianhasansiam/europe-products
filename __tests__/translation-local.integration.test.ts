import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Explicit opt-in only. A loopback endpoint alone is insufficient: this project
// also uses a production SSH tunnel, so that known port is always prohibited.
const enabled = process.env.RUN_LOCAL_TRANSLATION_INTEGRATION === "1";
// The native local service installs the models needed by the published en/bn
// catalogs. French remains an optional explicit target for reviewed experiments.
const targetLocale = process.env.LOCAL_TRANSLATION_TARGET ?? "bn";
const manualWaterPumps = targetLocale === "bn" ? "পানির পাম্প" : "Pompes à eau";
describe.skipIf(!enabled)("local PostgreSQL and real LibreTranslate integration", () => {
  let prisma: typeof import("@/lib/db/prisma").prisma;
  let service: typeof import("@/lib/translations/service");
  let provider: import("@/lib/translations/provider").LibreTranslateProvider;
  const entityId = `translation-test-${randomUUID()}`;
  const productId = `translation-product-${randomUUID()}`;
  const input = { entityType: "category" as const, entityIds: [entityId], fields: ["name"], sourceLocale: "en", targetLocale, dryRun: false };

  beforeAll(async () => {
    if (!["bn", "fr"].includes(targetLocale)) throw new Error("Local integration fixtures support only Bengali or French; select an installed model explicitly.");
    for (const key of ["DATABASE_URL", "DIRECT_URL"] as const) {
      const value = process.env[key];
      if (!value) throw new Error(`${key} must explicitly identify an isolated local test database.`);
      const url = new URL(value);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.port === "15432" || !url.pathname.includes("translation_local")) {
        throw new Error("Integration tests require a dedicated local translation_local database, never the production tunnel.");
      }
    }
    const translator = new URL(process.env.LIBRETRANSLATE_URL ?? "http://127.0.0.1:5001");
    if (!["localhost", "127.0.0.1", "[::1]"].includes(translator.hostname)) throw new Error("Integration tests require a loopback LibreTranslate service.");
    ({ prisma } = await import("@/lib/db/prisma"));
    service = await import("@/lib/translations/service");
    const { LibreTranslateProvider } = await import("@/lib/translations/provider");
    provider = new LibreTranslateProvider({ url: translator.origin });
    await provider.health();
    await service.refreshProviderLanguages(provider);
    await prisma.category.create({ data: { id: entityId, name: "Industrial pumps", slug: entityId, path: entityId } });
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.translationJob.deleteMany({ where: { entityId: { in: [entityId, productId] } } });
    await prisma.contentTranslation.deleteMany({ where: { entityId: { in: [entityId, productId] } } });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.category.deleteMany({ where: { id: entityId } });
    await prisma.$disconnect();
  });

  it("discovers directed pairs, deduplicates jobs, persists reviewed content and preserves manual overrides", async () => {
    const languages = await provider.supportedLanguages();
    expect(languages.find(row => row.code === "en")?.targets).toContain(targetLocale);
    expect(await service.preparePublicBatch(input)).toMatchObject({ jobs: 1 });
    await service.preparePublicBatch(input);
    expect(await prisma.translationJob.count({ where: { entityId } })).toBe(1);
    expect(await service.runTranslationJobs(5, provider)).toContainEqual(expect.objectContaining({ status: "completed" }));
    const row = await prisma.contentTranslation.findFirstOrThrow({ where: { entityId } });
    expect(row.value.toLowerCase()).not.toBe("industrial pumps");
    expect(row).toMatchObject({ origin: "machine", status: "draft", sourceLocale: "en", targetLocale });
    await service.setPublicTranslationStatus(row.id, true, "local-integration-reviewer");
    const localized = await service.resolvePublicContent("category", entityId, { name: "Industrial pumps" }, targetLocale);
    expect(localized).toMatchObject({ available: true, fields: { name: row.value } });

    await prisma.category.update({ where: { id: entityId }, data: { name: "Water pumps" } });
    const stale = await service.resolvePublicContent("category", entityId, { name: "Water pumps" }, targetLocale);
    expect(stale).toMatchObject({ available: false, fields: { name: "Water pumps" } });
    await expect(service.setPublicTranslationStatus(row.id, true, "local-integration-reviewer")).rejects.toThrow("Source content changed");
    await service.savePublicTranslation({ entityType: "category", entityId, field: "name", sourceLocale: "en", targetLocale, value: manualWaterPumps, publish: true, reviewedBy: "local-integration-reviewer" });
    expect(await service.preparePublicBatch(input)).toMatchObject({ jobs: 0 });
    expect(await prisma.contentTranslation.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ value: manualWaterPumps, origin: "manual", status: "published" });
    await expect(service.preparePublicBatch({ ...input, targetLocale: "ga" })).rejects.toThrow();
  }, 120_000);

  it("persists all public product text and structured descriptions without changing identifiers, links or prices",async()=>{
    const blocks=[{id:"block-1",type:"imageText",isVisible:true,heading:"Industrial pump",description:"Durable SexToy AB-123 pump rated at 220 V",imageUrl:"/images/test-pump.webp",imageAlt:"Pump photo",imagePosition:"left",ctaLabel:"View product",ctaUrl:"https://example.test/AB-123"},{id:"block-2",type:"specificationTable",isVisible:true,rows:[{id:"voltage",label:"Voltage",value:"220 V"}]}];
    await prisma.product.create({data:{id:productId,categoryId:entityId,productCode:productId,modelNumber:"AB-123",name:"SexToy AB-123 pump",slug:productId,description:"Durable pump rated at 220 V",seoTitle:"SexToy AB-123 industrial pump",metaDescription:"Shop industrial pumps with reliable 220 V performance",descriptionBlocks:blocks,buyingPrice:"1000",salePrice:"2010"}});
    const batch={entityType:"product" as const,entityIds:[productId],fields:["name","description","descriptionBlocks","seoTitle","metaDescription"],sourceLocale:"en",targetLocale,dryRun:false};
    expect(await service.preparePublicBatch(batch)).toMatchObject({jobs:5});
    const jobs=await service.runTranslationJobs(10,provider);
    expect(jobs.filter(row=>row.status==="completed")).toHaveLength(5);
    const translations=await prisma.contentTranslation.findMany({where:{entityId:productId}});
    for(const row of translations)await service.setPublicTranslationStatus(row.id,true,"local-fixture-reviewer");
    const original=await prisma.product.findUniqueOrThrow({where:{id:productId}});
    const [localized]=await service.localizePublicCollection("product",[original],targetLocale);
    expect(localized.translationAvailable).toBe(true);
    expect(localized.name).toContain("SexToy AB-123");
    expect(localized.name).not.toBe(original.name);
    expect(localized.salePrice.toString()).toBe("2010");
    expect(localized.productCode).toBe(productId);
    const translated=localized.descriptionBlocks as unknown as typeof blocks;
    expect(translated[0].ctaUrl).toBe(blocks[0].ctaUrl);
    expect(translated[0].imageUrl).toBe(blocks[0].imageUrl);
    expect(translated[0].description).toContain("220 V");
    expect(translated[1].rows![0].value).toBe("220 V");
    expect((await prisma.product.findUniqueOrThrow({where:{id:productId}})).descriptionBlocks).toEqual(original.descriptionBlocks);
  },120_000);

  it("keeps stored content readable during a translation service outage", async () => {
    const { LibreTranslateProvider } = await import("@/lib/translations/provider");
    const unavailable = new LibreTranslateProvider({ url: "http://127.0.0.1:59998" });
    await expect(unavailable.translate(["Hello"], "en", targetLocale)).rejects.toThrow();
    const localized = await service.resolvePublicContent("category", entityId, { name: "Water pumps" }, targetLocale);
    expect(localized).toMatchObject({ available: true, fields: { name: manualWaterPumps } });
  });
});
