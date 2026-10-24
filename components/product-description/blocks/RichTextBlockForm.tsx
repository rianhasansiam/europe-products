"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import type { JSONContent } from "@tiptap/core";
import type { RichTextBlock } from "@/lib/types/product-description-blocks";
import RichTextEditor from "@/components/product-description/RichTextEditor";
import BlockCommonControls from "@/components/product-description/BlockCommonControls";

type Props = {
  block: RichTextBlock;
  onChange: (updated: RichTextBlock) => void;
  disabled?: boolean;
};

export default function RichTextBlockForm({ block, onChange, disabled }: Props) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionBlocksRichTextBlockForm");
  const patch = (fields: Partial<RichTextBlock>) =>
    onChange({ ...block, ...fields });

  return (
    <div>
      <RichTextEditor
        value={block.content as JSONContent}
        onChange={(content) => patch({ content })}
        placeholder={i18n("Type your content here…")}
        disabled={disabled}
      />
      <BlockCommonControls
        block={block}
        onChange={(fields) => patch(fields)}
        disabled={disabled}
      />
    </div>
  );
}
