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

  GRASC1: { incidentType: "Grass / Scrub", responseCode: "Code 1", responseShort: "C1", family: "G&S" },
  GRASC3: { incidentType: "Grass / Scrub", responseCode: "Code 3", responseShort: "C3", family: "G&S" },
  SCRBC1: { incidentType: "Grass / Scrub", responseCode: "Code 1", responseShort: "C1", family: "G&S" },
  SCRBC3: { incidentType: "Grass / Scrub", responseCode: "Code 3", responseShort: "C3", family: "G&S" },
  "G&SC1": { incidentType: "Grass / Scrub", responseCode: "Code 1", responseShort: "C1", family: "G&S" },
  "G&SC3": { incidentType: "Grass / Scrub", responseCode: "Code 3", responseShort: "C3", family: "G&S" }
};

const KNOWN_BRIGADE_CODES = new Set([
  "CONN",
  "GROV",
  "FRES",
  "BARW",
  "TRQY",
  "TQRY",
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
  "LP63",
  "BA"
]);

const SUBURB_PHRASES = [
  "ARMSTRONG CREEK",
  "MT DUNEED",
  "MOUNT DUNEED",
  "CONNEWARRE",
  "GROVEDALE",
  "FRESHWATER CREEK",
  "BARWON HEADS",
  "TORQUAY",
  "MODEWARRE",
  "GEELONG",
  "MARSHALL",
  "LEOPOLD",
  "BELMONT",
  "WAURN PONDS",
  "CHARLEMONT"
];

const SUBURB_WORDS = new Set([
  "ARMSTRONG", "CREEK",
  "MT", "DUNEED",
  "MOUNT", "DUNEED",
  "CONNEWARRE",
  "GROVEDALE",
  "FRESHWATER", "CREEK",
  "BARWON", "HEADS",
  "TORQUAY",
  "MODEWARRE",
  "GEELONG",
  "MARSHALL",
  "LEOPOLD",
  "BELMONT",
  "WAURN", "PONDS",
  "CHARLEMONT",
  "MOUNTDUNEED"
]);

const ROAD_TYPE_PATTERN = "(RD|ST|AV|AVE|DR|CT|LN|HWY|PL|WAY|CRES|BLVD|PDE|CL|TCE|BVD)";
const STREET_NAME_PATTERN = "[A-Z0-9'/-]+(?:\\s+[A-Z0-9'/-]+){0,3}";
const BANNER_NAME_PATTERN = "[A-Z]+(?: [A-Z]+){0,3}";
const SUBURB_PATTERN = `(${SUBURB_PHRASES.join("|")})`;

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

