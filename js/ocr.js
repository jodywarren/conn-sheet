import { state, saveState } from "./state.js";
import { loadIncidentIntoInputs, setSceneBrigades } from "./incident.js";

const AREA_PRIORITY = ["CONNEWARRE", "MT DUNEED"];
const KNOWN_AREA_LINES = [
  "CONNEWARRE BRIGADE ALL",
  "CONNEWARRE ALL",
  "MT DUNEED ALL",
  "FRESHWATER CREEK BRIGADE ALL",
  "FRESHWATER CREEK ALL"
];

const UNIT_MAP = {
  AFP: "Police",
  FP: "Police",
  AV: "Ambulance",
  STHB1: "SES"
};

const UI_NOISE_PATTERNS = [
  /\bDETAILS\b/,
  /\bATTENDANCE\b/,
  /\bLOCATION\b/,
  /\bVERIFIED\b/,
  /\bMAP LAYERS\b/,
  /\bNOT ATTENDING\b/,
  /\bATTENDING\b/,
  /\bUNAVAILABLE\b/,
  /\bOTHER\b/,
  /\bMODIFY\b/,
  /\bSINCE ALERT\b/,
  /\bEVENT ID[:\s]/,
  /\bHOME\b/,
  /\bCHAT\b/,
  /\bSETTINGS\b/,
  /\bREFRESH\b/,
  /\bFILTER\b/,
  /\bSORT\b/,
  /\bPLEASE UPDATE YOUR AVAILABILITY\b/
];

export function bindOcrEvents() {
  const upload = document.getElementById("pagerUpload");
  if (!upload) return;

  upload.addEventListener("change", handleScreenshotUpload);
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

  hideJobPicker();
  setScanStatus("Reading screenshot...", "scan-working");
  saveState();

  await runOcrFromPreview();
}

