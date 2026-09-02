import {
  FilesetResolver,
  ImageSegmenter,
} from "@mediapipe/tasks-vision";
import {
  ProcessorWrapper,
  type TrackTransformerDestroyOptions,
  type VideoTrackTransformer,
  type VideoTransformerInitOptions,
} from "@livekit/track-processors";

export type SmoothedBackgroundOptions = {
  imagePath?: string;
  blurRadius?: number;
  backgroundDisabled?: boolean;
};

const MEDIAPIPE_VISION_VERSION = "0.10.14";
const SELFIE_SEGMENTER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";

/** Higher = more responsive edges, lower = less flicker. */
const TEMPORAL_ALPHA = 0.38;
/** Soft feather radius in CSS pixels for the person silhouette. */
const EDGE_FEATHER_PX = 7;
const DEFAULT_BLUR_RADIUS = 12;

function supportsTransformer() {
  return (
    typeof OffscreenCanvas !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  );
}

function createCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  width: number,
  height: number,
) {
  const sourceWidth =
    "videoWidth" in image && image.videoWidth
      ? image.videoWidth
      : "naturalWidth" in image && image.naturalWidth
        ? image.naturalWidth
        : "width" in image
          ? Number(image.width)
          : width;
  const sourceHeight =
    "videoHeight" in image && image.videoHeight
      ? image.videoHeight
      : "naturalHeight" in image && image.naturalHeight
        ? image.naturalHeight
        : "height" in image
          ? Number(image.height)
          : height;

  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

/**
 * LiveKit-compatible virtual background with temporal mask smoothing and soft
 * edge feathering so the silhouette does not flicker frame-to-frame.
 */
export class SmoothedBackgroundTransformer
  implements VideoTrackTransformer<SmoothedBackgroundOptions>
{
  static get isSupported() {
    return supportsTransformer();
  }

  transformer?: TransformStream<VideoFrame, VideoFrame>;
  canvas?: OffscreenCanvas | HTMLCanvasElement;
  inputVideo?: HTMLVideoElement;
  options: SmoothedBackgroundOptions;

  private imageSegmenter?: ImageSegmenter;
  private backgroundImage: ImageBitmap | null = null;
  private backgroundImagePath: string | null = null;
  private previousMask: Float32Array | null = null;
  private maskCanvas?: OffscreenCanvas | HTMLCanvasElement;
  private personCanvas?: OffscreenCanvas | HTMLCanvasElement;
  private featherCanvas?: OffscreenCanvas | HTMLCanvasElement;
  private isFirstFrame = true;
  private destroyed = false;

  constructor(options: SmoothedBackgroundOptions = {}) {
    this.options = options;
  }

  async init({
    outputCanvas,
    inputElement,
  }: VideoTransformerInitOptions): Promise<void> {
    this.destroyed = false;
    this.canvas = outputCanvas;
    this.inputVideo = inputElement;
    this.transformer = new TransformStream({
      transform: (frame, controller) => this.transform(frame, controller),
    });

    const vision = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VISION_VERSION}/wasm`,
    );

    this.imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: SELFIE_SEGMENTER_MODEL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });

    if (this.options.imagePath) {
      await this.loadBackground(this.options.imagePath);
    }
  }

  async restart({
    outputCanvas,
    inputElement,
  }: VideoTransformerInitOptions): Promise<void> {
    this.canvas = outputCanvas;
    this.inputVideo = inputElement;
    this.previousMask = null;
    this.isFirstFrame = true;
  }

  async destroy(options?: TrackTransformerDestroyOptions): Promise<void> {
    this.destroyed = true;
    await this.imageSegmenter?.close();
    this.imageSegmenter = undefined;
    this.backgroundImage?.close();
    this.backgroundImage = null;
    this.backgroundImagePath = null;
    this.previousMask = null;
    this.canvas = undefined;
    this.inputVideo = undefined;
    this.maskCanvas = undefined;
    this.personCanvas = undefined;
    this.featherCanvas = undefined;
    if (!options?.willProcessorRestart) {
      this.isFirstFrame = true;
    }
  }

  async update(options: SmoothedBackgroundOptions): Promise<void> {
    this.options = { ...this.options, ...options };

    if (options.backgroundDisabled) {
      this.previousMask = null;
      return;
    }

    if (typeof options.imagePath === "string") {
      await this.loadBackground(options.imagePath);
      return;
    }

    if (options.blurRadius !== undefined) {
      this.backgroundImage?.close();
      this.backgroundImage = null;
      this.backgroundImagePath = null;
    }
  }

  async transform(
    frame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ): Promise<void> {
    try {
      if (
        this.destroyed ||
        !(frame instanceof VideoFrame) ||
        frame.codedWidth === 0 ||
        frame.codedHeight === 0
      ) {
        frame.close();
        return;
      }

      const disabled = this.options.backgroundDisabled === true;
      const hasEffect =
        typeof this.options.blurRadius === "number" ||
        typeof this.options.imagePath === "string";

      if (disabled || !hasEffect || !this.canvas || !this.imageSegmenter) {
        controller.enqueue(frame);
        return;
      }

      const width = frame.displayWidth;
      const height = frame.displayHeight;
      this.canvas.width = width;
      this.canvas.height = height;

      if (this.isFirstFrame) {
        controller.enqueue(frame.clone());
        this.isFirstFrame = false;
        await this.segmentFrame(frame);
        frame.close();
        return;
      }

      const mask = await this.segmentFrame(frame);
      if (!mask || this.destroyed) {
        controller.enqueue(frame);
        return;
      }

      const smoothed = this.smoothMask(mask, width, height);
      this.composite(frame, smoothed, width, height);

      const output = new VideoFrame(this.canvas, {
        timestamp: frame.timestamp || Date.now(),
      });
      frame.close();
      controller.enqueue(output);
    } catch (error) {
      console.error("[meeting-background] smoothed transform failed", error);
      try {
        controller.enqueue(frame);
      } catch {
        try {
          frame.close();
        } catch {
          // ignore
        }
      }
    }
  }

  private async segmentFrame(frame: VideoFrame): Promise<Float32Array | null> {
    if (!this.imageSegmenter) {
      return null;
    }

    return new Promise((resolve, reject) => {
      try {
        const timestamp = performance.now();
        this.imageSegmenter!.segmentForVideo(frame, timestamp, (result) => {
          try {
            const confidence = result.confidenceMasks?.[0];
            if (!confidence) {
              result.close();
              resolve(null);
              return;
            }
            const data = confidence.getAsFloat32Array();
            const copy = new Float32Array(data);
            result.close();
            resolve(copy);
          } catch (error) {
            try {
              result.close();
            } catch {
              // ignore
            }
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private smoothMask(
    mask: Float32Array,
    width: number,
    height: number,
  ): Float32Array {
    const expected = width * height;
    const source =
      mask.length < expected
        ? this.upsampleMask(mask, width, height)
        : mask;

    if (!this.previousMask || this.previousMask.length !== source.length) {
      this.previousMask = new Float32Array(source);
      return source;
    }

    const smoothed = new Float32Array(source.length);
    const prev = this.previousMask;
    const a = TEMPORAL_ALPHA;
    const b = 1 - a;
    for (let i = 0; i < source.length; i += 1) {
      smoothed[i] = a * source[i] + b * prev[i];
    }
    this.previousMask = smoothed;
    return smoothed;
  }

  private upsampleMask(
    mask: Float32Array,
    width: number,
    height: number,
  ): Float32Array {
    const mw = Math.round(Math.sqrt(mask.length));
    const mh = Math.max(1, Math.floor(mask.length / Math.max(mw, 1)));
    const upsampled = new Float32Array(width * height);

    for (let y = 0; y < height; y += 1) {
      const sy = ((y + 0.5) * mh) / height - 0.5;
      const y0 = Math.max(0, Math.floor(sy));
      const y1 = Math.min(mh - 1, y0 + 1);
      const fy = sy - y0;
      for (let x = 0; x < width; x += 1) {
        const sx = ((x + 0.5) * mw) / width - 0.5;
        const x0 = Math.max(0, Math.floor(sx));
        const x1 = Math.min(mw - 1, x0 + 1);
        const fx = sx - x0;
        const v00 = mask[y0 * mw + x0] ?? 0;
        const v10 = mask[y0 * mw + x1] ?? 0;
        const v01 = mask[y1 * mw + x0] ?? 0;
        const v11 = mask[y1 * mw + x1] ?? 0;
        const v0 = v00 * (1 - fx) + v10 * fx;
        const v1 = v01 * (1 - fx) + v11 * fx;
        upsampled[y * width + x] = v0 * (1 - fy) + v1 * fy;
      }
    }

    return upsampled;
  }

  private ensureAuxCanvas(
    current: OffscreenCanvas | HTMLCanvasElement | undefined,
    width: number,
    height: number,
  ): OffscreenCanvas | HTMLCanvasElement {
    if (!current || current.width !== width || current.height !== height) {
      return createCanvas(width, height);
    }
    return current;
  }

  private composite(
    frame: VideoFrame,
    mask: Float32Array,
    width: number,
    height: number,
  ): void {
    if (!this.canvas) {
      return;
    }

    const ctx = this.canvas.getContext("2d", {
      alpha: true,
    }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      return;
    }

    this.maskCanvas = this.ensureAuxCanvas(this.maskCanvas, width, height);
    this.personCanvas = this.ensureAuxCanvas(this.personCanvas, width, height);
    this.featherCanvas = this.ensureAuxCanvas(this.featherCanvas, width, height);

    const maskCtx = this.maskCanvas.getContext("2d", {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    const personCtx = this.personCanvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    const featherCtx = this.featherCanvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!maskCtx || !personCtx || !featherCtx) {
      return;
    }

    const imageData = maskCtx.createImageData(width, height);
    const pixels = imageData.data;
    for (let i = 0; i < width * height; i += 1) {
      const confidence = mask[i] ?? 0;
      // Slightly raise mid confidence so thin hair strands stay attached.
      const shaped = Math.min(1, Math.max(0, confidence * 1.08));
      const alpha = Math.round(shaped * 255);
      const offset = i * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 255;
      pixels[offset + 2] = 255;
      pixels[offset + 3] = alpha;
    }
    maskCtx.clearRect(0, 0, width, height);
    maskCtx.putImageData(imageData, 0, 0);

    featherCtx.clearRect(0, 0, width, height);
    featherCtx.filter = `blur(${EDGE_FEATHER_PX}px)`;
    featherCtx.drawImage(this.maskCanvas, 0, 0);
    featherCtx.filter = "none";

    personCtx.clearRect(0, 0, width, height);
    personCtx.drawImage(frame, 0, 0, width, height);
    personCtx.globalCompositeOperation = "destination-in";
    personCtx.drawImage(this.featherCanvas, 0, 0);
    personCtx.globalCompositeOperation = "source-over";

    ctx.clearRect(0, 0, width, height);
    if (typeof this.options.blurRadius === "number") {
      const blurRadius = this.options.blurRadius || DEFAULT_BLUR_RADIUS;
      ctx.filter = `blur(${blurRadius}px)`;
      ctx.drawImage(frame, 0, 0, width, height);
      ctx.filter = "none";
    } else if (this.backgroundImage) {
      drawImageCover(ctx, this.backgroundImage, width, height);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(this.personCanvas, 0, 0);
  }

  private async loadBackground(path: string): Promise<void> {
    if (this.backgroundImagePath === path && this.backgroundImage) {
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error(`Failed to load background: ${path}`));
      image.src = path;
    });

    this.backgroundImage?.close();
    this.backgroundImage = await createImageBitmap(image);
    this.backgroundImagePath = path;
  }
}

export type SmoothedBackgroundProcessorHandle = {
  switchTo: (options: {
    mode: "disabled" | "background-blur" | "virtual-background";
    blurRadius?: number;
    imagePath?: string;
  }) => Promise<void>;
};

export function createSmoothedBackgroundProcessor(): ProcessorWrapper<
  SmoothedBackgroundOptions,
  SmoothedBackgroundTransformer
> &
  SmoothedBackgroundProcessorHandle {
  const transformer = new SmoothedBackgroundTransformer({
    backgroundDisabled: true,
  });
  const processor = new ProcessorWrapper(
    transformer,
    "spiora-smoothed-background",
    { maxFps: 30 },
  ) as ProcessorWrapper<
    SmoothedBackgroundOptions,
    SmoothedBackgroundTransformer
  > &
    SmoothedBackgroundProcessorHandle;

  processor.switchTo = async (options) => {
    switch (options.mode) {
      case "background-blur":
        await processor.updateTransformerOptions({
          imagePath: undefined,
          blurRadius: options.blurRadius ?? DEFAULT_BLUR_RADIUS,
          backgroundDisabled: false,
        });
        break;
      case "virtual-background":
        await processor.updateTransformerOptions({
          imagePath: options.imagePath,
          blurRadius: undefined,
          backgroundDisabled: false,
        });
        break;
      case "disabled":
        await processor.updateTransformerOptions({
          imagePath: undefined,
          blurRadius: undefined,
          backgroundDisabled: true,
        });
        break;
    }
  };

  return processor;
}

export function supportsSmoothedBackgroundProcessors(): boolean {
  return (
    SmoothedBackgroundTransformer.isSupported && ProcessorWrapper.isSupported
  );
}

