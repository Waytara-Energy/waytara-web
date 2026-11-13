"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { useTheme } from "next-themes";
import { buildingAt } from "@/lib/geo";
import { SITE_BUILDING_SOURCE, mapStyle, type MapTheme } from "@/lib/map-style";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";

/** How the map is tilted and how close it is: near enough to see the building and its neighbours. */
const VIEW = { zoom: 17.6, pitch: 58, bearing: -17 };

/**
 * The site on a small 3D map, as a tile for the Overview: the same map as the Devices page (our own light and dark style on OpenFreeMap's tiles, raised
 * buildings), tilted, with the site's own building painted green. It is a still picture: it does not turn and it cannot be moved, so a swipe or a scroll over it
 * is the page's; pressing it opens the Devices page, where the location is set. The map is made only when the tile comes into view (a phone allows only a few
 * maps at once).
 */
export function SiteMapCard({ latitude, longitude, siteName, className }: { latitude: number | null; longitude: number | null; siteName: string; className?: string }) {
  const box = React.useRef<HTMLDivElement>(null);
  const tile = React.useRef<HTMLAnchorElement>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const builtKey = React.useRef("");
  const { resolvedTheme } = useTheme();
  const theme: MapTheme = resolvedTheme === "dark" ? "dark" : "light";
  const themeKnown = resolvedTheme !== undefined;
  const themeRef = React.useRef(theme);
  const [shown, setShown] = React.useState(false);
  const [drawn, setDrawn] = React.useState(false);
  const hasSite = latitude !== null && longitude !== null;

  // the map is made once the tile has been in view
  React.useEffect(() => {
    const el = tile.current;
    if (!el || !hasSite) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown(true);
      },
      { rootMargin: "200px" }
    );
    watcher.observe(el);
    return () => watcher.disconnect();
  }, [hasSite]);

  /** Paints the building under the site green: its outline is read from what the map has drawn and handed to the style's own layers. */
  const syncBuilding = React.useCallback(() => {
    const map = mapRef.current;
    const source = map?.getSource(SITE_BUILDING_SOURCE) as import("maplibre-gl").GeoJSONSource | undefined;
    if (!map || !source || !map.getLayer("buildings") || latitude === null || longitude === null) return;
    const at = map.project([longitude, latitude]);
    const hits = map.queryRenderedFeatures([[at.x - 14, at.y - 14], [at.x + 14, at.y + 14]], { layers: ["buildings"] });
    const building = buildingAt(hits.map((h) => h.geometry), { lat: latitude, lng: longitude });
    const outline = building ? JSON.stringify(building.coordinates) : "";
    const key = outline ? `${outline.length}:${outline.slice(0, 80)}` : "";
    if (key === builtKey.current) return;
    builtKey.current = key;
    // the green building takes the height of the one it covers (a tall building would otherwise hide the green inside itself)
    const own = building
      ? hits.find((h) => (h.geometry.type === "Polygon" ? h.geometry.coordinates === building.coordinates : h.geometry.type === "MultiPolygon" && (h.geometry.coordinates as unknown[]).includes(building.coordinates)))
      : undefined;
    const properties = { render_height: own?.properties?.render_height ?? null, render_min_height: own?.properties?.render_min_height ?? null };
    source.setData({ type: "FeatureCollection", features: building ? [{ type: "Feature", geometry: building, properties }] : [] });
  }, [latitude, longitude]);

  React.useEffect(() => {
    if (!shown || !themeKnown || !hasSite) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      // the library cannot find its own worker once the bundler has moved it: it is served from this site (copied by scripts/copy-map-worker.mjs)
      ml.setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
      map = new ml.Map({
        container: box.current,
        style: mapStyle(themeRef.current, true),
        center: [longitude as number, latitude as number],
        zoom: VIEW.zoom,
        pitch: VIEW.pitch,
        bearing: VIEW.bearing,
        interactive: false,
        attributionControl: { compact: true },
        fadeDuration: 0,
      });
      // the credit stays, as a small "i" (the compact credit opens by itself on a wide map)
      const fold = () => box.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      map.on("style.load", () => {
        builtKey.current = "";
        fold();
      });
      // The building is looked for as the tiles arrive (until it is found) and once the map is still.
      map.on("idle", () => {
        fold();
        syncBuilding();
      });
      map.on("sourcedata", (e) => {
        if (e.sourceId === "openmaptiles" && e.isSourceLoaded && !builtKey.current) syncBuilding();
      });
      map.on("load", () => {
        if (cancelled) return;
        fold();
        syncBuilding();
        setDrawn(true);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setDrawn(false);
    };
    // made once for this place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, themeKnown, hasSite, latitude, longitude]);

  // the map follows the app's theme live
  React.useEffect(() => {
    themeRef.current = theme;
    const map = mapRef.current;
    if (map && drawn) map.setStyle(mapStyle(theme, true));
  }, [theme, drawn]);

  if (!hasSite) {
    return (
      <Link href="/dashboard/devices" data-widget className={cn("group relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border p-4 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
        <span className="grid size-10 place-items-center rounded-full bg-muted text-foreground">
          <MapPin className="size-5" />
        </span>
        <span className="text-sm font-medium text-foreground">{siteName}</span>
        <span className="text-xs text-muted-foreground">Set the site&apos;s location to see it here</span>
      </Link>
    );
  }

  return (
    <Link ref={tile} href="/dashboard/devices" data-widget aria-label={`${siteName} on the map. Open the devices and the site's location.`} className={cn("group relative block min-h-0 min-w-0 overflow-hidden rounded-2xl border border-border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <div ref={box} aria-hidden="true" className={cn("absolute inset-0 transition-opacity duration-700", drawn ? "opacity-100" : "opacity-0")} />
      <span aria-hidden="true" className="absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-md transition-colors group-hover:bg-emerald-500 group-hover:text-white">
        <ArrowUpRight className="size-3.5" />
      </span>
    </Link>
  );
}