async function runOcrFromPreview() {
  if (!window.Tesseract) {
    setScanStatus("OCR library not loaded.", "scan-error");
    return;
  }

  if (!state.incident.pagerScreenshot) {
    setScanStatus("Upload a screenshot first.", "scan-error");
    return;
  }

  try {
    hideJobPicker();
    setScanStatus("Reading screenshot...", "scan-working");

    const imageForOcr = await cropPagerScreenshot(state.incident.pagerScreenshot);

    const result = await window.Tesseract.recognize(imageForOcr, "eng", {
      logger: (msg) => {
        if (msg.status === "recognizing text" && typeof msg.progress === "number") {
          setScanStatus(
            `Reading screenshot... ${Math.round(msg.progress * 100)}%`,
            "scan-working"
          );
        }
      }
    });

    const rawText = result?.data?.text || "";
    const cleanedText = normalizeOcrText(rawText);
    const lines = toUsefulLines(cleanedText);
    const sections = buildCandidateSections(lines);
    const groupedEvents = buildGroupedEvents(sections);
    const validEvents = groupedEvents.filter((eventObj) => eventObj.eventNumber);

    console.log("OCR RAW TEXT:", rawText);
    console.log("OCR CLEANED TEXT:", cleanedText);
    console.log("OCR USEFUL LINES:", lines);
    console.log("OCR CANDIDATE SECTIONS:", sections);
    console.log("OCR GROUPED EVENTS:", groupedEvents);

    if (!validEvents.length) {
      state.incident.pagerDetails = cleanedText;
      loadIncidentIntoInputs();
      saveState();
      setScanStatus("No valid pager message found. OCR text loaded into Pager Details.", "scan-warn");
      return;
    }

    if (validEvents.length === 1) {
      applyChosenIncident(validEvents[0]);
      setScanStatus("Scan complete. Pager extracted.", "scan-good");
      return;
    }

    renderJobPicker(validEvents);
    setScanStatus("Multiple jobs detected. Select the correct job.", "scan-warn");
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

async function cropPagerScreenshot(dataUrl) {
  try {
    const img = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // tighter crop around the pager detail card area
    const sx = Math.floor(img.width * 0.04);
    const sy = Math.floor(img.height * 0.28);
    const sw = Math.floor(img.width * 0.92);
    const sh = Math.floor(img.height * 0.34);

    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Crop failed, falling back to full screenshot.", error);
    return dataUrl;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
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
    .replace(/NON-EMERGENCY/g, "NON EMERGENCY")
    .replace(/ADMINISTRATIVE/g, "ADMIN")
    .replace(/2&8\\T/g, "MT DUNEED ALL")
    .replace(/2&8\s?\\T/g, "MT DUNEED ALL")
    .replace(/ALARCI/g, "ALARC1")
    .replace(/ALARC!/g, "ALARC1")
    .replace(/STRUCI/g, "STRUC1")
    .replace(/STRUC!/g, "STRUC1")
    .replace(/INCICI/g, "INCIC1")
    .replace(/INCIC!/g, "INCIC1")
    .replace(/INCIC3I/g, "INCIC3")
    .replace(/INCII/g, "INCI1")
    .replace(/INCI!/g, "INCI1")
    .replace(/NSTRCI/g, "NSTRC1")
    .replace(/NSTRC!/g, "NSTRC1")
    .replace(/G&SCI/g, "G&SC1")
    .replace(/G&SC!/g, "G&SC1")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .toUpperCase()
    .trim();
}

function toUsefulLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isUiNoiseLine(line));
}

function isUiNoiseLine(line) {
  const value = String(line || "").toUpperCase();
  return UI_NOISE_PATTERNS.some((pattern) => pattern.test(value));
}

function buildCandidateSections(lines) {
  const sections = [];

  lines.forEach((line, index) => {
    if (!isKnownAreaLineLine(line)) return;

    const start = Math.max(0, index - 2);
    const end = Math.min(lines.length, index + 7);

    const slice = lines.slice(start, end);

    let sectionLines = [...slice];

    // extend until event number found or max window reached
    let cursor = end;
    while (
      cursor < lines.length &&
      sectionLines.length < 12 &&
      !extractEventNumber(sectionLines.join(" "))
    ) {
      sectionLines.push(lines[cursor]);
      cursor += 1;
    }

    sections.push(sectionLines.join("\n"));
  });

  return [...new Set(sections)];
}

function isKnownAreaLineLine(line) {
  const value = String(line || "").toUpperCase();
  return KNOWN_AREA_LINES.some((candidate) => value.includes(candidate));
}

function buildGroupedEvents(sections) {
  const parsedBlocks = sections
    .map(parsePagerSection)
    .filter((block) => block.eventNumber);

  const byEvent = new Map();

  parsedBlocks.forEach((block) => {
    if (!byEvent.has(block.eventNumber)) {
      byEvent.set(block.eventNumber, []);
    }
    byEvent.get(block.eventNumber).push(block);
  });

  return Array.from(byEvent.entries()).map(([eventNumber, eventBlocks]) =>
    mergeEventBlocks(eventNumber, eventBlocks)
  );
}

function parsePagerSection(sectionText) {
  const text = String(sectionText || "").trim();

  const type = extractMessageType(text);
  const dateTime = extractDateTime(text);
  const areaLine = extractAreaLine(text);
  const area = normalizeAreaLine(areaLine);
  const alertText = extractAlertText(text);
  const eventNumber = extractEventNumber(text);
  const incidentCode = extractIncidentCode(alertText || text);
  const incidentType = normalizeIncidentType(incidentCode);
  const responseCode = extractResponseCode(incidentCode);
  const units = extractUnits(text);
  const locationText = extractLocationText(alertText || text);
  const actualLocation = buildActualLocation(locationText);
  const description = extractDescription(alertText, actualLocation);

  return {
    rawText: text,
    type,
    areaLine,
    area,
    alertText,
    eventNumber,
    incidentCode,
    incidentType,
    responseCode,
    pagerDate: dateTime.date,
    pagerTime: dateTime.time,
    units,
    locationText,
    actualLocation,
    description,
    areaPriority: getAreaPriority(area),
    isEmergency: type === "EMERGENCY",
    matchesDate: eventNumberMatchesDate(eventNumber, dateTime.date)
  };
}

function mergeEventBlocks(eventNumber, blocks) {
  const emergencyBlocks = blocks.filter((b) => b.isEmergency);
  const basePool = emergencyBlocks.length ? emergencyBlocks : blocks;
  const baseBlock = [...basePool].sort(compareBlocksForBaseSelection)[0];

  const mergedUnits = [...new Set(blocks.flatMap((b) => b.units).filter(Boolean))];

  return {
    eventNumber,
    blocks,
    baseBlock,
    pagerDate: baseBlock?.pagerDate || "",
    pagerTime: baseBlock?.pagerTime || "",
    area: baseBlock?.area || "",
    incidentCode: baseBlock?.incidentCode || "",
    incidentType: baseBlock?.incidentType || "",
    responseCode: baseBlock?.responseCode || "",
    units: mergedUnits,
    description: baseBlock?.description || "",
    locationText: baseBlock?.locationText || "",
    actualLocation: baseBlock?.actualLocation || "",
    rawText: baseBlock?.rawText || ""
  };
}

function compareBlocksForBaseSelection(a, b) {
  if (a.areaPriority !== b.areaPriority) {
    return a.areaPriority - b.areaPriority;
  }

  const aStamp = buildSortableStamp(a.pagerDate, a.pagerTime);
  const bStamp = buildSortableStamp(b.pagerDate, b.pagerTime);

  if (aStamp < bStamp) return -1;
  if (aStamp > bStamp) return 1;
  return 0;
}

function buildSortableStamp(date, time) {
  const d = String(date || "");
  const t = String(time || "");
  return `${d}|${t}`;
}

function applyChosenIncident(eventObj) {
  const block = eventObj.baseBlock;
  if (!block) return;

  const inputDate = toInputDate(eventObj.pagerDate || "");
  const brigadeCode = deriveBrigadeCode(block.area, block.alertText);
  const brigadeRole = deriveBrigadeRole(block.area, block.alertText);
  const scannedAddress = eventObj.actualLocation || "";
  const actualAddress = eventObj.actualLocation || "";

  state.incident.eventNumber = eventObj.eventNumber || "";
  state.incident.pagerDate = inputDate;
  state.incident.pagerTime = eventObj.pagerTime || "";

  // set both old and new keys so the rest of the app keeps working
  state.incident.brigadeCode = brigadeCode;
  state.incident.alertAreaCode = brigadeCode;
  state.incident.brigadeRole = brigadeRole;
  state.incident.incidentType = eventObj.incidentType || "";
  state.incident.responseCode = eventObj.responseCode || "";
  state.incident.pagerDetails = block.rawText || "";
  state.incident.scannedLocation = scannedAddress;
  state.incident.scannedAddress = scannedAddress;
  state.incident.actualLocation = actualAddress;
  state.incident.actualAddress = actualAddress;

  setSceneBrigades(eventObj.units || []);
  loadIncidentIntoInputs();
  saveState();
  hideJobPicker();
}

function renderJobPicker(events) {
  const wrap = document.getElementById("jobPickerWrap");
  const list = document.getElementById("jobPickerList");
  if (!wrap || !list) return;

  list.innerHTML = "";

  events.forEach((eventObj) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "job-picker-item";

    const parts = [
      eventObj.eventNumber,
      eventObj.area,
      eventObj.incidentType,
      eventObj.responseCode,
      compactLocation(eventObj.actualLocation || eventObj.locationText || "")
    ].filter(Boolean);

    button.textContent = parts.join(" • ");

    button.addEventListener("click", () => {
      applyChosenIncident(eventObj);
      setScanStatus("Job selected and loaded.", "scan-good");
    });

    list.appendChild(button);
  });

  wrap.classList.remove("hidden");
}

