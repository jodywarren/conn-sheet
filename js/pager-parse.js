// pager-parse.js
// Strict parser for a single pager-message OCR block.
// No DOM writes.
// No app state writes.
// No OCR/Tesseract calls.

const INCIDENT_CODE_MAP = {
  INCIC1: { incidentType: "Incident", responseCode: "Code 1", responseShort: "C1", family: "INCI" },
  INCIC3: { incidentType: "Incident", responseCode: "Code 3", responseShort: "C3", family: "INCI" },

  RESCC1: { incidentType: "Rescue", responseCode: "Code 1", responseShort: "C1", family: "RESC" },
  RESCC3: { incidentType: "Rescue", responseCode: "Code 3", responseShort: "C3", family: "RESC" },

  STRUC1: { incidentType: "Structure Fire", responseCode: "Code 1", responseShort: "C1", family: "STRU" },
  STRUC3: { incidentType: "Structure Fire", responseCode: "Code 3", responseShort: "C3", family: "STRU" },

  ALARC1: { incidentType: "Alarm", responseCode: "Code 1", responseShort: "C1", family: "ALAR" },
  ALARC3: { incidentType: "Alarm", responseCode: "Code 3", responseShort: "C3", family: "ALAR" },

  NSTRC1: { incidentType: "Non-Structure", responseCode: "Code 1", responseShort: "C1", family: "NSTR" },
  NSTRC3: { incidentType: "Non-Structure", responseCode: "Code 3", responseShort: "C3", family: "NSTR" },

  "G&SC1": { incidentType: "Grass / Scrub", responseCode: "Code 1", responseShort: "C1", family: "G&S" },
  "G&SC3": { incidentType: "Grass / Scrub", responseCode: "Code 3", responseShort: "C3", family: "G&S" }
};

const KNOWN_BRIGADE_CODES = new Set([
  "CONN",
  "GROV",
  "FRES",
  "BARW",
  "TRQY",
  "MTDU",
  "MODE",
  "BELL",
  "BELM",
  "HIGH",
  "ANGL"
]);

const KNOWN_OTHER_UNITS = new Set([
  "P64",
  "P63B",
  "R63",
  "R64",
  "STHB1",
  "AV",
  "AFP",
  "AFPR",
  "FP",
  "LP63"
]);

const SUBURB_PHRASES = [
  "ARMSTRONG CREEK",
  "MT DUNEED",
  "CONNEWARRE",
  "GROVEDALE",
  "FRESHWATER CREEK",
  "BARWON HEADS",
  "TORQUAY",
  "MODEWARRE",
  "GEELONG",
  "CHARLEMONT"
];

const SUBURB_WORDS = new Set([
  "ARMSTRONG", "CREEK",
  "MT", "DUNEED",
  "CONNEWARRE",
  "GROVEDALE",
  "FRESHWATER",
  "BARWON", "HEADS",
  "TORQUAY",
  "MODEWARRE",
  "GEELONG",
  "CHARLEMONT"
]);

const ROAD_TYPE_PATTERN = "(RD|ST|AV|DR|CT|LN|LANE|HWY|PL|WAY|CR|BLVD|PDE|CL|TCE)";
const STREET_WORD_PATTERN = "[A-Z0-9'/-]+";
const BANNER_NAME_PATTERN = "[A-Z]+(?: [A-Z]+){0,3}";

function toUpperSafe(value) {
  return (value || "").toString().toUpperCase();
}

function collapseSpaces(value) {
  return String(value || "").replace(/[ \t]+/g, " ").trim();
}

function normaliseNewlines(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normaliseSlashSpacing(value) {
  return String(value || "").replace(/\s*\/\s*/g, " / ");
}

function normaliseMtDuneedNoise(value) {
  return String(value || "")
    .replace(/\)\s*\\?IT\b/g, "MT")
    .replace(/\b\\?IT\b/g, "MT")
    .replace(/\bVT\b/g, "MT")
    .replace(/^\/\\?T\b/g, "MT")
    .replace(/^\/\^T\b/g, "MT")
    .replace(/\bM T\b/g, "MT")
    .replace(/\bMOUNT DUNEED\b/g, "MT DUNEED");
}

