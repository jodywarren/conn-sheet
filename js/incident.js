import { state, saveState } from "./state.js";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SIGNAL_OPTIONS = ["27", "55", "83", "40", "56"];
const DETAIL_TABS = ["mva", "structure", "alarm"];

export function bindIncidentInputs() {
  bindTextInputs();
  bindSelect("firstAgency");
  bindSelect("distanceToScene");
  bindSelect("weather1");
  bindSelect("weather2");
  bindSceneUnits();
  bindOtherAgencyControls();
  bindOperationalChips();
  bindSignalChips();
  bindDetailTabs();
  bindPanelToggles();
}

function bindTextInputs() {
  const plainFields = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "alertAreaCode",
    "brigadeRole",
    "incidentType",
    "responseCode",
    "pagerDetails",
    "scannedAddress",
    "controlName",
    "actualAddress",
    "injuryNotes",
    "signalNotes"
  ];

  plainFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", () => {
      if (id === "actualAddress") {
        state.incident.actualAddressEdited = true;
      }

      state.incident[id] = el.value.trim();
      saveState();
      applyFieldCompletionStates();
    });
  });
}

function bindSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("change", () => {
    state.incident[id] = el.value;
    applyWeatherRules(id);
    saveState();
    applyFieldCompletionStates();
    loadIncidentIntoInputs();
  });
}

function applyWeatherRules(changedId) {
  const w1 = state.incident.weather1;
  const w2 = state.incident.weather2;

  const incompatibleWithFine = new Set(["Overcast", "Windy", "Rain", "Storm", "Fog", "Smoke"]);

  if (changedId === "weather1" && w1 === "Fine" && incompatibleWithFine.has(w2)) {
    state.incident.weather2 = "";
  }

  if (changedId === "weather2" && incompatibleWithFine.has(w2) && w1 === "Fine") {
    state.incident.weather1 = "";
  }

  if (changedId === "weather2" && w2 === "Sunny" && !w1) {
    state.incident.weather1 = "Fine";
  }
}

function bindSceneUnits() {
  const input = document.getElementById("sceneUnitInput");
  const addBtn = document.getElementById("addSceneUnitBtn");

  if (!input || !addBtn) return;

  addBtn.addEventListener("click", addSceneUnitFromInput);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addSceneUnitFromInput();
    }
  });
}

function addSceneUnitFromInput() {
  const input = document.getElementById("sceneUnitInput");
  if (!input) return;

  const raw = String(input.value || "").trim().toUpperCase();
  if (!raw) return;

  const code = normalizeSceneUnit(raw);

  if (!state.incident.sceneUnits.includes(code)) {
    state.incident.sceneUnits.push(code);
  }

  input.value = "";
  renderSceneUnitChips();
  saveState();
  input.focus();
}

export function setPagedSceneUnits(codes = []) {
  const cleaned = [...new Set(codes.filter(Boolean).map((x) => normalizeSceneUnit(x)))];
  state.incident.pagedSceneUnits = cleaned;
  state.incident.sceneUnits = cleaned.slice();
  renderSceneUnitChips();
  saveState();
}

export function mergePagedSceneUnits(codes = []) {
  const paged = new Set(state.incident.pagedSceneUnits || []);
  const visible = new Set(state.incident.sceneUnits || []);

  codes.forEach((code) => {
    const clean = normalizeSceneUnit(code);
    if (!clean) return;
    paged.add(clean);
    visible.add(clean);
  });

  state.incident.pagedSceneUnits = [...paged];
  state.incident.sceneUnits = [...visible];
  renderSceneUnitChips();
  saveState();
}

export function renderSceneUnitChips() {
  const wrap = document.getElementById("sceneUnitChips");
  if (!wrap) return;

  wrap.innerHTML = "";

  (state.incident.sceneUnits || []).forEach((code) => {
    const chip = document.createElement("div");
    const isPaged = (state.incident.pagedSceneUnits || []).includes(code);

    chip.className = `scene-chip ${isPaged ? "from-pager" : "manual-unit"}`;

    const text = document.createElement("span");
    text.textContent = code;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      state.incident.sceneUnits = state.incident.sceneUnits.filter((x) => x !== code);
      state.incident.pagedSceneUnits = state.incident.pagedSceneUnits.filter((x) => x !== code);
      renderSceneUnitChips();
      saveState();
    });

    chip.appendChild(text);
    chip.appendChild(removeBtn);
    wrap.appendChild(chip);
  });
}

function bindOtherAgencyControls() {
  const addBtn = document.getElementById("addAgencyBtn");
  if (!addBtn) return;

  addBtn.addEventListener("click", () => {
    addOtherAgency();
  });
}

function addOtherAgency() {
  state.incident.otherAgencies.push(createEmptyAgency());
  renderOtherAgencies();
  saveState();
}

