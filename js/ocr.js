// ocr.js
// OCR orchestration and DOM binding for the Incident page only.
// Auto-scans on upload. No scan button required.

import { state, saveState } from './state.js';
import { loadIncidentIntoInputs, setPagedSceneUnits } from './incident.js';
import { prepareOcrImage, getBestPreviewCanvas, variantToDataUrl } from './ocr-image.js';
import { readPreparedOcr } from './ocr-read.js';
import { scorePagerCandidates } from './pager-score.js';
import { shouldAutoCopyActualAddress } from './pager-parse.js';

let ocrBusy = false;

const KNOWN_AREA_LINES = [
  'CONNEWARRE BRIGADE ALL',
  'CONNEWARRE ALL',
  'MT DUNEED ALL',
  'FRESHWATER CREEK BRIGADE ALL',
  'FRESHWATER CREEK ALL'
];

const HEADER_VARIANTS = [
  'EMERGENCY',
  'EMERGENCV',
  'EMERGENC Y',
  'EMERGENC¥',
  'EMERGENC7'
];

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
  const box = qs('pagerUploadBox');

  if (!img || !file) return;

  const reader = new FileReader();
  reader.onload = () => {
    img.src = reader.result;
    img.classList.remove('hidden');

    if (box) {
      box.classList.remove('upload-empty');
      box.classList.add('upload-loaded');
    }

    // 🔥 persist screenshot
    state.incident.pagerScreenshot = reader.result;
    saveState();
  };
  reader.readAsDataURL(file);
}

function setPreviewFromCanvas(canvas) {
  const img = qs('pagerPreview');
  if (!img || !canvas) return;

  img.src = variantToDataUrl(canvas);
  img.classList.remove('hidden');
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
  if (!value || !/^\d{2}-\d{2}-\d{4}$/.test(value)) return '';
  const [dd, mm, yyyy] = value.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

function normaliseSceneUnits(sceneUnits) {
  return uniqueStrings(sceneUnits || []);
}

function normalizeRawText(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[|]/g, '1')
    .replace(/EMERGENCV/g, 'EMERGENCY')
    .replace(/EMERGENC Y/g, 'EMERGENCY')
    .replace(/EMERGENC¥/g, 'EMERGENCY')
    .replace(/EMERGENC7/g, 'EMERGENCY')
    .replace(/NONEMERGENCY/g, 'NON EMERGENCY')
    .replace(/NON-EMERGENCY/g, 'NON EMERGENCY')
    .replace(/2&8\\T/g, 'MT DUNEED ALL')
    .replace(/2&8\s?\\T/g, 'MT DUNEED ALL')
    .replace(/ALARCI/g, 'ALARC1')
    .replace(/ALARC!/g, 'ALARC1')
    .replace(/STRUCI/g, 'STRUC1')
    .replace(/STRUC!/g, 'STRUC1')
    .replace(/INCICI/g, 'INCIC1')
    .replace(/INCIC!/g, 'INCIC1')
    .replace(/NSTRCI/g, 'NSTRC1')
    .replace(/NSTRC!/g, 'NSTRC1')
    .replace(/G&SCI/g, 'G&SC1')
    .replace(/G&SC!/g, 'G&SC1')
    .replace(/[^\S\n]+/g, ' ')
    .trim();
}

