// ocr-read.js
// Tesseract OCR only.
// Faster version capped at 6 OCR passes total.

function getWorkerSource() {
  if (window.Tesseract && typeof window.Tesseract.createWorker === "function") {
    return window.Tesseract;
  }

  throw new Error("Tesseract is not available on window");
}

function buildPasses(preparedImage) {
  const variants = Array.isArray(preparedImage?.variants) ? preparedImage.variants : [];

  // Hard cap: 6 OCR passes total
  // Prefer the strongest contrast/binary variants first
  const preferred = [];

  const pushIfFound = (keyPart, psm) => {
    const found = variants.find((v) => v.key.includes(keyPart));
    if (found) {
      preferred.push({
        key: `${found.key}-psm${psm}`,
        label: `${found.label} psm ${psm}`,
        canvas: found.canvas,
        psm
      });
    }
  };

  pushIfFound("emergencytrim-contrast", 6);
  pushIfFound("emergencytrim-binary", 6);
  pushIfFound("fulltrim-contrast", 6);
  pushIfFound("fulltrim-binary", 6);
  pushIfFound("emergencytrim-contrast", 11);
  pushIfFound("fulltrim-contrast", 11);

  return preferred.slice(0, 6);
}

function normaliseRawText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function scoreRawTextQuality(text) {
  const value = normaliseRawText(text);
  if (!value) return 0;

  let score = 0;

  if (/\bEMERGENCY\b|\bEMERGENCV\b/.test(value)) score += 20;
  if (/\bALERT\b/.test(value)) score += 15;
  if (/\bF\d{9}\b/.test(value)) score += 20;
  if (/\b[A-Z]{4}\d{1,2}\b/.test(value)) score += 8;
  if (/\b(INCIC1|INCIC3|RESCC1|RESCC3|STRUC1|STRUC3|ALARC1|ALARC3|NSTRC1|NSTRC3|GRASC1|GRASC3|SCRBC1|SCRBC3)\b/.test(value)) score += 15;
  if (/\b\d{2}:\d{2}:\d{2}\b/.test(value)) score += 6;
  if (/\b\d{2}-\d{2}-\d{4}\b/.test(value)) score += 6;
  if (/\b(CNR|RD|ST|AV|DR)\b/.test(value)) score += 5;

  return score;
}

function combineTopTexts(results, maxCount = 3) {
  return results
    .slice()
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, maxCount)
    .map((r) => r.rawText)
    .filter(Boolean)
    .join("\n\n");
}

export async function readPreparedOcr(preparedImage, options = {}) {
  const workerSource = getWorkerSource();
  const passes = buildPasses(preparedImage);
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

  if (!passes.length) {
    return {
      best: null,
      ranked: [],
      combinedText: ""
    };
  }

  const worker = await workerSource.createWorker("eng");
  const results = [];

  try {
    for (let i = 0; i < passes.length; i += 1) {
      const pass = passes[i];

      if (onProgress) {
        onProgress({
          stage: "ocr-variant-start",
          index: i,
          total: passes.length,
          key: pass.key,
          label: pass.label
        });
      }

      await worker.setParameters({
        tessedit_pageseg_mode: pass.psm,
        preserve_interword_spaces: "1"
      });

      const result = await worker.recognize(pass.canvas);
      const rawText = normaliseRawText(result?.data?.text || "");
      const confidence = Number(result?.data?.confidence || 0);
      const qualityScore = scoreRawTextQuality(rawText) + Math.round(confidence / 10);

      results.push({
        key: pass.key,
        label: pass.label,
        rawText,
        confidence,
        qualityScore
      });

      // Early stop if we already have a clearly strong result
      if (
        /\bEMERGENCY\b|\bEMERGENCV\b/.test(rawText) &&
        /\bALERT\b/.test(rawText) &&
        /\bF\d{9}\b/.test(rawText) &&
        confidence >= 45
      ) {
        break;
      }
    }
  } finally {
    await worker.terminate();
  }

  const ranked = results.slice().sort((a, b) => b.qualityScore - a.qualityScore);
  const best = ranked[0] || null;
  const combinedText = combineTopTexts(ranked, 3);

  return {
    best,
    ranked,
    combinedText
  };
}
