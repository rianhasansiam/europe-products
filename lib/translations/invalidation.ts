import "server-only";
import { after } from "next/server";
import type { PublicEntity } from "./content";

export function schedulePublicTranslationStaleness(entityType:PublicEntity,entityIds:readonly string[]):void{
  if(!entityIds.length)return;
  try{after(async()=>{const {markPublicTranslationsStale}=await import("./service");await markPublicTranslationsStale(entityType,entityIds);});}
  catch{/* Non-request CLI contexts still validate source/context hashes on every public read. */}
}
