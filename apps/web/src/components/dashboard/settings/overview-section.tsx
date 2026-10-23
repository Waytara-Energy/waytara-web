"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, LayoutGrid, RotateCcw, Trash2 } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ButtonSpinner } from "@/components/ui/spinner";
import { pictureProblem, shrinkPicture } from "@/lib/image-resize";
import { BACKGROUND_PRESETS, backgroundCss, type OverviewBackground, type OverviewPrefs } from "@/lib/overview-prefs";
import { FIT_ROWS, WIDGET_THEMES, rowsOf, widgetMeta, type WidgetItem } from "@/lib/overview-layout";
import { saveOverview, saveOverviewLayout } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./settings-card";

/** A small drawing of the Overview as it is arranged now: each widget where it sits, in its colour, over the chosen background. */
function Preview({ layout, background }: { layout: WidgetItem[]; background: string | null }) {
  const rows = Math.max(rowsOf(layout), FIT_ROWS);
  return (
    <div className="rounded-xl p-3" style={background ? { background } : { background: "var(--muted)" }}>
      <div className="relative aspect-[16/10] w-full">
        {layout.map((w) => {
          const theme = WIDGET_THEMES.find((t) => t.id === w.theme) ?? WIDGET_THEMES[0];
          const tinted = w.theme !== "default" && w.theme !== "glass";
          return (
            <div
              key={w.id}
              className={cn("absolute overflow-hidden rounded-md border p-1 text-[9px] font-medium leading-tight", tinted ? "border-transparent text-white" : background ? "border-white/20 bg-black/35 text-white" : "border-border bg-card text-foreground")}
              style={{ left: `calc(${(w.x / 12) * 100}% + 1px)`, width: `calc(${(w.w / 12) * 100}% - 2px)`, top: `calc(${(w.y / rows) * 100}% + 1px)`, height: `calc(${(w.h / rows) * 100}% - 2px)`, ...(tinted ? { background: theme.swatch } : {}) }}
            >
              {widgetMeta(w.type)?.label ?? w.type}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Settings > Dashboard > Overview: the widgets (arranged on the Overview itself: drag, stretch, colour, add; here is a picture of the board and
 *  the way in) and the picture or colour behind the page. A picture is shrunk in the browser and uploaded only when the person presses Save. */
export function OverviewSection({ userId, initial, imageUrl, layout }: { userId: string; initial: Pick<OverviewPrefs, "background" | "dim">; imageUrl: string | null; layout: WidgetItem[] }) {
  const router = useRouter();
  const [bg, setBg] = React.useState<OverviewBackground>(initial.background);
  const [dim, setDim] = React.useState(initial.dim);
  const [pending, setPending] = React.useState<{ blob: Blob; url: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [saved, setSaved] = React.useState(() => JSON.stringify([initial.background, initial.dim]));
  const picker = React.useRef<HTMLInputElement>(null);

  // an object address for the chosen-but-not-yet-saved picture is released when it is replaced or the page goes
  React.useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  const dirty = pending !== null || JSON.stringify([bg, dim]) !== saved;
  const shownImage = pending?.url ?? (bg.kind === "image" ? imageUrl : null);
  const previewCss = pending ? backgroundCss({ kind: "image", path: `${userId}/overview-0000000000.jpg` }, pending.url, dim) : backgroundCss(bg, shownImage, dim);
  const hasImage = pending !== null || bg.kind === "image";

  async function choosePicture(file: File | undefined) {
    if (!file) return;
    const problem = pictureProblem(file);
    if (problem) {
      notify.error(problem);
      return;
    }
    try {
      const blob = await shrinkPicture(file);
      setPending({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "That picture could not be used.");
    } finally {
      if (picker.current) picker.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    try {
      let background = bg;
      if (pending) {
        const path = `${userId}/overview-${Date.now()}.jpg`;
        const { error } = await createClient().storage.from("avatars").upload(path, pending.blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error("The picture could not be uploaded. Try again.");
        background = { kind: "image", path };
      }
      await saveOverview({ background, dim });
      notify.success("Background saved.");
      setBg(background);
      setPending(null);
      setSaved(JSON.stringify([background, dim]));
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function resetLayout() {
    setResetting(true);
    try {
      await saveOverviewLayout(null);
      notify.success("The standard Overview is back.");
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not reset. Try again.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="-mb-5 columns-1 gap-5 xl:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
      <SettingsCard
        title="Overview widgets"
        icon={LayoutGrid}
        tone="amber"
        description="Build your Overview like the home screen of a phone: choose the widgets, give each a colour, drag them where you want them and stretch them bigger or smaller."
       
        footer={
          <>
            <Button type="button" variant="outline" size="sm" disabled={resetting} onClick={() => void resetLayout()}>
              <ButtonSpinner show={resetting} />
              {!resetting && <RotateCcw className="size-3.5" />}
              Standard layout
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard?customize=1">
                <LayoutGrid className="size-3.5" />
                Customize my Overview
              </Link>
            </Button>
          </>
        }
      >
        <Preview layout={layout} background={previewCss} />
        <p className="text-xs text-muted-foreground">
          {layout.length} {layout.length === 1 ? "widget" : "widgets"} on your Overview. Customizing opens the Overview itself, so you arrange it on the real thing. It needs a wide screen: on a phone the widgets are stacked.
        </p>
      </SettingsCard>

      <SettingsCard
        icon={ImagePlus}
        tone="rose"
        title="Background"
        description="A colour or your own picture behind the Overview. Plain widgets turn to frosted glass so the numbers stay easy to read."
       
        footer={
          <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            <ButtonSpinner show={saving} />
            {saving ? "Saving…" : "Save background"}
          </Button>
        }
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <button
            type="button"
            aria-pressed={bg.kind === "none" && !pending}
            onClick={() => { setBg({ kind: "none" }); setPending(null); }}
            className={cn("flex h-16 items-center justify-center rounded-xl border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", bg.kind === "none" && !pending ? "border-primary ring-1 ring-primary" : "border-border text-muted-foreground hover:bg-accent")}
          >
            None
          </button>
          {BACKGROUND_PRESETS.map((p) => {
            const on = bg.kind === "preset" && bg.id === p.id && !pending;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                aria-label={p.label}
                onClick={() => { setBg({ kind: "preset", id: p.id }); setPending(null); }}
                className={cn("relative flex h-16 items-end rounded-xl border p-1.5 text-left text-[11px] font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "border-primary ring-1 ring-primary" : "border-transparent")}
                style={{ background: p.css }}
              >
                {p.label}
                {on && <Check className="absolute right-1.5 top-1.5 size-3.5" />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()}>
            <ImagePlus className="size-3.5" />
            {hasImage ? "Choose another picture" : "Use my own picture"}
          </Button>
          {hasImage && (
            <Button type="button" variant="outline" size="sm" onClick={() => { setBg({ kind: "none" }); setPending(null); }}>
              <Trash2 className="size-3.5" />
              Remove picture
            </Button>
          )}
          <span className="text-xs text-muted-foreground">JPG, PNG or WebP. It is shrunk before it is uploaded.</span>
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a background picture" onChange={(e) => void choosePicture(e.target.files?.[0])} />
        </div>

        {hasImage && (
          <div className="max-w-sm space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">Darken the picture</span>
              <span className="tabular-nums text-muted-foreground">{dim}%</span>
            </div>
            <Slider value={[dim]} min={0} max={80} step={5} onValueChange={(v) => setDim(v[0] ?? 0)} aria-label="Darken the picture" />
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
