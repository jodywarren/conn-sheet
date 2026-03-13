import { state, saveState } from "./state.js";
import { loadIncidentIntoInputs, mergePagedSceneUnits, setPagedSceneUnits } from "./incident.js";

const KNOWN_BRIGADE_CODES = [
  "CONN",
  "GROV",
  "FRES",
  "BARW",
  "TRQY",
  "TQRY",
  "MTDU",
  "MODE"
];

const KNOWN_OTHER_UNITS = [
  "P64",
  "P63B",
  "R63",
  "STHB1",
  "AFP",
  "AFPR",
  "FP",
  "AV",
  "MODE"
];

const INCIDENT_TYPE_LABELS = {
  INCI: "Incident",
  RESC: "Rescue",
  STRU: "Structure Fire",
  ALAR: "Alarm",
  NSTR: "Non-Structure",
  "G&S": "Grass / Scrub"
};

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

  setScanStatus("Screenshot loaded. Scanning...", "scan-working");
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
    const cleanedText = normalizeOcrText(rawText);
    const blocks = splitPagerBlocks(cleanedText);
    const parsedCandidates = blocks.map(parseCandidateBlock);

    console.log("OCR RAW TEXT:", rawText);
    console.log("OCR CLEANED TEXT:", cleanedText);
    console.log("OCR BLOCKS:", blocks);
    console.log("OCR CANDIDATES:", parsedCandidates);

    const primaryCandidate = choosePrimaryEmergencyCandidate(parsedCandidates);

    if (!primaryCandidate) {
      state.incident.pagerDetails = cleanedText;
      loadIncidentIntoInputs();
      saveState();
      setScanStatus("No valid EMERGENCY pager message found.", "scan-warn");
      return;
    }

    const currentEvent = String(state.incident.eventNumber || "").trim();
    const sameEventAsCurrent =
      currentEvent &&
      primaryCandidate.eventNumber &&
      currentEvent === primaryCandidate.eventNumber;

    const extraSceneUnits = collectAdditionalSceneUnits(parsedCandidates, primaryCandidate);

    if (sameEventAsCurrent) {
      if (extraSceneUnits.length) {
        mergePagedSceneUnits(extraSceneUnits);
        loadIncidentIntoInputs();
        saveState();
        setScanStatus("Scan complete. Additional scene units merged.", "scan-good");
      } else {
        setScanStatus("Scan complete. Same event detected.", "scan-good");
      }
      return;
    }

    state.incident.eventNumber = primaryCandidate.eventNumber || "";
    state.incident.pagerDate = primaryCandidate.pagerDate || "";
    state.incident.pagerTime = primaryCandidate.pagerTime || "";

    state.incident.alertAreaCode = primaryCandidate.alertAreaCode || "";
    state.incident.primaryBrigade = primaryCandidate.primaryBrigade || "";
    state.incident.brigadeRole = primaryCandidate.brigadeRole || "";

    state.incident.incidentCodeRaw = primaryCandidate.incidentCodeRaw || "";
    state.incident.incidentType = primaryCandidate.incidentType || "";
    state.incident.responseCode = primaryCandidate.responseCode || "";

    state.incident.pagerDetails = primaryCandidate.pagerDetails || "";
    state.incident.scannedAddress = primaryCandidate.scannedAddress || "";

    if (!state.incident.actualAddressEdited) {
      state.incident.actualAddress = primaryCandidate.scannedAddress || "";
    }

    setPagedSceneUnits(primaryCandidate.sceneUnits || []);
    if (extraSceneUnits.length) {
      mergePagedSceneUnits(extraSceneUnits);
    }

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
    .replace(/RE : EVENT/gi, "RE: EVENT")
    .replace(/RE EVENT/gi, "RE: EVENT")
    .replace(/ALARCI/g, "ALARC1")
    .replace(/ALARC1I/g, "ALARC1")
    .replace(/STRUCI/g, "STRUC1")
    .replace(/RESCCI/g, "RESCC1")
    .replace(/INCII/g, "INCIC1")
    .replace(/INCICL/g, "INCIC1")
    .replace(/INCIC3I/g, "INCIC3")
    .replace(/INCII3/g, "INCIC3")
    .replace(/\bINCI3\b/g, "INCIC3")
    .replace(/HOME CHAT SETTINGS/g, "")
    .replace(/PLEASE UPDATE YOUR AVAILABILITY/g, "")
    .replace(/REFRESH FILTER SORT/g, "")
    .replace(/ALERTING SERVICE/g, "")
    .replace(/SUPPLEMENTARY/g, "")
    .replace(/AT ATTENDING/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .toUpperCase()
    .trim();
}

