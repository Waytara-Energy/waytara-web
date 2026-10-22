// What a support ticket looks like to a screen, and the small rules both apps share: statuses, who sees what as "seen", the limits on files.
// Pure (no React, no network), so it is tested in apps/web.

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type Viewer = "customer" | "staff";

export const STATUS_LABEL: Record<TicketStatus, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
/** The steps shown under the title of a ticket. */
export const STATUS_STEPS: { id: TicketStatus; label: string }[] = [
  { id: "open", label: "Received" },
  { id: "in_progress", label: "Being handled" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

export const CATEGORIES = [
  { id: "device", label: "Device or inverter" },
  { id: "installation", label: "Installation" },
  { id: "billing", label: "Billing" },
  { id: "account", label: "Account" },
  { id: "other", label: "Something else" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const categoryLabel = (id: string | null | undefined): string => CATEGORIES.find((c) => c.id === id)?.label ?? "Something else";

export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_BODY = 5000;
export const FILE_ACCEPT = "image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.mp4,.mov";
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "video/mp4", "video/quicktime",
]);

export interface TicketView {
  id: string;
  ticket_no: number;
  subject: string;
  status: TicketStatus;
  category: string;
  customer_id: string;
  customer_name: string | null;
  site_id: string | null;
  site_name: string | null;
  equipment_id: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  assigned_role: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  rating: number | null;
  rating_comment: string | null;
  customer_last_read_at: string | null;
  staff_last_read_at: string | null;
  staff_last_read_name: string | null;
  unread_customer: number;
  unread_staff: number;
}

export interface MessageView {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  sender_role: string;
  sender_name: string | null;
  body: string;
  internal: boolean;
  event: string | null;
  /** the single file of a message written before messages could carry several (see AttachmentView for the rest) */
  attachment_path: string | null;
  created_at: string;
}

export interface AttachmentView {
  id: string;
  message_id: string;
  ticket_id: string;
  path: string;
  file_name: string;
  size_bytes: number;
  mime_type: string | null;
}

export const ticketCode = (no: number): string => `#${no}`;
export const isClosed = (s: string): boolean => s === "closed";
export const isActive = (s: string): boolean => s === "open" || s === "in_progress";

/** How a member of the team is described: to the customer ("Site installer") and to colleagues ("Site engineer"). */
export function roleName(role: string | null | undefined, forCustomer: boolean): string {
  if (role === "site_engineer") return forCustomer ? "Site installer" : "Site engineer";
  if (role === "employee") return forCustomer ? "Site employee" : "Employee";
  if (role === "admin") return forCustomer ? "WayTara admin" : "Admin";
  return forCustomer ? "WayTara team" : "Team";
}

/** Is a message the viewer's own side: the customer's, for the customer; any team member's, for staff. */
export function isMine(m: Pick<MessageView, "sender_role">, viewer: Viewer): boolean {
  if (m.sender_role === "system") return false;
  return viewer === "customer" ? m.sender_role === "customer" : m.sender_role !== "customer";
}

/** Has the other side opened the ticket since this message was written? (That is all "seen" means: one mark per side, kept on the ticket.) */
export function seenBy(m: Pick<MessageView, "created_at">, ticket: Pick<TicketView, "customer_last_read_at" | "staff_last_read_at" | "staff_last_read_name">, viewer: Viewer): { seen: boolean; by: string | null } {
  const readAt = viewer === "customer" ? ticket.staff_last_read_at : ticket.customer_last_read_at;
  const seen = !!readAt && Date.parse(readAt) >= Date.parse(m.created_at);
  return { seen, by: seen && viewer === "customer" ? ticket.staff_last_read_name : null };
}

/** The id of the newest message of the viewer's own side: the one that carries the "Sent" / "Seen" mark. */
export function lastMineId(messages: readonly MessageView[], viewer: Viewer): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (isMine(m, viewer) && !m.internal) return m.id;
  }
  return null;
}

/** Where the thread starts a new day (the index of each message that is the first of its day, in the viewer's own clock). */
export function dayStarts(messages: readonly MessageView[], zone?: string): Set<string> {
  const out = new Set<string>();
  let last = "";
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  for (const m of messages) {
    const day = fmt.format(new Date(m.created_at));
    if (day !== last) out.add(m.id);
    last = day;
  }
  return out;
}

export const formatBytes = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

export type FileKind = "image" | "pdf" | "video" | "file";
export function fileKind(name: string, mime?: string | null): FileKind {
  const m = (mime ?? "").toLowerCase();
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "image";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("video/") || ["mp4", "mov"].includes(ext)) return "video";
  return "file";
}

/** A file name that is safe in a storage path: no folders, no odd characters, not too long, the extension kept. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.normalize("NFKD").replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_");
  const dot = cleaned.lastIndexOf(".");
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned).slice(0, 80) || "file";
  const ext = dot > 0 ? cleaned.slice(dot).slice(0, 12) : "";
  return `${stem}${ext}`;
}

/** The storage path of a new file: <ticket id>/<random>-<safe name> (the first folder is what the storage rules check). The files of an
 *  internal note go in <ticket id>/internal/, which the customer cannot read. */
export function attachmentPath(ticketId: string, name: string, internal = false, random: string = crypto.randomUUID()): string {
  return `${ticketId}/${internal ? "internal/" : ""}${random}-${safeFileName(name)}`;
}

/** What to show for a stored path: the name the person gave it (the random prefix, or an old timestamp prefix, is dropped). */
export function displayName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/, "").replace(/^\d{10,}-/, "");
}

export interface PickedFile {
  name: string;
  size: number;
  type: string;
}

/** Which of the files a person picked can be added, and what to tell them about the rest. */
export function acceptFiles<T extends PickedFile>(current: readonly T[], incoming: readonly T[]): { accepted: T[]; problems: string[] } {
  const accepted: T[] = [];
  const problems: string[] = [];
  for (const f of incoming) {
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    const typeOk = f.type ? ALLOWED_MIME.has(f.type.toLowerCase()) : ["pdf", "txt", "csv", "doc", "docx", "xls", "xlsx", "mp4", "mov", "jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext);
    if (f.size > MAX_FILE_BYTES) problems.push(`${f.name} is larger than ${formatBytes(MAX_FILE_BYTES)}.`);
    else if (f.size === 0) problems.push(`${f.name} is empty.`);
    else if (!typeOk) problems.push(`${f.name} is not a kind of file we can take (pictures, PDF, text, Word, Excel, short videos).`);
    else if (current.length + accepted.length >= MAX_FILES) problems.push(`Only ${MAX_FILES} files fit in one message. ${f.name} was left out.`);
    else accepted.push(f);
  }
  return { accepted, problems };
}

/** The 1 to 5 stars as words, for the line under them. */
export const RATING_WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"] as const;