function cleanOcrText(rawText) {
  let text = normaliseNewlines(toUpperSafe(rawText));

  text = text
    .replace(/[|]/g, "I")
    .replace(/[“”"]/g, "")
    .replace(/[’']/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[，]/g, ",")
    .replace(/[。]/g, ".")
    .replace(/\/\\T\b/g, "MT")
    .replace(/\\T\b/g, "MT")
    .replace(/\/\^T\b/g, "MT")
    .replace(/\)\s*\\?IT\b/g, "MT")
    .replace(/\b\\?IT\b/g, "MT")
    .replace(/\bM T\b/g, "MT")
    .replace(/\bMOUNT DUNEED\b/g, "MT DUNEED")
    .replace(/\bG\s*&\s*S\s*C([13])\b/g, "G&SC$1")
    .replace(/\bG&5C([13])\b/g, "G&SC$1")
    .replace(/\bGASC([13])\b/g, "G&SC$1")
    .replace(/\bG&SC([13])\b/g, "G&SC$1");

  text = normaliseSlashSpacing(text);

  const lines = text
    .split("\n")
    .map((line) => collapseSpaces(line))
    .filter((line) => line.length > 0);

  return lines.join("\n");
}

function getLines(text) {
  return normaliseNewlines(text)
    .split("\n")
    .map((line) => collapseSpaces(line))
    .filter(Boolean);
}

function normaliseHeaderTypos(line) {
  return String(line || "")
    .replace(/\bEMERGENCV\b/g, "EMERGENCY")
    .replace(/\bNON[- ]?EMERGENCV\b/g, "NON-EMERGENCY");
}

function parseHeaderLine(line) {
  const fixed = normaliseHeaderTypos(line);

  let match = fixed.match(/\b(EMERGENCY|NON-EMERGENCY)\b\s+(\d{2}:\d{2}:\d{2})\s+(\d{2}-\d{2}-\d{4})\b/);
  if (!match) {
    match = fixed.match(/\b(EMERGENCY|NON-EMERGENCY)\b.*?(\d{2}:\d{2}:\d{2}).*?(\d{2}-\d{2}-\d{4})\b/);
  }
  if (!match) return null;

  const alertKind = match[1];
  const fullTime = match[2];
  const pagerDate = match[3];
  const pagerTime = fullTime.slice(0, 5);

  const [, , yyyy] = pagerDate.split("-");
  const yearNum = Number(yyyy);
  if (!Number.isInteger(yearNum) || yearNum < 2020 || yearNum > 2035) {
    return null;
  }

  return {
    raw: line,
    normalised: fixed,
    alertKind,
    fullTime,
    pagerTime,
    pagerDate
  };
}

function findHeader(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const parsed = parseHeaderLine(lines[i]);
    if (parsed) {
      return { ...parsed, lineIndex: i };
    }
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
    tail: match[3],
    index: match.index ?? -1
  }));
}

function validateEventNumberAgainstDate(eventNumber, pagerDate) {
  if (!eventNumber || !pagerDate) return false;

  const eventMatch = eventNumber.match(/^F(\d{2})(\d{2})\d{5}$/);
  const dateMatch = pagerDate.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!eventMatch || !dateMatch) return false;

  const eventYY = eventMatch[1];
  const eventMM = eventMatch[2];
  const dateMM = dateMatch[2];
  const dateYY = dateMatch[3].slice(-2);
  const fullYear = Number(dateMatch[3]);

  if (!Number.isInteger(fullYear) || fullYear < 2020 || fullYear > 2035) {
    return false;
  }

  return eventYY === dateYY && eventMM === dateMM;
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

  if (structurallyValid.length) return structurallyValid[0].value;
  return null;
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
  const joined = lines.join(" ");

  for (const line of lines) {
    const match = line.match(/\bALERT\s+([A-Z0-9]{4,6})\b/);
    if (!match) continue;

    const candidate = normaliseAlertAreaCandidate(match[1]);
    if (/^[A-Z]{4}\d{1,2}$/.test(candidate)) {
      return candidate;
    }
  }

  const joinedMatch = joined.match(/\bALERT\s+([A-Z0-9]{4,6})\b/);
  if (joinedMatch) {
    const candidate = normaliseAlertAreaCandidate(joinedMatch[1]);
    if (/^[A-Z]{4}\d{1,2}$/.test(candidate)) {
      return candidate;
    }
  }

  return "";
}

function deriveBrigadeRole(alertAreaCode) {
  if (!alertAreaCode) return "";

  const primaryBrigade = alertAreaCode.slice(0, 4);

  if (primaryBrigade === "CONN") {
    return "Primary";
  }

  return `Support to ${primaryBrigade}`;
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

  const mapped = INCIDENT_CODE_MAP[incidentCode];
  return {
    incidentCode,
    incidentType: mapped.incidentType,
    responseCode: mapped.responseCode,
    responseShort: mapped.responseShort,
    family: mapped.family
  };
}

