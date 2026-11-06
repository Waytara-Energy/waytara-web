"use client";

import * as React from "react";
import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { useTheme } from "next-themes";
import { buildingAt } from "@/lib/geo";
import { SITE_BUILDING_SOURCE, mapStyle, type MapTheme } from "@/lib/map-style";
import { SITE } from "@/lib/site";
import "maplibre-gl/dist/maplibre-gl.css";

/** The office: WayTara Energy LLP, 3rd floor, on Dr. Radhakrishnan Salai in Mylapore (the exact spot is in lib/site.ts). */
const OFFICE = { lat: SITE.geo.latitude, lng: SITE.geo.longitude };
const DIRECTIONS = SITE.mapUrl;
const ZOOM = 17.8;
/** The 3D view: tilted and turned a little, and kept that way (it does not spin). */
const TILT = { pitch: 55, bearing: -17 };

/** The map of where to find us: the same OpenFreeMap tiles and WayTara look as the dashboard's site map, with the office building in green.
 *  It loads only when it comes into view. If the map cannot be drawn (no WebGL, tiles blocked) the address and contacts still show. */
export function OfficeMap() {
  const box = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const { resolvedTheme } = useTheme();
  const themeKnown = resolvedTheme !== undefined;
  const theme: MapTheme = resolvedTheme === "dark" ? "dark" : "light";
  const themeRef = React.useRef(theme);
  const [visible, setVisible] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Start loading the map only when it is about to be seen.
  React.useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      void Promise.resolve().then(() => setVisible(true));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible || !themeKnown) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    void (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !box.current) return;
        // The library cannot find its own worker once the bundler has moved it: it is served from this site (scripts/copy-map-worker.mjs).
        ml.setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
        map = new ml.Map({
          container: box.current,
          style: mapStyle(themeRef.current, true),
          center: [OFFICE.lng, OFFICE.lat],
          zoom: ZOOM,
          maxZoom: 19.5,
          minZoom: 12,
          // a 3D map: the buildings are raised and the office building is raised in green; it stays as set (no spinning, no turning by hand)
          pitch: TILT.pitch,
          bearing: TILT.bearing,
          maxPitch: 70,
          dragRotate: false,
          touchPitch: false,
          pitchWithRotate: false,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        // The office building in green, like the site map in the dashboard: its outline is read from what the map has drawn and handed to the style's own
        // layers (flat and raised: the style's own layers show it both ways). The nearest building within 30 m counts, in case the point sits just outside its outline.
        let built = "";
        map.on("style.load", () => (built = ""));
        map.on("idle", () => {
          const m = map;
          const source = m?.getSource(SITE_BUILDING_SOURCE) as import("maplibre-gl").GeoJSONSource | undefined;
          if (!m || !source || !m.getLayer("buildings") || m.getZoom() < 15) return;
          const at = m.project([OFFICE.lng, OFFICE.lat]);
          const hits = m.queryRenderedFeatures([[at.x - 60, at.y - 60], [at.x + 60, at.y + 60]], { layers: ["buildings"] });
          const building = buildingAt(hits.map((h) => h.geometry), OFFICE, 30);
          const outline = building ? JSON.stringify(building.coordinates) : "";
          const key = outline ? `${outline.length}:${outline.slice(0, 80)}` : "";
          if (key === built) return;
          built = key;
          source.setData({ type: "FeatureCollection", features: building ? [{ type: "Feature", geometry: building, properties: {} }] : [] });
        });
        mapRef.current = map;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is made once; a theme change is applied by the effect below.
  }, [visible, themeKnown]);

  // The map follows the site's light or dark theme.
  React.useEffect(() => {
    themeRef.current = theme;
    mapRef.current?.setStyle(mapStyle(theme, true));
  }, [theme]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-theme-surface">
      <div className="relative h-[340px] sm:h-[420px] lg:h-[520px]">
        {/* the library's stylesheet makes the map element position: relative, so it sits in a full-size wrapper */}
        <div className="absolute inset-0" role="region" aria-label="Map showing the WayTara office in Mylapore, Chennai">
          <div ref={box} className="h-full w-full" />
        </div>
        {failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-theme-surface px-6 text-center text-sm text-theme-secondary">
            The map could not be shown. Use “Open in Google Maps” for directions.
          </div>
        )}
      </div>

      {/* The address: floated over the map on a wide screen, under it on a phone. */}
      <div className="p-6 sm:p-8 lg:pointer-events-none lg:absolute lg:inset-y-6 lg:left-6 lg:flex lg:w-[360px] lg:items-end lg:p-0">
        <div className="space-y-5 lg:pointer-events-auto lg:w-full lg:rounded-2xl lg:border lg:border-theme-border lg:bg-theme-bg/85 lg:p-6 lg:shadow-lg lg:backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <MapPin className="mt-1 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div>
              <p className="text-base font-bold tracking-tight text-theme-primary">WayTara Energy LLP</p>
              <p className="mt-1 text-sm leading-relaxed text-theme-secondary">
                {SITE.address.streetAddress.replace(/, Mylapore$/, "")}, Mylapore, {SITE.address.addressLocality},{" "}
                {SITE.address.addressRegion} {SITE.address.postalCode}
              </p>
            </div>
          </div>
          <div className="space-y-2.5 border-t border-theme-border pt-5 text-sm">
            <a href={SITE.phoneHref} className="flex items-center gap-3 text-theme-primary underline-offset-4 hover:underline">
              <Phone className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              {SITE.phone}
            </a>
            <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-theme-primary underline-offset-4 hover:underline">
              <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              {SITE.whatsappPhone} (WhatsApp)
            </a>
            <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 text-theme-primary underline-offset-4 hover:underline">
              <Mail className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              {SITE.email}
            </a>
          </div>
          <a href={DIRECTIONS} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-theme-highlight underline-offset-4 hover:underline">
            Open in Google Maps
            <ExternalLink className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
