import { state, saveState, setCurrentPage } from "./state.js";
import { loadIncidentIntoInputs } from "./incident.js";
import { renderRespondersPage } from "./responders.js";

const REPORT_STORAGE_KEY = "conn_turnout_saved_reports_v1";

function formatAgencyLine(firstAgency) {
  if (!firstAgency) return "";
  return `1st agency on scene: ${firstAgency}`;
}

function formatDistance(distance) {
  if (!distance) return "";
  return String(distance).replace(/\s*KM$/i, "km").replace(/\s+/g, "");
}

function formatApplianceLabel(label) {
  const raw = String(label || "").trim().toUpperCase();

  if (raw === "CONN 1") return "CONN TANKER 1";
  if (raw === "CONN 2") return "CONN TANKER 2";
  if (raw === "MTD P/T") return "MOUNT DUNEED P/T";

  return raw;
}

function buildCrewLine(member) {
  const roles = [];

  if (member.isDriver) roles.push("Driver");
  if (member.isCrewLeader) roles.push("CL");
  if (member.isOic) roles.push("OIC");
  if (member.isBa) roles.push("BA");

  let line = member.name || "";

  if (roles.length) {
    line += `: ${roles.join(", ")}`;
  }

  return line;
}

function getOtherAgencySummary(agency) {
  const parts = [];

  if (agency.name) parts.push(agency.name);
  if (agency.contactNumber) parts.push(agency.contactNumber);
  if (agency.badgeNumber) parts.push(`Badge ${agency.badgeNumber}`);
  if (agency.idNumber) parts.push(`ID ${agency.idNumber}`);
  if (agency.station) parts.push(agency.station);
  if (agency.localHq) parts.push(agency.localHq);
  if (agency.office) parts.push(agency.office);
  if (agency.poleId) parts.push(`Pole ID ${agency.poleId}`);

  return parts.filter((part) => String(part).trim().length > 0).join(", ");
}

function buildStructureReportLines() {
  const s = state.incident.structure;
  if (!s) return [];

  const lines = [];

  function addSection(title, entries) {
    const validEntries = entries.filter((entry) => String(entry.value || "").trim().length > 0);
    if (!validEntries.length) return;

    lines.push(title.toUpperCase());

    validEntries.forEach((entry) => {
      lines.push(`${entry.label}: ${entry.value}`);
    });

    lines.push("");
  }

  addSection("Structure - Quick Info", [
    { label: "Structure type", value: s.quick?.type || "" },
    { label: "Construction type", value: s.quick?.construction || "" },
    { label: "Levels", value: s.quick?.levels || "" },
    { label: "Roof material", value: s.quick?.roof || "" },
    {
      label: "% Involved",
      value: s.quick?.involved ? `${String(s.quick.involved).trim()}%` : ""
    },
    {
      label: "% Saved",
      value: s.quick?.saved ? `${String(s.quick.saved).trim()}%` : ""
    }
  ]);

  addSection("Structure - Fire Area", [
    { label: "Area use", value: s.fireArea?.areaUse || "" },
    { label: "Dimensions", value: s.fireArea?.dimensions || "" },
    { label: "Ceiling lining", value: s.fireArea?.ceiling || "" },
    { label: "Wall lining", value: s.fireArea?.wall || "" }
  ]);

  addSection("Structure - Fire Behaviour", [
    { label: "Smoke material", value: s.behaviour?.smokeMaterial || "" },
    { label: "Fire material", value: s.behaviour?.fireMaterial || "" },
    { label: "Smoke travel", value: s.behaviour?.smokeTravel || "" },
    { label: "Flame spread factors", value: s.behaviour?.spread || "" },
    { label: "Smoke damage", value: s.behaviour?.smokeDamage || "" },
    { label: "Water damage", value: s.behaviour?.waterDamage || "" }
  ]);

  addSection("Structure - Detection", [
    { label: "Smoke alarms", value: s.detection?.alarm || "" },
    { label: "Operation", value: s.detection?.alarmStatus || "" },
    { label: "Power", value: s.detection?.alarmPower || "" },
    { label: "Notes", value: s.detection?.notes || "" }
  ]);

  addSection("Structure - Suppression", [
    { label: "Sprinklers", value: s.suppression?.sprinklers || "" },
    { label: "Heads activated", value: s.suppression?.heads || "" },
    { label: "Performance", value: s.suppression?.performance || "" },
    { label: "Notes", value: s.suppression?.notes || "" }
  ]);

  const equipmentEntries = [];

  if (s.equipment?.extinguishersUsed === "Y") {
    equipmentEntries.push({
      label: "Extinguishers used",
      value: s.equipment?.extinguishersCount
        ? `Y, ${s.equipment.extinguishersCount}`
        : "Y"
    });
  } else if (s.equipment?.extinguishersUsed === "N") {
    equipmentEntries.push({
      label: "Extinguishers used",
      value: "N"
    });
  }

  if (s.equipment?.hoseReelsUsed === "Y") {
    equipmentEntries.push({
      label: "Hose reels used",
      value: s.equipment?.hoseReelsCount
        ? `Y, ${s.equipment.hoseReelsCount}`
        : "Y"
    });
  } else if (s.equipment?.hoseReelsUsed === "N") {
    equipmentEntries.push({
      label: "Hose reels used",
      value: "N"
    });
  }

  if (s.equipment?.hydrantsUsed === "Y") {
    equipmentEntries.push({
      label: "Hydrants used",
      value: s.equipment?.hydrantsCount
        ? `Y, ${s.equipment.hydrantsCount}`
        : "Y"
    });
  } else if (s.equipment?.hydrantsUsed === "N") {
    equipmentEntries.push({
      label: "Hydrants used",
      value: "N"
    });
  }

  addSection("Structure - Equipment", equipmentEntries);

  return lines;
}

