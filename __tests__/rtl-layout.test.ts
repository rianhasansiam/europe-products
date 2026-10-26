import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicCategoryNode } from "@/features/categories/api";
import { getLocaleDefinition } from "@/lib/i18n/registry";

const context=vi.hoisted(()=>({pathname:"/ar/products",authenticated:false}));
vi.mock("next/navigation",()=>({
  usePathname:()=>context.pathname,
  useRouter:()=>({push:vi.fn(),replace:vi.fn(),prefetch:vi.fn(),back:vi.fn(),forward:vi.fn(),refresh:vi.fn()}),
}));
vi.mock("@/lib/auth/use-app-session",()=>({useSession:()=>({
  data:context.authenticated?{user:{id:"rtl-fixture-user",name:"مراجع التجربة",role:"USER"}}:null,
  status:context.authenticated?"authenticated":"unauthenticated",
})}));
vi.mock("react-redux",()=>({useSelector:(select:(state:unknown)=>unknown)=>select({
  cart:{items:[{quantity:2},{quantity:1}]},wishlist:{items:[{id:"fixture-wishlist"}]},
})}));

import Navbar from "@/components/layout/Navbar";
import LanguageSelector from "@/components/i18n/LanguageSelector";

// Deliberately partial, unpublished layout data. This is never imported into
// LocaleLanguage, messages/, publication routing, SEO, or the application DB.
const arabic={
  Navigation:{
    allProducts:"جميع المنتجات",about:"من نحن",contact:"تواصل معنا",admin:"الإدارة",
    openMenu:"فتح القائمة",closeMenu:"إغلاق القائمة",homeLabel:"{brand} — الصفحة الرئيسية",
    tagline:"جودة جيدة وخدمة جيدة",signIn:"تسجيل الدخول",signUp:"إنشاء حساب",
    myProfile:"ملفي الشخصي",user:"المستخدم",openProfileMenu:"فتح قائمة الحساب",
    wishlist:"المفضلة",wishlistItems:"المفضلة، {count, plural, one {# منتج} other {# منتجات}}",
    cart:"السلة",cartItems:"السلة، {count, plural, one {# منتج} other {# منتجات}}",
    signOut:"تسجيل الخروج",signOutTitle:"تسجيل الخروج؟",signOutDescription:"تسجيل الدخول مجددًا للوصول إلى الحساب.",stay:"البقاء",
    searchProducts:"ابحث عن المنتجات أو الرموز أو الفئات…",search:"بحث…",menu:"القائمة",
    menuDescription:"تصفح روابط الموقع وإجراءات الحساب.",
  },
  Language:{
    choose:"اختيار اللغة",search:"البحث عن لغة…",selected:"محددة",noResults:"لا توجد لغات مطابقة",
    saving:"جارٍ تغيير اللغة…",saveFailed:"تعذر حفظ اللغة.",draftTitle:"الاحتفاظ بالتغييرات؟",
    draftUnavailable:"توجد تغييرات غير محفوظة.",continue:"متابعة",stay:"البقاء",waitForSubmission:"انتظر اكتمال العملية.",
  },
  InterfaceLayoutCategoryNavigation:{categories:"الفئات",viewAll:"عرض الكل",expand:"توسيع",collapse:"طي"},
  InterfaceLayoutSearchBar:{searchTheCatalog:"البحث في الكتالوج",catalogSearchSuggestions:"اقتراحات البحث"},
};
const languages=[getLocaleDefinition("en"),getLocaleDefinition("ar")];
const categories:PublicCategoryNode[]=[{
  id:"rtl-pumps",name:"المضخات الصناعية",slug:"pumps",path:"pumps",description:null,image:null,
  depth:0,position:0,childCount:0,directProductCount:3,totalProductCount:3,children:[],
}];
function withArabic(children:ComponentProps<typeof NextIntlClientProvider>["children"]){
  return createElement(NextIntlClientProvider,{locale:"ar",messages:arabic,timeZone:"Asia/Dhaka",children} satisfies ComponentProps<typeof NextIntlClientProvider>);
}
function navbar(open=false){return createElement(Navbar,{categories,initialMobileMenuOpen:open});}
function documentMarkup(styles:string[]=[],fontClass=""){
  return "<!DOCTYPE html>"+renderToStaticMarkup(withArabic(createElement("html",{lang:"ar",dir:"rtl",className:fontClass},
    createElement("head",null,
      createElement("meta",{charSet:"utf-8"}),createElement("meta",{name:"viewport",content:"width=device-width, initial-scale=1"}),
      createElement("meta",{name:"robots",content:"noindex, nofollow"}),
      createElement("title",null,"SexToy — unpublished RTL layout fixture"),
      ...styles.map(href=>createElement("link",{key:href,rel:"stylesheet",href})),
      createElement("style",null,".fixture-note{padding:12px 20px;background:#fff4ce;color:#574100;font:14px Arial,sans-serif}.fixture-content{max-width:960px;margin:32px auto;padding:0 20px;line-height:1.8}.fixture-language{max-width:340px;margin-top:24px;border:1px solid #ddd;border-radius:12px;padding:12px}"),
    ),
    createElement("body",null,
      createElement("aside",{role:"note",dir:"ltr",lang:"en",className:"fixture-note"},"Unpublished RTL layout fixture. Partial Arabic test labels; no language publication or translation-quality claim. On mobile the real drawer starts open for layout review."),
      navbar(true),
      createElement("main",{className:"fixture-content"},
        createElement("h1",{className:"text-2xl font-bold"},"معاينة التخطيط من اليمين إلى اليسار"),
        createElement("p",null,"مراجعة محاذاة القائمة والبحث والرموز واتجاه النص في تجربة تخطيط غير منشورة."),
        createElement("div",{className:"fixture-language"},createElement(LanguageSelector,{languages,mobile:true})),
        createElement("p",{dir:"ltr",lang:"en",className:"mt-6 text-sm"},"Static React SSR: the menu is rendered in its actual open initial state. This fixture does not exercise click handlers or hydrate account/language preferences."),
      ),
    ),
  )));
}

