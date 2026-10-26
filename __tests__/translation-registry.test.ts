import { describe, expect, it } from "vitest";
import { getLocaleDefinition, getPublishedLocales, getRegisteredLocales } from "@/lib/i18n/registry";

describe("central language registry",()=>{
  it("registers European languages for manual import without publishing absent catalogs",()=>{
    const codes=getRegisteredLocales().map(locale=>locale.code);
    for(const code of ["en","fr","de","es","it","pt","nl","pl","cs","sk","hu","ro","bg","hr","sr","bs","sl","sq","el","tr","sv","nb","da","fi","et","lv","lt","uk","ru","be","ca","ga","mt","is","lb","mk","ka","hy","az"]){
      expect(codes).toContain(code);
      if(code!=="en")expect(getLocaleDefinition(code)).toMatchObject({prepared:false,published:false,available:false});
    }
    expect(getPublishedLocales().map(locale=>locale.code)).toEqual(["en"]);
  });
  it("distinguishes regional and writing-system variants using official API codes",()=>{
    expect(getLocaleDefinition("pt-BR")).toMatchObject({code:"pt-BR",providerCode:"pt-BR"});
    expect(getLocaleDefinition("zh-TW")).toMatchObject({code:"zh-Hant",providerCode:"zh-Hant"});
    expect(getLocaleDefinition("zh-CN")).toMatchObject({code:"zh-Hans",providerCode:"zh-Hans"});
    expect(getLocaleDefinition("no")).toMatchObject({code:"no",providerCode:"nb",published:false});
    expect(getLocaleDefinition("nn")).toMatchObject({code:"nn",providerCode:"nn",published:false,available:false});
    expect(getLocaleDefinition("sr-Latn")).toMatchObject({code:"sr-Latn",providerCode:null,direction:"ltr"});
    expect(getLocaleDefinition("ar")).toMatchObject({direction:"rtl",published:false});
  });
  it("keeps provider availability separate from a complete published catalog",()=>{
    expect(getLocaleDefinition("en")).toMatchObject({prepared:true,published:true,available:false});
    expect(getLocaleDefinition("bn")).toMatchObject({prepared:false,published:false,available:false});
  });
});
