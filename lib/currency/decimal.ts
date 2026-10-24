import type { DecimalInput } from "@/lib/money";

export type CurrencyDecimalInput = DecimalInput;

type ParsedDecimal = {
  coefficient: bigint;
  scale: number;
};

const MAX_DECIMAL_INPUT_LENGTH = 256;
const MAX_ABSOLUTE_EXPONENT = 1_000;
const ZERO = BigInt(0);
const TWO = BigInt(2);

function powerOfTen(exponent: number): bigint {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new RangeError("Decimal scale must be a non-negative integer");
  }

  return BigInt(`1${"0".repeat(exponent)}`);
}

function inputToString(value: CurrencyDecimalInput): string {
  if (value == null) return "0";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Decimal value must be finite");
    }
    return value.toString();
  }
  if (typeof value === "string") return value.trim();

  try {
    return value.toString().trim();
  } catch {
    throw new TypeError("Decimal value must be serializable");
  }
}

function parseDecimal(value: CurrencyDecimalInput): ParsedDecimal {
  const raw = inputToString(value);
  if (!raw || raw.length > MAX_DECIMAL_INPUT_LENGTH) {
    throw new TypeError("Decimal value is empty or too long");
  }

  const match = raw.match(
    /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/,
  );
  if (!match) throw new TypeError("Decimal value is malformed");

  const [, sign, integerPart = "0", regularFraction, leadingFraction, rawExponent] =
    match;
  const fractionPart = regularFraction ?? leadingFraction ?? "";
  const exponent = rawExponent == null ? 0 : Number(rawExponent);
  if (
    !Number.isSafeInteger(exponent) ||
    Math.abs(exponent) > MAX_ABSOLUTE_EXPONENT
  ) {
    throw new RangeError("Decimal exponent is outside the supported range");
  }

  let coefficient = BigInt(`${integerPart}${fractionPart}`);
  if (sign === "-" && coefficient !== ZERO) coefficient = -coefficient;

  let scale = fractionPart.length - exponent;
  if (scale < 0) {
    coefficient *= powerOfTen(-scale);
    scale = 0;
  }

  return { coefficient, scale };
}

function parsedDecimalToString({ coefficient, scale }: ParsedDecimal): string {
  if (coefficient === ZERO) return "0";

  const negative = coefficient < ZERO;
  const absoluteDigits = (negative ? -coefficient : coefficient).toString();
  if (scale === 0) return `${negative ? "-" : ""}${absoluteDigits}`;

  const padded = absoluteDigits.padStart(scale + 1, "0");
  const integerPart = padded.slice(0, -scale);
  const fractionPart = padded.slice(-scale).replace(/0+$/, "");
  const unsigned = fractionPart
    ? `${integerPart}.${fractionPart}`
    : integerPart;
  return negative ? `-${unsigned}` : unsigned;
}

function minorUnitsToNumber(
  minorUnits: bigint,
  decimalPlaces: number,
): number {
  const negative = minorUnits < ZERO;
  const absoluteDigits = (negative ? -minorUnits : minorUnits)
    .toString()
    .padStart(decimalPlaces + 1, "0");
  const unsigned =
    decimalPlaces === 0
      ? absoluteDigits
      : `${absoluteDigits.slice(0, -decimalPlaces)}.${absoluteDigits.slice(-decimalPlaces)}`;
  const result = Number(negative ? `-${unsigned}` : unsigned);

  if (!Number.isFinite(result)) {
    throw new RangeError("Decimal result is outside the finite number range");
  }
  return result;
}

function roundParsedDecimal(
  { coefficient, scale }: ParsedDecimal,
  decimalPlaces: number,
): number {
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new RangeError("Decimal places must be a non-negative integer");
  }

  const negative = coefficient < ZERO;
  const absoluteCoefficient = negative ? -coefficient : coefficient;
  let roundedMinorUnits: bigint;

  if (scale <= decimalPlaces) {
    roundedMinorUnits =
      absoluteCoefficient * powerOfTen(decimalPlaces - scale);
  } else {
    const divisor = powerOfTen(scale - decimalPlaces);
    roundedMinorUnits = absoluteCoefficient / divisor;
    const remainder = absoluteCoefficient % divisor;
    if (remainder * TWO >= divisor) roundedMinorUnits += BigInt(1);
  }

  return minorUnitsToNumber(
    negative ? -roundedMinorUnits : roundedMinorUnits,
    decimalPlaces,
  );
}

/** Canonical non-exponent decimal string, preserving the exact input value. */
export function normalizeDecimalInput(value: CurrencyDecimalInput): string {
  return parsedDecimalToString(parseDecimal(value));
}

/** Decimal-safe ROUND_HALF_UP to a finite JavaScript number boundary. */
export function roundDecimalHalfUp(
  value: CurrencyDecimalInput,
  decimalPlaces: number,
): number {
  return roundParsedDecimal(parseDecimal(value), decimalPlaces);
}

/** Convert a decimal-like display value to the finite number Intl requires. */
export function decimalInputToFiniteNumber(
  value: CurrencyDecimalInput,
): number {
  const result = Number(normalizeDecimalInput(value));
  if (!Number.isFinite(result)) {
    throw new RangeError("Decimal value is outside the finite number range");
  }
  return result;
}