function hasAnyResponderInjury() {
  const applianceInjury = Object.values(state.responders.appliances || {}).some((appliance) =>
    (appliance.crew || []).some((member) => member.isInjured)
  );

  const directInjury = (state.responders.directResponders || []).some((member) => member.isInjured);

  return applianceInjury || directInjury;
}

function getJobCodeForSubject() {
  const incidentType = String(state.incident.incidentType || "").trim();
  const responseCode = String(state.incident.responseCode || "").trim();

  const typeMap = {
    "Incident": "INCI",
    "Rescue": "RESC",
    "Structure Fire": "STRU",
    "Alarm": "ALAR",
    "Non-Structure": "NSTR",
    "Grass / Scrub": "G&S"
  };

  const responseMap = {
    "Code 1": "C1",
    "Code 3": "C3"
  };

  const typeShort = typeMap[incidentType] || incidentType.toUpperCase().replace(/\s+/g, "");
  const responseShort = responseMap[responseCode] || responseCode.toUpperCase().replace(/\s+/g, "");

  if (!typeShort && !responseShort) return "";
  return `${typeShort}${responseShort}`;
}

function formatDateForSubject(dateValue) {
  if (!dateValue) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [yyyy, mm, dd] = dateValue.split("-");
    return `${dd}-${mm}-${yyyy}`;
  }
  return dateValue;
}

function getMissingWarnings() {
  const warnings = [];

  if (!state.incident.actualAddress) {
    warnings.push({
      key: "actualAddress",
      label: "Actual address missing",
      page: "incidentPage",
      targetId: "actualAddress"
    });
  }

  if (!state.incident.distanceToScene) {
    warnings.push({
      key: "distanceToScene",
      label: "Distance to scene missing",
      page: "incidentPage",
      targetId: "distanceToScene"
    });
  }

  if (!state.incident.firstAgency) {
    warnings.push({
      key: "firstAgency",
      label: "1st agency missing",
      page: "incidentPage",
      targetId: "firstAgency"
    });
  }

  if (!state.incident.weather1) {
    warnings.push({
      key: "weather1",
      label: "Weather missing",
      page: "incidentPage",
      targetId: "weather1"
    });
  }

  if (!state.responders.oicName) {
    warnings.push({
      key: "oicName",
      label: "OIC missing",
      page: "respondersPage",
      targetId: null
    });
  }

  if (
    !String(state.profile.name || "").trim() ||
    !String(state.profile.memberNumber || "").trim() ||
    !String(state.profile.contactNumber || "").trim()
  ) {
    warnings.push({
      key: "profileMissing",
      label: "Profile details missing",
      page: "incidentPage",
      targetId: null
    });
  }

  if (hasAnyResponderInjury() && !String(state.responders.injuryNotes || "").trim()) {
    warnings.push({
      key: "respondersInjuryNotes",
      label: "Responder injury notes missing",
      page: "respondersPage",
      targetId: "respondersInjuryNotes"
    });
  }

  return warnings;
}