function createEmptyAgency() {
  return {
    id: uid(),
    type: "",
    agencyName: "",
    name: "",
    contactNumber: "",
    badgeNumber: "",
    idNumber: "",
    station: "",
    localHq: "",
    office: "",
    notes: "",
    expanded: true
  };
}

function getAgencySummary(agency) {
  const type = agency.type || "Add Agency";
  const who = agency.name || agency.agencyName || "";
  const number = agency.contactNumber || "";
  return [type, who, number].filter(Boolean).join(" • ");
}

function getAgencyFieldConfig(type) {
  switch (type) {
    case "Police":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "badgeNumber", label: "Badge number", mode: "numeric" },
        { key: "station", label: "Station", mode: "text" }
      ];
    case "Ambulance":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "idNumber", label: "ID number", mode: "numeric" },
        { key: "station", label: "Station", mode: "text" }
      ];
    case "SES":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "localHq", label: "Local HQ", mode: "text" }
      ];
    case "Powercor":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "office", label: "Depot / office", mode: "text" }
      ];
    case "Gas":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "office", label: "Depot / office", mode: "text" }
      ];
    case "Council":
      return [
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "office", label: "Office", mode: "text" },
        { key: "notes", label: "Other notes", mode: "text" }
      ];
    case "Other":
      return [
        { key: "agencyName", label: "Agency name", mode: "text" },
        { key: "name", label: "Name", mode: "text" },
        { key: "contactNumber", label: "Contact number", mode: "tel" },
        { key: "notes", label: "Notes", mode: "text" }
      ];
    default:
      return [];
  }
}

function isAgencyComplete(agency) {
  if (!agency || !agency.type) return false;
  const fields = getAgencyFieldConfig(agency.type);
  if (!fields.length) return false;
  return fields.every((field) => String(agency[field.key] || "").trim().length > 0);
}

export function renderOtherAgencies() {
  const wrap = document.getElementById("otherAgencyList");
  const addBtn = document.getElementById("addAgencyBtn");
  if (!wrap || !addBtn) return;

  wrap.innerHTML = "";

  (state.incident.otherAgencies || []).forEach((agency) => {
    const fields = getAgencyFieldConfig(agency.type);
    const complete = isAgencyComplete(agency);
    const card = document.createElement("div");
    card.className = `agency-card ${complete ? "complete" : "pending"} ${agency.expanded ? "expanded" : "collapsed"}`;

    if (!agency.expanded) {
      card.innerHTML = `
        <div class="agency-card-head">
          <div class="agency-summary">${escapeHtml(getAgencySummary(agency))}</div>
          <div class="agency-actions">
            <button class="tiny-btn" type="button" data-edit-agency="${agency.id}">Edit</button>
            <button class="tiny-btn" type="button" data-remove-agency="${agency.id}">Remove</button>
          </div>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="agency-card-head">
          <div class="agency-summary">${escapeHtml(agency.type || "Add Agency")}</div>
          <div class="agency-actions">
            <button class="tiny-btn" type="button" data-save-agency="${agency.id}">Save</button>
            <button class="tiny-btn" type="button" data-remove-agency="${agency.id}">Remove</button>
          </div>
        </div>

        <div class="grid agency-grid">
          <label>
            Agency
            <select class="field-input editable-field agency-field ${agency.type ? "field-complete" : ""}" data-agency-id="${agency.id}" data-field="type">
              <option value="">Select agency</option>
              <option ${agency.type === "Police" ? "selected" : ""}>Police</option>
              <option ${agency.type === "Ambulance" ? "selected" : ""}>Ambulance</option>
              <option ${agency.type === "SES" ? "selected" : ""}>SES</option>
              <option ${agency.type === "Powercor" ? "selected" : ""}>Powercor</option>
              <option ${agency.type === "Gas" ? "selected" : ""}>Gas</option>
              <option ${agency.type === "Council" ? "selected" : ""}>Council</option>
              <option ${agency.type === "Other" ? "selected" : ""}>Other</option>
            </select>
          </label>

          ${fields.map((field) => {
            const val = String(agency[field.key] || "");
            const inputType = field.mode === "tel" ? "tel" : "text";
            const inputMode = field.mode === "numeric" ? "numeric" : field.mode === "tel" ? "tel" : "text";

            return `
              <label>
                ${field.label}
                <input
                  class="field-input editable-field agency-field ${val.trim() ? "field-complete" : ""}"
                  type="${inputType}"
                  inputmode="${inputMode}"
                  value="${escapeHtml(val)}"
                  data-agency-id="${agency.id}"
                  data-field="${field.key}"
                />
              </label>
            `;
          }).join("")}
        </div>
      `;
    }

    wrap.appendChild(card);
  });

  addBtn.textContent = state.incident.otherAgencies.length ? "Add another agency" : "Add Agency";
  addBtn.classList.remove("has-complete", "needs-attention");
  addBtn.classList.add("orange-btn");

  bindRenderedOtherAgencyEvents();
}

