/**
 * The purchase-order file of a stock item: what is accepted, how it is named in storage, and how it is put there and removed. Used by the stock actions
 * (server side). The file lives in the private `po-documents` bucket; the table keeps its path, name, type and size, and a short-lived link is made
 * whenever somebody views or downloads it (see the /devices/stock/[id]/po route).
 */

export const PO_BUCKET = "po-documents";
export const PO_MAX_BYTES = 15 * 1024 * 1024;

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
export const PO_ACCEPT = Object.keys(KINDS).map((e) => `.${e}`).join(",");

export const PO_MAX_MB = PO_MAX_BYTES / (1024 * 1024);

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** "PDF", "Photo"...: what a stored file is, for a line of text. */
export function poKindLabel(name: string | null): string {
  return (name && KINDS[extensionOf(name)]?.label) || "File";
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The file the form carries, if the admin chose one (an empty file input still sends an empty part). */
export function readPoFile(formData: FormData): File | null {
  const f = formData.get("poDocument");
  return f instanceof File && f.size > 0 && f.name ? f : null;
}

/** Why a file can't be accepted, or null. The extension decides the kind (browsers report no type for some files). */
export function poFileProblem(file: File): string | null {
  const kind = KINDS[extensionOf(file.name)];
  if (!kind) return "That file type isn't accepted. Upload a PDF, a photo or scan (JPG, PNG, WebP), or a Word or Excel file.";
  if (file.size > PO_MAX_BYTES) return `That file is ${formatFileSize(file.size)}; the most is ${PO_MAX_MB} MB.`;
  return null;
}

/** A name that is safe in a storage path: no folders, no odd characters, never empty. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "document";
  const cleaned = base.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_").replace(/^\.+/, "").slice(-120);
  return cleaned || "document";
}

export interface StoredPoDocument {
  po_document_path: string;
  po_document_name: string;
  po_document_type: string;
  po_document_size: number;
  po_document_uploaded_at: string;
}

type StorageClient = { storage: { from: (bucket: string) => { upload: (path: string, body: File, options: { contentType: string; upsert: boolean }) => Promise<{ error: { message: string } | null }>; remove: (paths: string[]) => Promise<{ error: { message: string } | null }> } } };

/** Puts the file in the bucket, in a folder of its own (so two files with the same name never meet), and returns the columns to store. */
export async function uploadPoDocument(supabase: StorageClient, file: File): Promise<StoredPoDocument> {
  const problem = poFileProblem(file);
  if (problem) throw new Error(problem);
  const mime = KINDS[extensionOf(file.name)]!.mime;
  const path = `${crypto.randomUUID()}/${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from(PO_BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (error) throw new Error(`The purchase order couldn't be uploaded: ${error.message}`);
  return { po_document_path: path, po_document_name: file.name, po_document_type: mime, po_document_size: file.size, po_document_uploaded_at: new Date().toISOString() };
}

/** Deletes a stored file. A failure is not worth failing the save for (the file just stays in the bucket), so it is only returned. */
export async function removePoDocument(supabase: StorageClient, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { error } = await supabase.storage.from(PO_BUCKET).remove([path]);
  return error ? error.message : null;
}
