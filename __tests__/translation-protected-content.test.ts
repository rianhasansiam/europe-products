import { describe, expect, it } from "vitest";
import { assertProtectedText, protectText, validateStructuredTranslation } from "@/lib/translations/content";

const blocks=[{id:"b1",type:"imageText",isVisible:true,heading:"SexToy AB-123 220 V",imageUrl:"/pump.webp",imageAlt:"Pump photo",imagePosition:"left"}];
describe("protected manual public content",()=>{
  it("allows localized digits and translated unit names while preserving numeric values",()=>{
    expect(()=>assertProtectedText("50km, 220 V, 24/7", "৫০ কিলোমিটার, ২২০ ভোল্ট, ২৪/৭")).not.toThrow();
    expect(()=>assertProtectedText("220 V", "১১০ ভোল্ট")).toThrow("numeric values");
  });
  it.each(["220 W","220 kW","220","২২০ ওয়াট"])("rejects changed or missing voltage units (%s)",translated=>{
    expect(()=>assertProtectedText("220 V",translated)).toThrow("preserve");
  });
  it("only accepts explicitly equivalent localized SI unit names",()=>{
    expect(()=>assertProtectedText("220 V / 50km","২২০ ভোল্ট / ৫০ কিলোমিটারের")).not.toThrow();
    expect(()=>assertProtectedText("220 W","২২০ কিলোওয়াট")).toThrow("preserve");
  });
  it.each(["OtherBrand AB-123 220 V","SexToy XY-999 220 V","SexToy AB-123 110 V"])("rejects changed protected structured wording (%s)",heading=>{
    expect(()=>validateStructuredTranslation(JSON.stringify(blocks),JSON.stringify([{...blocks[0],heading}]),["SexToy"])).toThrow("preserve");
  });
  it("allows translated rich prose with the original brand/model/technical values",()=>{
    expect(()=>validateStructuredTranslation(JSON.stringify(blocks),JSON.stringify([{...blocks[0],heading:"SexToy AB-123 ২২০ ভোল্ট পাম্প"}]),["SexToy"])).not.toThrow();
  });
  it("preserves public emails and URL values while letting sentence punctuation change",()=>{
    expect(()=>assertProtectedText("Contact help@bangbuy.com or https://bangbuy.com/help.","যোগাযোগ help@bangbuy.com অথবা https://bangbuy.com/help!",["SexToy"])).not.toThrow();
    expect(()=>assertProtectedText("Email help@bangbuy.com","ইমেইল attacker@example.com")).toThrow("email addresses");
    const mask=protectText("Email help@bangbuy.com and visit https://bangbuy.com.");
    expect(mask.text).not.toContain("help@bangbuy.com");
    expect(mask.restore(mask.text)).toBe("Email help@bangbuy.com and visit https://bangbuy.com.");
  });
});