function hideJobPicker() {
  const wrap = document.getElementById("jobPickerWrap");
  const list = document.getElementById("jobPickerList");
  if (list) list.innerHTML = "";
  wrap?.classList.add("hidden");
}

function extractMessageType(text) {
  const value = String(text || "").toUpperCase();

  if (/\bNON[\s-]?EMERGENCY\b/.test(value)) return "NON-EMERGENCY";
  if (/\bEMERGENCY\b/.test(value)) return "EMERGENCY";
  return "EMERGENCY";
}

function extractDateTime(text) {
  const match = String(text || "").match(/(\d{2}:\d{2}:\d{2})\s+(\d{2}-\d{2}-\d{4})/);
  return {
    time: match?.[1] || "",
    date: match?.[2] || ""
  };
}

function extractAreaLine(text) {
  const value = String(text || "").toUpperCase();

  for (const candidate of KNOWN_AREA_LINES) {
    if (value.includes(candidate)) return candidate;
  }

  return "";
}

function normalizeAreaLine(areaLine) {
  const value = String(areaLine || "").toUpperCase();

  if (value.includes("CONNEWARRE")) return "CONNEWARRE";
  if (value.includes("MT DUNEED")) return "MT DUNEED";
  if (value.includes("FRESHWATER CREEK")) return "FRESHWATER CREEK";

  return value;
}

