import { state, saveState } from "./state.js";

export function bindIncidentInputs() {
  bindTextInputs();
  bindSelect("firstAgency");
  bindSelect("distanceToScene");
  bindSelect("weather1");
  bindSelect("weather2");
  bindSceneUnits();
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

  const code = input.value.trim().toUpperCase();
  if (!code) return;

  if (!state.incident.sceneUnits.includes(code)) {
    state.incident.sceneUnits.push(code);
  }

  input.value = "";
  renderSceneUnitChips();
  saveState();
  input.focus();
}

export function setPagedSceneUnits(codes = []) {
  const cleaned = [...new Set(codes.filter(Boolean).map((x) => String(x).trim().toUpperCase()))];
  state.incident.pagedSceneUnits = cleaned;
  state.incident.sceneUnits = cleaned.slice();
  renderSceneUnitChips();
  saveState();
}

export function mergePagedSceneUnits(codes = []) {
  const paged = new Set(state.incident.pagedSceneUnits || []);
  const visible = new Set(state.incident.sceneUnits || []);

  codes.forEach((code) => {
    const clean = String(code || "").trim().toUpperCase();
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

  renderSceneUnitChips();
  applyFieldCompletionStates();
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
