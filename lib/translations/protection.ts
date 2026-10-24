// Unit equivalence is explicit. Adding a translated spelling must never make
// different dimensions (for example volts and watts) interchangeable.
const unitAliases:Record<string,string>={
  V:"V",volt:"V",volts:"V","ভোল্ট":"V","ভোল্টের":"V",
  Hz:"Hz",hertz:"Hz","হার্টজ":"Hz",
  W:"W",watt:"W",watts:"W","ওয়াট":"W","ওয়াট":"W",
  kW:"kW",kilowatt:"kW",kilowatts:"kW","কিলোওয়াট":"kW","কিলোওয়াট":"kW",
  mm:"mm",millimeter:"mm",millimeters:"mm",millimetre:"mm",millimetres:"mm","মিলিমিটার":"mm","মিলিমিটারের":"mm",
  cm:"cm",centimeter:"cm",centimeters:"cm",centimetre:"cm",centimetres:"cm","সেন্টিমিটার":"cm","সেন্টিমিটারের":"cm",
  km:"km",kilometer:"km",kilometers:"km",kilometre:"km",kilometres:"km","kilomètre":"km","kilomètres":"km","কিলোমিটার":"km","কিলোমিটারে":"km","কিলোমিটারের":"km",
  kg:"kg",kilogram:"kg",kilograms:"kg","কিলোগ্রাম":"kg","কিলোগ্রামের":"kg",
  A:"A",ampere:"A",amperes:"A","অ্যাম্পিয়ার":"A","অ্যাম্পিয়ার":"A",
};
const units=Object.keys(unitAliases).sort((a,b)=>b.length-a.length).join("|");
const numericToken=`\\p{Decimal_Number}+(?:[.,]\\p{Decimal_Number}+)*(?:\\s*(?:${units})(?![\\p{L}]))?`;
const numericParts=new RegExp(`^(\\p{Decimal_Number}+(?:[.,]\\p{Decimal_Number}+)*)(?:\\s*(${units}))?$`,"u");

/** Mask explicit terms, URLs, identifiers, and interpolation tokens before provider calls. */
export function protectText(text: string, terms: string[] = []): { text: string; protectedValues:string[]; restore: (translated: string) => string } {
  const values: string[] = [];
  const escaped = terms.filter(Boolean).sort((a,b) => b.length-a.length).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(["https?:\\/\\/[^\\s<>]*", "[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\\.[A-Za-z]{2,}", "\\{[^{}]+\\}", ...escaped, "\\b(?=[A-Z0-9/_-]*[A-Z])(?=[A-Z0-9/_-]*[0-9])[A-Z0-9]+(?:[-_/][A-Z0-9]+)+\\b", numericToken].join("|"), "gu");
  const masked = text.replace(pattern, value => {
    const suffix = /^https?:\/\//.test(value) ? value.match(/[),.!?;:]+$/)?.[0] ?? "" : "";
    const marker = `ZXQPROTECTED${values.length}QXZ`; values.push(suffix ? value.slice(0, -suffix.length) : value); return marker + suffix;
  });
  return { text: masked, protectedValues:values, restore(translated) {
    for (let i=0;i<values.length;i++) {
      const marker = `ZXQPROTECTED${i}QXZ`;
      if (translated.split(marker).length !== 2) throw new Error("Provider changed a protected term or placeholder.");
      translated = translated.replace(marker, values[i]);
    }
    if (/ZXQPROTECTED\d+QXZ/.test(translated)) throw new Error("Unknown protected placeholder.");
    return translated;
  } };
}

/** Localized digit glyphs may change, but data values and protected terms may not. */
export function assertProtectedText(source: string, translated: string, terms: string[] = []): void {
  const normalize = (value: string) => {
    if (terms.includes(value)) return `term:${value}`;
    const parts=value.match(numericParts);
    if (!parts) return `text:${value}`;
    const number = parts[1];
    return "number:" + number.replace(/\p{Decimal_Number}/gu, digit => {
      const point = digit.codePointAt(0)!;
      let first = point;
      while (first > 0 && /\p{Decimal_Number}/u.test(String.fromCodePoint(first - 1))) first--;
      return String((point - first) % 10);
    })+`:${parts[2]?unitAliases[parts[2]]:""}`;
  };
  const original = protectText(source, terms).protectedValues.map(normalize).sort();
  const target = protectText(translated, terms).protectedValues.map(normalize).sort();
  if (JSON.stringify(original) !== JSON.stringify(target)) throw new Error("Translation must preserve brands, numeric values, URLs, email addresses, identifiers, and variables.");
}