function findIncidentCode(lines) {
  const text = lines.join(" ");

  const patterns = [
    { regex: /\bG&SC([13])\b/, toCode: (m) => `G&SC${m[1]}` },
    { regex: /\bGRASC([13])\b/, toCode: (m) => `GRASC${m[1]}` },
    { regex: /\bSCRBC([13])\b/, toCode: (m) => `SCRBC${m[1]}` },
    { regex: /\bRESCC([13])\b/, toCode: (m) => `RESCC${m[1]}` },
    { regex: /\bSTRUC([13])\b/, toCode: (m) => `STRUC${m[1]}` },
    { regex: /\bALARC([13])\b/, toCode: (m) => `ALARC${m[1]}` },
    { regex: /\bNSTRC([13])\b/, toCode: (m) => `NSTRC${m[1]}` },
    { regex: /\bINCIC([13])\b/, toCode: (m) => `INCIC${m[1]}` }
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) return pattern.toCode(match);
    }
  }

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match) return pattern.toCode(match);
  }

  return "";
}

function stripLeadingKnownTags(line) {
  let value = String(line || "");

  value = value.replace(/\b(EMERGENCY|NON-EMERGENCY)\b\s+\d{2}:\d{2}:\d{2}\s+\d{2}-\d{2}-\d{4}\b/g, "").trim();
  value = value.replace(/\bALERT\s+[A-Z]{4}\d{1,2}\b/g, "").trim();
  value = value.replace(/\b(G&SC[13]|GRASC[13]|SCRBC[13]|RESCC[13]|STRUC[13]|ALARC[13]|NSTRC[13]|INCIC[13])\b/g, "").trim();

  return collapseSpaces(value);
}