beforeEach(()=>{context.pathname="/ar/products";context.authenticated=false;});
describe("unpublished RTL navigation layout",()=>{
  it("renders Arabic navigation/accessibility labels and localized links with the real components",()=>{
    const html=renderToStaticMarkup(withArabic(navbar()));
    expect(html).toContain('href="/ar/products"');
    expect(html).toContain('href="/ar/categories/pumps"');
    expect(html).toContain('href="/ar/login"');
    expect(html).toContain('href="/ar/cart"');
    expect(html).toContain('aria-label="فتح القائمة"');
    expect(html).toContain(`aria-label="السلة، ${new Intl.NumberFormat("ar").format(3)} منتجات"`);
    expect(html).not.toContain('aria-label="اختيار اللغة: Arabic"');
    expect(html).not.toContain('lang="ar">العربية');
    expect(html).toContain("جميع المنتجات");
    expect(html).not.toContain("Search products, codes, models and categories");
    expect((html.match(/placeholder="ابحث عن المنتجات أو الرموز أو الفئات…"/g)??[]).length).toBe(2);
  });
  it("starts ordinary navigation closed but can render the actual open drawer state for QA",()=>{
    const closed=renderToStaticMarkup(withArabic(navbar()));
    expect(closed).toMatch(/<aside[^>]+id="mobile-navigation-drawer"[^>]+aria-hidden="true"[^>]+inert=""/);
    expect(closed).toContain("rtl:translate-x-full");
    const open=renderToStaticMarkup(withArabic(navbar(true)));
    expect(open).toMatch(/<aside[^>]+id="mobile-navigation-drawer"[^>]+aria-hidden="false"/);
    expect(open).not.toMatch(/<aside[^>]+id="mobile-navigation-drawer"[^>]+inert=/);
    expect(open).toContain('aria-label="إغلاق القائمة" aria-expanded="true"');
    expect(open).toContain("translate-x-0");
  });
  it("reserves title space and uses logical edges for the drawer, close button, badges and search",()=>{
    const html=renderToStaticMarkup(withArabic(navbar(true)));
    expect(html).toMatch(/id="mobile-navigation-title" class="pe-10 /);
    expect(html).toMatch(/aria-label="إغلاق القائمة"[^>]+class="absolute end-3 /);
    expect((html.match(/absolute end-0 top-0/g)??[]).length).toBe(2);
    expect(html).toContain("xl:end-0.5");
    expect(html).toContain("start-0");
    expect(html).toContain("border-e");
    expect(html).toContain("absolute start-3");
    expect(html).toContain("ps-11 pe-11");
    expect(html).toContain("ps-10 text-[16px]");
    expect(html).not.toContain(" pl-10 ");
    expect(html).not.toContain("hover:translate-x-1");
    expect(html).not.toContain("rtl:hover:-translate-x-1");
  });
  it("keeps the document direction, native language label and logical mobile selector alignment",()=>{
    const html=documentMarkup();
    expect(html).toContain('<html lang="ar" dir="rtl"');
    expect(html).toContain('lang="ar">العربية');
    expect(html).toContain("ms-auto text-xs");
    expect(html).toContain('lang="en"');
    expect(html).toContain("Unpublished RTL layout fixture");
    expect(html).toContain('content="noindex, nofollow"');
  });
  it("retains Arabic account labels and localized profile links for authenticated navigation",()=>{
    context.authenticated=true;
    const html=renderToStaticMarkup(withArabic(navbar(true)));
    expect(html).toContain('href="/ar/profile"');
    expect(html).toContain('aria-label="فتح قائمة الحساب"');
    expect(html).toContain("تسجيل الخروج");
  });
  it.skipIf(process.env.BUILD_RTL_FIXTURE!=="1")("writes a reviewable fixture using the running final build's styles",async()=>{
    const base="http://127.0.0.1:3111";
    const response=await fetch(`${base}/en/products`,{redirect:"error",signal:AbortSignal.timeout(20_000)});
    expect(response.ok).toBe(true);
    const html=await response.text();
    const styles=[...html.matchAll(/<link\b[^>]*>/g)].flatMap(([link])=>{
      if(!/\brel="stylesheet"/.test(link))return [];
      const href=link.match(/\bhref="([^"]+)"/)?.[1];if(!href)return [];
      const url=new URL(href,base);
      if(url.origin!==base||!url.pathname.startsWith("/_next/static/"))throw new Error("Fixture styles must come from the local final build.");
      return [url.href];
    });
    expect(styles.length).toBeGreaterThan(0);
    const fontClass=html.match(/<html\b[^>]*class="([^"]+)"/)?.[1]??"";
    const destination=resolve(".next/rtl-fixture.html");
    await mkdir(resolve(".next"),{recursive:true});
    await writeFile(destination,documentMarkup([...new Set(styles)],fontClass),"utf8");
    console.info(`Unpublished RTL fixture: ${destination}`);
  },30_000);
});
