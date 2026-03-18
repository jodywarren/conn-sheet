import { prepareOcrImage, getBestPreviewCanvas } from "./ocr-image.js";
import { readPreparedOcr } from "./ocr-read.js";
import { scorePagerCandidates } from "./pager-score.js";
import { state, saveState } from "./state.js";
import { loadIncidentIntoInputs, mergePagedSceneUnits } from "./incident.js";

let ocrBusy = false;

function qs(id) {
  return document.getElementById(id);
}

function setScanStatus(message, className = "scan-idle") {
  const el = qs("scanStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `scan-status ${className}`;
}

function setPreviewFromFile(file) {
  const preview = qs("pagerPreview");
  if (!preview || !file) return;

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    preview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function setPreviewFromPreparedImage(preparedImage) {
  const preview = qs("pagerPreview");
  if (!preview) return;

  const canvas = getBestPreviewCanvas(preparedImage);
  if (!canvas) return;

  preview.src = canvas.toDataURL("image/png");
  preview.classList.remove("hidden");
}

function applyParsedResultToState(parsed) {
  if (!parsed) return;

  if (parsed.eventNumber) state.incident.eventNumber = parsed.eventNumber;

  if (parsed.pagerDate) {
    // Convert DD-MM-YYYY to YYYY-MM-DD for date input
    const match = parsed.pagerDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      state.incident.pagerDate = `${match[3]}-${match[2]}-${match[1]}`;
    }
  }

  if (parsed.pagerTime) state.incident.pagerTime = parsed.pagerTime;
  if (parsed.alertAreaCode) state.incident.alertAreaCode = parsed.alertAreaCode;
  if (parsed.brigadeRole) state.incident.brigadeRole = parsed.brigadeRole;
  if (parsed.incidentType) state.incident.incidentType = parsed.incidentType;
  if (parsed.responseCode) state.incident.responseCode = parsed.responseCode;
  if (parsed.pagerDetails) state.incident.pagerDetails = parsed.pagerDetails;
  if (parsed.scannedAddress) state.incident.scannedAddress = parsed.scannedAddress;

  if (!state.incident.actualAddressEdited && parsed.scannedAddress) {
    state.incident.actualAddress = parsed.scannedAddress;
  }

  if (Array.isArray(parsed.sceneUnits) && parsed.sceneUnits.length) {
    mergePagedSceneUnits(parsed.sceneUnits);
  }

  saveState();
  loadIncidentIntoInputs();
  document.dispatchEvent(new Event("incident:loaded"));
}

async function runPagerOcrIntoIncident(file) {
  try {
    ocrBusy = true;
    setScanStatus("Preparing screenshot...", "scan-working");

    const preparedImage = await prepareOcrImage(file);
    setPreviewFromPreparedImage(preparedImage);

    setScanStatus("Reading pager text...", "scan-working");
    const ocrResult = await readPreparedOcr(preparedImage);

    const rawCandidates = [];

    if (ocrResult?.best?.rawText) rawCandidates.push(ocrResult.best.rawText);
    if (ocrResult?.combinedText) rawCandidates.push(ocrResult.combinedText);

    if (!rawCandidates.length) {
      setScanStatus("OCR failed. No text found.", "scan-error");
      return;
    }

    setScanStatus("Parsing pager details...", "scan-working");

    const scored = rawCandidates
      .map((text) => scorePagerCandidates(text))
      .filter(Boolean)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const best = scored[0];

    if (!best || !best.merged) {
      setScanStatus("OCR could not safely extract incident details.", "scan-error");
      return;
    }

    applyParsedResultToState(best.merged);
    setScanStatus("OCR complete. Check the populated fields.", "scan-success");
  } catch (error) {
    console.error("OCR failed:", error);
    setScanStatus("OCR failed. Upload again or correct fields manually.", "scan-error");
  } finally {
    ocrBusy = false;
  }
}

export function bindOcrEvents() {
  const pagerUpload = qs("pagerUpload");

  if (!pagerUpload) {
    console.warn("Pager upload input not found");
    return;
  }

  pagerUpload.addEventListener("change", async () => {
    const file = pagerUpload.files?.[0];

    if (!file) {
      setScanStatus("Waiting for screenshot", "scan-idle");
      return;
    }

    setPreviewFromFile(file);
    setScanStatus("Screenshot loaded. Scanning...", "scan-working");

    if (ocrBusy) return;

    await runPagerOcrIntoIncident(file);
  });
}
