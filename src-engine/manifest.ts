/**
 * Manifest data model.
 *
 * `manifest.json` is the engine's canonical output. The renderer reads
 * it to emit the clone tree. The audit reads it to diff vs. gold.
 *
 * Generic-by-construction: every shape is a property of "any
 * site-cloning engine" (R1, R14). The literal strings like "form" /
 * "grid" / "dashboard" are leaf-shape kinds, not site-specific.
 */

export type LeafShape =
  | "form"
  | "grid"
  | "dashboard"
  | "wizard"
  | "viewer"
  | "section-landing"
  | "endpoint";

/** Per-column input kind detected from the first body row (GAP-08). */
export type ColumnKind =
  | "checkbox"
  | "radio"
  | "select"
  | "date"
  | "time"
  | "number"
  | "text"
  | "textarea"
  | "value"; // plain text

export type ButtonKind =
  | "route"
  | "modal"
  | "menu"
  | "download"
  | "external"
  | "dead";

export interface FormField {
  label: string;
  kind:
    | "text"
    | "number"
    | "date"
    | "checkbox"
    | "radio"
    | "select"
    | "textarea"
    | "file"
    | "color"
    | "range";
  options?: string[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface FormSection {
  label: string;
  fields: FormField[];
}

export interface DataGrid {
  /** Cleaned column labels (whitespace preserved, GAP-21). */
  columns: string[];
  /** Per-column rendered kind (GAP-08). */
  columnKinds: ColumnKind[];
  rowCount: number;
  hasTotals: boolean;
  hasFilterRow: boolean;
  filterFields?: FormField[];
  /** First 1-3 sample rows (small enough to inline). */
  firstRows?: string[][];
}

export interface Button {
  label: string;
  kind: ButtonKind;
  destination?: string;
}

export interface ActionMenu {
  trigger: string;
  items: { label: string; destination?: string; kind?: ButtonKind }[];
}

export interface PageInfoBanner {
  /** "info" | "warning" | "error" | "success" — palette hint. */
  level: "info" | "warning" | "error" | "success";
  text: string;
}

export interface LeafTab {
  label: string;
  url?: string;
  /** In-page sub-content if the tab doesn't navigate (GAP-09). */
  content?: LeafContent;
  /** Recursive — nested tabs are themselves leaves. */
  tabs?: LeafTab[];
}

export interface LeafContent {
  shape: LeafShape;
  title?: string;
  h1?: string;
  breadcrumbs?: string[];
  panels?: FormSection[];
  tables?: DataGrid[];
  buttons?: Button[];
  actionMenus?: ActionMenu[];
  pageInfoBanners?: PageInfoBanner[];
}

export interface Leaf {
  /** Canonical URL after dedupe. */
  url: string;
  status: number;
  /** Where the crawl screenshot lives on disk (relative). */
  screenshot?: string;
  /** Filled in by the analyzer. */
  leafContent?: LeafContent;
  /** Recursive tab tree, in addition to leafContent.shape (GAP-09). */
  tabs?: LeafTab[];
  /** Outbound links discovered for queue feeding (informational). */
  childUrls?: string[];
  /** Kind override from config (endpoint/section-landing). */
  kind?: LeafShape;
  /** Per-URL extension point; analyzers may add. */
  meta?: Record<string, unknown>;
}

export interface Manifest {
  generatedAt: string;
  configName: string;
  seedUrls: string[];
  leafCount: number;
  leaves: Leaf[];
}
