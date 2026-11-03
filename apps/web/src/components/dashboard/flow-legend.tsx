"use client";

import * as React from "react";
import { FLOW_COLOR, type FlowTone } from "./energy-flow-diagram";

const ROWS: { tone: FlowTone; label: string; text: string }[] = [
  { tone: "producing", label: "Producing · charging", text: "Energy is being made or stored" },
  { tone: "drawing", label: "Importing · discharging", text: "Energy is being drawn in or released" },
  { tone: "consuming", label: "Consuming · exporting", text: "Energy is being used or sent out" },
  { tone: "idle", label: "Idle", text: "Nothing is flowing" },
];

/** The colour key of the energy-flow drawing: what each colour of its lines and circles means. It sits in the dashboard sidebar, in the
 *  sidebar's own colours (its row there carries the title, so none is repeated here). */
export function FlowLegend() {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <div className="w-full space-y-2.5" role="group" aria-label="Energy flow colours">
      <ul className="space-y-2.5">
        {ROWS.map((r) => (
          <li key={r.tone} className="flex items-start gap-3">
            <span className="mt-[7px] h-[3px] w-6 shrink-0 rounded-full" style={{ background: `linear-gradient(90deg, ${FLOW_COLOR[r.tone]}, ${FLOW_COLOR[r.tone]}1a)` }} />
            <span className="min-w-0">
              <span className="block text-xs font-medium leading-tight text-sidebar-foreground">{r.label}</span>
              <span className="block text-xs leading-snug text-sidebar-foreground/60">{r.text}</span>
            </span>
          </li>
        ))}
        <li className="flex items-start gap-3">
          <svg viewBox="-6 -6 12 12" className="mt-0.5 size-4 shrink-0 ml-1 mr-1" aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-offl`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fca5a5" />
                <stop offset="0.5" stopColor="#ef4444" />
                <stop offset="1" stopColor="#b91c1c" />
              </linearGradient>
            </defs>
            <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" stroke={`url(#${uid}-offl)`} strokeWidth={2.4} strokeLinecap="round" fill="none" />
          </svg>
          <span className="min-w-0">
            <span className="block text-xs font-medium leading-tight text-sidebar-foreground">Not in use</span>
            <span className="block text-xs leading-snug text-sidebar-foreground/60">The device is not in use</span>
          </span>
        </li>
      </ul>
    </div>
  );
}
