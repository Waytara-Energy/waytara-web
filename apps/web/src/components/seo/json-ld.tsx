import type { JsonLdObject } from "@/lib/seo";

/** Renders one or more schema.org JSON-LD blocks. `<` is escaped so content
 *  containing "</script>" can never break out of the tag (standard XSS-safe
 *  JSON-LD serialisation). Server component: ships no JavaScript. */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
