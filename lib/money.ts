import type { Prisma } from "@/app/generated/prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

/**
 * Decimal-safe money helpers.
 *
 * Money columns are PostgreSQL `DECIMAL`, which Prisma surfaces as
 * `Prisma.Decimal` (decimal.js). Doing arithmetic with JavaScript
 * numbers reintroduces float drift (0.1 + 0.2 !== 0.3), so all money
 * math should flow through these helpers:
 *
 *   - read DB values with `toNumber` only at the JSON boundary;
 *   - do additions/multiplications with `sum` / `multiply` (exact);
 *   - round to 2 dp with `round2` (HALF_UP, the банковское-friendly
 *     rounding shoppers expect) before persisting or displaying.
 *
 * Persisting back to a Decimal column accepts a `number`, `string`, or
 * `Prisma.Decimal`; we pass rounded numbers which Prisma converts
 * losslessly at 2 dp.
 */

export type DecimalInput = Prisma.Decimal | number | string | null | undefined;

/** Coerce any money-ish value into an exact Decimal (null/undefined -> 0). */
export function toDecimal(value: DecimalInput): Prisma.Decimal {
  if (value == null) return new Decimal(0);
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Read a Decimal (or number) out as a plain number for JSON responses. */
export function toNumber(value: DecimalInput): number {
  return toDecimal(value).toNumber();
}

/** Round to 2 decimal places (HALF_UP) and return a number. */
export function round2(value: DecimalInput): number {
  return toDecimal(value)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/** Exact sum of a list of money-ish values; returns a Decimal. */
export function sumDecimals(values: DecimalInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, value) => acc.plus(toDecimal(value)),
    new Decimal(0),
  );
}

/** Exact multiplication, e.g. unitPrice * quantity. */
export function multiply(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  return toDecimal(a).times(toDecimal(b));
}

/** Exact subtraction, clamped at zero (money can't go negative here). */
export function subtractClamped(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  const result = toDecimal(a).minus(toDecimal(b));
  return result.isNegative() ? new Decimal(0) : result;
}

/** `value` percent of `base`, e.g. percentOf(subtotal, 10) -> 10% of subtotal. */
export function percentOf(base: DecimalInput, percent: DecimalInput): Prisma.Decimal {
  return toDecimal(base).times(toDecimal(percent)).dividedBy(100);
}

/** Min of two money-ish values as a Decimal. */
export function minDecimal(a: DecimalInput, b: DecimalInput): Prisma.Decimal {
  const da = toDecimal(a);
  const db = toDecimal(b);
  return da.lessThan(db) ? da : db;
}

/** True when `a` < `b`. */
export function lessThan(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).lessThan(toDecimal(b));
}

/** True when `a` >= `b`. */
export function greaterThanOrEqual(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).greaterThanOrEqualTo(toDecimal(b));
}
