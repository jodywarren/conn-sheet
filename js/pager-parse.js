// pager-parse.js
// Strict parser for a single pager-message OCR block.
// No DOM writes.
// No app state writes.
// No OCR/Tesseract calls.
//
// Design goal:
// false extraction is worse than a blank field.

const INCIDENT_CODE_MAP = {
  INCIC1: { incidentType: 'Incident', responseCode: 'Code 1', responseShort: 'C1', family: 'INCI' },
  INCIC3: { incidentType: 'Incident', responseCode: 'Code 3', responseShort: 'C3', family: 'INCI' },
  RESCC1: { incidentType: 'Rescue', responseCode: 'Code 1', responseShort: 'C1', family: 'RESC' },
  RESCC3: { incidentType: 'Rescue', responseCode: 'Code 3', responseShort: 'C3', family: 'RESC' },
  STRUC1: { incidentType: 'Structure Fire', responseCode: 'Code 1', responseShort: 'C1', family: 'STRU' },
  STRUC3: { incidentType: 'Structure Fire', responseCode: 'Code 3', responseShort: 'C3', family: 'STRU' },
  ALARC1: { incidentType: 'Alarm', responseCode: 'Code 1', responseShort: 'C1', family: 'ALAR' },
  ALARC3: { incidentType: 'Alarm', responseCode: 'Code 3', responseShort: 'C3', family: 'ALAR' },
  NSTRC1: { incidentType: 'Non-Structure', responseCode: 'Code 1', responseShort: 'C1', family: 'NSTR' },
  NSTRC3: { incidentType: 'Non-Structure', responseCode: 'Code 3', responseShort: 'C3', family: 'NSTR' },
  GRASC1: { incidentType: 'Grass / Scrub', responseCode: 'Code 1', responseShort: 'C1', family: 'G&S' },
  GRASC3: { incidentType: 'Grass / Scrub', responseCode: 'Code 3', responseShort: 'C3', family: 'G&S' },
  SCRBC1: { incidentType: 'Grass / Scrub', responseCode: 'Code 1', responseShort: 'C1', family: 'G&S' },
  SCRBC3: { incidentType: 'Grass / Scrub', responseCode: 'Code 3', responseShort: 'C3', family: 'G&S' }
};

const KNOWN_BRIGADE_CODES = new Set([
  'CONN',
  'GROV',
  'FRES',
  'BARW',
  'TRQY',
  'TQRY',
  'MTDU',
  'MODE'
]);

const KNOWN_OTHER_UNITS = new Set([
  'P64',
  'P63B',
  'R63',
  'STHB1',
  'AV',
  'AFP',
  'AFPR',
  'FP'
]);

const SUBURB_WORDS = new Set([
  'ARMSTRONG', 'CREEK',
  'MOUNT', 'DUNEED',
  'CONNEWARRE',
  'GROVEDALE',
  'FRESHWATER', 'CREEK',
  'BARWON', 'HEADS',
  'TORQUAY',
  'MODEWARRE',
  'GEELONG',
  'MARSHALL',
  'LEOPOLD',
  'BELMONT',
  'WAURN', 'PONDS',
  'MOUNTDUNEED'
]);

function toUpperSafe(value) {
  return (value || '').toString().toUpperCase();
}

function collapseSpaces(value) {
  return value.replace(/[ \t]+/g, ' ').trim();
}

