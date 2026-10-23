// The geometry of cropping a profile picture: the picture sits in a square window, is turned in quarter turns, zoomed (1 = just covers the window)
// and moved by dragging; the offset is how far its middle is from the middle of the window, in window pixels. Pure, so the sums are tested; the
// editor (components/dashboard/settings/avatar-editor.tsx) draws with them, on screen and for the file that is saved.

export type Rotation = 0 | 90 | 180 | 270;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export interface CropState {
  rotation: Rotation;
  zoom: number;
  /** from the middle of the window, in window pixels */
  x: number;
  y: number;
}

export const START_CROP: CropState = { rotation: 0, zoom: 1, x: 0, y: 0 };

export const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(z) ? z : MIN_ZOOM));

export const turn = (r: Rotation, quarterTurns: number): Rotation => ((((r + quarterTurns * 90) % 360) + 360) % 360) as Rotation;

/** The picture's size once turned. */
export const turnedSize = (w: number, h: number, r: Rotation): { w: number; h: number } => (r === 90 || r === 270 ? { w: h, h: w } : { w, h });

/** How many window pixels one picture pixel takes at zoom 1: the picture just covers the window. */
export function coverScale(w: number, h: number, r: Rotation, view: number): number {
  const t = turnedSize(w, h, r);
  return Math.max(view / t.w, view / t.h);
}

/** Moves the offset back so the picture always covers the whole window (no empty corner shows). */
export function clampOffset(w: number, h: number, c: CropState, view: number): { x: number; y: number } {
  const t = turnedSize(w, h, c.rotation);
  const s = coverScale(w, h, c.rotation, view) * c.zoom;
  const limitX = Math.max(0, (t.w * s - view) / 2);
  const limitY = Math.max(0, (t.h * s - view) / 2);
  // `|| 0` keeps a zero from being a negative zero
  return { x: Math.min(limitX, Math.max(-limitX, c.x)) || 0, y: Math.min(limitY, Math.max(-limitY, c.y)) || 0 };
}

/** A new crop with the picture still covering the window. */
export function settle(w: number, h: number, c: CropState, view: number): CropState {
  const next = { ...c, zoom: clampZoom(c.zoom) };
  return { ...next, ...clampOffset(w, h, next, view) };
}

/** Zooming keeps whatever is in the middle of the window in the middle: the offset grows or shrinks with the zoom. */
export function zoomTo(w: number, h: number, c: CropState, zoom: number, view: number): CropState {
  const z = clampZoom(zoom);
  const k = z / c.zoom;
  return settle(w, h, { ...c, zoom: z, x: c.x * k, y: c.y * k }, view);
}

/** Draws the crop onto a canvas of `out` pixels a side (the window scaled to `out`). */
export function drawCrop(ctx: CanvasRenderingContext2D, image: CanvasImageSource, w: number, h: number, c: CropState, view: number, out: number): void {
  const k = out / view;
  const s = coverScale(w, h, c.rotation, view) * c.zoom * k;
  ctx.save();
  ctx.clearRect(0, 0, out, out);
  ctx.translate(out / 2 + c.x * k, out / 2 + c.y * k);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.drawImage(image, -w / 2, -h / 2);
  ctx.restore();
}
