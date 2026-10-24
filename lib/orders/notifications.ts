/**
 * Order status-change notifications.
 *
 * This project ships no server-side email/SMS provider, so this module
 * is the single, pluggable trigger point: `buildOrderStatusNotification`
 * is a pure function (easily unit-tested and reusable), and
 * `notifyOrderStatusChange` performs best-effort delivery. The default
 * sink logs a structured record server-side — swap it for a real
 * provider (Resend / SES / Twilio …) without touching call sites.
 *
 * Framework-free on purpose (no `server-only`, no Prisma) so the pure
 * builder can be imported from tests and any runtime.
 */

import { ORDER_STATUS_META, type OrderStatus } from "./status";
import { createTranslator } from "next-intl";
import english from "@/messages/notifications-en.json";
import bengali from "@/messages/notifications-bn.json";
import { normalizeLocale } from "@/lib/i18n/registry";

export type NotificationChannel = "email" | "sms" | "log";

export type OrderStatusNotification = {
  channel: NotificationChannel;
  to: string | null;
  subject: string;
  message: string;
};

export type OrderNotificationContext = {
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Explicit order/account language only. Never inferred from a recipient's country. */
  locale?: string;
  /** Validated imported catalog; formatting occurs locally, without provider calls. */
  catalog?: Record<string, unknown>;
};

type NotificationMessages={Notifications:{subject:string;message:string;guestName:string;statuses:Record<OrderStatus,{label:string;description:string}>}};

function completeCatalog(catalog:unknown):catalog is NotificationMessages{
  if(!catalog||typeof catalog!=="object")return false;
  const messages=(catalog as Record<string,unknown>).Notifications;
  if(!messages||typeof messages!=="object")return false;
  const row=messages as Record<string,unknown>;
  if(["subject","message","guestName"].some(key=>typeof row[key]!=="string"||!(row[key] as string).trim()))return false;
  const statuses=row.statuses;if(!statuses||typeof statuses!=="object")return false;
  return Object.keys(ORDER_STATUS_META).every(status=>{
    const entry=(statuses as Record<string,unknown>)[status];if(!entry||typeof entry!=="object")return false;
    return ["label","description"].every(key=>typeof (entry as Record<string,unknown>)[key]==="string"&&((entry as Record<string,unknown>)[key] as string).trim());
  });
}

function localizedText(ctx:OrderNotificationContext):{subject:string;message:string}{
  const locale=normalizeLocale(ctx.locale)??"en";
  const bundled=locale==="bn"?bengali:english;
  const catalog=completeCatalog(ctx.catalog)?ctx.catalog:bundled;
  let invalid=false;
  const translate=createTranslator({locale,messages:catalog,namespace:"Notifications",onError:()=>{invalid=true;}});
  const statusLabel=translate(`statuses.${ctx.status}.label`);
  const statusDescription=translate(`statuses.${ctx.status}.description`);
  const values={orderNumber:ctx.orderNumber,statusLabel,statusDescription,customerName:ctx.customerName?.trim()||translate("guestName")};
  const subject=translate("subject",values);const message=translate("message",values);
  if(!invalid)return {subject,message};
  // Invalid custom catalogs never leak raw keys or undefined values to recipients.
  const fallback=createTranslator({locale:locale==="bn"?"bn":"en",messages:bundled,namespace:"Notifications"});
  const fallbackValues={...values,statusLabel:fallback(`statuses.${ctx.status}.label`),statusDescription:fallback(`statuses.${ctx.status}.description`),customerName:ctx.customerName?.trim()||fallback("guestName")};
  return {subject:fallback("subject",fallbackValues),message:fallback("message",fallbackValues)};
}

/**
 * Build the customer-facing message for a status change. Pure: no I/O,
 * so it can be asserted directly in unit tests.
 *
 * Channel selection prefers email, then SMS, then a server-log fallback
 * when the order carries no contact details.
 */
export function buildOrderStatusNotification(
  ctx: OrderNotificationContext,
): OrderStatusNotification {
  const {subject,message}=localizedText(ctx);

  const channel: NotificationChannel = ctx.customerEmail
    ? "email"
    : ctx.customerPhone
      ? "sms"
      : "log";
  const to = ctx.customerEmail ?? ctx.customerPhone ?? null;

  return { channel, to, subject, message };
}

/**
 * Fire a status-change notification. Best-effort: never throws, so a
 * delivery hiccup can't roll back or block an order status update (the
 * durable record always lives in `OrderStatusHistory`).
 */
export async function notifyOrderStatusChange(
  ctx: OrderNotificationContext,
): Promise<OrderStatusNotification> {
  const notification = buildOrderStatusNotification(ctx);
  try {
    // Default sink: structured server log. Replace with a real provider
    // dispatch here when one is configured.
    console.info(
      "[order-notification]",
      JSON.stringify({
        channel: notification.channel,
        to: notification.to,
        subject: notification.subject,
      }),
    );
  } catch {
    // Swallow — notifications must never break the status update.
  }
  return notification;
}