function splitPagerBlocks(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let currentBlock = [];

  const isStrongHeaderLine = (line) => {
    const upper = line.toUpperCase();

    return (
      (upper.includes("EMERGENCY") || upper.includes("EMERGENCV")) &&
      /\b([01]\d|2[0-3]):([0-5]\d):([0-5]\d)\b/.test(upper)
    );
  };

  const isFallbackHeaderLine = (line) => {
    const upper = line.toUpperCase();

    return (
      upper.includes("NON EMERGENCY") ||
      upper.includes("ADMIN") ||
      upper.startsWith("ALERT ")
    );
  };

  for (const line of lines) {
    if (isStrongHeaderLine(line) || isFallbackHeaderLine(line)) {
      if (currentBlock.length) {
        blocks.push(currentBlock.join("\n"));
      }
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

  if (text.includes("NON EMERGENCY")) return "NON EMERGENCY";

  if (
    text.includes("EMERGENCY") ||
    text.includes("EMERGENCV") ||
    text.includes("ALERT ")
  ) {
    return "EMERGENCY";
  }

  if (text.includes("ADMIN")) return "ADMIN";

  return "UNKNOWN";
}

function parseCandidateBlock(blockText) {
  const text = String(blockText || "");
  console.log("HEADER LINE FOUND:", extractEmergencyHeaderLine(text));
  const type = getBlockType(text);
  const isReEvent = /RE:\s*EVENT/.test(text);
  const isCancel = /CANCEL RESPONSE NOT REQUIRED/.test(text);

  const eventNumber = extractEventNumber(text);
  const pagerDate = extractPagerDate(text, eventNumber);
  const pagerTime = pagerDate ? extractPagerTime(text) : "";
  const eventMatchesDate = validateEventNumberAgainstDate(eventNumber, pagerDate);

  const alertAreaCode = extractAlertAreaCode(text);
  const primaryBrigade = extractPrimaryBrigade(alertAreaCode);
  const brigadeRole = deriveBrigadeRole(primaryBrigade);

  const incidentCodeRaw = extractIncidentCodeRaw(text);
  const splitCode = splitIncidentCode(incidentCodeRaw);

  const bodyBeforeMap = extractBodyBeforeMap(text, incidentCodeRaw);
  const addressInfo = findAddressInBody(bodyBeforeMap);
  const scannedAddress = addressInfo?.text || "";
  const pagerDetails = extractPagerDetails(text, eventNumber);
  const sceneUnits = extractSceneUnits(text);

  const score = scoreCandidate({
    type,
    isReEvent,
    isCancel,
    alertAreaCode,
    incidentCodeRaw,
    eventNumber,
    eventMatchesDate,
    pagerDate,
    pagerTime,
    scannedAddress
  });

  return {
    rawText: text,
    type,
    isReEvent,
    isCancel,
    score,
    eventNumber,
    pagerDate,
    pagerTime,
    alertAreaCode,
    primaryBrigade,
    brigadeRole,
    incidentCodeRaw,
    incidentType: splitCode.incidentType,
    responseCode: splitCode.responseCode,
    scannedAddress,
    pagerDetails,
    sceneUnits
  };
}

function choosePrimaryEmergencyCandidate(candidates) {
  const valid = candidates
    .filter((candidate) => candidate.type === "EMERGENCY")
    .filter((candidate) => !candidate.isReEvent)
    .filter((candidate) => !candidate.isCancel)
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return valid[0] || null;
}

function collectAdditionalSceneUnits(candidates, primaryCandidate) {
  if (!primaryCandidate?.eventNumber) return [];

  const extra = new Set();

  candidates.forEach((candidate) => {
    if (candidate === primaryCandidate) return;
    if (candidate.type !== "EMERGENCY") return;
    if (candidate.isReEvent) return;
    if (candidate.isCancel) return;
    if (candidate.eventNumber !== primaryCandidate.eventNumber) return;

    candidate.sceneUnits.forEach((unit) => extra.add(unit));
  });

  primaryCandidate.sceneUnits.forEach((unit) => extra.delete(unit));

  return [...extra];
}

function scoreCandidate(candidate) {
  let score = 0;

  if (candidate.type === "EMERGENCY") score += 40;
  if (candidate.alertAreaCode) score += 15;
  if (candidate.incidentCodeRaw) score += 15;
  if (candidate.eventNumber) score += 20;
  if (candidate.eventMatchesDate) score += 20;
  if (candidate.pagerDate) score += 10;
  if (candidate.pagerTime) score += 10;
  if (candidate.scannedAddress) score += 15;

  if (candidate.isReEvent) score -= 200;
  if (candidate.isCancel) score -= 200;
  if (candidate.type !== "EMERGENCY") score -= 100;
  if (candidate.eventNumber && !candidate.eventMatchesDate) score -= 30;

  return score;
}

function extractEventNumber(text) {
  const matches = String(text || "").match(/\bF\d{9}\b/g);
  if (!matches || !matches.length) return "";
  return matches[matches.length - 1];
}

function extractPagerDate(text, eventNumber) {
  const fullText = String(text || "");

  const matches = [...fullText.matchAll(/\b(\d{2})-(\d{2})-(\d{4})\b/g)];
  if (!matches.length) return "";

  for (const match of matches) {
    const dd = match[1];
    const mm = match[2];
    const yyyy = match[3];
    const date = `${yyyy}-${mm}-${dd}`;

    if (validateEventNumberAgainstDate(eventNumber, date)) {
      return date;
    }
  }

  return "";
}

function extractPagerTime(text) {
  const fullText = String(text || "");

  const match = fullText.match(/\b([01]\d|2[0-3]):([0-5]\d):([0-5]\d)\b/);
  if (!match) return "";

  return `${match[1]}:${match[2]}`;
}

function extractEmergencyHeaderLine(text) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const hasEmergency = /EMERGENCY|EMERGENCV/.test(line);
    const hasTime = /\b([01]\d|2[0-3]):([0-5]\d):([0-5]\d)\b/.test(line);
    const hasDate = /\b\d{2}-\d{2}-\d{4}\b/.test(line);

    if (hasEmergency && hasTime && hasDate) {
      return line;
    }
  }

  return "";
}

