"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import { useCallback, useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/core";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  Type,
} from "lucide-react";

import { cn } from "@/lib/utils";

/** The shared set of Tiptap extensions — identical for editor and renderer. */
export function buildTiptapExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      hardBreak: false,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      // Only allow safe protocols on links
      protocols: ["https", "http"],
    }),
    Placeholder.configure({
      placeholder: placeholder ?? "Start typing your content…",
    }),
  ];
}

type ToolbarButtonProps = {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionRichTextEditor");
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent editor from losing focus on toolbar click
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={i18n(title)}
      aria-label={i18n(title)}
      aria-pressed={isActive}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm transition",
        isActive
          ? "bg-brand-red text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-gray-200" />;
}

type RichTextEditorProps = {
  /** Current Tiptap JSON content. */
  value: JSONContent;
  /** Called whenever content changes. Emits Tiptap JSON (never raw HTML). */
  onChange: (content: JSONContent) => void;
  /** Placeholder text when the editor is empty. */
  placeholder?: string;
  /** Disable all interactions (e.g. while form is submitting). */
  disabled?: boolean;
  className?: string;
};

/**
 * Reusable Tiptap rich-text editor.
 *
 * - Uses `immediatelyRender: false` to avoid SSR/hydration mismatches.
 * - Stores and emits Tiptap JSON — never raw HTML.
 * - Toolbar shows active formatting states.
 * - Supports keyboard shortcuts (Mod+B, Mod+I, etc.).
 * - Handles links safely (only http/https allowed via extension config).
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: RichTextEditorProps) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionRichTextEditor");
  const extensions = useMemo(
    () => buildTiptapExtensions(placeholder),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    editable: !disabled,
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(e.getJSON());
    },
  });

  // Sync editable state when disabled prop changes.
  useEffect(() => {
    if (editor && editor.isEditable === !!disabled) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Sync content when value prop changes from outside WITHOUT triggering onUpdate loop.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // Only run when value changes externally (not on every editor update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (https://…):", previousUrl ?? "");
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    // Only allow safe protocols
    if (/^(javascript|data|vbscript):/i.test(url)) return;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-brand-border bg-white",
        disabled && "opacity-70",
        className,
      )}
    >
      {/* Formatting toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-brand-border bg-gray-50 px-2 py-1.5">
        {/* Paragraph / headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive("paragraph")}
          disabled={disabled}
          title={i18n("Paragraph")}
        >
          <Type className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          disabled={disabled}
          title={i18n("Heading 1")}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          disabled={disabled}
          title={i18n("Heading 2")}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          disabled={disabled}
          title={i18n("Heading 3")}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Inline marks */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
          title={i18n("Bold (Ctrl+B)")}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
          title={i18n("Italic (Ctrl+I)")}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={addLink}
          isActive={editor.isActive("link")}
          disabled={disabled}
          title={i18n("Insert / Edit Link")}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          disabled={disabled}
          title={i18n("Bullet List")}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          disabled={disabled}
          title={i18n("Numbered List")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Text alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          disabled={disabled}
          title={i18n("Align Left")}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          disabled={disabled}
          title={i18n("Align Center")}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          disabled={disabled}
          title={i18n("Align Right")}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          isActive={editor.isActive({ textAlign: "justify" })}
          disabled={disabled}
          title={i18n("Justify")}
        >
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor content area */}
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm max-w-none px-4 py-3",
          "[&_.ProseMirror]:min-h-32",
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
        )}
      />
    </div>
  );
}
