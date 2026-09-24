import "server-only";
import { createClient } from "@waytara/supabase/server";

export interface ServiceVisit {
  id: string;
  status: string;
  scheduledDate: string | null;
  completedAt: string | null;
  isChargeable: boolean | null;
  chargeAmount: number | null;
}

export interface ServiceStatus {
  planName: string | null;
  totalIncluded: number | null;
  freeIncluded: number | null;
  completedCount: number;
  remainingCount: number | null;
  nextServiceDate: string | null;
  lastCompletedAt: string | null;
  contractEndDate: string;
  visits: ServiceVisit[];
}

/** Derived, not stored — same reasoning as everywhere else this app
 *  computes a "current state" from a history table rather than keeping a
 *  column that would go stale (device-status-pill.tsx's inverter_state
 *  lookup, is_service_valid from the schema discussion, etc.). A "service visit" is a
 *  maintenance_tickets row tagged with this contract's id and
 *  type = 'scheduled_service' — completedCount/remainingCount/nextDate
 *  are all just aggregates over that list, not separately tracked
 *  anywhere. */
export async function getServiceStatus(serviceContractId: string): Promise<ServiceStatus | null> {
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from("service_contracts")
    .select("id, end_date, service_plan:service_plans(name, total_services_included, free_services_count)")
    .eq("id", serviceContractId)
    .maybeSingle();
  if (!contract) return null;

  const { data: ticketRows } = await supabase
    .from("maintenance_tickets")
    .select("id, status, scheduled_date, completed_at, is_chargeable, charge_amount")
    .eq("service_contract_id", serviceContractId)
    .eq("type", "scheduled_service")
    .order("scheduled_date", { ascending: true });

  const visits: ServiceVisit[] = (ticketRows ?? []).map((t) => ({
    id: t.id,
    status: t.status,
    scheduledDate: t.scheduled_date,
    completedAt: t.completed_at,
    isChargeable: t.is_chargeable,
    chargeAmount: t.charge_amount,
  }));

  const completed = visits.filter((v) => v.completedAt !== null);
  const upcoming = visits.filter((v) => v.completedAt === null && v.scheduledDate !== null);

  const totalIncluded = contract.service_plan?.total_services_included ?? null;

  return {
    planName: contract.service_plan?.name ?? null,
    totalIncluded,
    freeIncluded: contract.service_plan?.free_services_count ?? null,
    completedCount: completed.length,
    remainingCount: totalIncluded !== null ? Math.max(0, totalIncluded - completed.length) : null,
    nextServiceDate: upcoming[0]?.scheduledDate ?? null,
    lastCompletedAt: completed[completed.length - 1]?.completedAt ?? null,
    contractEndDate: contract.end_date,
    visits,
  };
}