function getReportLines() {
  const incident = state.incident;
  const responders = state.responders;
  const lines = [];

  lines.push("CONNEWARRE FIRE BRIGADE TURNOUT SHEET");
  lines.push("");

  if (incident.pagerDetails) {
    lines.push(incident.pagerDetails);
    lines.push("");
  }

  if (responders.oicName) {
    const oicParts = [responders.oicName, "CONNEWARRE"];
    if (responders.oicPhone) oicParts.push(responders.oicPhone);
    lines.push(`Officer in charge: ${oicParts.join(", ")}`);
    lines.push("");
  }

  if (incident.actualAddress) {
    lines.push(`Actual location: ${incident.actualAddress}`);
  }

  if (incident.controlName) {
    lines.push(`Control name: ${incident.controlName}`);
  }

  const agencyLine = formatAgencyLine(incident.firstAgency);
  if (agencyLine) {
    lines.push(agencyLine);
  }

  if (incident.sceneUnits?.length) {
    lines.push(`Brigades on scene: ${incident.sceneUnits.join(", ")}`);
  }

  if (incident.otherAgencies?.length) {
    const selectedAgencyTypes = incident.otherAgencies.map((a) => a.type).filter(Boolean);
    if (selectedAgencyTypes.length) {
      lines.push(`Other agencies on scene: ${selectedAgencyTypes.join(", ")}`);
    }
  }

  if (incident.weather1) {
    let weather = incident.weather1;
    if (incident.weather2) weather += ` and ${incident.weather2}`;
    lines.push(`Weather: ${weather}`);
  }

  if (incident.distanceToScene) {
    lines.push(`Distance to scene: ${formatDistance(incident.distanceToScene)}`);
  }

  if (incident.hosesUsed) {
    lines.push(`Hoses used: ${incident.hosesUsed}`);
  }

  if (incident.comments) {
    lines.push(`Comments: ${incident.comments}`);
  }

const structureLines = buildStructureReportLines();
if (structureLines.length) {
  lines.push("");
  lines.push(...structureLines);
}
  
  lines.push("");
  lines.push("MEMBERS RESPONDING");
  lines.push("");

  const appliancesWithCrew = Object.values(responders.appliances || {}).filter(
    (appliance) => Array.isArray(appliance.crew) && appliance.crew.length > 0
  );

  if (!appliancesWithCrew.length) {
    lines.push("NO APPLIANCE ON SCENE");
    lines.push("");
  } else {
    appliancesWithCrew.forEach((appliance) => {
      const applianceLabel = formatApplianceLabel(appliance.label);
      const code = appliance.code ? appliance.code.toUpperCase().replace(/^C/, "CODE ") : "";
      lines.push(`${applianceLabel.padEnd(30)} ${code}`.trimEnd());

      appliance.crew.forEach((member) => {
        lines.push(buildCrewLine(member));
      });

      lines.push("");
    });
  }

  if (responders.directResponders?.length) {
    lines.push("DIRECT");
    responders.directResponders.forEach((member) => {
      lines.push(buildCrewLine(member));
    });
    lines.push("");
  }

  if (responders.stationResponders?.length) {
    lines.push("STATION");
    responders.stationResponders.forEach((member) => {
      lines.push(member.name || "");
    });
    lines.push("");
  }

if (incident.otherAgencies?.length) {
  incident.otherAgencies.forEach((agency) => {
    const typeLabel = String(agency.type || agency.agencyName || "").trim().toUpperCase();
    const summary = getOtherAgencySummary(agency);
    const notes = String(agency.notes || "").trim();

    if (typeLabel && summary) {
      lines.push(`${typeLabel}: ${summary}`);
    } else if (typeLabel) {
      lines.push(`${typeLabel}:`);
    }

    if (notes) {
      lines.push(`NOTES: ${notes}`);
    }

    if ((typeLabel && summary) || typeLabel || notes) {
      lines.push("");
    }
  });
}

  if (hasAnyResponderInjury()) {
    if (responders.injuryNotes) {
      lines.push(`Injuries - ${responders.injuryNotes}`);
    } else {
      lines.push("Injuries - NOTE MISSING");
    }
  }

  if (incident.flags?.membersBefore) {
    lines.push("There were members direct before 1st appliance");
  }

  if (incident.flags?.hotDebrief) {
    lines.push("Hot debrief conducted");
  }

  if (incident.flags?.aarRequired) {
    lines.push("After action review needed");
  }

  if (incident.signalCode) {
    let signalLine = `Signal ${incident.signalCode}`;
    if (incident.signalNotes) signalLine += ` - ${incident.signalNotes}`;
    lines.push(signalLine);
  }

  lines.push("");
  lines.push("REPORT CREATED BY:");

  const profileName = String(state.profile.name || "").trim();
  const profileBrigade = String(state.profile.brigade || "Connewarre").trim();
  const profileMemberNumber = String(state.profile.memberNumber || "").trim();
  const profileContactNumber = String(state.profile.contactNumber || "").trim();

  const createdByParts = [
    profileName,
    profileBrigade,
    profileMemberNumber,
    profileContactNumber
  ].filter(Boolean);

  if (profileName && profileMemberNumber && profileContactNumber) {
    lines.push(createdByParts.join(", "));
  } else {
    lines.push("PROFILE DETAILS MISSING");
  }

  return lines;
}

