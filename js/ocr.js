import { state, saveState } from "./state.js";
import { loadIncidentIntoInputs, setSceneBrigades } from "./incident.js";

const AREA_PRIORITY = ["CONNEWARRE", "MT DUNEED"];
const VALID_INCIDENT_PREFIXES = ["STRU", "INCI", "RESC", "ALAR", "ALARC", "NONS", "G&SC"];

const UNIT_MAP = {
  AFP: "Police",
  FP: "Police",
  AV: "Ambulance",
  STHB1: "SES"
};

const KNOWN_UNITS = [
  "CONN", "GROV", "FRES", "BARW", "TRQY", "MTDU", "MODE",
  "P64", "P63B", "R63", "AFPR", "AFP", "FP", "AV", "STHB1"
];

export function bindOcrEvents() {
  const upload = document.getElementById("pagerUpload");
  const scanBtn = document.getElementById("scanPagerBtn");

  upload?.addEventListener("change", handleScreenshotUpload);
  scanBtn?.addEventListener("click", runOcrFromPreview);
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
    hideJobPicker();
    setScanStatus("Reading screenshot...", "scan-working");

    const result = await window.Tesseract.recognize(
      state.incident.pagerScreenshot,
      "eng",
      {
        logger: (msg) => {
          if (msg.status === "recognizing text" && typeof msg.progress === "number") {
            setScanStatus(`Reading screenshot... ${Math.round(msg.progress * 100)}%`, "scan-working");
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

    const groupedEvents = buildGroupedEvents(blocks);
    console.log("GROUPED EVENTS:", groupedEvents);

    const validEvents = groupedEvents.filter((event) => event.eventNumber);

    if (!validEvents.length) {
      state.incident.pagerDetails = cleanedText;
      loadIncidentIntoInputs();
      saveState();
      setScanStatus("No valid event found. OCR text loaded into Pager Details.", "scan-warn");
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
    .replace(/ADMINISTRATIVE/g, "ADMIN")
    .replace(/MT DUNEED ALL/g, "MT DUNEED ALL")
    .replace(/CONNEWARRE ALL/g, "CONNEWARRE BRIGADE ALL")
    .replace(/2&8\\T/g, "MT DUNEED ALL")
    .replace(/2&8\s?\\T/g, "MT DUNEED ALL")
    .replace(/ALARCI/g, "ALARC1")
    .replace(/STRUCI/g, "STRUC1")
    .replace(/INCII/g, "INCI1")
    .replace(/INCIC/g, "INCI")
    .replace(/RESCCI/g, "RESCC1")
    .replace(/HOME CHAT SETTINGS/g, "")
    .replace(/PLEASE UPDATE YOUR AVAILABILITY/g, "")
    .replace(/REFRESH FILTER SORT/g, "")
    .replace(/REFRESH/g, "")
    .replace(/FILTER/g, "")
    .replace(/SORT/g, "")
    .replace(/ATTENDING/g, "")
    .replace(/RESPOND/g, "")
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
  let current = [];

  for (const line of lines) {
    const startsBlock =
      line.includes("EMERGENCY") ||
      line.includes("NON EMERGENCY") ||
      line.includes("ADMIN");

    if (startsBlock && current.length) {
      blocks.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length) {
    blocks.push(current.join("\n"));
  }

  return blocks.filter(Boolean);
}

function buildGroupedEvents(blocks) {
  const parsedBlocks = blocks
    .map(parsePagerBlock)
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

function parsePagerBlock(blockText) {
  const text = String(blockText || "").trim();

  const type = extractMessageType(text);
  const dateTime = extractDateTime(text);
  const area = normalizeAreaLine(extractAreaLine(text));
  const alertLine = extractAlertLine(text);
  const eventNumber = extractEventNumber(text);
  const incidentType = extractIncidentType(alertLine || text);
  const units = extractUnits(text);
  const mapRef = extractMapRef(text);
  const locationText = extractLocationText(text);
  const description = extractDescription(alertLine || "", locationText);

  return {
    rawText: text,
    type,
    area,
    alertLine,
    eventNumber,
    incidentType,
    pagerDate: dateTime.date,
    pagerTime: dateTime.time,
    units,
    mapRef,
    locationText,
    description,
    areaPriority: getAreaPriority(area),
    isEmergency: type === "EMERGENCY"
  };
}

function mergeEventBlocks(eventNumber, blocks) {
  const emergencyBlocks = blocks.filter((b) => b.isEmergency);
  const basePool = emergencyBlocks.length ? emergencyBlocks : blocks;

  const sortedBasePool = [...basePool].sort(compareBlocksForBaseSelection);
  const baseBlock = sortedBasePool[0];

  const mergedUnits = [...new Set(blocks.flatMap((b) => b.units))];

  return {
    eventNumber,
    baseBlock,
    blocks,
    pagerDate: baseBlock?.pagerDate || "",
    pagerTime: baseBlock?.pagerTime || "",
    area: baseBlock?.area || "",
    incidentType: baseBlock?.incidentType || "",
    units: mergedUnits,
    description: baseBlock?.description || "",
    locationText: baseBlock?.locationText || "",
    rawText: baseBlock?.rawText || "",
    confidence: buildConfidence(baseBlock)
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

function buildConfidence(block) {
  if (!block) return "low";

  const checks = [
    Boolean(block.eventNumber),
    Boolean(block.alertLine),
    Boolean(block.incidentType),
    Boolean(block.area),
    eventNumberMatchesDate(block.eventNumber, block.pagerDate)
  ];

  const count = checks.filter(Boolean).length;
  if (count >= 5) return "high";
  if (count >= 3) return "medium";
  return "low";
}

function applyChosenIncident(eventObj) {
  const block = eventObj.baseBlock;
  if (!block) return;

  state.incident.eventNumber = eventObj.eventNumber || "";
  state.incident.pagerDate = toInputDate(eventObj.pagerDate || "");
  state.incident.pagerTime = eventObj.pagerTime || "";
  state.incident.brigadeCode = deriveBrigadeCode(block.area, block.alertLine);
  state.incident.incidentType = normalizeIncidentDisplay(eventObj.incidentType || "");
  state.incident.pagerDetails = block.rawText || "";
  state.incident.actualLocation = buildActualLocation(eventObj.locationText || "");
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

    const title = [
      eventObj.eventNumber,
      normalizeIncidentDisplay(eventObj.incidentType || ""),
      compactLocation(eventObj.locationText || "")
    ].filter(Boolean).join(" • ");

    button.textContent = title || eventObj.eventNumber;

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
  if (text.includes("NON-EMERGENCY")) return "NON-EMERGENCY";
  if (text.includes("EMERGENCY")) return "EMERGENCY";
  if (text.includes("ADMIN")) return "ADMIN";
  return "UNKNOWN";
}

function extractDateTime(text) {
  const match = text.match(/(\d{2}:\d{2}:\d{2})\s+(\d{2}-\d{2}-\d{4})/);
  return {
    time: match?.[1] || "",
    date: match?.[2] || ""
  };
}

function extractAreaLine(text) {
  const candidates = [
    "CONNEWARRE BRIGADE ALL",
    "CONNEWARRE ALL",
    "MT DUNEED ALL",
    "FRESHWATER CREEK BRIGADE ALL",
    "FRESHWATER CREEK ALL",
    "CFA ALL"
  ];

  for (const candidate of candidates) {
    if (text.includes(candidate)) return candidate;
  }
  return "";
}

function normalizeAreaLine(area) {
  const value = String(area || "").toUpperCase();

  if (value.includes("CONNEWARRE")) return "CONNEWARRE";
  if (value.includes("MT DUNEED")) return "MT DUNEED";
  if (value.includes("FRESHWATER CREEK")) return "FRESHWATER CREEK";
  if (value.includes("CFA ALL")) return "CFA ALL";

  return value;
}

function getAreaPriority(area) {
  const idx = AREA_PRIORITY.indexOf(area);
  return idx === -1 ? 999 : idx;
}

function extractAlertLine(text) {
  const match = text.match(/ALERT\s+[A-Z0-9]+\s+[A-Z&]{4,6}\d\b[^\n]*/);
  return match?.[0] || "";
}

function extractEventNumber(text) {
  return text.match(/\bF\d{9}\b/)?.[0] || "";
}

function extractIncidentType(text) {
  const value = String(text || "");

  const match = value.match(/\b(RESCC?\d|RESC\d|ALARC\d|ALARC\d|INCI\d|STRUC\d|NONS\d|G&SC\d)\b/);
  if (match?.[1]) return match[1];

  const fallback = value.match(/\b(RESC|ALAR|INCI|STRU|NONS|G&SC)\b/);
  return fallback?.[1] || "";
}

function normalizeIncidentDisplay(code) {
  const upper = String(code || "").toUpperCase();

  if (upper.startsWith("RESC")) return "RESC";
  if (upper.startsWith("ALAR")) return "ALAR";
  if (upper.startsWith("INCI")) return "INCI";
  if (upper.startsWith("STRU")) return "STRU";
  if (upper.startsWith("NONS")) return "NONS";
  if (upper.startsWith("G&SC")) return "G&SC";

  return upper;
}

function extractUnits(text) {
  const tokens = String(text || "")
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  const units = [];

  tokens.forEach((token) => {
    let clean = token;

    if (clean.startsWith("C") && clean.length > 1) {
      const stripped = clean.slice(1);
      if (KNOWN_UNITS.includes(stripped)) {
        clean = stripped;
      }
    }

    if (UNIT_MAP[clean]) {
      clean = UNIT_MAP[clean];
    }

    if (KNOWN_UNITS.includes(clean) || Object.values(UNIT_MAP).includes(clean)) {
      if (!units.includes(clean)) {
        units.push(clean);
      }
    }
  });

  return units;
}

function extractMapRef(text) {
  return text.match(/\b(?:M|SVC)\s+\d{3,4}\s+[A-Z]\d{1,2}\s+\(\d+\)/)?.[0] || "";
}

function extractLocationText(text) {
  const withoutHeader = String(text || "")
    .replace(/.*?ALERT\s+[A-Z0-9]+\s+[A-Z&]{4,6}\d\b/, "")
    .replace(/\b(?:M|SVC)\s+\d{3,4}\s+[A-Z]\d{1,2}\s+\(\d+\)/g, "")
    .replace(/\bF\d{9}\b/g, "")
    .replace(/\b(?:C[A-Z0-9]+|P64|P63B|R63|AFP|FP|AV|STHB1)\b/g, "")
    .replace(/\d{1,2}:\d{2}:\d{2}\s+SINCE ALERT/g, "")
    .trim();

  return withoutHeader;
}

function extractDescription(alertLine, locationText) {
  const afterIncident = String(alertLine || "").replace(/ALERT\s+[A-Z0-9]+\s+[A-Z&]{4,6}\d\b/, "").trim();
  if (afterIncident) return afterIncident;

  return String(locationText || "").split("/")[0].trim();
}

function deriveBrigadeCode(area, alertLine) {
  if (area === "CONNEWARRE") return "CONN";
  if (area === "MT DUNEED") return "MTDU";

  const match = String(alertLine || "").match(/ALERT\s+([A-Z]+)\d/);
  return match?.[1] || "";
}

function buildActualLocation(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";

  let cleaned = raw
    .replace(/\s+/g, " ")
    .replace(/\s\/\/\s*/g, " / ")
    .replace(/\s\/\s*/g, " / ");

  const addressMatch = cleaned.match(/\b\d+\s+[A-Z0-9 ]+?(?:ST|RD|AVE|AV|DR|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\s+[A-Z ]+/);
  if (addressMatch?.[0]) {
    return addressMatch[0].trim();
  }

  const intersectionMatch = cleaned.match(/\bCNR\s+[A-Z0-9 ]+?(?:ST|RD|AVE|AV|DR|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)\s*\/\s*[A-Z0-9 ]+?(?:ST|RD|AVE|AV|DR|HWY|CT|CRT|CRES|PL|WAY|LANE|LN)/);
  if (intersectionMatch?.[0]) {
    return intersectionMatch[0].trim();
  }

  return cleaned;
}

function compactLocation(text) {
  return buildActualLocation(text).slice(0, 80);
}

function eventNumberMatchesDate(eventNumber, dateText) {
  if (!eventNumber || !dateText) return false;

  const match = String(eventNumber).match(/^F(\d{2})(\d{2})\d{5}$/);
  if (!match) return false;

  const [, yy, mm] = match;
  const dateMatch = String(dateText).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!dateMatch) return false;

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