function validateEventNumberAgainstDate(eventNumber, pagerDate) {
  if (!eventNumber || !pagerDate) return false;

  const year = pagerDate.slice(2, 4);
  const month = pagerDate.slice(5, 7);

  return eventNumber.slice(1, 3) === year && eventNumber.slice(3, 5) === month;
}

function extractAlertAreaCode(text) {
  const match = String(text || "").match(/\bALERT\s+([A-Z0-9]{4}[0-9ZO]{1,2})\b/);
  if (!match) return "";

  const rawCode = match[1];
  const letters = rawCode
    .slice(0, 4)
    .replace(/0/g, "O")
    .replace(/^GRV$/, "GROV")
    .replace(/^GR0V$/, "GROV");
  const suffix = rawCode
    .slice(4)
    .replace(/Z/g, "2")
    .replace(/O/g, "0");

  return `${letters}${suffix}`;
}

function extractPrimaryBrigade(alertAreaCode) {
  return normalizeSceneUnit(String(alertAreaCode || "").replace(/\d+/g, ""));
}

function deriveBrigadeRole(primaryBrigade) {
  if (!primaryBrigade) return "";
  return primaryBrigade === "CONN" ? "Primary" : `Support to ${primaryBrigade}`;
}

function extractIncidentCodeRaw(text) {
  const match = String(text || "").match(/\bALERT\s+[A-Z0-9]{4}[0-9ZO]{1,2}\s+([A-Z&]{4,6}C[13])\b/);
  if (!match) return "";
  return match[1];
}

function splitIncidentCode(rawCode) {
  const clean = String(rawCode || "").trim().toUpperCase();
  if (!clean) {
    return {
      incidentFamily: "",
      incidentType: "",
      responseCode: ""
    };
  }

  const responseSuffix = clean.endsWith("C3") ? "C3" : clean.endsWith("C1") ? "C1" : "";
  const family = responseSuffix ? clean.slice(0, -2) : clean;

  let incidentFamily = family;
  if (family.startsWith("INCI")) incidentFamily = "INCI";
  else if (family.startsWith("RESC")) incidentFamily = "RESC";
  else if (family.startsWith("STRU")) incidentFamily = "STRU";
  else if (family.startsWith("ALAR")) incidentFamily = "ALAR";
  else if (family.startsWith("NSTR")) incidentFamily = "NSTR";
  else if (family.startsWith("G&S")) incidentFamily = "G&S";
  else incidentFamily = family.slice(0, 4);

  const incidentType = INCIDENT_TYPE_LABELS[incidentFamily] || incidentFamily;
  const responseCode = responseSuffix === "C1" ? "Code 1" : responseSuffix === "C3" ? "Code 3" : "";

  return {
    incidentFamily,
    incidentType,
    responseCode
  };
}

