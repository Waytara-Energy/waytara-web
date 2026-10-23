"use client";

import * as React from "react";
import { ArrowLeft, Crosshair, Loader2, LocateFixed, MapPin, Pencil, Search, ShieldAlert, X } from "lucide-react";
import { useTheme } from "next-themes";
import { withPromiseToast } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildingAt, distanceMeters, distanceText } from "@/lib/geo";
import type { Place } from "@/lib/geocode";
import { BUILDINGS_3D_LAYER, SITE_BUILDING_3D_LAYER, SITE_BUILDING_SOURCE, mapStyle, type MapTheme } from "@/lib/map-style";
import { saveSite } from "@/app/dashboard/devices/actions";
import { cn } from "@/lib/utils";
import { AboutRows } from "./device-about";
import { GLASS } from "./glass";
import "maplibre-gl/dist/maplibre-gl.css";

// The tiles are OpenFreeMap's (free, no key, commercial use allowed; the credit is shown by the map itself); the look is our own, in
// lib/map-style.ts: light and dark like the app, buildings that can be raised, and the site's own building in green.
const INDIA: [number, number] = [78.96, 20.59];
/** The map must be this close (zoom) before a spot can be saved: the pin has to be on the building, not on a district. */
const MIN_SAVE_ZOOM = 16;
/** The pin counts as moved when it is further than this (metres) from the saved location. */
const MOVED_M = 3;
/** Typed address text is kept until the pin has moved this far (metres) from where it was typed. */
const KEEP_TYPED_M = 25;
/** The customer counts as at the site when their position is this close (metres) to it. */
const ON_SITE_M = 150;
/** The GPS reading is good enough to stop refining at this accuracy (metres). */
const GOOD_FIX_M = 25;
/** The GPS reading is too rough to trust at this accuracy (metres): the customer is asked to place the pin by hand. */
const POOR_FIX_M = 100;
/** How the map is tilted when 3D is on. */
const TILT_3D = { pitch: 58, bearing: -17 };
/** How close the map is to the site by default (zoom): near enough to see the building and its neighbours. */
const SITE_ZOOM = 18.5;
/** On opening, and on Recenter, the map makes one slow turn around the site (3D only): one full turn in this many seconds. */
const SPIN_SECONDS = 60;
/** The shortest distance (degrees) between two bearings. */
const bearingGap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

type Permission = "checking" | "granted" | "prompt" | "denied" | "unsupported";
type Lookup = "idle" | "loading" | "unavailable" | "ready";
type Point = { lat: number; lng: number };

export interface SiteAddressFields {
  line1: string;
  city: string;
  state: string;
  pincode: string;
}
const EMPTY: SiteAddressFields = { line1: "", city: "", state: "", pincode: "" };
const fromPlace = (p: Place): SiteAddressFields => ({ line1: p.line1 ?? "", city: p.city ?? "", state: p.state ?? "", pincode: p.pincode ?? "" });

const mainLine = (p: Place) => p.line1 ?? p.label.split(",")[0];
const restLine = (p: Place) => [p.city, p.state, p.pincode].filter(Boolean).join(", ");

/** The site on the map. It is only a picture until the customer presses Edit location (or while no location is saved yet): then the map can
 *  be moved under a fixed pin, searched, or set from their own position, the address at the pin fills in (and can be corrected), and nothing
 *  is saved until they press Save. The site is shown only by its own building in green (no markers), and the card says how far away it is. */
