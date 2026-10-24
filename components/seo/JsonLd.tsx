import type { JsonLd as JsonLdData } from "@/lib/seo/json-ld";

/**
 * Renders one or more JSON-LD objects as a `<script type="application/ld+json">`.
 *
 * This is a server component (no "use client"), so the structured data is
 * part of the initial server-rendered HTML and crawlable without JS.
 *
 * Security: JSON-LD must be embedded as raw JSON. We escape the `<`
 * character to `\u003c` so a malicious string value can never break out
 * of the script tag (e.g. a product name containing "</script>").
 */
export default function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  const payload = Array.isArray(data) ? data : [data];

  return (
    <>
      {payload.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(item).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