function extractBodyBeforeMap(text, incidentCodeRaw) {
  let working = String(text || "");

  if (incidentCodeRaw) {
    const alertPattern = new RegExp(`\\bALERT\\s+[A-Z0-9]{4}[0-9ZO]{1,2}\\s+${escapeRegex(incidentCodeRaw)}\\b`);
    const alertMatch = working.match(alertPattern);

    if (alertMatch) {
      const startIndex = (alertMatch.index || 0) + alertMatch[0].length;
      working = working.slice(startIndex).trim();
    }
  }

  const eventMatch = working.match(/\bF\d{9}\b/);
  if (eventMatch) {
    working = working.slice(0, eventMatch.index).trim();
  }

  const mapMatch = working.match(/\bM\s*\d{3}\s*[A-Z]\d{1,2}\s*\(\d+\)/);
  if (mapMatch) {
    working = working.slice(0, mapMatch.index).trim();
  }

  return working.replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function extractPagerDetails(text, eventNumber) {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line) => line.trim().length > 0);

  const startIndex = lines.findIndex((line) => /EMERGENCY|EMERGENCV|ALERT\s/.test(line));
  const safeStart = startIndex > -1 ? startIndex : 0;

  let endIndex = lines.findIndex((line) => eventNumber && line.includes(eventNumber));
  if (endIndex === -1) {
    endIndex = lines.length - 1;
  }

  return lines
    .slice(safeStart, endIndex + 1)
    .join("\n")
    .trim();
}

function findAddressInBody(body) {
  const text = String(body || "").trim();
  if (!text) return null;

  const intersectionRegex = /\bCNR\s+[A-Z0-9' -]+?\s*\/\s*[A-Z0-9' -]+?(?=\s+M\s*\d{3}\s*[A-Z]\d{1,2}\s*\(\d+\)|\s+ARMSTRONG CREEK|\s+MOUNT DUNEED|\s+CHARLEMONT|\s+CONNEWARRE|\s*$)/g;
  const numberedRegex = /\b\d+\s+[A-Z0-9' -]+?(?:RD|ROAD|ST|STREET|DR|DRIVE|AVE|AV|AVENUE|HWY|HIGHWAY|CRT|COURT|CT|CRES|CRESCENT|PL|PLACE|WAY|LN|LANE)\b(?:\s+[A-Z][A-Z' -]+){0,4}/g;

  const candidates = [];

  let match;

  while ((match = intersectionRegex.exec(text)) !== null) {
    candidates.push({
      text: cleanAddress(match[0]),
      start: match.index
    });
  }

  while ((match = numberedRegex.exec(text)) !== null) {
    let value = cleanAddress(match[0]);

    if (!value.startsWith("CNR ")) {
      const slashIndex = value.indexOf("/");
      if (slashIndex > -1) {
        value = value.slice(0, slashIndex).trim();
      }
    }

    candidates.push({
      text: value,
      start: match.index
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => b.start - a.start);
  return candidates[0];
}

function cleanAddress(value) {
  return String(value || "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .trim();
}

function extractSceneUnits(text) {
  const tokens = String(text || "")
    .split(/\s+/)
    .map((token) => token.replace(/[^A-Z0-9]/g, ""))
    .filter(Boolean);

  const units = [];

  tokens.forEach((token) => {
    let cleaned = token;

    if (cleaned.startsWith("C") && cleaned.length > 1) {
      const stripped = cleaned.slice(1);
      const unit = normalizeSceneUnit(stripped);
      if ((KNOWN_BRIGADE_CODES.includes(unit) || KNOWN_OTHER_UNITS.includes(unit) || unit === "Police") && !units.includes(unit)) {
        units.push(unit);
      }
      return;
    }

    cleaned = normalizeSceneUnit(cleaned);
    if ((KNOWN_BRIGADE_CODES.includes(cleaned) || KNOWN_OTHER_UNITS.includes(cleaned) || cleaned === "Police") && !units.includes(cleaned)) {
      units.push(cleaned);
    }
  });

  return units;
}

function normalizeSceneUnit(code) {
  const clean = String(code || "").trim().toUpperCase();

  if (clean === "AFP" || clean === "AFPR" || clean === "FP" || clean === "POLICE") return "Police";
  if (clean === "GRV" || clean === "GROV" || clean === "GR0V") return "GROV";
  if (clean === "CONN" || clean === "C0NN") return "CONN";
  if (clean === "FRES") return "FRES";
  if (clean === "BARW") return "BARW";
  if (clean === "TRQY" || clean === "TQRY") return "TRQY";
  if (clean === "MTDU") return "MTDU";
  if (clean === "P64") return "P64";
  if (clean === "P63B") return "P63B";
  if (clean === "R63") return "R63";
  if (clean === "STHB1") return "STHB1";
  if (clean === "AV") return "AV";
  if (clean === "MODE") return "MODE";

  return clean;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setScanStatus(message, className) {
  const target = document.getElementById("scanStatus");
  if (!target) return;
  target.textContent = message;
  target.className = `scan-status ${className}`;
}
