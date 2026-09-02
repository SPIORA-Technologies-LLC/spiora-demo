import { resolveMeetingBackgroundImageUrl } from "./meeting-backgrounds";

const PREPARED_WIDTH = 1920;
const PREPARED_HEIGHT = 1080;
const preparedImageCache = new Map<string, string>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load background image: ${url}`));
    img.src = url;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
): void {
  const scale = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

/** High-resolution background for LiveKit processor (cover crop, cached blob URL). */
export async function prepareMeetingBackgroundImageUrl(
  imagePath: string,
): Promise<string> {
  if (typeof window === "undefined") {
    return resolveMeetingBackgroundImageUrl(imagePath);
  }

  const absoluteUrl = resolveMeetingBackgroundImageUrl(imagePath);
  const cached = preparedImageCache.get(absoluteUrl);
  if (cached) {
    return cached;
  }

  const img = await loadImage(absoluteUrl);
  const canvas = document.createElement("canvas");
  canvas.width = PREPARED_WIDTH;
  canvas.height = PREPARED_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return absoluteUrl;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawCover(ctx, img, PREPARED_WIDTH, PREPARED_HEIGHT);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });

  if (!blob) {
    return absoluteUrl;
  }

  const blobUrl = URL.createObjectURL(blob);
  preparedImageCache.set(absoluteUrl, blobUrl);
  return blobUrl;
}
