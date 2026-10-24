import "dotenv/config";
import { config } from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assertTranslatedCatalog, canonicalLocale, flattenCatalog, providerLanguageCode, validateCatalog, type MessageCatalog } from "../lib/translations/validation";
import { LibreTranslateProvider } from "../lib/translations/provider";
import { generateCatalog } from "../lib/translations/catalog-generation";

config({path:".env.local",override:false,quiet:true});
const [command,...args]=process.argv.slice(2);
function argument(name:string,fallback?:string){const index=args.indexOf(`--${name}`);return index>=0?args[index+1]:fallback;}
const flag=(name:string)=>args.includes(`--${name}`);
async function sourceCatalog():Promise<MessageCatalog>{
  const files=["core-en.json","interface-en.json","admin-en.json","translation-management-en.json","seo-en.json","notifications-en.json"];
  return Object.assign({},...await Promise.all(files.map(async file=>JSON.parse(await readFile(resolve("messages",file),"utf8")))));
}
async function jsonFile(file:string|undefined){if(!file)throw new Error("--file is required.");return JSON.parse(await readFile(resolve(file),"utf8"));}
function reviewer(){const value=argument("reviewer");if(!value)throw new Error("--reviewer must identify the responsible reviewer/operator.");return value;}

async function main(){
  const source=await sourceCatalog();
  switch(command){
    case "audit":{
      const english=flattenCatalog(source);const bnFiles=["core-bn.json","interface-bn.json","admin-bn.json","translation-management-bn.json","seo-bn.json","notifications-bn.json"];
      let bengali:unknown;
      try{const catalog=Object.assign({},...await Promise.all(bnFiles.map(async file=>JSON.parse(await readFile(resolve("messages",file),"utf8")))));bengali=validateCatalog(source,catalog);}catch(error){bengali={valid:false,error:error instanceof Error?error.message:String(error)};}
      process.stdout.write(JSON.stringify({englishMessages:Object.keys(english).length,bengali},null,2)+"\n");break;
    }
    case "validate":{const catalog=await jsonFile(argument("file"));process.stdout.write(JSON.stringify({...validateCatalog(source,catalog),...(argument("locale")?assertTranslatedCatalog(source,catalog,canonicalLocale(argument("locale")!)): {})},null,2)+"\n");break;}
    case "probe":{
      const provider=new LibreTranslateProvider();
      await provider.health();
      const languages=await provider.supportedLanguages();
      const sourceCode=providerLanguageCode(canonicalLocale(argument("source","en")!));
      const targetCode=providerLanguageCode(canonicalLocale(argument("target","fr")!));
      const text=argument("text");
      const translation=text?await provider.translate([text],sourceCode,targetCode):undefined;
      process.stdout.write(JSON.stringify({provider:provider.name,languages,source:sourceCode,target:targetCode,pairAvailable:languages.some(row=>row.code===sourceCode&&row.targets?.includes(targetCode)),...(translation?{translation}: {})},null,2)+"\n");break;
    }
    case "generate":{
      const code=canonicalLocale(argument("locale")??"");const dryRun=!flag("execute");
      if(!dryRun&&!argument("output"))throw new Error("--output is required when using --execute.");
      const result=await generateCatalog(new LibreTranslateProvider(),source,providerLanguageCode(code),{dryRun,maxCharacters:Number(argument("max-characters","50000")),protectedTerms:["SexToy",...(process.env.TRANSLATION_PROTECTED_TERMS??"").split("|").filter(Boolean)]});
      if(result.catalog){const output=argument("output");if(!output)throw new Error("--output is required when using --execute.");await writeFile(resolve(output),JSON.stringify(result.catalog,null,2)+"\n");}
      process.stdout.write(JSON.stringify({...result,...(result.catalog?assertTranslatedCatalog(source,result.catalog,code):{}),catalog:result.catalog?"Written for human review; not published.":null},null,2)+"\n");break;
    }
    case "sync-provider":{const service=await import("../lib/translations/service");process.stdout.write(JSON.stringify(await service.refreshProviderLanguages(),null,2)+"\n");break;}
    case "import":{
      const service=await import("../lib/translations/service");const code=canonicalLocale(argument("locale")??"");
      const result=await service.setInterfaceCatalog({code,englishName:argument("name",code)!,nativeName:argument("native-name",code)!,catalog:await jsonFile(argument("file")),source,reviewedBy:flag("reviewed")?reviewer():undefined,fallbackLocale:argument("fallback"),acknowledgeUnchanged:flag("acknowledge-unchanged")});
      process.stdout.write(JSON.stringify({code:result.language.code,messages:result.messages,prepared:true,published:false,reviewed:!!result.language.catalogReviewedAt,unchangedMessages:result.unchangedMessages},null,2)+"\n");break;
    }
    case "publish":case "unpublish":{
      reviewer();const service=await import("../lib/translations/service");const result=await service.publishLanguage(argument("locale")??"",command==="publish",source);process.stdout.write(JSON.stringify({code:result.code,published:result.published},null,2)+"\n");break;
    }
    case "export":{
      const {prisma}=await import("../lib/db/prisma");const code=canonicalLocale(argument("locale")??"");const row=await prisma.localeLanguage.findUnique({where:{code}});if(!row?.interfaceCatalog)throw new Error("Stored interface catalog not found.");const output=argument("output");if(!output)throw new Error("--output is required.");await writeFile(resolve(output),JSON.stringify(row.interfaceCatalog,null,2)+"\n");process.stdout.write(`Exported ${code}.\n`);break;
    }
    case "batch":{const service=await import("../lib/translations/service");const config=await jsonFile(argument("file"));process.stdout.write(JSON.stringify(await service.preparePublicBatch({...config,dryRun:!flag("execute")}),null,2)+"\n");break;}
    case "run":{reviewer();const service=await import("../lib/translations/service");process.stdout.write(JSON.stringify(await service.runTranslationJobs(Number(argument("limit","5"))),null,2)+"\n");break;}
    case "worker":{
      reviewer();const service=await import("../lib/translations/service");
      const interval=Number(argument("interval","5000"));const cycles=Number(argument("cycles","0"));
      if(!Number.isSafeInteger(interval)||interval<1000||interval>300000||!Number.isSafeInteger(cycles)||cycles<0)throw new Error("Worker interval must be 1000–300000 ms and cycles a nonnegative integer (0 runs until stopped).");
      let stopping=false;const stop=()=>{stopping=true;};process.once("SIGINT",stop);process.once("SIGTERM",stop);
      try{for(let cycle=0;!stopping&&(cycles===0||cycle<cycles);cycle++){
        process.stdout.write(JSON.stringify(await service.runTranslationJobs(Number(argument("limit","5"))))+"\n");
        if(!stopping&&(cycles===0||cycle+1<cycles))await new Promise<void>(resolve=>{const timer=setTimeout(done,interval);function done(){clearTimeout(timer);process.off("SIGINT",done);process.off("SIGTERM",done);resolve();}process.once("SIGINT",done);process.once("SIGTERM",done);});
      }}finally{process.off("SIGINT",stop);process.off("SIGTERM",stop);}
      break;
    }
    case "status":{const service=await import("../lib/translations/service");const status=await service.translationDashboard();process.stdout.write(JSON.stringify({available:status.languages.filter(row=>row.available).length,prepared:status.languages.filter(row=>row.prepared).length,published:status.languages.filter(row=>row.published).length,providerConfigured:status.providerConfigured,jobs:status.jobs.map(({id,status,attempts,characters,lastError})=>({id,status,attempts,characters,lastError}))},null,2)+"\n");break;}
    default:throw new Error("Commands: audit, validate --file [--locale], probe [--source en --target fr --text], generate --locale [--execute --max-characters --output], sync-provider, import --locale --file [--reviewed --reviewer --acknowledge-unchanged], publish/unpublish --locale --reviewer, export --locale --output, batch --file [--execute], run --reviewer [--limit], worker --reviewer [--limit --interval --cycles], status.");
  }
}
main().then(async()=>{if(["sync-provider","import","publish","unpublish","export","batch","run","worker","status"].includes(command)){const {prisma}=await import("../lib/db/prisma");await prisma.$disconnect();}}).catch(error=>{process.stderr.write((error instanceof Error?error.message:String(error))+"\n");process.exit(1);});