function bindRenderedOtherAgencyEvents() {
  document.querySelectorAll("[data-remove-agency]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.removeAgency;
      state.incident.otherAgencies = state.incident.otherAgencies.filter((agency) => agency.id !== id);
      renderOtherAgencies();
      saveState();
    });
  });

  document.querySelectorAll("[data-edit-agency]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const agency = state.incident.otherAgencies.find((item) => item.id === btn.dataset.editAgency);
      if (!agency) return;
      agency.expanded = true;
      renderOtherAgencies();
      saveState();
    });
  });

  document.querySelectorAll("[data-save-agency]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const agency = state.incident.otherAgencies.find((item) => item.id === btn.dataset.saveAgency);
      if (!agency) return;
      if (isAgencyComplete(agency)) {
        agency.expanded = false;
        renderOtherAgencies();
        saveState();
      }
    });
  });

  document.querySelectorAll(".agency-field").forEach((el) => {
    const eventName = el.tagName === "SELECT" ? "change" : "input";

    el.addEventListener(eventName, () => {
      const agency = state.incident.otherAgencies.find((item) => item.id === el.dataset.agencyId);
      if (!agency) return;

      agency[el.dataset.field] = String(el.value || "").trim();

      if (el.dataset.field === "type") {
        renderOtherAgencies();
        saveState();
      } else {
        el.classList.toggle("field-complete", String(el.value || "").trim().length > 0);
        saveState();
      }
    });
  });
}

function bindOperationalChips() {
  bindFlagChip("membersBeforeChip", "membersBefore");
  bindFlagChip("hotDebriefChip", "hotDebrief");
  bindFlagChip("aarRequiredChip", "aarRequired");
  bindFlagChip("injuryChip", "injury");

  const signalChip = document.getElementById("signalChip");
  if (signalChip) {
    signalChip.addEventListener("click", () => {
      const active = signalChip.classList.toggle("active");

      if (!active) {
        state.incident.signalCode = "";
        state.incident.signalNotes = "";
      }

      toggleSignalNotes();
      renderSignalChips();
      saveState();
      applyFieldCompletionStates();
    });
  }
}

function bindSignalChips() {
  renderSignalChips();
}

