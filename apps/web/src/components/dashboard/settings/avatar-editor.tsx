"use client";

import * as React from "react";
import { ImagePlus, Minus, Plus, RefreshCw, RotateCcw, RotateCw, UploadCloud } from "lucide-react";
import { notify } from "@waytara/ui/notify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ButtonSpinner } from "@/components/ui/spinner";
import { MAX_ZOOM, MIN_ZOOM, START_CROP, clampOffset, drawCrop, settle, turn, zoomTo, type CropState } from "@/lib/avatar-crop";
import { pictureProblem } from "@/lib/image-resize";
import { cn } from "@/lib/utils";

const VIEW = 288;
const OUT = 512;

interface Loaded {
  bitmap: ImageBitmap;
  w: number;
  h: number;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture could not be prepared."))), "image/jpeg", 0.9));
}

/**
 * Edit a profile picture: choose or drop a photo, drag it into place inside a round window, zoom with the slider or the wheel, turn it in quarter
 * turns, see the result at the sizes it will be shown, and save. The photo is cut out in the browser (512 pixels square) and only that is
 * uploaded. `onSave` receives the finished file. Keyboard: arrow keys move the photo, + and - zoom.
 */
export function AvatarEditor({ open, onClose, onSave, initialFile, hasPhoto, onRemove }: { open: boolean; onClose: () => void; onSave: (blob: Blob) => Promise<void>; initialFile?: File | null; hasPhoto: boolean; onRemove: () => Promise<void> }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-lg">
        {/* mounted only while open, so every opening starts clean */}
        {open && <Editor onClose={onClose} onSave={onSave} initialFile={initialFile ?? null} hasPhoto={hasPhoto} onRemove={onRemove} />}
      </DialogContent>
    </Dialog>
  );
}