function upperLines(text) {
  return normalizeRawText(text)
    .toUpperCase()
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractEventNumber(text) {
  const raw = normalizeRawText(text).toUpperCase();

  const direct = raw.match(/\bF[0-9IO]{9}\b/);
  if (direct) {
    return direct[0].replace(/I/g, '1').replace(/O/g, '0');
  }

  const header = raw.match(/EVENT\s*ID[:\s]+(F[0-9IO]{9})\b/);
  if (header?.[1]) {
    return header[1].replace(/I/g, '1').replace(/O/g, '0');
  }

  return '';
}

function extractEmergencyHeaderLine(text) {
  const lines = upperLines(text);

  for (const line of lines) {
    const hasHeaderWord = HEADER_VARIANTS.some((word) => line.includes(word));
    const hasTime = /\b\d{1,2}:\d{2}:\d{2}\b/.test(line);
    const hasDate = /\b\d{2}[-/:]\d{2}[-/:]\d{4}\b/.test(line);

    if (hasHeaderWord && hasTime && hasDate) {
      return line.replace(/\//g, '-').replace(/:/g, (m, idx, full) => {
        return /\d{2}:\d{2}:\d{2}/.test(full) ? ':' : '-';
      });
    }
  }

  return '';
}

function extractVerifiedPagerDateTime(text, eventNumber) {
  const header = extractEmergencyHeaderLine(text);
  const eventNo = String(eventNumber || '').toUpperCase();

  if (!header || !eventNo) {
    return { date: '', time: '', valid: false };
  }

  const timeMatch = header.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);
  const dateMatch = header.match(/\b(\d{2})[-/:](\d{2})[-/:](\d{4})\b/);
  const eventMatch = eventNo.match(/^F(\d{2})(\d{2})\d{5}$/);

  if (!timeMatch || !dateMatch || !eventMatch) {
    return { date: '', time: '', valid: false };
  }

  const [, dd, mm, yyyy] = dateMatch;
  const [, yyFromEvent, mmFromEvent] = eventMatch;

  const yearMatches = yyyy.slice(2) === yyFromEvent;
  const monthMatches = mm === mmFromEvent;

  if (!yearMatches || !monthMatches) {
    return { date: '', time: '', valid: false };
  }

  return {
    date: `${dd}-${mm}-${yyyy}`,
    time: timeMatch[1].slice(0, 5),
    valid: true
  };
}

function extractAreaLine(text) {
  const upper = normalizeRawText(text).toUpperCase();

  for (const candidate of KNOWN_AREA_LINES) {
    if (upper.includes(candidate)) return candidate;
  }

  return '';
}

function deriveAlertAreaCode(text) {
  const areaLine = extractAreaLine(text);

  if (areaLine.includes('CONNEWARRE')) return 'CONN';
  if (areaLine.includes('MT DUNEED')) return 'MTDU';
  if (areaLine.includes('FRESHWATER CREEK')) return 'FRES';

  const alertPrefix = normalizeRawText(text).toUpperCase().match(/\bALERT\s+([A-Z]+)\d+/);
  return alertPrefix?.[1] || '';
}

function deriveBrigadeRole(text) {
  const areaLine = extractAreaLine(text);
  const code = deriveAlertAreaCode(text);

  if (areaLine.includes('CONNEWARRE')) return 'Primary';
  if (areaLine.includes('MT DUNEED')) return 'Support to Mt Duneed';
  if (areaLine.includes('FRESHWATER CREEK')) return 'Support to Freshwater Creek';
  if (code === 'CONN') return 'Primary';
  if (code) return `Support to ${code}`;

  return '';
}

function extractIncidentCode(text) {
  const upper = normalizeRawText(text).toUpperCase();
  return upper.match(/\b(ALARC[13]|STRUC[13]|INCIC[13]|G&SC[13]|NSTRC[13])\b/)?.[1] || '';
}

function deriveIncidentType(code) {
  const upper = String(code || '').toUpperCase();

  if (upper.startsWith('ALARC')) return 'ALAR';
  if (upper.startsWith('STRUC')) return 'STRU';
  if (upper.startsWith('INCIC')) return 'INCI';
  if (upper.startsWith('G&SC')) return 'G&SC';
  if (upper.startsWith('NSTRC')) return 'NSTR';

  return '';
}

function deriveResponseCode(code) {
  const upper = String(code || '').toUpperCase();
  if (upper.endsWith('1')) return 'Code 1';
  if (upper.endsWith('3')) return 'Code 3';
  return '';
}

