import { beforeEach, describe, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({guard:vi.fn(),dashboard:vi.fn(),jobs:vi.fn(),importCatalog:vi.fn()}));
vi.mock("@/lib/api/guards",()=>({requireAdmin:mock.guard}));
vi.mock("@/lib/cache/catalog-invalidation",()=>({invalidateCatalogEntries:vi.fn()}));
vi.mock("@/lib/i18n/catalogs",()=>({loadBundledMessages:vi.fn(async()=>({Hello:"Hello {name}"}))}));
vi.mock("@/lib/translations/service",()=>({translationDashboard:mock.dashboard,runTranslationJobs:mock.jobs,setInterfaceCatalog:mock.importCatalog,preparePublicBatch:vi.fn(),publishLanguage:vi.fn(),refreshProviderLanguages:vi.fn(),retryTranslationJob:vi.fn(),savePublicTranslation:vi.fn(),setPublicTranslationStatus:vi.fn()}));
import { GET, POST } from "@/app/api/admin/translations/route";
beforeEach(()=>{vi.clearAllMocks();mock.guard.mockResolvedValue({ok:false,response:Response.json({error:"Authentication required."},{status:401})});});
describe("translation management authorization",()=>{
  it("rejects unauthenticated dashboard and job requests before any service call",async()=>{expect((await GET()).status).toBe(401);expect((await POST(new Request("https://bangbuy.test/api/admin/translations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"runJobs",limit:5})}))).status).toBe(401);expect(mock.dashboard).not.toHaveBeenCalled();expect(mock.jobs).not.toHaveBeenCalled();});
  it("rejects non-admin sessions",async()=>{mock.guard.mockResolvedValue({ok:false,response:Response.json({error:"Admin access only."},{status:403})});expect((await GET()).status).toBe(403);expect(mock.dashboard).not.toHaveBeenCalled();});
  it("blocks cross-site admin writes",async()=>{mock.guard.mockResolvedValue({ok:true,session:{user:{id:"admin"}}});const request=new Request("https://bangbuy.test/api/admin/translations",{method:"POST",headers:{"Content-Type":"application/json",Origin:"https://evil.test","Sec-Fetch-Site":"cross-site"},body:JSON.stringify({action:"runJobs",limit:5})});expect((await POST(request)).status).toBe(403);expect(mock.jobs).not.toHaveBeenCalled();});
  it("validates and bounds admin job requests",async()=>{mock.guard.mockResolvedValue({ok:true,session:{user:{id:"admin"}}});const request=new Request("https://bangbuy.test/api/admin/translations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"runJobs",limit:50000})});expect((await POST(request)).status).toBe(400);expect(mock.jobs).not.toHaveBeenCalled();});
});
