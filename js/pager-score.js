// pager-score.js
// Scores and selects the best pager-message candidate from OCR text.
// No DOM writes.
// No app state writes.

import { parsePagerBlock, mergeSceneUnits } from './pager-parse.js';

function toUpperSafe(value) {
  return (value || '').toString().toUpperCase();
}

function normaliseText(value) {
  return toUpperSafe(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function collapseSpaces(value) {
  return value.replace(/[ \t]+/g, ' ').trim();
}

function getLines(text) {
  return normaliseText(text)
    .split('\n')
    .map((line) => collapseSpaces(line))
    .filter(Boolean);
}

function isHeaderLine(line) {
  return /\bEMERGENCY\b/.test(line) || /\bEMERGENCV\b/.test(line);
}

function splitIntoCandidateBlocks(rawText) {
  const lines = getLines(rawText);
  if (!lines.length) return [];

  const headerIndexes = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isHeaderLine(lines[i])) {
      headerIndexes.push(i);
    }
  }

  // Best case: split by each emergency header line.
  if (headerIndexes.length > 0) {
    const blocks = [];

    for (let i = 0; i < headerIndexes.length; i += 1) {
      const start = headerIndexes[i];
      const end = i + 1 < headerIndexes.length ? headerIndexes[i + 1] : lines.length;
      const blockLines = lines.slice(start, end);
      const text = blockLines.join('\n').trim();

      if (text) {
        blocks.push({
          kind: 'header-split',
          startLine: start,
          endLine: end - 1,
          text
        });
      }
    }

    return blocks;
  }

  // Fallback: chunk by blank-line-like separators is not possible after OCR cleanup,
  // so use a single block if no emergency header was clearly found.
  return [
    {
      kind: 'single-fallback',
      startLine: 0,
      endLine: lines.length - 1,
      text: lines.join('\n')
    }
  ];
}

function scoreCandidate(parsed, meta = {}) {
  let score = 0;
  const reasons = [];
  const penalties = [];

  // Strong preference for true emergency page.
  if (parsed.blockFlags.hasEmergency) {
    score += 40;
    reasons.push('Has EMERGENCY header context');
  } else {
    score -= 40;
    penalties.push('No EMERGENCY header context');
  }

  if (parsed.headerLineIndex >= 0) {
    score += 20;
    reasons.push('Has valid emergency header line');
  } else {
    score -= 25;
    penalties.push('Missing valid emergency header line');
  }

  if (parsed.pagerDate) {
    score += 8;
    reasons.push('Has pager date');
  } else {
    score -= 10;
    penalties.push('Missing pager date');
  }

  if (parsed.pagerTime) {
    score += 8;
    reasons.push('Has pager time');
  } else {
    score -= 10;
    penalties.push('Missing pager time');
  }

  if (parsed.eventNumber) {
    score += 25;
    reasons.push('Has valid event number');
  } else {
    score -= 30;
    penalties.push('Missing valid event number');
  }

  if (parsed.eventDateValid) {
    score += 15;
    reasons.push('Event number matches pager date');
  } else if (parsed.eventNumber && parsed.pagerDate) {
    score -= 30;
    penalties.push('Event number conflicts with pager date');
  }

  if (parsed.alertAreaCode) {
    score += 12;
    reasons.push('Has alert area code');
  } else {
    score -= 10;
    penalties.push('Missing alert area code');
  }

  if (parsed.incidentCode) {
    score += 14;
    reasons.push('Has incident code');
  } else {
    score -= 14;
    penalties.push('Missing incident code');
  }

  if (parsed.scannedAddress) {
    score += 12;
    reasons.push('Has scanned address');
  } else {
    score -= 12;
    penalties.push('Missing scanned address');
  }

  if (parsed.pagerDetails) {
    score += 8;
    reasons.push('Has pager details block');
  } else {
    score -= 8;
    penalties.push('Missing pager details block');
  }

  if (parsed.sceneUnits.length > 0) {
    score += Math.min(parsed.sceneUnits.length, 6);
    reasons.push(`Has scene units (${parsed.sceneUnits.length})`);
  }

  // Reject as primary if it looks like follow-up / cancel messaging.
  if (parsed.blockFlags.hasReEvent) {
    score -= 50;
    penalties.push('Contains RE: EVENT');
  }

  if (parsed.blockFlags.hasCancel) {
    score -= 80;
    penalties.push('Contains CANCEL RESPONSE NOT REQUIRED');
  }

  if (parsed.blockFlags.hasNonEmergency) {
    score -= 35;
    penalties.push('Contains NON-EMERGENCY wording');
  }

  // Small preference to earlier blocks because earlier base emergency message should win.
  if (typeof meta.blockIndex === 'number') {
    score += Math.max(0, 6 - meta.blockIndex);
    reasons.push(`Earlier block preference (${meta.blockIndex})`);
  }

  return {
    score,
    reasons,
    penalties
  };
}

function buildCandidateObjects(rawText) {
  const blocks = splitIntoCandidateBlocks(rawText);

  return blocks.map((block, index) => {
    const parsed = parsePagerBlock(block.text);
    const scoreData = scoreCandidate(parsed, { blockIndex: index });

    return {
      blockIndex: index,
      blockKind: block.kind,
      startLine: block.startLine,
      endLine: block.endLine,
      rawBlockText: block.text,
      parsed,
      score: scoreData.score,
      scoreReasons: scoreData.reasons,
      scorePenalties: scoreData.penalties
    };
  });
}

