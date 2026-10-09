// A saved report and its latest e-mail, as the dashboard holds them (mapped from customer_reports / customer_report_runs).

import { savedParamsSchema, type SavedParams } from "./saved-report";
import type { Schedule } from "./schedule";

export interface SavedReportView {
  id: string;
  name: string;
  equipmentId: string | null;
  params: SavedParams;
  schedule: Schedule;
  sendToMe: boolean;
  recipients: string[];
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

export interface RunView {
  id: string;
  reportId: string;
  status: "sending" | "sent" | "failed";
  trigger: "schedule" | "send_now";
  recipients: string[];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

interface ReportRowLike {
  id: string;
  name: string;
  equipment_id: string | null;
  params: unknown;
  schedule_kind: string;
  schedule_time: string;
  schedule_dow: number | null;
  schedule_dom: number | null;
  send_to_me: boolean;
  recipients: string[];
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
}

/** null when the stored settings are no longer valid (the report is then left out rather than shown wrong). */
export function toReportView(r: ReportRowLike): SavedReportView | null {
  const params = savedParamsSchema.safeParse(r.params);
  if (!params.success) return null;
  return {
    id: r.id,
    name: r.name,
    equipmentId: r.equipment_id,
    params: params.data,
    schedule: { kind: r.schedule_kind as Schedule["kind"], time: r.schedule_time.slice(0, 5), dow: r.schedule_dow, dom: r.schedule_dom },
    sendToMe: r.send_to_me,
    recipients: r.recipients,
    enabled: r.enabled,
    nextRunAt: r.next_run_at,
    lastRunAt: r.last_run_at,
  };
}

interface RunRowLike {
  id: string;
  report_id: string;
  status: string;
  trigger: string;
  recipients: string[];
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export function toRunView(r: RunRowLike): RunView {
  return {
    id: r.id,
    reportId: r.report_id,
    status: r.status as RunView["status"],
    trigger: r.trigger as RunView["trigger"],
    recipients: r.recipients,
    error: r.error,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  };
}
