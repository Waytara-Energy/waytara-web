import { EnquiryRecord } from "@/types";

// In-memory persistent enquiry store for server session
// Real database adapter (e.g. Supabase, PostgreSQL, Prisma, HubSpot/Salesforce CRM) can drop in here
const enquiryMemoryStore = new Map<string, EnquiryRecord>();

/**
 * Persists an enquiry or partial step update to the store.
 */
export async function saveEnquiry(
  payload: Partial<EnquiryRecord>
): Promise<EnquiryRecord> {
  const now = new Date().toISOString();
  const id =
    payload.id ||
    `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const existing = enquiryMemoryStore.get(id);

  const mergedRecord: EnquiryRecord = {
    id,
    createdAt: existing?.createdAt || now,
    status: payload.status || existing?.status || "partial",
    source: payload.source || existing?.source || "energy_planner",
    segment: payload.segment || existing?.segment,
    packageId: payload.packageId || existing?.packageId,
    formData: {
      ...(existing?.formData || {}),
      ...(payload.formData || {}),
    },
    recommendation: {
      ...(existing?.recommendation || {}),
      ...(payload.recommendation || {}),
    },
    contact: {
      ...(existing?.contact || {}),
      ...(payload.contact || {}),
    },
  };

  enquiryMemoryStore.set(id, mergedRecord);

  // Dev logging for transparency
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[WayTara Enquiry Store] Saved ${mergedRecord.status} lead [${id}]:`,
      {
        source: mergedRecord.source,
        segment: mergedRecord.segment,
        package: mergedRecord.packageId,
        contact: mergedRecord.contact?.name || "anonymous",
      }
    );
  }

  return mergedRecord;
}

/**
 * Retrieves an enquiry by its ID.
 */
export async function getEnquiryById(
  id: string
): Promise<EnquiryRecord | undefined> {
  return enquiryMemoryStore.get(id);
}

/**
 * Retrieves all stored leads (for admin review / analytics).
 */
export async function getAllEnquiries(): Promise<EnquiryRecord[]> {
  return Array.from(enquiryMemoryStore.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
