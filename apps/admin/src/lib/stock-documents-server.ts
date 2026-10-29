import type { createClient } from "@waytara/supabase/server";
import { DOC_SLOT_KEYS, DOC_SLOTS, DOCUMENT_PATH, documentColumns, documentOf, documentProblem, mimeOf, newDocumentPath, type DocSlot, type StoredDocument } from "./stock-documents";

type Supabase = Awaited<ReturnType<typeof createClient>>;

interface PlacedFile {
  slot: DocSlot;
  path: string;
}

/** What a save does about the files: the columns to write, the files put there for this save, and the old ones to take down once it is saved. */
export interface DocumentPlan {
  columns: Record<string, string | number | null>;
  added: PlacedFile[];
  replaced: PlacedFile[];
}

/** Deletes stored files. A failure is not worth failing a save for (the file just stays in the bucket), so it is ignored. */
export async function discardDocuments(supabase: Supabase, files: PlacedFile[]): Promise<void> {
  for (const slot of DOC_SLOT_KEYS) {
    const paths = files.filter((f) => f.slot === slot).map((f) => f.path);
    if (paths.length > 0) await supabase.storage.from(DOC_SLOTS[slot].bucket).remove(paths);
  }
}

/** Checks that a file the browser says it uploaded is really in the bucket (and is acceptable), and returns what to record. Size and kind come from the bucket, not the form. */
export async function checkUploaded(supabase: Supabase, slot: DocSlot, path: string, name: string): Promise<StoredDocument> {
  const bucket = supabase.storage.from(DOC_SLOTS[slot].bucket);
  if (!DOCUMENT_PATH.test(path)) throw new Error(`The ${DOC_SLOTS[slot].label.toLowerCase()} didn't upload properly. Choose the file again.`);
  const slash = path.indexOf("/");
  const { data } = await bucket.list(path.slice(0, slash), { limit: 5 });
  const found = (data ?? []).find((f) => f.name === path.slice(slash + 1));
  const size = Number((found?.metadata as { size?: number } | null)?.size ?? 0);
  if (!found || !size) throw new Error(`The ${DOC_SLOTS[slot].label.toLowerCase()} didn't upload properly. Choose the file again.`);

  const problem = documentProblem(slot, name, size);
  if (problem) {
    await bucket.remove([path]);
    throw new Error(problem);
  }
  return { path, name, type: mimeOf(name)!, size, uploaded_at: new Date().toISOString() };
}

/**
 * Reads what the form says about each of the item's files: a file the browser uploaded (`<slot>Path` and `<slot>Name`), or "remove it" (`<slot>Remove`).
 * `current` is the item as it is now (for a save of an existing one), so a replaced or removed file can be taken down afterwards. Anything the form
 * does not mention stays as it is. Throws, with the files of this save already taken down, when a file is not acceptable.
 */
export async function planDocuments(supabase: Supabase, formData: FormData, current: object | null, slots: readonly DocSlot[] = DOC_SLOT_KEYS): Promise<DocumentPlan> {
  const plan: DocumentPlan = { columns: {}, added: [], replaced: [] };
  try {
    for (const slot of slots) {
      const path = String(formData.get(`${slot}Path`) ?? "").trim();
      const name = String(formData.get(`${slot}Name`) ?? "").trim();
      const remove = formData.get(`${slot}Remove`) === "on";
      const old = current ? documentOf(current, slot) : null;

      if (path && name) {
        plan.columns = { ...plan.columns, ...documentColumns(slot, await checkUploaded(supabase, slot, path, name)) };
        plan.added.push({ slot, path });
        if (old && old.path !== path) plan.replaced.push({ slot, path: old.path });
      } else if (remove && old) {
        plan.columns = { ...plan.columns, ...documentColumns(slot, null) };
        plan.replaced.push({ slot, path: old.path });
      }
    }
  } catch (error) {
    await discardDocuments(supabase, plan.added);
    throw error;
  }
  return plan;
}

/** Copies the manual and the data sheet of an item to files of their own (the copy is a model's twin, but deleting one must never delete the other's file). */
export async function copyModelDocuments(supabase: Supabase, source: object): Promise<{ columns: Record<string, string | number | null>; added: PlacedFile[] }> {
  const columns: Record<string, string | number | null> = {};
  const added: PlacedFile[] = [];
  try {
    for (const slot of ["manual", "datasheet"] as const) {
      const doc = documentOf(source, slot);
      if (!doc) continue;
      const path = newDocumentPath(doc.name);
      const { error } = await supabase.storage.from(DOC_SLOTS[slot].bucket).copy(doc.path, path);
      if (error) throw new Error(`The ${DOC_SLOTS[slot].label.toLowerCase()} couldn't be copied: ${error.message}`);
      added.push({ slot, path });
      Object.assign(columns, documentColumns(slot, { path, name: doc.name, type: doc.type ?? mimeOf(doc.name) ?? "application/octet-stream", size: doc.size ?? 0, uploaded_at: new Date().toISOString() }));
    }
  } catch (error) {
    await discardDocuments(supabase, added);
    throw error;
  }
  return { columns, added };
}
