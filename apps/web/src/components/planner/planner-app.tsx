"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import { buildBlueprint } from "@/lib/planner/engine";
import {
  activeQuestions,
  goalOptionsFor,
  initialAnswers,
  isQuestionComplete,
  resolveOptions,
  validProperty,
  validStart,
  visibleParts,
  type Part,
  type Question,
} from "@/lib/planner/flow";
import { plannerSummary } from "@/lib/planner/summary";
import type { Answers, PlannerContext } from "@/lib/planner/types";
import { cn } from "@/lib/utils";
import { BlueprintView } from "./blueprint-view";
import { EnquiryForm } from "./enquiry-form";
import { trackPlanner } from "./planner-analytics";

const RESULT = "result";

/** Sets one answer, honouring a multi choice's limit and its "Nothing yet / Not sure" exclusivity. */
function applyChoice(a: Answers, part: Part, value: string): Answers {
  if (part.kind === "single") return { ...a, [part.field]: value } as Answers;
  const current = a[part.field] as string[];
  if (current.includes(value)) return { ...a, [part.field]: current.filter((v) => v !== value) } as Answers;
  if (part.exclusive?.includes(value)) return { ...a, [part.field]: [value] } as Answers;
  const kept = current.filter((v) => !part.exclusive?.includes(v));
  if (part.max && kept.length >= part.max) return a;
  return { ...a, [part.field]: [...kept, value] } as Answers;
}

function OptionButton({ label, hint, selected, multi, disabled, onClick }: { label: string; hint?: string; selected: boolean; multi: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500",
        selected ? "border-emerald-500/70 bg-emerald-500/[0.07]" : "border-theme-border bg-theme-bg hover:border-emerald-500/40",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center border",
          multi ? "rounded-md" : "rounded-full",
          selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-theme-border"
        )}
        aria-hidden="true"
      >
        {selected && <Check className="size-3.5" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-theme-primary">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-theme-secondary">{hint}</span>}
      </span>
    </button>
  );
}

