"use client";
import { useInterfaceTranslations } from "@/components/i18n/translate";


import {
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  MoreHorizontal,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { cn } from "@/lib/utils";

type BlockActionsProps = {
  /** Whether the block is currently visible on the public page. */
  isVisible: boolean;
  /** Whether the "move up" action is available. */
  canMoveUp: boolean;
  /** Whether the "move down" action is available. */
  canMoveDown: boolean;
  /** Drag handle props from dnd-kit. */
  dragHandleListeners?: Record<string, unknown>;
  dragHandleAttributes?: Record<string, unknown>;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
};

/**
 * Compact action bar shown on each sortable block.
 * Contains a drag handle and a kebab-menu with all block-level actions.
 */
export default function BlockActions({
  isVisible,
  canMoveUp,
  canMoveDown,
  dragHandleListeners,
  dragHandleAttributes,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onToggleVisibility,
  onDelete,
}: BlockActionsProps) {
  const i18n = useInterfaceTranslations("InterfaceProductDescriptionBlockActions");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const action = (fn: () => void) => {
    fn();
    setMenuOpen(false);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Drag handle */}
      <button
        type="button"
        {...(dragHandleListeners as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...(dragHandleAttributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        aria-label={i18n("Drag to reorder block")}
        className="cursor-grab touch-none rounded p-1 text-gray-400 hover:text-gray-700 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Visibility badge */}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
          isVisible
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-100 text-gray-500",
        )}
      >
        {isVisible ? i18n("Visible") : i18n("Hidden")}
      </span>

      {/* Kebab menu */}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={i18n("Block actions")}
          aria-expanded={menuOpen}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute end-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-brand-border bg-white shadow-lg">
            <button
              type="button"
              onClick={() => action(onMoveUp)}
              disabled={!canMoveUp}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronUp className="h-4 w-4" />
              {i18n("Move up")}</button>
            <button
              type="button"
              onClick={() => action(onMoveDown)}
              disabled={!canMoveDown}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronDown className="h-4 w-4" />
              {i18n("Move down")}</button>
            <div className="my-1 h-px bg-gray-100" />
            <button
              type="button"
              onClick={() => action(onDuplicate)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Copy className="h-4 w-4" />
              {i18n("Duplicate")}</button>
            <button
              type="button"
              onClick={() => action(onToggleVisibility)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {isVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {isVisible ? i18n("Hide block") : i18n("Show block")}
            </button>
            <div className="my-1 h-px bg-gray-100" />
            <button
              type="button"
              onClick={() => action(onDelete)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              {i18n("Delete block")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
