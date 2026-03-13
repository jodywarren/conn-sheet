// ocr-image.js
// Image loading, optional internal cropping, and OCR preprocessing only.
// No Tesseract calls.
// No pager parsing.
// No DOM/state writes.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function get2dContext(canvas, options = {}) {
  return canvas.getContext('2d', {
    alpha: false,
    willReadFrequently: !!options.willReadFrequently
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No image file provided'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to decode image'));
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
  const safeScale = Math.max(0.5, Math.min(scale, 4));
  const out = createCanvas(sourceCanvas.width * safeScale, sourceCanvas.height * safeScale);
  const ctx = get2dContext(out);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
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

function thresholdCanvas(sourceCanvas, threshold = 165) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = get2dContext(out, { willReadFrequently: true });

  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const data = imageData.data;
  const t = clamp(threshold, 0, 255);

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const value = gray >= t ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function despeckleCanvas(sourceCanvas) {
  const out = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const srcCtx = get2dContext(sourceCanvas, { willReadFrequently: true });
  const outCtx = get2dContext(out, { willReadFrequently: true });

  const src = srcCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const dst = outCtx.createImageData(sourceCanvas.width, sourceCanvas.height);

  const { width, height } = sourceCanvas;
  const s = src.data;
  const d = dst.data;

  function getGray(x, y) {
    const idx = (y * width + x) * 4;
    return s[idx];
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += getGray(nx, ny);
          count += 1;
        }
      }

      const avg = Math.round(sum / Math.max(1, count));
      const idx = (y * width + x) * 4;
      d[idx] = avg;
      d[idx + 1] = avg;
      d[idx + 2] = avg;
      d[idx + 3] = 255;
    }
  }

  outCtx.putImageData(dst, 0, 0);
  return out;
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function scanHorizontalInkDensity(grayCanvas, startY, endY) {
  const ctx = get2dContext(grayCanvas, { willReadFrequently: true });
  const { width, height } = grayCanvas;
  const y0 = clamp(Math.floor(startY), 0, height - 1);
  const y1 = clamp(Math.floor(endY), y0 + 1, height);
  const imageData = ctx.getImageData(0, y0, width, y1 - y0);
  const data = imageData.data;

  const rows = [];
  for (let row = 0; row < y1 - y0; row += 1) {
    let darkCount = 0;
    let strongDarkTransitions = 0;
    let prevDark = false;

    for (let x = 0; x < width; x += 1) {
      const idx = (row * width + x) * 4;
      const gray = data[idx];
      const isDark = gray < 150;
      if (isDark) darkCount += 1;
      if (x > 0 && isDark !== prevDark) strongDarkTransitions += 1;
      prevDark = isDark;
    }

    rows.push({
      y: y0 + row,
      darkRatio: darkCount / width,
      transitions: strongDarkTransitions
    });
  }

  return rows;
}

function estimateAlertCardCrop(sourceCanvas) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // First remove obvious top/bottom app chrome by rule-of-thumb.
  // This is safer than trying to be too clever and accidentally cutting the alert.
  const safeTop = Math.floor(height * 0.10);
  const safeBottom = Math.floor(height * 0.93);

  const baseCrop = {
    x: Math.floor(width * 0.04),
    y: safeTop,
    width: Math.floor(width * 0.92),
    height: Math.max(1, safeBottom - safeTop)
  };

  const baseCanvas = cropCanvas(sourceCanvas, baseCrop);
  const gray = grayscaleCanvas(baseCanvas);
  const rows = scanHorizontalInkDensity(gray, 0, gray.height);

  // Search for a dense text/header region in upper half.
  const searchLimit = Math.max(20, Math.floor(rows.length * 0.45));
  let bestRowIndex = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < searchLimit; i += 1) {
    const row = rows[i];
    const score = (row.darkRatio * 100) + (row.transitions * 0.15);

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = i;
    }
  }

  // Start slightly above detected header/text area.
  const cropStartY = clamp(bestRowIndex - Math.floor(gray.height * 0.03), 0, gray.height - 1);

  // End before obvious footer controls if present.
  const lowerRows = rows.slice(Math.floor(rows.length * 0.55));
  let footerStart = rows.length;

  for (let i = 0; i < lowerRows.length; i += 1) {
    const rowIndex = Math.floor(rows.length * 0.55) + i;
    const row = rows[rowIndex];

    // Footer/nav bars often have moderate density but low text transitions.
    if (row.darkRatio > 0.18 && row.transitions < 14) {
      footerStart = rowIndex;
      break;
    }
  }

  let cropEndY = footerStart - Math.floor(gray.height * 0.02);
  if (!Number.isFinite(cropEndY) || cropEndY <= cropStartY + 80) {
    cropEndY = Math.floor(gray.height * 0.86);
  }

  cropEndY = clamp(cropEndY, cropStartY + 80, gray.height);

  // Slight side trim helps remove rounded-card borders and side icons.
  const finalCrop = {
    x: baseCrop.x + Math.floor(baseCanvas.width * 0.02),
    y: baseCrop.y + cropStartY,
    width: Math.floor(baseCanvas.width * 0.96),
    height: cropEndY - cropStartY
  };

  return finalCrop;
}

function buildPreprocessedVariants(croppedCanvas) {
  const variants = [];

  const scaled = scaleCanvas(croppedCanvas, 1.8);
  variants.push({
    key: 'cropped-color-2x',
    label: 'Cropped color',
    canvas: scaled
  });

  const gray = grayscaleCanvas(scaled);
  variants.push({
    key: 'cropped-gray-2x',
    label: 'Cropped grayscale',
    canvas: gray
  });

  const grayContrast = contrastCanvas(gray, 42, 4);
  variants.push({
    key: 'cropped-gray-contrast',
    label: 'Cropped grayscale contrast',
    canvas: grayContrast
  });

  const denoised = despeckleCanvas(grayContrast);
  variants.push({
    key: 'cropped-gray-denoised',
    label: 'Cropped grayscale denoised',
    canvas: denoised
  });

  const binary = thresholdCanvas(denoised, 168);
  variants.push({
    key: 'cropped-binary',
    label: 'Cropped binary',
    canvas: binary
  });

  return variants;
}

export async function prepareOcrImage(file) {
  const image = await fileToImage(file);
  const originalCanvas = drawImageToCanvas(image);

  const internalCrop = estimateAlertCardCrop(originalCanvas);
  const croppedCanvas = cropCanvas(originalCanvas, internalCrop);
  const variants = buildPreprocessedVariants(croppedCanvas);

  return {
    source: {
      width: originalCanvas.width,
      height: originalCanvas.height
    },
    crop: internalCrop,
    originalCanvas,
    croppedCanvas,
    variants
  };
}

export async function variantToBlob(variantCanvas) {
  return canvasToBlob(variantCanvas, 'image/png', 0.92);
}

export function variantToDataUrl(variantCanvas) {
  return variantCanvas.toDataURL('image/png', 0.92);
}

export function getBestPreviewCanvas(prepared) {
  if (prepared?.croppedCanvas) return prepared.croppedCanvas;
  if (prepared?.originalCanvas) return prepared.originalCanvas;
  return null;
}
