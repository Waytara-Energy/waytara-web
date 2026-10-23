"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { createClient } from "@waytara/supabase/client";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ButtonSpinner } from "@/components/ui/spinner";
import { pictureProblem, shrinkPicture } from "@/lib/image-resize";
import { BACKGROUND_PRESETS, DEFAULT_OVERVIEW_CARDS, OVERVIEW_CARDS, OVERVIEW_CARD_COUNT, backgroundCss, splitCards, type OverviewBackground, type OverviewCardId, type OverviewPrefs } from "@/lib/overview-prefs";
import { saveOverview } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";
import { SettingsCard } from "./settings-card";

const label = (id: OverviewCardId) => OVERVIEW_CARDS.find((c) => c.id === id)?.label ?? id;

/** A small drawing of the Overview as it will look: two cards, the energy flow, two cards, over the chosen background. */
function Preview({ cards, background }: { cards: OverviewCardId[]; background: string | null }) {
  const { left, right } = splitCards(cards.length === OVERVIEW_CARD_COUNT ? cards : DEFAULT_OVERVIEW_CARDS);
  const tile = (id: OverviewCardId) => (
    <div key={id} className={cn("flex flex-1 flex-col justify-between rounded-lg border p-2", background ? "border-white/20 bg-black/35 text-white backdrop-blur" : "border-border bg-card text-foreground")}>
      <span className="text-[10px] font-medium leading-tight">{label(id)}</span>
      <span className="mt-2 h-1.5 w-2/3 rounded-full bg-current opacity-25" />
    </div>
  );
  return (
    <div className="rounded-xl p-3" style={background ? { background } : { background: "var(--muted)" }}>
      <div className="grid h-40 grid-cols-[1fr_1.2fr_1fr] gap-2">
        <div className="flex flex-col gap-2">{left.map(tile)}</div>
        <div className="flex items-center justify-center">
          <div className={cn("grid size-20 place-items-center rounded-full border-2 border-dashed text-[10px] font-medium", background ? "border-white/50 text-white/80" : "border-border text-muted-foreground")}>Energy flow</div>
        </div>
        <div className="flex flex-col gap-2">{right.map(tile)}</div>
      </div>
    </div>
  );
}

/** Settings > Overview: which four cards sit beside the energy flow (the first two on the left, the last two on the right), and the picture
 *  or colour behind the page. A picture is shrunk in the browser and uploaded only when the person presses Save. */
export function OverviewSection({ userId, initial, imageUrl }: { userId: string; initial: OverviewPrefs; imageUrl: string | null }) {
  const router = useRouter();
  const [cards, setCards] = React.useState<OverviewCardId[]>(initial.cards);
  const [bg, setBg] = React.useState<OverviewBackground>(initial.background);
  const [dim, setDim] = React.useState(initial.dim);
  const [pending, setPending] = React.useState<{ blob: Blob; url: string } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(() => JSON.stringify([initial.cards, initial.background, initial.dim]));
  const picker = React.useRef<HTMLInputElement>(null);

  // an object address for the chosen-but-not-yet-saved picture is released when it is replaced or the page goes
  React.useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url); }, [pending]);

  const dirty = pending !== null || JSON.stringify([cards, bg, dim]) !== saved;
  const shownImage = pending?.url ?? (bg.kind === "image" ? imageUrl : null);
  const previewCss = pending ? backgroundCss({ kind: "image", path: `${userId}/overview-0000000000.jpg` }, pending.url, dim) : backgroundCss(bg, shownImage, dim);
  const hasImage = pending !== null || bg.kind === "image";

  const toggle = (id: OverviewCardId) => setCards((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : cur.length < OVERVIEW_CARD_COUNT ? [...cur, id] : cur));

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
    if (cards.length !== OVERVIEW_CARD_COUNT) {
      notify.error(`Choose ${OVERVIEW_CARD_COUNT} cards (you have ${cards.length}).`);
      return;
    }
    setSaving(true);
    try {
      let background = bg;
      if (pending) {
        const path = `${userId}/overview-${Date.now()}.jpg`;
        const { error } = await createClient().storage.from("avatars").upload(path, pending.blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw new Error("The picture could not be uploaded. Try again.");
        background = { kind: "image", path };
      }
      await saveOverview({ cards, background, dim });
      notify.success("Overview saved.");
      setBg(background);
      setPending(null);
      setSaved(JSON.stringify([cards, background, dim]));
      router.refresh();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <SettingsCard
        title="Overview cards"
        description={`Pick ${OVERVIEW_CARD_COUNT} cards for your Overview. The first two sit to the left of the energy flow, the last two to the right.`}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {OVERVIEW_CARDS.map((c) => {
            const order = cards.indexOf(c.id);
            const on = order >= 0;
            const full = !on && cards.length >= OVERVIEW_CARD_COUNT;
            return (
              <button
                key={c.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={full}
                onClick={() => toggle(c.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  on ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                )}
              >
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", on ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent")}>
                  {on ? order + 1 : <Check className="size-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{c.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className={cn(cards.length !== OVERVIEW_CARD_COUNT && "text-amber-600 dark:text-amber-400")}>
            {cards.length} of {OVERVIEW_CARD_COUNT} chosen. Tap a chosen card to remove it; the order is the order you chose them.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setCards(DEFAULT_OVERVIEW_CARDS)}>
            <RotateCcw className="size-3.5" />
            Reset to default
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Background" description="A colour or your own picture behind the Overview. The cards turn to frosted glass so the numbers stay easy to read.">
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

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Preview</p>
          <Preview cards={cards} background={previewCss} />
        </div>
      </SettingsCard>

      <div className="flex justify-end xl:col-span-2">
        <Button type="button" size="sm" disabled={!dirty || saving || cards.length !== OVERVIEW_CARD_COUNT} onClick={() => void save()}>
          <ButtonSpinner show={saving} />
          {saving ? "Saving…" : "Save Overview"}
        </Button>
      </div>
    </div>
  );
}
