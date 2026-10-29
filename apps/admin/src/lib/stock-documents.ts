/**
 * The files a stock item carries: its purchase order, its user manual and its data sheet. What is accepted, how each is named in storage, and which
 * columns of the item record them. Pure (no server calls), so the forms and the server actions share it. The admin's browser uploads a file straight
 * to its private bucket (a server request is too small for a manual); the server then checks it is really there before recording it on the item
 * (see stock-documents-server.ts). A short-lived link is made whenever somebody views or downloads one (the /devices/stock/[id]/files/[slot] route).
 */

export type DocSlot = "po" | "manual" | "datasheet";

export const DOC_SLOTS: Record<DocSlot, { label: string; bucket: string; column: string; maxBytes: number }> = {
  po: { label: "Purchase order", bucket: "po-documents", column: "po_document", maxBytes: 15 * 1024 * 1024 },
  manual: { label: "User manual", bucket: "device-documents", column: "manual_document", maxBytes: 25 * 1024 * 1024 },
  datasheet: { label: "Data sheet", bucket: "device-documents", column: "datasheet_document", maxBytes: 25 * 1024 * 1024 },
};

export const DOC_SLOT_KEYS = Object.keys(DOC_SLOTS) as DocSlot[];

export function isDocSlot(value: string): value is DocSlot {
  return value in DOC_SLOTS;
}

/** The kinds of file accepted, by extension, with the type the browser reports for them. */
const KINDS: Record<string, { mime: string; label: string }> = {
  pdf: { mime: "application/pdf", label: "PDF" },
  jpg: { mime: "image/jpeg", label: "Photo" },
  jpeg: { mime: "image/jpeg", label: "Photo" },
  png: { mime: "image/png", label: "Image" },
  webp: { mime: "image/webp", label: "Image" },
  doc: { mime: "application/msword", label: "Word document" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word document" },
  xls: { mime: "application/vnd.ms-excel", label: "Excel sheet" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel sheet" },
};

/** For the file input's `accept`. */
export const DOC_ACCEPT = Object.keys(KINDS).map((e) => `.${e}`).join(",");

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** The type a stored file is sent with, decided by its extension (browsers report no type for some files); null when the kind is not accepted. */
export function mimeOf(name: string): string | null {
  return KINDS[extensionOf(name)]?.mime ?? null;
}

/** "PDF", "Photo"...: what a stored file is, for a line of text. */
export function documentKindLabel(name: string | null): string {
  return (name && KINDS[extensionOf(name)]?.label) || "File";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function maxMegabytes(slot: DocSlot): number {
  return DOC_SLOTS[slot].maxBytes / (1024 * 1024);
}

/** Why a file can't be accepted for this slot, or null. */
export function documentProblem(slot: DocSlot, name: string, size: number): string | null {
  if (!mimeOf(name)) return "That file type isn't accepted. Upload a PDF, a photo or scan (JPG, PNG, WebP), or a Word or Excel file.";
  if (size > DOC_SLOTS[slot].maxBytes) return `That file is ${formatFileSize(size)}; the most is ${maxMegabytes(slot)} MB.`;
  return null;
}

/** A name that is safe in a storage path: no folders, no odd characters, never empty. */
export function safeFileName(name: string): string {
  const base = name.split(/[\/]/).pop() ?? "document";
  const cleaned = base.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").replace(/^\.+/, "").slice(-120);
  return cleaned || "document";
}

/** A new place for a file in a bucket: a folder of its own, so two files with the same name never meet. */
export function newDocumentPath(fileName: string): string {
  return `${crypto.randomUUID()}/${safeFileName(fileName)}`;
}

/** What a stored path looks like (a folder id and a file name). Anything else is not one of ours. */
export const DOCUMENT_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]{1,200}$/;

/** A file recorded on an item, as the item's columns hold it. */
export interface StoredDocument {
  path: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
}

/** The item columns for one slot: the file's details, or all cleared when there is none. */
export function documentColumns(slot: DocSlot, doc: StoredDocument | null): Record<string, string | number | null> {
  const c = DOC_SLOTS[slot].column;
  return {
    [`${c}_path`]: doc?.path ?? null,
    [`${c}_name`]: doc?.name ?? null,
    [`${c}_type`]: doc?.type ?? null,
    [`${c}_size`]: doc?.size ?? null,
    [`${c}_uploaded_at`]: doc?.uploaded_at ?? null,
  };
}

/** The file an item record holds for a slot, or null. */
export function documentOf(row: object, slot: DocSlot): { path: string; name: string; type: string | null; size: number | null } | null {
  const c = DOC_SLOTS[slot].column;
  const r = row as Record<string, unknown>;
  const path = r[`${c}_path`];
  if (typeof path !== "string" || !path) return null;
  return {
    path,
    name: typeof r[`${c}_name`] === "string" ? (r[`${c}_name`] as string) : DOC_SLOTS[slot].label,
    type: (r[`${c}_type`] as string | null) ?? null,
    size: (r[`${c}_size`] as number | null) ?? null,
  };
}

/** Where View and Download of an item's file go. */
export function documentHref(itemId: string, slot: DocSlot, download = false): string {
  return `/devices/stock/${itemId}/files/${slot}${download ? "?download=1" : ""}`;
}
