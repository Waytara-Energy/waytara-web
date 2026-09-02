import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFaultInfo } from "@/lib/deye-fault-codes";

/** Decoded `active_fault_code` callout — used by both Overview (prominent,
 *  above the fold) and Maintenance (as the device's current fault status).
 *  Renders nothing when the code is 0/null, so callers can drop it in
 *  unconditionally. */
export function FaultBanner({ faultCode }: { faultCode: number | null }) {
  const fault = getFaultInfo(faultCode ?? 0);
  if (!fault) return null;

  return (
    <Alert variant={fault.severity === "critical" ? "destructive" : "default"}>
      <TriangleAlert />
      <AlertTitle>
        {fault.code} — {fault.label}
      </AlertTitle>
      <AlertDescription>
        <p>{fault.description}</p>
        <p className="font-medium text-foreground">{fault.solution}</p>
      </AlertDescription>
    </Alert>
  );
}