function normaliseNewlines(value) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function cleanOcrText(rawText) {
  let text = normaliseNewlines(toUpperSafe(rawText));

  // Common OCR confusions that are low-risk to normalize.
  text = text
    .replace(/[|]/g, 'I')
    .replace(/[“”"]/g, '')
    .replace(/[’']/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[，]/g, ',')
    .replace(/[。]/g, '.');

  // Keep slashes, colons, hyphens because they matter.
  // Trim per-line noise while preserving structure.
  const lines = text
    .split('\n')
    .map((line) => collapseSpaces(line))
    .filter((line) => line.length > 0);

  return lines.join('\n');
}

function getLines(text) {
  return normaliseNewlines(text)
    .split('\n')
    .map((line) => collapseSpaces(line))
    .filter(Boolean);
}

function normaliseHeaderTypos(line) {
  // EMERGENCV is common OCR error.
  return line.replace(/\bEMERGENCV\b/g, 'EMERGENCY');
}

function parseHeaderLine(line) {
  const fixed = normaliseHeaderTypos(line);

  // Strict primary pattern.
  let match = fixed.match(/\bEMERGENCY\b\s+(\d{2}:\d{2}:\d{2})\s+(\d{2}-\d{2}-\d{4})\b/);

  // Fallback: allow minor OCR junk between time and date, but still require proper time/date shapes.
  if (!match) {
    match = fixed.match(/\bEMERGENCY\b.*?(\d{2}:\d{2}:\d{2}).*?(\d{2}-\d{2}-\d{4})\b/);
  }

  if (!match) return null;

  const fullTime = match[1];
  const pagerDate = match[2];
  const pagerTime = fullTime.slice(0, 5);

  // Reject obviously bad year ranges rather than silently accepting garbage.
  const [, , yyyy] = pagerDate.split('-');
  const yearNum = Number(yyyy);
  if (!Number.isInteger(yearNum) || yearNum < 2020 || yearNum > 2035) {
    return null;
  }

  return {
    raw: line,
    normalised: fixed,
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
  const cleaned = text
    .replace(/\bO/g, '0')
    .replace(/\bS(?=\d)/g, '5')
    .replace(/(?<=\d)S(?=\d)/g, '5');

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

  // First preference: date-matched candidate when the header date is trustworthy.
  if (pagerDate) {
    const valid = candidates.filter((c) => validateEventNumberAgainstDate(c.value, pagerDate));
    if (valid.length >= 1) return valid[0].value;
  }

  // Fallback: if exactly one candidate exists, use it even if date failed.
  if (candidates.length === 1) {
    return candidates[0].value;
  }

  // Fallback: prefer the first candidate that looks structurally sane.
  const structurallyValid = candidates.filter((c) => {
    const mm = Number(c.mm);
    return mm >= 1 && mm <= 12;
  });

  if (structurallyValid.length === 1) {
    return structurallyValid[0].value;
  }

  if (structurallyValid.length > 1) {
    return structurallyValid[0].value;
  }

  return null;
}

function extractAlertAreaCode(lines) {
  for (const line of lines) {
    const match = line.match(/\bALERT\s+([A-Z]{4}\d)\b/);
    if (match) {
      return match[1];
    }
  }
  return '';
}

function deriveBrigadeRole(alertAreaCode) {
  if (!alertAreaCode) return '';
  const primaryBrigade = alertAreaCode.slice(0, 4);
  return primaryBrigade === 'CONN' ? 'Primary' : `Support to ${primaryBrigade}`;
}

function findIncidentCode(lines) {
  const knownCodes = Object.keys(INCIDENT_CODE_MAP).sort((a, b) => b.length - a.length);

  for (const line of lines) {
    for (const code of knownCodes) {
      const regex = new RegExp(`\\b${code}\\b`);
      if (regex.test(line)) {
        return code;
      }
    }
  }

  return '';
}

function parseIncidentCode(incidentCode) {
  if (!incidentCode || !INCIDENT_CODE_MAP[incidentCode]) {
    return {
      incidentCode: '',
      incidentType: '',
      responseCode: '',
      responseShort: '',
      family: ''
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

function stripLeadingKnownTags(line) {
  let value = line;

  value = value.replace(/\bEMERGENCY\b\s+\d{2}:\d{2}:\d{2}\s+\d{2}-\d{2}-\d{4}\b/g, '').trim();
  value = value.replace(/\bALERT\s+[A-Z]{4}\d\b/g, '').trim();

  const knownCodes = Object.keys(INCIDENT_CODE_MAP).sort((a, b) => b.length - a.length);
  for (const code of knownCodes) {
    value = value.replace(new RegExp(`\\b${code}\\b`, 'g'), '').trim();
  }

  return collapseSpaces(value);
}

function normaliseAddressPunctuation(address) {
  return collapseSpaces(
    address
      .replace(/\s*\/\s*/g, ' / ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+-\s+/g, ' - ')
  );
}

function looksLikeRoadWord(token) {
  return /\b(RD|ROAD|ST|STREET|AVE|AVENUE|DR|DRIVE|CT|COURT|LN|LANE|HWY|HIGHWAY|PL|PLACE|WAY|CRES|CRESCENT|BLVD|BOULEVARD|PDE|PARADE|CL|CLOSE|TCE|TERRACE)\b/.test(token);
}

function lineLooksLikeAddress(line) {
  if (!line) return false;

  const cleaned = stripLeadingKnownTags(line);

  if (!cleaned) return false;
  if (/^\b(RE: EVENT|RESPOND|SINCE ALERT|CANCEL RESPONSE NOT REQUIRED)\b/.test(cleaned)) return false;

  // Reject obvious non-address logo/junk fragments.
  if (/^(E\d{1,3}|CFA|ATTENDING|EMERGENCY)$/i.test(cleaned)) return false;

  const hasCnr = /\bCNR\b/.test(cleaned) && /\//.test(cleaned);
  const hasStreetNumber = /\b\d+[A-Z]?\b/.test(cleaned);
  const hasRoadType = /\b(RD|ST|AV|AVE|DR|CT|LN|HWY|PL|WAY|CRES|BLVD|PDE|CL|TCE)\b/.test(cleaned);
  const hasSuburbWord = [...SUBURB_WORDS].some((word) => cleaned.includes(word));

  if (hasCnr && hasRoadType && hasSuburbWord) return true;
  if (hasStreetNumber && hasRoadType && hasSuburbWord) return true;

  return false;
}

function cleanAddressCandidate(line) {
  let value = stripLeadingKnownTags(line);

  // Remove obvious CFA logo OCR junk at start only.
  value = value.replace(/^(E\d{1,3}|CFA)\s+/i, '').trim();

  // Normalize pager road abbreviations exactly as pager uses them.
  value = value
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bAVENUE\b/g, 'AV');

  // Keep CNR addresses intact with both roads and suburb.
  if (/\bCNR\b/.test(value)) {
    return normaliseAddressPunctuation(value);
  }

  // For numbered addresses, trim slash-road extras only if present.
  // Example: 12 LYONS DR ARMSTRONG CREEK / PETUNIA CR
  if (/\b\d+[A-Z]?\b/.test(value) && /\//.test(value) && !/\bCNR\b/.test(value)) {
    const suburbMatch = value.match(/\b(ARMSTRONG CREEK|MOUNT DUNEED|CONNEWARRE|GROVEDALE|FRESHWATER CREEK|BARWON HEADS|TORQUAY|MODEWARRE|GEELONG|MARSHALL|LEOPOLD|BELMONT|WAURN PONDS)\b/);
    if (suburbMatch) {
      const suburbEnd = value.indexOf(suburbMatch[0]) + suburbMatch[0].length;
      value = value.slice(0, suburbEnd).trim();
    } else {
      value = value.split('/')[0].trim();
    }
  }

  return normaliseAddressPunctuation(value);
}

function scoreAddressCandidate(line) {
  const cleaned = cleanAddressCandidate(line);
  let score = 0;

  if (/\bCNR\b/.test(cleaned) && /\//.test(cleaned)) score += 5;
  if (/\b\d+[A-Z]?\b/.test(cleaned)) score += 4;
  if (looksLikeRoadWord(cleaned)) score += 3;
  if ([...SUBURB_WORDS].some((word) => cleaned.includes(word))) score += 2;
  if (cleaned.length >= 10) score += 1;

  return score;
}

function extractScannedAddress(lines, incidentCode, eventNumber) {
  const knownCodes = Object.keys(INCIDENT_CODE_MAP);
  const candidates = [];

  const incidentLineIndex = incidentCode
    ? lines.findIndex((line) => knownCodes.some((code) => new RegExp(`\\b${code}\\b`).test(line)))
    : -1;

  const eventLineIndex = eventNumber
    ? lines.findIndex((line) => line.includes(eventNumber))
    : -1;

  // Search mostly between incident code and event number where the real pager body usually sits.
  const start = incidentLineIndex >= 0 ? incidentLineIndex : 0;
  const end = eventLineIndex >= 0 ? eventLineIndex : lines.length - 1;

  for (let i = start; i <= end; i += 1) {
    const line = lines[i];
    if (!lineLooksLikeAddress(line)) continue;

    candidates.push({
      line,
      cleaned: cleanAddressCandidate(line),
      score: scoreAddressCandidate(line),
      lineIndex: i
    });
  }

  if (!candidates.length) return '';

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lineIndex - b.lineIndex;
  });

  return candidates[0].cleaned;
}

function tokeniseUnits(text) {
  return text
    .replace(/[^A-Z0-9/ ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function normaliseSceneUnitToken(token) {
  let value = token;

  // Strip leading C from brigade codes like CCONN, CGROV, CFRES.
  if (/^C[A-Z]{4}$/.test(value)) {
    const stripped = value.slice(1);
    if (KNOWN_BRIGADE_CODES.has(stripped)) {
      value = stripped;
    }
  }

  if (value === 'TQRY') value = 'TRQY';
  if (value === 'AFP' || value === 'AFPR' || value === 'FP') value = 'Police';

  if (value === 'POLICE') value = 'Police';

  return value;
}

function extractSceneUnits(lines) {
  const found = new Set();
  const tokens = tokeniseUnits(lines.join(' '));

  for (const rawToken of tokens) {
    const token = normaliseSceneUnitToken(rawToken);

    if (KNOWN_BRIGADE_CODES.has(token)) {
      found.add(token);
      continue;
    }

    if (token === 'Police') {
      found.add('Police');
      continue;
    }

    if (KNOWN_OTHER_UNITS.has(rawToken) || ['P64', 'P63B', 'R63', 'STHB1', 'AV'].includes(token)) {
      found.add(token);
    }
  }

  return Array.from(found);
}

function extractPagerDetails(lines, headerLineIndex, eventNumber) {
  if (headerLineIndex < 0 || !eventNumber) return '';

  const eventLineIndex = lines.findIndex((line, index) => index >= headerLineIndex && line.includes(eventNumber));
  if (eventLineIndex < 0) return '';

  return lines.slice(headerLineIndex, eventLineIndex + 1).join('\n');
}

function detectBlockType(lines) {
  const text = lines.join('\n');

  const hasEmergency = lines.some((line) => /\bEMERGENCY\b/.test(normaliseHeaderTypos(line)));
  const hasReEvent = /\bRE:\s*EVENT\b/.test(text);
  const hasCancel = /\bCANCEL RESPONSE NOT REQUIRED\b/.test(text);
  const hasNonEmergency = /\bNON[- ]?EMERGENCY\b/.test(text);

  return {
    hasEmergency,
    hasReEvent,
    hasCancel,
    hasNonEmergency
  };
}

export function parsePagerBlock(rawBlockText) {
  const cleanedText = cleanOcrText(rawBlockText);
  const lines = getLines(cleanedText);
  const blockFlags = detectBlockType(lines);

  const header = findHeader(lines);
  const pagerDate = header?.pagerDate || '';
  const pagerTime = header?.pagerTime || '';

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
    : '';

  const warnings = [];

  if (!header) warnings.push('Missing valid emergency header line');
  if (header && !pagerDate) warnings.push('Header present but pager date missing');
  if (header && !pagerTime) warnings.push('Header present but pager time missing');
  if (!eventNumber) warnings.push('Missing valid event number');
  if (pagerDate && eventNumber && !eventDateValid) warnings.push('Pager date conflicts with event number');
  if (!alertAreaCode) warnings.push('Missing alert area code');
  if (!incidentCode) warnings.push('Missing incident code');
  if (!scannedAddress) warnings.push('Missing scanned address');

  const isStrictlyValidPrimaryBlock =
    blockFlags.hasEmergency &&
    !!header &&
    !!pagerDate &&
    !!pagerTime &&
    !!eventNumber &&
    !!eventDateValid &&
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
