import { state, saveState } from "./state.js";
import { loadIncidentIntoInputs, setSceneBrigades } from "./incident.js";

const VALID_INCIDENT_TYPES = ["ALAR", "STRU", "NONS", "INCI", "G&SC", "RESC"];
const KNOWN_PAGED_UNITS = ["CONN", "GROV", "FRES", "BARW", "P64", "P63B", "TRQY", "STHB1", "MTDU", "R63", "AFPR", "MODE"];

export function bindOcrEvents() {
  const upload = document.getElementById("pagerUpload");
  const scanBtn = document.getElementById("scanPagerBtn");

  upload?.addEventListener("change", handleScreenshotUpload);

  scanBtn?.addEventListener("click", () => {
    console.log("SCAN BUTTON CLICKED");
    setScanStatus("Scan button pressed...", "scan-working");
    runOcrFromPreview();
  });
}

async function handleScreenshotUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const dataUrl = await fileToDataUrl(file);
  state.incident.pagerScreenshot = dataUrl;

  const preview = document.getElementById("pagerPreview");
  if (preview) {
    preview.src = dataUrl;
    preview.classList.remove("hidden");
  }

  setScanStatus("Screenshot loaded. Press Scan Screenshot.", "scan-idle");
  saveState();
}

async function runOcrFromPreview() {
  console.log("runOcrFromPreview started");

  if (!window.Tesseract) {
    setScanStatus("OCR library not loaded.", "scan-error");
    return;
  }

  if (!state.incident.pagerScreenshot) {
    setScanStatus("Upload a screenshot first.", "scan-error");
    return;
  }

  try {
    setScanStatus("Reading screenshot...", "scan-working");

    const result = await window.Tesseract.recognize(
      state.incident.pagerScreenshot,
      "eng",
      {
        logger: (msg) => {
          if (msg.status === "recognizing text" && typeof msg.progress === "number") {
            setScanStatus(
              `Reading screenshot... ${Math.round(msg.progress * 100)}%`,
              "scan-working"
            );
          }
        }
      }
    );

    const rawText = result?.data?.text || "";
    console.log("OCR RAW TEXT:", rawText);

    const normalized = normalizeOcrText(rawText);
    const parsed = parsePagerText(normalized);

    applyParsedIncident(parsed);
    loadIncidentIntoInputs();

    const confidence = getScanConfidence(parsed);

    if (confidence.status === "good") {
      setScanStatus("Scan complete", "scan-good");
    } else if (confidence.status === "warn") {
      setScanStatus(confidence.message, "scan-warn");
    } else {
      setScanStatus(confidence.message, "scan-error");
    }

    saveState();
  } catch (error) {
    console.error("OCR FAILED:", error);
    setScanStatus("Scan failed. Check screenshot or enter details manually.", "scan-error");
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[|]/g, "1")
    .replace(/EMERGENCV/g, "EMERGENCY")
    .replace(/EMERGENC Y/g, "EMERGENCY")
    .replace(/MT DUNEED ALL/g, "MTDU ALL")
    .replace(/2&8\\T/g, "MTDU ALL")
    .replace(/2&8\s?\\T/g, "MTDU ALL")
    .replace(/STRUCI/g, "STRUC1")
    .replace(/ALARCI/g, "ALARC1")
    .replace(/INCII/g, "INCI1")
    .replace(/RESCCI/g, "RESCC1")
    .replace(/[^\S\n]+/g, " ")
    .toUpperCase()
    .trim();
}

function parsePagerText(text) {
  const eventNumber = extractEventNumber(text);
  const pagerDate = extractPagerDate(text);
  const pagerTime = extractPagerTime(text);
  const brigadeCode = extractBrigadeCode(text);
  const incidentType = extractIncidentType(text);
  const actualLocation = extractActualLocation(text);
  const brigades = extractPagedUnits(text);

  return {
    rawText: text,
    eventNumber,
    pagerDate,
    pagerTime,
    brigadeCode,
    incidentType,
    pagerDetails: text,
    actualLocation,
    brigades
  };
}