function normaliseCommonOcrNoise(value) {
  return String(value || "")
    .replace(/[|]/g, "I")
    .replace(/[“”"]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/\bEMERGENCV\b/g, "EMERGENCY")
    .replace(/\bNON[- ]?EMERGENCV\b/g, "NON-EMERGENCY")
    .replace(/\bG\s*&\s*S\s*C([13])\b/g, "G&SC$1")
    .replace(/\bG&5C([13])\b/g, "G&SC$1")
    .replace(/\bG&SCI\b/g, "G&SC1")
    .replace(/\bG&SCI\b/g, "G&SC1");
}

function cleanOcrText(rawText) {
  let text = normaliseNewlines(toUpperSafe(rawText));
  text = normaliseCommonOcrNoise(text);
  text = normaliseMtDuneedNoise(text);
  text = normaliseSlashSpacing(text);

  return text
    .split("\n")
    .map((line) => collapseSpaces(line))
    .filter(Boolean)
    .join("\n");
}

function getLines(text) {
  return normaliseNewlines(text)
    .split("\n")
    .map((line) => collapseSpaces(line))
    .filter(Boolean);
}

function parseHeaderLine(line) {
  const fixed = collapseSpaces(line);

  let match = fixed.match(/\b(EMERGENCY|NON-EMERGENCY)\b\s+(\d{2}:\d{2}:\d{2})\s+(\d{2}-\d{2}-\d{4})\b/);
  if (!match) {
    match = fixed.match(/\b(EMERGENCY|NON-EMERGENCY)\b.*?(\d{2}:\d{2}:\d{2}).*?(\d{2}-\d{2}-\d{4})\b/);
  }
  if (!match) return null;

  const pagerDate = match[3];
  const pagerTime = match[2].slice(0, 5);
  const year = Number(pagerDate.slice(-4));

  if (!Number.isInteger(year) || year < 2020 || year > 2035) {
    return null;
  }

  return {
    alertKind: match[1],
    pagerTime,
    pagerDate,
    line
  };
}

function findHeader(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseHeaderLine(lines[i]);
    if (parsed) return { ...parsed, lineIndex: i };
  }
  return null;
}

function extractEventNumberCandidates(text) {
  const cleaned = String(text || "")
    .replace(/\bO/g, "0")
    .replace(/\bS(?=\d)/g, "5")
    .replace(/(?<=\d)S(?=\d)/g, "5");

  const matches = [...cleaned.matchAll(/\bF(\d{2})(\d{2})(\d{5})\b/g)];

  return matches.map((match) => ({
    value: match[0],
    yy: match[1],
    mm: match[2],
    index: match.index ?? -1
  }));
}

function validateEventNumberAgainstDate(eventNumber, pagerDate) {
  if (!eventNumber || !pagerDate) return false;

  const eventMatch = eventNumber.match(/^F(\d{2})(\d{2})\d{5}$/);
  const dateMatch = pagerDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!eventMatch || !dateMatch) return false;

  return eventMatch[1] === dateMatch[3].slice(-2) && eventMatch[2] === dateMatch[2];
}

function selectBestEventNumber(text, pagerDate) {
  const candidates = extractEventNumberCandidates(text);
  if (!candidates.length) return null;

  if (pagerDate) {
    const valid = candidates.filter((c) => validateEventNumberAgainstDate(c.value, pagerDate));
    if (valid.length) return valid[0].value;
  }

  if (candidates.length === 1) return candidates[0].value;

  const structurallyValid = candidates.filter((c) => {
    const mm = Number(c.mm);
    return mm >= 1 && mm <= 12;
  });

  return structurallyValid.length ? structurallyValid[0].value : null;
}

