// ocr-image.js
// Faster OCR image preparation for pager screenshots.
// Keeps full width, trims top/bottom only, and uses fewer variants.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function get2dContext(canvas, options = {}) {
  return canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: !!options.willReadFrequently
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No image file provided"));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

function drawImageToCanvas(img) {
  const canvas = createCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  const ctx = get2dContext(canvas, { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropCanvas(sourceCanvas, crop) {
  const sx = clamp(Math.round(crop.x), 0, sourceCanvas.width - 1);
  const sy = clamp(Math.round(crop.y), 0, sourceCanvas.height - 1);
  const sw = clamp(Math.round(crop.width), 1, sourceCanvas.width - sx);
  const sh = clamp(Math.round(crop.height), 1, sourceCanvas.height - sy);

  const out = createCanvas(sw, sh);
  const ctx = get2dContext(out);
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function scaleCanvas(sourceCanvas, scale) {
  const safeScale = Math.max(0.75, Math.min(scale, 2));
  const out = createCanvas(sourceCanvas.width * safeScale, sourceCanvas.height * safeScale);
  const ctx = get2dContext(out);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sourceCanvas, 0, 0, out.width, out.height);
  return out;
}

function grayscaleCanvas(sourceCanvas) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = get2dContext(out, { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = Math.round((0.299 * r) + (0.587 * g) + (0.114 * b));
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function contrastCanvas(sourceCanvas, contrast = 35, brightness = 0) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = get2dContext(out, { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;

  const c = clamp(contrast, -255, 255);
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  const b = clamp(brightness, -255, 255);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(Math.round(factor * (data[i] - 128) + 128 + b), 0, 255);
    data[i + 1] = clamp(Math.round(factor * (data[i + 1] - 128) + 128 + b), 0, 255);
    data[i + 2] = clamp(Math.round(factor * (data[i + 2] - 128) + 128 + b), 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function thresholdCanvas(sourceCanvas, threshold = 168) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = get2dContext(out, { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] >= threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function buildBaseCrops(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  return {
    fullTrim: {
      x: 0,
      y: Math.floor(height * 0.08),
      width,
      height: Math.floor(height * 0.84)
    },
    emergencyTrim: {
      x: 0,
      y: Math.floor(height * 0.15),
      width,
      height: Math.floor(height * 0.58)
    }
  };
}

function addFastVariants(targetList, regionKey, regionLabel, regionCanvas) {
  const scaled = scaleCanvas(regionCanvas, 1.45);

  const gray = grayscaleCanvas(scaled);
  const contrast = contrastCanvas(gray, 40, 6);
  const binary = thresholdCanvas(contrast, 168);

  targetList.push({
    key: `${regionKey}-contrast`,
    label: `${regionLabel} contrast`,
    canvas: contrast
  });

  targetList.push({
    key: `${regionKey}-binary`,
    label: `${regionLabel} binary`,
    canvas: binary
  });
}

export async function prepareOcrImage(file) {
  const image = await fileToImage(file);
  const originalCanvas = drawImageToCanvas(image);

  const baseCrops = buildBaseCrops(originalCanvas);
  const fullTrimCanvas = cropCanvas(originalCanvas, baseCrops.fullTrim);
  const emergencyTrimCanvas = cropCanvas(originalCanvas, baseCrops.emergencyTrim);

  const variants = [];
  addFastVariants(variants, "fulltrim", "Full trimmed", fullTrimCanvas);
  addFastVariants(variants, "emergencytrim", "Emergency trimmed", emergencyTrimCanvas);

  return {
    source: {
      width: originalCanvas.width,
      height: originalCanvas.height
    },
    crop: baseCrops.emergencyTrim,
    originalCanvas,
    fullTrimCanvas,
    centralCardCanvas: fullTrimCanvas,
    croppedCanvas: emergencyTrimCanvas,
    variants
  };
}

export function variantToDataUrl(variantCanvas) {
  return variantCanvas.toDataURL("image/png", 0.92);
}

export function getBestPreviewCanvas(prepared) {
  if (prepared?.croppedCanvas) return prepared.croppedCanvas;
  if (prepared?.fullTrimCanvas) return prepared.fullTrimCanvas;
  if (prepared?.originalCanvas) return prepared.originalCanvas;
  return null;
}