/** The Energy Planner (v3): goal-first, adaptive, a blueprint before any contact details. All routing lives in lib/planner; this only renders it. */
export function PlannerApp() {
  const [ctx, setCtx] = React.useState<PlannerContext | null>(null);
  const [answers, setAnswers] = React.useState<Answers>(() => initialAnswers({}));
  const [stack, setStack] = React.useState<string[]>([]);
  const [currentId, setCurrentId] = React.useState<string>("goals");
  const [entry, setEntry] = React.useState<string | undefined>();
  const topRef = React.useRef<HTMLDivElement>(null);

  // The address says how the visitor arrived (?start=build|charge|manage, ?for=home|...). Read after mount so the page can stay server-rendered.
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const next: PlannerContext = { start: validStart(p.get("start")), property: validProperty(p.get("for")) };
    /* eslint-disable react-hooks/set-state-in-effect */
    setCtx(next);
    setAnswers(initialAnswers(next));
    setEntry([next.start && `start=${next.start}`, p.get("for") && `for=${p.get("for")}`].filter(Boolean).join(", ") || undefined);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const context: PlannerContext = ctx ?? {};
  const active = React.useMemo(() => activeQuestions(answers, context), [answers, ctx]); // eslint-disable-line react-hooks/exhaustive-deps
  const onResult = currentId === RESULT;
  const question: Question | undefined = onResult ? undefined : (active.find((q) => q.id === currentId) ?? active[0]);
  const blueprint = React.useMemo(() => (onResult ? buildBlueprint(answers) : null), [onResult, answers]);

  // Scroll the planner back into view on every step, so a long page does not leave the visitor mid-way down.
  React.useEffect(() => {
    if (stack.length > 0 || onResult) topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [currentId, stack.length, onResult]);

  // Funnel events when the blueprint is first shown.
  React.useEffect(() => {
    if (!blueprint) return;
    trackPlanner("planner_route_selected", { route: blueprint.routeLabel });
    if (blueprint.routes.includes("EMS")) trackPlanner("ems_interest_selected", { route: blueprint.routeLabel });
    if (blueprint.routes.includes("CPMS")) trackPlanner("cpms_interest_selected", { route: blueprint.routeLabel });
  }, [blueprint]);

  if (!ctx) {
    return <div className="min-h-[24rem] rounded-2xl border border-theme-border bg-theme-surface" aria-busy="true" />;
  }

  function goNext(a: Answers, fromId: string) {
    const list = activeQuestions(a, context);
    const i = list.findIndex((q) => q.id === fromId);
    const next = i >= 0 ? list[i + 1] : undefined;
    setStack((s) => [...s, fromId]);
    setCurrentId(next ? next.id : RESULT);
  }

  function goBack() {
    const prev = stack[stack.length - 1];
    setStack(stack.slice(0, -1));
    setCurrentId(prev ?? "goals");
  }

  function restart() {
    setAnswers(initialAnswers(context));
    setStack([]);
    setCurrentId("goals");
  }

  function choose(q: Question, part: Part, value: string) {
    const updated = applyChoice(answers, part, value);
    setAnswers(updated);
    // A lone single-choice question moves on by itself; anything else waits for Continue.
    const parts = visibleParts(q, updated);
    if (parts.length === 1 && part.kind === "single") goNext(updated, q.id);
  }

  const total = active.length || 1;
  const position = onResult ? total : Math.max(0, active.findIndex((q) => q.id === question?.id));
  const progress = Math.round((position / total) * 100);

  return (
    <div ref={topRef} className="scroll-mt-28">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-theme-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Planner progress">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(progress, 4)}%` }} />
        </div>
        {!onResult && <span className="text-xs tabular-nums text-theme-muted">Step {position + 1}</span>}
      </div>

      {blueprint ? (
        <div className="space-y-8">
          <BlueprintView blueprint={blueprint} onRestart={restart} />
          <EnquiryForm blueprint={blueprint} summary={plannerSummary(answers, blueprint, context, entry)} />
        </div>
      ) : question ? (
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 sm:p-8">
          <h2 className="text-[clamp(1.4rem,2.4vw,1.9rem)] font-bold leading-tight tracking-tight text-theme-primary">{question.title}</h2>
          {question.hint && <p className="mt-2 text-sm text-theme-secondary">{question.hint}</p>}

          <div className="mt-6 space-y-7">
            {visibleParts(question, answers).map((part) => {
              const options = part.field === "goals" ? goalOptionsFor(context) : resolveOptions(part, answers);
              const value = answers[part.field];
              const selectedValues = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
              const atMax = part.kind === "multi" && part.max !== undefined && selectedValues.filter((v) => !part.exclusive?.includes(v)).length >= part.max;
              return (
                <div key={part.field}>
                  {part.label && <p className="mb-3 text-sm font-medium text-theme-primary">{part.label}</p>}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role={part.kind === "multi" ? "group" : "radiogroup"} aria-label={part.label ?? question.title}>
                    {options.map((o) => {
                      const selected = selectedValues.includes(o.value);
                      return (
                        <OptionButton
                          key={o.value}
                          label={o.label}
                          hint={o.hint}
                          selected={selected}
                          multi={part.kind === "multi"}
                          disabled={atMax && !selected && !part.exclusive?.includes(o.value)}
                          onClick={() => choose(question, part, o.value)}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={goBack}
                disabled={stack.length === 0}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-secondary hover:text-theme-primary disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </button>
              {stack.length > 0 && (
                <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-secondary hover:text-theme-primary">
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Start again
                </button>
              )}
            </div>
            <button
              type="button"
              disabled={!isQuestionComplete(question, answers)}
              onClick={() => goNext(answers, question.id)}
              className="group inline-flex h-11 items-center gap-2.5 rounded-full bg-emerald-600 pl-6 pr-1.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-500 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              Continue
              <span className="flex size-8 items-center justify-center rounded-full bg-white text-emerald-700">
                <ArrowRight className="size-4" aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
