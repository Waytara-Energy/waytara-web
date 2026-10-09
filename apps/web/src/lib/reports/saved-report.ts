// A saved customer report: what the form sends and what is kept (customer_reports.params and its schedule columns).

import { z } from "zod";
import { PARAMETER_BY_ID } from "./parameters";
import { MAX_SERIES, PERIOD_PRESETS, type CustomReportDef, type PeriodPreset } from "./custom-report";
import { isTime } from "./schedule";
import { MAX_RECIPIENTS, isEmail } from "./recipients";

const presetIds = PERIOD_PRESETS.map((p) => p.id) as [PeriodPreset, ...PeriodPreset[]];

export const savedParamsSchema = z.object({
  series: z
    .array(
      z.object({
        param: z.string().refine((p) => !!PARAMETER_BY_ID[p], "Unknown parameter"),
        label: z.string().trim().max(40).optional(),
      })
    )
    .min(1, "Pick at least one parameter")
    .max(MAX_SERIES),
  period: z.enum(presetIds),
  formats: z.array(z.enum(["pdf", "csv"])).min(1, "Pick PDF, CSV or both"),
  comparePrevious: z.boolean().optional(),
});
export type SavedParams = z.infer<typeof savedParamsSchema>;

export const reportFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the report a name").max(80),
    params: savedParamsSchema,
    schedule: z.object({
      kind: z.enum(["none", "daily", "weekly", "monthly"]),
      time: z.string().refine(isTime, "Use a time like 08:00"),
      dow: z.number().int().min(0).max(6).nullable().optional(),
      dom: z.number().int().min(0).max(28).nullable().optional(),
    }),
    sendToMe: z.boolean(),
    recipients: z.array(z.string().refine(isEmail, "Not a valid e-mail address")).max(MAX_RECIPIENTS),
    enabled: z.boolean().default(true),
  })
  .refine((v) => v.schedule.kind !== "weekly" || (v.schedule.dow !== null && v.schedule.dow !== undefined), { message: "Pick a weekday", path: ["schedule", "dow"] })
  .refine((v) => v.schedule.kind !== "monthly" || (v.schedule.dom !== null && v.schedule.dom !== undefined), { message: "Pick a day of the month", path: ["schedule", "dom"] })
  .refine((v) => v.schedule.kind === "none" || v.sendToMe || v.recipients.length > 0, { message: "A scheduled report needs someone to send it to", path: ["recipients"] });
export type ReportForm = z.infer<typeof reportFormSchema>;

export const toDef = (name: string, p: SavedParams): CustomReportDef => ({ name, series: p.series, period: p.period, comparePrevious: p.comparePrevious });