function normaliseAlertAreaCandidate(value) {
  let code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");

  const match = code.match(/^([A-Z0-9]{4})([A-Z0-9]{1,2})$/);
  if (!match) return code;

  let prefix = match[1];
  let suffix = match[2];

  prefix = prefix
    .replace(/0/g, "O")
    .replace(/1/g, "I")
    .replace(/5/g, "S");

  suffix = suffix
    .replace(/[IOQL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8");

  if (prefix === "GR0V") prefix = "GROV";
  if (prefix === "C0NN") prefix = "CONN";
  if (prefix === "MT0U") prefix = "MTDU";

  return `${prefix}${suffix}`;
}

function extractAlertAreaCode(lines) {
  const text = lines.join(" ");
  const match = text.match(/\bALERT\s+([A-Z0-9]{4,6})\b/);
  if (!match) return "";

  const candidate = normaliseAlertAreaCandidate(match[1]);
  return /^[A-Z]{4}\d{1,2}$/.test(candidate) ? candidate : "";
}

function deriveBrigadeRole(alertAreaCode) {
  if (!alertAreaCode) return "";
  const primaryBrigade = alertAreaCode.slice(0, 4);
  return primaryBrigade === "CONN" ? "Primary" : `Support to ${primaryBrigade}`;
}

function findIncidentCode(lines) {
  const text = lines.join(" ");

  const patterns = [
    /\bG&SC([13])\b/,
    /\bRESCC([13])\b/,
    /\bSTRUC([13])\b/,
    /\bALARC([13])\b/,
    /\bNSTRC([13])\b/,
    /\bINCIC([13])\b/
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) return match[0];
  }

  return "";
}

function parseIncidentCode(incidentCode) {
  if (!incidentCode || !INCIDENT_CODE_MAP[incidentCode]) {
    return {
      incidentCode: "",
      incidentType: "",
      responseCode: "",
      responseShort: "",
      family: ""
    };
  }

  return {
    incidentCode,
    incidentType: INCIDENT_CODE_MAP[incidentCode].incidentType,
    responseCode: INCIDENT_CODE_MAP[incidentCode].responseCode,
    responseShort: INCIDENT_CODE_MAP[incidentCode].responseShort,
    family: INCIDENT_CODE_MAP[incidentCode].family
  };
}

function normaliseBannerText(value) {
  return collapseSpaces(
    normaliseMtDuneedNoise(
      normaliseCommonOcrNoise(
        String(value || "")
          .toUpperCase()
          .replace(/\bBRIGADF\b/g, "BRIGADE")
          .replace(/\bBRIGA0E\b/g, "BRIGADE")
          .replace(/\bAII\b/g, "ALL")
          .replace(/\bALI\b/g, "ALL")
          .replace(/^(?:E\d{1,3}|288|259|28B|588|2&8|CFA|\(|\[)\s*/g, "")
      )
    )
  );
}

function extractValidBannerText(value) {
  const cleaned = normaliseBannerText(value);

  if (cleaned === "CONNEWARRE BRIGADE ALL") return "CONNEWARRE BRIGADE ALL";
  if (cleaned === "FRESHWATER CREEK BRIGADE ALL") return "FRESHWATER CREEK BRIGADE ALL";
  if (cleaned === "MT DUNEED ALL") return "MT DUNEED ALL";

  return "";
}

function extractBrigadeBannerLine(lines) {
  for (const line of lines) {
    const banner = extractValidBannerText(line);
    if (banner) return banner;
  }
  return "";
}

function looksLikeBannerLine(line) {
  return Boolean(extractValidBannerText(line));
}

function normaliseAddressText(value) {
  return collapseSpaces(
    normaliseSlashSpacing(
      normaliseMtDuneedNoise(
        String(value || "")
          .toUpperCase()
          .replace(/\bSTREET\b/g, "ST")
          .replace(/\bROAD\b/g, "RD")
          .replace(/\bAVENUE\b/g, "AV")
      )
    )
  );
}

function escapeForRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRoadNamePattern(maxWords = 4) {
  return `${STREET_WORD_PATTERN}(?:\\s+${STREET_WORD_PATTERN}){0,${maxWords - 1}}`;
}

function buildCnrRegex() {
  const road = buildRoadNamePattern(4);
  const suburbs = SUBURB_PHRASES.map((s) => escapeForRegex(normaliseMtDuneedNoise(s)));

  return new RegExp(
    `\\bCNR\\s+${road}\\s+${ROAD_TYPE_PATTERN}\\s*/\\s*${road}\\s+${ROAD_TYPE_PATTERN}\\s+(?:${suburbs.join("|")})\\b`
  );
}

function buildNumberedRegex() {
  const road = buildRoadNamePattern(4);
  const suburbs = SUBURB_PHRASES.map((s) => escapeForRegex(normaliseMtDuneedNoise(s)));

  return new RegExp(
    `\\b\\d+[A-Z]?\\s+${road}\\s+${ROAD_TYPE_PATTERN}\\s+(?:${suburbs.join("|")})\\b`
  );
}

function trimAfterSuburb(value) {
  const text = normaliseAddressText(value);

  let bestEnd = -1;
  let bestSuburb = "";

  for (const suburb of SUBURB_PHRASES) {
    const normalisedSuburb = normaliseMtDuneedNoise(suburb);
    const idx = text.indexOf(normalisedSuburb);
    if (idx >= 0) {
      const end = idx + normalisedSuburb.length;
      if (end > bestEnd) {
        bestEnd = end;
        bestSuburb = normalisedSuburb;
      }
    }
  }

  if (bestEnd < 0) {
    return {
      text: "",
      suburb: "",
      endedAtSuburb: false
    };
  }

  return {
    text: text.slice(0, bestEnd).trim(),
    suburb: bestSuburb,
    endedAtSuburb: true
  };
}

function looksLikeAddressStart(line) {
  const text = normaliseAddressText(line);
  return /^CNR\b/.test(text) || /^\d+[A-Z]?\b/.test(text);
}

function stripLeadingNoiseBeforeAddress(text) {
  const normalised = normaliseAddressText(text);

  const cnrIndex = normalised.indexOf("CNR ");
  const numberedMatch = normalised.match(/\b\d+[A-Z]?\s+[A-Z0-9'/-]+\s+/);

  if (cnrIndex >= 0) {
    return normalised.slice(cnrIndex).trim();
  }

  if (numberedMatch && typeof numberedMatch.index === "number") {
    return normalised.slice(numberedMatch.index).trim();
  }

  return normalised;
}

function stripTrailingPagerNoise(text) {
  return normaliseAddressText(text)
    .replace(/\s+\([^)]+\).*$/, "")
    .replace(/\s+[A-Z]\s+\d+\s+[A-Z]\d+.*$/, "")
    .replace(/\s+F\d{9}.*$/, "")
    .replace(/\s+(?:CCONN|CGROV|CMTDU|CFRES|CP64|CR64|CAV|CAFP|CSTHB1)\b.*$/, "")
    .trim();
}

function findFallbackAddressLine(lines) {
  for (const rawLine of lines) {
    const line = stripLeadingNoiseBeforeAddress(rawLine);
    if (!looksLikeAddressStart(line)) continue;

    const trimmed = trimAfterSuburb(stripTrailingPagerNoise(line));
    if (trimmed.endedAtSuburb && trimmed.text) {
      if (/^CNR\b/.test(trimmed.text)) return trimmed.text;
      if (/^\d+[A-Z]?\b/.test(trimmed.text)) return trimmed.text;
    }

    const rough = stripTrailingPagerNoise(line);
    if (rough) return rough;
  }

  return "";
}

function extractScannedAddress(lines) {
  const text = stripTrailingPagerNoise(stripLeadingNoiseBeforeAddress(lines.join(" ")));

  const cnrRegex = buildCnrRegex();
  const numberedRegex = buildNumberedRegex();

  const cnrMatch = text.match(cnrRegex);
  if (cnrMatch) {
    const trimmed = trimAfterSuburb(cnrMatch[0]);
    if (trimmed.endedAtSuburb && trimmed.text) {
      return trimmed.text;
    }
  }

  const numberedMatches = [...text.matchAll(new RegExp(numberedRegex, "g"))]
    .map((m) => m[0])
    .filter(Boolean);

  for (const addr of numberedMatches) {
    const trimmed = trimAfterSuburb(addr);
    if (trimmed.endedAtSuburb && trimmed.text && !trimmed.text.includes("/")) {
      return trimmed.text;
    }
  }

  return findFallbackAddressLine(lines);
}

function tokeniseUnits(text) {
  return String(text || "")
    .replace(/[^A-Z0-9/ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normaliseSceneUnitToken(token) {
  let value = token;

  if (/^C[A-Z]{4}$/.test(value)) {
    const stripped = value.slice(1);
    if (KNOWN_BRIGADE_CODES.has(stripped)) value = stripped;
  }

  if (value === "AFP" || value === "AFPR" || value === "FP") value = "Police";
  if (value === "POLICE") value = "Police";

  return value;
}

function extractSceneUnits(lines) {
  const found = new Set();
  const tokens = tokeniseUnits(lines.join(" "));

  for (const rawToken of tokens) {
    const token = normaliseSceneUnitToken(rawToken);

    if (KNOWN_BRIGADE_CODES.has(token)) {
      found.add(token);
      continue;
    }

    if (token === "Police") {
      found.add("Police");
      continue;
    }

    if (KNOWN_OTHER_UNITS.has(rawToken) || ["P64", "P63B", "R63", "R64", "STHB1", "AV", "LP63"].includes(token)) {
      found.add(token);
    }
  }

  return Array.from(found);
}

function stripPagerNoise(line) {
  return collapseSpaces(
    normaliseMtDuneedNoise(
      String(line || "")
        .replace(/\b(E\d{1,3}|288|259|28B|588|2&8|CFA)\b/g, "")
    )
  );
}

function extractPagerDetails(lines, headerLineIndex, eventNumber) {
  if (headerLineIndex < 0 || !eventNumber) return "";

  const eventLineIndex = lines.findIndex(
    (line, index) => index >= headerLineIndex && line.includes(eventNumber)
  );

  if (eventLineIndex < 0) return "";

  const slice = lines.slice(headerLineIndex, eventLineIndex + 1);
  const cleanedLines = [];

  for (const rawLine of slice) {
    const line = stripPagerNoise(rawLine);
    if (!line) continue;
    if (looksLikeBannerLine(line)) continue;
    cleanedLines.push(line);
  }

  return cleanedLines.join("\n");
}

function detectBlockType(lines) {
  const text = lines.join("\n");

  return {
    hasEmergency: /\bEMERGENCY\b/.test(text),
    hasReEvent: /\bRE:\s*EVENT\b/.test(text),
    hasCancel: /\bCANCEL RESPONSE NOT REQUIRED\b/.test(text),
    hasNonEmergency: /\bNON[- ]?EMERGENCY\b/.test(text)
  };
}

export function parsePagerBlock(rawBlockText) {
  const cleanedText = cleanOcrText(rawBlockText);
  const lines = getLines(cleanedText);
  const blockFlags = detectBlockType(lines);

  const header = findHeader(lines);
  const pagerDate = header?.pagerDate || "";
  const pagerTime = header?.pagerTime || "";

  const eventNumber = selectBestEventNumber(cleanedText, pagerDate);
  const eventDateValid = eventNumber && pagerDate
    ? validateEventNumberAgainstDate(eventNumber, pagerDate)
    : false;

  const bannerText = extractBrigadeBannerLine(lines);
  const alertAreaCode = extractAlertAreaCode(lines);
  const brigadeRole = deriveBrigadeRole(alertAreaCode);

  const incidentCode = findIncidentCode(lines);
  const incidentParsed = parseIncidentCode(incidentCode);

  const scannedAddress = extractScannedAddress(lines);
  const sceneUnits = extractSceneUnits(lines);
  const pagerDetails = header && eventNumber
    ? extractPagerDetails(lines, header.lineIndex, eventNumber)
    : "";

  const warnings = [];

  if (!header) warnings.push("Missing valid emergency header line");
  if (!eventNumber) warnings.push("Missing valid event number");
  if (pagerDate && eventNumber && !eventDateValid) warnings.push("Pager date conflicts with event number");
  if (!alertAreaCode) warnings.push("Missing alert area code");
  if (!incidentCode) warnings.push("Missing incident code");
  if (!scannedAddress) warnings.push("Missing scanned address");

  const isStrictlyValidPrimaryBlock =
    blockFlags.hasEmergency &&
    !!header &&
    !!pagerDate &&
    !!pagerTime &&
    !!eventNumber &&
    !!alertAreaCode &&
    !!incidentCode;

  return {
    rawText: rawBlockText,
    cleanedText,
    lines,
    blockFlags,
    bannerText,
    eventNumber,
    pagerDate,
    pagerTime,
    alertAreaCode,
    brigadeRole,
    incidentCode: incidentParsed.incidentCode,
    incidentFamily: incidentParsed.family,
    incidentType: incidentParsed.incidentType,
    responseCode: incidentParsed.responseCode,
    responseCodeShort: incidentParsed.responseShort,
    pagerDetails,
    scannedAddress,
    sceneUnits,
    headerLineIndex: header?.lineIndex ?? -1,
    eventDateValid,
    isStrictlyValidPrimaryBlock,
    warnings
  };
}

export function mergeSceneUnits(baseUnits = [], extraUnits = []) {
  const merged = new Set();

  for (const unit of baseUnits) {
    if (unit) merged.add(unit);
  }

  for (const unit of extraUnits) {
    if (unit) merged.add(unit);
  }

  return Array.from(merged);
}

export function shouldAutoCopyActualAddress(currentActualAddress, actualAddressManuallyEdited = false) {
  if (actualAddressManuallyEdited) return false;
  if (!currentActualAddress) return true;
  return false;
}
