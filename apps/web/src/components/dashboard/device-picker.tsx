import Link from "next/link";
import { cn } from "@/lib/utils";
import { deviceDisplayId, type CustomerDevice } from "@/lib/selected-site";

/** A site can have more than one device now, so device-scoped pages
 *  (Analytics, Monitoring, Performance, Instrument Settings, Maintenance)
 *  each need their own picker — there's no single global "current device"
 *  flowing through the whole dashboard anymore. Plain `?device=` links
 *  rather than a client dropdown: each page already resolves its device
 *  from its own searchParams server-side, so this needs no client state or
 *  server action of its own. Renders nothing when the site only has one
 *  device — the common case, where a picker would just be noise. */
export function DevicePicker({ devices, selectedId }: { devices: CustomerDevice[]; selectedId: string }) {
  if (devices.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {devices.map((d) => (
        <Link
          key={d.id}
          href={`?device=${d.id}`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            d.id === selectedId
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {deviceDisplayId(d)}
        </Link>
      ))}
    </div>
  );
}