function getAreaPriority(area) {
  const index = AREA_PRIORITY.indexOf(area);
  return index === -1 ? 999 : index;
}

function extractAlertText(text) {
  const value = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const startIndex = value.findIndex((line) => line.includes("ALERT "));
  if (startIndex === -1) return "";

  const collected = [];
  for (let i = startIndex; i < value.length; i += 1) {
    const line = value[i];
    collected.push(line);

    if (extractEventNumber(line) || /\bF[0-9IO]{9}\b/.test(line)) break;
  }

  return collected.join(" ");
}

function extractEventNumber(text) {
  const raw = String(text || "").toUpperCase();

  const direct = raw.match(/\bF[0-9IO]{9}\b/);
  if (direct) {
    return direct[0].replace(/I/g, "1").replace(/O/g, "0");
  }

  const header = raw.match(/EVENT\s*ID[:\s]+(F[0-9IO]{9})\b/);
  if (header?.[1]) {
    return header[1].replace(/I/g, "1").replace(/O/g, "0");
  }

  return "";
}

function extractIncidentCode(text) {
  const value = String(text || "").toUpperCase();
  return value.match(/\b(ALARC[13]|STRUC[13]|INCIC[13]|G&SC[13]|NSTRC[13])\b/)?.[1] || "";
}

function normalizeIncidentType(code) {
  const upper = String(code || "").toUpperCase();

  if (upper.startsWith("ALARC")) return "ALAR";
  if (upper.startsWith("STRUC")) return "STRU";
  if (upper.startsWith("INCIC")) return "INCI";
  if (upper.startsWith("G&SC")) return "G&SC";
  if (upper.startsWith("NSTRC")) return "NSTR";

  return "";
}

function extractResponseCode(code) {
  const upper = String(code || "").toUpperCase();

  if (upper.endsWith("1")) return "Code 1";
  if (upper.endsWith("3")) return "Code 3";

  return "";
}

function extractUnits(text) {
  const tokens = String(text || "")
    .toUpperCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  const units = [];

  tokens.forEach((token) => {
    let clean = token;

    if (UNIT_MAP[clean]) {
      clean = UNIT_MAP[clean];
    } else if (/^C[A-Z]{4}$/.test(clean)) {
      clean = clean.slice(1);
    } else if (/^P\d+[A-Z]?$/.test(clean)) {
      clean = clean;
    } else if (/^R\d+[A-Z]?$/.test(clean)) {
      clean = clean;
    } else {
      return;
    }

    if (!units.includes(clean)) {
      units.push(clean);
    }
  });

  return units;
}

