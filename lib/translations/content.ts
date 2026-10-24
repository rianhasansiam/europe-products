import { assertProtectedText, protectText } from "./protection";
export { assertProtectedText, protectText } from "./protection";

import { descriptionBlocksSchema } from "@/lib/validations/product-description-blocks.validation";
import { LIBRETRANSLATE_DEFAULT_BATCH_SIZE, LIBRETRANSLATE_DEFAULT_MAX_CHARACTERS, type TranslationProvider } from "./provider";

export const PUBLIC_FIELDS = {
  product: ["name", "description", "descriptionBlocks", "seoTitle", "metaDescription"],
  category: ["name", "description", "seoTitle", "metaDescription"],
  brand: ["description", "seoTitle", "metaDescription"],
  manufacturer: ["description"],
  banner: ["title", "subtitle", "description", "metadata.badge", "metadata.label", "metadata.heading", "metadata.discount", "metadata.tag"],
} as const;
export type PublicEntity = keyof typeof PUBLIC_FIELDS;

export function assertPublicField(entityType: string, field: string): asserts entityType is PublicEntity {
  if (!(entityType in PUBLIC_FIELDS) || !(PUBLIC_FIELDS[entityType as PublicEntity] as readonly string[]).includes(field)) throw new Error("This public field is not approved for translation.");
}

/** Protected tokens never enter the engine: translate spans and reassemble.
 * Argos models can alter opaque markers, even when they look like model codes.
 */
