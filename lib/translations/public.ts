import "server-only";
import { getPublishedLanguages, getRequestLocale } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, normalizeLocale } from "@/lib/i18n/registry";
import { localizePublicCollection, type LocalizedPublic } from "./service";

type Row={id:string;[key:string]:unknown};
const record=(value:unknown):Row|null=>value&&typeof value==="object"&&!Array.isArray(value)&&"id" in value?value as Row:null;
export async function apiLocale(request:Request):Promise<string>{
  const code=normalizeLocale(new URL(request.url).searchParams.get("locale"));
  return code && (await getPublishedLanguages()).some(row=>row.code===code)?code:DEFAULT_LOCALE;
}

export async function localizeProductSnapshots<T extends {id:string}>(items:T[],locale:string):Promise<LocalizedPublic<T>[]> {
  const localized=await localizePublicCollection("product",items,locale);
  const categories=items.flatMap(item=>{
    const row=item as Row;const category=record(row.category);
    const breadcrumbs=Array.isArray(row.categoryBreadcrumb)?row.categoryBreadcrumb:[];
    return [...(category?[category]:[]),...breadcrumbs.flatMap(value=>record(value)?[record(value)!]:[]),...(typeof row.category==="string"&&typeof row.categoryId==="string"?[{id:row.categoryId,name:row.category}]:[])];
  });
  const originals=new Map<string,Row>();for(const category of categories)originals.set(category.id,{...originals.get(category.id),...category});
  const translated=await localizePublicCollection("category",[...originals.values()],locale);const byId=new Map(translated.map(row=>[row.id,row]));
  return localized.map(item=>{
    const output=item as unknown as Row;const category=record(output.category);
    if(category&&byId.has(category.id))output.category=byId.get(category.id);
    else if(typeof output.category==="string"&&typeof output.categoryId==="string")output.category=byId.get(output.categoryId)?.name??output.category;
    if(Array.isArray(output.categoryBreadcrumb))output.categoryBreadcrumb=output.categoryBreadcrumb.map(value=>record(value)?byId.get(record(value)!.id)??value:value);
    return output as unknown as LocalizedPublic<T>;
  });
}

export async function localizeCategorySnapshots<T extends {id:string}>(items:T[],locale:string):Promise<LocalizedPublic<T>[]> {
  const flat:Row[]=[];const walk=(nodes:Row[])=>{for(const node of nodes){flat.push(node);if(Array.isArray(node.children))walk(node.children as Row[]);if(Array.isArray(node.breadcrumb))flat.push(...node.breadcrumb as Row[]);}};
  walk(items as Row[]);
  const originals=new Map<string,Row>();for(const category of flat)originals.set(category.id,{...originals.get(category.id),...category});
  const localized=await localizePublicCollection("category",[...originals.values()],locale);const byId=new Map(localized.map(row=>[row.id,row]));
  const build=(nodes:Row[]):Row[]=>nodes.map(node=>({...node,...byId.get(node.id),...(Array.isArray(node.children)?{children:build(node.children as Row[])}:{}),...(Array.isArray(node.breadcrumb)?{breadcrumb:(node.breadcrumb as Row[]).map(crumb=>({...crumb,...byId.get(crumb.id)}))}:{})}));
  const output=build(items as Row[]);
  const products=output.flatMap(row=>Array.isArray(row.products)?row.products as Row[]:[]);
  const translatedProducts=await localizeProductSnapshots(products,locale);const productsById=new Map(translatedProducts.map(row=>[row.id,row]));
  return output.map(row=>({...row,...(Array.isArray(row.products)?{products:(row.products as Row[]).map(product=>productsById.get(product.id)??product)}:{})})) as LocalizedPublic<T>[];
}

const BANNER_ALIASES={badge:"metadata.badge",label:"metadata.label",heading:"metadata.heading",discount:"metadata.discount",tag:"metadata.tag"};
export async function localizeBannerSnapshots<T extends {id:string}>(items:T[],locale:string):Promise<LocalizedPublic<T>[]> {
  const expanded=items.map(item=>({...item,metadata:Object.fromEntries(Object.keys(BANNER_ALIASES).filter(key=>typeof (item as Row)[key]==="string").map(key=>[key,(item as Row)[key]]))}));
  const translated=await localizePublicCollection("banner",expanded,locale);
  return translated.map(item=>{const output={...item} as unknown as Row;for(const [alias,path]of Object.entries(BANNER_ALIASES)){const value=(item.metadata as Record<string,unknown>)[path.split(".")[1]];if(value!==undefined)output[alias]=value;}delete output.metadata;return output as unknown as LocalizedPublic<T>;});
}

export async function localizeProductDetail<T extends {id:string}>(product:T|null):Promise<LocalizedPublic<T>|null>{
  if(!product)return null;return (await localizeProductSnapshots([product],await getRequestLocale()))[0];
}
