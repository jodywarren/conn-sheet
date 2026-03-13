// ocr.js
// OCR orchestration and DOM binding for the Incident page only.
// Keeps existing layout/workflow intact.
//
// Handles:
// - screenshot file input
// - preview image
// - image preprocessing
// - OCR read
// - pager candidate scoring
// - strict writeback into existing incident inputs
//
// Does NOT redesign UI or change page layout.

import { prepareOcrImage, getBestPreviewCanvas, variantToDataUrl } from './ocr-image.js';
import { readPreparedOcr } from './ocr-read.js';
import { scorePagerCandidates } from './pager-score.js';
import { shouldAutoCopyActualAddress } from './pager-parse.js';

let actualAddressManuallyEdited = false;
let ocrBusy = false;

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

function qs(id) {
  return document.getElementById(id);
}

function setScanStatus(message, className = 'scan-idle') {
  const el = qs('scanStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = `scan-status ${className}`.trim();
}

function setPreviewFromFile(file) {
  const img = qs('pagerPreview');
  if (!img || !file) return;

  const reader = new FileReader();
  reader.onload = () => {
    img.src = reader.result;
    img.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function setPreviewFromCanvas(canvas) {
  const img = qs('pagerPreview');
  if (!img || !canvas) return;

  img.src = variantToDataUrl(canvas);
  img.classList.remove('hidden');
}

function getInputValue(id) {
  const el = qs(id);
  return el ? el.value : '';
}

function setInputValue(id, value) {
  const el = qs(id);
  if (!el) return false;

  const nextValue = value ?? '';
  el.value = nextValue;

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function getIncidentStateFromDom() {
  return {
    eventNumber: getInputValue('eventNumber'),
    pagerDate: getInputValue('pagerDate'),
    pagerTime: getInputValue('pagerTime'),
    alertAreaCode: getInputValue('alertAreaCode'),
    brigadeRole: getInputValue('brigadeRole'),
    incidentType: getInputValue('incidentType'),
    responseCode: getInputValue('responseCode'),
    pagerDetails: getInputValue('pagerDetails'),
    scannedAddress: getInputValue('scannedAddress'),
    actualAddress: getInputValue('actualAddress')
  };
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
  if (!scoredCandidates.length) return null;

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

function convertPagerDateToInputDate(value) {
  // OCR parser returns DD-MM-YYYY
  if (!value || !/^\d{2}-\d{2}-\d{4}$/.test(value)) return '';
  const [dd, mm, yyyy] = value.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

function normaliseSceneUnits(sceneUnits) {
  return uniqueStrings(sceneUnits || []);
}

function buildIncidentPatchFromScoredResult(scoredResult, currentIncident = {}, options = {}) {
  const merged = scoredResult?.merged || {};
  const currentActualAddress = cleanString(currentIncident.actualAddress || '');
  const scannedAddress = cleanString(merged.scannedAddress || '');

  const patch = {
    eventNumber: cleanString(merged.eventNumber || ''),
    pagerDate: convertPagerDateToInputDate(cleanString(merged.pagerDate || '')),
    pagerTime: cleanString(merged.pagerTime || ''),
    alertAreaCode: cleanString(merged.alertAreaCode || ''),
    brigadeRole: cleanString(merged.brigadeRole || ''),
    incidentType: cleanString(merged.incidentType || ''),
    responseCode: cleanString(merged.responseCode || ''),
    pagerDetails: cleanString(merged.pagerDetails || ''),
    scannedAddress,
    sceneUnits: normaliseSceneUnits(merged.sceneUnits || [])
  };

  const shouldCopy = scannedAddress
    ? shouldAutoCopyActualAddress(currentActualAddress, !!options.actualAddressManuallyEdited)
    : false;

  if (shouldCopy) {
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

function existingSceneUnitTexts() {
  const wrap = qs('sceneUnitChips');
  if (!wrap) return [];

  return Array.from(wrap.querySelectorAll('.chip, .chip-btn, .unit-chip, button, span'))
    .map((el) => cleanString(el.textContent || ''))
    .filter(Boolean);
}

function addSceneUnitThroughUi(unit) {
  const input = qs('sceneUnitInput');
  const btn = qs('addSceneUnitBtn');
  if (!input || !btn || !unit) return false;

  input.value = unit;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  btn.click();
  return true;
}

function applySceneUnitsToUi(units) {
  const desired = normaliseSceneUnits(units);
  if (!desired.length) return;

  const existing = new Set(existingSceneUnitTexts().map((t) => t.toUpperCase()));

  for (const unit of desired) {
    const key = unit.toUpperCase();
    if (existing.has(key)) continue;
    addSceneUnitThroughUi(unit);
    existing.add(key);
  }
}

function applyIncidentPatchToDom(patch) {
  if (patch.eventNumber) setInputValue('eventNumber', patch.eventNumber);
  if (patch.pagerDate) setInputValue('pagerDate', patch.pagerDate);
  if (patch.pagerTime) setInputValue('pagerTime', patch.pagerTime);
  if (patch.alertAreaCode) setInputValue('alertAreaCode', patch.alertAreaCode);
  if (patch.brigadeRole) setInputValue('brigadeRole', patch.brigadeRole);
  if (patch.incidentType) setInputValue('incidentType', patch.incidentType);
  if (patch.responseCode) setInputValue('responseCode', patch.responseCode);
  if (patch.pagerDetails) setInputValue('pagerDetails', patch.pagerDetails);
  if (patch.scannedAddress) setInputValue('scannedAddress', patch.scannedAddress);
  if (patch.actualAddress) setInputValue('actualAddress', patch.actualAddress);
  if (Array.isArray(patch.sceneUnits) && patch.sceneUnits.length) {
    applySceneUnitsToUi(patch.sceneUnits);
  }
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

  const previewCanvas = getBestPreviewCanvas(preparedImage);
  notify({
    stage: 'prepare-complete',
    message: 'Image prepared for OCR',
    crop: preparedImage.crop,
    previewCanvas
  });

  notify({ stage: 'ocr-start', message: 'Running OCR' });
  const ocrReadResult = await readPreparedOcr(preparedImage, {
    onProgress: (payload) => notify(payload)
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
    onOcrProgress,
    onOcrComplete,
    onOcrError,
    previewPreparedCrop = true
  } = integration;

  const notifyProgress = makeProgressNotifier(onOcrProgress);

  try {
    ocrBusy = true;
    setScanStatus('Preparing image...', 'scan-working');

    const extraction = await extractPagerDataFromFile(file, {
      onProgress: (payload) => {
        notifyProgress(payload);

        switch (payload.stage) {
          case 'prepare-start':
            setScanStatus('Preparing image...', 'scan-working');
            break;
          case 'prepare-complete':
            setScanStatus('Image prepared', 'scan-working');
            if (previewPreparedCrop && payload.previewCanvas) {
              setPreviewFromCanvas(payload.previewCanvas);
            }
            break;
          case 'ocr-start':
            setScanStatus('Reading pager text...', 'scan-working');
            break;
          case 'ocr-variant-start':
            setScanStatus(`Reading OCR variant ${payload.index + 1} of ${payload.total}...`, 'scan-working');
            break;
          case 'ocr-complete':
            setScanStatus('OCR finished', 'scan-working');
            break;
          case 'score-start':
            setScanStatus('Scoring pager blocks...', 'scan-working');
            break;
          case 'score-complete':
            setScanStatus(
              payload.message || 'Scoring complete',
              extraction?.success ? 'scan-success' : 'scan-working'
            );
            break;
          default:
            break;
        }
      }
    });

    const currentIncident = getIncidentStateFromDom();
    const rawPatch = buildIncidentPatchFromScoredResult(
      extraction.chosenResult,
      currentIncident,
      { actualAddressManuallyEdited }
    );
    const patch = buildNonEmptyPatch(rawPatch);

    if (extraction.success) {
      applyIncidentPatchToDom(patch);
      setScanStatus('OCR complete. Check the populated fields.', 'scan-success');
    } else {
      setScanStatus('OCR could not safely extract a valid emergency page. Please correct fields manually.', 'scan-error');
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
    setScanStatus('OCR failed. Upload again or correct fields manually.', 'scan-error');

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
    ocrBusy = false;
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

export function bindOcrEvents() {
  const pagerUpload = qs('pagerUpload');
  const scanPagerBtn = qs('scanPagerBtn');
  const actualAddressInput = qs('actualAddress');

  if (!pagerUpload || !scanPagerBtn) {
    console.warn('OCR controls not found in DOM');
    return;
  }

  if (actualAddressInput) {
    actualAddressInput.addEventListener('input', () => {
      actualAddressManuallyEdited = true;
    });
  }

  pagerUpload.addEventListener('change', () => {
    const file = pagerUpload.files && pagerUpload.files[0];
    if (!file) {
      setScanStatus('Waiting for screenshot', 'scan-idle');
      return;
    }

    setPreviewFromFile(file);
    setScanStatus('Screenshot loaded. Ready to scan.', 'scan-idle');
  });

  scanPagerBtn.addEventListener('click', async () => {
    if (ocrBusy) return;

    const file = pagerUpload.files && pagerUpload.files[0];
    if (!file) {
      setScanStatus('Please choose a screenshot first.', 'scan-error');
      return;
    }

    await runPagerOcrIntoIncident(file);
  });
}
