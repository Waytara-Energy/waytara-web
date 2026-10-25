// How the person wants charts drawn, chosen in Application Settings and kept in a cookie: "auto" (each chart in the style that suits
// it - lines for readings through a day, bars for daily totals), or "line" / "bar" for every chart.

export type ChartStyle = "line" | "auto" | "bar";

export const CHART_STYLE_COOKIE = "chart_style";
export const CHART_STYLES: ChartStyle[] = ["line", "auto", "bar"];

export function parseChartStyle(value: string | null | undefined): ChartStyle {
  return value === "auto" || value === "bar" ? value : "line";
}

/** The style a chart is drawn in: the person's choice, or the chart's own natural one when they left it on automatic. */
export function resolveKind(style: ChartStyle, natural: "line" | "bar"): "line" | "bar" {
  return style === "auto" ? natural : style;
}

export function chartStyleCookie(style: ChartStyle): string {
  return `${CHART_STYLE_COOKIE}=${style}; path=/; max-age=31536000; samesite=lax`;
}
