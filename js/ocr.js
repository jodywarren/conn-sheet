// ocr.js
// OCR orchestration only.
// Handles:
// - file input orchestration
// - image preprocessing
// - OCR read
// - pager candidate scoring
// - safe incident-state patch creation
// - optional UI/status callbacks
//
// Does NOT:
// - redesign UI
// - parse pager rules directly
// - call Tesseract directly
// - change app layout/state model by itself

import { prepareOcrImage, getBestPreviewCanvas } from './ocr-image.js';
import { readPreparedOcr } from './ocr-read.js';
import { scorePagerCandidates } from './pager-score.js';
import { shouldAutoCopyActualAddress } from './pager-parse.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];

  for (const value of values || []) {
    const cleaned = cleanString(value);
    if (!cleaned) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }

  return out;
}

function countFilledMergedFields(merged) {
  let count = 0;
  if (merged?.eventNumber) count += 1;
  if (merged?.pagerDate) count += 1;
  if (merged?.pagerTime) count += 1;
  if (merged?.alertAreaCode) count += 1;
  if (merged?.brigadeRole) count += 1;
  if (merged?.incidentType) count += 1;
  if (merged?.responseCode) count += 1;
  if (merged?.pagerDetails) count += 1;
  if (merged?.scannedAddress) count += 1;
  if (Array.isArray(merged?.sceneUnits) && merged.sceneUnits.length > 0) count += 1;
  return count;
}

function getPrimaryScore(scoredResult) {
  return scoredResult?.primary?.score ?? -999999;
}

function buildTextCandidates(ocrReadResult) {
  const candidates = [];

  if (ocrReadResult?.best?.rawText) {
    candidates.push({
      sourceKey: `best:${ocrReadResult.best.key}`,
      label: `Best OCR variant: ${ocrReadResult.best.label}`,
      rawText: ocrReadResult.best.rawText
    });
  }

  if (ocrReadResult?.combinedText) {
    candidates.push({
      sourceKey: 'combined-top-variants',
      label: 'Combined top OCR variants',
      rawText: ocrReadResult.combinedText
    });
  }

  if (Array.isArray(ocrReadResult?.ranked)) {
    for (const ranked of ocrReadResult.ranked) {
      if (!ranked?.rawText) continue;
      candidates.push({
        sourceKey: `ranked:${ranked.key}`,
        label: `Ranked OCR variant: ${ranked.label}`,
        rawText: ranked.rawText
      });
    }
  }

  // De-duplicate identical text blocks.
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = candidate.rawText.trim();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chooseBestScoredResult(scoredCandidates) {
  if (!scoredCandidates.length) {
    return null;
  }

  return [...scoredCandidates].sort((a, b) => {
    const aSuccess = a.result?.success ? 1 : 0;
    const bSuccess = b.result?.success ? 1 : 0;
    if (bSuccess !== aSuccess) return bSuccess - aSuccess;

    const aFilled = countFilledMergedFields(a.result?.merged);
    const bFilled = countFilledMergedFields(b.result?.merged);
    if (bFilled !== aFilled) return bFilled - aFilled;

    const aPrimaryScore = getPrimaryScore(a.result);
    const bPrimaryScore = getPrimaryScore(b.result);
    if (bPrimaryScore !== aPrimaryScore) return bPrimaryScore - aPrimaryScore;

    return 0;
  })[0];
}

function normaliseSceneUnits(sceneUnits) {
  return uniqueStrings(sceneUnits || []);
}

function buildIncidentPatchFromScoredResult(scoredResult, currentIncident = {}, options = {}) {
  const merged = scoredResult?.merged || {};
  const actualAddressManuallyEdited = !!options.actualAddressManuallyEdited;

  const currentActualAddress = cleanString(currentIncident.actualAddress || '');
  const scannedAddress = cleanString(merged.scannedAddress || '');
  const shouldCopyActualAddress = scannedAddress
    ? shouldAutoCopyActualAddress(currentActualAddress, actualAddressManuallyEdited)
    : false;

  const patch = {
    eventNumber: cleanString(merged.eventNumber || ''),
    pagerDate: cleanString(merged.pagerDate || ''),
    pagerTime: cleanString(merged.pagerTime || ''),
    alertAreaCode: cleanString(merged.alertAreaCode || ''),
    brigadeRole: cleanString(merged.brigadeRole || ''),
    incidentType: cleanString(merged.incidentType || ''),
    responseCode: cleanString(merged.responseCode || ''),
    pagerDetails: cleanString(merged.pagerDetails || ''),
    scannedAddress,
    sceneUnits: normaliseSceneUnits(merged.sceneUnits || [])
  };

  if (shouldCopyActualAddress) {
    patch.actualAddress = scannedAddress;
  }

  return patch;
}

function buildNonEmptyPatch(patch) {
  const out = {};

  for (const [key, value] of Object.entries(patch || {})) {
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value;
      continue;
    }

    if (isNonEmptyString(value)) {
      out[key] = value;
    }
  }

  return out;
}

function buildDebugSummary(chosenCandidate, allScoredCandidates) {
  return {
    selectedSource: chosenCandidate?.sourceKey || '',
    selectedLabel: chosenCandidate?.label || '',
    success: !!chosenCandidate?.result?.success,
    primaryScore: getPrimaryScore(chosenCandidate?.result),
    merged: chosenCandidate?.result?.merged || {},
    candidates: (allScoredCandidates || []).map((entry) => ({
      sourceKey: entry.sourceKey,
      label: entry.label,
      success: !!entry.result?.success,
      primaryScore: getPrimaryScore(entry.result),
      filledFields: countFilledMergedFields(entry.result?.merged),
      reason: entry.result?.reason || '',
      primaryBlockIndex: entry.result?.primary?.blockIndex ?? null
    }))
  };
}