export async function translateProtectedBatch(provider:TranslationProvider,masks:ReturnType<typeof protectText>[],source:string,target:string):Promise<string[]> {
  type Part={literal:string}|{index:number;leading:string;trailing:string};
  const configuredCharacters=Number(process.env.LIBRETRANSLATE_MAX_CHARACTERS??LIBRETRANSLATE_DEFAULT_MAX_CHARACTERS);
  const configuredBatch=Number(process.env.LIBRETRANSLATE_BATCH_SIZE??LIBRETRANSLATE_DEFAULT_BATCH_SIZE);
  if(!Number.isSafeInteger(configuredCharacters)||configuredCharacters<1||!Number.isSafeInteger(configuredBatch)||configuredBatch<1)throw new Error("LibreTranslate request limits must be positive integers.");
  const characterCeiling=Math.min(LIBRETRANSLATE_DEFAULT_MAX_CHARACTERS,configuredCharacters);
  const batchCeiling=Math.min(LIBRETRANSLATE_DEFAULT_BATCH_SIZE,configuredBatch);
  const work:string[]=[];
  const layouts=masks.map(mask=>mask.text.split(/(ZXQPROTECTED\d+QXZ)/g).flatMap<Part>(part=>{
    if(/^ZXQPROTECTED\d+QXZ$/.test(part)||!part.trim())return [{literal:part}];
    const chunks:string[]=[];let remaining=part;
    while([...remaining].length>characterCeiling){
      const head=[...remaining].slice(0,characterCeiling).join("");
      const boundary=head.search(/\s+\S*$/u);
      if(boundary<=0)throw new Error("One translation word exceeds the safe request limit. Import a reviewed manual translation.");
      chunks.push(remaining.slice(0,boundary));remaining=remaining.slice(boundary);
    }
    chunks.push(remaining);
    return chunks.map<Part>(chunk=>{
      const leading=chunk.match(/^\s*/u)![0],trailing=chunk.match(/\s*$/u)![0];
      const text=chunk.trim();if(!text)return {literal:chunk};
      const index=work.push(text)-1;return {index,leading,trailing};
    });
  }));
  const results:string[]=[];
  for(let start=0;start<work.length;){
    let end=start,characters=0;
    while(end<work.length&&end-start<batchCeiling&&characters+[...work[end]].length<=characterCeiling){characters+=[...work[end]].length;end++;}
    const values=await provider.translate(work.slice(start,end),source,target);
    if(values.length!==end-start||values.some(value=>typeof value!=="string"||!value.trim()))throw new Error("Provider returned incomplete catalog translations.");
    // Argos may return a literal HTML nonbreaking-space artifact for format=text.
    // Decode that whitespace only; markup stays subject to structural validation.
    results.push(...values.map(value=>value.replace(/&\s*(?:nbsp|#160|#x0*a0)\s*;/gi," ")));start=end;
  }
  return layouts.map((layout,index)=>masks[index].restore(layout.map(part=>"literal" in part?part.literal:part.leading+results[part.index].trim()+part.trailing).join("")));
}

type Path = (string | number)[];
function structuredTextPaths(blocks: unknown[]): Path[] {
  const paths: Path[] = [];
  const add = (obj: Record<string, unknown>, key: string, path: Path) => { if (typeof obj[key] === "string" && (obj[key] as string).trim()) paths.push([...path,key]); };
  const visitTiptap = (node: Record<string, unknown>, path: Path) => {
    if (node.type === "text") add(node,"text",path);
    if (Array.isArray(node.content)) node.content.forEach((child,i) => { if (child && typeof child === "object") visitTiptap(child as Record<string, unknown>,[...path,"content",i]); });
  };
  blocks.forEach((value,i) => {
    const block = value as Record<string, unknown>; const path: Path=[i];
    add(block,"heading",path);
    if(block.type === "richText" && block.content) visitTiptap(block.content as Record<string,unknown>,[...path,"content"]);
    if(block.type === "imageText") for(const field of ["description","imageAlt","ctaLabel"]) add(block,field,path);
    if(block.type === "featureGrid" && Array.isArray(block.items)) block.items.forEach((item,j)=>{ for(const field of ["title","description"]) add(item,field,[...path,"items",j]); });
    // Specification values are protected technical content; only labels translate.
    if(block.type === "specificationTable" && Array.isArray(block.rows)) block.rows.forEach((row,j)=>add(row,"label",[...path,"rows",j]));
  });
  return paths;
}

export function validateStructuredTranslation(source: string, translated: string, protectedTerms: string[] = []): void {
  const original=descriptionBlocksSchema.parse(JSON.parse(source));
  const target=descriptionBlocksSchema.parse(JSON.parse(translated));
  if(!original || !target) throw new Error("Structured translations must contain description blocks.");
  const paths=structuredTextPaths(original);
  for (const path of paths) {
    const read = (blocks: unknown[]) => path.reduce<unknown>((node, key) => (node as Record<string | number, unknown>)?.[key], blocks);
    const from = read(original), to = read(target);
    if (typeof from !== "string" || typeof to !== "string") throw new Error("Translation changed structural text fields.");
    assertProtectedText(from, to, protectedTerms);
  }
  const skeleton=(blocks: unknown[])=>{
    const clone=JSON.parse(JSON.stringify(blocks));
    for(const path of paths) {
      const parent=path.slice(0,-1).reduce<unknown>((node,key)=>(node as Record<string|number,unknown>)?.[key],clone) as Record<string|number,unknown>;
      if(!parent || typeof parent[path[path.length-1]]!=="string") throw new Error("Translation changed structural text fields.");
      parent[path[path.length-1]]="__TEXT__";
    }
    return JSON.stringify(clone);
  };
  if(skeleton(original)!==skeleton(target)) throw new Error("Translation changed markup, URLs, technical values, or protected structural attributes.");
}

export async function translatePublicValue(provider: TranslationProvider, field: string, value: string, source: string, target: string, protectedTerms: string[]): Promise<string> {
  if (field !== "descriptionBlocks") {
    // Raw legacy HTML is deliberately not sent as plain text or altered; use the
    // existing structural description builder or reviewed manual translation.
    if (/<[a-z][\s\S]*>/i.test(value)) throw new Error("Legacy HTML requires reviewed manual translation or structured description blocks.");
    const masked = protectText(value,protectedTerms);
    return (await translateProtectedBatch(provider,[masked],source,target))[0];
  }
  const blocks = descriptionBlocksSchema.parse(JSON.parse(value));
  if (!blocks) return value;
  const clone = JSON.parse(JSON.stringify(blocks));
  const paths = structuredTextPaths(clone);
  const read = (path: Path) => path.reduce<unknown>((node,key)=>(node as Record<string|number,unknown>)[key],clone) as string;
  const masks = paths.map(path=>protectText(read(path),protectedTerms));
  const translated=await translateProtectedBatch(provider,masks,source,target);
  translated.forEach((text,i)=>{ const path=paths[i]; const parent=path.slice(0,-1).reduce<unknown>((node,key)=>(node as Record<string|number,unknown>)[key],clone) as Record<string|number,unknown>; parent[path[path.length-1]]=text; });
  descriptionBlocksSchema.parse(clone);
  return JSON.stringify(clone);
}
