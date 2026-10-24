import { describe, expect, it, vi } from "vitest";
import { assertTranslatedCatalog, canonicalLocale, canReplaceTranslation, contentHash, localeDirection, providerLanguageCode, translationCacheKey, validateCatalog, validateMessage } from "@/lib/translations/validation";
import { assertPublicField, protectText, translatePublicValue, validateStructuredTranslation } from "@/lib/translations/content";
import { generateCatalog } from "@/lib/translations/catalog-generation";
import { LibreTranslateProvider, ProviderSetupError, type TranslationProvider } from "@/lib/translations/provider";

function provider(fn:(value:string)=>string):TranslationProvider{return {name:"deterministic-mock",supportedLanguages:async()=>[{code:"en",name:"English",supportsSource:true,supportsTarget:true,targets:["bn"]},{code:"bn",name:"Bengali",supportsSource:true,supportsTarget:true,targets:["en"]}],translate:vi.fn(async values=>values.map(fn))};}
describe("translation validation and safety",()=>{
  it("canonicalizes provider aliases without crossing Chinese writing systems",()=>{expect(canonicalLocale("zh-TW")).toBe("zh-Hant");expect(canonicalLocale("zh-CN")).toBe("zh-Hans");expect(providerLanguageCode("zh-Hant")).toBe("zh-Hant");expect(localeDirection("ar")).toBe("rtl");expect(localeDirection("az-Latn")).toBe("ltr");expect(localeDirection("az-Arab")).toBe("rtl");});
  it("rejects malformed or incomplete catalogs and preserves ICU plural variables",()=>{const source={Cart:{items:"{count, plural, one {# item} other {# items}}",hello:"Hello {name}"}};expect(()=>validateCatalog(source,{Cart:{items:"{count, plural, one {#টি পণ্য} other {#টি পণ্য}}",hello:"হ্যালো {name}"}})).not.toThrow();expect(()=>validateCatalog(source,{Cart:{items:"items"}})).toThrow();expect(()=>validateMessage("Hello {name}","হ্যালো {email}")).toThrow("ICU");expect(()=>validateMessage("{count, plural, other {items}}","{count, plural, one {item}}")).toThrow();});
  it("preserves displayed counts and variables inside every shared ICU branch",()=>{
    const source="{count, plural, one {# item for {name}} other {# items for {name}}}";
    expect(()=>validateMessage(source,"{count, plural, one {#টি পণ্য {name}} other {পণ্য {name}}}")).toThrow("ICU");
    expect(()=>validateMessage(source,"{count, plural, one {#টি পণ্য {name}} other {#টি পণ্য}}")).toThrow("ICU");
    expect(()=>validateMessage("{role, select, admin {Hello {name}} other {Hello {name}}}","{role, select, admin {হ্যালো {name}} other {হ্যালো}}")).toThrow("ICU");
    expect(()=>validateMessage("{count, plural, other {# items: #}}","{count, plural, other {#টি পণ্য}}")).toThrow("ICU");
    expect(()=>validateMessage("{count, plural, other {# items}}","{count, plural, other {'#'টি পণ্য}}")).toThrow("ICU");
  });
  it("permits locale-specific plural categories and omission of unused English categories",()=>{
    const source="{count, plural, one {# item for {name}} other {# items for {name}}}";
    expect(()=>validateMessage(source,"{count, plural, other {{name} 的 # 件商品}}")).not.toThrow();
    expect(()=>validateMessage(source,"{count, plural, one {# article pour {name}} many {# articles pour {name}} other {# articles pour {name}}}")).not.toThrow();
    expect(()=>validateMessage(source,"{count, plural, few {#件商品} other {#件商品 {name}}}")).toThrow("ICU");
    expect(()=>validateMessage("{count, plural, one {Item for {name}} other {# items}}","{count, plural, other {#件商品}}")).toThrow("ICU");
  });
  it("preserves select values, explicit numeric branches, plural offsets and ordinal rules",()=>{
    expect(()=>validateMessage("{role, select, admin {Admin} other {Guest}}","{role, select, staff {কর্মী} other {অতিথি}}")).toThrow("ICU");
    expect(()=>validateMessage("{count, plural, =0 {None} other {# items}}","{count, plural, other {#টি পণ্য}}")).toThrow("ICU");
    expect(()=>validateMessage("{count, plural, other {# items}}","{count, plural, =0 {কোনও পণ্য নেই} other {#টি পণ্য}}")).toThrow("ICU");
    expect(()=>validateMessage("{count, plural, offset:1 other {# items}}","{count, plural, other {#টি পণ্য}}")).toThrow("ICU");
    expect(()=>validateMessage("{count, selectordinal, other {#th}}","{count, plural, other {#টি}}")).toThrow("ICU");
  });
  it("preserves rich-text containment, variable occurrence counts and number formats while allowing word order changes",()=>{
    expect(()=>validateMessage("<link>Hello {name}</link>","{name} <link>হ্যালো</link>")).toThrow("ICU");
    expect(()=>validateMessage("Hello {name}, goodbye {name}","হ্যালো {name}")).toThrow("ICU");
    expect(()=>validateMessage("{total, number, ::currency/USD}","{total, number, ::currency/EUR}")).toThrow("ICU");
    expect(()=>validateMessage("{total, number, ::currency/USD precision-integer}","{total, number, ::precision-integer currency/USD}")).not.toThrow();
    expect(()=>validateMessage("{day, date, short}","{day, date, long}")).toThrow("ICU");
    expect(()=>validateMessage("Hello {name}, from {city}","{city} থেকে {name} কে হ্যালো")).not.toThrow();
    const first="{count, plural, other {{name} has # items}}",second="{count, plural, other {# items in {city}}}";
    expect(()=>validateMessage(`${first} ${second}`,`${second} ${first}`)).not.toThrow();
  });
  it("protects literal business data, links, contact addresses and brands in imported catalog branches",()=>{
    const source={Voltage:"SexToy AB-123 220 V at https://example.com/p or help@example.com",Count:"{count, plural, one {220 V for {name}} other {220 V for {name}}}"};
    expect(()=>validateCatalog(source,{Voltage:"SexToy AB-123 ২২০ ভোল্ট https://example.com/p অথবা help@example.com",Count:"{count, plural, one {{name} এর জন্য ২২০ ভোল্ট} other {{name} এর জন্য ২২০ ভোল্ট}}"})).not.toThrow();
    for(const translated of ["OtherBrand AB-123 220 V at https://example.com/p or help@example.com","SexToy AB-123 110 V at https://example.com/p or help@example.com","SexToy AB-123 220 V at https://other.example/p or help@example.com","SexToy AB-123 220 V at https://example.com/p or other@example.com","SexToy XY-999 220 V at https://example.com/p or help@example.com"])expect(()=>validateMessage(source.Voltage,translated)).toThrow("protected");
    expect(()=>validateMessage(source.Count,"{count, plural, one {220 V for {name}} other {110 V for {name}}}")).toThrow("protected");
    expect(()=>validateMessage("Use a full http:// or https:// address.","Utilisez une adresse complète http:// ou https://.")).not.toThrow();
  });
  it("honors configured protected interface terms",()=>{
    const previous=process.env.TRANSLATION_PROTECTED_TERMS;
    process.env.TRANSLATION_PROTECTED_TERMS="SpecialBrand|3M|220V|123";
    try{expect(()=>validateMessage("Buy SpecialBrand","কিনুন OtherBrand")).toThrow("protected");expect(()=>validateMessage("Buy SpecialBrand","কিনুন SpecialBrand")).not.toThrow();expect(()=>validateMessage("Buy 3M","কিনুন 3N")).toThrow("protected");expect(()=>validateMessage("Use 220V","ব্যবহার করুন 220W")).toThrow("protected");expect(()=>validateMessage("Model 123","মডেল ১২৩")).toThrow("protected");}
    finally{if(previous===undefined)delete process.env.TRANSLATION_PROTECTED_TERMS;else process.env.TRANSLATION_PROTECTED_TERMS=previous;}
  });
  it("changes cache keys when source/context/locale change and protects manual overrides",()=>{const job={entityType:"product",entityId:"p1",field:"name",sourceLocale:"en",targetLocale:"bn",sourceHash:contentHash("Pump"),contextHash:"glossary-1"};expect(translationCacheKey(job)).not.toBe(translationCacheKey({...job,contextHash:"glossary-2"}));expect(canReplaceTranslation({origin:"manual",sourceHash:"old"},"new","new")).toBe(false);expect(canReplaceTranslation(null,"new","old")).toBe(false);expect(canReplaceTranslation(null,"new","new")).toBe(true);});
  it("allows only approved public fields and excludes personal, financial and identifier fields",()=>{for(const field of ["password","customerName","customerAddress","buyingPrice","salePrice","productCode","slug"])expect(()=>assertPublicField("product",field)).toThrow();expect(()=>assertPublicField("order","customerNote")).toThrow();expect(()=>assertPublicField("product","description")).not.toThrow();});
  it("restores protected brands identifiers URLs and variables exactly",()=>{const source="SexToy AB-123 220 V https://example.com/p {name}";const masked=protectText(source,["SexToy"]);expect(masked.text).not.toContain("SexToy");expect(masked.restore(masked.text)).toBe(source);expect(()=>masked.restore("translated")).toThrow("protected");});
  it("keeps protected terms out of engine requests and preserves surrounding whitespace",async()=>{
    const mock=provider(text=>text.replace("Buy","Acheter").replace("at","chez"));
    expect(await translatePublicValue(mock,"name","Buy SexToy AB-123 at 220 V https://example.com {name}","en","fr",["SexToy"])).toBe("Acheter SexToy AB-123 chez 220 V https://example.com {name}");
    const sent=(mock.translate as ReturnType<typeof vi.fn>).mock.calls.flat(2).join(" ");
    expect(sent).not.toMatch(/SexToy|AB-123|220|https:|ZXQPROTECTED|\{name\}/);
  });
  it("splits long public prose at whitespace without changing the stored source",async()=>{
    const source="durable ".repeat(1500);const mock=provider(text=>text.replaceAll("durable","solide"));
    const translated=await translatePublicValue(mock,"description",source,"en","fr",[]);
    expect(translated).toBe("solide ".repeat(1500));
    for(const [texts] of (mock.translate as ReturnType<typeof vi.fn>).mock.calls)expect(texts.reduce((total:number,text:string)=>total+[...text].length,0)).toBeLessThanOrEqual(5000);
  });
  it("translates structured text without changing links or technical specification values",async()=>{const blocks=[{id:"b1",type:"imageText",isVisible:true,heading:"Pump",description:"Durable",imageUrl:"/images/pump.webp",imageAlt:"Pump photo",imagePosition:"left",ctaLabel:"View",ctaUrl:"https://example.com/AB-123"},{id:"b2",type:"specificationTable",isVisible:true,rows:[{id:"row1",label:"Voltage",value:"220 V"}]}];const mock=provider(text=>`অনুবাদ ${text}`);const result=JSON.parse(await translatePublicValue(mock,"descriptionBlocks",JSON.stringify(blocks),"en","bn",[]));expect(result[0].heading).toBe("অনুবাদ Pump");expect(result[0].ctaUrl).toBe(blocks[0].ctaUrl);expect(result[1].rows[0].value).toBe("220 V");expect(()=>validateStructuredTranslation(JSON.stringify(blocks),JSON.stringify(result))).not.toThrow();result[0].imageUrl="javascript:alert(1)";expect(()=>validateStructuredTranslation(JSON.stringify(blocks),JSON.stringify(result))).toThrow();});
  it("leaves ICU skeleton untouched while translating only literal leaves",async()=>{const source={Messages:{items:"{count, plural, one {One item for {name}} other {Many items for {name}}}",tag:"<strong>Hello {name}</strong>"}};const mock=provider(text=>`অনুবাদ ${text}`);const result=await generateCatalog(mock,source,"bn",{dryRun:false,maxCharacters:1000});expect(()=>validateCatalog(source,result.catalog!)).not.toThrow();expect((mock.translate as ReturnType<typeof vi.fn>).mock.calls.flat(2).join(" ")).not.toContain("{count");});
  it("dry-run never calls the provider and execution enforces an approved character limit",async()=>{const mock=provider(text=>text);expect((await generateCatalog(mock,{Hello:"Hello world"},"bn",{dryRun:true,maxCharacters:1})).characters).toBe(11);expect(mock.translate).not.toHaveBeenCalled();await expect(generateCatalog(mock,{Hello:"Hello world"},"bn",{dryRun:false,maxCharacters:1})).rejects.toThrow("explicit maximum");expect(mock.translate).not.toHaveBeenCalled();});
  it("requires a verified directed pair before generating an interface catalog",async()=>{
    const mock={...provider(text=>text),supportedLanguages:async()=>[{code:"en",name:"English",supportsSource:true,supportsTarget:true,targets:["fr"]},{code:"bn",name:"Bengali",supportsSource:true,supportsTarget:true,targets:["en"]}]};
    await expect(generateCatalog(mock,{Hello:"Hello world"},"bn",{dryRun:false,maxCharacters:1000})).rejects.toThrow("do not support en → bn");expect(mock.translate).not.toHaveBeenCalled();
  });
  it("rejects incomplete provider batches instead of filling catalog fragments with English",async()=>{
    const mock={...provider(text=>text),translate:vi.fn(async()=>[])};
    await expect(generateCatalog(mock,{Hello:"Hello world"},"bn",{dryRun:false,maxCharacters:1000})).rejects.toThrow("incomplete catalog translations");
  });
  it("invalid local provider configuration fails before a translation request",async()=>{await expect(new LibreTranslateProvider({url:""}).translate(["Hello"],"en","bn")).rejects.toBeInstanceOf(ProviderSetupError);});
  it.each(["ar","fr"])("rejects an unchanged English catalog labelled as %s even with punctuation and ICU spacing changes",locale=>{
    const source={Hello:"Hello, {name}!",Quote:"Don't panic, {name}!",Count:"{count, plural, one {One item} other {Many items}}",Brand:"SexToy"};
    const translated={Hello:"  HELLO {name}.  ",Quote:"Dont panic {name}",Count:"{count, plural, other {Many items!!!} one {ONE ITEM???}}",Brand:"SexToy"};
    expect(()=>validateCatalog(source,translated)).not.toThrow();expect(()=>assertTranslatedCatalog(source,translated,locale)).toThrow("unchanged English");
  });
  it("allows protected equal brands within a genuinely translated catalog and unchanged regional English",()=>{
    const source={Hello:"Hello {name}",Brand:"SexToy"};const translated={Hello:"হ্যালো {name}",Brand:"SexToy"};
    expect(assertTranslatedCatalog(source,translated,"bn")).toEqual({changedMessages:1,unchangedMessages:[]});expect(assertTranslatedCatalog(source,source,"en-GB")).toEqual({changedMessages:0,unchangedMessages:[]});
  });
  it("reports meaningful unchanged messages even when one interface label is translated",()=>{
    const source={Labels:{welcome:"Welcome {name}",checkout:"Checkout",contact:"Contact us",properName:"Rian Hasan Siam"},Brand:"SexToy",Link:"https://example.com",Email:"help@example.com",Number:"220 V",Model:"AB-123",Variable:"{name}",RichVariable:"<strong>{name}</strong>",PluralVariable:"{count, plural, one {#} other {#}}"};
    const translated={...source,Labels:{...source.Labels,welcome:"Bienvenue {name}",contact:"CONTACT US!"}};
    expect(()=>validateCatalog(source,translated)).not.toThrow();
    expect(assertTranslatedCatalog(source,translated,"fr")).toEqual({changedMessages:1,unchangedMessages:["Labels.checkout","Labels.contact","Labels.properName"]});
  });
  it("keeps numeral-glyph-only edits and ICU branch punctuation on the unchanged prose report",()=>{
    const source={Greeting:"Hello",Items:"50 items",Count:"{count, plural, one {One item} other {Many items}}"};
    const translated={Greeting:"হ্যালো",Items:"৫০ ITEMS!",Count:"{count, plural, other {MANY ITEMS!} one {ONE ITEM.}}"};
    expect(()=>validateCatalog(source,translated)).not.toThrow();
    expect(assertTranslatedCatalog(source,translated,"bn")).toEqual({changedMessages:1,unchangedMessages:["Count","Items"]});
    expect(()=>assertTranslatedCatalog({Items:source.Items},{Items:translated.Items},"bn")).toThrow("unchanged English");
  });
  it("does not require translation for a catalog made entirely of protected data and variables",()=>{
    const source={Brand:"SexToy",Link:"https://example.com",Value:"220 V",Variable:"{name}"};
    expect(assertTranslatedCatalog(source,source,"fr")).toEqual({changedMessages:0,unchangedMessages:[]});
  });
});