function candidateCanBePrimary(candidate) {
  const { parsed } = candidate;

  if (!parsed.blockFlags.hasEmergency) return false;
  if (parsed.blockFlags.hasReEvent) return false;
  if (parsed.blockFlags.hasCancel) return false;
  if (parsed.blockFlags.hasNonEmergency) return false;

  return parsed.isStrictlyValidPrimaryBlock;
}

function comparePrimaryCandidates(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
  return 0;
}

function selectPrimaryCandidate(candidates) {
  const validPrimary = candidates.filter(candidateCanBePrimary).sort(comparePrimaryCandidates);
  if (validPrimary.length > 0) return validPrimary[0];

  // If nothing is strictly valid, allow highest-scoring emergency candidate,
  // but still reject RE: EVENT and cancel as primary.
  const fallback = candidates
    .filter((candidate) => {
      const { parsed } = candidate;
      return parsed.blockFlags.hasEmergency && !parsed.blockFlags.hasReEvent && !parsed.blockFlags.hasCancel;
    })
    .sort(comparePrimaryCandidates);

  return fallback[0] || null;
}

function findRelatedEmergencySupplements(primaryCandidate, candidates) {
  if (!primaryCandidate || !primaryCandidate.parsed.eventNumber) return [];

  const primaryEvent = primaryCandidate.parsed.eventNumber;

  return candidates.filter((candidate) => {
    if (candidate.blockIndex === primaryCandidate.blockIndex) return false;
    if (!candidate.parsed.blockFlags.hasEmergency) return false;
    if (candidate.parsed.blockFlags.hasReEvent) return false;
    if (candidate.parsed.blockFlags.hasCancel) return false;
    if (!candidate.parsed.eventNumber) return false;
    if (candidate.parsed.eventNumber !== primaryEvent) return false;

    return true;
  });
}

function mergeSupplementalUnits(primaryCandidate, supplements) {
  if (!primaryCandidate) return [];

  let units = [...primaryCandidate.parsed.sceneUnits];

  for (const supplement of supplements) {
    units = mergeSceneUnits(units, supplement.parsed.sceneUnits);
  }

  return units;
}

function buildChosenResult(primaryCandidate, supplements, allCandidates) {
  if (!primaryCandidate) {
    return {
      success: false,
      reason: 'No valid emergency pager block found',
      primary: null,
      supplements: [],
      candidates: allCandidates,
      merged: {
        eventNumber: '',
        pagerDate: '',
        pagerTime: '',
        alertAreaCode: '',
        brigadeRole: '',
        incidentType: '',
        responseCode: '',
        pagerDetails: '',
        scannedAddress: '',
        sceneUnits: []
      }
    };
  }

  const mergedSceneUnits = mergeSupplementalUnits(primaryCandidate, supplements);
  const p = primaryCandidate.parsed;

  return {
    success: true,
    reason: 'Primary emergency pager block selected',
    primary: primaryCandidate,
    supplements,
    candidates: allCandidates,
    merged: {
      eventNumber: p.eventNumber || '',
      pagerDate: p.pagerDate || '',
      pagerTime: p.pagerTime || '',
      alertAreaCode: p.alertAreaCode || '',
      brigadeRole: p.brigadeRole || '',
      incidentType: p.incidentType || '',
      responseCode: p.responseCode || '',
      pagerDetails: p.pagerDetails || '',
      scannedAddress: p.scannedAddress || '',
      sceneUnits: mergedSceneUnits
    }
  };
}

export function scorePagerCandidates(rawOcrText) {
  const candidates = buildCandidateObjects(rawOcrText);
  const primary = selectPrimaryCandidate(candidates);
  const supplements = primary ? findRelatedEmergencySupplements(primary, candidates) : [];

  return buildChosenResult(primary, supplements, candidates);
}

export function debugPagerCandidateSummary(rawOcrText) {
  const result = scorePagerCandidates(rawOcrText);

  return {
    success: result.success,
    reason: result.reason,
    primaryBlockIndex: result.primary?.blockIndex ?? null,
    supplementBlockIndexes: result.supplements.map((s) => s.blockIndex),
    merged: result.merged,
    candidates: result.candidates.map((candidate) => ({
      blockIndex: candidate.blockIndex,
      score: candidate.score,
      eventNumber: candidate.parsed.eventNumber,
      pagerDate: candidate.parsed.pagerDate,
      pagerTime: candidate.parsed.pagerTime,
      alertAreaCode: candidate.parsed.alertAreaCode,
      incidentCode: candidate.parsed.incidentCode,
      scannedAddress: candidate.parsed.scannedAddress,
      sceneUnits: candidate.parsed.sceneUnits,
      flags: candidate.parsed.blockFlags,
      isStrictlyValidPrimaryBlock: candidate.parsed.isStrictlyValidPrimaryBlock,
      reasons: candidate.scoreReasons,
      penalties: candidate.scorePenalties,
      warnings: candidate.parsed.warnings
    }))
  };
}
