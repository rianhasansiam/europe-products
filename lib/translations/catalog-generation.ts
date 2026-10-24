import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { supportsTranslationPair, type TranslationProvider } from "./provider";
import { protectText, translateProtectedBatch } from "./content";
import { flattenCatalog, validateCatalog, type MessageCatalog } from "./validation";

type LiteralRange = { start: number; end: number; text: string };
function literalRanges(elements: MessageFormatElement[]): LiteralRange[] {
  const result:LiteralRange[]=[];
  for(const element of elements) {
    if(element.type===TYPE.literal && element.value.trim() && element.location) result.push({start:element.location.start.offset,end:element.location.end.offset,text:element.value});
    if(element.type===TYPE.tag) result.push(...literalRanges(element.children));
    if(element.type===TYPE.plural || element.type===TYPE.select) for(const option of Object.values(element.options)) result.push(...literalRanges(option.value));
  }
  return result;
}

/** Translation sees only literal leaves, never ICU expressions or private data. */
export async function generateCatalog(provider:TranslationProvider,source:MessageCatalog,targetProviderCode:string,options:{dryRun:boolean;maxCharacters:number;protectedTerms?:string[]}) {
  if(!Number.isSafeInteger(options.maxCharacters)||options.maxCharacters<1)throw new Error("The explicit maximum character allowance must be a positive integer.");
  const messages=flattenCatalog(source);
  const ranges=Object.fromEntries(Object.entries(messages).map(([key,value])=>[key,literalRanges(parse(value,{captureLocation:true}))]));
  const work=Object.entries(ranges).flatMap(([key,items])=>items.map(range=>({key,range,mask:protectText(range.text,options.protectedTerms??["SexToy"])})));
  const characters=work.reduce((sum,item)=>sum+item.mask.text.length,0);
  const workload={messages:Object.keys(messages).length,fragments:work.length,characters};
  if(options.dryRun) return {dryRun:true,...workload,catalog:null};
  if(characters>options.maxCharacters) throw new Error(`Catalog workload (${characters} characters) exceeds the explicit maximum (${options.maxCharacters}). Run dry-run and adjust the approved limit.`);
  if(!supportsTranslationPair(await provider.supportedLanguages(),"en",targetProviderCode))throw new Error(`The installed models do not support en → ${targetProviderCode}. Import a reviewed manual catalog for this language.`);
  const translated=new Map<LiteralRange,string>();
  const values=await translateProtectedBatch(provider,work.map(item=>item.mask),"en",targetProviderCode);
  values.forEach((value,index)=>translated.set(work[index].range,value));
  const clone=JSON.parse(JSON.stringify(source)) as MessageCatalog;
  for(const [key,value] of Object.entries(messages)) {
    let output=value;
    for(const range of [...ranges[key]].sort((a,b)=>b.start-a.start)) {
      const literal=(translated.get(range)??range.text).replace(/'/g,"''").replace(/[{}<>]/g,char=>`'${char}'`);
      output=output.slice(0,range.start)+literal+output.slice(range.end);
    }
    const keys=key.split("."); const leaf=keys.pop()!;
    const parent=keys.reduce<MessageCatalog>((node,key)=>node[key] as MessageCatalog,clone);parent[leaf]=output;
  }
  validateCatalog(source,clone);
  return {dryRun:false,...workload,catalog:clone};
}
