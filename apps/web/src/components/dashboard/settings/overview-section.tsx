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
import { SettingsCard, TwoColumns } from "./settings-card";
import { useAutoSave } from "./use-auto-save";

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

type Saved = Pick<OverviewPrefs, "background" | "dim">;

/** Settings > Dashboard > Overview: the widgets (arranged on the Overview itself: drag, stretch, colour, add; here is a picture of the board and
 *  the way in) and the picture or colour behind the page. The background saves itself when a colour is picked, a picture is chosen or the
 *  darkening is let go: there is no Save button. A picture is shrunk in the browser first. */
export function OverviewSection({ userId, initial, imageUrl, layout }: { userId: string; initial: Saved; imageUrl: string | null; layout: WidgetItem[] }) {
  const router = useRouter();
  const { value, update, saving } = useAutoSave<Saved>(initial, saveOverview, { message: "Background saved.", onSaved: () => router.refresh() });
  const bg: OverviewBackground = value.background;
  // while the darkening handle is held it follows the finger; the value is saved when it is let go
  const [dimLive, setDimLive] = React.useState<number | null>(null);
  const dim = dimLive ?? value.dim;
  const [uploading, setUploading] = React.useState(false);
  const [pictureUrl, setPictureUrl] = React.useState<string | null>(imageUrl);
  const [resetting, setResetting] = React.useState(false);
  const picker = React.useRef<HTMLInputElement>(null);

  const previewCss = backgroundCss(bg, bg.kind === "image" ? pictureUrl : null, dim);
  const hasImage = bg.kind === "image";

  async function choosePicture(file: File | undefined) {
    if (!file) return;
    const problem = pictureProblem(file);
    if (problem) {
      notify.error(problem);
      return;
    }
    setUploading(true);
    try {
      const blob = await shrinkPicture(file);
      const path = `${userId}/overview-${Date.now()}.jpg`;
      const client = createClient();
      const { error } = await client.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error("The picture could not be uploaded. Try again.");
      setPictureUrl(client.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      update({ background: { kind: "image", path }, dim: value.dim });
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "That picture could not be used.");
    } finally {
      setUploading(false);
      if (picker.current) picker.current.value = "";
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
    <TwoColumns
      left={
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
      }
      right={
        <SettingsCard icon={ImagePlus} tone="rose" title="Background" description="A colour or your own picture behind the Overview. Plain widgets turn to frosted glass so the numbers stay easy to read. Changes are saved as you make them.">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <button
              type="button"
              aria-pressed={bg.kind === "none"}
              onClick={() => update({ background: { kind: "none" }, dim: value.dim })}
              className={cn("flex h-16 items-center justify-center rounded-xl border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", bg.kind === "none" ? "border-primary ring-1 ring-primary" : "border-border text-muted-foreground hover:bg-accent")}
            >
              None
            </button>
            {BACKGROUND_PRESETS.map((p) => {
              const on = bg.kind === "preset" && bg.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={p.label}
                  onClick={() => update({ background: { kind: "preset", id: p.id }, dim: value.dim })}
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
            <Button type="button" variant="outline" size="sm" disabled={uploading || saving} onClick={() => picker.current?.click()}>
              <ButtonSpinner show={uploading} />
              {!uploading && <ImagePlus className="size-3.5" />}
              {uploading ? "Uploading…" : hasImage ? "Choose another picture" : "Use my own picture"}
            </Button>
            {hasImage && (
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => update({ background: { kind: "none" }, dim: value.dim })}>
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
              <Slider
                value={[dim]}
                min={0}
                max={80}
                step={5}
                onValueChange={(v) => setDimLive(v[0] ?? 0)}
                onValueCommit={(v) => {
                  setDimLive(null);
                  update({ background: bg, dim: v[0] ?? 0 });
                }}
                aria-label="Darken the picture"
              />
            </div>
          )}
        </SettingsCard>
      }
    />
  );
}