export function SiteLocation({
  deviceId,
  siteName,
  deviceLabel,
  deviceName,
  latitude,
  longitude,
  address,
  kind,
  devices,
}: {
  deviceId: string;
  siteName: string;
  /** The device's own name for the header menu, if it has one; `deviceName` is what it is called otherwise. */
  deviceLabel: string | null;
  deviceName: string;
  latitude: number | null;
  longitude: number | null;
  address: Partial<SiteAddressFields> | null;
  /** The card of what kind of site it is (property type, power source, EV charger), shown above the details; rendered by the page. */
  kind?: React.ReactNode;
  /** The site's devices with their status, shown under the address; rendered by the page. */
  devices?: React.ReactNode;
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<import("maplibre-gl").Map | null>(null);
  const watchRef = React.useRef<number | null>(null);
  const followRef = React.useRef<{ until: number } | null>(null);
  const targetRef = React.useRef<Point | null>(null);
  const builtKey = React.useRef("");
  const { resolvedTheme } = useTheme();
  const themeKnown = resolvedTheme !== undefined;
  const theme: MapTheme = resolvedTheme === "dark" ? "dark" : "light";
  const [threeD, setThreeD] = React.useState(true);
  // What the map was last given, so a theme change keeps the 3D choice and a late-created map starts right.
  const lookRef = React.useRef({ theme, threeD });
  const saved: Point | null = latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null;
  const savedAddress = React.useMemo<SiteAddressFields>(() => ({ ...EMPTY, line1: address?.line1 ?? "", city: address?.city ?? "", state: address?.state ?? "", pincode: address?.pincode ?? "" }), [address?.line1, address?.city, address?.state, address?.pincode]);

  const [editing, setEditing] = React.useState(!saved);
  // Editing is two steps, like a delivery app's address: place the pin on the map, then check the names and the address.
  const [step, setStep] = React.useState<"pin" | "details">("pin");
  const [ready, setReady] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const [center, setCenter] = React.useState<(Point & { zoom: number }) | null>(null);
  const [fields, setFields] = React.useState<SiteAddressFields>(savedAddress);
  const [names, setNames] = React.useState({ siteName, deviceLabel: deviceLabel ?? "" });
  const [lookup, setLookup] = React.useState<Lookup>("idle");
  const [permission, setPermission] = React.useState<Permission>("checking");
  const [userPos, setUserPos] = React.useState<(Point & { accuracy: number }) | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [saving, startSaving] = React.useTransition();
  // Where the pin was when the customer last typed in the address, so a small nudge does not wipe what they typed.
  const typedAt = React.useRef<Point | null>(null);
  // Set when the address must be read from the map at once, even if the pin is where the site already is (Use my location, a search result).
  const forceFill = React.useRef(false);
  const [lookupTick, setLookupTick] = React.useState(0);

  /** Paints the building under the target (the saved site, or the pin while editing) green: the building's outline is read from what the
   *  map has drawn and handed to the style's own layers. */
  const syncBuilding = React.useCallback(() => {
    const map = mapRef.current;
    const source = map?.getSource(SITE_BUILDING_SOURCE) as import("maplibre-gl").GeoJSONSource | undefined;
    if (!map || !source || !map.getLayer("buildings")) return;
    const target = targetRef.current;
    let building: ReturnType<typeof buildingAt> = null;
    if (target && map.getZoom() >= 15) {
      // The buildings drawn around the target (a tile holds many as one shape, so the one the target is in is picked out of them).
      const at = map.project([target.lng, target.lat]);
      const hits = map.queryRenderedFeatures([[at.x - 14, at.y - 14], [at.x + 14, at.y + 14]], { layers: ["buildings"] });
      building = buildingAt(hits.map((h) => h.geometry), target);
    }
    const outline = building ? JSON.stringify(building.coordinates) : "";
    const key = outline ? `${outline.length}:${outline.slice(0, 80)}` : "";
    if (key === builtKey.current) return;
    builtKey.current = key;
    source.setData({ type: "FeatureCollection", features: building ? [{ type: "Feature", geometry: building, properties: {} }] : [] });
  }, []);

  // The map, made once (when the theme is known, so it never starts in the wrong one).
  React.useEffect(() => {
    if (!themeKnown) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      // The library cannot find its own worker once the bundler has moved it: serve it from this site (copied by scripts/copy-map-worker.mjs).
      ml.setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${ml.getVersion()}`);
      map = new ml.Map({
        container: box.current,
        style: mapStyle(lookRef.current.theme, lookRef.current.threeD),
        center: saved ? [saved.lng, saved.lat] : INDIA,
        zoom: saved ? SITE_ZOOM : 4,
        maxZoom: 20,
        // Tilted from the start when 3D is on (the default); flat otherwise.
        pitch: lookRef.current.threeD ? TILT_3D.pitch : 0,
        bearing: lookRef.current.threeD ? TILT_3D.bearing : 0,
        maxPitch: 75,
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        attributionControl: { compact: true },
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
      const read = () => {
        const c = map?.getCenter();
        if (c && map) setCenter({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
      };
      map.on("movestart", () => setMoving(true));
      map.on("moveend", () => {
        setMoving(false);
        read();
      });
      // A new style (the theme changed) starts with no building painted; once the map has drawn, paint it again.
      map.on("style.load", () => (builtKey.current = ""));
      map.on("idle", syncBuilding);
      map.on("load", () => {
        if (cancelled) return;
        setReady(true);
        read();
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // The map is made once for this site (the page keys it on the device).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKnown]);

  // The map follows the app's theme (light or dark) live.
  React.useEffect(() => {
    lookRef.current = { ...lookRef.current, theme };
    const map = mapRef.current;
    if (map && ready) map.setStyle(mapStyle(theme, lookRef.current.threeD));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  /** The slow turn: three eased steps of 120 degrees (one step cannot be more than half a turn), stopped by anything the person does. */
  const spinning = React.useRef(false);
  const stopSpin = React.useCallback(() => {
    if (!spinning.current) return;
    spinning.current = false;
    mapRef.current?.stop();
  }, []);
  const startSpin = React.useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    spinning.current = true;
    let done = 0;
    const next = () => {
      const m = mapRef.current;
      if (!m || !spinning.current || done >= 3) {
        spinning.current = false;
        return;
      }
      done++;
      const expected = m.getBearing() + 120;
      m.easeTo({ bearing: expected, duration: (SPIN_SECONDS * 1000) / 3, easing: (t) => t, essential: true });
      m.once("moveend", () => {
        // a step that did not reach its end was cut short by the person: the turn is over
        if (bearingGap(m.getBearing(), expected) > 1.5) spinning.current = false;
        next();
      });
    };
    next();
  }, []);

  // On opening, once the map has drawn: one slow turn around the saved site (3D only; not while a site is being set up).
  const spunOnce = React.useRef(false);
  React.useEffect(() => {
    if (!ready || spunOnce.current) return;
    spunOnce.current = true;
    if (!saved || !lookRef.current.threeD || editing) return;
    const timer = window.setTimeout(startSpin, 800);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Moving, zooming or touching the map stops the turn.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const halt = () => stopSpin();
    for (const e of ["mousedown", "touchstart", "wheel", "dragstart", "zoomstart"] as const) map.on(e, halt);
    return () => {
      for (const e of ["mousedown", "touchstart", "wheel", "dragstart", "zoomstart"] as const) map.off(e, halt);
    };
  }, [ready, stopSpin]);

  /** Back to the site at the default zoom and pose, then the turn again (in 3D). */
  const recenter = React.useCallback(() => {
    const map = mapRef.current;
    const target = saved ?? (userPos ? { lat: userPos.lat, lng: userPos.lng } : null);
    if (!map || !target) return;
    stopSpin();
    const tilt = lookRef.current.threeD;
    map.flyTo({ center: [target.lng, target.lat], zoom: SITE_ZOOM, pitch: tilt ? TILT_3D.pitch : 0, bearing: tilt ? TILT_3D.bearing : 0, speed: 1.4, essential: true });
    if (tilt && !editing) {
      map.once("moveend", () => {
        const c = map.getCenter();
        if (distanceMeters({ lat: c.lat, lng: c.lng }, target) < 5) startSpin();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, userPos, editing, startSpin, stopSpin]);

  // The map and anything that moves it by itself stop the turn when the page goes.
  React.useEffect(() => () => stopSpin(), [stopSpin]);

  // 3D: the buildings rise and the map tilts (and, while editing, can be turned); back to 2D it lies flat again, facing north.
  React.useEffect(() => {
    lookRef.current = { ...lookRef.current, threeD };
    const map = mapRef.current;
    if (!map || !ready) return;
    const visibility = threeD ? "visible" : "none";
    for (const layer of [BUILDINGS_3D_LAYER, SITE_BUILDING_3D_LAYER]) if (map.getLayer(layer)) map.setLayoutProperty(layer, "visibility", visibility);
    if (!threeD) stopSpin();
    // the map already starts in the wanted pose (3D by default): nothing to ease
    const wantPitch = threeD ? TILT_3D.pitch : 0;
    const wantBearing = threeD ? TILT_3D.bearing : 0;
    if (Math.abs(map.getPitch() - wantPitch) > 1 || bearingGap(map.getBearing(), wantBearing) > 1) map.easeTo({ pitch: wantPitch, bearing: wantBearing, duration: threeD ? 700 : 500 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threeD, ready]);

  // The map can always be moved and zoomed (the saved site keeps its own icon where it is); turning and tilting by hand only in 3D.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (threeD) {
      map.dragRotate.enable();
      map.touchPitch.enable();
      map.touchZoomRotate.enableRotation();
    } else {
      map.dragRotate.disable();
      map.touchPitch.disable();
      map.touchZoomRotate.disableRotation();
    }
  }, [ready, threeD]);

  // The green building follows what matters: the saved site, or the pin while editing.
  React.useEffect(() => {
    targetRef.current = editing ? (center ?? saved) : saved;
    syncBuilding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, center, latitude, longitude, ready]);

  const stopFollowing = React.useCallback(() => {
    followRef.current = null;
    setLocating(false);
  }, []);

  // The customer's position: watched for as long as the page is open, so the distance is always current.
  const startWatch = React.useCallback(() => {
    if (watchRef.current !== null || !("geolocation" in navigator)) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        setPermission("granted");
        const here = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        setUserPos(here);
        const map = mapRef.current;
        if (followRef.current && Date.now() < followRef.current.until && map) {
          map.flyTo({ center: [here.lng, here.lat], zoom: Math.max(map.getZoom(), 17.5), speed: 1.6, essential: true });
          if (here.accuracy <= GOOD_FIX_M) stopFollowing();
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
          stopFollowing();
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 }
    );
  }, [stopFollowing]);

  React.useEffect(() => {
    if (!("geolocation" in navigator)) {
      void Promise.resolve().then(() => setPermission("unsupported"));
      return;
    }
    let status: PermissionStatus | null = null;
    void (async () => {
      try {
        status = await navigator.permissions.query({ name: "geolocation" });
        const state = () => (status?.state === "granted" ? "granted" : status?.state === "denied" ? "denied" : "prompt");
        setPermission(state());
        status.onchange = () => {
          setPermission(state());
          if (status?.state === "granted") startWatch();
        };
        if (status.state !== "denied") startWatch(); // "prompt" makes the browser ask
      } catch {
        startWatch(); // browsers without the permissions API: ask now
      }
    })();
    return () => {
      if (status) status.onchange = null;
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [startWatch]);

  /** Moves the map so the pin is over a spot. */
  const goTo = React.useCallback((lat: number, lng: number, zoom: number) => {
    const map = mapRef.current;
    stopSpin();
    if (map) map.flyTo({ center: [lng, lat], zoom: Math.max(zoom, map.getZoom()), speed: 1.4, essential: true });
  }, [stopSpin]);

  // "Use my location": the map goes to the customer and keeps following while the reading sharpens.
  const locate = React.useCallback(() => {
    stopSpin();
    forceFill.current = true;
    setLookupTick((t) => t + 1);
    setLocating(true);
    followRef.current = { until: Date.now() + 12_000 };
    window.setTimeout(stopFollowing, 12_000);
    startWatch();
    if (userPos) {
      const map = mapRef.current;
      if (map) map.flyTo({ center: [userPos.lng, userPos.lat], zoom: Math.max(map.getZoom(), 18), speed: 1.6, essential: true });
      if (userPos.accuracy <= GOOD_FIX_M) stopFollowing();
    }
  }, [startWatch, stopFollowing, stopSpin, userPos]);

  // A site with no location yet starts from where the customer is, as soon as that is known.
  const startedFromUser = React.useRef(false);
  React.useEffect(() => {
    if (saved || !userPos || !ready || startedFromUser.current) return;
    startedFromUser.current = true;
    mapRef.current?.flyTo({ center: [userPos.lng, userPos.lat], zoom: 18, speed: 1.6, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos, ready]);

  // The address at the pin, looked up when the map has settled, while editing. It fills the address fields once the pin has left the
  // saved spot (the saved address stays until then), unless the customer has typed there and the pin has not moved far since.
  const lat = center?.lat;
  const lng = center?.lng;
  React.useEffect(() => {
    if (!editing || lat === undefined || lng === undefined || (center?.zoom ?? 0) < 12) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLookup("loading");
      try {
        const res = await fetch(`/api/geocode?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`, { signal: controller.signal });
        const body = (await res.json()) as { place?: Place };
        if (!body.place) return setLookup("unavailable");
        setLookup("ready");
        const here = { lat, lng };
        const atSaved = saved !== null && distanceMeters(here, saved) <= MOVED_M;
        const typed = typedAt.current !== null && distanceMeters(here, typedAt.current) < KEEP_TYPED_M;
        if (forceFill.current) {
          forceFill.current = false;
          setFields(fromPlace(body.place));
          typedAt.current = null;
        } else if (atSaved) setFields(savedAddress);
        else if (!typed) {
          setFields(fromPlace(body.place));
          typedAt.current = null;
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setLookup("unavailable");
      }
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, editing, lookupTick]);

  function edit(field: keyof SiteAddressFields, value: string) {
    setFields((f) => ({ ...f, [field]: value }));
    if (center) typedAt.current = { lat: center.lat, lng: center.lng };
  }

  function startEditing() {
    stopSpin();
    setFields(savedAddress);
    setNames({ siteName, deviceLabel: deviceLabel ?? "" });
    typedAt.current = null;
    setStep("pin");
    setEditing(true);
    // the pin starts on the saved site, wherever the map has been moved to
    const map = mapRef.current;
    if (saved && map) map.flyTo({ center: [saved.lng, saved.lat], zoom: Math.max(map.getZoom(), 17), speed: 1.6, essential: true });
  }

  function cancel() {
    stopFollowing();
    setEditing(false);
    setStep("pin");
    setFields(savedAddress);
    setNames({ siteName, deviceLabel: deviceLabel ?? "" });
    setLookup("idle");
    typedAt.current = null;
    if (saved) mapRef.current?.flyTo({ center: [saved.lng, saved.lat], zoom: SITE_ZOOM, speed: 1.6, essential: true });
  }

  const away = center && saved ? distanceMeters(center, saved) : null;
  const zoomedIn = (center?.zoom ?? 0) >= MIN_SAVE_ZOOM;
  const pinMoved = !saved || (away ?? 0) > MOVED_M;
  const addressChanged = (Object.keys(EMPTY) as (keyof SiteAddressFields)[]).some((k) => fields[k].trim() !== savedAddress[k].trim());
  const pinOk = fields.pincode.trim() === "" || /^\d{6}$/.test(fields.pincode.trim());
  const namesChanged = names.siteName.trim() !== siteName.trim() || names.deviceLabel.trim() !== (deviceLabel ?? "").trim();
  const nameOk = names.siteName.trim() !== "";
  // The pin has to be close in (zoomed) only when its position is what is being saved.
  const canSave = !!center && pinOk && nameOk && (pinMoved ? zoomedIn : true) && (pinMoved || addressChanged || namesChanged);

  function save() {
    if (!center) return;
    startSaving(async () => {
      const ok = await withPromiseToast(saveSite.bind(null, deviceId), { loading: "Saving the site…", success: "Site saved." })({
        siteName: names.siteName,
        deviceLabel: names.deviceLabel,
        // the saved position stays as it is unless the pin was moved
        latitude: pinMoved ? center.lat : null,
        longitude: pinMoved ? center.lng : null,
        address: fields,
      });
      if (ok) {
        stopFollowing();
        setEditing(false);
        setStep("pin");
        setLookup("idle");
        typedAt.current = null;
      }
    });
  }

  // How far the customer is from the site, in words (no coordinates are shown anywhere).
  const fromSite = saved && userPos ? distanceMeters(userPos, saved) : null;
  const status = !saved
    ? "No location saved yet"
    : fromSite !== null
      ? fromSite <= ON_SITE_M
        ? "You are at the site"
        : `You are ${distanceText(fromSite)} from the site`
      : permission === "denied"
        ? "Allow location in your browser to see how far you are from the site"
        : permission === "unsupported"
          ? "Your browser cannot share its location"
          : "Finding where you are…";

  const preview = [fields.line1, fields.city, [fields.state, fields.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const pickPlace = (p: Place) => {
    if (p.lat === null || p.lng === null) return;
    forceFill.current = true;
    setLookupTick((t) => t + 1);
    goTo(p.lat, p.lng, 17.5);
  };
  const lookupPlace = async (p: Place) => {
    if (!p.placeId) return;
    const res = await fetch(`/api/geocode?place_id=${encodeURIComponent(p.placeId)}`);
    const body = (await res.json()) as { place?: Place };
    if (body.place?.lat != null && body.place.lng != null) goTo(body.place.lat, body.place.lng, 17.5);
  };
  const placing = editing && step === "pin";
  const checking = editing && step === "details";

  return (
    // A full-page map: it fills the page under the header (the dashboard layout pads its pages by p-6, taken back here) with the site's cards
    // floating over it on the left, like a map app.
    <div className="relative -mx-6 -mb-6 -mt-3 h-[calc(100svh-clamp(3.5rem,4.5vw,4.25rem))] min-h-[520px] overflow-hidden bg-muted">
      {/* The library's stylesheet makes the map element position: relative, which would drop it to no height: it gets a full-size wrapper.
          Once the spot is confirmed (the details step) the map is held still, so a touch cannot move the pin by accident; Back moves it again. */}
      <div className={cn("absolute inset-0", checking && "pointer-events-none")}>
        <div ref={box} className="h-full w-full" />
      </div>

      <button
        type="button"
        onClick={() => setThreeD((v) => !v)}
        aria-pressed={threeD}
        aria-label={threeD ? "Switch to the flat 2D map" : "Switch to the 3D map"}
        title={threeD ? "Flat map" : "3D map"}
        className={cn(
          "absolute right-[10px] z-10 flex size-[29px] items-center justify-center rounded-md border border-border text-[11px] font-bold shadow-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
          "top-[82px]",
          threeD ? "bg-primary text-white" : "bg-popover text-foreground hover:bg-muted"
        )}
      >
        3D
      </button>

      {/* Recenter: back to the site at the default zoom, and the slow turn starts again. */}
      {(saved || userPos) && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter the map on the site"
          title="Recenter"
          className="absolute right-[10px] top-[117px] z-10 flex size-[29px] items-center justify-center rounded-md border border-border bg-popover text-foreground shadow-md outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Crosshair className="size-4" />
        </button>
      )}

      {/* While placing the pin it is always in the middle and the map moves under it; its tip is the spot. */}
      {placing && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10">
          <span aria-hidden className={cn("absolute left-0 top-0 h-1.5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/35 blur-[1px] transition-transform duration-150", moving && "scale-75 opacity-60")} />
          <span className={cn("absolute left-0 top-0 -translate-x-1/2 -translate-y-full transition-transform duration-150", moving && "-translate-y-[calc(100%+10px)]")}>
            <MapPin className="size-11 fill-emerald-500 text-white drop-shadow-lg" strokeWidth={1.5} />
          </span>
        </div>
      )}

      {/* On a phone the search floats across the top of the map while placing the pin (on a wide screen it is inside the card). Its list is
          short and closes on a tap elsewhere, so the map stays within reach. */}
      {placing && (
        <div className="absolute left-3 right-14 top-3 z-30 md:hidden">
          <SearchBox variant="floating" center={center} onPick={pickPlace} onLookup={lookupPlace} />
        </div>
      )}

      {/* The cards: glass over the map on the left (a sheet at the bottom on a phone). Only the cards take clicks; the rest of the map stays live. */}
      <div className="pointer-events-none absolute z-20 flex flex-col gap-3 max-md:inset-x-3 max-md:bottom-3 max-md:max-h-[72%] md:bottom-4 md:left-4 md:top-4 md:w-[380px]">
        {!editing && <div className="pointer-events-auto max-md:shrink-0">{kind}</div>}

        <Card className={cn(GLASS, "pointer-events-auto flex min-h-0 flex-col gap-0 overflow-hidden py-0", !editing && "md:max-h-[calc(100%-9.5rem)]", editing && "md:max-h-full")}>
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                <MapPin className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{editing ? (saved ? "Edit site" : "Set up your site") : siteName}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{placing ? "Step 1 of 2 · Place the pin" : checking ? "Step 2 of 2 · Check the details" : status}</p>
            </div>
            {!editing && saved && (
              <Button type="button" size="sm" variant="outline" onClick={startEditing} className="shrink-0 gap-1.5 rounded-full bg-background/50">
                <Pencil className="size-3.5" />
                Edit site
              </Button>
            )}
          </div>

          {!editing && (
            <div className="min-h-0 overflow-auto border-t border-border/50 px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <AboutRows
                rows={[
                  ["Address", savedAddress.line1],
                  ["City", savedAddress.city],
                  ["State", savedAddress.state],
                  ["PIN code", savedAddress.pincode],
                ]}
              />
              {Object.values(savedAddress).every((v) => v === "") && <p className="pt-3 text-xs text-muted-foreground">No address saved yet. Press Edit site to add it.</p>}
              {devices && (
                <div className="mt-4 border-t border-border/50 pt-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Devices</p>
                  {devices}
                </div>
              )}
            </div>
          )}

          {placing && (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-auto border-t border-border/50 px-4 py-4">
                <div className="max-md:hidden">
                  <SearchBox variant="inline" center={center} onPick={pickPlace} onLookup={lookupPlace} />
                </div>

                {/* One short instruction, in plain words, that changes as the map is moved. */}
                <div className="space-y-0.5 text-sm">
                  {!ready || !center ? (
                    <p className="text-muted-foreground">Loading the map…</p>
                  ) : !zoomedIn ? (
                    <p className="font-medium text-foreground">Zoom in or search, then move the map until the pin is on your building.</p>
                  ) : (
                    <p className="font-medium text-foreground">Move the map until the pin is on your building.</p>
                  )}
                  {saved && center && zoomedIn && away !== null && <p className="text-xs text-muted-foreground">{away > MOVED_M ? `The pin is ${distanceText(away)} from the saved location.` : "The pin is on the saved location."}</p>}
                  {userPos && userPos.accuracy > POOR_FIX_M && (
                    <p className="flex items-start gap-1.5 pt-1 text-xs text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                      Your device could only place you within {distanceText(userPos.accuracy)}. Move the map until the pin is on your building.
                    </p>
                  )}
                  {permission === "denied" && <p className="pt-1 text-xs text-muted-foreground">Location is blocked in your browser. Allow it for this site in the address bar to use it here.</p>}
                </div>

                <div className="rounded-xl bg-background/40 px-3 py-2.5 ring-1 ring-border/40">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Address at the pin</p>
                  <p className="mt-0.5 text-sm text-foreground">
                    {lookup === "loading" ? (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Finding the address…
                      </span>
                    ) : preview ? (
                      preview
                    ) : (
                      <span className="text-muted-foreground">{lookup === "unavailable" ? "No address found here. You can type it in the next step." : "Move the map to see the address."}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/50 px-4 py-3">
                {permission === "unsupported" ? (
                  <span />
                ) : (
                  <Button type="button" size="sm" variant="ghost" onClick={locate} disabled={locating} className="gap-1.5 px-2 text-muted-foreground hover:text-foreground" aria-label="Use my location">
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
                    <span className="max-sm:hidden">{locating ? "Locating…" : "My location"}</span>
                  </Button>
                )}
                <div className="flex gap-2">
                  {saved && (
                    <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={saving} className="rounded-full bg-background/50">
                      Cancel
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={() => setStep("details")} disabled={!center || !zoomedIn} className="rounded-full px-4">
                    Confirm location
                  </Button>
                </div>
              </div>
            </>
          )}

          {checking && (
            <>
              <div className="min-h-0 flex-1 space-y-5 overflow-auto border-t border-border/50 px-4 py-4">
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Site name</span>
                    <Input value={names.siteName} onChange={(e) => setNames((n) => ({ ...n, siteName: e.target.value }))} maxLength={120} required aria-invalid={!nameOk} className="h-9 bg-background/50" />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Device name</span>
                    <Input value={names.deviceLabel} onChange={(e) => setNames((n) => ({ ...n, deviceLabel: e.target.value }))} maxLength={120} placeholder={deviceName} className="h-9 bg-background/50" />
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Address</p>
                    <p className="text-[11px] text-muted-foreground">{lookup === "unavailable" ? "Not found here. Type it in." : "Filled from the map. You can correct it."}</p>
                  </div>
                  <Input value={fields.line1} onChange={(e) => edit("line1", e.target.value)} maxLength={200} placeholder="Building, street, area" aria-label="Address line" className="h-9 bg-background/50" />
                  <div className="grid grid-cols-3 gap-2">
                    <Input value={fields.city} onChange={(e) => edit("city", e.target.value)} maxLength={100} placeholder="City" aria-label="City" className="h-9 bg-background/50" />
                    <Input value={fields.state} onChange={(e) => edit("state", e.target.value)} maxLength={100} placeholder="State" aria-label="State" className="h-9 bg-background/50" />
                    <Input value={fields.pincode} onChange={(e) => edit("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="PIN" aria-label="PIN code" aria-invalid={!pinOk} className="h-9 bg-background/50" />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/50 px-4 py-3">
                <Button type="button" size="sm" variant="ghost" onClick={() => setStep("pin")} disabled={saving} className="gap-1.5 px-2 text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  {saved && (
                    <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={saving} className="rounded-full bg-background/50">
                      Cancel
                    </Button>
                  )}
                  <Button type="button" size="sm" onClick={save} disabled={!canSave || saving} className="rounded-full px-5">
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Search for an area, street or landmark: suggestions appear as the customer types, and picking one moves the map there. */
function SearchBox({ center, onPick, onLookup, variant }: { center: Point | null; onPick: (p: Place) => void; onLookup: (p: Place) => Promise<void>; variant: "floating" | "inline" }) {
  const root = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Place[]>([]);
  const [state, setState] = React.useState<"idle" | "loading" | "empty" | "error">("idle");
  const [open, setOpen] = React.useState(false);
  const near = React.useRef(center);
  React.useEffect(() => {
    near.current = center;
  }, [center]);

  // A tap anywhere else (the map included) closes the list, so it never keeps the map out of reach.
  React.useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  React.useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      void Promise.resolve().then(() => {
        setResults([]);
        setState("idle");
      });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      try {
        const bias = near.current ? `&lat=${near.current.lat.toFixed(4)}&lng=${near.current.lng.toFixed(4)}` : "";
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(text)}${bias}`, { signal: controller.signal });
        const body = (await res.json()) as { places?: Place[]; error?: string };
        if (!body.places) return setState("error");
        setResults(body.places);
        setState(body.places.length === 0 ? "empty" : "idle");
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setState("error");
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function pick(p: Place) {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (p.lat !== null && p.lng !== null) onPick(p);
    else void onLookup(p);
  }

  return (
    <div ref={root} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results[0]) pick(results[0]);
          }}
          placeholder="Search an area, street or landmark"
          aria-label="Search an area, street or landmark"
          className={variant === "floating" ? "h-11 rounded-full border-white/20 bg-card/80 pl-10 pr-10 shadow-lg backdrop-blur-xl" : "h-10 bg-background/50 pl-9 pr-9"}
        />
        {query && (
          <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {state === "loading" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
          </button>
        )}
      </div>
      {open && query.trim().length >= 3 && (results.length > 0 || state === "empty" || state === "error") && (
        <ul role="listbox" className={cn("overflow-auto rounded-xl border border-border bg-popover py-1 shadow-lg", variant === "floating" ? "absolute inset-x-0 top-full z-30 mt-2 max-h-[40svh]" : "mt-2 max-h-52")}>
          {results.map((p, i) => (
            <li key={`${p.placeId ?? ""}-${i}-${p.label}`} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(p)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{mainLine(p)}</span>
                  <span className="block truncate text-xs text-muted-foreground">{restLine(p) || p.label}</span>
                </span>
              </button>
            </li>
          ))}
          {state === "empty" && <li className="px-3 py-2 text-sm text-muted-foreground">Nothing found. Try a nearby street or area.</li>}
          {state === "error" && <li className="px-3 py-2 text-sm text-muted-foreground">Search is not available right now. You can still move the map.</li>}
        </ul>
      )}
    </div>
  );
}
