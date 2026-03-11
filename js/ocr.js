import { state, saveState } from "./state.js";
import { loadIncidentIntoInputs, setSceneBrigades } from "./incident.js";

const KNOWN_PAGED_UNITS = [
  "CONN", "GROV", "FRES", "BARW", "P64", "P63B",
  "TRQY", "STHB1", "MTDU", "R63", "AFPR", "MODE"
];

export function bindOcrEvents() {
  const upload = document.getElementById("pagerUpload");
  const scanBtn = document.getElementById("scanPagerBtn");

  if (upload) {
    upload.addEventListener("change", handleScreenshotUpload);
  }

  if (scanBtn) {
    scanBtn.addEventListener("click", runOcrFromPreview);
  }
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

    const cleanedText = normalizeOcrText(rawText);
    console.log("OCR CLEANED TEXT:", cleanedText);

    const blocks = splitPagerBlocks(cleanedText);
    console.log("PAGER BLOCKS:", blocks);

    const primaryBlock = getPrimaryEmergencyBlock(blocks);
    const extraApplianceUnits = getExtraUnitsFromSecondaryBlocks(blocks);

    if (!primaryBlock) {
      state.incident.pagerDetails = cleanedText;
      const pagerDetails = document.getElementById("pagerDetails");
      if (pagerDetails) pagerDetails.value = cleanedText;
      saveState();
      setScanStatus("No EMERGENCY pager block found. OCR text loaded into Pager Details.", "scan-warn");
      return;
    }

    const parsedPrimary = parsePrimaryBlock(primaryBlock);

    if (parsedPrimary.eventNumber) state.incident.eventNumber = parsedPrimary.eventNumber;
    if (parsedPrimary.pagerDate) state.incident.pagerDate = parsedPrimary.pagerDate;
    if (parsedPrimary.pagerTime) state.incident.pagerTime = parsedPrimary.pagerTime;
    if (parsedPrimary.brigadeCode) state.incident.brigadeCode = parsedPrimary.brigadeCode;
    if (parsedPrimary.incidentType) state.incident.incidentType = parsedPrimary.incidentType;
    if (parsedPrimary.actualLocation) state.incident.actualLocation = parsedPrimary.actualLocation;
    if (parsedPrimary.pagerDetails) state.incident.pagerDetails = parsedPrimary.pagerDetails;

    const mergedUnits = [...new Set([...(parsedPrimary.units || []), ...extraApplianceUnits])];
    setSceneBrigades(mergedUnits);

    loadIncidentIntoInputs();
    saveState();

    setScanStatus("Scan complete. Primary EMERGENCY pager extracted.", "scan-good");
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
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/EMERGENCV/g, "EMERGENCY")
    .replace(/EMERGENC Y/g, "EMERGENCY")
    .replace(/NONEMERGENCY/g, "NON EMERGENCY")
    .replace(/MT DUNEED ALL/g, "MTDU ALL")
    .replace(/2&8\\T/g, "MTDU ALL")
    .replace(/2&8\s?\\T/g, "MTDU ALL")
    .replace(/ALARCI/g, "ALARC1")
    .replace(/STRUCI/g, "STRUC1")
    .replace(/INCII/g, "INCI1")
    .replace(/RESCCI/g, "RESCC1")
    .replace(/HOME CHAT SETTINGS/g, "")
    .replace(/PLEASE UPDATE YOUR AVAILABILITY/g, "")
    .replace(/REFRESH FILTER SORT/g, "")
    .replace(/ALERTING SERVICE/g, "")
    .replace(/AT ATTENDING/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .toUpperCase()
    .trim();
}

function splitPagerBlocks(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let currentBlock = [];

  for (const line of lines) {
    const isHeader =
      line.includes("EMERGENCY") ||
      line.includes("NON EMERGENCY") ||
      line.includes("ADMIN");

    if (isHeader && currentBlock.length) {
      blocks.push(currentBlock.join("\n"));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length) {
    blocks.push(currentBlock.join("\n"));
  }

  return blocks.filter(Boolean);
}

function getBlockType(blockText) {
  const text = String(blockText || "").toUpperCase();

  if (text.includes("EMERGENCY")) return "EMERGENCY";
  if (text.includes("NON EMERGENCY")) return "NON EMERGENCY";
  if (text.includes("ADMIN")) return "ADMIN";

  return "UNKNOWN";
}

function getPrimaryEmergencyBlock(blocks) {
  for (const block of blocks) {
    if (getBlockType(block) === "EMERGENCY") {
      return block;
    }
  }
  return "";
}

function getExtraUnitsFromSecondaryBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length < 2) return [];

  const extraUnits = [];

  blocks.slice(1).forEach((block) => {
    const type = getBlockType(block);

    if (type === "NON EMERGENCY" || type === "ADMIN" || type === "EMERGENCY") {
      const units = extractPagedUnits(block);
      units.forEach((unit) => {
        if (!extraUnits.includes(unit)) {
          extraUnits.push(unit);
        }
      });
    }
  });

  return extraUnits;
}

function parsePrimaryBlock(blockText) {
  const text = String(blockText || "");

  return {
    eventNumber: extractEventNumber(text),
    pagerDate: extractPagerDate(text),
    pagerTime: extractPagerTime(text),
    brigadeCode: extractBrigadeCode(text),
    incidentType: extractIncidentType(text),
    actualLocation: extractActualLocation(text),
    units: extractPagedUnits(text),
    pagerDetails: text
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
  const rough = text.match(
    /\b\d+\s+[A-Z0-9 ]+?(?:ST|RD|AVE|AV|DR|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\b[^\n]*/
  );
  return rough ? rough[0].trim() : "";
}

function extractPagedUnits(text) {
  const tokens = String(text || "")
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

function setScanStatus(message, className) {
  const target = document.getElementById("scanStatus");
  if (!target) return;

  target.textContent = message;
  target.className = `scan-status ${className}`;
}
