"use client";

import * as React from "react";

export interface SunTimeLabelProps {
  viewBox?: { x?: number; y?: number; width?: number; height?: number };
  type: "sunrise" | "sunset";
  timeText: string;
}

/**
 * Apple Weather-inspired minimal pill badge drawn at the top of today's sunrise/sunset vertical line.
 * Styled with subtle glassmorphism, crisp vector sun icons, and clean typography.
 */
export function SunTimeLabel({ viewBox, type, timeText }: SunTimeLabelProps) {
  const x = viewBox?.x ?? 0;
  const y = (viewBox?.y ?? 0) + 4;
  const chartWidth = viewBox?.width ?? 500;

  const isSunrise = type === "sunrise";
  const color = isSunrise ? "#f59e0b" : "#f97316";
  const bg = isSunrise ? "rgba(245, 158, 11, 0.14)" : "rgba(249, 115, 22, 0.14)";
  const border = isSunrise ? "rgba(245, 158, 11, 0.42)" : "rgba(249, 115, 22, 0.42)";
  const title = isSunrise ? "Sunrise" : "Sunset";

  const pillWidth = 104;
  const pillHeight = 22;

  // Keep badge inside the chart area
  const minX = 4;
  const maxX = Math.max(minX, chartWidth - pillWidth - 4);
  const pillX = Math.max(minX, Math.min(maxX, x - pillWidth / 2));

  return (
    <g transform={`translate(${pillX}, ${y})`} style={{ pointerEvents: "none", userSelect: "none" }}>
      {/* Frosted card backdrop */}
      <rect
        x={0}
        y={0}
        width={pillWidth}
        height={pillHeight}
        rx={11}
        fill="var(--card)"
        fillOpacity={0.92}
        stroke={border}
        strokeWidth={1}
      />
      {/* Apple Weather ambient tint */}
      <rect
        x={0}
        y={0}
        width={pillWidth}
        height={pillHeight}
        rx={11}
        fill={bg}
      />

      {/* Vector Icon */}
      {isSunrise ? (
        // Apple Weather Sunrise icon
        <g transform="translate(7.5, 4.5)" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 9h11" />
          <path d="M3.5 7.5a3 3 0 0 1 6 0" fill={color} fillOpacity={0.25} />
          <path d="M6.5 1v3" />
          <path d="m4.2 3.2.8.8" />
          <path d="m8.8 3.2-.8.8" />
        </g>
      ) : (
        // Apple Weather Sunset icon
        <g transform="translate(7.5, 4.5)" stroke={color} fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 9h11" />
          <path d="M3.5 7.5a3 3 0 0 1 6 0" fill={color} fillOpacity={0.25} />
          <path d="M6.5 2v3" />
          <path d="m4.8 5 1.7 1.7 1.7-1.7" />
        </g>
      )}

      {/* Label text */}
      <text
        x={24}
        y={14.5}
        fontSize={9.5}
        fontWeight={600}
        fill="var(--foreground)"
        letterSpacing="-0.01em"
        style={{ fontFamily: "inherit" }}
      >
        <tspan fill={color} fontWeight={700}>{title}</tspan>{" "}
        <tspan fill="var(--muted-foreground)">{timeText}</tspan>
      </text>
    </g>
  );
}