function Editor({ onClose, onSave, initialFile, hasPhoto, onRemove }: { onClose: () => void; onSave: (blob: Blob) => Promise<void>; initialFile: File | null; hasPhoto: boolean; onRemove: () => Promise<void> }) {
  const [image, setImage] = React.useState<Loaded | null>(null);
  const [crop, setCrop] = React.useState<CropState>(START_CROP);
  const [busy, setBusy] = React.useState<"save" | "remove" | null>(null);
  const [over, setOver] = React.useState(false);
  const stage = React.useRef<HTMLCanvasElement>(null);
  const small = React.useRef<HTMLCanvasElement>(null);
  const tiny = React.useRef<HTMLCanvasElement>(null);
  const picker = React.useRef<HTMLInputElement>(null);
  const drag = React.useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const load = React.useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    const problem = pictureProblem(file);
    if (problem) {
      notify.error(problem);
      return;
    }
    try {
      // "from-image" applies the camera's own turn, so a phone photo is the right way up
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      setImage({ bitmap, w: bitmap.width, h: bitmap.height });
      setCrop(START_CROP);
    } catch {
      notify.error("That picture could not be read. Try another one.");
    }
  }, []);

  React.useEffect(() => {
    // a photo dropped on the picture opens the editor with it already chosen
    void Promise.resolve(initialFile).then(load);
  }, [initialFile, load]);
  React.useEffect(() => () => image?.bitmap.close(), [image]);

  // the window and the two small previews are drawn from the same crop
  React.useEffect(() => {
    if (!image) return;
    for (const [ref, size] of [[stage, VIEW], [small, 64], [tiny, 32]] as const) {
      const ctx = ref.current?.getContext("2d");
      if (ctx) drawCrop(ctx, image.bitmap, image.w, image.h, crop, VIEW, size);
    }
  }, [image, crop]);

  const move = (x: number, y: number) => setCrop((c) => (image ? { ...c, ...clampOffset(image.w, image.h, { ...c, x, y }, VIEW) } : c));
  const zoom = (z: number) => setCrop((c) => (image ? zoomTo(image.w, image.h, c, z, VIEW) : c));
  const rotate = (q: number) => setCrop((c) => (image ? settle(image.w, image.h, { ...c, rotation: turn(c.rotation, q), x: 0, y: 0 }, VIEW) : c));

  function onKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 24 : 8;
    const d = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
    if (d) {
      e.preventDefault();
      move(crop.x + d[0], crop.y + d[1]);
    } else if (e.key === "+" || e.key === "=") zoom(crop.zoom + 0.2);
    else if (e.key === "-") zoom(crop.zoom - 0.2);
  }

  async function save() {
    if (!image) return;
    setBusy("save");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("The picture could not be prepared.");
      drawCrop(ctx, image.bitmap, image.w, image.h, crop, VIEW, OUT);
      await onSave(await toBlob(canvas));
      onClose();
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "The picture could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await onRemove();
      onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{hasPhoto ? "Edit your photo" : "Add a photo"}</DialogTitle>
        <DialogDescription>{image ? "Drag the photo to place it, and zoom until you like it." : "Choose a photo, or drop one here. You can place and zoom it before it is saved."}</DialogDescription>
      </DialogHeader>

      <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a photo" onChange={(e) => void load(e.target.files?.[0]).then(() => { if (picker.current) picker.current.value = ""; })} />

      {!image ? (
        <button
          type="button"
          onClick={() => picker.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void load(e.dataTransfer.files?.[0]);
          }}
          className={cn("flex h-64 w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", over ? "border-primary bg-primary/10" : "border-border hover:border-primary/60 hover:bg-accent")}
        >
          <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="size-7" />
          </span>
          <span className="text-sm font-medium text-foreground">Drop a photo here, or click to choose one</span>
          <span className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 12 MB</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div
              className="relative shrink-0 touch-none select-none overflow-hidden rounded-2xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ width: VIEW, height: VIEW }}
              tabIndex={0}
              role="application"
              aria-label="Photo window. Drag to move the photo, use the arrow keys to move it and plus and minus to zoom."
              onKeyDown={onKey}
              onWheel={(e) => zoom(crop.zoom - e.deltaY * 0.002)}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
              }}
              onPointerMove={(e) => drag.current && move(drag.current.x + e.clientX - drag.current.px, drag.current.y + e.clientY - drag.current.py)}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <canvas ref={stage} width={VIEW} height={VIEW} className="size-full cursor-grab active:cursor-grabbing" />
              {/* the round window: everything outside it is dimmed */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.5)] ring-2 ring-white/80" />
            </div>

            <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Zoom</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" aria-label="Zoom out" onClick={() => zoom(crop.zoom - 0.25)}>
                    <Minus className="size-3.5" />
                  </Button>
                  <Slider value={[crop.zoom]} min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} onValueChange={(v) => zoom(v[0] ?? MIN_ZOOM)} aria-label="Zoom" />
                  <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" aria-label="Zoom in" onClick={() => zoom(crop.zoom + 0.25)}>
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Turn</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => rotate(-1)}>
                    <RotateCcw className="size-3.5" />
                    Left
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => rotate(1)}>
                    <RotateCw className="size-3.5" />
                    Right
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCrop(START_CROP)}>
                    <RefreshCw className="size-3.5" />
                    Reset
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">How it will look</p>
                <div className="flex items-end gap-3">
                  <canvas ref={small} width={64} height={64} className="size-16 rounded-full ring-1 ring-border" aria-hidden />
                  <canvas ref={tiny} width={32} height={32} className="size-8 rounded-full ring-1 ring-border" aria-hidden />
                </div>
              </div>

              <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => picker.current?.click()}>
                <ImagePlus className="size-3.5" />
                Choose another photo
              </Button>
            </div>
          </div>
        </div>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        {hasPhoto && !image ? (
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={busy !== null} onClick={() => void remove()}>
            <ButtonSpinner show={busy === "remove"} />
            Remove my photo
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy !== null} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!image || busy !== null} onClick={() => void save()}>
            <ButtonSpinner show={busy === "save"} />
            {busy === "save" ? "Saving…" : "Save photo"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
