// Preparing a picture in the browser before it is uploaded: a profile picture is cropped to a square and shrunk, an Overview background is
// shrunk to a sensible width. The upload is then small (and a phone photo of many megabytes does not fill the storage).

export const MAX_PICTURE_BYTES = 12 * 1024 * 1024;
export const PICTURE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function pictureProblem(file: File): string | null {
  if (!PICTURE_TYPES.includes(file.type)) return "Choose a JPG, PNG or WebP picture.";
  if (file.size > MAX_PICTURE_BYTES) return "That picture is larger than 12 MB.";
  return null;
}

async function load(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    throw new Error("That picture could not be read. Try another one.");
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture could not be prepared."))), "image/jpeg", quality));
}

/** A square crop from the middle, `side` pixels wide, as a JPEG. */
export async function squareAvatar(file: File, side = 512): Promise<Blob> {
  const bmp = await load(file);
  const size = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The picture could not be prepared.");
  ctx.drawImage(bmp, (bmp.width - size) / 2, (bmp.height - size) / 2, size, size, 0, 0, side, side);
  bmp.close();
  return toBlob(canvas, 0.88);
}

/** Shrunk so the longer side is at most `maxSide` pixels, as a JPEG. */
export async function shrinkPicture(file: File, maxSide = 1920): Promise<Blob> {
  const bmp = await load(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The picture could not be prepared.");
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return toBlob(canvas, 0.82);
}
