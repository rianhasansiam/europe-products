import type { JSONContent } from "@tiptap/core";

/**
 * Base properties shared by every description block.
 */
export type BaseBlock = {
  /** Stable unique identifier generated with crypto.randomUUID(). */
  id: string;
  /** Discriminant field for the union. */
  type: string;
  /** When false the block is hidden on the public page but preserved in the data. */
  isVisible: boolean;
  /** Vertical space above/below the block. */
  spacing?: "small" | "medium" | "large";
  /** Whether the block stretches edge-to-edge or stays within the content column. */
  containerStyle?: "contained" | "fullWidth";
};

/** A rich-text block whose content is stored as Tiptap JSON (never raw HTML). */
export type RichTextBlock = BaseBlock & {
  type: "richText";
  content: JSONContent;
};

/** A single feature item inside a FeatureGridBlock. */
export type FeatureGridItem = {
  /** Stable unique identifier. */
  id: string;
  /** Feature title (required). */
  title: string;
  /** Optional supporting text. */
  description?: string;
  /**
   * Lucide icon name string (e.g. "Zap", "Shield").
   * Only names from the approved list are accepted.
   */
  icon?: string;
};

/** A grid of feature items with an optional heading. */
export type FeatureGridBlock = BaseBlock & {
  type: "featureGrid";
  /** Optional section heading rendered above the grid. */
  heading?: string;
  /** Number of columns in the grid. */
  columns: 2 | 3 | 4;
  /** Feature items to display. */
  items: FeatureGridItem[];
};

/** A side-by-side image + text block. */
export type ImageTextBlock = BaseBlock & {
  type: "imageText";
  /** Optional headline. */
  heading?: string;
  /** Optional body text. */
  description?: string;
  /** Hosted image URL (never a base64 blob). */
  imageUrl: string;
  /** Required, descriptive alt text. */
  imageAlt: string;
  /** Whether the image appears to the left or right of the text. */
  imagePosition: "left" | "right";
  /** Optional call-to-action button label. */
  ctaLabel?: string;
  /** Optional call-to-action URL (http/https or root-relative). */
  ctaUrl?: string;
};

/** A single row in a SpecificationTableBlock. */
export type SpecificationTableRow = {
  /** Stable unique identifier. */
  id: string;
  /** Row label, e.g. "Voltage". */
  label: string;
  /** Row value, e.g. "220 V". */
  value: string;
};

/** A tabular list of specification rows with an optional heading. */
export type SpecificationTableBlock = BaseBlock & {
  type: "specificationTable";
  /** Optional section heading. */
  heading?: string;
  /** Specification rows. */
  rows: SpecificationTableRow[];
};

/** All supported block types as a discriminated union. */
export type ProductDescriptionBlock =
  | RichTextBlock
  | FeatureGridBlock
  | ImageTextBlock
  | SpecificationTableBlock;

/** Union of all supported block `type` literals. */
export type ProductDescriptionBlockType = ProductDescriptionBlock["type"];

export const PRODUCT_DESCRIPTION_BLOCK_TYPES: readonly ProductDescriptionBlockType[] =
  ["richText", "featureGrid", "imageText", "specificationTable"] as const;

export const BLOCK_SPACING_VALUES = ["small", "medium", "large"] as const;
export const BLOCK_CONTAINER_VALUES = ["contained", "fullWidth"] as const;
export const FEATURE_GRID_COLUMN_VALUES = [2, 3, 4] as const;
export const IMAGE_POSITION_VALUES = ["left", "right"] as const;

/**
 * The full approved list of Lucide icon names for feature-grid blocks.
 * Restricting to an explicit list prevents arbitrary SVG/script injection.
 */
export const APPROVED_FEATURE_ICONS = [
  "Zap",
  "Shield",
  "Star",
  "Check",
  "CheckCircle",
  "Award",
  "Trophy",
  "Rocket",
  "Globe",
  "Heart",
  "ThumbsUp",
  "Leaf",
  "Flame",
  "Bolt",
  "Clock",
  "Lock",
  "Unlock",
  "Settings",
  "Wrench",
  "Tool",
  "Package",
  "Truck",
  "ShoppingCart",
  "Tag",
  "Percent",
  "DollarSign",
  "CreditCard",
  "BarChart",
  "LineChart",
  "PieChart",
  "Users",
  "User",
  "Phone",
  "Mail",
  "MessageCircle",
  "Send",
  "Bell",
  "Info",
  "AlertCircle",
  "HelpCircle",
  "Eye",
  "Layers",
  "Layout",
  "Grid",
  "List",
  "FileText",
  "Image",
  "Video",
  "Music",
  "Headphones",
  "Camera",
  "Wifi",
  "Battery",
  "Cpu",
  "Monitor",
  "Smartphone",
  "Tablet",
  "Laptop",
  "Printer",
  "Download",
  "Upload",
  "RefreshCw",
  "RotateCcw",
  "ArrowRight",
  "ArrowLeft",
  "ChevronRight",
  "ChevronLeft",
  "ExternalLink",
  "Link",
  "Bookmark",
  "Archive",
  "Trash",
  "Edit",
  "Copy",
  "Scissors",
  "Clipboard",
  "Search",
  "Filter",
  "SortAsc",
  "Calendar",
  "Map",
  "MapPin",
  "Navigation",
  "Home",
  "Building",
  "Briefcase",
  "Compass",
  "Target",
  "Activity",
  "TrendingUp",
  "TrendingDown",
  "Sun",
  "Moon",
  "Cloud",
  "Droplet",
  "Wind",
  "Thermometer",
  "Recycle",
  "Footprints",
  "Scale",
  "Gauge",
  "Aperture",
  "Box",
  "Boxes",
] as const;

export type ApprovedFeatureIcon = (typeof APPROVED_FEATURE_ICONS)[number];
