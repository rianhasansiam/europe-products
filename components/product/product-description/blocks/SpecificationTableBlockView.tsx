
import { useInterfaceTranslations } from "@/components/i18n/translate";
import type { SpecificationTableBlock } from "@/lib/types/product-description-blocks";

export default function SpecificationTableBlockView({
  block,
}: {
  block: SpecificationTableBlock;
}) {
  const i18n = useInterfaceTranslations("InterfaceProductProductDescriptionBlocksSpecificationTableBlockView");
  const visibleRows = block.rows.filter(
    (row) => row.label.trim() && row.value.trim(),
  );
  if (visibleRows.length === 0) return null;

  return (
    <section
      className="min-w-0"
      aria-labelledby={
        block.heading?.trim() ? `st-${block.id}` : undefined
      }
    >
      {block.heading?.trim() && (
        <h2
          id={`st-${block.id}`}
          className="mb-4 text-xl font-bold text-foreground [overflow-wrap:anywhere]"
        >
          {block.heading}
        </h2>
      )}
      <div className="max-w-full overflow-x-auto rounded-2xl border border-border">
        <table className="w-full border-collapse text-start text-sm">
          <caption className="sr-only">
            {block.heading?.trim() ?? i18n("Specification table")}
          </caption>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row) => (
              <tr key={row.id} className="even:bg-background">
                <th
                  scope="row"
                  className="w-2/5 px-4 py-3 align-top font-semibold text-foreground [overflow-wrap:anywhere] sm:px-5"
                >
                  {i18n(row.label)}
                </th>
                <td className="px-4 py-3 text-body [overflow-wrap:anywhere] sm:px-5">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
