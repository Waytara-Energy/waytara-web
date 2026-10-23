/** The pattern of a gap on a chart: pale red diagonal lines, no box and no text. Drawn once inside the chart's <defs>; the band uses `fill="url(#id)"`. */
export function GapHatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--destructive)" fillOpacity={0.05} />
      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--destructive)" strokeOpacity={0.5} strokeWidth={1.5} />
    </pattern>
  );
}
