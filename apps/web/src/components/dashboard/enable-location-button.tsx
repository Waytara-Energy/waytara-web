"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/** Feeds sites.latitude/longitude into the Site Setting form's hidden
 *  inputs via the browser's own Geolocation API — the customer grants
 *  permission once, we never ask them to type coordinates. Lives inside
 *  the existing server-rendered <form> as a small client island; the
 *  hidden inputs submit normally alongside every other field. */
export function EnableLocationButton({ initialLatitude, initialLongitude }: { initialLatitude: number | null; initialLongitude: number | null }) {
  const [latitude, setLatitude] = React.useState(initialLatitude);
  const [longitude, setLongitude] = React.useState(initialLongitude);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");

  function enableLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setStatus("idle");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="space-y-1.5">
      <input type="hidden" name="latitude" value={latitude ?? ""} />
      <input type="hidden" name="longitude" value={longitude ?? ""} />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={enableLocation} disabled={status === "loading"}>
          {status === "loading" ? "Locating…" : latitude !== null ? "Update location" : "Enable location"}
        </Button>
        {latitude !== null && longitude !== null && (
          <span className="text-xs text-muted-foreground">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        )}
      </div>
      {status === "error" && (
        <p className="text-xs text-destructive">Couldn&apos;t get your location — check your browser&apos;s location permission.</p>
      )}
    </div>
  );
}
