import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type CardTone = "neutral" | "primary" | "amber" | "emerald" | "sky" | "violet";

/** The colour of a round icon: the same accents the Monitoring, Performance and Maintenance tabs use. */
export const TONE_CIRCLE: Record<CardTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

/** A card in the page's own style (the one Maintenance's Checks and Temperatures use): a small bold title, then the content. */
export function DeviceCard({ title, description, className, children }: { title: string; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
