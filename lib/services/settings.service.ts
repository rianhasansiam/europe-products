import "server-only";

import type { Prisma } from "@/app/generated/prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { BASE_CURRENCY } from "@/lib/currency/config";
import { toNumber } from "@/lib/money";
import { ServiceError } from "@/lib/services/service-error";
import type {
  CreatePromoCodeInput,
  UpdatePromoCodeInput,
  UpdateStoreSettingsInput,
} from "@/lib/validations/settings.validation";

/**
 * Single home for store settings + promo code DB logic.
 *
 * Store settings is a singleton: the service auto-provisions the row
 * with sensible defaults the first time someone reads it, so the
 * admin form always has something to bind against. Promo codes are a
 * normal CRUD list with case-insensitive `code` lookups so customers
 * can type "sextoy10" or "SEXTOY10" and both work.
 */

export class SettingsError extends ServiceError {
  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(status, message, details);
    this.name = "SettingsError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Selects                                                                   */
/* -------------------------------------------------------------------------- */

const settingsSelect = {
  id: true,
  taxRate: true,
  standardShippingFee: true,
  expressShippingFee: true,
  freeShippingThreshold: true,
  currency: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StoreSettingsSelect;

const promoSelect = {
  id: true,
  code: true,
  description: true,
  discountType: true,
  value: true,
  minOrder: true,
  maxDiscount: true,
  startsAt: true,
  endsAt: true,
  usageLimit: true,
  usedCount: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PromoCodeSelect;

export type StoreSettingsRow = {
  id: string;
  taxRate: number;
  standardShippingFee: number;
  expressShippingFee: number;
  freeShippingThreshold: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};
export type PromoCodeRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: Prisma.PromoCodeGetPayload<{
    select: { discountType: true };
  }>["discountType"];
  value: number;
  minOrder: number | null;
  maxDiscount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  status: Prisma.PromoCodeGetPayload<{ select: { status: true } }>["status"];
  createdAt: Date;
  updatedAt: Date;
};

/** Convert a raw settings row (Decimal money fields) into a number-shaped row. */
function serializeSettings(row: {
  id: string;
  taxRate: Prisma.Decimal;
  standardShippingFee: Prisma.Decimal;
  expressShippingFee: Prisma.Decimal;
  freeShippingThreshold: Prisma.Decimal;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}): StoreSettingsRow {
  return {
    id: row.id,
    taxRate: toNumber(row.taxRate),
    standardShippingFee: toNumber(row.standardShippingFee),
    expressShippingFee: toNumber(row.expressShippingFee),
    freeShippingThreshold: toNumber(row.freeShippingThreshold),
    currency: BASE_CURRENCY,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Convert a raw promo row (Decimal money fields) into a number-shaped row. */
function serializePromo(row: {
  id: string;
  code: string;
  description: string | null;
  discountType: PromoCodeRow["discountType"];
  value: Prisma.Decimal;
  minOrder: Prisma.Decimal | null;
  maxDiscount: Prisma.Decimal | null;
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  status: PromoCodeRow["status"];
  createdAt: Date;
  updatedAt: Date;
}): PromoCodeRow {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.discountType,
    value: toNumber(row.value),
    minOrder: row.minOrder == null ? null : toNumber(row.minOrder),
    maxDiscount: row.maxDiscount == null ? null : toNumber(row.maxDiscount),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    usageLimit: row.usageLimit,
    usedCount: row.usedCount,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/* -------------------------------------------------------------------------- */
/*  Store settings                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Read or create the singleton settings row.
 *
 * We pick the oldest row (`createdAt asc`) so concurrent first-time
 * reads can't end up with two singletons — the loser of the race
 * still finds the winner's row on its retry.
 */
export async function getStoreSettings(): Promise<StoreSettingsRow> {
  const existing = await prisma.storeSettings.findFirst({
    orderBy: { createdAt: "asc" },
    select: settingsSelect,
  });
  if (existing) return serializeSettings(existing);

  const created = await prisma.storeSettings.create({
    data: {},
    select: settingsSelect,
  });
  return serializeSettings(created);
}

/**
 * Cache layer over the singleton read. Tagged `store-settings` so any
 * admin update can bust both the admin panel and the storefront cart
 * pricing in one shot.
 */
const getCachedStoreSettings = unstable_cache(
  () => getStoreSettings(),
  ["store-settings-usd-no-review"],
  { revalidate: 600, tags: ["store-settings"] },
);

export function getStoreSettingsCached() {
  return getCachedStoreSettings();
}

export async function updateStoreSettings(input: UpdateStoreSettingsInput) {
  const current = await getStoreSettings();

  const data: Prisma.StoreSettingsUpdateInput = {};
  if (input.taxRate !== undefined) data.taxRate = input.taxRate;
  if (input.standardShippingFee !== undefined) {
    data.standardShippingFee = input.standardShippingFee;
  }
  if (input.expressShippingFee !== undefined) {
    data.expressShippingFee = input.expressShippingFee;
  }
  if (input.freeShippingThreshold !== undefined) {
    data.freeShippingThreshold = input.freeShippingThreshold;
  }
  if (input.currency !== undefined) data.currency = BASE_CURRENCY;
  return prisma.storeSettings.update({
    where: { id: current.id },
    data,
    select: settingsSelect,
  }).then(serializeSettings);
}

/* -------------------------------------------------------------------------- */
/*  Promo codes                                                               */
/* -------------------------------------------------------------------------- */

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function normalizeDate(value: string | null | undefined): Date | null {
  if (value === undefined) return null;
  if (value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function listPromoCodes(): Promise<PromoCodeRow[]> {
  const rows = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    select: promoSelect,
  });
  return rows.map(serializePromo);
}

const getCachedPromoCodes = unstable_cache(
  () => listPromoCodes(),
  ["promo-codes-list"],
  { revalidate: 300, tags: ["promo-codes"] },
);

export function listPromoCodesCached() {
  return getCachedPromoCodes();
}

/**
 * Customer-facing lookup. Filters out expired/inactive entries so the
 * cart never has to second-guess what came back. Returns `null` when
 * no usable code matches.
 */
export async function findActivePromoCode(
  rawCode: string,
): Promise<PromoCodeRow | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;

  const now = new Date();
  const row = await prisma.promoCode.findFirst({
    where: {
      code,
      status: "ACTIVE",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    select: promoSelect,
  });
  return row == null ? null : serializePromo(row);
}

export async function createPromoCode(input: CreatePromoCodeInput) {
  const data: Prisma.PromoCodeCreateInput = {
    code: normalizeCode(input.code),
    description: input.description ?? null,
    discountType: input.discountType,
    value: input.value,
    minOrder: input.minOrder ?? null,
    maxDiscount: input.maxDiscount ?? null,
    startsAt: normalizeDate(input.startsAt),
    endsAt: normalizeDate(input.endsAt),
    usageLimit: input.usageLimit ?? null,
    status: input.status,
  };

  try {
    const row = await prisma.promoCode.create({
      data,
      select: promoSelect,
    });
    return serializePromo(row);
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new SettingsError(409, "A promo code with that name already exists.");
    }
    throw error;
  }
}

export async function updatePromoCode(
  id: string,
  input: UpdatePromoCodeInput,
) {
  const existing = await prisma.promoCode.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new SettingsError(404, "Promo code not found.");
  }

  const data: Prisma.PromoCodeUpdateInput = {};
  if (input.code !== undefined) data.code = normalizeCode(input.code);
  if (input.description !== undefined) data.description = input.description;
  if (input.discountType !== undefined) data.discountType = input.discountType;
  if (input.value !== undefined) data.value = input.value;
  if (input.minOrder !== undefined) data.minOrder = input.minOrder;
  if (input.maxDiscount !== undefined) data.maxDiscount = input.maxDiscount;
  if (input.startsAt !== undefined) {
    data.startsAt = normalizeDate(input.startsAt);
  }
  if (input.endsAt !== undefined) data.endsAt = normalizeDate(input.endsAt);
  if (input.usageLimit !== undefined) data.usageLimit = input.usageLimit;
  if (input.status !== undefined) data.status = input.status;

  try {
    const row = await prisma.promoCode.update({
      where: { id },
      data,
      select: promoSelect,
    });
    return serializePromo(row);
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        throw new SettingsError(404, "Promo code not found.");
      }
      if (error.code === "P2002") {
        throw new SettingsError(
          409,
          "A promo code with that name already exists.",
        );
      }
    }
    throw error;
  }
}

export async function deletePromoCode(id: string) {
  try {
    const row = await prisma.promoCode.delete({
      where: { id },
      select: promoSelect,
    });
    return serializePromo(row);
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new SettingsError(404, "Promo code not found.");
    }
    throw error;
  }
}