function extractAlertBlockText(text) {
  const lines = upperLines(text);
  const startIndex = lines.findIndex((line) => line.includes('ALERT '));
  if (startIndex === -1) return '';

  const collected = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    collected.push(line);
    if (extractEventNumber(line) || /\bF[0-9IO]{9}\b/.test(line)) break;
  }

  return collected.join(' ');
}

function stripTrailingOperationalTokens(text) {
  return String(text || '')
    .replace(/\bF[0-9IO]{9}\b/g, '')
    .replace(/\b(?:M|SVC|SVSW)\s+\d{3,4}\s+[A-Z]\d{1,2}\s+\(\d+\)\b/g, '')
    .replace(/\b(?:C[A-Z]{4}|P\d+[A-Z]?|R\d+[A-Z]?|AFP|FP|AV|STHB1)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractScannedAddress(text) {
  let combined = extractAlertBlockText(text);
  if (!combined) return '';

  combined = combined
    .replace(/^.*?ALERT\s+[A-Z0-9]+\s+(?:ALARC[13]|STRUC[13]|INCIC[13]|G&SC[13]|NSTRC[13])\s*/, '')
    .trim();

  combined = stripTrailingOperationalTokens(combined)
    .replace(/\/{2,}/g, ' // ')
    .replace(/\s*\/\/\s*/g, ' // ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!combined) return '';

  if (/\bCNR\b/.test(combined)) {
    const cnrMatch = combined.match(
      /\bCNR\s+[A-Z0-9 \-]+?(?:ST|RD|DR|AVE|AV|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\s*\/\s*[A-Z0-9 \-]+?(?:ST|RD|DR|AVE|AV|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\b/
    );
    if (cnrMatch?.[0]) {
      return cnrMatch[0].trim();
    }
  }

  const numbered = combined.match(
    /\b\d+\s+[A-Z0-9 \-]+?(?:ST|RD|DR|AVE|AV|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\b/
  );
  if (numbered?.[0]) {
    return numbered[0].trim();
  }

  const slashIndex = combined.indexOf(' / ');
  if (slashIndex > 0) {
    return combined.slice(0, slashIndex).trim();
  }

  const doubleSlashIndex = combined.indexOf(' // ');
  if (doubleSlashIndex > 0) {
    return combined.slice(0, doubleSlashIndex).trim();
  }

  return combined;
}

function buildIncidentPatchFromExtraction(extraction) {
  const merged = extraction?.chosenResult?.merged || {};
  const chosenRawText =
    extraction?.chosenResult?.primary?.rawText ||
    extraction?.chosenCandidate?.rawText ||
    '';

  const fullPagerText = cleanString(merged.pagerDetails || chosenRawText);
  const eventNumber = cleanString(merged.eventNumber || extractEventNumber(fullPagerText));

  const verifiedDateTime = extractVerifiedPagerDateTime(fullPagerText, eventNumber);

  const alertAreaCode = cleanString(
    merged.alertAreaCode || deriveAlertAreaCode(fullPagerText)
  );

  const brigadeRole = cleanString(
    merged.brigadeRole || deriveBrigadeRole(fullPagerText)
  );

  const incidentCode = cleanString(extractIncidentCode(fullPagerText));
  const incidentType = cleanString(
    merged.incidentType || deriveIncidentType(incidentCode)
  );

  const responseCode = cleanString(
    merged.responseCode || deriveResponseCode(incidentCode)
  );

  const scannedAddress = cleanString(
    merged.scannedAddress || extractScannedAddress(fullPagerText)
  );

  const currentActualAddress = cleanString(state?.incident?.actualAddress || '');
  const actualAddressEdited = !!state?.incident?.actualAddressEdited;

  const patch = {
    eventNumber,
    pagerDate: convertPagerDateToInputDate(cleanString(merged.pagerDate || verifiedDateTime.date)),
    pagerTime: cleanString(merged.pagerTime || verifiedDateTime.time),
    alertAreaCode,
    brigadeRole,
    incidentType,
    responseCode,
    pagerDetails: fullPagerText,
    scannedAddress,
    sceneUnits: normaliseSceneUnits(merged.sceneUnits || [])
  };

  const shouldCopy = scannedAddress
    ? shouldAutoCopyActualAddress(currentActualAddress, actualAddressEdited)
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

function applyPatchToIncidentState(patch) {
  if (!state?.incident) return;

  if (patch.eventNumber) state.incident.eventNumber = patch.eventNumber;
  if (patch.pagerDate) state.incident.pagerDate = patch.pagerDate;
  if (patch.pagerTime) state.incident.pagerTime = patch.pagerTime;
  if (patch.alertAreaCode) state.incident.alertAreaCode = patch.alertAreaCode;
  if (patch.brigadeRole) state.incident.brigadeRole = patch.brigadeRole;
  if (patch.incidentType) state.incident.incidentType = patch.incidentType;
  if (patch.responseCode) state.incident.responseCode = patch.responseCode;
  if (patch.pagerDetails) state.incident.pagerDetails = patch.pagerDetails;
  if (patch.scannedAddress) state.incident.scannedAddress = patch.scannedAddress;

  if (patch.actualAddress) {
    state.incident.actualAddress = patch.actualAddress;
  }

  if (Array.isArray(patch.sceneUnits) && patch.sceneUnits.length > 0) {
    setPagedSceneUnits(patch.sceneUnits);
  } else {
    saveState();
  }

  loadIncidentIntoInputs();
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
            setScanStatus(payload.message || 'Scoring complete', 'scan-working');
            break;
          default:
            break;
        }
      }
    });

    const rawPatch = buildIncidentPatchFromExtraction(extraction);
    const patch = buildNonEmptyPatch(rawPatch);

    if (extraction.success) {
      applyPatchToIncidentState(patch);
      setScanStatus('OCR complete. Check the populated fields.', 'scan-good');
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

export function buildIncidentPatchForPreview(extractionResult) {
  const extraction = extractionResult?.chosenResult
    ? extractionResult
    : { chosenResult: extractionResult, chosenCandidate: null };

  const patch = buildIncidentPatchFromExtraction(extraction);
  return buildNonEmptyPatch(patch);
}

export function bindOcrEvents() {
  const pagerUpload = qs('pagerUpload');
  const uploadBox = qs('pagerUploadBox');

  if (!pagerUpload) {
    console.warn('Pager upload control not found in DOM');
    return;
  }

  if (uploadBox) {
    uploadBox.addEventListener('click', () => {
      pagerUpload.click();
    });
  }

  if (state.incident.pagerScreenshot) {
    const img = qs('pagerPreview');

    if (img) {
      img.src = state.incident.pagerScreenshot;
      img.classList.remove('hidden');
    }

    if (uploadBox) {
      uploadBox.classList.remove('upload-empty');
      uploadBox.classList.add('upload-loaded');
    }
  }

  pagerUpload.addEventListener('change', async () => {
    const file = pagerUpload.files && pagerUpload.files[0];

    if (!file) {
      setScanStatus('Waiting for screenshot', 'scan-idle');
      return;
    }

    setPreviewFromFile(file);
    setScanStatus('Screenshot loaded. Scanning...', 'scan-working');

    if (ocrBusy) return;
    await runPagerOcrIntoIncident(file);
  });
}
  
  pagerUpload.addEventListener('change', async () => {
    const file = pagerUpload.files && pagerUpload.files[0];

    if (!file) {
      setScanStatus('Waiting for screenshot', 'scan-idle');
      return;
    }

    setPreviewFromFile(file);
    setScanStatus('Screenshot loaded. Scanning...', 'scan-working');

    if (ocrBusy) return;
    await runPagerOcrIntoIncident(file);
  });
}