function extractLocationText(text) {
  let combined = String(text || "").toUpperCase();

  combined = combined
    .replace(/^.*?ALERT\s+[A-Z0-9]+\s+(?:ALARC[13]|STRUC[13]|INCIC[13]|G&SC[13]|NSTRC[13])\s*/, "")
    .replace(/\b(?:M|SVC)\s+\d{3,4}\s+[A-Z]\d{1,2}\s+\(\d+\)\b/g, "")
    .replace(/\bF\d{9}\b/g, "")
    .replace(/\b(?:C[A-Z]{4}|P\d+[A-Z]?|R\d+[A-Z]?|AFP|FP|AV|STHB1)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return combined;
}

function buildActualLocation(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  let cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/\/{2,}/g, " // ")
    .replace(/\s*\/\/\s*/g, " // ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();

  // CNR rule first
  if (/\bCNR\b/.test(cleaned)) {
    const cnrMatch = cleaned.match(
      /\bCNR\s+[A-Z0-9 ]+?(?:ST|RD|DR|AVE|AV|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\s*\/\s*[A-Z0-9 ]+?(?:ST|RD|DR|AVE|AV|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\b/
    );
    if (cnrMatch?.[0]) {
      return cnrMatch[0].trim();
    }
  }

  // numbered address rule, stop before first /
  const numbered = cleaned.match(
    /\b\d+\s+[A-Z0-9 ]+?(?:ST|RD|DR|AVE|AV|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\b/
  );
  if (numbered?.[0]) {
    return numbered[0].trim();
  }

  // fallback: take text before / or //
  const slashIndex = cleaned.indexOf(" / ");
  if (slashIndex > 0) {
    return cleaned.slice(0, slashIndex).trim();
  }

  const doubleSlashIndex = cleaned.indexOf(" // ");
  if (doubleSlashIndex > 0) {
    return cleaned.slice(0, doubleSlashIndex).trim();
  }

  return cleaned;
}

function extractDescription(alertText, actualLocation) {
  const value = String(alertText || "")
    .replace(/^.*?ALERT\s+[A-Z0-9]+\s+(?:ALARC[13]|STRUC[13]|INCIC[13]|G&SC[13]|NSTRC[13])\s*/, "")
    .replace(/\bF\d{9}\b/g, "")
    .replace(/\b(?:M|SVC)\s+\d{3,4}\s+[A-Z]\d{1,2}\s+\(\d+\)\b/g, "")
    .replace(/\b(?:C[A-Z]{4}|P\d+[A-Z]?|R\d+[A-Z]?|AFP|FP|AV|STHB1)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) return "";

  if (actualLocation && value.includes(actualLocation)) {
    return value.replace(actualLocation, "").replace(/\s+/g, " ").trim();
  }

  return value;
}

function deriveBrigadeCode(area, alertText) {
  if (area === "CONNEWARRE") return "CONN";
  if (area === "MT DUNEED") return "MTDU";
  if (area === "FRESHWATER CREEK") return "FRES";

  const match = String(alertText || "").match(/ALERT\s+([A-Z]+)\d+/);
  return match?.[1] || "";
}

function deriveBrigadeRole(area, alertText) {
  if (area === "CONNEWARRE") return "Primary";
  if (area === "MT DUNEED") return "Support to Mt Duneed";
  if (area === "FRESHWATER CREEK") return "Support to Freshwater Creek";

  const prefix = String(alertText || "").match(/ALERT\s+([A-Z]+)\d+/)?.[1] || "";
  if (prefix === "CONN") return "Primary";
  if (prefix) return `Support to ${prefix}`;

  return "";
}

function compactLocation(text) {
  return String(text || "").trim().slice(0, 90);
}

function eventNumberMatchesDate(eventNumber, dateText) {
  if (!eventNumber || !dateText) return false;

  const eventMatch = String(eventNumber).match(/^F(\d{2})(\d{2})\d{5}$/);
  const dateMatch = String(dateText).match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!eventMatch || !dateMatch) return false;

  const [, yy, mm] = eventMatch;
  const [, , dateMonth, dateYear] = dateMatch;

  return yy === dateYear.slice(2) && mm === dateMonth;
}

function toInputDate(dateText) {
  const match = String(dateText || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return "";

  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function setScanStatus(message, className) {
  const target = document.getElementById("scanStatus");
  if (!target) return;

  target.textContent = message;
  target.className = `scan-status ${className}`;
}
