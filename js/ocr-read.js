// ocr-read.js
// Tesseract OCR execution only.
// No pager parsing.
// No DOM/state writes.

function normaliseWhitespace(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildWorkerOptions() {
  return {
    logger: () => {
      // Intentionally quiet here.
      // Progress reporting should be handled from orchestration if needed.
    }
  };
}

async function getTesseract() {
  if (typeof window !== 'undefined' && window.Tesseract) {
    return window.Tesseract;
  }

  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js');
    if (mod?.default) return mod.default;
    return mod;
  } catch (error) {
    throw new Error('Tesseract is not available. Make sure tesseract.js is loaded.');
  }
}

function getRecognitionOptions() {
  return {
    lang: 'eng',
    oem: 1,
    psm: 6,
    tessedit_pageseg_mode: 6,
    preserve_interword_spaces: '1'
  };
}

function scoreRawTextQuality(text) {
  const t = (text || '').toUpperCase();

  let score = 0;

  if (/\bEMERGENCY\b/.test(t) || /\bEMERGENCV\b/.test(t)) score += 30;
  if (/\b\d{2}:\d{2}:\d{2}\b/.test(t)) score += 15;
  if (/\b\d{2}-\d{2}-\d{4}\b/.test(t)) score += 15;
  if (/\bF\d{2}\d{2}\d{5}\b/.test(t)) score += 25;
  if (/\bALERT\s+[A-Z]{4}\d\b/.test(t)) score += 18;
  if (/\b(INCIC1|INCIC3|RESCC1|RESCC3|STRUC1|STRUC3|ALARC1|ALARC3|NSTRC1|NSTRC3|GRASC1|GRASC3|SCRBC1|SCRBC3)\b/.test(t)) {
    score += 18;
  }
  if (/\bCNR\b/.test(t)) score += 5;
  if (/\b(RD|ROAD|ST|STREET|AVE|AVENUE|DR|DRIVE|CT|COURT|LN|LANE|HWY|HIGHWAY|PL|PLACE|WAY|CRES|CRESCENT|BLVD|BOULEVARD|PDE|PARADE)\b/.test(t)) {
    score += 8;
  }
  if (/\b(CONN|GROV|FRES|BARW|TRQY|TQRY|MTDU|MODE|P64|P63B|R63|STHB1|AV|AFP|AFPR|FP)\b/.test(t)) {
    score += 8;
  }

  return score;
}

async function recogniseVariant(Tesseract, variant, options = {}) {
  const recognitionOptions = getRecognitionOptions();
  const image = variant.canvas;

  const result = await Tesseract.recognize(image, recognitionOptions.lang, {
    ...buildWorkerOptions(),
    ...options.loggerOptions
  });

  const rawText = normaliseWhitespace(result?.data?.text || '');
  const confidence = Number.isFinite(result?.data?.confidence) ? result.data.confidence : 0;
  const qualityScore = scoreRawTextQuality(rawText);

  return {
    key: variant.key,
    label: variant.label,
    rawText,
    confidence,
    qualityScore,
    tesseract: result?.data || null
  };
}

function sortVariantResults(results) {
  return [...results].sort((a, b) => {
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return 0;
  });
}

function mergeDistinctTexts(results) {
  const seen = new Set();
  const merged = [];

  for (const result of results) {
    const text = normaliseWhitespace(result.rawText);
    if (!text) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    merged.push(text);
  }

  return merged.join('\n\n');
}

export async function readPreparedOcr(preparedImage, options = {}) {
  if (!preparedImage?.variants?.length) {
    throw new Error('No prepared OCR image variants were provided');
  }

  const Tesseract = await getTesseract();

  const variantResults = [];
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

  for (let i = 0; i < preparedImage.variants.length; i += 1) {
    const variant = preparedImage.variants[i];

    if (onProgress) {
      onProgress({
        stage: 'ocr-variant-start',
        index: i,
        total: preparedImage.variants.length,
        key: variant.key,
        label: variant.label
      });
    }

    const result = await recogniseVariant(Tesseract, variant, options);
    variantResults.push(result);

    if (onProgress) {
      onProgress({
        stage: 'ocr-variant-complete',
        index: i,
        total: preparedImage.variants.length,
        key: variant.key,
        label: variant.label,
        confidence: result.confidence,
        qualityScore: result.qualityScore
      });
    }
  }

  const ranked = sortVariantResults(variantResults);
  const best = ranked[0] || null;
  const combinedText = mergeDistinctTexts(ranked.slice(0, 3));

  return {
    success: !!best,
    best,
    ranked,
    combinedText
  };
}

export async function readSingleCanvasOcr(canvas, options = {}) {
  if (!canvas) {
    throw new Error('No canvas provided for OCR');
  }

  const preparedLike = {
    variants: [
      {
        key: 'single-canvas',
        label: 'Single canvas',
        canvas
      }
    ]
  };

  const result = await readPreparedOcr(preparedLike, options);
  return {
    rawText: result.best?.rawText || '',
    confidence: result.best?.confidence || 0,
    qualityScore: result.best?.qualityScore || 0,
    fullResult: result
  };
}
