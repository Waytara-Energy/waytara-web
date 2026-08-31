"use client";

import * as React from "react";

export interface SitePoint {
  siteId: string;
  label: string;
  value: number;
}

const CHART_HEIGHT = 200;
const BAR_MAX_WIDTH = 24;
const GAP = 2; // surface-color gap between bars, per dataviz spacer spec
const PADDING = { top: 24, right: 12, bottom: 32, left: 12 };

/**
 * Cross-site magnitude comparison — bars, one hue (sequential job: these
 * are the same metric across different entities, not distinct series), no
 * legend needed. Bar is the hit target: no crosshair, per-bar hover only.
 */
export function SiteComparisonChart({ sites, unit = "kWh" }: { sites: SitePoint[]; unit?: string }) {
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  if (sites.length === 0) return null;

  const maxValue = Math.max(1, ...sites.map((s) => s.value));
  const width = Math.max(320, sites.length * (BAR_MAX_WIDTH + 40));
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const slotWidth = (width - PADDING.left - PADDING.right) / sites.length;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        width={width}
        className="max-w-full"
        role="img"
        aria-label="Energy yield comparison across sites, last 30 days"
      >
        {/* baseline */}
        <line
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={PADDING.top + plotHeight}
          y2={PADDING.top + plotHeight}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {sites.map((site, i) => {
          const barWidth = Math.min(BAR_MAX_WIDTH, slotWidth - GAP * 2);
          const slotCenter = PADDING.left + slotWidth * i + slotWidth / 2;
          const barHeight = (site.value / maxValue) * plotHeight;
          const y = PADDING.top + plotHeight - barHeight;
          const isHovered = hoverId === site.siteId;

          return (
            <g key={site.siteId}>
              {/* value at the tip */}
              <text
                x={slotCenter}
                y={y - 6}
                textAnchor="middle"
                className="fill-theme-primary text-[10px] font-medium"
              >
                {site.value.toFixed(1)}
              </text>
              <rect
                x={slotCenter - barWidth / 2}
                y={y}
                width={barWidth}
                height={Math.max(1, barHeight)}
                rx={4}
                fill="var(--highlight)"
                opacity={isHovered ? 0.85 : 1}
                onPointerEnter={() => setHoverId(site.siteId)}
                onPointerLeave={() => setHoverId(null)}
                style={{ cursor: "pointer" }}
              />
              <text
                x={slotCenter}
                y={PADDING.top + plotHeight + 16}
                textAnchor="middle"
                className="fill-theme-muted text-[10px]"
              >
                {site.label.length > 14 ? `${site.label.slice(0, 13)}…` : site.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverId && (
        <p className="mt-1 text-xs text-theme-muted">
          {sites.find((s) => s.siteId === hoverId)?.label}:{" "}
          <span className="font-medium text-theme-primary">
            {sites.find((s) => s.siteId === hoverId)?.value.toFixed(1)} {unit}
          </span>
        </p>
      )}
    </div>
  );
}