function extractEventNumber(text) {
  return text.match(/\bF\d{6,}\b/)?.[0] || "";
}

function extractPagerDate(text) {
  const match = text.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function extractPagerTime(text) {
  return text.match(/\b\d{2}:\d{2}:\d{2}\b/)?.[0] || "";
}

function extractBrigadeCode(text) {
  const match = text.match(/ALERT\s+([A-Z0-9]+)\s+[A-Z&]{4,5}C[13]\b/);
  return match?.[1] || "";
}

function extractIncidentType(text) {
  if (text.includes("RESC")) return "RESC";
  if (text.includes("STRU")) return "STRU";
  if (text.includes("ALAR")) return "ALAR";
  if (text.includes("INCI")) return "INCI";
  if (text.includes("NONS")) return "NONS";
  if (text.includes("G&SC")) return "G&SC";
  return "";
}

function extractActualLocation(text) {
  const rough = text.match(/\b\d+\s+[A-Z0-9 ]+?(?:ST|RD|AVE|AV|DR|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\b[^\n]*/);
  return rough ? rough[0].trim() : "";
}

function extractPagedUnits(text) {
  const tokens = text
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  const units = [];

  tokens.forEach((token) => {
    let cleaned = token;

    if (cleaned.startsWith("C") && cleaned.length > 1) {
      const stripped = cleaned.slice(1);
      if (KNOWN_PAGED_UNITS.includes(stripped)) {
        cleaned = stripped;
      }
    }

    if (KNOWN_PAGED_UNITS.includes(cleaned) && !units.includes(cleaned)) {
      units.push(cleaned);
    }
  });

  return units;
}

function applyParsedIncident(parsed) {
  if (parsed.eventNumber) state.incident.eventNumber = parsed.eventNumber;
  if (parsed.pagerDate) state.incident.pagerDate = parsed.pagerDate;
  if (parsed.pagerTime) state.incident.pagerTime = parsed.pagerTime;
  if (parsed.brigadeCode) state.incident.brigadeCode = parsed.brigadeCode;
  if (parsed.incidentType) state.incident.incidentType = parsed.incidentType;
  if (parsed.pagerDetails) state.incident.pagerDetails = parsed.pagerDetails;
  if (parsed.actualLocation) state.incident.actualLocation = parsed.actualLocation;

  if (parsed.brigades.length) {
    setSceneBrigades(parsed.brigades);
  }
}

function getScanConfidence(parsed) {
  const checks = {
    eventNumber: Boolean(parsed.eventNumber),
    pagerDate: Boolean(parsed.pagerDate),
    pagerTime: Boolean(parsed.pagerTime),
    brigadeCode: Boolean(parsed.brigadeCode),
    incidentType: VALID_INCIDENT_TYPES.includes(parsed.incidentType),
    eventDateMatch: eventNumberMatchesDate(parsed.eventNumber, parsed.pagerDate)
  };

  const goodCount = Object.values(checks).filter(Boolean).length;

  if (goodCount >= 6) {
    return { status: "good", message: "Scan complete" };
  }

  if (goodCount >= 4) {
    const missing = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([key]) => key)
      .join(", ");
    return { status: "warn", message: `Scan complete with checks required: ${missing}` };
  }

  return { status: "error", message: "Scan incomplete. Check details manually." };
}

function eventNumberMatchesDate(eventNumber, inputDate) {
  if (!eventNumber || !inputDate) return false;

  const match = String(eventNumber).match(/^F(\d{2})(\d{2})/);
  if (!match) return false;

  const [, yy, mm] = match;
  const dateParts = String(inputDate).split("-");
  if (dateParts.length !== 3) return false;

  const [yyyy, month] = dateParts;
  return yyyy.slice(2) === yy && month === mm;
}

function setScanStatus(message, className) {
  const target = document.getElementById("scanStatus");
  if (!target) return;

  target.textContent = message;
  target.className = `scan-status ${className}`;
}
