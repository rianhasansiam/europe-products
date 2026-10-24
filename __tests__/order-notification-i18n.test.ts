import { describe, expect, it, vi } from "vitest";
import { buildOrderStatusNotification, notifyOrderStatusChange, type OrderNotificationContext } from "@/lib/orders/notifications";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/orders/status";
import english from "@/messages/notifications-en.json";
import bengali from "@/messages/notifications-bn.json";
import { validateCatalog } from "@/lib/translations/validation";

const context:OrderNotificationContext={orderNumber:"BB-2026-{ORD42}",status:"PENDING",customerName:"রিয়ান <customer>",customerEmail:"private@example.com",customerPhone:"+8801700000000"};
describe("localized order notification templates",()=>{
  it("keeps existing English/default output exactly stable for every status",()=>{
    for(const status of Object.keys(ORDER_STATUS_META) as OrderStatus[]){
      const result=buildOrderStatusNotification({...context,status});const meta=ORDER_STATUS_META[status];
      expect(result).toEqual({channel:"email",to:context.customerEmail,subject:`Order ${context.orderNumber}: ${meta.label}`,message:`Hi ${context.customerName}, your order ${context.orderNumber} is now "${meta.label}". ${meta.description}`});
    }
  });
  it("renders complete Bengali subject/body while preserving private values and codes",()=>{
    const result=buildOrderStatusNotification({...context,locale:"bn",status:"DELIVERED"});
    expect(result.subject).toBe(`অর্ডার ${context.orderNumber}: ডেলিভারি সম্পন্ন`);
    expect(result.message).toBe(`প্রিয় ${context.customerName}, আপনার অর্ডার ${context.orderNumber}-এর বর্তমান অবস্থা "ডেলিভারি সম্পন্ন"। আপনার অর্ডার পৌঁছে দেওয়া হয়েছে।`);
    expect(result.to).toBe(context.customerEmail);
    expect(result.message).toContain("{ORD42}");
  });
  it("preserves channel selection and localizes an unnamed recipient",()=>{
    expect(buildOrderStatusNotification({...context,customerName:"   ",customerEmail:null,locale:"bn"})).toMatchObject({channel:"sms",to:context.customerPhone,message:expect.stringContaining("প্রিয় গ্রাহক")});
    expect(buildOrderStatusNotification({...context,customerName:"",customerEmail:null,customerPhone:null})).toMatchObject({channel:"log",to:null,message:expect.stringContaining("Hi there")});
  });
  it("formats a supplied catalog locally and falls back safely on incomplete/invalid messages",()=>{
    const catalog=JSON.parse(JSON.stringify(english));catalog.Notifications.subject="Commande {orderNumber}: {statusLabel}";
    expect(buildOrderStatusNotification({...context,locale:"fr",catalog}).subject).toBe(`Commande ${context.orderNumber}: Pending`);
    expect(buildOrderStatusNotification({...context,locale:"bn",catalog:{Notifications:{}}}).subject).toBe(`অর্ডার ${context.orderNumber}: অপেক্ষমাণ`);
    catalog.Notifications.subject="Order {missing}";
    expect(buildOrderStatusNotification({...context,locale:"fr",catalog}).subject).toBe(`Order ${context.orderNumber}: Pending`);
  });
  it("validates all thirteen statuses and whole-message ICU placeholders",()=>{expect(Object.keys(bengali.Notifications.statuses)).toHaveLength(13);expect(()=>validateCatalog(english,bengali)).not.toThrow();});
  it("uses only the existing best-effort log sink and no network translation/delivery calls",async()=>{
    const network=vi.fn();vi.stubGlobal("fetch",network);const sink=vi.spyOn(console,"info").mockImplementation(()=>{});
    try{const result=await notifyOrderStatusChange({...context,locale:"bn"});expect(result.subject).toContain("অর্ডার");expect(network).not.toHaveBeenCalled();expect(sink).toHaveBeenCalledOnce();}
    finally{sink.mockRestore();vi.unstubAllGlobals();}
  });
});