function getReportText() {
  return getReportLines().join("\n");
}

function getEmailSubject() {
  const date = formatDateForSubject(state.incident.pagerDate);
  const jobCode = getJobCodeForSubject();
  const actualAddress = state.incident.actualAddress || "";
  return [date, jobCode, actualAddress].filter(Boolean).join(" | ");
}

function loadSavedReports() {
  try {
    const raw = localStorage.getItem(REPORT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Failed to load saved reports", error);
    return [];
  }
}

function saveSavedReports(reports) {
  try {
    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
  } catch (error) {
    console.warn("Failed to save reports", error);
  }
}

function saveCurrentReportLocally() {
  const reports = loadSavedReports();
  const now = new Date();
  const report = {
    id: `report_${Date.now()}`,
    title: getEmailSubject() || `Saved report ${now.toLocaleString("en-AU")}`,
    savedAt: now.toISOString(),
    text: getReportText(),
    incidentSnapshot: JSON.parse(JSON.stringify(state.incident)),
    respondersSnapshot: JSON.parse(JSON.stringify(state.responders))
  };

  reports.unshift(report);
  saveSavedReports(reports);
  renderSavedReportsList();
}

function applySavedReport(report) {
  if (!report) return;

  state.incident = Object.assign({}, state.incident, report.incidentSnapshot || {});
  state.responders = Object.assign({}, state.responders, report.respondersSnapshot || {});

  saveState();
  loadIncidentIntoInputs();
  renderRespondersPage();
  renderReportTools();
}

function deleteSavedReport(reportId) {
  const confirmed = window.confirm("Delete saved report? This cannot be undone.");
  if (!confirmed) return;

  const reports = loadSavedReports().filter((r) => r.id !== reportId);
  saveSavedReports(reports);
  renderSavedReportsList();
}

function jumpToField(warning) {
  setCurrentPage(warning.page);

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === warning.page);
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === warning.page);
  });

  if (warning.page === "incidentPage") {
    loadIncidentIntoInputs();
  }

  if (warning.page === "respondersPage") {
    renderRespondersPage();
  }

  if (warning.targetId) {
    setTimeout(() => {
      const el = document.getElementById(warning.targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }, 100);
  }
}

