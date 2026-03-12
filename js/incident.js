import { state, saveState } from "./state.js";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function bindIncidentInputs() {
  bindTextInputs();
  bindSelect("firstAgency");
  bindSelect("distanceToScene");
  bindSelect("weather1");
  bindSelect("weather2");
  bindSceneUnits();
  bindOtherAgencyControls();
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
    "controlName"
  ];

  plainFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", () => {
      state.incident[id] = el.value.trim();
      saveState();
      applyFieldCompletionStates();
    });
  });

  const actualAddressEl = document.getElementById("actualAddress");
  if (actualAddressEl) {
    actualAddressEl.addEventListener("input", () => {
      state.incident.actualAddress = actualAddressEl.value.trim();
      state.incident.actualAddressEdited = true;
      saveState();
      applyFieldCompletionStates();
    });
  }
}

function bindSelect(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("change", () => {
    state.incident[id] = el.value;
    saveState();

    if (id === "weather1") {
      toggleWeather2Visibility();
    }

    applyFieldCompletionStates();
  });
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
    notes: ""
  };
}

function getAgencyFieldConfig(type) {
  switch (type) {
    case "Police":
      return [
        { key: "name", label: "Name" },
        { key: "contactNumber", label: "Contact number" },
        { key: "badgeNumber", label: "Badge number" },
        { key: "station", label: "Station" }
      ];
    case "Ambulance":
      return [
        { key: "name", label: "Name" },
        { key: "contactNumber", label: "Contact number" },
        { key: "idNumber", label: "ID number" },
        { key: "station", label: "Station" }
      ];
    case "SES":
      return [
        { key: "name", label: "Name" },
        { key: "contactNumber", label: "Contact number" },
        { key: "localHq", label: "Local HQ" }
      ];
    case "Powercor":
      return [
        { key: "name", label: "Name" },
        { key: "contactNumber", label: "Contact number" },
        { key: "office", label: "Depot / office" }
      ];
    case "Gas":
      return [
        { key: "name", label: "Name" },
        { key: "contactNumber", label: "Contact number" },
        { key: "office", label: "Depot / office" }
      ];
    case "Council":
      return [
        { key: "name", label: "Name" },
        { key: "contactNumber", label: "Contact number" },
        { key: "office", label: "Office" },
        { key: "notes", label: "Other notes" }
      ];
    case "Other":
      return [
        { key: "agencyName", label: "Agency name" },
        { key: "name", label: "Name" },
        { key: "contactNumber", label: "Contact number" },
        { key: "notes", label: "Notes" }
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
    card.className = `agency-card ${complete ? "complete" : "pending"}`;

    card.innerHTML = `
      <div class="agency-card-head">
        <div class="agency-card-title">${agency.type || "Add Agency"}</div>
        <button class="tiny-btn" type="button" data-remove-agency="${agency.id}">Remove</button>
      </div>

      <div class="grid">
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

        ${fields.map((field) => `
          <label>
            ${field.label}
            <input
              class="field-input editable-field agency-field ${String(agency[field.key] || "").trim() ? "field-complete" : ""}"
              type="text"
              value="${escapeHtml(agency[field.key] || "")}"
              data-agency-id="${agency.id}"
              data-field="${field.key}"
            />
          </label>
        `).join("")}
      </div>
    `;

    wrap.appendChild(card);
  });

  addBtn.textContent = state.incident.otherAgencies.length ? "Add another agency" : "Add Agency";
  addBtn.classList.toggle("has-complete", (state.incident.otherAgencies || []).every(isAgencyComplete) && state.incident.otherAgencies.length > 0);
  addBtn.classList.toggle("needs-attention", !(state.incident.otherAgencies || []).every(isAgencyComplete));

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

  document.querySelectorAll(".agency-field").forEach((el) => {
    const eventName = el.tagName === "SELECT" ? "change" : "input";

    el.addEventListener(eventName, () => {
      const agency = state.incident.otherAgencies.find((item) => item.id === el.dataset.agencyId);
      if (!agency) return;

      agency[el.dataset.field] = String(el.value || "").trim();
      renderOtherAgencies();
      saveState();
    });
  });
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
    weather2: state.incident.weather2
  };

  Object.entries(fieldMap).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value || "";
  });

  toggleWeather2Visibility();
  renderSceneUnitChips();
  renderOtherAgencies();
  applyFieldCompletionStates();
}

function toggleWeather2Visibility() {
  const wrap = document.getElementById("weather2Wrap");
  if (!wrap) return;

  const selected = String(state.incident.weather1 || "").trim();
  wrap.classList.toggle("hidden", !selected);

  if (!selected) {
    state.incident.weather2 = "";
    const el = document.getElementById("weather2");
    if (el) el.value = "";
  }
}

export function applyFieldCompletionStates() {
  const ids = [
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
    "controlName",
    "firstAgency",
    "distanceToScene",
    "weather1",
    "weather2"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    const value = String(el.value || "").trim();
    el.classList.toggle("field-complete", value.length > 0);
  });
}

function normalizeSceneUnit(raw) {
  const code = String(raw || "").trim().toUpperCase();

  if (code === "AFP" || code === "AFPR" || code === "FP") return "POLICE";
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