function makeProgressNotifier(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  return (payload) => {
    try {
      callback(payload);
    } catch (error) {
      // Never let UI/status callback failures break OCR flow.
      console.error('OCR progress callback failed:', error);
    }
  };
}

export async function extractPagerDataFromFile(file, options = {}) {
  if (!file) {
    throw new Error('No screenshot file provided');
  }

  const notify = makeProgressNotifier(options.onProgress);

  notify({ stage: 'prepare-start', message: 'Preparing image for OCR' });
  const preparedImage = await prepareOcrImage(file);
  notify({
    stage: 'prepare-complete',
    message: 'Image prepared for OCR',
    crop: preparedImage.crop,
    previewCanvas: getBestPreviewCanvas(preparedImage)
  });

  notify({ stage: 'ocr-start', message: 'Running OCR' });
  const ocrReadResult = await readPreparedOcr(preparedImage, {
    onProgress: (payload) => {
      notify(payload);
    }
  });
  notify({
    stage: 'ocr-complete',
    message: 'OCR complete',
    bestVariant: ocrReadResult?.best?.key || '',
    bestConfidence: ocrReadResult?.best?.confidence || 0,
    bestQualityScore: ocrReadResult?.best?.qualityScore || 0
  });

  const textCandidates = buildTextCandidates(ocrReadResult);

  notify({
    stage: 'score-start',
    message: 'Scoring pager candidates',
    textCandidateCount: textCandidates.length
  });

  const scoredCandidates = textCandidates.map((candidate) => ({
    sourceKey: candidate.sourceKey,
    label: candidate.label,
    rawText: candidate.rawText,
    result: scorePagerCandidates(candidate.rawText)
  }));

  const chosen = chooseBestScoredResult(scoredCandidates);

  notify({
    stage: 'score-complete',
    message: chosen?.result?.success
      ? 'Pager candidate selected'
      : 'No valid pager candidate selected'
  });

  return {
    success: !!chosen?.result?.success,
    reason: chosen?.result?.reason || 'No OCR result available',
    preparedImage,
    ocrReadResult,
    scoredCandidates,
    chosenCandidate: chosen || null,
    chosenResult: chosen?.result || null,
    merged: chosen?.result?.merged || null,
    debug: buildDebugSummary(chosen, scoredCandidates)
  };
}

export async function runPagerOcrIntoIncident(file, integration = {}) {
  const {
    getIncidentState,
    applyIncidentPatch,
    setOcrStatus,
    setOcrBusy,
    onOcrProgress,
    actualAddressManuallyEdited = false,
    onOcrComplete,
    onOcrError
  } = integration;

  const notifyProgress = makeProgressNotifier(onOcrProgress);
  const safeSetStatus = typeof setOcrStatus === 'function' ? setOcrStatus : null;
  const safeSetBusy = typeof setOcrBusy === 'function' ? setOcrBusy : null;

  try {
    if (safeSetBusy) safeSetBusy(true);
    if (safeSetStatus) safeSetStatus('Scanning screenshot...');

    const extraction = await extractPagerDataFromFile(file, {
      onProgress: (payload) => {
        notifyProgress(payload);

        if (safeSetStatus) {
          switch (payload.stage) {
            case 'prepare-start':
              safeSetStatus('Preparing image...');
              break;
            case 'prepare-complete':
              safeSetStatus('Image prepared');
              break;
            case 'ocr-start':
              safeSetStatus('Reading pager text...');
              break;
            case 'ocr-variant-start':
              safeSetStatus(`Reading OCR variant ${payload.index + 1} of ${payload.total}...`);
              break;
            case 'ocr-complete':
              safeSetStatus('OCR finished');
              break;
            case 'score-start':
              safeSetStatus('Scoring pager blocks...');
              break;
            case 'score-complete':
              safeSetStatus(payload.message || 'Scoring complete');
              break;
            default:
              break;
          }
        }
      }
    });

    const currentIncident = typeof getIncidentState === 'function'
      ? (getIncidentState() || {})
      : {};

    const rawPatch = buildIncidentPatchFromScoredResult(
      extraction.chosenResult,
      currentIncident,
      { actualAddressManuallyEdited }
    );

    const patch = buildNonEmptyPatch(rawPatch);

    if (extraction.success && typeof applyIncidentPatch === 'function') {
      applyIncidentPatch(patch, extraction);
    }

    if (safeSetStatus) {
      safeSetStatus(
        extraction.success
          ? 'OCR complete. Check the populated fields.'
          : 'OCR could not safely extract a valid emergency page. Please correct fields manually.'
      );
    }

    const result = {
      success: extraction.success,
      reason: extraction.reason,
      patch,
      extraction
    };

    if (typeof onOcrComplete === 'function') {
      onOcrComplete(result);
    }

    return result;
  } catch (error) {
    console.error('OCR pipeline failed:', error);

    if (safeSetStatus) {
      safeSetStatus('OCR failed. Upload again or correct fields manually.');
    }

    const failure = {
      success: false,
      reason: error?.message || 'OCR failed',
      error
    };

    if (typeof onOcrError === 'function') {
      onOcrError(failure);
    }

    return failure;
  } finally {
    if (safeSetBusy) safeSetBusy(false);
  }
}

export function createPagerOcrController(integration = {}) {
  return {
    runFromFile(file) {
      return runPagerOcrIntoIncident(file, integration);
    }
  };
}

export function buildIncidentPatchForPreview(extractionResult, currentIncident = {}, options = {}) {
  const patch = buildIncidentPatchFromScoredResult(
    extractionResult?.chosenResult || extractionResult,
    currentIncident,
    { actualAddressManuallyEdited: !!options.actualAddressManuallyEdited }
  );

  return buildNonEmptyPatch(patch);
}