function renderWarnings() {
  const wrap = document.getElementById("reportWarnings");
  if (!wrap) return;

  const warnings = getMissingWarnings();
  wrap.innerHTML = "";

  warnings.forEach((warning) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip-btn ops-chip";
    btn.textContent = warning.label;
    btn.addEventListener("click", () => jumpToField(warning));
    wrap.appendChild(btn);
  });

  wrap.classList.toggle("hidden", warnings.length === 0);
}

function setActiveReportTab(tabName) {
  const tabs = ["sms", "email", "save"];
  tabs.forEach((tab) => {
    const btn = document.getElementById(`reportTab${tab[0].toUpperCase()}${tab.slice(1)}`);
    const panel = document.getElementById(`reportPanel${tab[0].toUpperCase()}${tab.slice(1)}`);

    if (btn) btn.classList.toggle("active", tab === tabName);
    if (panel) panel.classList.toggle("hidden", tab !== tabName);
  });
}

function renderSavedReportsList() {
  const wrap = document.getElementById("savedReportsList");
  if (!wrap) return;

  const reports = loadSavedReports();
  wrap.innerHTML = "";

  if (!reports.length) {
    wrap.innerHTML = `<div class="placeholder-panel"><strong>No saved reports yet</strong></div>`;
    return;
  }

  reports.forEach((report) => {
    const card = document.createElement("div");
    card.className = "agency-card expanded";
    card.innerHTML = `
      <div class="agency-card-head">
        <div class="agency-summary">${escapeHtml(report.title)}</div>
        <div class="agency-actions">
          <button class="tiny-btn" data-open-report="${report.id}" type="button">Open</button>
          <button class="tiny-btn" data-delete-report="${report.id}" type="button">Delete</button>
        </div>
      </div>
      <div class="subtle">${new Date(report.savedAt).toLocaleString("en-AU")}</div>
    `;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll("[data-open-report]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const report = loadSavedReports().find((r) => r.id === btn.dataset.openReport);
      applySavedReport(report);
    });
  });

  wrap.querySelectorAll("[data-delete-report]").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteSavedReport(btn.dataset.deleteReport);
    });
  });
}

function copyReportText() {
  const text = getReportText();
  navigator.clipboard.writeText(text).then(() => {
    const status = document.getElementById("reportActionStatus");
    if (status) status.textContent = "Report copied to clipboard.";
  }).catch(() => {
    const status = document.getElementById("reportActionStatus");
    if (status) status.textContent = "Copy failed. Please copy manually.";
  });
}

function openSms() {
  const body = encodeURIComponent(getReportText());
  window.location.href = `sms:?body=${body}`;
}

function openEmail() {
  const subject = encodeURIComponent(getEmailSubject());
  const body = encodeURIComponent(getReportText());
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

function renderPanelText() {
  const preview = document.getElementById("reportPreview");
  if (preview) {
    preview.textContent = getReportText();
  }

  const emailSubject = document.getElementById("reportEmailSubject");
  if (emailSubject) {
    emailSubject.value = getEmailSubject();
  }

  const emailBody = document.getElementById("reportEmailBody");
  if (emailBody) {
    emailBody.value = getReportText();
  }
}

export function renderReportPreview() {
  renderReportTools();
}

export function renderReportTools() {
  renderWarnings();
  renderPanelText();
  renderSavedReportsList();
}

export function bindReportEvents() {
  const smsBtn = document.getElementById("reportTabSms");
  const emailBtn = document.getElementById("reportTabEmail");
  const saveBtn = document.getElementById("reportTabSave");

  smsBtn?.addEventListener("click", () => setActiveReportTab("sms"));
  emailBtn?.addEventListener("click", () => setActiveReportTab("email"));
  saveBtn?.addEventListener("click", () => setActiveReportTab("save"));

  document.getElementById("copySmsBtn")?.addEventListener("click", copyReportText);
  document.getElementById("openSmsBtn")?.addEventListener("click", openSms);
  document.getElementById("openEmailBtn")?.addEventListener("click", openEmail);
  document.getElementById("saveReportBtn")?.addEventListener("click", () => {
    saveCurrentReportLocally();
    const status = document.getElementById("reportActionStatus");
    if (status) status.textContent = "Report saved locally.";
  });

  setActiveReportTab("sms");
  renderReportTools();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