function renderSignalChips() {
  const wrap = document.getElementById("signalWrap");
  if (!wrap) return;

  const chip = document.getElementById("signalChip");
  const active = chip?.classList.contains("active");

  wrap.innerHTML = "";

  if (!active) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");

  const row = document.createElement("div");
  row.className = "chips ops-chip-row";

  SIGNAL_OPTIONS.forEach((code) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip-btn ops-chip ${state.incident.signalCode === code ? "active" : ""}`;
    btn.textContent = code;

    btn.addEventListener("click", () => {
      state.incident.signalCode = state.incident.signalCode === code ? "" : code;
      saveState();
      renderSignalChips();
      toggleSignalNotes();
      applyFieldCompletionStates();
    });

    row.appendChild(btn);
  });

  wrap.appendChild(row);
}

function bindFlagChip(chipId, flagKey) {
  const chip = document.getElementById(chipId);
  if (!chip) return;

  chip.addEventListener("click", () => {
    state.incident.flags[flagKey] = !state.incident.flags[flagKey];

    if (flagKey === "injury" && !state.incident.flags[flagKey]) {
      state.incident.injuryNotes = "";
    }

    saveState();
    toggleInjuryNotes();
    applyOperationalChipStates();
    applyFieldCompletionStates();
  });
}

function bindDetailTabs() {
  document.querySelectorAll("[data-detail-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = String(btn.dataset.detailTab || "").trim().toLowerCase();
      if (!DETAIL_TABS.includes(tab)) return;

      state.incident.activeDetailTab = state.incident.activeDetailTab === tab ? "" : tab;
      saveState();
      applyDetailTabState();
    });
  });
}

function applyDetailTabState() {
  const activeTab = String(state.incident.activeDetailTab || "").trim().toLowerCase();

  document.querySelectorAll("[data-detail-tab]").forEach((btn) => {
    const tab = String(btn.dataset.detailTab || "").trim().toLowerCase();
    btn.classList.toggle("active", tab === activeTab);
  });

  DETAIL_TABS.forEach((tab) => {
    const panel = document.getElementById(`detailTabPanel-${tab}`);
    if (!panel) return;
    panel.classList.toggle("hidden", tab !== activeTab);
  });
}

function toggleInjuryNotes() {
  const wrap = document.getElementById("injuryNotesWrap");
  if (!wrap) return;

  const show = Boolean(state.incident.flags?.injury);
  wrap.classList.toggle("hidden", !show);

  const input = document.getElementById("injuryNotes");
  if (input && !show) {
    input.value = "";
  }
}

function toggleSignalNotes() {
  const chip = document.getElementById("signalChip");
  const wrap = document.getElementById("signalWrap");
  const notesWrap = document.getElementById("signalNotesWrap");

  const active = chip?.classList.contains("active");
  if (wrap) wrap.classList.toggle("hidden", !active);
  if (notesWrap) notesWrap.classList.toggle("hidden", !(active && state.incident.signalCode));
}

export function loadIncidentIntoInputs() {
  const fieldMap = {
    eventNumber: state.incident.eventNumber,
    pagerDate: state.incident.pagerDate,
    pagerTime: state.incident.pagerTime,
    alertAreaCode: state.incident.alertAreaCode,
    brigadeRole: state.incident.brigadeRole,
    incidentType: state.incident.incidentType,
    responseCode: state.incident.responseCode,
    pagerDetails: state.incident.pagerDetails,
    scannedAddress: state.incident.scannedAddress,
    actualAddress: state.incident.actualAddress,
    controlName: state.incident.controlName,
    firstAgency: state.incident.firstAgency,
    distanceToScene: state.incident.distanceToScene,
    weather1: state.incident.weather1,
    weather2: state.incident.weather2,
    injuryNotes: state.incident.injuryNotes,
    signalNotes: state.incident.signalNotes
  };

  Object.entries(fieldMap).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value || "";
  });

  renderSceneUnitChips();
  renderOtherAgencies();
  renderSignalChips();
  applyOperationalChipStates();
  toggleInjuryNotes();
  toggleSignalNotes();
  applyDetailTabState();
  applyFieldCompletionStates();

  document.dispatchEvent(new Event("incident:loaded"));
}

function applyOperationalChipStates() {
  setChipState("membersBeforeChip", state.incident.flags.membersBefore);
  setChipState("hotDebriefChip", state.incident.flags.hotDebrief);
  setChipState("aarRequiredChip", state.incident.flags.aarRequired);
  setChipState("injuryChip", state.incident.flags.injury);
  setChipState(
    "signalChip",
    Boolean(state.incident.signalCode) || document.getElementById("signalChip")?.classList.contains("active")
  );
}

function setChipState(id, active) {
  const chip = document.getElementById(id);
  if (!chip) return;
  chip.classList.toggle("active", !!active);
}

export function applyFieldCompletionStates() {
  const requiredIds = [
    "eventNumber",
    "pagerDate",
    "pagerTime",
    "alertAreaCode",
    "brigadeRole",
    "incidentType",
    "responseCode",
    "pagerDetails",
    "scannedAddress",
    "actualAddress",
    "firstAgency",
    "distanceToScene",
    "weather1"
  ];

  requiredIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = String(el.value || "").trim();
    el.classList.toggle("field-complete", value.length > 0);
  });

  const optionalIds = ["weather2", "controlName", "signalNotes"];
  optionalIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = String(el.value || "").trim();
    el.classList.toggle("field-complete", value.length > 0);
  });

  const injuryNotes = document.getElementById("injuryNotes");
  if (injuryNotes) {
    const show = Boolean(state.incident.flags?.injury);
    const value = String(injuryNotes.value || "").trim();
    injuryNotes.classList.toggle("field-complete", show && value.length > 0);
  }
}

function normalizeSceneUnit(raw) {
  const code = String(raw || "").trim().toUpperCase();

  if (code === "AFP" || code === "AFPR" || code === "FP") return "Police";
  return code;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function bindPanelToggles() {
  const applianceBtn = document.getElementById("tabAddAppliance");
  const agencyBtn = document.getElementById("tabAddAgency");

  const appliancePanel = document.getElementById("appliancePanel");
  const agencyPanel = document.getElementById("agencyPanel");

  if (!applianceBtn || !agencyBtn || !appliancePanel || !agencyPanel) return;

  applianceBtn.addEventListener("click", () => {
    const isActive = !appliancePanel.classList.contains("hidden");

    appliancePanel.classList.toggle("hidden", isActive);
    agencyPanel.classList.add("hidden");

    applianceBtn.classList.toggle("active", !isActive);
    agencyBtn.classList.remove("active");
  });

  agencyBtn.addEventListener("click", () => {
    const isActive = !agencyPanel.classList.contains("hidden");

    agencyPanel.classList.toggle("hidden", isActive);
    appliancePanel.classList.add("hidden");

    agencyBtn.classList.toggle("active", !isActive);
    applianceBtn.classList.remove("active");
  });
}