function normaliseBannerText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[|]/g, "I")
    .replace(/\)\s*\\?IT\b/g, "MT")
    .replace(/^\/\\?T\b/g, "MT")
    .replace(/^\/\^T\b/g, "MT")
    .replace(/\b\\?IT\b/g, "MT")
    .replace(/\bM T\b/g, "MT")
    .replace(/\bMOUNT DUNEED\b/g, "MT DUNEED")
    .replace(/\bBRIGADF\b/g, "BRIGADE")
    .replace(/\bBRIGA0E\b/g, "BRIGADE")
    .replace(/\bAII\b/g, "ALL")
    .replace(/\bALI\b/g, "ALL")
    .replace(/^(?:E\d{1,3}|288|259|28B|2&8|CFA|\(|\[)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractValidBannerText(value) {
  const cleaned = normaliseBannerText(value);

  if (cleaned === "CONNEWARRE BRIGADE ALL") return "CONNEWARRE BRIGADE ALL";
  if (cleaned === "FRESHWATER CREEK BRIGADE ALL") return "FRESHWATER CREEK BRIGADE ALL";
  if (cleaned === "MT DUNEED ALL") return "MT DUNEED ALL";

  return "";
}

function extractBrigadeBannerLine(lines, headerLineIndex = -1, eventLineIndex = -1) {
  const start = headerLineIndex >= 0 ? headerLineIndex : 0;
  const end = eventLineIndex >= 0 ? eventLineIndex : Math.min(lines.length - 1, start + 8);

  for (let i = start; i <= end; i += 1) {
    const banner = extractValidBannerText(lines[i]);
    if (banner) return banner;
  }

  return "";
}

function looksLikeBannerLine(line) {
  return Boolean(extractValidBannerText(line));
}

function normaliseAddressText(value) {
  return collapseSpaces(
    normaliseSlashSpacing(String(value || ""))
      .replace(/\bMOUNT DUNEED\b/g, "MT DUNEED")
      .replace(/\bSTREET\b/g, "ST")
      .replace(/\bROAD\b/g, "RD")
      .replace(/\bAVENUE\b/g, "AV")
      .replace(/\bBOULEVARD\b/g, "BLVD")
  );
}

function trimAfterSuburb(value) {
  let text = normaliseAddressText(value);
  let bestEnd = -1;
  let bestSuburb = "";

  for (const suburb of SUBURB_PHRASES) {
    const idx = text.indexOf(suburb);
    if (idx >= 0) {
      const end = idx + suburb.length;
      if (end > bestEnd) {
        bestEnd = end;
        bestSuburb = suburb;
      }
    }
  }

  if (bestEnd > 0) {
    text = text.slice(0, bestEnd).trim();
  }

  return {
    text: normaliseAddressText(text),
    endedAtSuburb: bestEnd > 0,
    suburb: bestSuburb
  };
}

function stripToAddressStart(value) {
  const text = normaliseAddressText(stripLeadingKnownTags(value));

  const cnrIndex = text.indexOf("CNR ");
  if (cnrIndex >= 0) {
    return text.slice(cnrIndex).trim();
  }

  const numberedRegex = new RegExp(`\\b\\d+[A-Z]?\\s+${STREET_NAME_PATTERN}\\s+${ROAD_TYPE_PATTERN}\\b`);
  const numberedMatch = text.match(numberedRegex);
  if (numberedMatch && typeof numberedMatch.index === "number") {
    return text.slice(numberedMatch.index).trim();
  }

  return text;
}

function buildCnrRegex() {
  return new RegExp(
    `\\bCNR\\s+${STREET_NAME_PATTERN}\\s+${ROAD_TYPE_PATTERN}\\s*/\\s*${STREET_NAME_PATTERN}\\s+${ROAD_TYPE_PATTERN}\\s+${SUBURB_PATTERN}\\b`
  );
}

function buildNumberedRegex() {
  return new RegExp(
    `\\b\\d+[A-Z]?\\s+${STREET_NAME_PATTERN}\\s+${ROAD_TYPE_PATTERN}\\s+${SUBURB_PATTERN}\\b`
  );
}

function lineLooksLikeAddress(line) {
  if (!line) return false;

  const cleaned = stripToAddressStart(line);
  if (!cleaned) return false;

  if (/^(RE:\s*EVENT|RESPOND|SINCE ALERT|CANCEL RESPONSE NOT REQUIRED|ASSIST PATIENT)\b/.test(cleaned)) {
    return false;
  }

  if (/^(EMERGENCY|NON-EMERGENCY|ATTENDING|MT DUNEED ALL|CONNEWARRE BRIGADE ALL|FRESHWATER CREEK BRIGADE ALL)\b/.test(cleaned)) {
    return false;
  }

  const hasCnr = /^CNR\b/.test(cleaned);
  const hasStreetNumber = /^\d+[A-Z]?\b/.test(cleaned);
  const hasRoadType = new RegExp(`\\b${ROAD_TYPE_PATTERN}\\b`).test(cleaned);
  const hasSuburbWord = [...SUBURB_WORDS].some((word) => cleaned.includes(word));

  if (hasCnr && hasRoadType && hasSuburbWord) return true;
  if (hasStreetNumber && hasRoadType && hasSuburbWord) return true;

  return false;
}

function cleanAddressCandidate(line) {
  let value = stripToAddressStart(line);
  value = normaliseAddressText(value);

  const cnrRegex = buildCnrRegex();
  const numberedRegex = buildNumberedRegex();

  const cnrMatch = value.match(cnrRegex);
  if (cnrMatch) {
    return trimAfterSuburb(cnrMatch[0]).text;
  }

  const numberedMatch = value.match(numberedRegex);
  if (numberedMatch) {
    return trimAfterSuburb(numberedMatch[0]).text;
  }

  const trimmed = trimAfterSuburb(value).text;

  if (/^CNR\b/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d+[A-Z]?\b/.test(trimmed)) {
    return trimmed;
  }

  return "";
}

function isValidAddressShape(address) {
  const value = normaliseAddressText(address);
  if (!value) return false;

  const { endedAtSuburb } = trimAfterSuburb(value);
  if (!endedAtSuburb) return false;

  if (/^CNR\b/.test(value)) {
    if (!/\//.test(value)) return false;
    return buildCnrRegex().test(value);
  }

  if (/^\d+[A-Z]?\b/.test(value)) {
    if (/\//.test(value)) return false;
    return buildNumberedRegex().test(value);
  }

  return false;
}

function scoreAddressCandidate(rawLine, cleaned) {
  let score = 0;
  const value = cleaned || "";

  if (!value) return -100;
  if (isValidAddressShape(value)) score += 20;
  if (/^CNR\b/.test(value)) score += 8;
  if (/^\d+[A-Z]?\b/.test(value)) score += 8;
  if (new RegExp(`\\b${ROAD_TYPE_PATTERN}\\b`).test(value)) score += 4;
  if (SUBURB_PHRASES.some((suburb) => value.endsWith(suburb.replace("MOUNT DUNEED", "MT DUNEED")))) score += 6;
  if (/ASSIST PATIENT/.test(rawLine)) score -= 12;
  if (!/^CNR\b/.test(value) && /\//.test(value)) score -= 25;

  return score;
}

function extractScannedAddress(lines, incidentCode, eventNumber) {
  const text = normaliseAddressText(lines.join(" "));

  const cnrRegex = new RegExp(
    `\\bCNR\\s+${STREET_NAME_PATTERN}\\s+${ROAD_TYPE_PATTERN}\\s*/\\s*${STREET_NAME_PATTERN}\\s+${ROAD_TYPE_PATTERN}\\s+${SUBURB_PATTERN}\\b`
  );

  const numberedRegex = new RegExp(
    `\\b\\d+[A-Z]?\\s+${STREET_NAME_PATTERN}\\s+${ROAD_TYPE_PATTERN}\\s+${SUBURB_PATTERN}\\b`
  );

  const cnrMatch = text.match(cnrRegex);
  if (cnrMatch) {
    return trimAfterSuburb(cnrMatch[0]).text;
  }

  const numberedMatches = [...text.matchAll(new RegExp(numberedRegex, "g"))]
    .map((m) => m[0])
    .filter(Boolean);

  const validNumbered = numberedMatches
    .map((addr) => trimAfterSuburb(addr).text)
    .filter((addr) => addr && !addr.includes("/"));

  if (validNumbered.length) {
    return validNumbered[0];
  }

  return "";
}

  const joined = lines.slice(start, end + 1).join(" ");
  const cleanedJoined = cleanAddressCandidate(joined);
  if (cleanedJoined) {
    candidates.push({
      raw: joined,
      cleaned: cleanedJoined,
      score: scoreAddressCandidate(joined, cleanedJoined) + 2,
      lineIndex: start
    });
  }

  if (!candidates.length) return "";

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lineIndex - b.lineIndex;
  });

  const best = candidates[0].cleaned;
  return isValidAddressShape(best) ? best : "";
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

  if (value === "TQRY") value = "TRQY";
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

function extractPagerDetails(lines, headerLineIndex, eventNumber) {
  if (headerLineIndex < 0 || !eventNumber) return "";

  const eventLineIndex = lines.findIndex(
    (line, index) => index >= headerLineIndex && line.includes(eventNumber)
  );

  if (eventLineIndex < 0) return "";

  const slice = lines.slice(headerLineIndex, eventLineIndex + 1);
  const cleanedLines = [];

  for (let i = 0; i < slice.length; i += 1) {
    let line = slice[i];

    line = line
      .replace(/\b(E\d{1,3}|288|259|28B|2&8|588|CFA)\b/g, "")
      .replace(/\)\s*\\?IT\b/g, "MT")
      .replace(/^\/?\\?T\b/g, "MT")
      .replace(/\/\^T\b/g, "MT")
      .replace(/\b\\?IT\b/g, "MT")
      .replace(/\bVT DUNEED ALL\b/g, "MT DUNEED ALL")
      .replace(/\s+/g, " ")
      .trim();

    if (!line) continue;
    if (looksLikeBannerLine(line)) continue;

    cleanedLines.push(line);
  }

  return cleanedLines.join("\n");
}

function detectBlockType(lines) {
  const text = lines.join("\n");

  return {
    hasEmergency: lines.some((line) => /\bEMERGENCY\b/.test(normaliseHeaderTypos(line))),
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

  const alertAreaCode = extractAlertAreaCode(lines);
  const brigadeRole = deriveBrigadeRole(alertAreaCode);

  const incidentCode = findIncidentCode(lines);
  const incidentParsed = parseIncidentCode(incidentCode);

  const scannedAddress = extractScannedAddress(lines, incidentCode, eventNumber);
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
